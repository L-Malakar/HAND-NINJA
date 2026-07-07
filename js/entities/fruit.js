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

    // Cleanup when well below screen
    if (this.y - this.radius > canvasHeight + 200) {
      this.markedForRemoval = true;
    }
  }

  /**
   * Mark this fruit as sliced. The actual "splitting into two pieces"
   * is handled by FruitHalf.createPairFromFruit(), which spawns two
   * independent physics bodies from this fruit's current state. This
   * fruit itself is removed from the game right after slicing.
   * @param {number} angle - angle of the slicing blade (radians)
   */
  slice(angle) {
    if (this.sliced) return;
    this.sliced = true;
    this.sliceAngle = angle;
    this.markedForRemoval = true;
  }

  /**
   * Render this fruit/bomb to the canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // Sliced fruit is marked for removal immediately (see slice()); its
    // two pieces continue on as independent FruitHalf entities, so this
    // only ever needs to draw the whole, unsliced fruit.
    const sprite = AssetLoader.getSprite(this.type);
    if (!sprite) return;
    const size = this.radius * 2;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.drawImage(sprite, -this.radius, -this.radius, size, size);
    ctx.restore();
  }
}