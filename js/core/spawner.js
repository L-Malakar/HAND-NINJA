/**
 * Spawner
 * Decides when and where to spawn fruit/bombs, and applies
 * launch physics so they arc upward into view under gravity.
 */
class Spawner {
  /**
   * @param {{width: number, height: number}} dimensions - logical canvas size in px
   */
  constructor(dimensions) {
    this.canvas = dimensions;
    this.elapsed = 0;
    this.nextSpawnAt = 0;
    this.GRAVITY = 1500; // px/s^2

    this._scheduleNext();
  }

  _scheduleNext() {
    // Spawns get gradually faster as time goes on (difficulty ramp),
    // bottoming out at a minimum interval.
    const baseMin = 1200; // ms
    const baseMax = 2000; // ms
    const difficultyFactor = Math.max(0.45, 1 - this.elapsed / 90000);
    const min = baseMin * difficultyFactor;
    const max = baseMax * difficultyFactor;
    this.nextSpawnAt = this.elapsed + MathUtils.randomRange(min, max);
  }

  /**
   * @param {number} dtMs - delta time in milliseconds
   * @returns {Fruit[]} newly spawned fruits (0 or more)
   */
  update(dtMs) {
    this.elapsed += dtMs;
    const spawned = [];

    if (this.elapsed >= this.nextSpawnAt) {
      // Occasionally spawn a small group ("combo toss")
      const groupRoll = Math.random();
      const count = groupRoll > 0.85 ? MathUtils.randomInt(2, 3) : 1;

      for (let i = 0; i < count; i++) {
        spawned.push(this._createFruit(i, count));
      }
      this._scheduleNext();
    }

    return spawned;
  }

  _createFruit(indexInGroup = 0, groupSize = 1) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Spawn from the bottom edge, within central-ish horizontal band
    const margin = w * 0.1;
    const segmentWidth = (w - margin * 2) / groupSize;
    const x = margin + segmentWidth * indexInGroup + MathUtils.randomRange(0.2, 0.8) * segmentWidth;
    const y = h + 80;

    // Aim toward upper-middle of screen with some horizontal randomness
    const targetX = MathUtils.randomRange(w * 0.2, w * 0.8);
    const targetY = h * MathUtils.randomRange(0.15, 0.35);

    // Time to reach apex roughly tuned for a satisfying arc
    const apexTime = MathUtils.randomRange(0.9, 1.3); // seconds

    const vx = (targetX - x) / (apexTime * 1.6);
    // vy such that it reaches near targetY at apexTime under gravity
    const vy = -(this.GRAVITY * apexTime);

    const radius = MathUtils.randomRange(50, 75);

    // ~12% chance of a bomb
    const isBomb = Math.random() < 0.12;
    const type = isBomb
      ? 'bomb'
      : MathUtils.randomChoice(AssetLoader.getFruitNames());

    return new Fruit({
      x,
      y,
      vx,
      vy,
      gravity: this.GRAVITY,
      radius,
      type,
      isBomb,
    });
  }

  reset() {
    this.elapsed = 0;
    this._scheduleNext();
  }
}