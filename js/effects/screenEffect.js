/**
 * ScreenEffect
 * A juice splash that happens at the spot a fruit was cut. Every blob and
 * speckle in the splash is an independent physics body: it's flung outward
 * by the cut, arcs under gravity with air drag, and then "lands" — at which
 * point it squashes flat along its direction of travel (like a real splat)
 * and sticks to the screen before slowly fading out. A handful of speckles
 * keep dripping downward after they land for a wet, lingering feel.
 *
 * Blobs are drawn as slightly irregular (non-circular) shapes with a small
 * glossy highlight, and the whole effect opens with a quick directional
 * slash streak at the cut itself, so the very first frame already reads as
 * a "wet impact" before any blob has even landed.
 */
class ScreenEffect {
  /**
   * @param {number} x - world x of the cut
   * @param {number} y - world y of the cut
   * @param {string} color - CSS color string for the juice/liquid
   * @param {number} [radius=60] - roughly how big the splash should read
   * @param {Object} [opts]
   * @param {number} [opts.dirX] - x component of a bias direction (e.g. blade travel)
   * @param {number} [opts.dirY] - y component of a bias direction
   * @param {number} [opts.force=1] - multiplier on how hard the juice is flung (e.g. blade speed)
   */
  constructor(x, y, color, radius = 60, opts = {}) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;

    this.age = 0;
    this.life = 2.1; // total seconds this effect stays visible
    this.fadeStart = this.life * 0.5; // stains hold, then ease out

    this.alive = true;
    this.markedForRemoval = false;

    const biasAngle =
      opts.dirX !== undefined && opts.dirY !== undefined && (opts.dirX || opts.dirY)
        ? Math.atan2(opts.dirY, opts.dirX)
        : null;
    const force = opts.force || 1;

    // Big soft blobs that get flung out and splat flat on landing.
    this.blobs = ScreenEffect._buildBlobs(radius, biasAngle, force);
    // Fine droplets that fly further and some keep dripping after landing.
    this.speckles = ScreenEffect._buildSpeckles(radius, biasAngle, force);
    // Instant streak right along the blade's travel direction, so there's
    // immediate visual feedback at the cut even before anything lands.
    this.slash = biasAngle !== null ? ScreenEffect._buildSlash(radius, biasAngle, force) : null;
  }

  update(dt) {
    this.age += dt;
    for (const b of this.blobs) ScreenEffect._stepDrop(b, dt);
    for (const s of this.speckles) ScreenEffect._stepDrop(s, dt);

    if (this.age >= this.life) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    let fade = 1;
    if (this.age > this.fadeStart) {
      fade = Math.max(0, 1 - (this.age - this.fadeStart) / (this.life - this.fadeStart));
    }
    if (fade <= 0) return;

    if (this.slash) ScreenEffect._drawSlash(ctx, this.x, this.y, this.slash, this.age, this.color);

    ctx.save();
    ctx.fillStyle = this.color;

    for (const b of this.blobs) ScreenEffect._drawDrop(ctx, this.x, this.y, b, fade, this.color);
    for (const s of this.speckles) ScreenEffect._drawDrop(ctx, this.x, this.y, s, fade, this.color);

    ctx.restore();
  }

  // ---- construction -------------------------------------------------

  /** Build a jagged (non-circular) blob outline, cached per-drop and reused every frame. */
  static _buildBlobShape(pointCount = 9) {
    const points = [];
    for (let i = 0; i < pointCount; i++) {
      points.push(0.72 + Math.random() * 0.5); // radius multiplier per angle step
    }
    return points;
  }

  static _buildBlobs(radius, biasAngle, force) {
    const count = 6 + Math.floor(Math.random() * 4);
    const drops = [];

    for (let i = 0; i < count; i++) {
      const angle =
        biasAngle !== null
          ? biasAngle + MathUtils.randomRange(-1.15, 1.15)
          : Math.random() * Math.PI * 2;
      const speed = radius * MathUtils.randomRange(1.6, 3.2) * force;

      drops.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - MathUtils.randomRange(20, 90),
        gravity: MathUtils.randomRange(520, 860),
        drag: MathUtils.randomRange(2.8, 4.6),
        r: radius * MathUtils.randomRange(0.22, 0.42),
        scaleX: 1,
        scaleY: 1,
        rotation: Math.random() * Math.PI * 2,
        landed: false,
        flightTime: MathUtils.randomRange(0.12, 0.3),
        t: 0,
        baseAlpha: 0.55 + Math.random() * 0.3,
        drip: false,
        shape: ScreenEffect._buildBlobShape(),
        highlightAngle: Math.random() * Math.PI * 2,
      });
    }

    return drops;
  }

  static _buildSpeckles(radius, biasAngle, force) {
    const count = 14 + Math.floor(Math.random() * 12);
    const drops = [];

    for (let i = 0; i < count; i++) {
      const angle =
        biasAngle !== null
          ? biasAngle + MathUtils.randomRange(-1.5, 1.5)
          : Math.random() * Math.PI * 2;
      const speed = radius * MathUtils.randomRange(2.2, 5.2) * force;

      drops.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - MathUtils.randomRange(10, 70),
        gravity: MathUtils.randomRange(650, 1050),
        drag: MathUtils.randomRange(1.4, 3),
        r: MathUtils.randomRange(1.5, 4),
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        landed: false,
        flightTime: MathUtils.randomRange(0.18, 0.5),
        t: 0,
        baseAlpha: 0.4 + Math.random() * 0.35,
        drip: Math.random() < 0.4, // some keep sliding down after they land
        dripVy: 0,
        shape: null, // speckles are small enough that a plain circle reads fine
      });
    }

    return drops;
  }

  /** A short, fast-fading streak drawn right along the blade's swing direction. */
  static _buildSlash(radius, biasAngle, force) {
    return {
      angle: biasAngle,
      length: radius * (1.6 + Math.min(1, force) * 0.8),
      width: radius * 0.16,
      life: 0.22,
    };
  }

  // ---- physics --------------------------------------------------------

  /**
   * Advance one droplet/blob. While airborne it behaves like a real flung
   * particle (gravity pulls it down, drag bleeds off horizontal speed).
   * The instant it "lands" it snaps flat into a squashed splat oriented
   * along its incoming direction of travel, then either sticks in place
   * or (for some speckles) keeps sliding down like a drip.
   */
  static _stepDrop(d, dt) {
    if (!d.landed) {
      d.t += dt;
      d.vy += d.gravity * dt;
      const dragFactor = Math.max(0, 1 - d.drag * dt);
      d.vx *= dragFactor;
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      if (d.t >= d.flightTime) {
        d.landed = true;
        const speed = Math.hypot(d.vx, d.vy) || 1;
        d.rotation = Math.atan2(d.vy, d.vx);
        d.scaleX = 1 + Math.min(1.5, speed / 240);
        d.scaleY = Math.max(0.35, 1 - Math.min(0.55, speed / 480));
        d.vx = 0;
        d.vy = 0;
      }
    } else if (d.drip) {
      d.dripVy += 55 * dt;
      d.y += d.dripVy * dt;
    }
  }

  // ---- drawing ----------------------------------------------------------

  static _drawDrop(ctx, ox, oy, d, fade, color) {
    const alpha = d.baseAlpha * fade;
    if (alpha <= 0.015) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ox + d.x, oy + d.y);
    ctx.rotate(d.rotation);
    ctx.scale(d.scaleX, d.scaleY);
    ctx.fillStyle = color;
    ctx.beginPath();

    if (d.shape) {
      // Irregular blob outline instead of a perfect circle, so splats read
      // as organic liquid rather than uniform colored dots.
      const pts = d.shape;
      const n = pts.length;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = d.r * pts[i % n];
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Small glossy highlight so landed blobs don't look flat/matte.
      ctx.save();
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      const hx = Math.cos(d.highlightAngle) * d.r * 0.3;
      const hy = Math.sin(d.highlightAngle) * d.r * 0.3;
      ctx.ellipse(hx, hy, d.r * 0.28, d.r * 0.14, d.highlightAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.arc(0, 0, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  static _drawSlash(ctx, ox, oy, slash, age, color) {
    const t = age / slash.life;
    if (t >= 1) return;
    const alpha = (1 - t) * 0.8;
    const len = slash.length * (0.6 + t * 0.5);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(ox, oy);
    ctx.rotate(slash.angle);

    const grad = ctx.createLinearGradient(-len * 0.3, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.15, color);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-len * 0.3, 0);
    ctx.quadraticCurveTo(len * 0.3, -slash.width, len, 0);
    ctx.quadraticCurveTo(len * 0.3, slash.width, -len * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}