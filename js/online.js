// Playing together online: one phone hosts the room and runs the battle; up to three friends join
// with a link (sent on WhatsApp, for example). Guests send their stick and fire button to the host,
// and the host sends back what to draw about twenty times a second.
(function () {
  'use strict';
  const TB = window.TB, L = TB.levels;
  const $ = id => document.getElementById(id);
  const VERSION = 1, SNAP_EVERY = 3, MAX = 4;
  // Silence before a phone counts as gone (ms). Phones that switch to WhatsApp keep answering for a while.
  const QUIET_LOBBY = 30000, QUIET_BATTLE = 20000, QUIET_HOST = 30000, QUIET_HOST_PAUSED = 90000, WEAK = 3500;
  const SITE = 'https://wagdi2222.github.io/New-game1/';

  const O = TB.online = {
    active: false, role: null, me: 0, code: '', players: [], conn: null, inGame: false, attempt: 0, heard: 0,
    events: [], lastSent: -99, snapAt: 0, gap: 50, sentInput: '', sentAt: 0, lastHp: null, hostPaused: false,
  };
  const ui = () => TB.ui;
  const send = (conn, msg) => { try { if (conn && conn.open) conn.send(msg); } catch (e) { /* closed */ } };
  const clamp = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
  const cleanName = n => String(n || '').replace(/[<>\n\r\t]/g, '').trim().slice(0, 12) || 'حارس';

  // ---------- screen ----------
  function view(which) {
    $('on-start').hidden = which !== 'start';
    $('on-busy').hidden = which !== 'busy';
    $('on-room').hidden = which !== 'room';
  }
  function busy(text) { $('on-busy-text').textContent = text; view('busy'); }
  function fail(text) { view('start'); ui().gtoast(ui().ICON.foe, 'تعذّر الاتصال', text); }

  function open(code) {
    const u = ui();
    $('on-name').value = u.settings.name || '';
    $('on-code').value = code || '';
    $('on-join-hint').hidden = !code;
    if (O.active) { renderRoom(); view('room'); } else view('start');
    u.show('online');
    if (code && u.settings.name) setTimeout(() => $('on-join').focus(), 50);
  }
  function rememberName() {
    const u = ui(), name = cleanName($('on-name').value);
    $('on-name').value = name;
    u.settings.name = name;
    u.saveSettings();
    return name;
  }

  // ---------- hosting ----------
  async function create() {
    const name = rememberName(), u = ui(), my = ++O.attempt;
    busy('نجهّز الغرفة…');
    try {
      const code = await TB.net.host({ onOpen: () => {}, onData: hostData, onClose: hostClose });
      if (my !== O.attempt) { TB.net.close(); return; }
      Object.assign(O, { active: true, role: 'host', code, me: 0, inGame: false, hostPaused: false });
      O.players = [{ name, upg: Object.assign({}, u.save.upg), falcons: u.save.falcons, conn: null, ping: 0, gamePid: 0 }];
      renderRoom();
      view('room');
    } catch (e) {
      if (my === O.attempt) fail('تأكد من اتصالك بالإنترنت ثم حاول مجدداً.');
    }
  }

  function lobbyList() {
    return O.players.map((p, i) => ({ name: p.name, ping: p.ping || 0, host: i === 0, playing: O.inGame && p.gamePid != null }));
  }
  function broadcast(msg, onlyPlaying) {
    for (const p of O.players) if (p.conn && (!onlyPlaying || p.gamePid != null)) send(p.conn, msg);
  }
  function broadcastLobby() {
    const players = lobbyList();
    O.players.forEach((p, i) => { if (p.conn) send(p.conn, { t: 'lobby', players, you: i, playing: O.inGame }); });
    renderRoom();
  }

  function hostData(conn, d) {
    const p = O.players.find(x => x.conn === conn);
    if (p) p.seen = performance.now();
    switch (d.t) {
      case 'hello': {
        if (p) return;
        if (d.v !== VERSION) { send(conn, { t: 'old' }); return; }
        if (O.players.length >= MAX) { send(conn, { t: 'full' }); return; }
        const upg = d.upg || {};
        O.players.push({
          name: cleanName(d.name), conn, ping: 0, seen: performance.now(), gamePid: null, falcons: clamp(d.falcons, 0, 3, 0),
          upg: { armor: clamp(upg.armor, 0, 3, 0), cannon: clamp(upg.cannon, 0, 2, 0), engine: clamp(upg.engine, 0, 3, 0) },
        });
        send(conn, { t: 'welcome', code: O.code });
        broadcastLobby();
        ui().gtoast(ui().ICON.p2, 'انضم ' + cleanName(d.name), O.inGame ? 'سيدخل معكم في الجولة القادمة' : 'الغرفة فيها الآن ' + ui().fmt(O.players.length) + ' لاعبين');
        TB.audio.play('coin');
        break;
      }
      case 'in':
        if (p && p.gamePid != null && O.inGame) {
          const inp = ui().game.inputs[p.gamePid];
          if (inp) { inp.dir = clamp(d.d, -1, 3, -1); inp.fire = !!d.f; }
        }
        break;
      case 'falcon':
        if (p && p.gamePid != null && O.inGame && !O.hostPaused) ui().game.useFalcon(p.gamePid);
        break;
      case 'pong':
        if (p && typeof d.c === 'number') p.ping = Math.max(0, Math.round(performance.now() - d.c));
        break;
      case 'bye':
        hostClose(conn);
        break;
    }
  }

  function hostClose(conn) {
    const i = O.players.findIndex(x => x.conn === conn);
    if (i <= 0) return;
    const [p] = O.players.splice(i, 1);
    if (O.inGame && p.gamePid != null) {
      // The tank of a player who left goes quiet for the rest of the battle
      const g = ui().game, pl = g.players[p.gamePid];
      if (pl) { pl.lives = 0; pl.respawn = 0; if (pl.tank) { pl.tank.dead = true; pl.tank = null; } }
      if (g.inputs[p.gamePid]) { g.inputs[p.gamePid].dir = -1; g.inputs[p.gamePid].fire = false; }
      O.names[p.gamePid] = p.name + ' (غادر)';
    }
    broadcastLobby();
    ui().gtoast(ui().ICON.foe, 'غادر ' + p.name, 'الغرفة فيها الآن ' + ui().fmt(O.players.length));
  }

  // Start a battle for everyone in the room
  function hostStart(pending) {
    const u = ui();
    O.players.forEach((p, i) => { p.gamePid = i; });
    O.names = O.players.map(p => p.name);
    O.inGame = true; O.hostPaused = false; O.events = []; O.lastSent = -99;
    O.players[0].upg = Object.assign({}, u.save.upg);
    O.players[0].falcons = u.save.falcons;
    const extra = {
      players: O.players.length, playerUpgrades: O.players.map(p => p.upg), falcons: O.players.map(p => p.falcons),
      names: O.names, myPid: 0,
    };
    u.startStage(pending, extra);
    const stage = JSON.parse(JSON.stringify(pending.stage));
    O.players.forEach((p, i) => {
      if (p.conn) send(p.conn, { t: 'start', stage, mode: pending.mode, difficulty: u.settings.difficulty, me: i, n: extra.players, ups: extra.playerUpgrades, fal: extra.falcons, names: O.names });
    });
  }

  // Called by the main loop after the host's simulation ran
  function hostFrame() {
    const g = ui().game;
    if (g.t - O.lastSent >= SNAP_EVERY || g.t < O.lastSent) {
      O.lastSent = g.t;
      broadcast({ t: 'snap', s: g.snapshot(), ev: O.events.splice(0) }, true);
    }
  }

  // Sounds and messages from the host's battle, replayed on the guests' phones
  function capture(kind, a, b) {
    if (O.role !== 'host' || !O.inGame) return;
    if (kind === 's') {
      if (O.events.filter(e => e[0] === 's' && e[1] === a).length < 2) O.events.push(['s', a]);
      return;
    }
    if (kind === 'falcons') {
      const p = O.players.find(x => x.gamePid === a.pid);
      if (p && p.conn) send(p.conn, { t: 'falcons', n: a.n });
      return;
    }
    O.events.push([kind, a, b]);
  }

  function hostEnd(result) {
    const g = ui().game;
    broadcast({ t: 'snap', s: g.snapshot(), ev: O.events.splice(0) }, true);
    const st = result.stats;
    broadcast({
      t: 'end', r: {
        won: result.won, stars: result.stars, score: result.score, coins: result.coins, reason: result.reason, mission: result.mission,
        players: result.players, noDamage: result.noDamage,
        stats: { deaths: st.deaths, hpLost: st.hpLost, wellDamaged: st.wellDamaged, camelsLost: st.camelsLost, camelsArrived: st.camelsArrived,
          skinsCollected: st.skinsCollected, skinsStolen: st.skinsStolen, combo: st.combo, towers: st.towers, boss: st.boss, falconUses: st.falconUses, kills: st.kills },
      },
    }, true);
    O.inGame = false;
  }

  function setPause(on) {
    if (O.role !== 'host') return;
    O.hostPaused = on;
    broadcast({ t: 'pause', on }, true);
  }

  function toLobby() {
    O.inGame = false;
    for (const p of O.players) p.gamePid = null;
    broadcast({ t: 'room' });
    broadcastLobby();
    open();
  }

  // ---------- joining ----------
  async function join() {
    const name = rememberName(), code = TB.net.cleanCode($('on-code').value), u = ui();
    if (code.length !== 5) { ui().gtoast(ui().ICON.foe, 'رمز الغرفة ناقص', 'الرمز خمسة أحرف أو أرقام'); return; }
    const my = ++O.attempt;
    busy('ندخل الغرفة ' + code + '…');
    try {
      const conn = await TB.net.join(code, { onOpen: () => {}, onData: clientData, onClose: clientClose });
      if (my !== O.attempt) { TB.net.close(); return; }
      Object.assign(O, { active: true, role: 'client', code, conn, me: 0, inGame: false, hostPaused: false, players: [], welcomed: false, heard: performance.now() });
      send(conn, { t: 'hello', v: VERSION, name, upg: u.save.upg, falcons: u.save.falcons });
      O.welcomeTimer = setTimeout(() => { if (!O.welcomed && my === O.attempt) { leave(true); fail('المضيف لم يرد. اطلب منه أن يفتح اللعبة ثم حاول مجدداً.'); } }, 20000);
    } catch (e) {
      if (my !== O.attempt) return;
      leave(true);
      fail(e && e.type === 'peer-unavailable' ? 'لم نجد هذه الغرفة. ربما أغلقها المضيف أو الرمز غير صحيح.' : 'تأكد من اتصالك بالإنترنت ثم حاول مجدداً.');
    }
  }

  function clientData(conn, d) {
    const u = ui();
    O.heard = performance.now();
    switch (d.t) {
      case 'welcome':
        O.welcomed = true;
        clearTimeout(O.welcomeTimer);
        renderRoom();
        view('room');
        TB.audio.play('coin');
        break;
      case 'full': leave(true); fail('الغرفة ممتلئة: أربعة لاعبين كحد أقصى.'); break;
      case 'old': leave(true); fail('نسختك من اللعبة أقدم من نسخة المضيف. أعد تحميل الصفحة.'); break;
      case 'lobby':
        O.players = Array.isArray(d.players) ? d.players.slice(0, MAX) : [];
        O.slot = d.you;
        if (u.screen() === 'online') renderRoom();
        if (d.playing && !O.inGame && u.screen() === 'online') $('on-wait').textContent = 'المعركة جارية الآن، ستدخل في الجولة القادمة…';
        break;
      case 'start': {
        if (!d.stage || !Array.isArray(d.stage.rows)) return;
        O.inGame = true; O.hostPaused = false; O.me = clamp(d.me, 0, 3, 0); O.names = (d.names || []).map(cleanName);
        O.snapAt = performance.now(); O.lastHp = null; O.sentInput = '';
        u.startStage({ stage: d.stage, mode: d.mode }, {
          remote: true, players: clamp(d.n, 1, 4, 1), playerUpgrades: d.ups, falcons: d.fal, names: O.names, myPid: O.me, difficulty: d.difficulty,
        });
        break;
      }
      case 'snap': {
        if (!O.inGame || u.screen() !== 'play' || !d.s) return;
        const g = u.game, now = performance.now();
        O.gap = Math.max(30, Math.min(120, O.gap * 0.8 + (now - O.snapAt) * 0.2));
        O.snapAt = now;
        try { g.applySnapshot(d.s, g.positions()); } catch (e) { return; }
        for (const ev of d.ev || []) replay(ev);
        const mine = g.players[O.me] && g.players[O.me].tank;
        const hp = mine ? mine.hp : -1;
        if (O.lastHp != null && hp < O.lastHp) u.vibrate(hp < 0 ? 220 : 60);
        O.lastHp = hp;
        break;
      }
      case 'end':
        O.inGame = false;
        $('netwarn').hidden = true;
        if (d.r) u.remoteEnd(Object.assign({}, d.r, { stage: u.game.stage, online: true }));
        break;
      case 'pause':
        O.hostPaused = !!d.on;
        u.remotePause(O.hostPaused);
        break;
      case 'room':
        O.inGame = false;
        u.hideOverlays();
        open();
        break;
      case 'falcons':
        u.save.falcons = clamp(d.n, 0, 3, u.save.falcons);
        u.persist();
        break;
      case 'ping':
        send(conn, { t: 'pong', c: d.c });
        break;
      case 'bye':
        leave(true);
        u.goMenu();
        u.gtoast(u.ICON.foe, 'أغلق المضيف الغرفة', 'شكراً لأنك لعبت معنا');
        break;
    }
  }

  function replay(ev) {
    const u = ui();
    if (!Array.isArray(ev)) return;
    if (ev[0] === 's') TB.audio.play(String(ev[1]));
    else if (ev[0] === 'toast') u.toast(String(ev[1]));
    else if (ev[0] === 'powerup') u.powerupToast(String(ev[1]));
    else if (ev[0] === 'dying') u.dyingBanner(ev[1] || {});
  }

  function clientClose() {
    if (O.role !== 'client' || !O.active) return;
    const u = ui();
    leave(true);
    u.goMenu();
    u.gtoast(u.ICON.foe, 'انقطع الاتصال بالمضيف', 'تأكد من الإنترنت وادخل الغرفة من جديد');
  }

  // Called by the main loop on a guest's phone: glide between snapshots and send the controls
  function clientFrame(now, dir, fire) {
    const g = ui().game;
    g.glide(Math.min(1, (now - O.snapAt) / O.gap));
    const key = dir + ',' + (fire ? 1 : 0);
    if (key !== O.sentInput || now - O.sentAt > 250) {
      O.sentInput = key; O.sentAt = now;
      send(O.conn, { t: 'in', d: dir, f: fire ? 1 : 0 });
    }
  }
  function clientFalcon() { send(O.conn, { t: 'falcon' }); }

  // Every second: the host checks on its guests, a guest checks on the host
  function heartbeat() {
    if (!O.active) return;
    const now = performance.now(), u = ui();
    if (O.role === 'host') {
      broadcast({ t: 'ping', c: now });
      for (const p of O.players.slice(1)) {
        if (now - (p.seen || 0) > (O.inGame && p.gamePid != null ? QUIET_BATTLE : QUIET_LOBBY)) {
          const conn = p.conn;
          hostClose(conn);
          try { conn.close(); } catch (e) { /* already closed */ }
        }
      }
      if (u.screen() === 'online') renderRoom();
    } else if (O.welcomed) {
      const quiet = now - O.heard;
      if (quiet > (O.hostPaused ? QUIET_HOST_PAUSED : QUIET_HOST)) { clientClose(); return; }
      $('netwarn').hidden = !(O.inGame && !O.hostPaused && quiet > WEAK && u.screen() === 'play');
    }
  }

  // ---------- leaving ----------
  function leave(silent) {
    O.attempt++;
    $('netwarn').hidden = true;
    if (O.role === 'host') broadcast({ t: 'bye' });
    else if (O.conn) send(O.conn, { t: 'bye' });
    clearTimeout(O.welcomeTimer);
    setTimeout(() => TB.net.close(), O.role === 'host' ? 300 : 0);
    Object.assign(O, { active: false, role: null, conn: null, players: [], inGame: false, code: '', welcomed: false, hostPaused: false });
    if (!silent) ui().goMenu();
  }

  // ---------- the room card ----------
  const linkOf = () => SITE + '?room=' + O.code;
  function renderRoom() {
    if (!O.active) return;
    const u = ui(), host = O.role === 'host';
    $('on-roomcode').textContent = O.code;
    const list = host ? lobbyList() : O.players;
    const box = $('on-slots');
    box.textContent = '';
    for (let i = 0; i < MAX; i++) {
      const p = list[i], slot = document.createElement('div');
      slot.className = 'slot' + (p ? '' : ' empty');
      const icon = new Image();
      icon.alt = '';
      icon.src = u.ICON.players[i];
      const text = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = p ? p.name + ((host && i === 0) || (!host && i === O.slot) ? ' (أنت)' : '') : 'بانتظار لاعب…';
      const small = document.createElement('small');
      small.textContent = !p ? 'ادعُ صديقاً بالرابط' : p.host ? 'المضيف' : p.ping ? 'الاتصال ' + u.fmt(p.ping) + ' م.ث' : 'متصل';
      text.append(b, small);
      slot.append(icon, text);
      box.append(slot);
    }
    $('on-hostctl').hidden = !host;
    $('on-wait').hidden = host;
    if (!host) $('on-wait').textContent = 'بانتظار المضيف ليختار المرحلة…';
  }

  const invitation = () => 'تعال نلعب «حُرّاس الواحة» معاً! ادخل غرفتي من هذا الرابط:\n' + linkOf() + '\n\nأو افتح اللعبة واكتب رمز الغرفة: ' + O.code;
  function shareWhatsApp() {
    const url = 'https://wa.me/?text=' + encodeURIComponent(invitation());
    if (window.TankApp) location.href = url; else window.open(url, '_blank');
  }
  async function shareLink() {
    const link = linkOf(), u = ui();
    if (window.TankApp && window.TankApp.share) { window.TankApp.share(invitation()); return; }
    if (navigator.share) {
      try { await navigator.share({ title: 'حُرّاس الواحة', text: 'تعال نلعب معاً! رمز الغرفة ' + O.code, url: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(link); u.gtoast(u.ICON.p2, 'نُسخ رابط الغرفة', 'أرسله لأصدقائك'); return; } catch (e) { /* fall through */ }
    u.codeDialog('رابط الغرفة', 'انسخ الرابط وأرسله لأصدقائك:', link, null);
  }

  // ---------- wiring ----------
  function init() {
    $('on-create').onclick = create;
    $('on-join').onclick = join;
    $('on-code').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    $('on-cancel').onclick = () => { leave(true); view('start'); };
    $('on-leave').onclick = () => leave(false);
    $('on-back').onclick = () => (O.active ? leave(false) : ui().goMenu());
    $('on-wa').onclick = shareWhatsApp;
    $('on-share').onclick = shareLink;
    $('on-pick').onclick = () => ui().pickOnline();
    $('on-daily').onclick = () => ui().openBrief(L.daily(), 'daily');
    $('on-mymap').onclick = () => ui().openBrief(L.custom(ui().customMap()), 'custom');
    setInterval(heartbeat, 1000);
  }

  Object.assign(O, { init, open, hostStart, hostFrame, hostEnd, capture, setPause, toLobby, clientFrame, clientFalcon, leave, renderRoom });
})();
