/**
 * FloatingText
 * Small popup text (e.g. "+30" or "x4 COMBO!") that rises, decelerates,
 * and fades out. Used to give slices and combos extra visual payoff.
 */
class FloatingText {
  constructor(x, y, text, opts = {}) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = opts.color || '#ffffff';
    this.size = opts.size || 22;
    this.vy = opts.vy ?? -80;
    this.vx = opts.vx ?? MathUtils.randomRange(-10, 10);
    this.life = opts.life ?? 0.85;
    this.age = 0;
    this.markedForRemoval = false;
  }

  update(dt) {
    this.age += dt;
    this.vy *= 0.97;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.age >= this.life) this.markedForRemoval = true;
  }

  draw(ctx) {
    const t = this.age / this.life;
    const alpha = Math.max(0, 1 - t);
    // Quick pop-in scale, settles back down.
    const pop = t < 0.18 ? MathUtils.lerp(0.5, 1.2, t / 0.18) : MathUtils.lerp(1.2, 1, Math.min(1, (t - 0.18) / 0.3));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    // The game canvas is mirrored via CSS (transform: scaleX(-1)) to match
    // the webcam feed. That's fine for symmetric shapes, but text glyphs
    // would render backwards, so flip the X axis back just for the text.
    ctx.scale(-pop, pop);
    ctx.font = `800 ${this.size}px 'Bungee', 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}