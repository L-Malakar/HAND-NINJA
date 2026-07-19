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
    this.fruitHalves = [];
    this.particles = [];
    this.screenEffects = [];
    this.explosions = [];
    this.floatingTexts = [];

    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.COMBO_WINDOW_MS = 700;
    this.lives = 3;

    // 'playing' -> normal gameplay, 'exploding' -> bomb sequence playing
    // out (no more spawns/scoring) before the game-over screen appears,
    // 'over' -> run has ended.
    this.gameState = 'playing';
    this._explodeTimer = 0;

    // Screen shake + full-screen flash, used for the bomb explosion.
    this.shake = { time: 0, duration: 0, magnitude: 0 };
    this.flashAlpha = 0;

    this.running = false;
    this.lastFrameTime = 0;
    this._rafId = null;

    this._smoothedTip = null; // for jitter smoothing
    this.SMOOTHING = 0.35;

    this._activeBombCount = 0; // how many bombs are currently on screen (drives the boom loop)

    // A single swipe usually crosses multiple fruit across several
    // animation frames, not all in one frame, so cut/multi-cut is decided
    // after a short silence rather than per-frame.
    this._swipeSliceCount = 0;
    this._swipeSilenceTimer = 0;
    this.SWIPE_SOUND_WINDOW_MS = 180;

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
    this.fruitHalves = [];
    this.particles = [];
    this.screenEffects = [];
    this.explosions = [];
    this.floatingTexts = [];
    this.score = 0;
    this.combo = 0;
    this.lives = 3;
    this.blade = new Blade();
    this._smoothedTip = null;

    this.gameState = 'playing';
    this._explodeTimer = 0;
    this.shake = { time: 0, duration: 0, magnitude: 0 };
    this.flashAlpha = 0;

    if (this.spawner) this.spawner.reset();

    AudioFX.stopBombLoop?.();
    this._activeBombCount = 0;
    this._swipeSliceCount = 0;
    this._swipeSilenceTimer = 0;

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
    // Once a bomb has been hit, gameplay is frozen: no more spawns, no
    // more scoring. We just let the explosion, shrapnel, and any fruit
    // already in the air finish playing out before ending the run.
    if (this.gameState === 'exploding') {
      this._updateExplodingSequence(dt);
      return;
    }

    // Spawn new fruit
    const spawned = this.spawner.update(dtMs);
    for (const f of spawned) {
      this.fruits.push(f);
      if (!f.isBomb) AudioFX.fruitIn?.();
    }

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

    // Loop the boom sound for as long as any bomb is visible on screen.
    const bombCount = this.fruits.reduce((n, f) => n + (f.isBomb ? 1 : 0), 0);
    if (bombCount > 0 && this._activeBombCount === 0) {
      AudioFX.startBombLoop?.();
    } else if (bombCount === 0 && this._activeBombCount > 0) {
      AudioFX.stopBombLoop?.();
    }
    this._activeBombCount = bombCount;

    // Update fruit halves (independent pieces from previously sliced fruit)
    for (const half of this.fruitHalves) {
      half.update(dt, this.height);
    }
    this.fruitHalves = this.fruitHalves.filter((h) => !h.markedForRemoval);

    // Collision: blade segment vs fruit
    const segment = this.blade.getLatestSegment();
    const bladeSpeed = this.blade.getSpeed();
    if (segment && bladeSpeed > 0.15) {
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

          if (!fruit.isBomb) {
            // Split into two independent pieces that actually separate.
            const [halfA, halfB] = FruitHalf.createPairFromFruit(fruit, angle);
            this.fruitHalves.push(halfA, halfB);
          }

          fruit.slice(angle);

          if (fruit.isBomb) {
            this._onBombHit(fruit);
          } else {
            this._onFruitSliced(fruit, angle, bladeSpeed);
            this._swipeSliceCount += 1;
            this._swipeSilenceTimer = 0;
          }
        }
      }
    }

    // Decide cut vs multi-cut once the swipe has gone quiet for a beat,
    // since one continuous swipe usually lands its fruit across several
    // frames rather than all in the same frame.
    if (this._swipeSliceCount > 0) {
      this._swipeSilenceTimer += dtMs;
      if (this._swipeSilenceTimer >= this.SWIPE_SOUND_WINDOW_MS) {
        if (this._swipeSliceCount === 1) {
          AudioFX.cut?.();
        } else {
          AudioFX.multiCut?.();
        }
        this._swipeSliceCount = 0;
        this._swipeSilenceTimer = 0;
      }
    }

    // Update particles
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);

    // Update lingering splash effects at cut spots
    for (const fx of this.screenEffects) fx.update(dt);
    this.screenEffects = this.screenEffects.filter((fx) => !fx.markedForRemoval);

    // Update floating score/combo popups
    for (const t of this.floatingTexts) t.update(dt);
    this.floatingTexts = this.floatingTexts.filter((t) => !t.markedForRemoval);

    // Combo decay
    if (this.combo > 0) {
      this.comboTimer -= dtMs;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.callbacks.onComboChange?.(this.combo);
      }
    }
  }

  /**
   * While the bomb sequence is playing, gameplay logic is paused but the
   * world keeps physically simulating: smoke rises, shrapnel tumbles,
   * fruit already airborne keeps falling, and the shake/flash decay out.
   * Once the timer runs out we hand off to the real game-over screen.
   */
  _updateExplodingSequence(dt) {
    this.blade.update();

    for (const fx of this.explosions) fx.update(dt);
    this.explosions = this.explosions.filter((e) => !e.markedForRemoval);

    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);

    for (const fruit of this.fruits) fruit.update(dt, this.height);
    this.fruits = this.fruits.filter((f) => !f.markedForRemoval);

    for (const half of this.fruitHalves) half.update(dt, this.height);
    this.fruitHalves = this.fruitHalves.filter((h) => !h.markedForRemoval);

    for (const fx of this.screenEffects) fx.update(dt);
    this.screenEffects = this.screenEffects.filter((fx) => !fx.markedForRemoval);

    for (const t of this.floatingTexts) t.update(dt);
    this.floatingTexts = this.floatingTexts.filter((t) => !t.markedForRemoval);

    if (this.shake.time > 0) this.shake.time = Math.max(0, this.shake.time - dt);
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);

    this._explodeTimer -= dt;
    if (this._explodeTimer <= 0) {
      this._gameOver();
    }
  }

  _onFruitSliced(fruit, angle, bladeSpeed) {
    this.combo += 1;
    this.comboTimer = this.COMBO_WINDOW_MS;

    const points = 10 * Math.min(this.combo, 5);
    this.score += points;

    const color = this._juiceColorFor(fruit.type);
    const force = MathUtils.clamp(bladeSpeed / 1.4, 0.8, 2.2);

    // Juice bursts outward roughly perpendicular to the slice, biased by
    // how hard the blade was moving, then splats and drips on the screen.
    this.particles.push(...Particle.burst(fruit.x, fruit.y, color, 16));
    this.screenEffects.push(
      new ScreenEffect(fruit.x, fruit.y, color, fruit.radius * 1.4, {
        dirX: Math.cos(angle + Math.PI / 2),
        dirY: Math.sin(angle + Math.PI / 2),
        force,
      })
    );

    this.floatingTexts.push(
      new FloatingText(fruit.x, fruit.y - fruit.radius, `+${points}`, {
        color: '#5ef0c8',
        size: 20 + Math.min(this.combo, 5) * 2,
      })
    );

    if (this.combo >= 2) {
      this.floatingTexts.push(
        new FloatingText(fruit.x, fruit.y - fruit.radius - 30, `x${this.combo} COMBO!`, {
          color: '#ffd23f',
          size: 22,
          vy: -100,
          life: 0.9,
        })
      );
      AudioFX.combo?.(this.combo);
    } else {
      AudioFX.pop?.(360 + Math.random() * 160);
    }
    AudioFX.slice?.(force);

    this.callbacks.onScoreChange?.(this.score);
    this.callbacks.onComboChange?.(this.combo);
  }

  _onBombHit(fruit) {
    this.combo = 0;
    this.callbacks.onComboChange?.(this.combo);
    this.lives = 0;
    this.callbacks.onLivesChange?.(this.lives);

    // A real detonation: fireball + shockwave + smoke + shrapnel, plus a
    // punchy screen shake and a hot flash across the whole screen.
    this.explosions.push(
      new Explosion(fruit.x, fruit.y, { maxRadius: Math.max(this.width, this.height) * 0.55 })
    );
    this.particles.push(...Particle.burst(fruit.x, fruit.y, '#ffcf5c', 24));
    this._addShake(0.55, 26);
    this.flashAlpha = 1;
    AudioFX.explosion?.();
    AudioFX.blast?.();
    AudioFX.stopBombLoop?.();
    this._activeBombCount = 0;

    // The swipe just ended abruptly (gameplay freezes next frame), so
    // resolve any pending cut/multi-cut sound now instead of losing it.
    if (this._swipeSliceCount === 1) {
      AudioFX.cut?.();
    } else if (this._swipeSliceCount > 1) {
      AudioFX.multiCut?.();
    }
    this._swipeSliceCount = 0;
    this._swipeSilenceTimer = 0;

    // The shockwave clears whatever else was mid-air.
    for (const f of this.fruits) {
      if (f !== fruit) f.markedForRemoval = true;
    }

    // Let the explosion actually play out before showing Game Over.
    this.gameState = 'exploding';
    this._explodeTimer = 1.1;
  }

  _addShake(duration, magnitude) {
    this.shake.time = duration;
    this.shake.duration = duration;
    this.shake.magnitude = magnitude;
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
    this.gameState = 'over';
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

    ctx.save();
    if (this.shake.time > 0 && this.shake.duration > 0) {
      const p = this.shake.time / this.shake.duration;
      const mag = this.shake.magnitude * p;
      ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    }

    for (const fx of this.screenEffects) fx.draw(ctx);
    for (const fruit of this.fruits) fruit.draw(ctx);
    for (const half of this.fruitHalves) half.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const fx of this.explosions) fx.draw(ctx);
    for (const t of this.floatingTexts) t.draw(ctx);

    ctx.restore();

    // Hot flash overlay for the bomb blast, drawn outside the shake
    // transform so it always fully covers the screen.
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      const r = Math.max(this.width, this.height) * 0.75;
      const grad = ctx.createRadialGradient(
        this.width / 2,
        this.height / 2,
        0,
        this.width / 2,
        this.height / 2,
        r
      );
      grad.addColorStop(0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(0.35, 'rgba(255,140,60,0.5)');
      grad.addColorStop(1, 'rgba(120,10,10,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    this.blade.draw(overlayCtx);
  }
}
