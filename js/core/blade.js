/**
 * Blade
 * Represents the slicing trail driven by the tracked index fingertip.
 * Keeps a short history of recent positions to render a glowing trail
 * and to perform swept-segment collision checks against fruit.
 */
class Blade {
  constructor({ maxPoints = 14, fadeMs = 180 } = {}) {
    this.points = []; // { x, y, t }
    this.maxPoints = maxPoints;
    this.fadeMs = fadeMs;
    this.active = false;
  }

  /**
   * Push a new fingertip position (in canvas pixel coordinates).
   */
  addPoint(x, y) {
    const now = performance.now();
    this.points.push({ x, y, t: now });
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    this.active = true;
  }

  /** Remove points older than fadeMs */
  update() {
    const now = performance.now();
    this.points = this.points.filter((p) => now - p.t <= this.fadeMs * 4);
    this.active = this.points.length > 1;
  }

  /**
   * Returns the most recent movement segment as [x1,y1,x2,y2],
   * or null if not enough history.
   */
  getLatestSegment() {
    const n = this.points.length;
    if (n < 2) return null;
    const a = this.points[n - 2];
    const b = this.points[n - 1];
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }

  /** Current speed of the blade tip in px/ms (used to gate slicing) */
  getSpeed() {
    const n = this.points.length;
    if (n < 2) return 0;
    const a = this.points[n - 2];
    const b = this.points[n - 1];
    const dt = Math.max(1, b.t - a.t);
    const dist = MathUtils.distance(a.x, a.y, b.x, b.y);
    return dist / dt;
  }

  /**
   * Render the blade trail to a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const now = performance.now();
    const pts = this.points;
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const age = now - p1.t;
      const alpha = MathUtils.clamp(1 - age / (this.fadeMs * 4), 0, 1);
      if (alpha <= 0) continue;

      const widthOuter = MathUtils.lerp(2, 10, i / pts.length) * alpha + 2;

      // Glow
      ctx.strokeStyle = `rgba(94, 240, 200, ${0.35 * alpha})`;
      ctx.lineWidth = widthOuter * 2.2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      // Core
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      ctx.lineWidth = widthOuter * 0.6;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // Fingertip glow marker
    const tip = pts[pts.length - 1];
    const grad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 22);
    grad.addColorStop(0, 'rgba(94, 240, 200, 0.8)');
    grad.addColorStop(1, 'rgba(94, 240, 200, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}