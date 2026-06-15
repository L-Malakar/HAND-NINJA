/**
 * Particle
 * Lightweight particle for juice-splash and explosion effects.
 */
class Particle {
  constructor({ x, y, color, size, life }) {
    this.x = x;
    this.y = y;
    this.vx = MathUtils.randomRange(-260, 260);
    this.vy = MathUtils.randomRange(-360, -40);
    this.gravity = 900;
    this.color = color;
    this.size = size;
    this.life = life; // seconds
    this.age = 0;
    this.alive = true;
  }

  update(dt) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
    if (this.age >= this.life) this.alive = false;
  }

  draw(ctx) {
    const t = this.age / this.life;
    const alpha = 1 - t;
    const r = this.size * (1 - t * 0.6);

    ctx.save();
    ctx.globalAlpha = MathUtils.clamp(alpha, 0, 1);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Create a burst of particles for a sliced fruit at (x, y).
   */
  static burst(x, y, color, count = 14) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(
        new Particle({
          x,
          y,
          color,
          size: MathUtils.randomRange(3, 8),
          life: MathUtils.randomRange(0.4, 0.9),
        })
      );
    }
    return particles;
  }
}