/**
 * ScreenEffect
 * A lingering "juice splash" effect that appears at the spot a fruit was
 * cut. Unlike Particle (small bursts that fly outward and vanish fast),
 * this renders a splatter/stain that sticks around for a bit and drips
 * down, like liquid splashed on the screen, then fades out.
 */
class ScreenEffect {
  /**
   * @param {number} x - world x of the cut
   * @param {number} y - world y of the cut
   * @param {string} color - CSS color string for the juice/liquid
   * @param {number} [radius=60] - roughly how big the splash should read
   */
  constructor(x, y, color, radius = 60) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;

    this.age = 0;
    this.life = 1.8; // total seconds this effect stays visible
    this.stainHoldTime = 0.9; // how long the main splash stays before fading

    this.alive = true;
    this.markedForRemoval = false;

    // Pre-render the static splatter shape (blobs + fine speckles) once,
    // so we're not doing random shape generation every frame.
    this._splashCanvas = ScreenEffect._buildSplash(radius, color);

    // A handful of drips that slide down and fade, giving a "wet" feel.
    this.drips = ScreenEffect._buildDrips(radius, color);
  }

  update(dt) {
    this.age += dt;

    for (const drip of this.drips) {
      drip.vy += drip.gravity * dt;
      drip.y += drip.vy * dt;
      drip.x += drip.vx * dt;
      drip.life -= dt;
    }
    this.drips = this.drips.filter((d) => d.life > 0);

    if (this.age >= this.life) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    const t = this.age;

    // Main splash stain: full opacity, then fades over the remaining time.
    let stainAlpha = 1;
    if (t > this.stainHoldTime) {
      stainAlpha = Math.max(0, 1 - (t - this.stainHoldTime) / (this.life - this.stainHoldTime));
    }

    if (stainAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = stainAlpha;
      const size = this._splashCanvas.width;
      ctx.drawImage(this._splashCanvas, this.x - size / 2, this.y - size / 2);
      ctx.restore();
    }

    // Drips: small blobs of color easing down and fading out.
    for (const drip of this.drips) {
      const dripAlpha = Math.max(0, drip.life / drip.maxLife);
      if (dripAlpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = dripAlpha * 0.9;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(this.x + drip.x, this.y + drip.y, drip.w, drip.h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Pre-render a random splatter of overlapping blobs + tiny speckles
   * onto an offscreen canvas, so it can be stamped at the cut location.
   */
  static _buildSplash(radius, color) {
    const size = radius * 3.2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;

    ctx.fillStyle = color;

    // A cluster of soft overlapping blobs near the center.
    const blobCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < blobCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.6;
      const bx = cx + Math.cos(angle) * dist;
      const by = cy + Math.sin(angle) * dist;
      const br = radius * (0.25 + Math.random() * 0.35);

      ctx.globalAlpha = 0.55 + Math.random() * 0.25;
      ctx.beginPath();
      ctx.ellipse(
        bx,
        by,
        br,
        br * (0.7 + Math.random() * 0.3),
        Math.random() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Fine speckles flung further out, like tiny juice droplets.
    const speckleCount = 14 + Math.floor(Math.random() * 10);
    for (let i = 0; i < speckleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = radius * (0.5 + Math.random() * 1.1);
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const sr = 1.5 + Math.random() * 3.5;

      ctx.globalAlpha = 0.4 + Math.random() * 0.35;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    return canvas;
  }

  /**
   * A few independent drips that ease down slowly and fade, suggesting
   * liquid running down after the splash lands.
   */
  static _buildDrips(radius, color) {
    const drips = [];
    const count = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.7;
      const maxLife = 0.8 + Math.random() * 0.7;

      drips.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 6,
        vy: 10 + Math.random() * 18,
        gravity: 40 + Math.random() * 30,
        w: 2 + Math.random() * 3,
        h: 4 + Math.random() * 6,
        life: maxLife,
        maxLife,
      });
    }

    return drips;
  }
}