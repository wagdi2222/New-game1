// Chiptune-style sound effects synthesized with Web Audio; no audio files to download.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};
  let ctx = null, master = null, noiseBuf = null, engine = null;
  let enabled = true, engineEnabled = true;
  const lastPlayed = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, start, dur, o) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, start);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + dur);
    g.gain.setValueAtTime(o.vol == null ? 0.08 : o.vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g); g.connect(master);
    osc.start(start); osc.stop(start + dur + 0.02);
  }

  function noise(start, dur, o) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 2000, start);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, start + dur);
    g.gain.setValueAtTime(o.vol == null ? 0.2 : o.vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(start, Math.random() * 0.5); src.stop(start + dur + 0.02);
  }

  function seq(t, notes, step, o) {
    notes.forEach((f, i) => { if (f) tone(f, t + i * step, step * (o.hold || 0.9), o); });
  }

  const SFX = {
    shoot: t => { tone(540, t, 0.09, { to: 140, vol: 0.07 }); noise(t, 0.05, { freq: 3200, vol: 0.05 }); },
    eshoot: t => tone(380, t, 0.07, { to: 120, vol: 0.025 }),
    brick: t => noise(t, 0.09, { freq: 1600, to: 380, vol: 0.16 }),
    steel: t => { tone(1400, t, 0.06, { vol: 0.05, type: 'triangle' }); tone(2100, t, 0.05, { vol: 0.03 }); },
    wall: t => noise(t, 0.05, { freq: 900, vol: 0.07 }),
    armor: t => { tone(260, t, 0.05, { vol: 0.07, to: 190 }); noise(t, 0.04, { freq: 4000, vol: 0.05, filter: 'highpass' }); },
    boom: t => { noise(t, 0.45, { freq: 1400, to: 120, vol: 0.32 }); tone(120, t, 0.35, { to: 40, vol: 0.14, type: 'sine' }); },
    die: t => { noise(t, 0.9, { freq: 2200, to: 80, vol: 0.42 }); tone(170, t, 0.8, { to: 30, vol: 0.12, type: 'sawtooth' }); },
    base: t => {
      noise(t, 1.4, { freq: 2600, to: 60, vol: 0.45 });
      seq(t + 0.25, [392, 330, 262, 196], 0.18, { vol: 0.06 });
    },
    appear: t => seq(t, [1047, 1319, 1568, 2093], 0.045, { vol: 0.045 }),
    pickup: t => seq(t, [784, 988, 1175, 1568, 1976], 0.05, { vol: 0.055 }),
    life: t => seq(t, [1047, 1568, 2093, 1568, 2093, 2637], 0.08, { vol: 0.05 }),
    pause: t => { tone(880, t, 0.08, { vol: 0.05 }); tone(660, t + 0.1, 0.1, { vol: 0.05 }); },
    tick: t => tone(1250, t, 0.03, { vol: 0.035 }),
    slide: t => noise(t, 0.12, { freq: 5000, filter: 'highpass', vol: 0.035 }),
    freeze: t => seq(t, [2093, 1760, 2093, 1760], 0.06, { vol: 0.035, type: 'triangle' }),
    start: t => {
      seq(t, [392, 523, 659, 784, 0, 659, 784, 1047, 1047], 0.11, { vol: 0.06 });
      seq(t, [131, 0, 196, 0, 165, 0, 196, 262, 262], 0.11, { vol: 0.07, type: 'triangle' });
    },
    clear: t => {
      seq(t, [523, 659, 784, 1047, 0, 784, 1047, 1319, 1319], 0.09, { vol: 0.06 });
      seq(t, [131, 165, 196, 262, 0, 196, 262, 330, 330], 0.09, { vol: 0.06, type: 'triangle' });
    },
    over: t => {
      seq(t, [523, 494, 466, 440, 0, 392, 392, 392], 0.16, { vol: 0.06 });
      seq(t, [131, 123, 117, 110, 0, 98, 98, 98], 0.16, { vol: 0.07, type: 'triangle' });
    },
  };

  function play(name) {
    if (!ctx || !enabled || !SFX[name]) return;
    const now = ctx.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < 0.035) return;
    lastPlayed[name] = now;
    try { SFX[name](now + 0.005); } catch (e) { /* audio is best effort */ }
  }

  // Low rumble that rises while the player's tank is moving
  function setEngine(mode) {
    if (!ctx) return;
    if (!enabled || !engineEnabled) mode = 'off';
    if (!engine) {
      const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), amp = ctx.createGain();
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 70;
      lp.type = 'lowpass'; lp.frequency.value = 650;
      amp.gain.value = 0;
      lfo.frequency.value = 15; depth.gain.value = 0;
      lfo.connect(depth); depth.connect(amp.gain);
      osc.connect(lp); lp.connect(amp); amp.connect(master);
      osc.start(); lfo.start();
      engine = { osc, amp, depth, mode: 'off' };
    }
    if (engine.mode === mode) return;
    engine.mode = mode;
    const t = ctx.currentTime;
    const vol = mode === 'move' ? 0.05 : mode === 'idle' ? 0.025 : 0;
    engine.amp.gain.setTargetAtTime(vol, t, 0.06);
    engine.depth.gain.setTargetAtTime(vol * 0.6, t, 0.06);
    engine.osc.frequency.setTargetAtTime(mode === 'move' ? 96 : 68, t, 0.08);
  }

  TB.audio = {
    init,
    play,
    engine: setEngine,
    setEnabled(on) {
      enabled = on;
      if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.02);
      if (!on) setEngine('off');
    },
    setEngineEnabled(on) { engineEnabled = on; if (!on) setEngine('off'); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
})();
