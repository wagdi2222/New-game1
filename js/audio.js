// Sound, all synthesized with Web Audio: effects, plus music in Arabic maqamat played on a
// plucked oud-like string (Karplus-Strong) over darbuka rhythms. Quarter tones are exact frequencies.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};
  let ctx = null, sfxBus = null, musicBus = null, noiseBuf = null, engine = null;
  let sfxOn = true, musicOn = true, engineOn = true;
  const lastPlayed = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.75 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingMusic) { const m = pendingMusic; pendingMusic = null; playMusic(m); }
  }

  function tone(freq, start, dur, o, bus) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, start);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + dur);
    g.gain.setValueAtTime(o.vol == null ? 0.08 : o.vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g); g.connect(bus || sfxBus);
    osc.start(start); osc.stop(start + dur + 0.02);
  }

  function noise(start, dur, o, bus) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 2000, start);
    if (o.q) f.Q.value = o.q;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, start + dur);
    g.gain.setValueAtTime(o.vol == null ? 0.2 : o.vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(bus || sfxBus);
    src.start(start, Math.random() * 0.5); src.stop(start + dur + 0.02);
  }

  // ---------- plucked string ----------
  const pluckCache = new Map();
  function pluckBuffer(freq) {
    const key = Math.round(freq * 10);
    let entry = pluckCache.get(key);
    if (entry) return entry;
    const sr = ctx.sampleRate, n = Math.max(2, Math.floor(sr / freq)), len = Math.floor(sr * 1.3);
    const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0), ring = new Float32Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) { const r = Math.random() * 2 - 1; ring[i] = (r + prev) / 2; prev = r; }
    for (let i = 0, idx = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % n];
      out[i] = a;
      ring[idx] = (a + b) * 0.4985;
      idx = (idx + 1) % n;
    }
    // The averaging filter adds half a sample of delay: correct the pitch with the playback rate
    entry = { buf, rate: freq / (sr / (n + 0.5)) };
    pluckCache.set(key, entry);
    return entry;
  }
  function pluck(freq, start, vol, bus) {
    const { buf, rate } = pluckBuffer(freq);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = buf; src.playbackRate.value = rate;
    f.type = 'lowpass'; f.frequency.value = 2600;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 1.25);
    src.connect(f); f.connect(g); g.connect(bus || musicBus);
    src.start(start); src.stop(start + 1.3);
  }

  // ---------- darbuka ----------
  function drum(kind, t, bus, vol) {
    const v = vol == null ? 1 : vol;
    if (kind === 'D') {
      tone(118, t, 0.28, { type: 'sine', to: 52, vol: 0.26 * v }, bus);
      noise(t, 0.05, { freq: 500, vol: 0.08 * v }, bus);
    } else if (kind === 'T') {
      noise(t, 0.07, { freq: 3600, filter: 'bandpass', q: 1.4, vol: 0.2 * v }, bus);
      tone(820, t, 0.03, { type: 'triangle', vol: 0.04 * v }, bus);
    } else if (kind === 'k') {
      noise(t, 0.05, { freq: 4200, filter: 'bandpass', q: 1.6, vol: 0.09 * v }, bus);
    }
  }

  // ---------- maqamat and the music sequencer ----------
  const MAQAMAT = {
    hijaz: [0, 1, 4, 5, 7, 8, 10],
    bayati: [0, 1.5, 3, 5, 7, 8, 10],
    kurd: [0, 1, 3, 5, 7, 8, 10],
    saba: [0, 1.5, 3, 4, 7, 8, 10],
    rast: [0, 2, 3.5, 5, 7, 9, 10.5],
    nahawand: [0, 2, 3, 5, 7, 8, 11],
  };
  const TONIC = 146.83; // D3
  const freqOf = (maqam, degree, octave) => {
    const s = MAQAMAT[maqam] || MAQAMAT.hijaz, o = Math.floor(degree / 7), i = ((degree % 7) + 7) % 7;
    return TONIC * Math.pow(2, (s[i] + 12 * (o + octave)) / 12);
  };
  // Phrases of [scale degree, length in eighths]; each fills two bars
  const PHRASES = [
    [[0, 2], [1, 1], [2, 1], [3, 2], [2, 1], [1, 1], [2, 2], [3, 1], [4, 1], [3, 2], [2, 2]],
    [[4, 2], [3, 1], [2, 1], [3, 2], [2, 1], [1, 1], [2, 2], [1, 1], [0, 1], [1, 2], [0, 2]],
    [[4, 1], [5, 1], [6, 2], [5, 1], [4, 1], [5, 2], [4, 1], [3, 1], [4, 2], [3, 1], [2, 1], [3, 2]],
    [[2, 1], [3, 1], [4, 2], [3, 1], [2, 1], [1, 2], [2, 1], [1, 1], [0, 4], [null, 2]],
  ];
  const SONG = [0, 1, 0, 3, 2, 1, 2, 3];
  const RHYTHMS = { maqsum: 'DT.TD.T.', baladi: 'DD.TD.T.', saidi: 'DT.DD.T.', malfuf: 'D..T..k.', menu: 'D...T.k.' };
  const SCORE = (() => {
    const steps = [];
    for (const p of SONG) for (const [deg, len] of PHRASES[p]) { steps.push(deg == null ? null : [deg, len]); for (let i = 1; i < len; i++) steps.push(undefined); }
    return steps;
  })();

  let pendingMusic = null, seq = null;
  function playMusic(opts) {
    stopMusic();
    if (!opts) return;
    if (!ctx) { pendingMusic = opts; return; }
    const tempo = opts.tempo || 108;
    seq = { opts, step: 0, next: ctx.currentTime + 0.12, eighth: 60 / tempo / 2 };
    seq.timer = setInterval(schedule, 50);
    schedule();
  }
  function stopMusic() {
    if (seq) { clearInterval(seq.timer); seq = null; }
  }
  function schedule() {
    if (!seq || !ctx) return;
    const { opts } = seq, rhythm = RHYTHMS[opts.rhythm] || RHYTHMS.maqsum;
    while (seq.next < ctx.currentTime + 0.3) {
      const i = seq.step, t = seq.next, bar = i % 8, phrase = Math.floor(i / 16) % SONG.length;
      if (musicOn) {
        const hit = rhythm[bar];
        if (hit !== '.') drum(hit, t, musicBus, opts.drums == null ? 0.8 : opts.drums);
        if (opts.bass !== false && (bar === 0 || bar === 4)) pluck(freqOf(opts.maqam, phrase % 2 ? 4 : 0, -1), t, 0.14);
        const note = SCORE[i % SCORE.length];
        const quiet = opts.sparse && phrase % 2 === 1;
        if (note && !quiet) {
          const f = freqOf(opts.maqam, note[0], 0);
          pluck(f, t, 0.16);
          // Oud tremolo on long notes
          if (note[1] >= 2) pluck(f, t + seq.eighth, 0.09);
          if (note[1] >= 4) { pluck(f, t + seq.eighth * 2, 0.08); pluck(f, t + seq.eighth * 3, 0.06); }
        }
      }
      seq.step++;
      seq.next += seq.eighth;
    }
  }
  function phrase(maqam, notes, step, vol) {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.05;
    notes.forEach((d, i) => { if (d != null) pluck(freqOf(maqam, d, 0), t0 + i * step, vol || 0.2, sfxBus); });
  }

  // ---------- effects ----------
  const SFX = {
    shoot: t => { tone(540, t, 0.09, { to: 140, vol: 0.07 }); noise(t, 0.05, { freq: 3200, vol: 0.05 }); },
    eshoot: t => tone(380, t, 0.07, { to: 120, vol: 0.025 }),
    mud: t => noise(t, 0.1, { freq: 1300, to: 300, vol: 0.16 }),
    stone: t => { tone(1400, t, 0.06, { vol: 0.05, type: 'triangle' }); tone(2100, t, 0.05, { vol: 0.03 }); },
    wall: t => noise(t, 0.05, { freq: 900, vol: 0.07 }),
    armor: t => { tone(260, t, 0.05, { vol: 0.07, to: 190 }); noise(t, 0.04, { freq: 4000, vol: 0.05, filter: 'highpass' }); },
    hurt: t => { tone(180, t, 0.12, { vol: 0.1, to: 90, type: 'sawtooth' }); noise(t, 0.08, { freq: 1800, vol: 0.1 }); },
    boom: t => { noise(t, 0.45, { freq: 1400, to: 120, vol: 0.32 }); tone(120, t, 0.35, { to: 40, vol: 0.14, type: 'sine' }); },
    die: t => { noise(t, 0.9, { freq: 2200, to: 80, vol: 0.42 }); tone(170, t, 0.8, { to: 30, vol: 0.12, type: 'sawtooth' }); },
    wellhit: t => { noise(t, 0.25, { freq: 900, to: 200, vol: 0.22 }); tone(330, t, 0.2, { type: 'triangle', to: 180, vol: 0.08 }); },
    welldown: t => { noise(t, 1.4, { freq: 2600, to: 60, vol: 0.45 }); },
    appear: t => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.045, 0.05, { vol: 0.04 })),
    pickup: t => [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, t + i * 0.05, 0.06, { vol: 0.05 })),
    life: t => [1047, 1568, 2093, 1568, 2093, 2637].forEach((f, i) => tone(f, t + i * 0.08, 0.08, { vol: 0.05 })),
    pause: t => { tone(880, t, 0.08, { vol: 0.05 }); tone(660, t + 0.1, 0.1, { vol: 0.05 }); },
    tick: t => tone(1250, t, 0.03, { vol: 0.035 }),
    sand: t => noise(t, 0.25, { freq: 5000, filter: 'highpass', vol: 0.05 }),
    whirl: t => noise(t, 0.8, { freq: 600, to: 3000, filter: 'bandpass', q: 3, vol: 0.18 }),
    falcon: t => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(2300, t); o.frequency.exponentialRampToValueAtTime(1300, t + 0.45);
      lfo.frequency.value = 28; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + 0.52); lfo.stop(t + 0.52);
    },
    strike: t => { noise(t, 0.12, { freq: 2500, to: 600, vol: 0.2 }); tone(420, t, 0.1, { to: 140, vol: 0.08 }); },
    mortar: t => { tone(90, t, 0.18, { type: 'sine', to: 45, vol: 0.2 }); noise(t, 0.12, { freq: 700, vol: 0.12 }); },
    whistle: t => tone(1600, t, 0.7, { type: 'sine', to: 500, vol: 0.035 }),
    mine: t => tone(1900, t, 0.05, { type: 'square', vol: 0.025 }),
    coin: t => { tone(1568, t, 0.06, { vol: 0.05, type: 'triangle' }); tone(2093, t + 0.06, 0.1, { vol: 0.05, type: 'triangle' }); },
    camel: t => { noise(t, 0.35, { freq: 300, to: 160, filter: 'lowpass', vol: 0.2 }); tone(110, t, 0.3, { type: 'sawtooth', to: 80, vol: 0.05 }); },
    tower: t => { noise(t, 0.9, { freq: 800, to: 80, vol: 0.4 }); tone(70, t, 0.6, { type: 'sine', to: 35, vol: 0.18 }); },
    coffee: t => [0, 0.07, 0.13, 0.2].forEach(d => tone(600 + Math.random() * 500, t + d, 0.05, { type: 'sine', vol: 0.05 })),
    water: t => { noise(t, 0.3, { freq: 1200, to: 400, filter: 'bandpass', q: 2, vol: 0.15 }); tone(700, t, 0.15, { type: 'sine', to: 1200, vol: 0.04 }); },
    mason: t => { noise(t, 0.12, { freq: 400, vol: 0.25 }); noise(t + 0.15, 0.12, { freq: 400, vol: 0.25 }); },
    hammer: t => { tone(1800, t, 0.25, { type: 'triangle', vol: 0.07 }); tone(2690, t, 0.18, { type: 'sine', vol: 0.04 }); },
    shield: t => tone(523, t, 0.4, { type: 'triangle', to: 1046, vol: 0.06 }),
  };

  function play(name) {
    if (!ctx || !sfxOn) return;
    if (name === 'start') return phrase('hijaz', [0, 2, 4, 7, null, 4, 7], 0.11);
    if (name === 'clear') return phrase('hijaz', [0, 1, 2, 3, 4, 7, null, 7], 0.1, 0.22);
    if (name === 'over') return phrase('kurd', [4, 3, 2, 1, 0, null, -3], 0.18);
    if (name === 'medal') return phrase('rast', [0, 2, 4, 7, 9], 0.08, 0.18);
    if (!SFX[name]) return;
    const now = ctx.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < 0.035) return;
    lastPlayed[name] = now;
    try { SFX[name](now + 0.005); } catch (e) { /* audio is best effort */ }
  }

  // Low rumble that rises while the player's tank is moving
  function setEngine(mode) {
    if (!ctx) return;
    if (!sfxOn || !engineOn) mode = 'off';
    if (!engine) {
      const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), amp = ctx.createGain();
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 70;
      lp.type = 'lowpass'; lp.frequency.value = 650;
      amp.gain.value = 0;
      lfo.frequency.value = 15; depth.gain.value = 0;
      lfo.connect(depth); depth.connect(amp.gain);
      osc.connect(lp); lp.connect(amp); amp.connect(sfxBus);
      osc.start(); lfo.start();
      engine = { osc, amp, depth, mode: 'off' };
    }
    if (engine.mode === mode) return;
    engine.mode = mode;
    const t = ctx.currentTime, vol = mode === 'move' ? 0.04 : mode === 'idle' ? 0.02 : 0;
    engine.amp.gain.setTargetAtTime(vol, t, 0.06);
    engine.depth.gain.setTargetAtTime(vol * 0.6, t, 0.06);
    engine.osc.frequency.setTargetAtTime(mode === 'move' ? 96 : 68, t, 0.08);
  }

  TB.audio = {
    init, play, engine: setEngine, music: playMusic, stopMusic, MAQAMAT,
    setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02); if (!on) setEngine('off'); },
    setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.75 : 0, ctx.currentTime, 0.05); },
    setEngineEnabled(on) { engineOn = on; if (!on) setEngine('off'); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
})();
