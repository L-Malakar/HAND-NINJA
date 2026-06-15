/**
 * AssetLoader
 * Loads visual assets used by fruit entities. To keep this project
 * dependency-free and "production ready" without binary asset files,
 * fruit art is generated procedurally as canvas-drawn sprites
 * (so there is nothing to fetch, host, or break on deploy).
 *
 * Each sprite is rendered once into an off-screen canvas and reused.
 */
const AssetLoader = (() => {
  const sprites = {};

  /**
   * Draw a simple radial-gradient "fruit" sprite with a highlight
   * and optional leaf, returning an offscreen canvas.
   */
  function makeFruitSprite({ size, baseColor, edgeColor, highlight, leaf }) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = size / 2;

    // Body
    const grad = ctx.createRadialGradient(r * 0.65, r * 0.55, r * 0.1, r, r, r);
    grad.addColorStop(0, highlight);
    grad.addColorStop(0.5, baseColor);
    grad.addColorStop(1, edgeColor);

    ctx.beginPath();
    ctx.arc(r, r, r * 0.92, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Leaf
    if (leaf) {
      ctx.save();
      ctx.translate(r * 1.15, r * 0.18);
      ctx.rotate(MathUtils.degToRad(30));
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.16, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    return canvas;
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

  const FRUIT_DEFS = {
    watermelon: { baseColor: '#3aa655', edgeColor: '#1f5e34', highlight: '#7be39a', leaf: '#2e7d32' },
    apple: { baseColor: '#e0432f', edgeColor: '#8e1f15', highlight: '#ff9a8a', leaf: '#3f8d3f' },
    orange: { baseColor: '#ff9c2f', edgeColor: '#b95e00', highlight: '#ffd28a', leaf: '#3f8d3f' },
    kiwi: { baseColor: '#9bc53d', edgeColor: '#5c7a1e', highlight: '#d4f08c', leaf: '#557a2e' },
    plum: { baseColor: '#7d3c98', edgeColor: '#41204f', highlight: '#c79be0', leaf: '#3f8d3f' },
    lemon: { baseColor: '#f7e94e', edgeColor: '#bfa800', highlight: '#fffcb0', leaf: '#3f8d3f' },
  };

  const SIZE = 160; // base sprite resolution

  function init() {
    for (const [key, def] of Object.entries(FRUIT_DEFS)) {
      sprites[key] = makeFruitSprite({ size: SIZE, ...def });
    }
    sprites.bomb = makeBombSprite(SIZE);
  }

  function getSprite(name) {
    return sprites[name];
  }

  function getFruitNames() {
    return Object.keys(FRUIT_DEFS);
  }

  init();

  return {
    getSprite,
    getFruitNames,
    SIZE,
  };
})();