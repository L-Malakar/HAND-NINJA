/**
 * AssetLoader
 * Loads visual assets used by fruit entities. To keep this project
 * dependency-free and "production ready" without binary asset files,
 * fruit art is generated procedurally as canvas-drawn sprites
 * (so there is nothing to fetch, host, or break on deploy).
 *
 * Each fruit is built from three separate layers so that a sliced half
 * reveals a believable cross-section instead of just a half-circle blob:
 *   1. skin   - the outer rind/peel color, only ever visible as a thin
 *               band around the curved outside of a whole or half fruit.
 *   2. pith   - an optional thin lighter/white ring just inside the skin
 *               (citrus pith, watermelon rind-to-flesh transition, etc).
 *   3. flesh  - the interior color + seed/segment texture, which is what
 *               a fresh cut face actually shows.
 *
 * `getSprite(name)` still returns a single flat image for drawing whole,
 * uncut fruit. `getFleshSprite(name)` / `getSkinRing(name)` are used by
 * FruitHalf to build a two-layer half (skin only on the outer curve,
 * flesh+seeds filling the flat cut face) so slicing looks realistic.
 */
const AssetLoader = (() => {
  const sprites = {}; // whole-fruit composited sprite (what you see before slicing)
  const fleshSprites = {}; // full-circle flesh+seed texture (used on the cut face)
  const skinRings = {}; // full-circle skin/rind ring only (used on the outer curve)

  const SIZE = 160; // base sprite resolution
  const R = SIZE / 2;

  /**
   * Per-fruit visual recipe. `seedStyle` controls what texture is drawn
   * across the flesh: 'scattered' (watermelon), 'ring' (kiwi), 'segments'
   * (citrus), 'core' (apple), or 'pit' (plum/stone fruit).
   */
  const FRUIT_DEFS = {
    watermelon: {
      skin: '#2f8f46',
      skinEdge: '#1f5e34',
      pith: '#eef7e3',
      flesh: '#e2465a',
      fleshDeep: '#c22a44',
      seed: '#1c1108',
      seedStyle: 'scattered',
      leaf: '#2e7d32',
    },
    apple: {
      skin: '#e0432f',
      skinEdge: '#8e1f15',
      pith: null,
      flesh: '#f4ecd0',
      fleshDeep: '#e8dcb0',
      seed: '#5a3a1a',
      seedStyle: 'core',
      leaf: '#3f8d3f',
    },
    orange: {
      skin: '#ff9c2f',
      skinEdge: '#b95e00',
      pith: '#fff6df',
      flesh: '#ffab3d',
      fleshDeep: '#f5822a',
      seed: '#fef0c8',
      seedStyle: 'segments',
      leaf: '#3f8d3f',
    },
    kiwi: {
      skin: '#a9823f',
      skinEdge: '#6e5323',
      pith: '#eefbc9',
      flesh: '#a8d24a',
      fleshDeep: '#7fae2e',
      seed: '#241d0d',
      seedStyle: 'ring',
      leaf: '#557a2e',
    },
    plum: {
      skin: '#7d3c98',
      skinEdge: '#41204f',
      pith: null,
      flesh: '#e8a94f',
      fleshDeep: '#c97d2e',
      seed: '#5a3418',
      seedStyle: 'pit',
      leaf: '#3f8d3f',
    },
    lemon: {
      skin: '#f7e94e',
      skinEdge: '#bfa800',
      pith: '#fbf6c8',
      flesh: '#fdf39a',
      fleshDeep: '#f2e46a',
      seed: '#fffdf0',
      seedStyle: 'segments',
      leaf: '#3f8d3f',
    },
  };

  /** Radial-gradient fill helper, always centered on the sprite. */
  function radialFill(ctx, innerColor, outerColor, innerR, outerR) {
    const grad = ctx.createRadialGradient(R * 0.65, R * 0.55, innerR, R, R, outerR);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(1, outerColor);
    return grad;
  }

  /**
   * Build the full-circle flesh + seed/segment texture for a fruit type.
   * This is what shows on a freshly cut face.
   */
  function makeFleshSprite(def) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Base flesh color
    ctx.beginPath();
    ctx.arc(R, R, R * 0.88, 0, Math.PI * 2);
    ctx.fillStyle = radialFill(ctx, def.flesh, def.fleshDeep, R * 0.1, R * 0.9);
    ctx.fill();

    // Texture per fruit
    switch (def.seedStyle) {
      case 'scattered': {
        // Watermelon: black teardrop seeds scattered through the flesh.
        const count = 18;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
          const dist = R * MathUtils.randomRange(0.2, 0.72);
          const sx = R + Math.cos(a) * dist;
          const sy = R + Math.sin(a) * dist;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(a);
          ctx.fillStyle = def.seed;
          ctx.beginPath();
          ctx.ellipse(0, 0, R * 0.045, R * 0.022, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'ring': {
        // Kiwi: pale starburst core with a ring of tiny seeds around it.
        ctx.beginPath();
        ctx.arc(R, R, R * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = def.pith;
        ctx.fill();

        // Radiating fibrous lines from the core
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = R * 0.02;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(R + Math.cos(a) * R * 0.22, R + Math.sin(a) * R * 0.22);
          ctx.lineTo(R + Math.cos(a) * R * 0.8, R + Math.sin(a) * R * 0.8);
          ctx.stroke();
        }

        const seedCount = 26;
        for (let i = 0; i < seedCount; i++) {
          const a = (i / seedCount) * Math.PI * 2;
          const dist = R * MathUtils.randomRange(0.3, 0.36);
          const sx = R + Math.cos(a) * dist;
          const sy = R + Math.sin(a) * dist;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = def.seed;
          ctx.beginPath();
          ctx.ellipse(0, 0, R * 0.035, R * 0.016, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'segments': {
        // Citrus: pie-slice segment lines fanning out from the center,
        // with a small pale core.
        const segments = 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = R * 0.025;
        for (let i = 0; i < segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(R + Math.cos(a) * R * 0.08, R + Math.sin(a) * R * 0.08);
          ctx.lineTo(R + Math.cos(a) * R * 0.86, R + Math.sin(a) * R * 0.86);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(R, R, R * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = def.pith || 'rgba(255,255,255,0.5)';
        ctx.fill();
        // A couple of pips
        for (let i = 0; i < 3; i++) {
          const a = MathUtils.randomRange(0, Math.PI * 2);
          const dist = R * MathUtils.randomRange(0.35, 0.55);
          ctx.beginPath();
          ctx.ellipse(
            R + Math.cos(a) * dist,
            R + Math.sin(a) * dist,
            R * 0.045,
            R * 0.025,
            a,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = def.seed;
          ctx.fill();
        }
        break;
      }
      case 'core': {
        // Apple: pale flesh with a small star-shaped seed pocket in the
        // middle holding a few dark seeds.
        ctx.beginPath();
        ctx.arc(R, R, R * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(210, 190, 130, 0.5)';
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
          ctx.save();
          ctx.translate(R + Math.cos(a) * R * 0.12, R + Math.sin(a) * R * 0.12);
          ctx.rotate(a);
          ctx.fillStyle = def.seed;
          ctx.beginPath();
          ctx.ellipse(0, 0, R * 0.055, R * 0.028, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'pit': {
        // Plum: a single round stone/pit near the center.
        ctx.beginPath();
        ctx.arc(R, R, R * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = def.seed;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(R * 0.94, R * 0.94, R * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        break;
      }
    }

    return canvas;
  }

  /**
   * Build the full-circle skin/rind ring for a fruit type. Only the outer
   * band is opaque; everything inside it is transparent so this layer can
   * be drawn on top of the flesh sprite without covering it, and clipped
   * to a half-plane so it only shows on the outside curve of a slice.
   */
  function makeSkinRing(def) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    const outerR = R * 0.92;
    const innerR = def.pith ? R * 0.78 : R * 0.82;

    // Skin band
    ctx.beginPath();
    ctx.arc(R, R, outerR, 0, Math.PI * 2);
    ctx.arc(R, R, innerR, 0, Math.PI * 2, true);
    ctx.closePath();
    const skinGrad = ctx.createRadialGradient(R * 0.65, R * 0.55, innerR * 0.6, R, R, outerR);
    skinGrad.addColorStop(0, def.skin);
    skinGrad.addColorStop(1, def.skinEdge);
    ctx.fillStyle = skinGrad;
    ctx.fill('evenodd');

    // Pith / pale transition ring just inside the skin, if this fruit has one
    if (def.pith) {
      const pithOuter = innerR;
      const pithInner = R * 0.7;
      ctx.beginPath();
      ctx.arc(R, R, pithOuter, 0, Math.PI * 2);
      ctx.arc(R, R, pithInner, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fillStyle = def.pith;
      ctx.fill('evenodd');
    }

    return canvas;
  }

  /**
   * Composite the whole, uncut fruit sprite (what's shown before slicing):
   * flesh in the middle is *not* visible on a whole fruit in real life, so
   * for the whole sprite we simply fill the entire disc with skin color,
   * using the same gradient as the skin ring for visual consistency, plus
   * a soft highlight and optional leaf.
   */
  function makeWholeSprite(def) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(R * 0.62, R * 0.52, R * 0.08, R, R, R * 0.92);
    grad.addColorStop(0, def.pith || lighten(def.skin));
    grad.addColorStop(0.55, def.skin);
    grad.addColorStop(1, def.skinEdge);

    ctx.beginPath();
    ctx.arc(R, R, R * 0.92, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    if (def.leaf) {
      ctx.save();
      ctx.translate(R * 1.15, R * 0.18);
      ctx.rotate(MathUtils.degToRad(30));
      ctx.fillStyle = def.leaf;
      ctx.beginPath();
      ctx.ellipse(0, 0, SIZE * 0.16, SIZE * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    return canvas;
  }

  /** Cheap "lighten a hex color" helper used for the whole-fruit highlight. */
  function lighten(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 70);
    const g = Math.min(255, ((n >> 8) & 0xff) + 70);
    const b = Math.min(255, (n & 0xff) + 70);
    return `rgb(${r},${g},${b})`;
  }

  function makeBombSprite(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = size / 2;

    const grad = ctx.createRadialGradient(r * 0.6, r * 0.5, r * 0.1, r, r, r);
    grad.addColorStop(0, '#5a5a5a');
    grad.addColorStop(0.5, '#1c1c1c');
    grad.addColorStop(1, '#000000');

    ctx.beginPath();
    ctx.arc(r, r, r * 0.92, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Fuse
    ctx.strokeStyle = '#caa45a';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.moveTo(r, size * 0.08);
    ctx.quadraticCurveTo(r * 1.3, -size * 0.02, r * 1.25, size * 0.18);
    ctx.stroke();

    // Spark
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(r * 1.25, size * 0.16, size * 0.035, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  function init() {
    for (const [key, def] of Object.entries(FRUIT_DEFS)) {
      sprites[key] = makeWholeSprite(def);
      fleshSprites[key] = makeFleshSprite(def);
      skinRings[key] = makeSkinRing(def);
    }
    sprites.bomb = makeBombSprite(SIZE);
  }

  function getSprite(name) {
    return sprites[name];
  }

  /** Full-circle flesh+seed texture, used to fill the cut face of a half. */
  function getFleshSprite(name) {
    return fleshSprites[name];
  }

  /** Full-circle skin/rind ring, drawn over the flesh on the outer curve. */
  function getSkinRing(name) {
    return skinRings[name];
  }

  function getFruitNames() {
    return Object.keys(FRUIT_DEFS);
  }

  init();

  return {
    getSprite,
    getFleshSprite,
    getSkinRing,
    getFruitNames,
    SIZE,
  };
})();