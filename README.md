# [<img src="https://avatars.githubusercontent.com/u/261390550?v=4&size=64" width="40" valign="top" />](https://www.youtube.com/@gdmalakar) Hand Ninja 🍉

A browser-based Fruit Ninja clone controlled entirely by your **right hand's
index finger**, tracked in real time using **Google's MediaPipe Hands**.

### <a href="https://l-malakar.github.io/HAND-NINJA/"><img src="https://l-malakar.github.io/HAND-NINJA/asset/logo.svg" width="120" height="120" valign="middle"></a> [▶ Play Now](https://l-malakar.github.io/HAND-NINJA/)
No installs, no backend — pure HTML/CSS/JS, deployable as a static site.

[![Hand Ninja](https://l-malakar.github.io/HAND-NINJA/asset/banner.svg)](https://l-malakar.github.io/HAND-NINJA/)

## How it works

- **Camera feed** is captured via `getUserMedia` and displayed (mirrored) as
  the background.
- **MediaPipe Hands** (loaded from CDN) detects hand landmarks per frame.
  The index fingertip (landmark `8`) of the user's right hand is extracted.
- The fingertip position drives a **Blade** that leaves a glowing trail.
  Fast movements across a fruit's hitbox slice it.
- **Fruit** spawn from the bottom of the screen on arcing trajectories under
  simulated gravity. Sliced fruit splits into two independent **FruitHalf**
  physics bodies, each with its own velocity, gravity, and spin, plus a
  juice-particle burst. Bombs trigger a layered explosion (fireball,
  shockwave rings, smoke, embers, shrapnel) and end the run on contact.
- Missed fruit (falls off-screen unsliced) costs a life. Three missed fruit
  or one bomb ends the game.
- **Score popups & combos** are shown via floating text (e.g. `+30`,
  `x4 COMBO!`) that rises and fades out.
- **Sound effects** are synthesized entirely with the Web Audio API — no
  audio files — with a distinct acoustic signature per fruit type (a heavy
  thud for watermelon, a crisp crack for apple, a zesty spray for citrus,
  etc.), plus a shared reverb send and limiter.

## Project structure

```
HAND-NINJA/
├── index.html               # App shell, screens, HUD
├── css/
│   └── styles.css           # All styling
└── js/
    ├── main.js               # Bootstraps app, wires tracker <-> game, UI state
    ├── core/
    │   ├── handTracker.js    # MediaPipe Hands wrapper (right-hand index tip)
    │   ├── blade.js          # Blade trail: history, drawing, collision segment
    │   ├── spawner.js        # Fruit/bomb spawn timing & launch physics
    │   └── game.js            # Main loop, scoring, collisions, rendering
    ├── effects/
    │   ├── audioFx.js        # Web Audio synthesized sound engine (no audio assets)
    │   ├── explosion.js      # Bomb detonation effect (fireball, shockwaves, shrapnel)
    │   ├── floatingText.js   # Rising/fading score & combo popups
    │   └── screenEffect.js   # Juice-splash physics at the cut point
    ├── entities/
    │   ├── fruit.js          # Fruit/bomb entity: physics + slice rendering
    │   ├── fruitHalf.js      # Independent physics body for each sliced-fruit half
    │   └── particle.js       # Juice-splash particle effects
    └── utils/
        ├── math.js            # Shared math/geometry helpers
        └── assetLoader.js     # Procedurally generates fruit/bomb sprites
```

This is a fully static site — deploy the `HAND-NINJA/` folder as-is to
any static host (Netlify, Vercel, GitHub Pages, S3 + CloudFront, etc.).
**HTTPS is required** in production for camera access (except on `localhost`).

## Browser support & notes

- Requires a browser with `getUserMedia` and WebGL support (MediaPipe Hands
  uses WebGL internally). Recent Chrome, Edge, and Safari versions work well.
- Works on mobile, but performance depends on device GPU. For best results,
  use good lighting and keep your hand within the frame.
- The "Left"/"Right" hand label from MediaPipe is based on the unmirrored
  camera image; since the video and canvases are mirrored via CSS for a
  natural mirror-like experience, the code maps MediaPipe's `"Left"` label to
  the user's actual right hand (see `handTracker.js` for details).

## Customization

- **Difficulty**: adjust spawn intervals and gravity in `spawner.js`.
- **Lives / combo window**: tune constants at the top of `game.js`.
- **Fruit types & colors**: edit `FRUIT_DEFS` in `assetLoader.js`.
- **Blade feel**: adjust `maxPoints`, `fadeMs`, and smoothing factor
  (`SMOOTHING` in `game.js`).
- **Sound**: tune or extend per-fruit acoustic profiles in `audioFx.js`.
- **Bomb explosion look**: tune fireball/shockwave/shrapnel params in
  `explosion.js`.

---
<b>Dev:</b> 
-
<table>
  <tr>
    <td>
      <a href="https://www.youtube.com/@gdmalakar">
        <img src="https://yt3.googleusercontent.com/Khmav_bBMzqoVJE8ubBONlKjNkwFLI07w7RfosBBB4jD9R6eQjJoZO-nnRAwfPbnNFRc_Zjx=s160-c-k-c0x00ffffff-no-rj" width="24" height="24" style="border-radius:50%; display:block;" />
      </a>
    </td>
    <td>
      <a href="https://www.youtube.com/@gdmalakar">L. Malakar</a>.
    </td>
  </tr>
</table>
