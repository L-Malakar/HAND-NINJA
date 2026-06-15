/**
 * Math & geometry utility helpers shared across the game.
 */
const MathUtils = {
  /** Linear interpolation */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /** Clamp value between min and max */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  /** Distance between two points */
  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /** Random float between min (inclusive) and max (exclusive) */
  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  },

  /** Random integer between min and max (inclusive) */
  randomInt(min, max) {
    return Math.floor(this.randomRange(min, max + 1));
  },

  /** Pick a random element from an array */
  randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  /**
   * Determine whether a moving point (from p1 to p2) crosses
   * within `radius` of a circle centered at (cx, cy).
   * Uses point-to-segment distance check — used for blade/fruit collision.
   */
  segmentCircleIntersect(x1, y1, x2, y2, cx, cy, radius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return this.distance(x1, y1, cx, cy) <= radius;
    }

    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = this.clamp(t, 0, 1);

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return this.distance(closestX, closestY, cx, cy) <= radius;
  },

  /** Convert degrees to radians */
  degToRad(deg) {
    return (deg * Math.PI) / 180;
  },
};