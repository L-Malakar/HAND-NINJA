# Hand Ninja 🍉

A browser-based Fruit Ninja clone controlled entirely by your **right hand's
index finger**, tracked in real time using **Google's MediaPipe Hands**.

No installs, no backend — pure HTML/CSS/JS, deployable as a static site.

## How it works

- **Camera feed** is captured via `getUserMedia` and displayed (mirrored) as
  the background.
- **MediaPipe Hands** (loaded from CDN) detects hand landmarks per frame.
  The index fingertip (landmark `8`) of the user's right hand is extracted.
- The fingertip position drives a **Blade** that leaves a glowing trail.
  Fast movements across a fruit's hitbox slice it.
- **Fruit** spawn from the bottom of the screen on arcing trajectories under
  simulated gravity. Sliced fruit splits into two halves with a juice-particle
  burst. Bombs end the run on contact.
- Missed fruit (falls off-screen unsliced) costs a life. Three missed fruit
  or one bomb ends the game.

## Project structure

\`\`\`
fruit-ninja-hand/
├── index.html              # App shell, screens, HUD
├── css/
│   └── styles.css          # All styling
└── js/
    ├── main.js              # Bootstraps app, wires tracker <-> game, UI state
    ├── core/
    │   ├── handTracker.js   # MediaPipe Hands wrapper (right-hand index tip)
    │   ├── blade.js          # Blade trail: history, drawing, collision segment
    │   ├── spawner.js         # Fruit/bomb spawn timing & launch physics
    │   └── game.js            # Main loop, scoring, collisions, rendering
    ├── entities/
    │   ├── fruit.js           # Fruit/bomb entity: physics + slice rendering
    │   └── particle.js         # Juice-splash particle effects
    └── utils/
        ├── math.js             # Shared math/geometry helpers
        └── assetLoader.js       # Procedurally generates fruit/bomb sprites
\`\`\`

This is a fully static site — deploy the \`fruit-ninja-hand/\` folder as-is to
any static host (Netlify, Vercel, GitHub Pages, S3 + CloudFront, etc.).
**HTTPS is required** in production for camera access (except on \`localhost\`).

## Browser support & notes

- Requires a browser with \`getUserMedia\` and WebGL support (MediaPipe Hands
  uses WebGL internally). Recent Chrome, Edge, and Safari versions work well.
- Works on mobile, but performance depends on device GPU. For best results,
  use good lighting and keep your hand within the frame.
- The "Left"/"Right" hand label from MediaPipe is based on the unmirrored
  camera image; since the video and canvases are mirrored via CSS for a
  natural mirror-like experience, the code maps MediaPipe's \`"Left"\` label to
  the user's actual right hand (see \`handTracker.js\` for details).

## Customization

- **Difficulty**: adjust spawn intervals and gravity in \`spawner.js\`.
- **Lives / combo window**: tune constants at the top of \`game.js\`.
- **Fruit types & colors**: edit \`FRUIT_DEFS\` in \`assetLoader.js\`.
- **Blade feel**: adjust \`maxPoints\`, \`fadeMs\`, and smoothing factor
  (\`SMOOTHING\` in \`game.js\`).
\`\`\`
