/**
 * Game
 * Owns the main loop, entity lists, scoring, collisions, and
 * rendering for the Hand Ninja game. The blade position is fed
 * in from the HandTracker via setBladeTarget().
 */
class Game {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas - main game canvas (fruit, particles)
   * @param {HTMLCanvasElement} opts.overlayCanvas - blade trail overlay
   * @param {Object} opts.callbacks - { onScoreChange, onLivesChange, onComboChange, onGameOver }
   */
  constructor({ canvas, overlayCanvas, callbacks }) {
    this.canvas = canvas;
    this.overlayCanvas = overlayCanvas;
    this.ctx = canvas.getContext('2d');
    this.overlayCtx = overlayCanvas.getContext('2d');
    this.callbacks = callbacks || {};

    this.blade = new Blade();
    this.spawner = null; // created on resize/start since it needs canvas size

    this.fruits = [];
    this.particles = [];

    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.COMBO_WINDOW_MS = 700;
    this.lives = 3;

    this.running = false;
    this.lastFrameTime = 0;
    this._rafId = null;

    this._smoothedTip = null; // for jitter smoothing
    this.SMOOTHING = 0.35;

    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    [this.canvas, this.overlayCanvas].forEach((c) => {
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
    });

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.width = rect.width;
    this.height = rect.height;

    if (!this.spawner) {
      this.spawner = new Spawner({ width: this.width, height: this.height });
    } else {
      this.spawner.canvas = { width: this.width, height: this.height };
    }
  }

  /**
   * Called by HandTracker with normalized [0,1] coordinates from MediaPipe.
   * Converts to canvas pixel space and feeds the blade.
   * Note: incoming x is already in the "mirrored" camera space, and since
   * our canvases are CSS-mirrored too, we use the coordinate directly.
   */
  setBladeTarget(norm) {
    if (!this.running) return;

    const targetX = norm.x * this.width;
    const targetY = norm.y * this.height;

    if (!this._smoothedTip) {
      this._smoothedTip = { x: targetX, y: targetY };
    } else {
      this._smoothedTip.x = MathUtils.lerp(this._smoothedTip.x, targetX, this.SMOOTHING);
      this._smoothedTip.y = MathUtils.lerp(this._smoothedTip.y, targetY, this.SMOOTHING);
    }

    this.blade.addPoint(this._smoothedTip.x, this._smoothedTip.y);
  }

  start() {
    this.fruits = [];
    this.particles = [];
    this.score = 0;
    this.combo = 0;
    this.lives = 3;
    this.blade = new Blade();
    this._smoothedTip = null;

    if (this.spawner) this.spawner.reset();

    this.running = true;
    this.lastFrameTime = performance.now();
    this._loop();

    this._emitState();
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._resizeHandler);
  }

  _loop() {
    if (!this.running) return;

    const now = performance.now();
    let dtMs = now - this.lastFrameTime;
    dtMs = Math.min(dtMs, 50); // clamp for tab-switch hiccups
    this.lastFrameTime = now;
    const dt = dtMs / 1000;

    this._update(dt, dtMs);
    this._render();

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _update(dt, dtMs) {
    // Spawn new fruit
    const spawned = this.spawner.update(dtMs);
    for (const f of spawned) this.fruits.push(f);

    // Update blade
    this.blade.update();

    // Update fruits
    for (const fruit of this.fruits) {
      fruit.update(dt, this.height);

      // Fruit fell off screen without being sliced -> lose life (not for bombs)
      if (fruit.markedForRemoval && !fruit.sliced && !fruit.isBomb) {
        this._loseLife();
      }
    }
    this.fruits = this.fruits.filter((f) => !f.markedForRemoval);

    // Collision: blade segment vs fruit
    const segment = this.blade.getLatestSegment();
    if (segment && this.blade.getSpeed() > 0.15) {
      for (const fruit of this.fruits) {
        if (fruit.sliced) continue;

        const hit = MathUtils.segmentCircleIntersect(
          segment.x1,
          segment.y1,
          segment.x2,
          segment.y2,
          fruit.x,
          fruit.y,
          fruit.radius
        );

        if (hit) {
          const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
          fruit.slice(angle);

          if (fruit.isBomb) {
            this._onBombHit(fruit);
          } else {
            this._onFruitSliced(fruit);
          }
        }
      }
    }

    // Update particles
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);

    // Combo decay
    if (this.combo > 0) {
      this.comboTimer -= dtMs;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.callbacks.onComboChange?.(this.combo);
      }
    }
  }

  _onFruitSliced(fruit) {
    this.combo += 1;
    this.comboTimer = this.COMBO_WINDOW_MS;

    const points = 10 * Math.min(this.combo, 5);
    this.score += points;

    const color = this._juiceColorFor(fruit.type);
    this.particles.push(...Particle.burst(fruit.x, fruit.y, color, 16));

    this.callbacks.onScoreChange?.(this.score);
    this.callbacks.onComboChange?.(this.combo);
  }

  _onBombHit(fruit) {
    this.particles.push(...Particle.burst(fruit.x, fruit.y, '#ffcf5c', 28));
    this.particles.push(...Particle.burst(fruit.x, fruit.y, '#444', 18));
    this.combo = 0;
    this.callbacks.onComboChange?.(this.combo);
    this.lives = 0; // bomb ends the run immediately
    this.callbacks.onLivesChange?.(this.lives);
    this._gameOver();
  }

  _loseLife() {
    this.lives -= 1;
    this.callbacks.onLivesChange?.(this.lives);
    if (this.lives <= 0) {
      this._gameOver();
    }
  }

  _gameOver() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.callbacks.onGameOver?.(this.score);
  }

  _juiceColorFor(type) {
    const map = {
      watermelon: 'rgba(120, 220, 120, 0.9)',
      apple: 'rgba(230, 80, 70, 0.9)',
      orange: 'rgba(255, 160, 50, 0.9)',
      kiwi: 'rgba(170, 220, 80, 0.9)',
      plum: 'rgba(150, 80, 180, 0.9)',
      lemon: 'rgba(250, 230, 90, 0.9)',
    };
    return map[type] || 'rgba(255, 255, 255, 0.9)';
  }

  _emitState() {
    this.callbacks.onScoreChange?.(this.score);
    this.callbacks.onComboChange?.(this.combo);
    this.callbacks.onLivesChange?.(this.lives);
  }

  _render() {
    const ctx = this.ctx;
    const overlayCtx = this.overlayCtx;

    ctx.clearRect(0, 0, this.width, this.height);
    overlayCtx.clearRect(0, 0, this.width, this.height);

    for (const fruit of this.fruits) fruit.draw(ctx);
    for (const p of this.particles) p.draw(ctx);

    this.blade.draw(overlayCtx);
  }
}