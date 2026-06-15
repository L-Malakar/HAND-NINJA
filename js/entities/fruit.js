/**
 * Fruit
 * A single fruit (or bomb) entity with simple projectile physics,
 * rotation, and slice-state rendering (whole vs. two halves).
 */
class Fruit {
  /**
   * @param {Object} opts
   * @param {number} opts.x - initial x position (px)
   * @param {number} opts.y - initial y position (px)
   * @param {number} opts.vx - initial x velocity (px/s)
   * @param {number} opts.vy - initial y velocity (px/s)
   * @param {number} opts.gravity - gravity acceleration (px/s^2)
   * @param {number} opts.radius - collision radius (px)
   * @param {string} opts.type - sprite key, e.g. 'apple', 'bomb'
   * @param {boolean} [opts.isBomb=false]
   */
  constructor({ x, y, vx, vy, gravity, radius, type, isBomb = false }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.radius = radius;
    this.type = type;
    this.isBomb = isBomb;

    this.rotation = MathUtils.randomRange(0, Math.PI * 2);
    this.angularVelocity = MathUtils.randomRange(-2.5, 2.5);

    this.sliced = false;
    this.sliceAngle = 0;
    this.sliceVx1 = 0;
    this.sliceVx2 = 0;

    this.alive = true; // false once off-screen/cleanup
    this.markedForRemoval = false;
  }

  /**
   * Advance physics by dt seconds.
   */
  update(dt, canvasHeight) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;

    if (this.sliced) {
      // Halves drift apart slightly
      this.sliceVx1 *= 0.99;
      this.sliceVx2 *= 0.99;
    }

    // Cleanup when well below screen
    if (this.y - this.radius > canvasHeight + 200) {
      this.markedForRemoval = true;
    }
  }

  /**
   * Mark this fruit as sliced, recording the slice direction for
   * the half-rendering animation.
   * @param {number} angle - angle of the slicing blade (radians)
   */
  slice(angle) {
    if (this.sliced) return;
    this.sliced = true;
    this.sliceAngle = angle;
    this.sliceVx1 = -Math.abs(this.vx) - MathUtils.randomRange(40, 90);
    this.sliceVx2 = Math.abs(this.vx) + MathUtils.randomRange(40, 90);
  }

  /**
   * Render this fruit/bomb to the canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const sprite = AssetLoader.getSprite(this.type);
    if (!sprite) return;
    const size = this.radius * 2;

    if (!this.sliced) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.drawImage(sprite, -this.radius, -this.radius, size, size);
      ctx.restore();
      return;
    }

    // Draw two halves separating along the slice angle
    const perpAngle = this.sliceAngle + Math.PI / 2;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Clip half 1
    ctx.save();
    ctx.rotate(perpAngle);
    ctx.translate(this.sliceVx1 * 0.01, 0);
    ctx.beginPath();
    ctx.rect(-this.radius * 1.5, -this.radius * 1.5, this.radius * 1.5, this.radius * 3);
    ctx.clip();
    ctx.rotate(-perpAngle);
    ctx.drawImage(sprite, -this.radius, -this.radius, size, size);
    ctx.restore();

    // Clip half 2
    ctx.save();
    ctx.rotate(perpAngle);
    ctx.translate(this.sliceVx2 * 0.01, 0);
    ctx.beginPath();
    ctx.rect(0, -this.radius * 1.5, this.radius * 1.5, this.radius * 3);
    ctx.clip();
    ctx.rotate(-perpAngle);
    ctx.drawImage(sprite, -this.radius, -this.radius, size, size);
    ctx.restore();

    ctx.restore();
  }
}