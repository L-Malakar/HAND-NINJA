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
  const finalScore = document.getElementById('final-score');

  let game = null;
  let tracker = null;

  function setStatus(msg, isError = false) {
    statusText.textContent = msg;
    statusText.classList.toggle('error', isError);
  }

  function renderLives(lives) {
    const filled = Math.max(0, lives);
    livesValue.textContent = '●'.repeat(filled) + '○'.repeat(Math.max(0, 3 - filled));
  }

  function initGame() {
    game = new Game({
      canvas: gameCanvas,
      overlayCanvas,
      callbacks: {
        onScoreChange: (score) => {
          scoreValue.textContent = String(score);
        },
        onComboChange: (combo) => {
          comboValue.textContent = `x${combo}`;
        },
        onLivesChange: (lives) => {
          renderLives(lives);
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

    try {
      if (!tracker) {
        await initTracker();
      }
      setStatus('');
      startScreen.classList.add('hidden');
      gameOverScreen.classList.add('hidden');
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
    gameOverScreen.classList.add('hidden');
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