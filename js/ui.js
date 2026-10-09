// Screens, touch/keyboard/gamepad input, HUD, map editor and the main loop.
(function () {
  'use strict';
  const TB = window.TB;
  const S = TB.sprites;
  const $ = id => document.getElementById(id);
  const STEP = 1000 / 60;
  // Release published by .github/workflows/apk.yml; the button appears once it exists
  const APK_RELEASE = 'https://api.github.com/repos/wagdi2222/New-game1/releases/tags/apk';
  const isApp = !!window.TankApp;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('tankbattle.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('tankbattle.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const settings = Object.assign({ difficulty: 'normal', sound: true, engine: true, vibrate: true, pad: 'm', lefty: false, full: true }, store.get('settings', {}));
  const progress = Object.assign({ hi: 0, unlocked: 1 }, store.get('progress', {}));

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const img = (src, cls) => { const i = new Image(); i.src = src; i.alt = ''; i.className = 'px' + (cls ? ' ' + cls : ''); return i; };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const game = new TB.Game({
    sound: n => TB.audio.play(n),
    vibrate: p => { if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* unsupported */ } } },
    event: onGameEvent,
  });
  const preview = new TB.Game({});

  // ---------- icons ----------
  const fx = S.effects();
  const ICON = {
    flag: S.iconURL(fx.flag),
    life: S.iconURL(S.tank('A', 'player', 0, 0)),
    foe: S.iconURL(S.tank('A', 'enemy', 0, 0), 2),
    logo: S.iconURL(S.tank('C', 'player', 0, 0), 6),
    foes: [['A', 'enemy'], ['B', 'enemy'], ['C', 'enemy'], ['D', 'green']].map(([d, p]) => S.iconURL(S.tank(d, p, 0, 0))),
    pu: {},
  };
  for (const k in fx.powerups) ICON.pu[k] = S.iconURL(fx.powerups[k]);
  function terrainSwatch(type) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d'), im = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const col = S.terrainPixel(type, x, y, 0) || [0, 0, 0], i = (y * 16 + x) * 4;
        im.data[i] = col[0]; im.data[i + 1] = col[1]; im.data[i + 2] = col[2]; im.data[i + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }
  const PU_INFO = {
    helmet: ['خوذة', 'درع يحميك من القذائف لعشر ثوانٍ'],
    clock: ['ساعة', 'تجمّد كل دبابات العدو لعشر ثوانٍ'],
    shovel: ['مجرفة', 'جدار فولاذي حول القاعدة لفترة'],
    star: ['نجمة', 'ترقية المدفع: أسرع، ثم طلقتان، ثم يكسر الفولاذ'],
    grenade: ['قنبلة', 'تدمّر كل الأعداء الظاهرين'],
    tank: ['دبابة', 'حياة إضافية'],
  };
  const TOAST = {
    helmet: 'خوذة: أنت محمي!', clock: 'ساعة: تجمّد الأعداء', shovel: 'مجرفة: قاعدة فولاذية',
    star: 'نجمة: مدفع أقوى', grenade: 'قنبلة: دُمّر الأعداء!', tank: 'دبابة إضافية',
  };
  const FOE_INFO = [['عادية', '100 نقطة'], ['سريعة', '200 نقطة · تتحرك بسرعة'], ['قوية', '300 نقطة · قذائف سريعة'], ['مدرّعة', '400 نقطة · تحتاج 4 إصابات']];
  const TERRAIN_INFO = [[1, 'طوب', 'يتهدّم بالقذائف'], [2, 'فولاذ', 'لا يُكسر إلا بمدفع من 3 نجوم'], [3, 'ماء', 'يمنع الدبابات وتعبره القذائف'],
    [4, 'أشجار', 'تخفي الدبابات تحتها'], [5, 'جليد', 'زلق، تنزلق عليه الدبابة']];

  // ---------- screens ----------
  const SCREENS = ['menu', 'stages', 'help', 'play', 'editor'];
  const OVERLAYS = ['settings', 'pause', 'tally', 'over'];
  let screen = 'menu', paused = false, customMap = null, curtainTimer = 0, tallyRun = 0;

  function show(name) {
    for (const s of SCREENS) $(s).hidden = s !== name;
    screen = name;
    if (name !== 'play') TB.audio.engine('off');
    if (name === 'menu') refreshMenu();
    if (name === 'play' || name === 'editor') layout();
    if (!isApp && name !== 'menu' && !(history.state && history.state.tb)) history.pushState({ tb: 1 }, '');
  }
  const overlayOpen = name => !$(name).hidden;
  function hideOverlays() { for (const o of OVERLAYS) $(o).hidden = true; }

  function goMenu() {
    hideOverlays();
    paused = false;
    clearTimeout(curtainTimer);
    game.state = 'idle';
    show('menu');
    if (!isApp && history.state && history.state.tb) history.back();
  }

  // Android back button (APK calls this) and browser back
  TB.onBack = () => {
    if (overlayOpen('settings')) { closeSettings(); return true; }
    if (screen === 'play') {
      if (paused || overlayOpen('tally') || overlayOpen('over')) goMenu();
      else pause(true);
      return true;
    }
    if (screen !== 'menu') { goMenu(); return true; }
    return false;
  };
  window.addEventListener('popstate', () => {
    if (screen === 'menu' && !overlayOpen('settings')) return;
    TB.onBack();
    if (screen !== 'menu') history.pushState({ tb: 1 }, '');
  });
  TB.appPaused = () => {
    if (screen === 'play' && !paused && game.state === 'play') pause(true);
    TB.audio.suspend();
  };
  TB.appResumed = () => TB.audio.resume();
  document.addEventListener('visibilitychange', () => { if (document.hidden) TB.appPaused(); else TB.appResumed(); });

  // ---------- menu ----------
  function refreshMenu() {
    $('menu-hi').textContent = progress.hi;
    $('b-play-label').textContent = progress.unlocked > 1 ? 'أكمل من المرحلة ' + progress.unlocked : 'ابدأ اللعب';
    const n = 1 + Math.floor(Math.random() * TB.levels.count);
    preview.loadMap(TB.levels.get(n).map);
    const c = $('menu-bg'), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(preview.renderPreview(), 0, 0);
  }
  $('logo-img').src = ICON.logo;
  $('b-play').onclick = () => startGame(progress.unlocked);
  $('b-stages').onclick = () => { buildStages(); show('stages'); };
  $('b-help').onclick = () => { buildHelp(); show('help'); };
  $('b-settings').onclick = openSettings;
  $('b-editor').onclick = () => { show('editor'); };
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = goMenu;

  // ---------- install ----------
  let installPrompt = null;
  const standalone = isApp || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    $('b-install').hidden = false;
    $('install-note').hidden = true;
  });
  $('b-install').onclick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* dismissed */ }
    installPrompt = null;
    $('b-install').hidden = true;
  };
  if (!standalone && isAndroid) $('install-note').hidden = false;
  if (isAndroid && !standalone && window.fetch) {
    fetch(APK_RELEASE).then(r => (r.ok ? r.json() : null)).then(rel => {
      const apk = rel && (rel.assets || []).find(a => /\.apk$/.test(a.name));
      if (!apk) return;
      $('b-apk').href = apk.browser_download_url;
      $('b-apk').hidden = false;
    }).catch(() => {});
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !isApp) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- stage select ----------
  function drawMap(canvas, rows) {
    preview.loadMap(rows);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(preview.renderPreview(), 0, 0, canvas.width, canvas.height);
  }
  function buildStages() {
    const grid = $('stage-grid');
    grid.textContent = '';
    const max = Math.max(TB.levels.count, progress.unlocked);
    for (let n = 1; n <= max; n++) {
      const info = TB.levels.get(n), locked = n > progress.unlocked;
      const b = el('button', 'stage-btn');
      const c = document.createElement('canvas');
      c.width = c.height = 208;
      drawMap(c, info.map);
      b.append(c, el('b', null, 'المرحلة ' + n), el('span', null, locked ? 'مقفلة' : info.name));
      b.disabled = locked;
      b.onclick = () => startGame(n);
      grid.append(b);
    }
  }

  // ---------- help ----------
  let helpBuilt = false;
  function buildHelp() {
    if (helpBuilt) return;
    helpBuilt = true;
    const item = (src, title, text) => {
      const d = el('div', 'item'), t = el('div');
      t.append(el('b', null, title), el('span', null, text));
      d.append(typeof src === 'string' ? img(src) : src, t);
      return d;
    };
    for (const [type, name, text] of TERRAIN_INFO) {
      const c = terrainSwatch(type);
      c.style.cssText = 'width:32px;height:32px;flex:none;border-radius:4px';
      $('help-terrain').append(item(c, name, text));
    }
    FOE_INFO.forEach(([name, text], k) => $('help-foes').append(item(ICON.foes[k], name, text)));
    for (const k of Object.keys(PU_INFO)) $('help-items').append(item(ICON.pu[k], PU_INFO[k][0], PU_INFO[k][1]));
  }

  // ---------- settings ----------
  function renderSettings() {
    for (const [id, key] of [['s-diff', 'difficulty'], ['s-pad', 'pad']]) {
      for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.v === settings[key]));
    }
    for (const [id, key] of [['s-sound', 'sound'], ['s-engine', 'engine'], ['s-vibrate', 'vibrate'], ['s-lefty', 'lefty'], ['s-full', 'full']]) {
      $(id).setAttribute('aria-pressed', String(!!settings[key]));
    }
  }
  function applySettings() {
    TB.audio.setEnabled(settings.sound);
    TB.audio.setEngineEnabled(settings.engine);
    const pad = { s: 120, m: 150, l: 180 }[settings.pad] || 150;
    document.documentElement.style.setProperty('--pad', pad + 'px');
    document.documentElement.style.setProperty('--fire', Math.round(pad * 0.72) + 'px');
    $('play').classList.toggle('lefty', settings.lefty);
  }
  function openSettings() { renderSettings(); $('settings').hidden = false; }
  function closeSettings() {
    $('settings').hidden = true;
    store.set('settings', settings);
    applySettings();
    layout();
  }
  for (const [id, key] of [['s-diff', 'difficulty'], ['s-pad', 'pad']]) {
    $(id).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      settings[key] = b.dataset.v;
      renderSettings(); applySettings(); layout();
    });
  }
  for (const [id, key] of [['s-sound', 'sound'], ['s-engine', 'engine'], ['s-vibrate', 'vibrate'], ['s-lefty', 'lefty'], ['s-full', 'full']]) {
    $(id).onclick = () => {
      settings[key] = !settings[key];
      renderSettings(); applySettings(); layout();
      if (key === 'sound' && settings.sound) { TB.audio.init(); TB.audio.play('pickup'); }
      if (key === 'vibrate' && settings.vibrate && navigator.vibrate) navigator.vibrate(40);
    };
  }
  document.querySelector('#settings [data-close]').onclick = closeSettings;
  $('settings').addEventListener('click', e => { if (e.target === $('settings')) closeSettings(); });

  // ---------- game flow ----------
  function enterFullscreen() {
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;
    root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }

  function startGame(stage, custom) {
    TB.audio.init();
    applySettings();
    if (settings.full && touch && !standalone) enterFullscreen();
    customMap = custom || null;
    game.start({ stage, difficulty: settings.difficulty, custom: customMap });
    hideOverlays();
    resetInput();
    paused = false;
    show('play');
    curtain();
  }

  function curtain() {
    const c = $('curtain');
    $('c-stage').textContent = customMap ? 'خريطتي' : 'المرحلة ' + game.stage;
    $('c-name').textContent = customMap ? 'من تصميمك' : game.stageName;
    $('banner').classList.remove('rise');
    c.classList.remove('open');
    c.hidden = false;
    clearTimeout(curtainTimer);
    curtainTimer = setTimeout(() => {
      c.classList.add('open');
      game.begin();
      curtainTimer = setTimeout(() => { c.hidden = true; }, 500);
    }, 1500);
  }

  function pause(on) {
    if (screen !== 'play' || game.state === 'ended' || overlayOpen('tally') || overlayOpen('over')) return;
    paused = on;
    $('pause').hidden = !on;
    resetInput();
    if (on) {
      TB.audio.engine('off');
      TB.audio.play('pause');
      $('pause-info').textContent = (customMap ? 'خريطتي' : 'المرحلة ' + game.stage) + ' · النقاط ' + game.score;
    }
  }
  $('b-pause').onclick = () => pause(true);
  $('b-resume').onclick = () => pause(false);
  $('b-restart').onclick = () => { $('pause').hidden = true; startGame(customMap ? 1 : game.stage, customMap); };
  $('b-pset').onclick = openSettings;
  $('b-quit').onclick = goMenu;

  function saveProgress() {
    if (game.score > progress.hi) progress.hi = game.score;
    store.set('progress', progress);
  }

  function onGameEvent(name, data) {
    if (name === 'dying') { $('banner').classList.add('rise'); TB.audio.engine('off'); }
    else if (name === 'gameover') setTimeout(showGameOver, 250);
    else if (name === 'clear') showTally(data);
    else if (name === 'powerup') toast(data);
  }

  async function showTally(d) {
    TB.audio.engine('off');
    if (!customMap) progress.unlocked = Math.max(progress.unlocked, d.stage + 1);
    saveProgress();
    $('t-title').textContent = customMap ? 'انتصرت على خريطتك!' : 'اكتملت المرحلة ' + d.stage + '!';
    $('b-next').textContent = customMap ? 'العب مجدداً' : 'المرحلة التالية';
    $('b-tally-back').textContent = customMap ? 'عُد إلى المصمّم' : 'القائمة الرئيسية';
    $('t-score').textContent = game.score;
    const box = $('t-lines');
    box.textContent = '';
    const cells = d.kills.map((n, k) => {
      const line = el('div', 'line'), count = el('b', null, '0'), pts = el('b', 'pts', '0');
      line.append(img(ICON.foes[k]), el('span', null, '× ' + d.points[k]), count, pts);
      box.append(line);
      return { count, pts };
    });
    const total = d.kills.reduce((a, b) => a + b, 0);
    const sum = el('div', 'sum');
    sum.append(el('span', null, String(total)), el('span', null, 'المجموع'));
    box.append(sum);
    $('tally').hidden = false;
    TB.audio.play('clear');
    const run = ++tallyRun;
    await wait(500);
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i <= d.kills[k]; i++) {
        if (run !== tallyRun) return;
        cells[k].count.textContent = i;
        cells[k].pts.textContent = i * d.points[k];
        TB.audio.play('tick');
        await wait(60);
      }
    }
  }
  $('b-tally-back').onclick = () => {
    tallyRun++;
    if (!customMap) { goMenu(); return; }
    hideOverlays();
    game.state = 'idle';
    show('editor');
  };
  $('b-next').onclick = () => {
    tallyRun++;
    $('tally').hidden = true;
    if (customMap) { startGame(1, customMap); return; }
    game.nextStage();
    resetInput();
    curtain();
  };

  function showGameOver() {
    if (screen !== 'play') return;
    const record = game.score > progress.hi && game.score > 0;
    saveProgress();
    TB.audio.play('over');
    $('o-reason').textContent = game.baseDead ? 'سقطت القاعدة! احمِها بالجدران وانتبه للدبابات القادمة نحوها.' : 'نفدت دباباتك.';
    $('o-score').textContent = game.score;
    $('o-record').hidden = !record;
    $('o-hi').textContent = 'أعلى نتيجة: ' + progress.hi;
    $('b-retry').textContent = customMap ? 'حاول مجدداً' : 'حاول مجدداً من المرحلة ' + game.stage;
    $('over').hidden = false;
  }
  $('b-retry').onclick = () => startGame(customMap ? 1 : game.stage, customMap);
  $('b-over-menu').onclick = goMenu;

  let toastTimer = 0;
  function toast(type) {
    const t = $('toast');
    t.textContent = '';
    t.append(img(ICON.pu[type]), el('span', null, TOAST[type]));
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- HUD ----------
  $('ico-flag').src = ICON.flag;
  $('ico-life').src = ICON.life;
  $('ico-foe').src = ICON.foe;
  const foeIcons = [];
  for (let i = 0; i < 20; i++) { const f = img(ICON.foe); foeIcons.push(f); $('h-foes').append(f); }
  let hud = {};
  function updateHud() {
    const h = { stage: customMap ? '★' : game.stage, lives: game.lives, score: game.score, left: game.enemiesLeft(), level: game.level };
    if (h.stage !== hud.stage) $('h-stage').textContent = h.stage;
    if (h.lives !== hud.lives) $('h-lives').textContent = h.lives;
    if (h.score !== hud.score) $('h-score').textContent = h.score;
    if (h.left !== hud.left) {
      foeIcons.forEach((f, i) => { f.style.visibility = i < h.left ? 'visible' : 'hidden'; });
      $('h-left').textContent = h.left;
    }
    if (h.level !== hud.level) [...$('h-level').children].forEach((s, i) => s.classList.toggle('on', i < h.level));
    hud = h;
  }

  // ---------- layout ----------
  function fit(box, canvas, size) {
    box.style.width = box.style.height = size + 'px';
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.max(208, Math.round((size - 6) * dpr));
  }
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight, land = vw >= vh;
    const pad = { s: 120, m: 150, l: 180 }[settings.pad] || 150;
    if (screen === 'play') {
      const play = $('play');
      play.classList.toggle('port', !land);
      const cs = getComputedStyle(play);
      const w = vw - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = vh - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      let size;
      if (land) {
        const side = Math.max(pad + 14, Math.min(w * 0.25, 250));
        size = Math.min(h, w - side * 2 - 20);
      } else {
        size = Math.min(w, h - 50 - Math.max(pad + 40, 200));
      }
      fit($('field'), $('cv'), Math.max(180, Math.floor(size)));
      draw();
    } else if (screen === 'editor') {
      const ed = $('editor');
      ed.classList.toggle('port', !land);
      const size = land ? Math.min(vh - 28, vw - 360) : Math.min(vw - 32, vh - 330);
      fit($('board'), $('ecv'), Math.max(180, Math.floor(size)));
      drawEditor();
    }
  }
  window.addEventListener('resize', layout);
  document.addEventListener('fullscreenchange', layout);

  const cvx = $('cv').getContext('2d');
  function draw() {
    const c = $('cv');
    cvx.imageSmoothingEnabled = false;
    cvx.drawImage(game.render(), 0, 0, c.width, c.height);
  }

  // ---------- input ----------
  const input = { keys: [], pad: -1, padId: null, fire: new Set(), keyFire: false, gp: -1, gpFire: false };
  const dpad = $('dpad'), arms = [...dpad.querySelectorAll('.arm')];
  let anchor = null;
  function resetInput() {
    // A focused button would otherwise catch Space/Enter meant for the cannon
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    input.keys = []; input.pad = -1; input.padId = null; input.fire.clear(); input.keyFire = false;
    anchor = null;
    dpad.style.transform = '';
    paintPad(-1); paintFire();
  }
  function paintPad(d) { arms.forEach(a => a.classList.toggle('on', +a.dataset.d === d)); }
  function paintFire() { $('fire').classList.toggle('on', input.fire.size > 0 || input.keyFire || input.gpFire); }
  const currentDir = () => (input.pad >= 0 ? input.pad : input.keys.length ? input.keys[input.keys.length - 1] : input.gp);
  const currentFire = () => input.fire.size > 0 || input.keyFire || input.gpFire;

  const zoneL = $('zoneL'), zoneR = $('zoneR');
  zoneL.addEventListener('pointerdown', e => {
    if (input.padId !== null) return;
    e.preventDefault();
    TB.audio.init();
    try { zoneL.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    input.padId = e.pointerId;
    dpad.style.transform = '';
    const r = dpad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) <= r.width * 0.58) anchor = { x: cx, y: cy };
    else {
      // Thumb landed away from the pad: move the pad under it
      anchor = { x: e.clientX, y: e.clientY };
      dpad.classList.add('float');
      dpad.style.transform = 'translate(' + (e.clientX - cx) + 'px,' + (e.clientY - cy) + 'px)';
    }
    padMove(e);
  });
  zoneL.addEventListener('pointermove', e => { if (e.pointerId === input.padId) padMove(e); });
  const padEnd = e => {
    if (e.pointerId !== input.padId) return;
    input.padId = null; input.pad = -1; anchor = null;
    dpad.classList.remove('float');
    dpad.style.transform = '';
    paintPad(-1);
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zoneL.addEventListener(ev, padEnd);
  function padMove(e) {
    const dx = e.clientX - anchor.x, dy = e.clientY - anchor.y;
    let d = -1;
    if (Math.hypot(dx, dy) > dpad.offsetWidth * 0.1) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    // Keep the current axis until the other one clearly wins, so diagonals don't flicker
    if (d >= 0 && input.pad >= 0 && (d & 1) !== (input.pad & 1)) {
      const ratio = input.pad & 1 ? Math.abs(dy) / Math.max(1, Math.abs(dx)) : Math.abs(dx) / Math.max(1, Math.abs(dy));
      if (ratio < 1.3) d = input.pad;
    }
    if (d !== input.pad) { input.pad = d; paintPad(d); }
  }

  zoneR.addEventListener('pointerdown', e => {
    e.preventDefault();
    TB.audio.init();
    try { zoneR.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    input.fire.add(e.pointerId);
    paintFire();
  });
  const fireEnd = e => { input.fire.delete(e.pointerId); paintFire(); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zoneR.addEventListener(ev, fireEnd);
  document.addEventListener('contextmenu', e => { if (screen === 'play' || screen === 'editor') e.preventDefault(); });

  const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  const FIRE_KEYS = ['Space', 'KeyJ', 'KeyK', 'KeyZ', 'KeyX', 'Enter', 'NumpadEnter'];
  window.addEventListener('keydown', e => {
    if (screen !== 'play') return;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (overlayOpen('settings')) closeSettings();
      else if (!overlayOpen('tally') && !overlayOpen('over')) pause(!paused);
      return;
    }
    if (paused || overlayOpen('tally') || overlayOpen('over')) return;
    const d = KEYS[e.code];
    if (d !== undefined) { e.preventDefault(); if (!input.keys.includes(d)) input.keys.push(d); return; }
    if (FIRE_KEYS.includes(e.code)) { e.preventDefault(); TB.audio.init(); input.keyFire = true; paintFire(); }
  });
  window.addEventListener('keyup', e => {
    const d = KEYS[e.code];
    if (d !== undefined) input.keys = input.keys.filter(k => k !== d);
    if (FIRE_KEYS.includes(e.code)) { input.keyFire = false; paintFire(); }
  });
  window.addEventListener('blur', resetInput);

  let gamepads = false, gpStart = false;
  window.addEventListener('gamepadconnected', () => { gamepads = true; });
  function pollGamepads() {
    let dir = -1, fire = false, start = false;
    for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!gp) continue;
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      if (b(12)) dir = 0; else if (b(15)) dir = 1; else if (b(13)) dir = 2; else if (b(14)) dir = 3;
      else {
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        if (Math.max(Math.abs(ax), Math.abs(ay)) > 0.5) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 1 : 3) : (ay > 0 ? 2 : 0);
      }
      fire = fire || b(0) || b(1) || b(2) || b(3) || b(5) || b(7);
      start = start || b(9);
    }
    input.gp = dir;
    if (fire !== input.gpFire) { input.gpFire = fire; paintFire(); }
    if (start && !gpStart && screen === 'play') pause(!paused);
    gpStart = start;
  }

  // ---------- main loop ----------
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(200, now - last);
    last = now;
    if (gamepads) pollGamepads();
    if (screen !== 'play') return;
    if (!paused) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        game.input.dir = currentDir();
        game.input.fire = currentFire();
        game.update();
        acc -= STEP;
        n++;
      }
      if (n === 5) acc = 0;
    } else acc = 0;
    draw();
    updateHud();
    const p = game.player;
    TB.audio.engine(!paused && game.state === 'play' && p ? (p.moving ? 'move' : 'idle') : 'off');
  }
  requestAnimationFrame(frame);

  // ---------- map editor (26x26 blocks of 8px) ----------
  const BRUSHES = [['#', 1, 'طوب'], ['@', 2, 'فولاذ'], ['~', 3, 'ماء'], ['%', 4, 'أشجار'], ['-', 5, 'جليد'], ['.', 0, 'ممحاة']];
  const emptyMap = () => Array.from({ length: 26 }, () => '.'.repeat(26));
  let edMap = store.get('custom', null);
  if (!Array.isArray(edMap) || edMap.length !== 26) edMap = emptyMap();
  let brush = '#', brushSize = 2, painting = null;

  function protectedBlock(bx, by) {
    if (by <= 1 && (bx <= 1 || bx === 12 || bx === 13 || bx >= 24)) return true;
    if (by >= 24 && (bx === 8 || bx === 9)) return true;
    return by >= 23 && bx >= 11 && bx <= 14;
  }
  function tilesToBlocks(rows) {
    const half = { '[': ['#', 'l'], ']': ['#', 'r'], '^': ['#', 't'], '_': ['#', 'b'], '{': ['@', 'l'], '}': ['@', 'r'], '/': ['@', 't'], '\\': ['@', 'b'] };
    const out = [];
    for (let y = 0; y < 26; y++) {
      let row = '';
      for (let x = 0; x < 26; x++) {
        const ch = rows[y >> 1][x >> 1], h = half[ch], sx = x & 1, sy = y & 1;
        if (!h) row += ch;
        else row += (h[1] === 'l' && !sx) || (h[1] === 'r' && sx) || (h[1] === 't' && !sy) || (h[1] === 'b' && sy) ? h[0] : '.';
      }
      out.push(row);
    }
    return out;
  }
  const ecv = $('ecv'), ectx = ecv.getContext('2d');
  function drawEditor() {
    if (screen !== 'editor') return;
    preview.loadMap(edMap);
    ectx.imageSmoothingEnabled = false;
    ectx.drawImage(preview.renderPreview(), 0, 0, ecv.width, ecv.height);
    ectx.strokeStyle = 'rgba(255,255,255,.09)';
    ectx.lineWidth = 1;
    ectx.beginPath();
    for (let i = 1; i < 13; i++) {
      const p = Math.round(i * ecv.width / 13) + 0.5;
      ectx.moveTo(p, 0); ectx.lineTo(p, ecv.height);
      ectx.moveTo(0, p); ectx.lineTo(ecv.width, p);
    }
    ectx.stroke();
  }
  function paintAt(e) {
    const r = ecv.getBoundingClientRect();
    let bx = Math.floor((e.clientX - r.left) / r.width * 26), by = Math.floor((e.clientY - r.top) / r.height * 26);
    if (bx < 0 || by < 0 || bx > 25 || by > 25) return;
    if (brushSize === 2) { bx &= ~1; by &= ~1; }
    let changed = false;
    for (let y = by; y < by + brushSize; y++) {
      for (let x = bx; x < bx + brushSize; x++) {
        if (protectedBlock(x, y) || edMap[y][x] === painting) continue;
        edMap[y] = edMap[y].slice(0, x) + painting + edMap[y].slice(x + 1);
        changed = true;
      }
    }
    if (changed) { store.set('custom', edMap); drawEditor(); }
  }
  ecv.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { ecv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    // Tapping a block that already has the brush erases it, so mistakes are quick to undo
    const r = ecv.getBoundingClientRect();
    const bx = Math.floor((e.clientX - r.left) / r.width * 26), by = Math.floor((e.clientY - r.top) / r.height * 26);
    painting = edMap[by] && edMap[by][bx] === brush && brush !== '.' ? '.' : brush;
    paintAt(e);
  });
  ecv.addEventListener('pointermove', e => { if (painting) paintAt(e); });
  for (const ev of ['pointerup', 'pointercancel']) ecv.addEventListener(ev, () => { painting = null; });

  for (const [ch, type, name] of BRUSHES) {
    const b = el('button', 'brush');
    b.title = name;
    b.setAttribute('aria-label', name);
    b.dataset.v = ch;
    if (type) b.append(terrainSwatch(type)); else b.append(el('span', 'erase', '✕'));
    b.onclick = () => { brush = ch; renderBrushes(); };
    $('brushes').append(b);
  }
  function renderBrushes() {
    for (const b of $('brushes').children) b.setAttribute('aria-pressed', String(b.dataset.v === brush));
    for (const b of $('e-size').children) b.setAttribute('aria-pressed', String(+b.dataset.v === brushSize));
  }
  $('e-size').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { brushSize = +b.dataset.v; renderBrushes(); } });
  $('e-clear').onclick = () => { edMap = emptyMap(); store.set('custom', edMap); drawEditor(); };
  $('e-random').onclick = () => {
    edMap = tilesToBlocks(TB.levels.get(13 + Math.floor(Math.random() * 500)).map);
    store.set('custom', edMap);
    drawEditor();
  };
  $('e-play').onclick = () => startGame(1, edMap.slice());
  renderBrushes();

  // ---------- boot ----------
  applySettings();
  show('menu');
  TB.ui = { game, show, startGame, settings, progress };
})();
