// Screens, the journey and its saves, the souq and medals, touch/keyboard/gamepad input for
// one or two players, the HUD, the map editor with share codes, music per screen, and the main loop.
(function () {
  'use strict';
  const TB = window.TB, S = TB.sprites, L = TB.levels;
  const $ = id => document.getElementById(id);
  const STEP = 1000 / 60;
  const SITE = 'https://wagdi2222.github.io/New-game1/';
  // Release published by .github/workflows/apk.yml; the download button appears once it exists
  const APK_RELEASE = 'https://api.github.com/repos/wagdi2222/New-game1/releases/tags/apk';
  const isApp = !!window.TankApp;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  const standalone = isApp || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('waha.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('waha.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const settings = Object.assign({ difficulty: 'normal', sound: true, music: true, engine: true, vibrate: true, digits: 'arabic', pad: 'm', lefty: false, full: true, name: '', move: 'pad', tiltSens: 'mid' }, store.get('settings', {}));
  const save = Object.assign({ unlocked: 1, stars: {}, best: {}, dirhams: 0, falcons: 1, medals: {}, dailyBest: {} }, store.get('save', {}));
  save.upg = Object.assign({ armor: 0, cannon: 0, engine: 0 }, save.upg);
  save.stats = Object.assign({ kills: 0, towers: 0, falcon: 0, buys: 0, bosses: 0, daily: [] }, save.stats);
  const persist = () => store.set('save', save);
  const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);

  const AR = '٠١٢٣٤٥٦٧٨٩';
  const fmt = n => (settings.digits === 'latin' ? String(n) : String(n).replace(/[0-9]/g, d => AR[d]));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const img = (src, cls) => { const i = new Image(); i.src = src; i.alt = ''; if (cls) i.className = cls; return i; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const starRow = (n, total) => { const d = el('div', 'stars'); for (let i = 0; i < (total || 3); i++) d.append(el('i', 'star' + (i < n ? '' : ' off'))); return d; };

  const NET = TB.online;
  const hosting = () => NET.active && NET.role === 'host';
  const guest = () => NET.active && NET.role === 'client';
  const vibrate = p => { if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* unsupported */ } } };
  const game = new TB.Game({
    sound: n => { TB.audio.play(n); if (hosting()) NET.capture('s', n); },
    vibrate: p => { if (!hosting()) vibrate(p); },
    event: onGameEvent,
  });
  const preview = new TB.Game({});

  // ---------- icons: vector drawings that stay sharp at any size (js/icons.js) ----------
  const fx = S.effects();
  const V = TB.icons.url;
  const ICON = {
    well: V('well'), skin: V('skin'), tower: V('tower'), camel: V('camel'), lantern: V('lantern'), boss: V('boss'), foe: V('foe'),
    falcon: V('falcon'), dhow: V('dhow'), star: V('star'), engine: V('engine'), commander: V('commander'),
    players: TB.consts.PALETTES.map(pal => V('vehicle:A:' + pal)),
    pu: {}, region: {},
  };
  ICON.p1 = ICON.players[0]; ICON.p2 = ICON.players[1];
  for (const k of ['shield', 'whirl', 'mason', 'hammer', 'falcon', 'dates', 'coffee', 'qirba']) ICON.pu[k] = V(k);
  for (const r of ['desert', 'oasis', 'mountains', 'coast', 'oldcity']) ICON.region[r] = V('region:' + r);
  const MISSION_ICON = { defend: ICON.well, collect: ICON.skin, towers: ICON.tower, escort: ICON.camel, survive: ICON.lantern, boss: ICON.boss };
  const OBJ_ICON = { foe: ICON.foe, skin: ICON.skin, tower: ICON.tower, camel: ICON.camel, moon: ICON.lantern, boss: ICON.boss };
  const TIME_NAME = { day: 'نهار', dawn: 'فجر', dusk: 'غروب', night: 'ليل' };
  const MAQAM_NAME = { hijaz: 'مقام الحجاز', bayati: 'مقام البيات', kurd: 'مقام الكرد', saba: 'مقام الصبا', rast: 'مقام الرست', nahawand: 'مقام النهاوند' };
  const RHYTHM = { desert: 'maqsum', oasis: 'baladi', mountains: 'saidi', coast: 'maqsum', oldcity: 'baladi' };
  document.documentElement.style.setProperty('--zellige', 'url("' + V('zellige') + '")');

  const PU_INFO = {
    shield: ['الدرع الدمشقي', 'حماية من كل القذائف لعشر ثوانٍ'],
    whirl: ['زوبعة رملية', 'تُربك العقارب فيتخبطون ولا يصيبون'],
    mason: ['البنّاء', 'سور حجري حول البئر لفترة'],
    hammer: ['مطرقة الحدّاد', 'ترقية المدفع: أسرع، ثم طلقتان، ثم يكسر الحجر'],
    falcon: ['الصقر', 'ينقضّ على أقرب ثلاثة أعداء'],
    dates: ['التمر', 'حياة إضافية وصحة كاملة'],
    coffee: ['دلّة القهوة', 'سرعة مضاعفة وإطلاق أسرع لعشر ثوانٍ'],
    qirba: ['قِربة الماء', 'ترمّم البئر، أو تروي الجمال، أو تشفي دباباتك'],
  };
  const TOAST = {
    shield: 'الدرع الدمشقي: أنت محمي!', whirl: 'زوبعة! العقارب تائهون', mason: 'البنّاء: سور حجري للبئر', hammer: 'مطرقة الحدّاد: مدفع أقوى',
    falcon: 'انطلق الصقر!', dates: 'تمر: حياة إضافية', coffee: 'دلّة القهوة: سرعة!', qirba: 'قِربة ماء: ترميم وشفاء',
  };

  // ---------- screens ----------
  const SCREENS = ['menu', 'online', 'journey', 'souq', 'medals', 'help', 'play', 'editor'];
  const OVERLAYS = ['settings', 'briefing', 'pause', 'result', 'over', 'codebox'];
  let screen = 'menu', paused = false, run = null, curtainTimer = 0, playersWanted = 1, musicKey = '', myPid = 0, names = null, onlinePick = false;
  const PLAYER_COLORS = ['#5BD17A', '#6FB3F2', '#B994F0', '#F5A253'];

  function show(name) {
    for (const s of SCREENS) $(s).hidden = s !== name;
    const was = screen;
    screen = name;
    if (name !== 'play') { TB.audio.engine('off'); if (was === 'play') holdOrientation(false); }
    if (name === 'menu') refreshMenu();
    if (name === 'play' || name === 'editor') layout();
    if (name !== 'play') musicFor('menu');
    if (!isApp && name !== 'menu' && !(history.state && history.state.tb)) history.pushState({ tb: 1 }, '');
  }
  const open = name => !$(name).hidden;
  function hideOverlays() { for (const o of OVERLAYS) $(o).hidden = true; }
  function goMenu() {
    hideOverlays(); paused = false; clearTimeout(curtainTimer); game.state = 'idle';
    show('menu');
    if (!isApp && history.state && history.state.tb) history.back();
  }
  function goJourney() {
    hideOverlays(); paused = false; clearTimeout(curtainTimer); game.state = 'idle';
    if (NET.active) { if (hosting()) NET.toLobby(); else NET.open(); return; }
    onlinePick = false;
    buildJourney(); show('journey');
  }

  TB.onBack = () => {
    if (open('settings')) { closeSettings(); return true; }
    if (open('codebox')) { $('codebox').hidden = true; return true; }
    if (open('briefing')) { $('briefing').hidden = true; return true; }
    if (screen === 'play') {
      if (paused || open('result') || open('over')) { if (guest()) NET.leave(false); else goJourney(); }
      else pause(true);
      return true;
    }
    if (screen === 'online') { if (NET.active) NET.leave(false); else goMenu(); return true; }
    if (screen === 'journey' && onlinePick) { NET.open(); return true; }
    if (screen !== 'menu') { goMenu(); return true; }
    return false;
  };
  window.addEventListener('popstate', () => {
    if (screen === 'menu' && !OVERLAYS.some(open)) return;
    TB.onBack();
    if (screen !== 'menu') history.pushState({ tb: 1 }, '');
  });
  TB.appPaused = () => {
    if (screen === 'play' && !paused && game.state === 'play') pause(true);
    TB.audio.suspend();
  };
  TB.appResumed = () => TB.audio.resume();
  document.addEventListener('visibilitychange', () => { if (document.hidden) TB.appPaused(); else TB.appResumed(); });
  document.addEventListener('pointerdown', () => { TB.audio.init(); }, { once: true, capture: true });

  function musicFor(where) {
    let key = where, opts = null;
    if (where === 'menu') opts = { maqam: 'nahawand', rhythm: 'menu', tempo: 84, drums: 0.55 };
    else if (where === 'play' && game.stage) {
      const st = game.stage, night = st.time === 'night', boss = st.mission === 'boss';
      key = 'play' + st.region + st.time + st.mission;
      opts = { maqam: L.REGIONS[st.region].maqam, rhythm: night ? 'malfuf' : boss ? 'saidi' : RHYTHM[st.region], tempo: night ? 92 : boss ? 122 : 108, sparse: night, drums: night ? 0.6 : 0.8 };
    }
    if (key === musicKey && opts) return;
    musicKey = opts ? key : '';
    if (opts) TB.audio.music(opts); else TB.audio.stopMusic();
  }

  // ---------- menu ----------
  const logo = S.kuficCanvas(8);
  $('logo').width = logo.width; $('logo').height = logo.height;
  $('logo').getContext('2d').drawImage(logo, 0, 0);
  function refreshMenu() {
    $('m-coins').textContent = fmt(save.dirhams);
    $('m-stars').textContent = fmt(totalStars());
    $('b-journey-label').textContent = save.unlocked > 1 ? 'أكمل الرحلة' : 'ابدأ الرحلة';
    const n = 1 + Math.floor(Math.random() * L.count);
    preview.preview(L.get(n));
    const ctx = $('menu-bg').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(preview.renderPreview(false), 0, 0);
  }
  $('b-journey').onclick = () => { playersWanted = 1; goJourney(); };
  $('b-coop').onclick = () => { playersWanted = 2; goJourney(); gtoast(ICON.p2, 'لاعبان معاً', 'اختارا مرحلة، وكل واحد يمسك جهة من الشاشة'); };
  $('b-daily').onclick = () => openBrief(L.daily(), 'daily');
  $('b-souq').onclick = () => { buildSouq(); show('souq'); };
  $('b-medals').onclick = () => { buildMedals(); show('medals'); };
  $('b-help').onclick = () => { buildHelp(); show('help'); };
  $('b-settings').onclick = openSettings;
  $('b-editor').onclick = () => show('editor');
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => (screen === 'journey' && onlinePick ? NET.open() : goMenu());
  $('b-online').onclick = () => { TB.audio.init(); NET.open(); };

  // ---------- install ----------
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('b-install').hidden = false; $('install-note').hidden = true; });
  $('b-install').onclick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* dismissed */ }
    installPrompt = null; $('b-install').hidden = true;
  };
  if (!standalone && isAndroid) $('install-note').hidden = false;
  if (isAndroid && !standalone && window.fetch) {
    fetch(APK_RELEASE).then(r => (r.ok ? r.json() : null)).then(rel => {
      const apk = rel && (rel.assets || []).find(a => /\.apk$/.test(a.name));
      if (apk) { $('b-apk').href = apk.browser_download_url; $('b-apk').hidden = false; }
    }).catch(() => {});
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !isApp) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- journey ----------
  const thumbCache = {};
  function mapURL(stage) {
    const key = stage.n + stage.region;
    if (!thumbCache[key]) {
      preview.preview(stage);
      const c = document.createElement('canvas'); c.width = c.height = 208;
      c.getContext('2d').drawImage(preview.renderPreview(false), 0, 0);
      thumbCache[key] = c.toDataURL();
    }
    return thumbCache[key];
  }
  function buildJourney() {
    $('j-stars').textContent = fmt(totalStars());
    $('j-coins').textContent = fmt(save.dirhams);
    const box = $('regions');
    box.textContent = '';
    L.REGION_ORDER.forEach((region, r) => {
      const info = L.REGIONS[region], card = el('div', 'region');
      card.append(img(mapURL(L.get(r * 4 + 1)), 'bgmap'));
      const head = el('header');
      const name = el('div');
      name.append(el('b', null, info.name), document.createTextNode(' '), el('small', null, MAQAM_NAME[info.maqam]));
      const got = [1, 2, 3, 4].reduce((a, i) => a + (save.stars[r * 4 + i] || 0), 0);
      const pill = el('span', 'pill'); pill.append(el('i', 'star'), document.createTextNode(fmt(got) + ' / ' + fmt(12)));
      head.append(name, pill);
      const nodes = el('div', 'nodes');
      for (let i = 1; i <= 4; i++) {
        const n = r * 4 + i, st = L.get(n), locked = n > save.unlocked;
        const b = el('button', 'node' + (st.mission === 'boss' ? ' boss' : '') + (n === save.unlocked && !save.stars[n] ? ' next' : ''));
        b.disabled = locked;
        const disc = el('div', 'disc');
        disc.append(img(MISSION_ICON[st.mission]), el('span', 'num', fmt(n)));
        b.append(disc, el('div', 'name', st.name), starRow(save.stars[n] || 0));
        b.onclick = () => openBrief(st, 'campaign');
        nodes.append(b);
      }
      card.append(head, nodes);
      box.append(card);
    });
    const endless = $('b-endless');
    endless.hidden = save.unlocked <= L.count;
    if (!endless.hidden) {
      const n = Math.max(L.count + 1, save.unlocked);
      endless.textContent = 'ما بعد الرحلة: الساحة ' + fmt(n - L.count);
      endless.onclick = () => openBrief(L.get(n), 'endless');
    }
  }

  // ---------- briefing ----------
  let pending = null;
  function goalText(st) {
    const p = st.params || {}, d = TB.consts.DIFF[settings.difficulty] || TB.consts.DIFF.normal;
    const count = ch => st.rows.join('').split(ch).length - 1;
    switch (st.mission) {
      case 'defend': return 'دمّر ' + fmt(Math.round((p.enemies || 20) * (playersWanted === 2 ? 1.25 : 1))) + ' مركبة واحمِ البئر';
      case 'collect': { const total = count('Q'); return 'اجمع ' + fmt(Math.max(1, total - d.skinAllow)) + ' من ' + fmt(total) + ' قِرَب قبل العقارب'; }
      case 'towers': return 'اهدم ' + fmt(count('T')) + ' أبراج للعقارب';
      case 'escort': return 'أوصل ' + fmt(Math.min(p.camels || 3, d.camels)) + ' من ' + fmt(p.camels || 3) + ' جمال إلى الطرف الآخر';
      case 'survive': return 'اصمد ' + fmt(Math.round((p.seconds || 90) * d.timeMul)) + ' ثانية حتى يطلع الفجر';
      case 'boss': return 'دمّر القلعة المتحركة واحمِ البئر';
    }
    return '';
  }
  function openBrief(stage, mode) {
    pending = { stage, mode };
    $('portrait').src = ICON.commander;
    const info = L.REGIONS[stage.region];
    $('br-where').textContent = info.name + ' · ' + MAQAM_NAME[info.maqam];
    $('br-title').textContent = mode === 'daily' ? 'تحدي اليوم' : mode === 'custom' ? 'خريطتي' : (mode === 'endless' ? 'الساحة ' + fmt(stage.n - L.count) : 'المرحلة ' + fmt(stage.n)) + ': ' + stage.name;
    const tags = $('br-tags');
    tags.textContent = '';
    for (const t of [L.MISSIONS[stage.mission].name, TIME_NAME[stage.time], { easy: 'سهل', normal: 'عادي', hard: 'صعب' }[settings.difficulty]]) tags.append(el('span', 'tag', t));
    $('br-say').textContent = '«' + stage.brief + '»';
    $('br-goal').textContent = goalText(stage);
    preview.preview(stage);
    const mc = $('br-map').getContext('2d');
    mc.imageSmoothingEnabled = false;
    mc.drawImage(preview.renderPreview(), 0, 0);
    const best = $('br-best');
    best.textContent = '';
    if (mode === 'daily') {
      const b = save.dailyBest[stage.daily];
      best.append(el('span', 'tag', b ? 'أفضل نتيجة اليوم: ' + fmt(b) : 'تحدٍّ جديد كل يوم'));
    } else if (save.best[stage.n]) {
      best.append(starRow(save.stars[stage.n] || 0), el('span', 'tag', 'أفضل نتيجة: ' + fmt(save.best[stage.n])));
    }
    renderPlayers();
    $('br-players').hidden = NET.active;
    if (NET.active) $('br-goal').textContent = goalText(stage) + ' · ' + fmt(NET.players.length) + ' لاعبين';
    $('briefing').hidden = false;
  }
  function renderPlayers() { for (const b of $('br-players').children) b.setAttribute('aria-pressed', String(+b.dataset.v === playersWanted)); }
  $('br-players').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    playersWanted = +b.dataset.v;
    renderPlayers();
    if (pending) $('br-goal').textContent = goalText(pending.stage);
  });
  $('br-back').onclick = () => { $('briefing').hidden = true; };
  $('br-start').onclick = () => { $('briefing').hidden = true; if (hosting()) NET.hostStart(pending); else startStage(pending); };
  $('briefing').addEventListener('click', e => { if (e.target === $('briefing')) $('briefing').hidden = true; });

  // ---------- settings ----------
  const SEGS = [['s-diff', 'difficulty'], ['s-pad', 'pad'], ['s-digits', 'digits'], ['s-move', 'move'], ['s-tiltsens', 'tiltSens']];
  const TOGGLES = [['s-sound', 'sound'], ['s-music', 'music'], ['s-engine', 'engine'], ['s-vibrate', 'vibrate'], ['s-lefty', 'lefty'], ['s-full', 'full']];
  function renderSettings() {
    for (const [id, key] of SEGS) for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.v === settings[key]));
    for (const [id, key] of TOGGLES) $(id).setAttribute('aria-pressed', String(!!settings[key]));
    $('s-tilt-row').hidden = settings.move !== 'tilt';
  }
  function applySettings() {
    TB.audio.setSfx(settings.sound);
    TB.audio.setMusic(settings.music);
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
    applySettings(); hud = {};
    if (screen === 'play') { configureControls(); resetInput(); }
    layout();
    if (screen === 'menu') refreshMenu();
    if (screen === 'journey') buildJourney();
  }
  for (const [id, key] of SEGS) {
    $(id).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      settings[key] = b.dataset.v;
      renderSettings(); applySettings(); layout();
      if (key === 'move' && b.dataset.v === 'tilt') {
        enableTilt().then(ok => {
          if (ok) { toast('أمِل الجوال لتتحرك الدبابة'); return; }
          settings.move = 'pad';
          renderSettings();
          gtoast(ICON.lantern, 'لا نجد حسّاس الحركة', 'جهازك لا يسمح بقراءة الإمالة، فبقيت لوحة الاتجاهات');
        });
      }
    });
  }
  for (const [id, key] of TOGGLES) {
    $(id).onclick = () => {
      settings[key] = !settings[key];
      renderSettings(); applySettings(); layout();
      if (key === 'sound' && settings.sound) { TB.audio.init(); TB.audio.play('coin'); }
      if (key === 'vibrate' && settings.vibrate && navigator.vibrate) navigator.vibrate(40);
    };
  }
  document.querySelector('#settings [data-close]').onclick = closeSettings;
  $('settings').addEventListener('click', e => { if (e.target === $('settings')) closeSettings(); });

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
    const MISSION_HELP = {
      defend: 'دمّر كل المركبات المهاجمة واحمِ البئر.', collect: 'اجمع قِرَب الماء قبل أن يسرقها العقارب.',
      towers: 'اهدم أبراج العقارب التي تخرج منها مركباتهم.', escort: 'احمِ القافلة حتى تعبر الخريطة.',
      survive: 'ليل مظلم: اصمد حتى الفجر، والفوانيس تضيء الطريق.', boss: 'دمّر القلعة المتحركة العملاقة.',
    };
    for (const m in MISSION_HELP) $('help-missions').append(item(MISSION_ICON[m], L.MISSIONS[m].name, MISSION_HELP[m]));
    const TERRAIN = [[1, 'جدار طين', 'يتهدّم بالقذائف'], [2, 'حجر القلاع', 'لا يُكسر إلا بمدفع من ثلاث نجوم'], [3, 'ماء الواحة', 'يمنع الدبابات وتعبره القذائف'],
      [4, 'نخيل', 'يخفي ما تحته'], [5, 'كثبان', 'تُبطئ الدبابات'], [6, 'رمال متحركة', 'تعلق فيها الدبابة لحظات']];
    for (const [type, name, text] of TERRAIN) $('help-terrain').append(item(V('terrain:' + type), name, text));
    const C = TB.consts;
    const FOE_HELP = ['سريع لكنه ضعيف', 'يطلق رشقتين متتاليتين', 'تقذف من فوق الجدران؛ ابتعد عن الدائرة الحمراء', 'يزرع ألغاماً خلفه؛ دمّرها بقذيفة', 'مدرّع ثقيل يحتاج ٤ إصابات'];
    C.ENEMY.forEach((e, k) => $('help-foes').append(item(V('vehicle:' + e.design + ':enemy'), e.name, FOE_HELP[k] + ' · ' + fmt(e.score) + ' نقطة')));
    $('help-foes').append(item(ICON.boss, C.BOSS.name, 'زعيم ضخم بثلاثة مدافع وقذائف'));
    for (const k of Object.keys(PU_INFO)) $('help-items').append(item(ICON.pu[k], PU_INFO[k][0], PU_INFO[k][1]));
  }

  // ---------- souq ----------
  const WARES = [
    { id: 'armor', name: 'الدرع', desc: 'نقطة صحة إضافية لدبابتك في كل معركة.', icon: ICON.pu.shield, max: 3, price: l => [250, 500, 900][l] },
    { id: 'cannon', name: 'المدفع', desc: 'تبدأ كل معركة بمدفع أقوى درجة.', icon: ICON.pu.hammer, max: 2, price: l => [400, 900][l] },
    { id: 'engine', name: 'المحرك', desc: 'دبابتك أسرع بعشرة في المئة لكل درجة.', icon: ICON.engine, max: 3, price: l => [200, 450, 800][l] },
    { id: 'falcon', name: 'الصقر', desc: 'استدعِه بزر الصقر في أي معركة لينقضّ على ثلاثة أعداء.', icon: ICON.falcon, max: 3, price: () => 150 },
  ];
  const THANKS = ['بارك الله لك يا حارس!', 'صفقة رابحة!', 'هذه من أجود ما عندي.', 'الواحة أقوى بك!'];
  $('merchant-img').src = ICON.pu.coffee;
  function buildSouq() {
    $('s-coins').textContent = fmt(save.dirhams);
    const box = $('shop');
    box.textContent = '';
    for (const w of WARES) {
      const level = w.id === 'falcon' ? save.falcons : save.upg[w.id];
      const card = el('div', 'ware'), head = el('header'), t = el('div');
      t.append(el('b', null, w.name), el('p', null, w.desc));
      head.append(img(w.icon), t);
      const pips = el('div', 'pips');
      for (let i = 0; i < w.max; i++) pips.append(el('i', i < level ? 'on' : ''));
      const done = level >= w.max, price = done ? 0 : w.price(level);
      const btn = el('button', 'btn' + (done || save.dirhams < price ? ' ghost' : ''));
      btn.textContent = done ? (w.id === 'falcon' ? 'معك ثلاثة صقور' : 'اكتملت الدرجات') : 'اشترِ · ' + fmt(price) + ' درهم';
      btn.disabled = done || save.dirhams < price;
      btn.onclick = () => {
        if (save.dirhams < price) return;
        save.dirhams -= price;
        if (w.id === 'falcon') save.falcons++; else save.upg[w.id]++;
        save.stats.buys++;
        persist();
        TB.audio.init(); TB.audio.play('coin');
        $('merchant-say').textContent = THANKS[Math.floor(Math.random() * THANKS.length)];
        checkMedals(null);
        buildSouq();
      };
      card.append(head, pips, btn);
      box.append(card);
    }
  }

  // ---------- medals ----------
  const MEDALS = [
    { id: 'first', name: 'أول نصر', desc: 'افز بأي مرحلة', icon: ICON.well, test: c => c.r && c.r.won },
    { id: 'hunter', name: 'صائد العقارب', desc: 'دمّر مئة مركبة', icon: ICON.foe, test: () => save.stats.kills >= 100 },
    { id: 'keeper', name: 'حارس البئر', desc: 'افز بمهمة دون أن يُصاب البئر', icon: ICON.well, test: c => c.r && c.r.won && c.r.stage.well && !c.r.stats.wellDamaged },
    { id: 'caravan', name: 'قائد القافلة', desc: 'أوصل القافلة كاملة', icon: ICON.camel, test: c => c.r && c.r.won && c.r.mission === 'escort' && c.r.stats.camelsLost === 0 },
    { id: 'towers', name: 'هادم الأبراج', desc: 'اهدم عشرة أبراج', icon: ICON.tower, test: () => save.stats.towers >= 10 },
    { id: 'night', name: 'ابن الليل', desc: 'اصمد حتى الفجر في مرحلة ليلية', icon: ICON.lantern, test: c => c.r && c.r.won && c.r.stage.time === 'night' },
    { id: 'boss', name: 'قاهر القلعة', desc: 'دمّر قلعة متحركة', icon: ICON.boss, test: () => save.stats.bosses >= 1 },
    { id: 'falconer', name: 'الصقّار', desc: 'أطلق الصقر عشر مرات', icon: ICON.falcon, test: () => save.stats.falcon >= 10 },
    { id: 'merchant', name: 'تاجر السوق', desc: 'اشترِ من السوق خمس مرات', icon: ICON.pu.coffee, test: () => save.stats.buys >= 5 },
    { id: 'architect', name: 'المهندس', desc: 'العب على خريطة من تصميمك', icon: ICON.pu.mason, test: c => c.r && c.r.stage.custom },
    { id: 'duo', name: 'الرفيقان', desc: 'افوزا معاً على جوال واحد', icon: ICON.p2, test: c => c.r && c.r.won && c.r.players === 2 },
    { id: 'daily', name: 'المثابر', desc: 'العب تحدي اليوم في ثلاثة أيام', icon: ICON.pu.dates, test: () => save.stats.daily.length >= 3 },
    { id: 'untouched', name: 'لا يُمَس', desc: 'افز دون أن تُصاب دبابتك', icon: ICON.pu.shield, test: c => c.r && c.r.won && c.r.noDamage },
    { id: 'sniper', name: 'القنّاص', desc: 'دمّر خمس مركبات في عشر ثوانٍ', icon: ICON.pu.hammer, test: c => c.r && c.r.stats.combo },
    { id: 'water', name: 'جامع القِرَب', desc: 'اجمع كل القِرَب في مهمة', icon: ICON.skin, test: c => c.r && c.r.won && c.r.mission === 'collect' && c.r.stats.skinsStolen === 0 && c.r.stats.skinsCollected >= c.r.stage.rows.join('').split('Q').length - 1 },
    { id: 'traveler', name: 'الرحّالة', desc: 'اوصل إلى المدينة القديمة', icon: ICON.lantern, test: () => save.unlocked >= 17 },
    { id: 'hero', name: 'بطل الواحة', desc: 'أكمل الرحلة كلها', icon: ICON.star, test: () => save.unlocked > L.count },
    { id: 'friends', name: 'أصدقاء الواحة', desc: 'افوزوا معاً عبر الإنترنت', icon: ICON.players[2], test: c => c.r && c.r.won && c.r.online },
    { id: 'stars', name: 'نجوم الصحراء', desc: 'اجمع ثلاثين نجمة', icon: ICON.star, test: () => totalStars() >= 30 },
  ];
  function checkMedals(result) {
    const fresh = [];
    for (const m of MEDALS) {
      if (save.medals[m.id]) continue;
      let ok = false;
      try { ok = !!m.test({ r: result }); } catch (e) { ok = false; }
      if (!ok) continue;
      save.medals[m.id] = L.dayKey();
      fresh.push(m);
    }
    if (fresh.length) {
      persist();
      fresh.forEach((m, i) => setTimeout(() => { gtoast(m.icon, 'وسام جديد: ' + m.name, m.desc, true); TB.audio.play('medal'); }, 600 + i * 2600));
    }
    return fresh;
  }
  function medalEl(m, locked) {
    const d = el('div', 'medal' + (locked ? ' locked' : '')), b = el('div', 'badge'), t = el('div');
    b.append(img(m.icon));
    t.append(el('b', null, m.name), el('span', null, m.desc));
    d.append(b, t);
    return d;
  }
  function buildMedals() {
    const box = $('medal-grid');
    box.textContent = '';
    let n = 0;
    for (const m of MEDALS) { const got = !!save.medals[m.id]; n += got; box.append(medalEl(m, !got)); }
    $('medal-count').textContent = fmt(n) + ' / ' + fmt(MEDALS.length);
  }
  let gtTimer = 0;
  function gtoast(icon, title, text, badge) {
    const t = $('gtoast');
    t.textContent = '';
    const holder = badge ? el('div', 'badge') : el('div');
    holder.append(img(icon));
    const body = el('div');
    body.append(el('b', null, title), el('div', null, text));
    t.append(holder, body);
    t.classList.add('show');
    clearTimeout(gtTimer);
    gtTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------- playing a stage ----------
  function enterFullscreen() {
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;
    root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
  function startStage(p, extra) {
    extra = extra || {};
    TB.audio.init();
    applySettings();
    if (settings.full && touch && !standalone) enterFullscreen();
    run = p;
    myPid = extra.myPid || 0;
    names = extra.names || null;
    game.start({
      stage: p.stage, difficulty: extra.difficulty || settings.difficulty, players: extra.players || playersWanted,
      upgrades: save.upg, playerUpgrades: extra.playerUpgrades, falcons: extra.falcons || save.falcons,
    });
    game.remote = !!extra.remote;
    game.logCells = hosting();
    hideOverlays();
    paused = false;
    configureControls();
    resetInput();
    hud = {};
    buildPlayerChips();
    show('play');
    curtain();
    musicKey = '';
    musicFor('play');
  }
  function curtain() {
    const c = $('curtain'), st = game.stage;
    $('c-title').textContent = run.mode === 'daily' ? 'تحدي اليوم' : run.mode === 'custom' ? 'خريطتي' : st.name;
    $('c-sub').textContent = L.REGIONS[st.region].name + ' · ' + L.MISSIONS[st.mission].name;
    $('banner').classList.remove('rise');
    c.classList.remove('open');
    c.hidden = false;
    clearTimeout(curtainTimer);
    curtainTimer = setTimeout(() => {
      c.classList.add('open');
      calibrate();
      if (!game.remote) game.begin();
      curtainTimer = setTimeout(() => { c.hidden = true; }, 500);
    }, 1500);
  }
  function pause(on) {
    if (screen !== 'play' || game.state === 'ended' || open('result') || open('over')) return;
    // A guest can't stop the host's battle: the menu opens while the fight goes on
    if (!guest()) paused = on;
    $('pause').hidden = !on;
    resetInput();
    $('b-restart').hidden = guest();
    $('b-pset').hidden = guest();
    $('b-resume').textContent = guest() ? 'عُد إلى المعركة' : 'أكمل المعركة';
    $('b-quit').textContent = guest() ? 'اخرج من الغرفة' : hosting() ? 'عُد إلى الغرفة' : 'الخروج إلى الرحلة';
    if (hosting()) NET.setPause(on);
    if (on) {
      TB.audio.play('pause');
      if (!guest()) { TB.audio.engine('off'); TB.audio.stopMusic(); musicKey = ''; }
      $('pause-info').textContent = guest() ? 'المعركة مستمرة عند أصدقائك' : game.stage.name + ' · النقاط ' + fmt(game.score);
    } else {
      calibrate();
      if (!guest()) musicFor('play');
    }
  }
  function remotePause(on) {
    if (screen !== 'play') return;
    if (on) {
      $('pause').hidden = false;
      $('b-restart').hidden = true; $('b-pset').hidden = true; $('b-resume').hidden = true;
      $('b-quit').textContent = 'اخرج من الغرفة';
      $('pause-info').textContent = 'أوقف المضيف المعركة مؤقتاً…';
    } else {
      $('pause').hidden = true; $('b-resume').hidden = false;
    }
  }
  $('b-pause').onclick = () => pause(true);
  $('b-resume').onclick = () => pause(false);
  $('b-restart').onclick = () => (hosting() ? NET.hostStart(run) : startStage(run));
  $('b-pset').onclick = openSettings;
  $('b-quit').onclick = () => (guest() ? NET.leave(false) : goJourney());

  function dyingBanner(data) {
    const why = { well: 'سقط البئر!', lives: 'نفدت الدبابات!', camels: 'ضاعت القافلة!', skins: 'سُرقت القِرَب!' }[data.reason] || '';
    $('banner').textContent = why;
    $('banner').classList.add('rise');
    TB.audio.engine('off');
  }
  const powerupToast = type => { if (TOAST[type]) toast(TOAST[type], ICON.pu[type]); };
  function onGameEvent(name, data) {
    if (hosting() && ['dying', 'toast', 'powerup'].includes(name)) NET.capture(name, data);
    if (name === 'dying') dyingBanner(data);
    else if (name === 'gameover' || name === 'clear') {
      if (hosting()) { data.online = true; NET.hostEnd(data); }
      if (name === 'gameover') setTimeout(() => showOver(data), 250); else setTimeout(() => showResult(data), 150);
    } else if (name === 'powerup') powerupToast(data);
    else if (name === 'toast') toast(data);
    else if (name === 'falcons') {
      if (data.pid === myPid) { save.falcons = data.n; persist(); }
      else if (hosting()) NET.capture('falcons', data);
    }
  }
  // A guest gets the end of the battle from the host
  function remoteEnd(r) {
    if (r.won) showResult(r); else { TB.audio.play('over'); showOver(r); }
  }

  function bank(r) {
    save.dirhams += r.coins;
    save.stats.kills += (r.stats.kills || []).reduce((a, b) => a + b, 0);
    save.stats.towers += r.stats.towers;
    save.stats.falcon += r.stats.falconUses;
    save.stats.bosses += r.stats.boss;
    if (run.mode === 'daily' && !save.stats.daily.includes(r.stage.daily)) save.stats.daily.push(r.stage.daily);
  }

  async function showResult(r) {
    if (screen !== 'play') return;
    TB.audio.engine('off');
    TB.audio.stopMusic(); musicKey = '';
    const n = r.stage.n, mode = run.mode;
    // A guest played the host's stage: it earns dirhams and medals, not a place on its own journey
    if ((mode === 'campaign' || mode === 'endless') && !guest()) {
      save.stars[n] = Math.max(save.stars[n] || 0, r.stars);
      save.best[n] = Math.max(save.best[n] || 0, r.score);
      save.unlocked = Math.max(save.unlocked, n + 1);
    }
    if (mode === 'daily' && !guest()) save.dailyBest[r.stage.daily] = Math.max(save.dailyBest[r.stage.daily] || 0, r.score);
    bank(r);
    persist();
    const fresh = checkMedals(r);
    $('r-title').textContent = n === L.count && mode === 'campaign' ? 'اكتملت الرحلة! أنت بطل الواحة' : 'انتصار!';
    const perfect = r.mission === 'escort' ? 'القافلة كاملة' : r.mission === 'collect' ? 'كل القِرَب' : 'البئر سليم';
    const noLoss = r.stats.deaths === 0, mastered = r.stars - 1 - (noLoss ? 1 : 0) > 0;
    $('r-why').textContent = '★ الفوز · ' + (noLoss ? '★' : '☆') + ' دون خسارة دبابة · ' + (mastered ? '★' : '☆') + ' ' + perfect;
    $('r-score').textContent = fmt(r.score);
    const earned = $('r-earned');
    earned.textContent = '';
    const coins = el('span', 'pill'); coins.append(el('i', 'coin'), document.createTextNode('+' + fmt(r.coins) + ' درهم'));
    earned.append(coins);
    const box = $('r-medals');
    box.textContent = '';
    for (const m of fresh) box.append(medalEl(m, false));
    const next = (mode === 'campaign' || mode === 'endless') && !guest();
    $('r-next').hidden = !next;
    $('r-retry').hidden = guest();
    $('r-next').textContent = mode === 'campaign' && n === L.count ? 'إلى ما بعد الرحلة' : 'المرحلة التالية';
    $('r-map').textContent = guest() ? 'اخرج من الغرفة' : hosting() ? 'عُد إلى الغرفة' : mode === 'custom' ? 'المصمّم' : mode === 'daily' ? 'القائمة' : 'الرحلة';
    if (guest()) $('r-why').textContent += ' · بانتظار المضيف ليختار ما بعدها';
    const stars = [...document.querySelectorAll('#result .result-stars .star')];
    stars.forEach(s => s.classList.remove('on'));
    $('result').hidden = false;
    for (let i = 0; i < r.stars; i++) { await wait(320); stars[i].classList.add('on'); TB.audio.play('coin'); }
  }
  const backFromBattle = () => {
    if (guest()) NET.leave(false);
    else if (hosting()) goJourney();
    else if (run.mode === 'custom') { hideOverlays(); game.state = 'idle'; show('editor'); }
    else if (run.mode === 'daily') goMenu();
    else goJourney();
  };
  $('r-next').onclick = () => { const n = run.stage.n + 1; $('result').hidden = true; openBrief(L.get(n), n > L.count ? 'endless' : 'campaign'); };
  $('r-retry').onclick = () => (hosting() ? NET.hostStart(run) : startStage(run));
  $('r-map').onclick = backFromBattle;

  function showOver(r) {
    if (screen !== 'play') return;
    TB.audio.stopMusic(); musicKey = '';
    TB.audio.play('over');
    bank(r);
    persist();
    checkMedals(r);
    $('o-reason').textContent = { well: 'سقط البئر في يد العقارب.', lives: NET.active ? 'نفدت دباباتكم.' : 'نفدت دباباتك.', camels: 'لم تصل القافلة.', skins: 'سرق العقارب القِرَب.' }[r.reason] || '';
    $('o-score').textContent = fmt(r.score);
    const earned = $('o-earned');
    earned.textContent = '';
    const coins = el('span', 'pill'); coins.append(el('i', 'coin'), document.createTextNode('+' + fmt(r.coins) + ' درهم'));
    if (r.coins > 0) earned.append(coins);
    const TIPS = [
      'اشترِ من السوق درعاً أقوى أو صقراً قبل أن تعود.', 'قِربة الماء ترمّم البئر، والبنّاء يحيطه بالحجر.', 'ابقَ قريباً من البئر حين يكثر الأعداء.',
      'الدائرة الحمراء تعني قذيفة مدفعية قادمة: ابتعد عنها.', 'الصقر يدمّر أقرب ثلاثة أعداء دفعة واحدة.', 'جرّب الصعوبة «سهل» من الإعدادات.',
    ];
    $('o-tip').textContent = 'نصيحة: ' + TIPS[Math.floor(Math.random() * TIPS.length)];
    $('o-map').textContent = guest() ? 'اخرج من الغرفة' : hosting() ? 'عُد إلى الغرفة' : run.mode === 'custom' ? 'المصمّم' : 'الرحلة';
    $('o-retry').hidden = guest();
    $('o-souq').hidden = NET.active;
    if (guest()) $('o-tip').textContent = 'بانتظار المضيف ليبدأ جولة جديدة…';
    $('over').hidden = false;
  }
  $('o-retry').onclick = () => (hosting() ? NET.hostStart(run) : startStage(run));
  $('o-souq').onclick = () => { hideOverlays(); game.state = 'idle'; buildSouq(); show('souq'); };
  $('o-map').onclick = backFromBattle;

  let toastTimer = 0;
  function toast(text, icon) {
    const t = $('toast');
    t.textContent = '';
    if (icon) t.append(img(icon));
    t.append(el('span', null, text));
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  // ---------- HUD ----------
  $('ico-well').src = ICON.well; $('ico-boss').src = ICON.boss;
  $('ico-falcon').src = ICON.falcon; $('ico-falcon2').src = ICON.falcon;
  let hud = {};
  function pips(box, n, max) {
    if (box.children.length !== max) { box.textContent = ''; for (let i = 0; i < max; i++) box.append(el('i')); }
    [...box.children].forEach((p, i) => p.classList.toggle('on', i < n));
  }
  let chips = [];
  function buildPlayerChips() {
    const box = $('h-players');
    box.textContent = '';
    chips = game.players.map((pl, i) => {
      const c = el('div', 'chip' + (NET.active && i === myPid ? ' me' : ''));
      const lives = el('b'), hp = el('div', 'hp'), lvl = el('div', 'lvl');
      for (let k = 0; k < 3; k++) lvl.append(el('i'));
      c.append(img(ICON.players[i]));
      if (names) c.append(el('span', 'nm', i === myPid ? 'أنت' : names[i] || ''));
      c.append(lives, hp, lvl);
      box.append(c);
      return { c, lives, hp, lvl };
    });
  }
  function updateHud() {
    const set = (key, value, fn) => { if (hud[key] !== value) { hud[key] = value; fn(value); } };
    const st = game.stage;
    set('stage', run.mode + st.n + st.region, () => {
      $('ico-region').src = ICON.region[st.region];
      $('h-stage').textContent = run.mode === 'daily' ? 'اليوم' : run.mode === 'custom' ? 'خريطتي' : run.mode === 'endless' ? 'ساحة ' + fmt(st.n - L.count) : fmt(st.n);
    });
    game.players.forEach((pl, i) => {
      const t = pl.tank, chip = chips[i], max = t ? t.max : 3 + ((pl.upg && pl.upg.armor) || 0);
      if (!chip) return;
      set('p' + i, [pl.lives, t ? t.hp : 0, max, pl.level, names && names[i]].join(), () => {
        chip.lives.textContent = fmt(Math.max(0, pl.lives));
        pips(chip.hp, t ? Math.max(0, t.hp) : 0, max);
        [...chip.lvl.children].forEach((s, j) => s.classList.toggle('on', j < pl.level));
        chip.c.classList.toggle('gone', pl.lives <= 0 && !t);
      });
    });
    set('score', game.score, v => { $('h-score').textContent = fmt(v); });
    const obj = game.objective();
    set('obj', obj.icon + obj.value + '/' + obj.max, () => {
      $('h-obj').hidden = obj.icon === 'boss';
      $('h-obj-ico').src = OBJ_ICON[obj.icon];
      $('h-obj-label').textContent = obj.label;
      $('h-obj-val').textContent = obj.time ? fmt(Math.floor(obj.value / 60)) + ':' + fmt(String(obj.value % 60).padStart(2, '0')) : obj.max ? fmt(obj.value) + '/' + fmt(obj.max) : fmt(obj.value);
      $('h-boss').hidden = obj.icon !== 'boss';
      if (obj.icon === 'boss') $('h-bossbar').style.width = Math.max(0, 100 * obj.value / obj.max) + '%';
    });
    const w = game.well;
    set('well', w ? w.hp + '/' + w.max : 'none', () => {
      $('h-well').hidden = !w;
      if (w) pips($('h-wellhp'), Math.max(0, w.hp), w.max);
    });
    const local2 = game.nPlayers === 2 && !NET.active, falcons = game.falconsOf(myPid);
    const canFalcon = falcons > 0 && game.state === 'play' && game.tanks.some(t => t.team === 'e');
    set('falcon', falcons + '' + canFalcon + local2, () => {
      $('h-falcons').textContent = fmt(falcons);
      $('h-falcons2').textContent = fmt(falcons);
      $('b-falcon').disabled = !canFalcon;
      $('b-falcon').hidden = local2 || (falcons === 0 && save.falcons === 0);
      $('h-falcon2').hidden = !local2 || falcons === 0;
    });
  }
  const callFalcon = () => {
    TB.audio.init();
    if (guest()) { if (game.falconsOf(myPid) > 0) NET.clientFalcon(); else TB.audio.play('wall'); return; }
    if (!game.useFalcon(myPid)) TB.audio.play('wall');
  };
  $('b-falcon').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); callFalcon(); });
  $('h-falcon2').onclick = callFalcon;

  // ---------- layout and drawing ----------
  const border = document.createElement('canvas');
  border.width = border.height = 224;
  (() => {
    const g = border.getContext('2d');
    g.fillStyle = g.createPattern(fx.frame, 'repeat');
    g.fillRect(0, 0, 224, 224);
    g.fillStyle = '#F2B134';
    g.fillRect(6, 6, 212, 1); g.fillRect(6, 217, 212, 1); g.fillRect(6, 6, 1, 212); g.fillRect(217, 6, 1, 212);
  })();
  function fit(box, canvas, size) {
    box.style.width = box.style.height = size + 'px';
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.max(224, Math.round(size * dpr));
  }
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight, land = vw >= vh;
    const pad = { s: 120, m: 150, l: 180 }[settings.pad] || 150;
    if (screen === 'play') {
      const play = $('play');
      play.classList.toggle('port', !land);
      $('rotate').hidden = land || game.nPlayers !== 2;
      const cs = getComputedStyle(play);
      const w = vw - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = vh - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      let size;
      if (land) {
        const side = Math.max((game.nPlayers === 2 ? 140 : pad) + 14, Math.min(w * 0.25, 250));
        size = Math.min(h, w - side * 2 - 20);
      } else size = Math.min(w, h - 60 - Math.max(pad + 40, 210));
      fit($('field'), $('cv'), Math.max(180, Math.floor(size)));
      draw();
    } else if (screen === 'editor') {
      const ed = $('editor');
      ed.classList.toggle('port', !land);
      const size = land ? Math.min(vh - 28, vw - 370) : Math.min(vw - 32, vh - 380);
      $('board').style.width = $('board').style.height = Math.max(180, Math.floor(size)) + 'px';
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      $('ecv').width = $('ecv').height = Math.max(208, Math.round(Math.max(180, Math.floor(size)) * dpr));
      drawEditor();
    }
  }
  window.addEventListener('resize', layout);
  document.addEventListener('fullscreenchange', layout);

  const cvx = $('cv').getContext('2d');
  function draw() {
    const c = $('cv'), s = c.width / 224;
    cvx.imageSmoothingEnabled = false;
    cvx.drawImage(border, 0, 0, c.width, c.height);
    cvx.drawImage(game.render(), 8 * s, 8 * s, 208 * s, 208 * s);
    if (names) {
      cvx.font = '800 ' + Math.round(6 * s) + 'px ' + getComputedStyle(document.body).fontFamily;
      cvx.textAlign = 'center';
      cvx.lineJoin = 'round';
      cvx.lineWidth = Math.max(2, s * 1.2);
      cvx.strokeStyle = 'rgba(10,16,30,.85)';
      game.players.forEach((pl, i) => {
        const t = pl.tank;
        if (!t) return;
        const text = i === myPid ? 'أنت' : names[i] || '';
        cvx.fillStyle = PLAYER_COLORS[i];
        cvx.strokeText(text, (8 + t.x + 8) * s, (8 + t.y - 3) * s);
        cvx.fillText(text, (8 + t.x + 8) * s, (8 + t.y - 3) * s);
      });
    }
    if (!game.popups.length) return;
    cvx.font = '900 ' + Math.round(7.5 * s) + 'px ' + getComputedStyle(document.body).fontFamily;
    cvx.textAlign = 'center';
    cvx.lineJoin = 'round';
    cvx.lineWidth = Math.max(2, s * 1.4);
    cvx.strokeStyle = '#2A1800';
    cvx.fillStyle = '#FFF3C4';
    for (const p of game.popups) {
      cvx.globalAlpha = Math.max(0, 1 - p.t / 50);
      const x = (8 + p.x) * s, y = (8 + p.y - p.t * 0.3) * s, text = fmt(p.text);
      cvx.strokeText(text, x, y);
      cvx.fillText(text, x, y);
    }
    cvx.globalAlpha = 1;
  }

  // ---------- input ----------
  const PAD_SVG = '<svg viewBox="-80 -80 160 160" aria-hidden="true"><circle class="hub" r="74" opacity=".35"/>' +
    '<path class="arm" data-d="0" d="M-22,-8 L-22,-62 Q-22,-70 -14,-70 L14,-70 Q22,-70 22,-62 L22,-8 L0,12 Z"/><path class="arr" d="M0,-58 L11,-42 L-11,-42 Z"/>' +
    '<path class="arm" data-d="1" d="M8,-22 L62,-22 Q70,-22 70,-14 L70,14 Q70,22 62,22 L8,22 L-12,0 Z"/><path class="arr" d="M58,0 L42,11 L42,-11 Z"/>' +
    '<path class="arm" data-d="2" d="M-22,8 L-22,62 Q-22,70 -14,70 L14,70 Q22,70 22,62 L22,8 L0,-12 Z"/><path class="arr" d="M0,58 L11,42 L-11,42 Z"/>' +
    '<path class="arm" data-d="3" d="M-8,-22 L-62,-22 Q-70,-22 -70,-14 L-70,14 Q-70,22 -62,22 L-8,22 L12,0 Z"/><path class="arr" d="M-58,0 L-42,11 L-42,-11 Z"/>' +
    '<circle class="hub" r="18"/></svg>';
  // A thumbstick like a game controller's: the cap follows the thumb in any direction
  const STICK_SVG = k => '<svg viewBox="-80 -80 160 160" aria-hidden="true"><defs>' +
    '<radialGradient id="ske' + k + '" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#55648A"/><stop offset=".55" stop-color="#28324D"/><stop offset="1" stop-color="#121827"/></radialGradient>' +
    '<radialGradient id="skt' + k + '" cx=".5" cy=".62" r=".7"><stop offset="0" stop-color="#1A2236"/><stop offset="1" stop-color="#3A4766"/></radialGradient></defs>' +
    '<circle class="base" r="74"/><circle class="ring" r="48"/>' +
    '<path class="arr" data-d="0" d="M0,-70 L9,-59 L-9,-59 Z"/><path class="arr" data-d="1" d="M70,0 L59,9 L59,-9 Z"/>' +
    '<path class="arr" data-d="2" d="M0,70 L9,59 L-9,59 Z"/><path class="arr" data-d="3" d="M-70,0 L-59,9 L-59,-9 Z"/>' +
    '<g class="knob"><circle r="32" cy="6" fill="rgba(0,0,0,.35)"/><circle r="31" fill="url(#ske' + k + ')" stroke="#0B1020" stroke-width="2"/>' +
    '<circle r="23" fill="url(#skt' + k + ')"/><circle r="23" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5" stroke-dasharray="1.5 4"/>' +
    '<path d="M-21,-12 A24,24 0 0 1 -6,-23" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none" stroke-linecap="round"/></g></svg>';
  const STICK_TRAVEL = 46; // how far the cap can leave the center, in the stick's 160-unit drawing
  function padStyle() {
    const kind = settings.move === 'stick' ? 'stick' : 'pad';
    for (const d of document.querySelectorAll('.dpad')) {
      if (d.dataset.kind === kind) continue;
      d.dataset.kind = kind;
      d.innerHTML = kind === 'stick' ? STICK_SVG(d.dataset.pad) : PAD_SVG;
      d.classList.toggle('stick', kind === 'stick');
    }
  }
  padStyle();
  // Pushed between two directions: the other direction counts too when it's clearly part of the push
  function secondDir(dx, dy, d) {
    if (d < 0) return -1;
    const major = d & 1 ? Math.abs(dx) : Math.abs(dy), minor = d & 1 ? dy : dx;
    if (Math.abs(minor) < major * 0.42) return -1;
    return d & 1 ? (minor > 0 ? 2 : 0) : (minor > 0 ? 1 : 3);
  }
  const newInput = () => ({ pad: -1, alt: -1, padId: null, anchor: null, rest: null, padEl: null, fires: new Set(), keys: [], keyFire: false, gp: -1, gpAlt: -1, gpFire: false });
  const inputs = [newInput(), newInput()];
  const pointers = new Map();
  const zoneL = $('zoneL'), zoneR = $('zoneR'), fireR = zoneR.querySelector('[data-fire]'), fireL = zoneL.querySelector('[data-fire]'), padR = zoneR.querySelector('.dpad');
  const padL = zoneL.querySelector('.dpad');

  // ---------- tilt: steer by tilting the phone ----------
  const tiltView = $('tiltview');
  tiltView.innerHTML = '<svg viewBox="-80 -80 160 160" aria-hidden="true"><circle class="ring" r="74"/><circle class="dead" r="20"/>' +
    '<path class="arr" data-d="0" d="M0,-68 L13,-51 L-13,-51 Z"/><path class="arr" data-d="1" d="M68,0 L51,13 L51,-13 Z"/>' +
    '<path class="arr" data-d="2" d="M0,68 L13,51 L-13,51 Z"/><path class="arr" data-d="3" d="M-68,0 L-51,13 L-51,-13 Z"/><circle class="dot" r="13"/></svg>';
  const tiltDot = tiltView.querySelector('.dot'), tiltArrows = [...tiltView.querySelectorAll('.arr')];
  const tilt = { raw: null, zero: null, vec: [0, 0], dir: -1, alt: -1, at: -1e9, listening: false };
  const TILT_ON = { low: 0.2, mid: 0.13, high: 0.08 }; // sine of the tilt that starts the tank: about 12°, 7.5° and 4.5°
  const tiltMode = () => settings.move === 'tilt' && !(game.nPlayers === 2 && !NET.active);
  function screenAngle() {
    const o = window.screen.orientation, a = o && typeof o.angle === 'number' ? o.angle : +window.orientation || 0;
    return (((a % 360) + 360) % 360) * Math.PI / 180;
  }
  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    // Which way is downhill across the screen (x to the right, y up), whatever way the phone is turned
    const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180, th = screenAngle();
    const dx = Math.cos(b) * Math.sin(g), dy = -Math.sin(b);
    tilt.raw = [dx * Math.cos(th) - dy * Math.sin(th), dx * Math.sin(th) + dy * Math.cos(th)];
    tilt.at = performance.now();
    if (!tilt.zero) tilt.zero = tilt.raw.slice();
    const vx = tilt.raw[0] - tilt.zero[0], vy = tilt.raw[1] - tilt.zero[1], ax = Math.abs(vx), ay = Math.abs(vy);
    tilt.vec = [vx, vy];
    const on = TILT_ON[settings.tiltSens] || TILT_ON.mid;
    let d = -1;
    // Once moving, the tank keeps going until the phone is nearly back to where it started
    if (Math.max(ax, ay) > (tilt.dir >= 0 ? on * 0.65 : on)) d = ax > ay ? (vx > 0 ? 1 : 3) : (vy > 0 ? 0 : 2);
    if (d >= 0 && tilt.dir >= 0 && (d & 1) !== (tilt.dir & 1) && (tilt.dir & 1 ? ay / Math.max(1e-3, ax) : ax / Math.max(1e-3, ay)) < 1.3) d = tilt.dir;
    tilt.dir = d;
    tilt.alt = secondDir(vx, -vy, d);
  }
  function listenTilt() {
    if (tilt.listening) return;
    tilt.listening = true;
    window.addEventListener('deviceorientation', onOrientation);
  }
  // Whatever way the phone is held now counts as level
  function calibrate() { tilt.zero = tilt.raw ? tilt.raw.slice() : null; tilt.vec = [0, 0]; tilt.dir = -1; tilt.alt = -1; }
  // iPhones ask before sharing the motion sensor, and only after a tap
  async function tiltPermission() {
    const D = window.DeviceOrientationEvent;
    if (!D) return false;
    if (typeof D.requestPermission !== 'function') return true;
    try { return (await D.requestPermission()) === 'granted'; } catch (e) { return false; }
  }
  async function enableTilt() {
    if (!(await tiltPermission())) return false;
    listenTilt();
    const since = performance.now();
    for (let i = 0; i < 15 && tilt.at < since; i++) await wait(100);
    return tilt.at >= since;
  }
  function paintTilt() {
    const on = TILT_ON[settings.tiltSens] || TILT_ON.mid, k = 20 / on;
    let x = tilt.vec[0] * k, y = -tilt.vec[1] * k;
    const m = Math.hypot(x, y);
    if (m > 56) { x *= 56 / m; y *= 56 / m; }
    tiltDot.setAttribute('cx', x.toFixed(1));
    tiltDot.setAttribute('cy', y.toFixed(1));
    for (const a of tiltArrows) a.classList.toggle('on', +a.dataset.d === tilt.dir);
    tiltView.classList.toggle('nosensor', performance.now() - tilt.at > 1500);
  }
  const turned = () => { if (tiltMode()) calibrate(); };
  if (window.screen.orientation && window.screen.orientation.addEventListener) window.screen.orientation.addEventListener('change', turned);
  else window.addEventListener('orientationchange', turned);
  // While steering by tilt, keep the screen from turning when the phone leans far
  function holdOrientation(on) {
    if (window.TankApp && window.TankApp.holdOrientation) { try { window.TankApp.holdOrientation(on); } catch (e) { /* old app */ } return; }
    const o = window.screen.orientation;
    if (!o || !o.lock) return;
    if (on) o.lock(o.type).catch(() => {});
    else { try { o.unlock(); } catch (e) { /* not locked */ } }
  }
  document.addEventListener('fullscreenchange', () => { if (screen === 'play' && tiltMode() && document.fullscreenElement) holdOrientation(true); });
  if (settings.move === 'tilt') {
    listenTilt();
    document.addEventListener('click', () => { tiltPermission(); }, { once: true, capture: true });
  }

  function configureControls() {
    const duo = game.nPlayers === 2 && !NET.active, tilted = tiltMode();
    $('play').classList.toggle('duo', duo);
    padStyle();
    padL.hidden = tilted;
    tiltView.hidden = !tilted;
    $('hint-move').textContent = tilted ? 'أمِل الجوال · المس لضبطها' : 'الحركة';
    if (tilted) { listenTilt(); calibrate(); }
    holdOrientation(tilted);
    fireL.hidden = !duo;
    padR.hidden = !duo;
    fireR.dataset.fire = duo ? '1' : '0';
    fireR.classList.toggle('p2', duo);
  }
  function resetInput() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    for (const st of inputs) {
      st.pad = -1; st.alt = -1; st.padId = null; st.anchor = null; st.fires.clear(); st.keys = []; st.keyFire = false;
      if (st.padEl) { st.padEl.style.transform = ''; st.padEl.classList.remove('float'); knobTo(st.padEl, 0, 0); }
    }
    pointers.clear();
    paintAll();
  }
  function paintAll() {
    for (const d of document.querySelectorAll('.dpad')) {
      const st = inputs[+d.dataset.pad];
      const mine = st.padEl === d;
      d.querySelectorAll('.arm').forEach(a => a.classList.toggle('on', mine && +a.dataset.d === st.pad));
      d.querySelectorAll('.stick .arr').forEach(a => {
        a.classList.toggle('on', mine && +a.dataset.d === st.pad);
        a.classList.toggle('half', mine && +a.dataset.d === st.alt);
      });
    }
    for (const f of document.querySelectorAll('[data-fire]')) {
      const st = inputs[+f.dataset.fire];
      f.classList.toggle('on', st.fires.size > 0 || st.keyFire || st.gpFire);
    }
  }
  const dirOf = i => {
    const st = inputs[i];
    if (st.pad >= 0) return st.pad;
    if (st.keys.length) return st.keys[st.keys.length - 1];
    if (st.gp >= 0) return st.gp;
    return i === 0 && tiltMode() ? tilt.dir : -1;
  };
  // The second direction of a diagonal push, so the tank can slide around corners
  const altOf = i => {
    const st = inputs[i];
    if (st.pad >= 0) return st.alt;
    if (st.keys.length) {
      const d = st.keys[st.keys.length - 1];
      for (let k = st.keys.length - 2; k >= 0; k--) if ((st.keys[k] & 1) !== (d & 1)) return st.keys[k];
      return -1;
    }
    if (st.gp >= 0) return st.gpAlt;
    return i === 0 && tiltMode() ? tilt.alt : -1;
  };
  function knobTo(pad, x, y) {
    const k = pad && pad.querySelector('.knob');
    if (k) k.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
  }
  const fireOf = i => { const st = inputs[i]; return st.fires.size > 0 || st.keyFire || st.gpFire; };
  const inside = (elm, e, slack) => { const r = elm.getBoundingClientRect(); return e.clientX >= r.left - slack && e.clientX <= r.right + slack && e.clientY >= r.top - slack && e.clientY <= r.bottom + slack; };

  function zoneDown(zone, e) {
    if (e.target.closest('#b-falcon')) return;
    e.preventDefault();
    TB.audio.init();
    if (zone === zoneL && !tiltView.hidden) {
      calibrate();
      toast('ضُبطت الإمالة على وضع جوالك الآن');
      vibrate(25);
      return;
    }
    try { zone.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    const duo = game.nPlayers === 2;
    const fire = [...zone.querySelectorAll('[data-fire]')].find(f => !f.hidden);
    const pad = [...zone.querySelectorAll('.dpad')].find(d => !d.hidden);
    // In one-player mode the whole fire side shoots; with two players the fire button is a target of its own
    if (fire && (!pad || (duo && inside(fire, e, 18)))) {
      const pid = +fire.dataset.fire;
      inputs[pid].fires.add(e.pointerId);
      pointers.set(e.pointerId, { type: 'fire', pid });
      paintAll();
      return;
    }
    if (!pad) return;
    const pid = +pad.dataset.pad, st = inputs[pid];
    if (st.padId !== null) return;
    st.padId = e.pointerId; st.padEl = pad;
    pointers.set(e.pointerId, { type: 'pad', pid });
    pad.style.transform = '';
    const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    st.rest = { x: cx, y: cy };
    if (Math.hypot(e.clientX - cx, e.clientY - cy) <= r.width * 0.58) st.anchor = { x: cx, y: cy };
    else {
      st.anchor = { x: e.clientX, y: e.clientY };
      pad.classList.add('float');
      pad.style.transform = 'translate(' + (e.clientX - cx) + 'px,' + (e.clientY - cy) + 'px)';
    }
    padMove(pid, e);
  }
  function padMove(pid, e) {
    const st = inputs[pid], w = st.padEl.offsetWidth || 1, stick = st.padEl.classList.contains('stick');
    let dx = e.clientX - st.anchor.x, dy = e.clientY - st.anchor.y, dist = Math.hypot(dx, dy);
    if (stick) {
      // The stick's base follows a thumb that drifts too far, so it never runs off the stick
      const travel = w * STICK_TRAVEL / 160, slack = travel * 1.35;
      if (dist > slack) {
        const k = (dist - slack) / dist;
        st.anchor.x += dx * k; st.anchor.y += dy * k;
        dx -= dx * k; dy -= dy * k; dist = slack;
        st.padEl.classList.add('float');
        st.padEl.style.transform = 'translate(' + (st.anchor.x - st.rest.x) + 'px,' + (st.anchor.y - st.rest.y) + 'px)';
      }
      const m = Math.min(1, travel / Math.max(1e-6, dist)), u = 160 / w;
      knobTo(st.padEl, dx * m * u, dy * m * u);
    }
    let d = -1;
    if (dist > w * (stick ? 0.075 : 0.1)) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    // Keep the current axis until the other one clearly wins, so diagonals don't flicker
    if (d >= 0 && st.pad >= 0 && (d & 1) !== (st.pad & 1)) {
      const ratio = st.pad & 1 ? Math.abs(dy) / Math.max(1, Math.abs(dx)) : Math.abs(dx) / Math.max(1, Math.abs(dy));
      if (ratio < 1.3) d = st.pad;
    }
    const alt = secondDir(dx, dy, d);
    if (d !== st.pad || alt !== st.alt) { st.pad = d; st.alt = alt; paintAll(); }
  }
  function pointerEnd(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    const st = inputs[p.pid];
    if (p.type === 'fire') st.fires.delete(e.pointerId);
    else if (st.padId === e.pointerId) {
      st.padId = null; st.pad = -1; st.alt = -1; st.anchor = null;
      if (st.padEl) { st.padEl.classList.remove('float'); st.padEl.style.transform = ''; knobTo(st.padEl, 0, 0); }
    }
    paintAll();
  }
  for (const zone of [zoneL, zoneR]) {
    zone.addEventListener('pointerdown', e => zoneDown(zone, e));
    zone.addEventListener('pointermove', e => { const p = pointers.get(e.pointerId); if (p && p.type === 'pad') padMove(p.pid, e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, pointerEnd);
  }
  document.addEventListener('contextmenu', e => { if (screen === 'play' || screen === 'editor') e.preventDefault(); });

  const KEYS = [{ KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 }, { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }];
  const FIRE = [['Space', 'KeyJ', 'KeyK'], ['Enter', 'NumpadEnter', 'Numpad0', 'Slash', 'ShiftRight']];
  function keyOwner(code) {
    for (let i = 0; i < 2; i++) {
      const pid = game.nPlayers === 2 && !NET.active ? i : 0;
      if (KEYS[i][code] !== undefined) return { pid, dir: KEYS[i][code] };
      if (FIRE[i].includes(code)) return { pid, fire: true };
    }
    return null;
  }
  window.addEventListener('keydown', e => {
    if (screen !== 'play') return;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (open('settings')) closeSettings();
      else if (!open('result') && !open('over')) pause(!paused);
      return;
    }
    if (paused || open('result') || open('over')) return;
    if (e.code === 'KeyF') { e.preventDefault(); callFalcon(); return; }
    const k = keyOwner(e.code);
    if (!k) return;
    e.preventDefault();
    TB.audio.init();
    const st = inputs[k.pid];
    if (k.fire) st.keyFire = true;
    else if (!st.keys.includes(k.dir)) st.keys.push(k.dir);
    paintAll();
  });
  window.addEventListener('keyup', e => {
    const k = keyOwner(e.code);
    if (!k) return;
    const st = inputs[k.pid];
    if (k.fire) st.keyFire = false; else st.keys = st.keys.filter(d => d !== k.dir);
    paintAll();
  });
  window.addEventListener('blur', resetInput);

  let gamepads = false;
  const gpPrev = [{}, {}];
  window.addEventListener('gamepadconnected', () => { gamepads = true; });
  function pollGamepads() {
    const pads = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean);
    for (let i = 0; i < 2; i++) {
      const duoPads = game.nPlayers === 2 && !NET.active;
      const gp = pads[i], pid = duoPads ? i : 0, st = inputs[pid];
      if (!gp) { if (i === 0 || game.nPlayers === 2) { st.gp = -1; st.gpFire = false; } continue; }
      const b = k => gp.buttons[k] && gp.buttons[k].pressed;
      let dir = -1, alt = -1;
      const held = [b(12) ? 0 : -1, b(15) ? 1 : -1, b(13) ? 2 : -1, b(14) ? 3 : -1].filter(d => d >= 0);
      if (held.length) {
        dir = held[0];
        alt = held.find(d => (d & 1) !== (dir & 1));
        if (alt === undefined) alt = -1;
      } else {
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        if (Math.max(Math.abs(ax), Math.abs(ay)) > 0.5) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 1 : 3) : (ay > 0 ? 2 : 0);
        alt = secondDir(ax, ay, dir);
      }
      st.gp = dir; st.gpAlt = alt;
      const fire = b(0) || b(1) || b(5) || b(7);
      if (fire !== st.gpFire) { st.gpFire = fire; paintAll(); }
      const prev = gpPrev[i];
      if (b(9) && !prev.start && screen === 'play') pause(!paused);
      if (b(3) && !prev.falcon && screen === 'play' && !paused) callFalcon();
      prev.start = b(9); prev.falcon = b(3);
      if (!duoPads) break;
    }
  }

  // ---------- main loop ----------
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(200, now - last);
    last = now;
    if (gamepads) pollGamepads();
    if (screen !== 'play') return;
    if (game.remote) {
      // A guest only draws what the host sends, and sends back its stick and fire button
      if (guest()) NET.clientFrame(now, dirOf(0), fireOf(0), altOf(0));
    } else if (!paused) {
      acc += dt;
      let n = 0;
      const local = NET.active ? 1 : game.nPlayers;
      while (acc >= STEP && n < 5) {
        for (let i = 0; i < local; i++) { game.inputs[i].dir = dirOf(i); game.inputs[i].alt = altOf(i); game.inputs[i].fire = fireOf(i); }
        game.update();
        acc -= STEP;
        n++;
      }
      if (n === 5) acc = 0;
      if (hosting()) NET.hostFrame();
    } else acc = 0;
    draw();
    updateHud();
    if (!tiltView.hidden) paintTilt();
    const p = game.players && game.players[myPid] && game.players[myPid].tank;
    TB.audio.engine(!paused && game.state === 'play' && p ? (p.moving ? 'move' : 'idle') : 'off');
  }
  requestAnimationFrame(frame);

  // ---------- map editor (26x26 blocks of 8px) ----------
  const BRUSHES = [['#', 1, 'طين'], ['@', 2, 'حجر'], ['~', 3, 'ماء'], ['%', 4, 'نخيل'], ['-', 5, 'كثبان'], ['*', 6, 'رمال متحركة'], ['T', 'tower', 'برج للعقارب'], ['.', 0, 'ممحاة']];
  const emptyMap = () => Array.from({ length: 26 }, () => '.'.repeat(26));
  let edMap = store.get('custom', null);
  if (!Array.isArray(edMap) || edMap.length !== 26) edMap = emptyMap();
  let brush = '#', brushSize = 2, painting = null;
  const protectedBlock = (bx, by) => (by <= 1 && (bx <= 1 || bx === 12 || bx === 13 || bx >= 24)) || (by >= 24 && (bx === 8 || bx === 9 || bx === 16 || bx === 17)) || (by >= 23 && bx >= 11 && bx <= 14);
  const setBlock = (x, y, ch) => { edMap[y] = edMap[y].slice(0, x) + ch + edMap[y].slice(x + 1); };
  function tilesToBlocks(rows) {
    const half = { '[': ['#', 'l'], ']': ['#', 'r'], '^': ['#', 't'], '_': ['#', 'b'], '{': ['@', 'l'], '}': ['@', 'r'], '/': ['@', 't'], '\\': ['@', 'b'] };
    const out = [];
    for (let y = 0; y < 26; y++) {
      let row = '';
      for (let x = 0; x < 26; x++) {
        let ch = rows[y >> 1][x >> 1];
        const h = half[ch], sx = x & 1, sy = y & 1;
        if (ch === 'T') ch = sx || sy ? '.' : 'T';
        else if (ch === 'Q' || ch === 'L') ch = '.';
        else if (ch === 'B') ch = '~';
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
    preview.preview(L.custom(edMap));
    ectx.imageSmoothingEnabled = false;
    ectx.drawImage(preview.renderPreview(), 0, 0, ecv.width, ecv.height);
    ectx.strokeStyle = 'rgba(0,0,0,.14)';
    ectx.lineWidth = 1;
    ectx.beginPath();
    for (let i = 1; i < 13; i++) {
      const p = Math.round(i * ecv.width / 13) + 0.5;
      ectx.moveTo(p, 0); ectx.lineTo(p, ecv.height);
      ectx.moveTo(0, p); ectx.lineTo(ecv.width, p);
    }
    ectx.stroke();
  }
  function blockAt(e) {
    const r = ecv.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / r.width * 26), Math.floor((e.clientY - r.top) / r.height * 26)];
  }
  function paintAt(e) {
    let [bx, by] = blockAt(e);
    if (bx < 0 || by < 0 || bx > 25 || by > 25) return;
    let changed = false;
    if (painting === 'T') {
      bx &= ~1; by &= ~1;
      if ([0, 1].some(dy => [0, 1].some(dx => protectedBlock(bx + dx, by + dy))) || edMap[by][bx] === 'T') return;
      if (edMap.join('').split('T').length - 1 >= 4) { gtoast(ICON.tower, 'أربعة أبراج تكفي', 'امسح برجاً لتضع غيره'); painting = null; return; }
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setBlock(bx + dx, by + dy, '.');
      setBlock(bx, by, 'T');
      changed = true;
    } else {
      if (brushSize === 2) { bx &= ~1; by &= ~1; }
      for (let y = by; y < by + brushSize; y++) {
        for (let x = bx; x < bx + brushSize; x++) {
          if (protectedBlock(x, y) || edMap[y][x] === painting) continue;
          setBlock(x, y, painting);
          changed = true;
        }
      }
    }
    if (changed) { store.set('custom', edMap); drawEditor(); }
  }
  ecv.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { ecv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    const [bx, by] = blockAt(e);
    // Tapping a block that already holds the brush erases it, so mistakes are quick to undo
    painting = edMap[by] && edMap[by][bx] === brush && brush !== '.' ? '.' : brush;
    paintAt(e);
  });
  ecv.addEventListener('pointermove', e => { if (painting && painting !== 'T') paintAt(e); });
  for (const ev of ['pointerup', 'pointercancel']) ecv.addEventListener(ev, () => { painting = null; });
  for (const [ch, type, name] of BRUSHES) {
    const b = el('button', 'brush');
    b.title = name;
    b.setAttribute('aria-label', name);
    b.dataset.v = ch;
    if (type === 'tower') b.append(img(ICON.tower));
    else if (type) b.append(img(V('terrain:' + type)));
    else b.append(el('span', 'erase', '✕'));
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
    edMap = tilesToBlocks(L.get(L.count + 1 + Math.floor(Math.random() * 400)).rows);
    store.set('custom', edMap);
    drawEditor();
  };
  $('e-play').onclick = () => { playersWanted = 1; openBrief(L.custom(edMap.slice()), 'custom'); };

  let codeAction = null;
  function codeDialog(title, hint, text, action) {
    $('cb-title').textContent = title;
    $('cb-hint').textContent = hint;
    $('cb-text').value = text;
    $('cb-text').readOnly = !action;
    codeAction = action;
    $('cb-cancel').hidden = !action;
    $('codebox').hidden = false;
    if (!action) setTimeout(() => $('cb-text').select(), 50);
  }
  $('cb-ok').onclick = () => {
    if (codeAction) {
      const rows = L.decodeMap($('cb-text').value);
      if (!rows) { gtoast(ICON.tower, 'رمز غير صحيح', 'تأكد أنك نسخت الرمز كاملاً'); return; }
      codeAction(rows);
    }
    $('codebox').hidden = true;
  };
  $('cb-cancel').onclick = () => { $('codebox').hidden = true; };
  $('e-share').onclick = async () => {
    const link = SITE + '?map=' + L.encodeMap(edMap);
    if (navigator.share) {
      try { await navigator.share({ title: 'خريطتي في حُرّاس الواحة', text: 'جرّب الخريطة التي صمّمتها!', url: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(link); gtoast(ICON.pu.mason, 'نُسخ رابط الخريطة', 'أرسله لأصدقائك ليفتحوها'); return; } catch (e) { /* fall through */ }
    codeDialog('رابط خريطتك', 'انسخ الرابط وأرسله لأصدقائك:', link, null);
  };
  $('e-import').onclick = () => codeDialog('افتح خريطة', 'الصق رابط الخريطة أو رمزها هنا:', '', rows => {
    edMap = rows; store.set('custom', edMap); drawEditor();
    gtoast(ICON.pu.mason, 'فُتحت الخريطة', 'جرّبها أو عدّل عليها');
  });
  renderBrushes();

  // A shared link (?map=...) opens straight in the editor
  const shared = new URLSearchParams(location.search).get('map');
  if (shared) {
    const rows = L.decodeMap(shared);
    if (rows) { edMap = rows; store.set('custom', edMap); setTimeout(() => { show('editor'); gtoast(ICON.pu.mason, 'خريطة مشتركة', 'صمّمها صديقك: العب عليها!'); }, 50); }
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// */ }
  }

  // ---------- boot ----------
  applySettings();
  show('menu');
  TB.ui = {
    game, show, startStage, openBrief, settings, save, inputs, ICON, fmt, gtoast, toast, powerupToast, dyingBanner, vibrate, codeDialog,
    goMenu, hideOverlays, remoteEnd, remotePause, persist,
    screen: () => screen,
    saveSettings: () => store.set('settings', settings),
    customMap: () => edMap.slice(),
    pickOnline: () => { onlinePick = true; buildJourney(); show('journey'); },
  };
  NET.init();
  // An invitation link (?room=CODE) opens the room straight away
  const invited = new URLSearchParams(location.search).get('room');
  if (invited) {
    setTimeout(() => NET.open(TB.net.cleanCode(invited)), 60);
    try { history.replaceState(null, '', location.pathname + (new URLSearchParams(location.search).get('peer') ? '?peer=' + new URLSearchParams(location.search).get('peer') : '')); } catch (e) { /* file:// */ }
  }
})();
