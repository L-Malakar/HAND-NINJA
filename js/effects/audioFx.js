/**
 * AudioFX
 * A small self-contained sound engine built directly on the Web Audio API —
 * no external audio files required. Every sound is layered from several
 * simple generators (tone + filtered noise + transient click) instead of a
 * single bare oscillator, run through a shared reverb send and a limiter,
 * so the game doesn't need audio assets but still sounds like more than
 * beeps.
 *
 * `sliceFruit(type, intensity)` is the main entry point for gameplay: it
 * gives each fruit its own acoustic signature (a heavy wet thud for
 * watermelon, a crisp crack for apple, a bright zesty spray for citrus, a
 * soft squelch for kiwi, a gentle thud for plum) instead of one generic
 * sound reused for everything. `slice()` / `pop()` remain as generic
 * fallbacks for anything without a fruit-specific profile.
 *
 * Call AudioFX.init() once from a user-gesture handler (e.g. the Start
 * button) to satisfy autoplay policies.
 */
const AudioFX = (() => {
  let ctx = null;
  let masterGain = null;
  let limiter = null;
  let reverb = null; // convolver used as a shared "space" send
  let reverbSend = null; // gain feeding the convolver
  let muted = false;

  /** Lazily create (once) the whole audio graph on first use. */
  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      // Limiter: catches any overlap of sounds so nothing clips/distorts.
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 12;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.18;

      masterGain = ctx.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(limiter).connect(ctx.destination);

      // Cheap algorithmic reverb: a short noise impulse fed through a
      // convolver gives every sound a touch of "room" instead of feeling
      // like it's playing in a vacuum.
      reverb = ctx.createConvolver();
      reverb.buffer = _makeImpulse(ctx, 1.4, 2.2);
      reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.35;
      reverbSend.connect(reverb).connect(masterGain);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** White-noise buffer, optionally shaped by a decay power for texture. */
  function noiseBuffer(c, duration = 1, shape = 1) {
    const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const decay = shape === 1 ? 1 : Math.pow(1 - i / data.length, shape);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    return buffer;
  }

  /** Decaying noise impulse response, used as the reverb's convolver buffer. */
  function _makeImpulse(c, duration, decay) {
    const buffer = c.createBuffer(2, Math.floor(c.sampleRate * duration), c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decay);
      }
    }
    return buffer;
  }

  /** Connect a node to both the dry master path and the shared reverb send. */
  function toMaster(node, wetAmount = 0.25) {
    node.connect(masterGain);
    if (wetAmount > 0) {
      const send = ctx.createGain();
      send.gain.value = wetAmount;
      node.connect(send).connect(reverbSend);
    }
  }

  /**
   * Wobble an AudioParam with a small oscillator-driven LFO for the
   * duration given, then disconnect itself. Used for the "sputtering
   * spray" texture on citrus fruit and the wet "wobble" on watermelon.
   */
  function _modulateParam(param, { rate, depth, duration, startTime }) {
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain).connect(param);
    lfo.start(startTime);
    lfo.stop(startTime + duration);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function init() {
    ensureCtx();
  }

  function setMuted(value) {
    muted = value;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
  }

  function setVolume(v) {
    if (masterGain) masterGain.gain.value = muted ? 0 : clamp(v, 0, 1.2);
  }

  /**
   * Quick descending whoosh for a blade swipe: a pitched tone for the
   * "swing" plus a short burst of band-passed noise for air turbulence.
   * Generic fallback — prefer sliceFruit() for actual fruit hits.
   */
  function slice(intensity = 1) {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const amp = Math.min(1.4, Math.max(0.5, intensity));

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000 + Math.random() * 400, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.15 * amp, now + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() - 0.5) * 0.6;

    osc.connect(oscGain);
    if (pan) {
      oscGain.connect(pan);
      toMaster(pan, 0.18);
    } else {
      toMaster(oscGain, 0.18);
    }

    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer(c, 0.18, 2.5);
    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    noiseFilter.Q.value = 0.7;
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.11 * amp, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    noise.connect(noiseFilter).connect(noiseGain);
    toMaster(noiseGain, 0.15);

    osc.start(now);
    osc.stop(now + 0.18);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  /**
   * Juicy little pop: a body tone plus a tiny transient "tick" at the
   * very start. Generic fallback — prefer sliceFruit() for actual fruit.
   */
  function pop(freq = 440) {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const detune = (Math.random() - 0.5) * 25;

    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.setValueAtTime(detune, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.5), now + 0.1);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    toMaster(gain, 0.22);

    const tick = c.createBufferSource();
    tick.buffer = noiseBuffer(c, 0.02, 1);
    const tickFilter = c.createBiquadFilter();
    tickFilter.type = 'highpass';
    tickFilter.frequency.value = 4000;
    const tickGain = c.createGain();
    tickGain.gain.setValueAtTime(0.12, now);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    tick.connect(tickFilter).connect(tickGain);
    toMaster(tickGain, 0.1);

    osc.start(now);
    osc.stop(now + 0.15);
    tick.start(now);
    tick.stop(now + 0.03);
  }

  /**
   * Short rising ding, pitched up with combo count.
   */
  function combo(count = 1) {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const freq = 520 + Math.min(count, 8) * 60;

    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    toMaster(gain, 0.4);

    const harm = c.createOscillator();
    harm.type = 'sine';
    harm.frequency.setValueAtTime(freq * 1.5, now);
    const harmGain = c.createGain();
    harmGain.gain.setValueAtTime(0.035, now);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    harm.connect(harmGain);
    toMaster(harmGain, 0.5);

    osc.start(now);
    osc.stop(now + 0.13);
    harm.start(now);
    harm.stop(now + 0.24);
  }

  /**
   * Bomb detonation: sub-bass thump, a sharp high-passed crack at the
   * instant of impact, a long filtered-noise rumble tail, and a scatter of
   * tiny debris clicks trailing off.
   */
  function explosion() {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;

    [0, -9].forEach((detune) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.detune.setValueAtTime(detune, now);
      osc.frequency.exponentialRampToValueAtTime(26, now + 0.9);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.45, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      osc.connect(g);
      toMaster(g, 0.25);
      osc.start(now);
      osc.stop(now + 1.0);
    });

    const crack = c.createBufferSource();
    crack.buffer = noiseBuffer(c, 0.06, 0.8);
    const crackFilter = c.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.value = 1200;
    const crackGain = c.createGain();
    crackGain.gain.setValueAtTime(0.5, now);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    crack.connect(crackFilter).connect(crackGain);
    toMaster(crackGain, 0.3);
    crack.start(now);
    crack.stop(now + 0.08);

    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer(c, 1.1, 1);
    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(140, now + 0.85);
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    noise.connect(noiseFilter).connect(noiseGain);
    toMaster(noiseGain, 0.35);
    noise.start(now);
    noise.stop(now + 1.1);

    const debrisCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < debrisCount; i++) {
      const t = now + 0.08 + Math.random() * 0.5;
      const d = c.createBufferSource();
      d.buffer = noiseBuffer(c, 0.03, 1);
      const df = c.createBiquadFilter();
      df.type = 'bandpass';
      df.frequency.value = 1500 + Math.random() * 2500;
      df.Q.value = 3;
      const dg = c.createGain();
      dg.gain.setValueAtTime(0.001, t);
      dg.gain.exponentialRampToValueAtTime(0.12 + Math.random() * 0.08, t + 0.004);
      dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      d.connect(df).connect(dg);
      toMaster(dg, 0.2);
      d.start(t);
      d.stop(t + 0.06);
    }
  }

  // ---------------------------------------------------------------------
  // Per-fruit slice sounds
  // ---------------------------------------------------------------------
  //
  // Every fruit shares the same three-part anatomy of a cut — a thin
  // "skin break" transient, a "body" tone that gives it size/pitch, and a
  // "juice" noise layer that gives it wetness — but the parameters are
  // tuned per fruit so a watermelon actually sounds big and sloshy next
  // to a crisp apple or a zesty lemon.

  /** Short, percussive skin-break transient. Sharper = more "crunchy". */
  function _skinBreak(c, now, { hp = 2500, dur = 0.03, amp = 0.3 }) {
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, dur, 0.7);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = c.createGain();
    g.gain.setValueAtTime(amp, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    n.connect(f).connect(g);
    toMaster(g, 0.15);
    n.start(now);
    n.stop(now + dur + 0.01);
  }

  /** Tonal "body" of the fruit: pitch + decay shape define how big it sounds. */
  function _body(c, now, { type = 'sine', freqStart, freqEnd, dur, amp, detune = 0 }) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + dur);
    osc.detune.setValueAtTime(detune, now);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(amp, now + Math.min(0.012, dur * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    toMaster(gain, 0.3);
    osc.start(now);
    osc.stop(now + dur + 0.02);
    return { osc, gain };
  }

  /** Wet "juice" noise layer, lowpass-filtered so it splashes rather than hisses. */
  function _juice(c, now, { lpStart = 2200, lpEnd = 500, dur, amp, wobble = null }) {
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, dur, 1.3);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lpStart, now);
    f.frequency.exponentialRampToValueAtTime(lpEnd, now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(amp, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    n.connect(f).connect(g);
    toMaster(g, 0.3);
    n.start(now);
    n.stop(now + dur + 0.02);
    if (wobble) _modulateParam(f.frequency, { ...wobble, startTime: now, duration: dur });
  }

  /** Bright, band-passed "zest spray" texture used for citrus fruit. */
  function _zestSpray(c, now, { centerFreq = 3500, dur = 0.14, amp = 0.16, rate = 45, depth = 900 }) {
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, dur, 1.5);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(centerFreq, now);
    f.Q.value = 2.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(amp, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    n.connect(f).connect(g);
    toMaster(g, 0.3);
    n.start(now);
    n.stop(now + dur + 0.01);
    _modulateParam(f.frequency, { rate, depth, startTime: now, duration: dur });
  }

  const FRUIT_SOUND_BUILDERS = {
    // Big, hollow, and wet — a heavy low knock plus a long sloshy tail.
    watermelon(c, now, amp) {
      _skinBreak(c, now, { hp: 1600, dur: 0.025, amp: 0.22 * amp });
      _body(c, now, { type: 'sine', freqStart: 190, freqEnd: 70, dur: 0.22, amp: 0.3 * amp });
      _juice(c, now + 0.01, {
        lpStart: 2400,
        lpEnd: 300,
        dur: 0.36,
        amp: 0.34 * amp,
        wobble: { rate: 14, depth: 260 },
      });
    },

    // Crisp and percussive — almost no juice tail, just a sharp crack.
    apple(c, now, amp) {
      _skinBreak(c, now, { hp: 3200, dur: 0.018, amp: 0.34 * amp });
      _body(c, now, { type: 'triangle', freqStart: 1700, freqEnd: 420, dur: 0.09, amp: 0.22 * amp });
      _juice(c, now + 0.005, { lpStart: 2600, lpEnd: 900, dur: 0.1, amp: 0.12 * amp });
    },

    // Juicy citrus: bright zesty spray plus a fuller, juicier tone than lemon.
    orange(c, now, amp) {
      _skinBreak(c, now, { hp: 2600, dur: 0.02, amp: 0.24 * amp });
      _zestSpray(c, now, { centerFreq: 3000, dur: 0.16, amp: 0.17 * amp, rate: 38, depth: 800 });
      _body(c, now, { type: 'triangle', freqStart: 820, freqEnd: 260, dur: 0.14, amp: 0.2 * amp });
      _juice(c, now + 0.01, { lpStart: 2200, lpEnd: 600, dur: 0.2, amp: 0.2 * amp });
    },

    // Thin, tart citrus: higher, quicker zing with less body than orange.
    lemon(c, now, amp) {
      _skinBreak(c, now, { hp: 3000, dur: 0.016, amp: 0.22 * amp });
      _zestSpray(c, now, { centerFreq: 4200, dur: 0.12, amp: 0.16 * amp, rate: 55, depth: 1100 });
      _body(c, now, { type: 'triangle', freqStart: 1100, freqEnd: 380, dur: 0.1, amp: 0.16 * amp });
      _juice(c, now + 0.008, { lpStart: 2600, lpEnd: 800, dur: 0.14, amp: 0.14 * amp });
    },

    // Soft, dull squelch — very little high-frequency content.
    kiwi(c, now, amp) {
      _skinBreak(c, now, { hp: 1200, dur: 0.02, amp: 0.14 * amp });
      _body(c, now, { type: 'sine', freqStart: 210, freqEnd: 90, dur: 0.13, amp: 0.18 * amp });
      _juice(c, now + 0.006, {
        lpStart: 1100,
        lpEnd: 260,
        dur: 0.22,
        amp: 0.26 * amp,
        wobble: { rate: 20, depth: 120 },
      });
    },

    // Gentle, fleshy thud — softer and shorter than watermelon, no crack.
    plum(c, now, amp) {
      _skinBreak(c, now, { hp: 2000, dur: 0.016, amp: 0.16 * amp });
      _body(c, now, { type: 'sine', freqStart: 460, freqEnd: 160, dur: 0.12, amp: 0.2 * amp });
      _juice(c, now + 0.006, { lpStart: 1800, lpEnd: 500, dur: 0.16, amp: 0.18 * amp });
    },
  };

  /**
   * Play a realistic, fruit-specific cut sound.
   * @param {string} type - 'watermelon' | 'apple' | 'orange' | 'lemon' | 'kiwi' | 'plum'
   * @param {number} [intensity=1] - roughly blade speed; scales loudness a bit
   */
  function sliceFruit(type, intensity = 1) {
    const c = ensureCtx();
    if (!c) return;
    const amp = clamp(intensity, 0.6, 1.6);
    const builder = FRUIT_SOUND_BUILDERS[type];
    if (builder) {
      builder(c, c.currentTime, amp);
    } else {
      // Unknown fruit type (or a bomb slipping through): fall back to the
      // generic whoosh + pop rather than staying silent.
      slice(amp);
      pop(360 + Math.random() * 160);
    }
  }

  // ---------------------------------------------------------------------
  // Recorded sample effects (asset/fx/*.mp3)
  // ---------------------------------------------------------------------
  // These play alongside the synthesized sounds above (nothing above this
  // block is changed) using plain <audio> elements, so no CORS/decoding
  // setup is needed and one-shots can freely overlap.

  const SFX_PATHS = {
    fruitIn: 'asset/fx/fruit.mp3',
    cut: 'asset/fx/cut.mp3',
    multiCut: 'asset/fx/multi-cut.mp3',
    bomLoop: 'asset/fx/bomb.mp3',
    blast: 'asset/fx/blast.mp3',
  };

  let bomLoopEl = null; // persistent looping element for the bomb-on-screen loop
  const BOM_LOOP_END = 0.8; // seconds — restart the loop here instead of at the sample's natural end

  /** Play a one-shot sample. Clones the node each time so overlapping calls don't cut each other off. */
  function _playOneShot(path, volume = 1) {
    if (muted) return;
    try {
      const el = new Audio(path);
      el.volume = volume;
      el.play().catch(() => {});
    } catch (e) {
      /* ignore playback errors (e.g. no user gesture yet) */
    }
  }

  /** Fruit entering the screen (spawn). */
  function fruitIn() {
    _playOneShot(SFX_PATHS.fruitIn, 0.7);
  }

  /** Player sliced exactly one fruit in this swipe. */
  function cut() {
    _playOneShot(SFX_PATHS.cut, 1);
  }

  /** Player sliced two or more fruit in the same swipe. */
  function multiCut() {
    _playOneShot(SFX_PATHS.multiCut, 1);
  }

  /** Start the looping bomb-on-screen drone. Safe to call repeatedly. */
  function startBombLoop() {
    if (muted) return;
    if (!bomLoopEl) {
      bomLoopEl = new Audio(SFX_PATHS.bomLoop);
      bomLoopEl.volume = 0.55;
      // Native `loop` restarts at the file's actual end; we want a tighter
      // 0.8s loop point, so restart manually once playback reaches it.
      bomLoopEl.addEventListener('timeupdate', () => {
        if (bomLoopEl.currentTime >= BOM_LOOP_END) {
          bomLoopEl.currentTime = 0;
          if (bomLoopEl.paused) bomLoopEl.play().catch(() => {});
        }
      });
    }
    if (bomLoopEl.paused) {
      bomLoopEl.currentTime = 0;
      bomLoopEl.play().catch(() => {});
    }
  }

  /** Stop the bomb-on-screen loop (bomb left the screen, was hit, or run ended). */
  function stopBombLoop() {
    if (bomLoopEl && !bomLoopEl.paused) {
      bomLoopEl.pause();
      bomLoopEl.currentTime = 0;
    }
  }

  /** Bomb was actually touched/sliced by the player. */
  function blast() {
    _playOneShot(SFX_PATHS.blast, 1);
  }

  return {
    init,
    slice,
    pop,
    combo,
    explosion,
    sliceFruit,
    setMuted,
    setVolume,
    fruitIn,
    cut,
    multiCut,
    startBombLoop,
    stopBombLoop,
    blast,
  };
})();
