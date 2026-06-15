/**
 * HandTracker
 * Wraps MediaPipe Hands + Camera utilities to provide a simple
 * callback-based API for getting the index fingertip position
 * of the user's right hand, in normalized [0,1] coordinates.
 *
 * Note: MediaPipe reports handedness from the camera's perspective.
 * Since the video feed is mirrored via CSS (transform: scaleX(-1))
 * for a natural "mirror" interaction, the hand that MediaPipe labels
 * "Left" corresponds to the user's actual RIGHT hand on screen.
 * We account for that here so callers always get "the user's right hand".
 */
class HandTracker {
  /**
   * @param {HTMLVideoElement} videoElement
   * @param {Object} callbacks
   * @param {(point: {x:number, y:number, z:number}) => void} callbacks.onIndexTip
   * @param {() => void} callbacks.onHandLost
   * @param {(landmarks: Array) => void} [callbacks.onResults] - raw landmarks for the tracked hand
   * @param {(err: Error) => void} callbacks.onError
   */
  constructor(videoElement, callbacks) {
    this.video = videoElement;
    this.callbacks = callbacks;
    this.hands = null;
    this.camera = null;
    this.lastSeenAt = 0;
    this.HAND_TIMEOUT_MS = 600;

    // MediaPipe landmark index for the index fingertip
    this.INDEX_TIP = 8;
  }

  async start() {
    if (typeof Hands === 'undefined') {
      throw new Error('MediaPipe Hands library failed to load.');
    }

    this.hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    this.hands.onResults((results) => this._handleResults(results));

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false,
    });

    this.video.srcObject = stream;
    await this.video.play();

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        try {
          await this.hands.send({ image: this.video });
        } catch (err) {
          // Swallow transient frame errors (e.g. during resize)
        }
      },
      width: 1280,
      height: 720,
    });

    this.camera.start();

    // Watchdog: if we stop receiving the tracked hand, notify "hand lost"
    this._watchdog = setInterval(() => {
      if (Date.now() - this.lastSeenAt > this.HAND_TIMEOUT_MS) {
        this.callbacks.onHandLost?.();
      }
    }, 200);
  }

  _handleResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }

    const handednesses = results.multiHandedness || [];
    let targetIndex = -1;

    for (let i = 0; i < handednesses.length; i++) {
      // Because the feed is mirrored, MediaPipe's "Left" label = user's right hand.
      if (handednesses[i].label === 'Left') {
        targetIndex = i;
        break;
      }
    }

    // Fallback: if handedness data is unavailable, use the first detected hand.
    if (targetIndex === -1 && results.multiHandLandmarks.length > 0) {
      targetIndex = 0;
    }

    if (targetIndex === -1) return;

    const landmarks = results.multiHandLandmarks[targetIndex];
    const tip = landmarks[this.INDEX_TIP];

    this.lastSeenAt = Date.now();

    this.callbacks.onIndexTip?.({
      x: tip.x,
      y: tip.y,
      z: tip.z,
    });

    this.callbacks.onResults?.(landmarks);
  }

  stop() {
    if (this._watchdog) clearInterval(this._watchdog);
    if (this.camera) this.camera.stop();
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach((track) => track.stop());
    }
  }
}