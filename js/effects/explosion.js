/**
 * Explosion
 * A layered, physics-driven detonation effect used when the blade hits a
 * bomb: a bright fireball flash with radiating light rays, two expanding
 * shockwave rings, a low dust ring that spreads along the "ground", rising
 * turbulent smoke, motion-blurred flying embers, and shattered bomb
 * shrapnel that tumbles outward under gravity. Everything here is
 * simulated (position/velocity/gravity), not just a sprite crossfade, so
 * the blast actually reads as a physical impact.
 */
class Explosion {
  /**
   * @param {number} x - world x of the bomb
   * @param {number} y - world y of the bomb
   * @param {Object} [opts]
   * @param {number} [opts.maxRadius=260] - how far the shockwave rings expand
   */
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.life = 1.5;
    this.markedForRemoval = false;

    this.maxRingRadius = opts.maxRadius || 260;
    this.flashLife = 0.22;
    this.rayLife = 0.3;
    this.rayCount = 10 + Math.floor(Math.random() * 4);
    this.rayRotation = Math.random() * Math.PI * 2;

    this.rings = [
      { delay: 0, duration: 0.55, width: 16, color: '255,185,70' },
      { delay: 0.09, duration: 0.72, width: 9, color: '255,90,40' },
    ];

    this.dust = Explosion._buildDustRing(this.maxRingRadius);
    this.smoke = Explosion._buildSmoke(x, y);
    this.embers = Explosion._buildEmbers(x, y);
    this.shards = Explosion._buildShards(x, y);
  }

  update(dt) {
    this.age += dt;

    for (const p of this.smoke) Explosion._stepSmoke(p, dt);
    for (const p of this.embers) Explosion._stepEmber(p, dt);
    for (const s of this.shards) Explosion._stepShard(s, dt);

    if (this.age >= this.life) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    // Bright fireball flash at the moment of detonation.
    if (this.age < this.flashLife) {
      const t = this.age / this.flashLife;
      const alpha = 1 - t;
      const r = this.maxRingRadius * 0.5 * (0.4 + t * 0.6);

      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, Math.max(1, r));
      grad.addColorStop(0, `rgba(255,255,235,${0.9 * alpha})`);
      grad.addColorStop(0.4, `rgba(255,190,80,${0.75 * alpha})`);
      grad.addColorStop(1, 'rgba(255,120,40,0)');

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Radiating light-ray flare, brightest right at detonation, quickly
    // sweeping past so it reads as a flash of directional light rather
    // than a static sunburst decal.
    if (this.age < this.rayLife) {
      Explosion._drawRays(ctx, this);
    }

    // Ground dust ring: a low, flattened ring of dust kicked outward along
    // the "floor", giving the blast a sense of hitting a surface.
    Explosion._drawDustRing(ctx, this);

    // Expanding shockwave rings.
    for (const ring of this.rings) {
      const t = (this.age - ring.delay) / ring.duration;
      if (t < 0 || t > 1) continue;
      const eased = 1 - Math.pow(1 - t, 3);
      const radius = this.maxRingRadius * eased;
      const alpha = (1 - t) * 0.85;

      ctx.save();
      ctx.strokeStyle = `rgba(${ring.color},${alpha})`;
      ctx.lineWidth = ring.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(1, radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.smoke) Explosion._drawSmoke(ctx, p);
    for (const s of this.shards) Explosion._drawShard(ctx, s);
    for (const p of this.embers) Explosion._drawEmber(ctx, p);
  }

  // ---- construction ---------------------------------------------------

  static _buildDustRing(maxRadius) {
    const count = 16;
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        angle: (i / count) * Math.PI * 2 + Math.random() * 0.2,
        speed: MathUtils.randomRange(0.6, 1) * maxRadius,
        size: MathUtils.randomRange(14, 30),
        delay: Math.random() * 0.06,
      });
    }
    return arr;
  }

  static _buildSmoke(x, y) {
    const count = 10 + Math.floor(Math.random() * 6);
    const arr = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = MathUtils.randomRange(30, 110);
      arr.push({
        x: x + Math.cos(angle) * 6,
        y: y + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed * 0.4,
        vy: Math.sin(angle) * speed * 0.4 - MathUtils.randomRange(30, 80),
        life: MathUtils.randomRange(0.9, 1.4),
        age: 0,
        size: MathUtils.randomRange(20, 46),
        growth: MathUtils.randomRange(30, 60),
        spin: MathUtils.randomRange(-0.6, 0.6),
        rotation: Math.random() * Math.PI * 2,
        wobblePhase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.5 ? '40,40,42' : '75,68,60',
      });
    }
    return arr;
  }

  static _buildEmbers(x, y) {
    const count = 20 + Math.floor(Math.random() * 12);
    const arr = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = MathUtils.randomRange(140, 420);
      arr.push({
        x,
        y,
        prevX: x,
        prevY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: MathUtils.randomRange(500, 750),
        life: MathUtils.randomRange(0.45, 0.9),
        age: 0,
        size: MathUtils.randomRange(2, 5),
        color: Math.random() < 0.5 ? '255,210,90' : '255,120,50',
      });
    }
    return arr;
  }

  static _buildShards(x, y) {
    const count = 6 + Math.floor(Math.random() * 4);
    const arr = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = MathUtils.randomRange(180, 420);
      arr.push({
        x,
        y,
        prevX: x,
        prevY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - MathUtils.randomRange(60, 160),
        gravity: MathUtils.randomRange(700, 1000),
        rotation: Math.random() * Math.PI * 2,
        angularVelocity: MathUtils.randomRange(-14, 14),
        size: MathUtils.randomRange(8, 18),
        age: 0,
        life: MathUtils.randomRange(0.8, 1.3),
      });
    }
    return arr;
  }

  // ---- physics ----------------------------------------------------------

  static _stepSmoke(p, dt) {
    p.age += dt;
    p.vy -= 12 * dt; // gentle buoyant rise
    const drag = Math.max(0, 1 - 1.4 * dt);
    p.vx *= drag;
    p.vy *= Math.max(0, 1 - 0.5 * dt);
    // A little turbulent wobble so the smoke doesn't drift in a dead-straight line.
    p.x += p.vx * dt + Math.sin(p.age * 3 + p.wobblePhase) * 6 * dt;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
  }

  static _stepEmber(p, dt) {
    p.prevX = p.x;
    p.prevY = p.y;
    p.age += dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  static _stepShard(s, dt) {
    s.prevX = s.x;
    s.prevY = s.y;
    s.age += dt;
    s.vy += s.gravity * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rotation += s.angularVelocity * dt;
  }

  // ---- drawing ------------------------------------------------------------

  static _drawRays(ctx, exp) {
    const t = exp.age / exp.rayLife;
    const alpha = (1 - t) * 0.55;
    if (alpha <= 0) return;
    const len = exp.maxRingRadius * (0.5 + t * 0.9);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(exp.x, exp.y);
    ctx.rotate(exp.rayRotation + t * 0.4);
    for (let i = 0; i < exp.rayCount; i++) {
      const a = (i / exp.rayCount) * Math.PI * 2;
      const width = 0.05 + (i % 2 === 0 ? 0.02 : 0);
      ctx.save();
      ctx.rotate(a);
      const grad = ctx.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, `rgba(255,235,180,${alpha})`);
      grad.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, -len * width);
      ctx.lineTo(len, len * width);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  static _drawDustRing(ctx, exp) {
    ctx.save();
    for (const d of exp.dust) {
      const t = Math.max(0, (exp.age - d.delay) / 0.9);
      if (t <= 0 || t >= 1) continue;
      const eased = 1 - Math.pow(1 - t, 2);
      const dist = d.speed * 0.5 * eased;
      const px = exp.x + Math.cos(d.angle) * dist;
      const py = exp.y + Math.sin(d.angle) * dist * 0.4; // flattened, hugs the "ground"
      const alpha = (1 - t) * 0.35;
      const r = d.size * (0.6 + eased * 0.8);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(120,105,90,1)';
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  static _drawSmoke(ctx, p) {
    const t = p.age / p.life;
    if (t >= 1) return;
    const alpha = (1 - t) * 0.5;
    const r = p.size + p.growth * t;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = `rgba(${p.color},1)`;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static _drawEmber(ctx, p) {
    const t = p.age / p.life;
    if (t >= 1) return;
    const alpha = 1 - t;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgba(${p.color},1)`;
    ctx.lineWidth = Math.max(0.5, p.size * (1 - t * 0.4));
    ctx.lineCap = 'round';
    // Draw as a short streak from its previous position rather than a dot,
    // so fast embers read as motion-blurred sparks instead of static circles.
    ctx.beginPath();
    ctx.moveTo(p.prevX, p.prevY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.fillStyle = `rgba(${p.color},1)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * 0.5 * (1 - t * 0.4)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static _drawShard(ctx, s) {
    const t = s.age / s.life;
    if (t >= 1) return;
    const alpha = Math.max(0, 1 - t / 0.85);

    // Faint motion-blur trail behind the tumbling shard.
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = 'rgba(40,40,44,1)';
    ctx.lineWidth = Math.max(1, s.size * 0.3);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.prevX, s.prevY);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotation);
    ctx.fillStyle = '#2b2b2e';
    ctx.beginPath();
    ctx.moveTo(-s.size, -s.size * 0.4);
    ctx.lineTo(s.size, -s.size * 0.2);
    ctx.lineTo(s.size * 0.3, s.size);
    ctx.lineTo(-s.size * 0.6, s.size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,60,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}