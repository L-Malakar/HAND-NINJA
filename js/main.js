/**
 * main.js
 * Bootstraps the app: sets up DOM references, wires HandTracker
 * to the Game, and manages screen transitions (start / playing / game over).
 */
(() => {
  const video = document.getElementById('webcam');
  const gameCanvas = document.getElementById('game-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');

  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('gameover-screen');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const statusText = document.getElementById('status-text');
  const handWarning = document.getElementById('hand-warning');

  const scoreValue = document.getElementById('score-value');
  const comboValue = document.getElementById('combo-value');
  const livesValue = document.getElementById('lives-value');
  const livesBlock = document.getElementById('lives-block');
  const finalScore = document.getElementById('final-score');

  let game = null;
  let tracker = null;

  function setStatus(msg, isError = false) {
    statusText.textContent = msg;
    statusText.classList.toggle('error', isError);
  }

  /** Briefly toggle the "bump" pop animation on a HUD value element. */
  function bump(el) {
    el.classList.remove('bump');
    // Force reflow so the animation can be re-triggered on rapid changes.
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function renderLives(lives) {
    const filled = Math.max(0, lives);
    livesValue.textContent = '●'.repeat(filled) + '○'.repeat(Math.max(0, 3 - filled));
    livesBlock.classList.toggle('low-lives', lives === 1);
  }

  function initGame() {
    game = new Game({
      canvas: gameCanvas,
      overlayCanvas,
      callbacks: {
        onScoreChange: (score) => {
          scoreValue.textContent = String(score);
          bump(scoreValue);
        },
        onComboChange: (combo) => {
          comboValue.textContent = `x${combo}`;
          if (combo > 0) bump(comboValue);
        },
        onLivesChange: (lives) => {
          renderLives(lives);
          bump(livesValue);
        },
        onGameOver: (score) => {
          finalScore.textContent = `Score: ${score}`;
          gameOverScreen.classList.remove('hidden');
        },
      },
    });
  }

  async function initTracker() {
    tracker = new HandTracker(video, {
      onIndexTip: (point) => {
        handWarning.classList.add('hidden');
        game?.setBladeTarget(point);
      },
      onHandLost: () => {
        handWarning.classList.remove('hidden');
      },
    });

    await tracker.start();
  }

  async function startGame() {
    startBtn.disabled = true;
    setStatus('Requesting camera access…');

    // Must happen from a user-gesture handler like this click for
    // autoplay/audio policies to allow sound to actually play.
    AudioFX.init?.();

    try {
      if (!tracker) {
        await initTracker();
      }
      setStatus('');
      startScreen.classList.add('hidden');
      gameOverScreen.classList.add('hidden');
      livesBlock.classList.remove('low-lives');
      renderLives(3);
      comboValue.textContent = 'x0';
      scoreValue.textContent = '0';
      game.start();
    } catch (err) {
      console.error(err);
      let msg = 'Unable to access camera. Please check permissions and try again.';
      if (err.name === 'NotAllowedError') {
        msg = 'Camera access was denied. Please allow camera permissions and reload.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera was found on this device.';
      }
      setStatus(msg, true);
    } finally {
      startBtn.disabled = false;
    }
  }

  function restartGame() {
    AudioFX.init?.();
    gameOverScreen.classList.add('hidden');
    livesBlock.classList.remove('low-lives');
    renderLives(3);
    comboValue.textContent = 'x0';
    scoreValue.textContent = '0';
    game.start();
  }

  initGame();

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', restartGame);

  // Pause the game loop while tab is hidden to save resources, resume on return
  let wasRunningBeforeHide = false;
  document.addEventListener('visibilitychange', () => {
    if (!game) return;
    if (document.hidden) {
      wasRunningBeforeHide = game.running;
      if (game.running) game.stop();
    } else if (wasRunningBeforeHide && !game.running) {
      game.running = true;
      game.lastFrameTime = performance.now();
      game._loop();
    }
  });
})();