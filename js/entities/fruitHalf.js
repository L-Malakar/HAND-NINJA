/**
 * FruitHalf
 * One independent half of a fruit after it has been sliced. Unlike the
 * old approach (two clipped rectangles drawn from inside a single Fruit
 * object), each FruitHalf is its own physics body: its own position,
 * velocity, gravity, and rotation/spin. This makes the two halves
 * genuinely separate after the cut instead of moving/rotating together.
 */
class FruitHalf {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement|HTMLImageElement} opts.sprite - pre-clipped half image
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {number} opts.radius - original fruit radius (half image is radius*2 square)
   * @param {number} opts.vx
   * @param {number} opts.vy
   * @param {number} opts.gravity
   * @param {number} opts.rotation - starting rotation (matches fruit rotation at slice time)
   * @param {number} opts.angularVelocity
   */
  constructor({ sprite, x, y, radius, vx, vy, gravity, rotation, angularVelocity }) {
    this.sprite = sprite;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.rotation = rotation;
    this.angularVelocity = angularVelocity;

    // Slight fade + shrink near end of life so pieces don't just vanish abruptly.
    this.age = 0;
    this.life = 1.6; // seconds before this half is cleaned up (even if still on-screen)

    this.alive = true;
    this.markedForRemoval = false;
  }

  update(dt, canvasHeight) {
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;

    this.age += dt;
    if (this.age >= this.life || this.y - this.radius > canvasHeight + 200) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    const size = this.radius * 2;
    const fadeStart = this.life * 0.7;
    let alpha = 1;
    if (this.age > fadeStart) {
      alpha = Math.max(0, 1 - (this.age - fadeStart) / (this.life - fadeStart));
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.drawImage(this.sprite, -this.radius, -this.radius, size, size);
    ctx.restore();
  }

  /**
   * Build the two independent halves for a freshly-sliced fruit.
   * @param {Fruit} fruit - the fruit at the moment it was sliced
   * @param {number} sliceAngle - world-space angle of the slicing blade
   * @returns {[FruitHalf, FruitHalf]}
   */
  static createPairFromFruit(fruit, sliceAngle) {
    const sprite = AssetLoader.getSprite(fruit.type);
    const radius = fruit.radius;

    // Direction of the cut expressed in the fruit's own (unrotated) sprite
    // space, so the clip stays correct no matter how each half spins later.
    const localSliceAngle = sliceAngle - fruit.rotation;
    const perpAngle = localSliceAngle + Math.PI / 2;

    const spriteA = FruitHalf._buildHalfSprite(sprite, radius, perpAngle, -1);
    const spriteB = FruitHalf._buildHalfSprite(sprite, radius, perpAngle, 1);

    // Push the two halves apart along the slice's perpendicular direction,
    // plus a bit of the fruit's own momentum, so they visibly separate.
    const pushSpeed = MathUtils.randomRange(70, 130);
    const pushDirX = Math.cos(perpAngle);
    const pushDirY = Math.sin(perpAngle);

    const commonVx = fruit.vx * 0.5;
    const commonVy = fruit.vy * 0.5 - MathUtils.randomRange(40, 90); // little upward "pop"

    const halfA = new FruitHalf({
      sprite: spriteA,
      x: fruit.x,
      y: fruit.y,
      radius,
      vx: commonVx - pushDirX * pushSpeed,
      vy: commonVy - pushDirY * pushSpeed,
      gravity: fruit.gravity,
      rotation: fruit.rotation,
      angularVelocity: fruit.angularVelocity - MathUtils.randomRange(1, 3),
    });

    const halfB = new FruitHalf({
      sprite: spriteB,
      x: fruit.x,
      y: fruit.y,
      radius,
      vx: commonVx + pushDirX * pushSpeed,
      vy: commonVy + pushDirY * pushSpeed,
      gravity: fruit.gravity,
      rotation: fruit.rotation,
      angularVelocity: fruit.angularVelocity + MathUtils.randomRange(1, 3),
    });

    return [halfA, halfB];
  }

  /**
   * Pre-render one half of a sprite (clipped along perpAngle) onto an
   * offscreen canvas, once, at slice time. `side` is -1 or 1 to pick
   * which side of the cut line to keep.
   */
  static _buildHalfSprite(sprite, radius, perpAngle, side) {
    const size = radius * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.translate(radius, radius);
    ctx.save();
    ctx.rotate(perpAngle);

    ctx.beginPath();
    if (side < 0) {
      ctx.rect(-radius * 1.5, -radius * 1.5, radius * 1.5, radius * 3);
    } else {
      ctx.rect(0, -radius * 1.5, radius * 1.5, radius * 3);
    }
    ctx.clip();

    ctx.rotate(-perpAngle);
    ctx.drawImage(sprite, -radius, -radius, size, size);
    ctx.restore();

    return canvas;
  }
}
