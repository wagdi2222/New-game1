// Game engine: a 208x208 field of 4px terrain cells, 16px vehicles (32px boss), 60 ticks per second.
// Missions: defend the well, collect water skins, destroy towers, escort a caravan, survive the night, beat the boss.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};
  const S = TB.sprites;

  const FIELD = 208, NC = 52;
  const EMPTY = 0, MUD = 1, STONE = 2, WATER = 3, PALM = 4, DUNE = 5, QUICK = 6;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const WELL = { x: 96, y: 192 };
  const P_SPAWN = [{ x: 64, y: 192 }, { x: 128, y: 192 }, { x: 32, y: 192 }, { x: 160, y: 192 }];
  const PALETTES = ['p1', 'p2', 'p3', 'p4'];
  const TOP_SPAWNS = [{ x: 96, y: 0 }, { x: 192, y: 0 }, { x: 0, y: 0 }];
  const PLAYER_SPEED = 0.75;

  const ENEMY = [
    { id: 'jeep', name: 'الجوّال', design: 'jeep', speed: 1.05, bullet: 2.2, hp: 1, score: 100, coins: 5, fire: 1 },
    { id: 'scorpion', name: 'العقرب', design: 'scorpion', speed: 0.6, bullet: 2.6, hp: 2, score: 200, coins: 10, fire: 1, burst: true },
    { id: 'mortar', name: 'المدفعية', design: 'mortar', speed: 0.45, bullet: 0, hp: 2, score: 300, coins: 15, fire: 0, mortar: true },
    { id: 'miner', name: 'زارع الألغام', design: 'miner', speed: 0.7, bullet: 2.2, hp: 2, score: 250, coins: 12, fire: 0.5, mines: true },
    { id: 'heavy', name: 'الحصن', design: 'heavy', speed: 0.42, bullet: 2.6, hp: 4, score: 400, coins: 20, fire: 1 },
  ];
  const BOSS = { id: 'boss', name: 'القلعة المتحركة', design: 'boss', speed: 0.38, bullet: 2.6, score: 3000, coins: 150, fire: 1 };
  // Cannon levels from the blacksmith's hammer (and the souq): faster shells, two shells, then shells that break stone
  const PLAYER = [
    { design: 'A', bullet: 2.5, max: 1, dmg: 1, power: false },
    { design: 'B', bullet: 4, max: 1, dmg: 1, power: false },
    { design: 'C', bullet: 4, max: 2, dmg: 1, power: false },
    { design: 'D', bullet: 4, max: 2, dmg: 2, power: true },
  ];
  const DIFF = {
    easy: { lives: 4, eSpeed: 0.85, eFire: 0.55, eBullet: 0.85, maxOn: 3, spawnMul: 1.3, shield: 300, chase: 0.6, wellHp: 6, skinAllow: 3, camels: 1, bossMul: 0.75, timeMul: 0.85 },
    normal: { lives: 3, eSpeed: 1, eFire: 1, eBullet: 1, maxOn: 4, spawnMul: 1, shield: 180, chase: 1, wellHp: 4, skinAllow: 2, camels: 2, bossMul: 1, timeMul: 1 },
    hard: { lives: 3, eSpeed: 1.12, eFire: 1.45, eBullet: 1.1, maxOn: 5, spawnMul: 0.8, shield: 150, chase: 1.3, wellHp: 3, skinAllow: 1, camels: 2, bossMul: 1.3, timeMul: 1.15 },
  };
  const POWERUPS = ['shield', 'whirl', 'mason', 'hammer', 'falcon', 'dates', 'coffee', 'qirba'];

  // 8px ring of mud around the well
  const FORTRESS = [];
  for (const bx of [88, 96, 104, 112]) {
    for (const by of [184, 192, 200]) {
      if (bx !== 88 && bx !== 112 && by !== 184) continue;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) FORTRESS.push([bx / 4 + ox, by / 4 + oy]);
    }
  }

  const hit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  const solid = c => c === MUD || c === STONE || c === WATER;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const TINT = { dawn: ['#FFE4D4', 'rgba(255,170,120,0.07)'], dusk: ['#F6C496', 'rgba(110,50,140,0.09)'] };

  class Game {
    constructor(hooks) {
      this.hooks = hooks || {};
      const mk = () => { const c = document.createElement('canvas'); c.width = c.height = FIELD; return c; };
      this.frame = mk(); this.fctx = this.frame.getContext('2d');
      this.bg = mk(); this.bgctx = this.bg.getContext('2d'); this.bgImg = this.bgctx.createImageData(FIELD, FIELD);
      this.trees = mk(); this.treectx = this.trees.getContext('2d'); this.treeImg = this.treectx.createImageData(FIELD, FIELD);
      this.dark = mk(); this.darkctx = this.dark.getContext('2d');
      this.map = new Uint8Array(NC * NC);
      this.road = new Uint8Array(NC * NC);
      this.fx = S.effects();
      this.inputs = [0, 1, 2, 3].map(() => ({ dir: -1, fire: false }));
      this.state = 'idle';
      this.region = 'desert';
      this.waterFrame = 0;
      this.clearEntities();
    }

    sound(n) { if (this.hooks.sound) this.hooks.sound(n); }
    vibrate(p) { if (this.hooks.vibrate) this.hooks.vibrate(p); }
    emit(n, d) { if (this.hooks.event) this.hooks.event(n, d); }

    clearEntities() {
      this.tanks = []; this.bullets = []; this.shells = []; this.mines = []; this.towers = []; this.camels = [];
      this.skins = []; this.lanterns = []; this.dhows = []; this.effects = []; this.popups = []; this.spawns = []; this.birds = [];
      this.powerup = null; this.well = null; this.t = 0;
    }

    // ---------- setup ----------
    start(opts) {
      this.difficulty = DIFF[opts.difficulty] ? opts.difficulty : 'normal';
      this.diff = DIFF[this.difficulty];
      this.nPlayers = Math.max(1, Math.min(4, opts.players || 1));
      // Falcons: one shared pool on a single phone, or each online player's own
      this.sharedFalcons = !Array.isArray(opts.falcons);
      this.falcons = this.sharedFalcons ? opts.falcons || 0 : 0;
      this.stage = opts.stage;
      this.score = 0; this.coins = 0; this.nextId = 1; this.cellLog = [];
      this.players = [];
      for (let i = 0; i < this.nPlayers; i++) {
        const upg = Object.assign({ armor: 0, cannon: 0, engine: 0 }, (opts.playerUpgrades && opts.playerUpgrades[i]) || opts.upgrades || {});
        this.players.push({ pid: i, upg, lives: this.diff.lives, level: Math.min(3, upg.cannon), tank: null, respawn: 0, coffee: 0, falcons: this.sharedFalcons ? 0 : opts.falcons[i] || 0 });
      }
      this.load();
    }

    load() {
      const st = this.stage, p = st.params || {};
      this.region = st.region; this.mission = st.mission; this.time = st.time;
      this.clearEntities();
      this.whirl = 0; this.mason = 0;
      // The hardest missions give the well a little more to withstand
      const wellHp = this.diff.wellHp + (this.mission === 'boss' || this.mission === 'survive' ? 2 : 0);
      this.well = st.well ? { x: WELL.x, y: WELL.y, hp: wellHp, max: wellHp, dead: false, flash: 0, calm: 0 } : null;
      this.parse(st.rows, st.waypoints, !!st.well);
      const coop = 1 + 0.3 * (this.nPlayers - 1);
      this.queue = []; this.spawnCount = 0; this.need = 0; this.timer = 0; this.boss = null;
      if (this.mission === 'defend') this.queue = this.makeQueue(Math.round((p.enemies || 20) * (1 + 0.25 * (this.nPlayers - 1))));
      if (this.mission === 'collect') this.need = Math.max(1, this.skins.length - this.diff.skinAllow);
      if (this.mission === 'towers') for (const tw of this.towers) { tw.hp = tw.max = Math.round((p.towerHp || 6) * coop); }
      if (this.mission === 'survive') this.timer = this.timerMax = Math.round((p.seconds || 90) * 60 * this.diff.timeMul);
      if (this.mission === 'escort') {
        this.need = Math.min(p.camels || 3, this.diff.camels);
        const [sx, sy] = st.waypoints[0];
        for (let i = 0; i < (p.camels || 3); i++) {
          this.camels.push({ x: sx * 16 - i * 26, y: sy * 16, hp: p.camelHp || 3, max: p.camelHp || 3, wp: 1, left: false, anim: 0, flash: 0, waited: 0, dead: false, arrived: false });
        }
        this.waypoints = st.waypoints.map(([x, y]) => [x * 16, y * 16]);
      }
      if (this.mission === 'boss') this.bossHp = Math.round((p.bossHp || 24) * this.diff.bossMul * coop);
      this.spawnTimer = 40;
      this.spawnInterval = Math.round(Math.max(60, 175 - (st.level || 0) * 4) * this.diff.spawnMul);
      this.stats = {
        kills: [0, 0, 0, 0, 0], boss: 0, towers: 0, falconUses: 0, deaths: 0, hpLost: 0, wellDamaged: false,
        camelsLost: 0, camelsArrived: 0, skinsCollected: 0, skinsStolen: 0, combo: false, recentKills: [],
      };
      this.endTimer = 0; this.result = null;
      for (const inp of this.inputs) { inp.dir = -1; inp.fire = false; }
      this.state = 'intro';
    }

    begin() {
      if (this.state !== 'intro') return;
      this.state = 'play';
      for (const pl of this.players) this.spawnPlayer(pl);
      if (this.mission === 'boss') this.spawns.push({ team: 'e', kind: -1, x: 88, y: 0, t: 90, big: true });
      this.sound('start');
    }

    makeQueue(n) {
      const kinds = [];
      for (let i = 0; i < n; i++) kinds.push(this.pickKind());
      kinds.sort((a, b) => a + Math.random() * 2.5 - (b + Math.random() * 2.5));
      return kinds.map((kind, i) => ({ kind, bonus: i % 7 === 3 }));
    }

    pickKind() {
      const mix = this.stage.mix || [6, 4, 0, 0, 1], lvl = this.stage.level || 0;
      const w = mix.map((m, k) => m * (1 + lvl * 0.025 * k));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let k = 0; k < w.length; k++) if ((r -= w[k]) <= 0) return k;
      return 0;
    }

    parse(rows, waypoints, well) {
      this.map.fill(EMPTY);
      this.road.fill(0);
      const TYPES = { '#': MUD, '@': STONE, '~': WATER, '%': PALM, '-': DUNE, '*': QUICK, B: WATER };
      const HALF = {
        '[': [MUD, 0, 0, 2, 4], ']': [MUD, 2, 0, 2, 4], '^': [MUD, 0, 0, 4, 2], '_': [MUD, 0, 2, 4, 2],
        '{': [STONE, 0, 0, 2, 4], '}': [STONE, 2, 0, 2, 4], '/': [STONE, 0, 0, 4, 2], '\\': [STONE, 0, 2, 4, 2],
      };
      const k = rows.length === 26 ? 2 : 4;
      for (let ty = 0; ty < rows.length; ty++) {
        for (let tx = 0; tx < rows[ty].length; tx++) {
          const ch = rows[ty][tx], px = tx * k * 4, py = ty * k * 4;
          if (ch === 'T') this.towers.push({ x: px, y: py, hp: 6, max: 6, flash: 0, dead: false });
          else if (ch === 'Q') this.skins.push({ x: px, y: py, taken: false });
          else if (ch === 'L') this.lanterns.push({ x: px + 3, y: py + 2 });
          else if (ch === 'B') this.dhows.push({ x: px, y: py });
          let type = TYPES[ch], x0 = 0, y0 = 0, w = k, h = k;
          if (!type && HALF[ch]) {
            [type, x0, y0, w, h] = HALF[ch];
            if (k === 2) { x0 /= 2; y0 /= 2; w /= 2; h /= 2; }
          }
          if (!type) continue;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.map[(ty * k + y0 + y) * NC + tx * k + x0 + x] = type;
        }
      }
      if (well) for (const [cx, cy] of FORTRESS) this.map[cy * NC + cx] = MUD;
      if (waypoints) {
        for (let i = 0; i + 1 < waypoints.length; i++) {
          const [ax, ay] = waypoints[i], [bx, by] = waypoints[i + 1];
          for (let tx = Math.min(ax, bx); tx <= Math.max(ax, bx); tx++) {
            for (let ty = Math.min(ay, by); ty <= Math.max(ay, by); ty++) {
              if (tx < 0 || tx > 12) continue;
              for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
                const idx = (ty * 4 + y) * NC + tx * 4 + x;
                this.road[idx] = 1;
                this.map[idx] = EMPTY;
              }
            }
          }
        }
      }
      this.animCells = [];
      for (let i = 0; i < this.map.length; i++) if (this.map[i] === WATER || this.map[i] === QUICK) this.animCells.push(i);
      this.redrawTerrain();
    }

    // ---------- terrain drawing ----------
    paintCell(cx, cy) {
      const i0 = cy * NC + cx, type = this.map[i0], road = this.road[i0], d = this.bgImg.data;
      const drawn = type === MUD || type === STONE || type === WATER || type === DUNE || type === QUICK ? type : EMPTY;
      for (let y = cy * 4; y < cy * 4 + 4; y++) {
        for (let x = cx * 4; x < cx * 4 + 4; x++) {
          const i = (y * FIELD + x) * 4, col = S.terrainPixel(drawn, x, y, this.waterFrame, this.region, road);
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
      this.bgDirty = true;
    }

    redrawTerrain() {
      for (let cy = 0; cy < NC; cy++) for (let cx = 0; cx < NC; cx++) this.paintCell(cx, cy);
      const d = this.treeImg.data;
      for (let y = 0; y < FIELD; y++) {
        for (let x = 0; x < FIELD; x++) {
          const i = (y * FIELD + x) * 4;
          const col = this.map[(y >> 2) * NC + (x >> 2)] === PALM ? S.terrainPixel(PALM, x, y, 0, this.region) : null;
          if (col) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; } else d[i + 3] = 0;
        }
      }
      this.treectx.putImageData(this.treeImg, 0, 0);
    }

    setCell(cx, cy, type) {
      const i = cy * NC + cx;
      if (this.map[i] === type) return;
      this.map[i] = type;
      this.paintCell(cx, cy);
      if (this.logCells) this.cellLog.push(i, type);
    }

    cellAt(x, y) {
      const cx = Math.floor(x / 4), cy = Math.floor(y / 4);
      if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) return STONE;
      return this.map[cy * NC + cx];
    }

    cellsIn(x, y, w, h, test) {
      const cx0 = Math.max(0, Math.floor(x / 4)), cy0 = Math.max(0, Math.floor(y / 4));
      const cx1 = Math.min(NC - 1, Math.floor((x + w - 0.001) / 4)), cy1 = Math.min(NC - 1, Math.floor((y + h - 0.001) / 4));
      let n = 0;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (test(this.map[cy * NC + cx])) n++;
      return n;
    }

    setFortress(type) {
      for (const [cx, cy] of FORTRESS) {
        if (this.tanks.some(t => !t.dead && hit(cx * 4, cy * 4, 4, 4, t.x, t.y, t.size, t.size))) continue;
        this.setCell(cx, cy, type);
      }
    }

    // ---------- vehicles ----------
    makeTank(team, kind, x, y, extra) {
      const spec = team === 'p' ? null : kind < 0 ? BOSS : ENEMY[kind];
      const t = {
        team, kind, x, y, size: kind < 0 && team === 'e' ? 32 : 16, dir: team === 'p' ? 0 : 2,
        id: this.nextId++, hp: spec ? (kind < 0 ? this.bossHp : spec.hp) : 3, bonus: false,
        bullets: 0, cooldown: 0, anim: 0, moving: false, blocked: false, shield: 0, flash: 0, stun: 0,
        sink: 0, sandFree: 0, dead: false, aiTimer: 0, stuck: 0, burst: 0, burstTimer: 0, special: 60 + Math.random() * 120,
      };
      t.max = t.hp;
      return Object.assign(t, extra || {});
    }

    spawnPlayer(pl) {
      const sp = P_SPAWN[pl.pid];
      this.spawns.push({ team: 'p', pid: pl.pid, x: sp.x, y: sp.y, t: 36 });
    }

    tankBlocked(t, x, y) {
      const s = t.size;
      if (x < 0 || y < 0 || x > FIELD - s || y > FIELD - s) return true;
      if (this.cellsIn(x, y, s, s, solid)) return true;
      if (this.well && hit(x, y, s, s, this.well.x, this.well.y, 16, 16)) return true;
      for (const tw of this.towers) if (!tw.dead && hit(x, y, s, s, tw.x, tw.y, 16, 16)) return true;
      for (const c of this.camels) {
        if (c.dead || c.arrived || c.x <= -16 || !hit(x, y, s, s, c.x, c.y, 16, 16)) continue;
        // A tank a camel walked past can always drive away from it
        if (!hit(t.x, t.y, s, s, c.x, c.y, 16, 16)) return true;
      }
      for (const o of this.tanks) {
        if (o === t || o.dead) continue;
        // Vehicles that already overlap (fresh spawns) may drive apart
        if (hit(x, y, s, s, o.x, o.y, o.size, o.size) && !hit(t.x, t.y, s, s, o.x, o.y, o.size, o.size)) return true;
      }
      return false;
    }

    // Turning onto the other axis snaps to the 8px grid so vehicles slip into corridors easily
    turn(t, dir) {
      if ((dir & 1) !== (t.dir & 1)) {
        const axis = t.dir & 1 ? 'x' : 'y', v = t[axis];
        const near = Math.round(v / 8) * 8, far = near > v ? Math.floor(v / 8) * 8 : Math.ceil(v / 8) * 8;
        for (const c of [near, far]) {
          const nx = axis === 'x' ? c : t.x, ny = axis === 'y' ? c : t.y;
          if (c === v || !this.tankBlocked(t, nx, ny)) { t[axis] = c; break; }
        }
      }
      t.dir = dir;
    }

    moveTank(t, dist) {
      const dx = DX[t.dir], dy = DY[t.dir];
      let moved = false;
      t.blocked = false;
      while (dist > 1e-6) {
        const s = Math.min(1, dist), nx = t.x + dx * s, ny = t.y + dy * s;
        if (!this.tankBlocked(t, nx, ny)) { t.x = nx; t.y = ny; moved = true; dist -= s; continue; }
        const cur = dx ? t.x : t.y, sign = dx || dy;
        const target = sign > 0 ? Math.ceil(cur - 1e-6) : Math.floor(cur + 1e-6);
        if (Math.abs(target - cur) > 1e-6) {
          const tx = dx ? target : t.x, ty = dy ? target : t.y;
          if (!this.tankBlocked(t, tx, ty)) { t.x = tx; t.y = ty; moved = true; }
        }
        t.blocked = true;
        break;
      }
      return moved;
    }

    // Dunes slow vehicles down; quicksand holds them for a moment
    terrainFactor(t) { return this.cellAt(t.x + t.size / 2, t.y + t.size / 2) === DUNE ? 0.55 : 1; }
    sinking(t) {
      if (t.sink > 0) { if (--t.sink === 0) t.sandFree = 90; return true; }
      if (t.sandFree > 0) { t.sandFree--; return false; }
      if (this.cellAt(t.x + t.size / 2, t.y + t.size / 2) === QUICK) {
        t.sink = 45;
        if (t.team === 'p') { this.sound('sand'); this.toast('رمال متحركة!'); }
        return true;
      }
      return false;
    }

    fire(t) {
      if (t.cooldown > 0 || t.stun > 0) return;
      if (t.team === 'p') {
        const pl = this.players[t.pid], spec = PLAYER[pl.level];
        if (t.bullets >= spec.max) return;
        this.shoot(t, 0, spec.bullet, spec.dmg, spec.power);
        t.cooldown = Math.round((spec.max > 1 ? 10 : 6) * (pl.coffee > 0 ? 0.5 : 1));
        this.sound('shoot');
        return;
      }
      const spec = t.kind < 0 ? BOSS : ENEMY[t.kind];
      if (t.kind < 0) {
        if (t.bullets > 0) return;
        for (const off of [-10, 0, 10]) this.shoot(t, off, spec.bullet * this.diff.eBullet, 1, false);
        t.cooldown = 70;
      } else {
        if (t.bullets >= (spec.burst ? 2 : 1)) return;
        this.shoot(t, 0, spec.bullet * this.diff.eBullet, 1, false);
        t.cooldown = 25;
        if (spec.burst && !t.burst) { t.burst = 1; t.burstTimer = 9; }
      }
      this.sound('eshoot');
    }

    shoot(t, offset, speed, dmg, power) {
      const half = t.size / 2, perpX = DY[t.dir] !== 0 ? offset : 0, perpY = DX[t.dir] !== 0 ? offset : 0;
      this.bullets.push({
        id: this.nextId++, x: t.x + half + DX[t.dir] * (half - 2) + perpX, y: t.y + half + DY[t.dir] * (half - 2) + perpY,
        dir: t.dir, speed, dmg, power, owner: t, team: t.team, dead: false, age: 0,
      });
      t.bullets++;
    }

    updatePlayer(pl) {
      if (pl.coffee > 0) pl.coffee--;
      const p = pl.tank, inp = this.inputs[pl.pid];
      if (!p) return;
      if (p.shield > 0) p.shield--;
      if (p.cooldown > 0) p.cooldown--;
      if (p.flash > 0) p.flash--;
      if (p.stun > 0) { p.stun--; p.moving = false; return; }
      if (this.state !== 'play') { p.moving = false; return; }
      if (this.sinking(p)) { p.moving = false; if (inp.fire) this.fire(p); return; }
      const speed = PLAYER_SPEED * (1 + 0.1 * pl.upg.engine) * (pl.coffee > 0 ? 1.6 : 1) * this.terrainFactor(p);
      if (inp.dir >= 0) {
        if (inp.dir !== p.dir) this.turn(p, inp.dir);
        p.moving = this.moveTank(p, speed);
      } else p.moving = false;
      if (p.moving) p.anim++;
      if (inp.fire) this.fire(p);
      for (const sk of this.skins) {
        if (sk.taken || !hit(p.x + 2, p.y + 2, 12, 12, sk.x + 2, sk.y + 2, 12, 12)) continue;
        sk.taken = 'p';
        this.stats.skinsCollected++;
        this.addScore(150, sk.x + 8, sk.y + 8);
        this.coins += 5;
        this.sound('water');
        this.vibrate(20);
      }
    }

    // ---------- enemies ----------
    enemySpawner() {
      const spawning = this.mission === 'defend' ? this.queue.length > 0 : this.state === 'play';
      if (!spawning) return;
      let cap = this.diff.maxOn + this.nPlayers - 1;
      if (this.mission === 'boss') cap = Math.max(1, cap - 2);
      if (this.mission === 'towers') cap = Math.min(cap, this.towers.filter(t => !t.dead).length + 2);
      const onField = this.tanks.filter(t => t.team === 'e' && !t.dead && t.kind >= 0).length + this.spawns.filter(s => s.team === 'e' && !s.big).length;
      if (onField >= cap || --this.spawnTimer > 0) return;
      let points = TOP_SPAWNS;
      if (this.mission === 'towers') points = this.towers.filter(t => !t.dead).map(t => ({ x: t.x, y: t.y + 16 }));
      if (!points.length) return;
      for (let k = 0; k < points.length; k++) {
        const sp = points[(this.spawnCount + k) % points.length];
        if (sp.y > FIELD - 16) continue;
        const busy = this.tanks.some(t => !t.dead && hit(sp.x, sp.y, 16, 16, t.x, t.y, t.size, t.size)) ||
          this.spawns.some(s => hit(sp.x, sp.y, 16, 16, s.x, s.y, s.big ? 32 : 16, s.big ? 32 : 16)) || this.cellsIn(sp.x, sp.y, 16, 16, solid) > 0;
        if (busy) continue;
        const next = this.mission === 'defend' ? this.queue.shift() : { kind: this.pickKind(), bonus: this.spawnCount % 6 === 3 };
        this.spawns.push({ team: 'e', x: sp.x, y: sp.y, t: 60, kind: next.kind, bonus: next.bonus });
        this.spawnCount++;
        let interval = this.spawnInterval;
        if (this.mission === 'survive') interval = Math.round(interval * (0.55 + 0.45 * this.timer / this.timerMax));
        this.spawnTimer = interval;
        return;
      }
      this.spawnTimer = 10;
    }

    updateSpawns() {
      for (const s of this.spawns) {
        if (--s.t > 0) continue;
        if (s.team === 'p') {
          const pl = this.players[s.pid], p = this.makeTank('p', 0, s.x, s.y, { pid: s.pid });
          p.hp = p.max = 3 + pl.upg.armor;
          p.shield = this.diff.shield;
          pl.tank = p;
          this.tanks.push(p);
        } else {
          const e = this.makeTank('e', s.kind, s.x, s.y);
          e.bonus = s.bonus;
          if (s.kind < 0) { this.boss = e; this.toast('القلعة المتحركة وصلت!'); }
          this.tanks.push(e);
        }
      }
      this.spawns = this.spawns.filter(s => s.t > 0);
    }

    // Something ahead that shooting cannot clear: field edge, stone or water
    hardBlocked(e, d) {
      const s = e.size, x = e.x + DX[d] * 4, y = e.y + DY[d] * 4;
      if (x < 0 || y < 0 || x > FIELD - s || y > FIELD - s) return true;
      return this.cellsIn(x, y, s, s, c => c === STONE || c === WATER) > 0;
    }

    brickAhead(e) {
      const s = e.size, x = e.x + DX[e.dir] * 4, y = e.y + DY[e.dir] * 4;
      if (this.cellsIn(x, y, s, s, c => c === MUD) > 0) return true;
      return !!(this.well && !this.well.dead && hit(x, y, s, s, this.well.x, this.well.y, 16, 16));
    }

    targetsFor(e) {
      const list = [], boss = e.kind < 0;
      // The boss duels the tanks; its raiders go for the well
      if (this.well && !this.well.dead) list.push({ x: this.well.x, y: this.well.y, w: boss ? 0.1 : 0.35 });
      const chase = boss ? 0.75 : Math.min(0.45, 0.15 + (this.stage.level || 0) * 0.02) * this.diff.chase;
      for (const pl of this.players) if (pl.tank) list.push({ x: pl.tank.x, y: pl.tank.y, w: chase / this.nPlayers });
      for (const c of this.camels) if (!c.dead && !c.arrived && c.x >= 0) list.push({ x: c.x, y: c.y, w: 0.4 / this.camels.length });
      if (e.kind === 0 && this.t > 600) {
        let best = null;
        for (const sk of this.skins) if (!sk.taken && (!best || dist(sk, e) < dist(best, e))) best = sk;
        if (best) list.push({ x: best.x, y: best.y, w: 0.35 });
      }
      return list;
    }

    think(e) {
      let target = null;
      if (!(this.whirl > 0)) {
        const list = this.targetsFor(e);
        let r = Math.random();
        for (const t of list) if ((r -= t.w) <= 0) { target = t; break; }
      }
      let options;
      if (target) {
        const dx = target.x - e.x, dy = target.y - e.y, h = dx > 0 ? 1 : 3, v = dy > 0 ? 2 : 0;
        options = Math.abs(dx) > Math.abs(dy) ? [h, v] : [v, h];
        if (Math.abs(dx) < 4) options = [v, h];
        else if (Math.abs(dy) < 4) options = [h, v];
        if (Math.random() < 0.25) options.reverse();
      } else options = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      let dir = options[0];
      for (const d of options.concat([2, 1, 3, 0].sort(() => Math.random() - 0.5))) {
        if (!this.hardBlocked(e, d)) { dir = d; break; }
      }
      if (e.blocked && dir === e.dir && !this.brickAhead(e)) dir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
      this.turn(e, dir);
      e.aiTimer = 40 + Math.floor(Math.random() * 120);
      e.stuck = 0;
    }

    inSight(e) {
      const targets = [];
      if (this.well && !this.well.dead) targets.push(this.well);
      for (const pl of this.players) if (pl.tank) targets.push(pl.tank);
      for (const c of this.camels) if (!c.dead && !c.arrived) targets.push(c);
      const half = e.size / 2 - 8;
      for (const t of targets) {
        const ax = Math.abs(t.x - e.x - half) < 10 + half, ay = Math.abs(t.y - e.y - half) < 10 + half;
        if ((e.dir === 0 && ax && t.y < e.y) || (e.dir === 2 && ax && t.y > e.y) ||
          (e.dir === 1 && ay && t.x > e.x) || (e.dir === 3 && ay && t.x < e.x)) return true;
      }
      return false;
    }

    updateEnemy(e) {
      if (e.flash > 0) e.flash--;
      if (e.cooldown > 0) e.cooldown--;
      if (e.burst && --e.burstTimer <= 0) { e.burst = 0; this.shoot(e, 0, ENEMY[1].bullet * this.diff.eBullet, 1, false); this.sound('eshoot'); }
      if (this.sinking(e)) { e.moving = false; return; }
      const spec = e.kind < 0 ? BOSS : ENEMY[e.kind];
      const confused = this.whirl > 0;
      const speed = spec.speed * this.diff.eSpeed * (1 + Math.min(0.25, (this.stage.level || 0) * 0.01)) * this.terrainFactor(e) * (confused ? 0.6 : 1);
      // The mortar stops to fire; the miner drops mines as it goes
      if (spec.mortar || e.kind < 0) {
        if (--e.special <= 0 && !confused && this.launchShell(e)) e.special = (e.kind < 0 ? 200 : 230) + Math.random() * 120;
        if (e.hold > 0) { e.hold--; e.moving = false; return; }
      }
      if (spec.mines && --e.special <= 0) { this.dropMine(e); e.special = 240 + Math.random() * 140; }
      e.aiTimer--;
      if (e.aiTimer <= 0 || (e.blocked && (e.stuck > 12 || Math.random() < 0.04))) this.think(e);
      if (confused && Math.random() < 0.02) this.think(e);
      e.moving = this.moveTank(e, speed);
      e.stuck = e.blocked ? e.stuck + 1 : 0;
      if (e.moving) e.anim++;
      if (!spec.fire) return;
      let chance = 0.018 * spec.fire * this.diff.eFire * (1 + Math.min(1, (this.stage.level || 0) * 0.04));
      if (e.blocked && this.brickAhead(e)) chance *= 4;
      if (!confused && this.inSight(e)) chance *= 5;
      if (confused) chance *= 0.3;
      if (Math.random() < chance) this.fire(e);
    }

    // ---------- mortar shells and mines ----------
    launchShell(e) {
      const options = [];
      for (const pl of this.players) if (pl.tank) options.push(pl.tank, pl.tank, pl.tank);
      // Shells fly over walls, so only ordinary mortars aim at the well, and not often; the boss aims at tanks
      if (this.well && !this.well.dead && e.kind >= 0) options.push(this.well);
      for (const c of this.camels) if (!c.dead && !c.arrived && c.x >= 0) options.push(c, c);
      if (!options.length) return false;
      const tg = options[Math.floor(Math.random() * options.length)];
      const sx = e.x + e.size / 2, sy = e.y + e.size / 2;
      const tx = tg.x + 8 + (Math.random() - 0.5) * 10, ty = tg.y + 8 + (Math.random() - 0.5) * 10;
      const dur = Math.round(60 + Math.hypot(tx - sx, ty - sy) * 0.15);
      this.shells.push({ sx, sy, tx, ty, t: 0, dur });
      e.hold = 30;
      this.sound('mortar');
      this.sound('whistle');
      return true;
    }

    updateShells() {
      for (const s of this.shells) {
        if (++s.t < s.dur) continue;
        s.done = true;
        this.effects.push({ x: s.tx, y: s.ty, kind: 'big', t: 8, light: true });
        this.sound('boom');
        const r = 12;
        for (const pl of this.players) {
          const p = pl.tank;
          if (p && Math.hypot(p.x + 8 - s.tx, p.y + 8 - s.ty) < r + 4) this.damagePlayer(p, 2);
        }
        for (const c of this.camels) if (!c.dead && !c.arrived && Math.hypot(c.x + 8 - s.tx, c.y + 8 - s.ty) < r + 4) this.damageCamel(c, 1);
        if (this.well && !this.well.dead && Math.hypot(this.well.x + 8 - s.tx, this.well.y + 8 - s.ty) < r + 2) this.damageWell(1);
        const cx0 = Math.floor((s.tx - 8) / 4), cy0 = Math.floor((s.ty - 8) / 4);
        for (let cy = cy0; cy < cy0 + 4; cy++) for (let cx = cx0; cx < cx0 + 4; cx++) {
          if (cx >= 0 && cy >= 0 && cx < NC && cy < NC && this.map[cy * NC + cx] === MUD && Math.hypot(cx * 4 + 2 - s.tx, cy * 4 + 2 - s.ty) < 9) this.setCell(cx, cy, EMPTY);
        }
      }
      this.shells = this.shells.filter(s => !s.done);
    }

    dropMine(e) {
      if (this.mines.length >= 6) return;
      const x = e.x + 8 - DX[e.dir] * 12 - 4, y = e.y + 8 - DY[e.dir] * 12 - 4;
      if (x < 0 || y < 0 || x > FIELD - 8 || y > FIELD - 8 || this.cellsIn(x, y, 8, 8, c => c !== EMPTY && c !== DUNE)) return;
      if (y < 20 || this.mines.some(m => Math.hypot(m.x - x, m.y - y) < 24)) return;
      if (this.well && hit(x, y, 8, 8, 80, 176, 48, 32)) return;
      this.mines.push({ x, y, t: 0 });
      this.sound('mine');
    }

    updateMines() {
      for (const m of this.mines) {
        if (++m.t < 40 || m.done) continue;
        for (const pl of this.players) {
          const p = pl.tank;
          if (p && !m.done && hit(p.x + 2, p.y + 2, 12, 12, m.x + 1, m.y + 1, 6, 6)) { this.explodeMine(m); this.damagePlayer(p, 2); }
        }
        for (const c of this.camels) {
          if (!m.done && !c.dead && !c.arrived && hit(c.x + 2, c.y + 2, 12, 12, m.x + 1, m.y + 1, 6, 6)) { this.explodeMine(m); this.damageCamel(c, 1); }
        }
      }
      this.mines = this.mines.filter(m => !m.done);
    }

    explodeMine(m) {
      if (m.done) return;
      m.done = true;
      this.effects.push({ x: m.x + 4, y: m.y + 4, kind: 'small', t: 0, light: true });
      this.sound('boom');
    }

    // ---------- bullets ----------
    killBullet(b, boom, dust) {
      if (b.dead) return;
      b.dead = true;
      b.owner.bullets = Math.max(0, b.owner.bullets - 1);
      if (boom) this.effects.push({ x: b.x, y: b.y, kind: dust ? 'dust' : 'small', t: 0 });
    }

    updateBullets() {
      for (const b of this.bullets) {
        b.age++;
        const steps = Math.ceil(b.speed / 2), s = b.speed / steps;
        for (let i = 0; i < steps && !b.dead; i++) {
          b.x += DX[b.dir] * s; b.y += DY[b.dir] * s;
          this.bulletStep(b);
        }
      }
      this.bullets = this.bullets.filter(b => !b.dead);
    }

    bulletStep(b) {
      if (b.x - 2 < 0 || b.y - 2 < 0 || b.x + 2 > FIELD || b.y + 2 > FIELD) {
        b.x = Math.max(2, Math.min(FIELD - 2, b.x)); b.y = Math.max(2, Math.min(FIELD - 2, b.y));
        this.killBullet(b, true);
        if (b.team === 'p') this.sound('wall');
        return;
      }
      const terrain = this.bulletTerrain(b);
      if (terrain) { this.killBullet(b, true, terrain === 'mud'); return; }
      const bx = b.x - 2, by = b.y - 2;
      if (this.well && hit(bx, by, 4, 4, this.well.x, this.well.y, 16, 16)) {
        this.killBullet(b, true);
        // The players' own shells never hurt the well
        if (!this.well.dead && b.team !== 'p') this.damageWell(1);
        return;
      }
      if (b.team === 'p') {
        for (const tw of this.towers) {
          if (tw.dead || !hit(bx, by, 4, 4, tw.x, tw.y, 16, 16)) continue;
          this.killBullet(b, true);
          this.damageTower(tw, b.dmg);
          return;
        }
        for (const m of this.mines) {
          if (m.done || !hit(bx, by, 4, 4, m.x, m.y, 8, 8)) continue;
          this.killBullet(b, false);
          this.explodeMine(m);
          this.addScore(25, m.x + 4, m.y + 4);
          return;
        }
      } else {
        for (const c of this.camels) {
          if (c.dead || c.arrived || !hit(bx, by, 4, 4, c.x + 2, c.y + 2, 12, 12)) continue;
          this.killBullet(b, true);
          this.damageCamel(c, 1);
          return;
        }
      }
      for (const t of this.tanks) {
        if (t.dead || t === b.owner || !hit(bx, by, 4, 4, t.x + 1, t.y + 1, t.size - 2, t.size - 2)) continue;
        if (t.team === b.team) {
          if (t.team !== 'p') continue;
          // A teammate's shell only stuns
          this.killBullet(b, true);
          t.stun = 45;
          return;
        }
        this.killBullet(b, true);
        this.hitTank(t, b);
        return;
      }
      for (const o of this.bullets) {
        if (o === b || o.dead || o.team === b.team || !hit(bx, by, 4, 4, o.x - 2, o.y - 2, 4, 4)) continue;
        this.killBullet(b, false); this.killBullet(o, false);
        return;
      }
    }

    // A shell checks the cells under its nose; on impact it clears a 16px-wide band of mud
    bulletTerrain(b) {
      const vertical = (b.dir & 1) === 0;
      const lead = b.dir === 0 ? b.y - 2 : b.dir === 2 ? b.y + 1.999 : b.dir === 1 ? b.x + 1.999 : b.x - 2;
      const lc = Math.floor(lead / 4), perp = vertical ? b.x : b.y;
      const at = (p, l) => (vertical ? this.map[l * NC + p] : this.map[p * NC + l]);
      let hitAny = false, stone = false;
      for (let p = Math.floor((perp - 4) / 4); p <= Math.floor((perp + 3.999) / 4); p++) {
        if (p < 0 || p >= NC || lc < 0 || lc >= NC) continue;
        const c = at(p, lc);
        if (c === MUD) hitAny = true;
        else if (c === STONE) { hitAny = true; stone = true; }
      }
      if (!hitAny) return false;
      const fwd = b.dir === 0 || b.dir === 3 ? -1 : 1, depth = b.power ? 2 : 1;
      const w0 = Math.max(0, Math.floor((perp - 8) / 4)), w1 = Math.min(NC - 1, Math.floor((perp + 7.999) / 4));
      let broke = false, brokeStone = false;
      for (let d = 0; d < depth; d++) {
        const l = lc + d * fwd;
        if (l < 0 || l >= NC) continue;
        for (let p = w0; p <= w1; p++) {
          const cx = vertical ? p : l, cy = vertical ? l : p, c = this.map[cy * NC + cx];
          if (c === MUD) { this.setCell(cx, cy, EMPTY); broke = true; }
          else if (c === STONE && b.power) {
            const bx = cx & ~1, by = cy & ~1;
            for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (this.map[(by + oy) * NC + bx + ox] === STONE) this.setCell(bx + ox, by + oy, EMPTY);
            brokeStone = true;
          }
        }
      }
      if (b.team === 'p') this.sound(stone && !brokeStone ? 'stone' : 'mud');
      else if (broke) this.sound('wall');
      return stone && !brokeStone ? 'stone' : 'mud';
    }

    hitTank(t, b) {
      if (t.team === 'p') {
        if (t.shield > 0) { this.sound('stone'); return; }
        this.damagePlayer(t, b.dmg);
        return;
      }
      this.damageEnemy(t, b.dmg);
    }

    damageEnemy(e, dmg) {
      if (e.dead) return;
      if (e.bonus) { e.bonus = false; this.spawnPowerup(); }
      e.hp -= dmg;
      if (e.hp > 0) { e.flash = 12; this.sound('armor'); return; }
      this.killEnemy(e);
    }

    killEnemy(e, silent) {
      e.dead = true;
      const spec = e.kind < 0 ? BOSS : ENEMY[e.kind];
      this.effects.push({ x: e.x + e.size / 2, y: e.y + e.size / 2, kind: 'big', t: 0, light: true, scale: e.size / 16 });
      if (!silent) {
        if (e.kind < 0) this.stats.boss++; else this.stats.kills[e.kind]++;
        this.addScore(spec.score, e.x + e.size / 2, e.y + e.size / 2);
        this.coins += spec.coins;
        const recent = this.stats.recentKills;
        recent.push(this.t);
        while (recent.length && this.t - recent[0] > 600) recent.shift();
        if (recent.length >= 5) this.stats.combo = true;
      }
      this.sound(e.kind < 0 ? 'tower' : 'boom');
      this.vibrate(e.kind < 0 ? [120, 60, 200] : 12);
      if (e.kind < 0) this.boss = null;
    }

    damagePlayer(p, dmg) {
      if (p.dead || p.shield > 0) return;
      p.hp -= dmg;
      p.flash = 14;
      this.stats.hpLost += dmg;
      this.sound('hurt');
      this.vibrate(60);
      if (p.hp <= 0) this.killPlayer(p);
    }

    killPlayer(p) {
      const pl = this.players[p.pid];
      p.dead = true;
      pl.tank = null;
      this.effects.push({ x: p.x + 8, y: p.y + 8, kind: 'big', t: 0, light: true });
      this.sound('die');
      this.vibrate(220);
      pl.level = Math.min(3, pl.upg.cannon);
      pl.lives--;
      this.stats.deaths++;
      if (pl.lives > 0) pl.respawn = 50;
      else if (this.players.every(q => q.lives <= 0)) this.lose('lives');
    }

    damageWell(n) {
      const w = this.well;
      w.hp -= n;
      w.flash = 16;
      w.calm = 0;
      this.stats.wellDamaged = true;
      this.sound('wellhit');
      this.vibrate(80);
      if (w.hp > 0) { this.toast('البئر في خطر!'); return; }
      w.dead = true;
      this.effects.push({ x: w.x + 8, y: w.y + 8, kind: 'big', t: 0, light: true });
      this.sound('welldown');
      this.vibrate([180, 80, 320]);
      this.lose('well');
    }

    damageCamel(c, n) {
      c.hp -= n;
      c.flash = 14;
      this.sound('camel');
      if (c.hp > 0) return;
      c.dead = true;
      this.stats.camelsLost++;
      this.effects.push({ x: c.x + 8, y: c.y + 8, kind: 'dust', t: 0 });
      this.toast('سقط جمل من القافلة!');
      const alive = this.camels.filter(k => !k.dead && !k.arrived).length;
      if (this.stats.camelsArrived + alive < this.need) this.lose('camels');
    }

    damageTower(tw, dmg) {
      tw.hp -= dmg;
      tw.flash = 10;
      if (tw.hp > 0) { this.sound('armor'); return; }
      tw.dead = true;
      this.stats.towers++;
      this.effects.push({ x: tw.x + 8, y: tw.y + 8, kind: 'big', t: 0, light: true });
      this.addScore(500, tw.x + 8, tw.y + 8);
      this.coins += 30;
      this.sound('tower');
      this.vibrate([60, 40, 120]);
      if (Math.random() < 0.5) this.spawnPowerup(tw.x, tw.y);
      const left = this.towers.filter(t => !t.dead).length;
      this.toast(left ? 'تهدّم برج! بقي ' + left : 'تهدّمت كل الأبراج!');
    }

    lose(reason) {
      // Once the stage is won, a stray bullet or mine during the victory moment can't undo it
      if (this.state !== 'play') return;
      this.state = 'over';
      this.endTimer = 0;
      this.loseReason = reason;
      this.emit('dying', { reason });
    }

    win() {
      if (this.state !== 'play') return;
      this.state = 'won';
      this.endTimer = 0;
      // The remaining raiders scatter
      for (const e of this.tanks) if (e.team === 'e' && !e.dead) this.killEnemy(e, true);
      this.spawns = this.spawns.filter(s => s.team === 'p');
      this.shells = [];
      this.sound('clear');
    }

    addScore(n, x, y) {
      this.score += n;
      if (x != null) this.popups.push({ x, y, text: '+' + n, t: 0 });
    }

    toast(text) { this.emit('toast', text); }

    // ---------- the caravan ----------
    updateCamels() {
      this.camels.forEach((c, idx) => {
        if (c.dead || c.arrived) return;
        if (c.flash > 0) c.flash--;
        const [tx, ty] = this.waypoints[c.wp];
        const dx = tx - c.x, dy = ty - c.y, step = 0.24;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          c.x = tx; c.y = ty;
          if (++c.wp >= this.waypoints.length) {
            c.arrived = true;
            this.stats.camelsArrived++;
            this.addScore(300, Math.min(200, c.x), c.y + 8);
            this.coins += 15;
            this.sound('coin');
            this.toast('وصل جمل بسلام! ' + this.stats.camelsArrived + ' من ' + this.need);
          }
          return;
        }
        const nx = c.x + Math.sign(dx) * Math.min(step, Math.abs(dx)), ny = Math.abs(dx) >= 0.5 ? c.y : c.y + Math.sign(dy) * Math.min(step, Math.abs(dy));
        const mx = Math.abs(dx) >= 0.5 ? nx : c.x;
        // Camels wait for anything standing on the road ahead, and keep behind the camel in front
        let ahead = null;
        for (let j = idx - 1; j >= 0 && !ahead; j--) if (!this.camels[j].dead && !this.camels[j].arrived) ahead = this.camels[j];
        // Camels walk past the players' tanks but wait for raiders, who soon move aside
        const blocker = this.tanks.find(t => !t.dead && t.team === 'e' && hit(mx + 1, ny + 1, 14, 14, t.x, t.y, t.size, t.size));
        if (blocker && ++c.waited > 45) {
          blocker.dir = (blocker.dir + 2) % 4;
          blocker.aiTimer = 90;
          c.waited = 0;
        }
        if (blocker || (ahead && Math.hypot(ahead.x - mx, ahead.y - ny) < 22)) return;
        c.waited = 0;
        if (Math.abs(dx) >= 0.5) c.left = dx < 0;
        c.x = mx; c.y = ny;
        c.anim++;
      });
      if (this.stats.camelsArrived >= this.need && this.camels.every(c => c.dead || c.arrived)) this.win();
    }

    // ---------- power-ups ----------
    spawnPowerup(nx, ny) {
      const pool = POWERUPS.filter(p => (p !== 'mason' || this.well) && (p !== 'falcon' || this.tanks.some(t => t.team === 'e')));
      const type = pool[Math.floor(Math.random() * pool.length)];
      for (let i = 0; i < 60; i++) {
        const x = i === 0 && nx != null ? nx : Math.floor(Math.random() * 25) * 8, y = i === 0 && ny != null ? ny : Math.floor(Math.random() * 25) * 8;
        if (this.well && hit(x, y, 16, 16, 80, 176, 48, 32)) continue;
        if (this.cellsIn(x, y, 16, 16, c => c === STONE || c === WATER) > 2) continue;
        if (this.towers.some(t => !t.dead && hit(x, y, 16, 16, t.x, t.y, 16, 16))) continue;
        this.powerup = { type, x, y, t: 0 };
        this.sound('appear');
        return;
      }
    }

    updatePowerup() {
      const pu = this.powerup;
      if (!pu) return;
      if (++pu.t > 1200) { this.powerup = null; return; }
      for (const pl of this.players) {
        const p = pl.tank;
        if (!p || !hit(p.x + 2, p.y + 2, 12, 12, pu.x, pu.y, 16, 16)) continue;
        this.powerup = null;
        this.addScore(500, pu.x + 8, pu.y + 8);
        this.coins += 5;
        this.vibrate(25);
        this.applyPowerup(pu.type, pl);
        this.emit('powerup', pu.type);
        return;
      }
    }

    applyPowerup(type, pl) {
      const p = pl.tank;
      switch (type) {
        case 'shield': p.shield = 600; this.sound('shield'); break;
        case 'whirl': this.whirl = 600; this.sound('whirl'); break;
        case 'mason': this.mason = 1200; this.setFortress(STONE); this.sound('mason'); break;
        case 'hammer': pl.level = Math.min(3, pl.level + 1); this.sound('hammer'); break;
        case 'falcon': this.launchFalcon(p); break;
        case 'dates': pl.lives++; p.hp = p.max; this.sound('life'); break;
        case 'coffee': pl.coffee = 600; this.sound('coffee'); break;
        case 'qirba':
          if (this.well && !this.well.dead) this.well.hp = this.well.max;
          else if (this.camels.length) for (const c of this.camels) { if (!c.dead && !c.arrived) c.hp = c.max; }
          else for (const q of this.players) if (q.tank) q.tank.hp = q.tank.max;
          this.sound('water');
          break;
      }
    }

    // ---------- the falcon ----------
    launchFalcon(from) {
      const enemies = this.tanks.filter(t => t.team === 'e' && !t.dead);
      if (!enemies.length || !from) return false;
      enemies.sort((a, b) => dist(a, from) - dist(b, from));
      this.birds.push({ id: this.nextId++, x: from.x + 8, y: from.y + 8, targets: enemies.slice(0, 3), i: 0, t: 0, angle: -Math.PI / 2, leaving: false, pid: from.pid });
      this.stats.falconUses++;
      this.sound('falcon');
      return true;
    }

    falconsOf(pid) { return this.sharedFalcons ? this.falcons : (this.players[pid] || {}).falcons || 0; }

    useFalcon(pid) {
      const pl = this.players[pid || 0];
      if (this.state !== 'play' || this.falconsOf(pid || 0) <= 0 || !pl || !pl.tank) return false;
      if (!this.launchFalcon(pl.tank)) return false;
      if (this.sharedFalcons) this.falcons--; else pl.falcons--;
      this.emit('falcons', { pid: pid || 0, n: this.falconsOf(pid || 0), shared: this.sharedFalcons });
      return true;
    }

    updateBirds() {
      for (const b of this.birds) {
        b.t++;
        let tx, ty;
        if (!b.leaving) {
          while (b.i < b.targets.length && b.targets[b.i].dead) b.i++;
          if (b.i >= b.targets.length) b.leaving = true;
        }
        if (b.leaving) { tx = b.x + Math.cos(b.angle) * 50; ty = -40; }
        else { const e = b.targets[b.i]; tx = e.x + e.size / 2; ty = e.y + e.size / 2; }
        const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy), sp = 3.6;
        b.angle = Math.atan2(dy, dx);
        if (!b.leaving && d < 6) {
          const e = b.targets[b.i];
          this.effects.push({ x: b.x, y: b.y, kind: 'small', t: 0, light: true });
          this.sound('strike');
          this.damageEnemy(e, e.kind < 0 ? 4 : 3);
          b.i++;
          continue;
        }
        b.x += (dx / (d || 1)) * Math.min(sp, d);
        b.y += (dy / (d || 1)) * Math.min(sp, d);
        if (b.leaving && b.y < -30) b.done = true;
        if (b.t > 900) b.done = true;
      }
      this.birds = this.birds.filter(b => !b.done);
    }

    // ---------- main tick ----------
    update() {
      if (this.state === 'intro' || this.state === 'idle' || this.state === 'ended' || this.state === 'clear') return;
      this.t++;
      if (this.t % 40 === 0) {
        this.waterFrame = (this.waterFrame + 1) & 7;
        for (const i of this.animCells) this.paintCell(i % NC, Math.floor(i / NC));
      }
      if (this.whirl > 0) this.whirl--;
      if (this.mason > 0) {
        this.mason--;
        if (this.mason === 0) this.setFortress(MUD);
        else if (this.mason < 180 && this.mason % 15 === 0) this.setFortress((this.mason / 15) % 2 ? MUD : STONE);
      }
      if (this.well && this.well.flash > 0) this.well.flash--;
      // The oasis folk patch the well up after a quiet spell
      if (this.well && !this.well.dead && this.well.hp < this.well.max && ++this.well.calm >= 900) {
        this.well.hp++;
        this.well.calm = 0;
        this.toast('أهل الواحة رمّموا البئر');
        this.sound('water');
      }
      for (const pl of this.players) if (pl.respawn > 0 && --pl.respawn === 0 && this.state === 'play') this.spawnPlayer(pl);
      if (this.state === 'play') this.enemySpawner();
      this.updateSpawns();
      for (const pl of this.players) this.updatePlayer(pl);
      for (const t of this.tanks) if (t.team === 'e' && !t.dead) this.updateEnemy(t);
      if (this.camels.length && this.state === 'play') this.updateCamels();
      this.updateBullets();
      this.updateShells();
      this.updateMines();
      this.updateBirds();
      this.updatePowerup();
      this.updateSkins();
      for (const tw of this.towers) if (tw.flash > 0) tw.flash--;
      for (const e of this.effects) e.t++;
      this.effects = this.effects.filter(e => e.t < (e.kind === 'big' ? 35 : 12));
      for (const p of this.popups) p.t++;
      this.popups = this.popups.filter(p => p.t < 50);
      this.tanks = this.tanks.filter(t => !t.dead);
      if (this.state === 'play') this.checkMission();
      if (this.state === 'won' && ++this.endTimer === 120) this.finish(true);
      if (this.state === 'over' && ++this.endTimer === 200) this.finish(false);
    }

    updateSkins() {
      for (const sk of this.skins) {
        if (sk.taken) continue;
        const thief = this.tanks.some(e => e.team === 'e' && !e.dead && hit(e.x + 2, e.y + 2, e.size - 4, e.size - 4, sk.x + 2, sk.y + 2, 12, 12));
        sk.steal = thief ? (sk.steal || 0) + 1 : 0;
        if (sk.steal === 1) this.toast('العقارب يسرقون قِربة!');
        if (sk.steal >= 50) {
          sk.taken = 'e';
          this.stats.skinsStolen++;
          this.effects.push({ x: sk.x + 8, y: sk.y + 8, kind: 'dust', t: 0 });
          this.toast('سرق العقارب قِربة!');
          if (this.skins.length - this.stats.skinsStolen < this.need) this.lose('skins');
        }
      }
    }

    checkMission() {
      const enemiesLeft = this.tanks.some(t => t.team === 'e') || this.spawns.some(s => s.team === 'e');
      switch (this.mission) {
        case 'defend': if (!this.queue.length && !enemiesLeft) this.win(); break;
        case 'collect': if (this.stats.skinsCollected >= this.need) this.win(); break;
        case 'towers': if (this.towers.length && this.towers.every(t => t.dead)) this.win(); break;
        case 'survive':
          if (--this.timer <= 0) { this.timer = 0; this.toast('طلع الفجر!'); this.win(); }
          else if (this.timer === 1200) this.toast('بقيت عشرون ثانية حتى الفجر');
          break;
        case 'boss': if (this.t > 120 && !this.boss && !this.spawns.some(s => s.big)) this.win(); break;
      }
    }

    finish(won) {
      this.state = 'ended';
      const st = this.stats;
      let stars = 0;
      if (won) {
        stars = 1;
        if (st.deaths === 0) stars++;
        const perfect = this.mission === 'escort' ? st.camelsLost === 0 : this.mission === 'collect' ? st.skinsStolen === 0 : !st.wellDamaged;
        if (perfect) stars++;
        this.coins += 50 + stars * 25;
      }
      this.result = {
        won, stars, score: this.score, coins: won ? this.coins : Math.round(this.coins / 2), reason: this.loseReason,
        stats: st, mission: this.mission, stage: this.stage, players: this.nPlayers, difficulty: this.difficulty,
        noDamage: st.hpLost === 0,
      };
      this.emit(won ? 'clear' : 'gameover', this.result);
    }

    // ---------- what the HUD shows ----------
    objective() {
      if (this.remote) return this.remoteObjective || { icon: 'foe', value: 0 };
      const st = this.stats;
      switch (this.mission) {
        case 'defend': return { icon: 'foe', value: this.queue.length + this.tanks.filter(t => t.team === 'e').length + this.spawns.filter(s => s.team === 'e').length, label: 'الأعداء' };
        case 'collect': return { icon: 'skin', value: st.skinsCollected, max: this.need, label: 'القِرَب' };
        case 'towers': return { icon: 'tower', value: this.towers.filter(t => !t.dead).length, label: 'الأبراج' };
        case 'escort': return { icon: 'camel', value: st.camelsArrived, max: this.need, label: 'الجمال' };
        case 'survive': return { icon: 'moon', value: Math.ceil(this.timer / 60), time: true, label: 'حتى الفجر' };
        case 'boss': return { icon: 'boss', value: this.boss ? Math.max(0, this.boss.hp) : this.bossHp, max: this.bossHp, label: 'القلعة' };
      }
      return { icon: 'foe', value: 0 };
    }

    // ---------- online play: the host sends snapshots, the other phones only draw them ----------
    snapshot() {
      const q = v => Math.round(v * 4) / 4;
      return {
        t: this.t, st: this.state, sc: this.score, wf: this.waterFrame, wh: this.whirl, ms: this.mason, ob: this.objective(),
        pl: this.players.map(p => [p.lives, p.level, p.coffee > 0 ? 1 : 0, this.falconsOf(p.pid)]),
        tk: this.tanks.map(t => [t.id, t.team === 'p' ? 1 : 0, t.kind, t.pid == null ? -1 : t.pid, q(t.x), q(t.y), t.dir, t.hp, t.max,
          t.anim & 255, t.shield > 0 ? 1 : 0, t.flash, t.bonus ? 1 : 0, t.stun, t.sink, t.moving ? 1 : 0]),
        bu: this.bullets.map(b => [b.id, q(b.x), q(b.y), b.dir, b.team === 'p' ? 1 : 0, b.age]),
        sh: this.shells.map(x => [q(x.sx), q(x.sy), q(x.tx), q(x.ty), x.t, x.dur]),
        mi: this.mines.map(m => [m.x, m.y, m.t]),
        tw: this.towers.map(t => [t.hp, t.max, t.dead ? 1 : 0, t.flash]),
        ca: this.camels.map(c => [q(c.x), q(c.y), c.hp, c.max, c.left ? 1 : 0, c.anim, c.dead ? 1 : 0, c.arrived ? 1 : 0, c.flash]),
        sk: this.skins.map(k => [k.taken === 'p' ? 1 : k.taken ? 2 : 0, k.steal || 0]),
        pu: this.powerup ? [this.powerup.type, this.powerup.x, this.powerup.y, this.powerup.t] : null,
        sp: this.spawns.map(x => [x.x, x.y, x.t, x.big ? 1 : 0]),
        bi: this.birds.map(b => [b.id, q(b.x), q(b.y), Math.round(b.angle * 100) / 100, b.t]),
        fx: this.effects.map(e => [q(e.x), q(e.y), e.kind, e.t, e.scale || 1, e.light ? 1 : 0]),
        po: this.popups.map(x => [q(x.x), q(x.y), x.text, x.t]),
        we: this.well ? [this.well.hp, this.well.max, this.well.dead ? 1 : 0, this.well.flash] : null,
        tm: [this.timer, this.timerMax || 0],
        ce: this.cellLog.splice(0),
      };
    }

    applySnapshot(s, prev) {
      this.remote = true;
      this.t = s.t; this.state = s.st; this.score = s.sc; this.whirl = s.wh; this.mason = s.ms; this.remoteObjective = s.ob;
      this.timer = s.tm[0]; this.timerMax = s.tm[1];
      if (s.wf !== this.waterFrame) { this.waterFrame = s.wf; for (const i of this.animCells) this.paintCell(i % NC, Math.floor(i / NC)); }
      for (let i = 0; i + 1 < s.ce.length; i += 2) {
        const idx = s.ce[i];
        if (idx < 0 || idx >= this.map.length) continue;
        this.map[idx] = s.ce[i + 1];
        this.paintCell(idx % NC, Math.floor(idx / NC));
      }
      s.pl.forEach((a, i) => {
        const p = this.players[i];
        if (!p) return;
        p.lives = a[0]; p.level = a[1]; p.coffee = a[2]; p.falcons = a[3]; p.tank = null;
      });
      const before = id => prev && prev.get(id);
      const moved = (o, x, y, id) => {
        const b = before(id), known = b && b[0] != null;
        o.nx = x; o.ny = y; o.px = known ? b[0] : x; o.py = known ? b[1] : y; o.x = x; o.y = y;
        return o;
      };
      this.tanks = s.tk.map(a => {
        const t = moved({ id: a[0], team: a[1] ? 'p' : 'e', kind: a[2], pid: a[3] < 0 ? undefined : a[3], dir: a[6], hp: a[7], max: a[8],
          anim: a[9], shield: a[10], flash: a[11], bonus: !!a[12], stun: a[13], sink: a[14], moving: !!a[15] }, a[4], a[5], 't' + a[0]);
        t.size = t.team === 'e' && t.kind < 0 ? 32 : 16;
        if (t.team === 'p' && this.players[t.pid]) this.players[t.pid].tank = t;
        return t;
      });
      this.boss = this.tanks.find(t => t.team === 'e' && t.kind < 0) || null;
      this.bullets = s.bu.map(a => moved({ id: a[0], dir: a[3], team: a[4] ? 'p' : 'e', age: a[5] }, a[1], a[2], 'b' + a[0]));
      this.shells = s.sh.map(a => ({ sx: a[0], sy: a[1], tx: a[2], ty: a[3], t: a[4], dur: a[5] }));
      this.mines = s.mi.map(a => ({ x: a[0], y: a[1], t: a[2] }));
      s.tw.forEach((a, i) => { const t = this.towers[i]; if (t) { t.hp = a[0]; t.max = a[1]; t.dead = !!a[2]; t.flash = a[3]; } });
      s.ca.forEach((a, i) => {
        const c = this.camels[i];
        if (!c) return;
        moved(c, a[0], a[1], 'c' + i);
        c.hp = a[2]; c.max = a[3]; c.left = !!a[4]; c.anim = a[5]; c.dead = !!a[6]; c.arrived = !!a[7]; c.flash = a[8];
      });
      s.sk.forEach((a, i) => { const k = this.skins[i]; if (k) { k.taken = a[0] === 1 ? 'p' : a[0] === 2 ? 'e' : false; k.steal = a[1]; } });
      this.powerup = s.pu ? { type: s.pu[0], x: s.pu[1], y: s.pu[2], t: s.pu[3] } : null;
      this.spawns = s.sp.map(a => ({ x: a[0], y: a[1], t: a[2], big: !!a[3] }));
      this.birds = s.bi.map(a => moved({ id: a[0], angle: a[3], t: a[4] }, a[1], a[2], 'f' + a[0]));
      this.effects = s.fx.map(a => ({ x: a[0], y: a[1], kind: a[2], t: a[3], scale: a[4], light: !!a[5] }));
      this.popups = s.po.map(a => ({ x: a[0], y: a[1], text: a[2], t: a[3] }));
      if (s.we && this.well) { this.well.hp = s.we[0]; this.well.max = s.we[1]; this.well.dead = !!s.we[2]; this.well.flash = s.we[3]; }
    }

    // Positions of moving things in the last snapshot, so the next one can glide from them
    positions() {
      const m = new Map();
      for (const t of this.tanks) m.set('t' + t.id, [t.nx, t.ny]);
      for (const b of this.bullets) m.set('b' + b.id, [b.nx, b.ny]);
      for (const b of this.birds) m.set('f' + b.id, [b.nx, b.ny]);
      this.camels.forEach((c, i) => m.set('c' + i, [c.nx, c.ny]));
      return m;
    }

    glide(k) {
      const g = o => { if (o.nx == null) return; o.x = o.px + (o.nx - o.px) * k; o.y = o.py + (o.ny - o.py) * k; };
      this.tanks.forEach(g); this.bullets.forEach(g); this.birds.forEach(g); this.camels.forEach(g);
    }

    // ---------- drawing ----------
    render() {
      const g = this.fctx, fx = this.fx;
      if (this.bgDirty) { this.bgctx.putImageData(this.bgImg, 0, 0); this.bgDirty = false; }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.drawImage(this.bg, 0, 0);
      for (const tw of this.towers) if (tw.dead) g.drawImage(fx.rubble[(tw.x >> 4) & 1], tw.x, tw.y);
      for (const sk of this.skins) {
        if (sk.taken) continue;
        g.drawImage(fx.skin, sk.x + (sk.steal ? ((this.t >> 1) & 1) : 0), sk.y + ((this.t >> 4) & 1));
        if (sk.steal) { g.fillStyle = '#D2412E'; g.fillRect(sk.x + 2, sk.y - 3, Math.round(12 * sk.steal / 50), 2); }
      }
      for (const m of this.mines) g.drawImage(fx.mine[m.t < 40 || (this.t >> 3) & 1 ? 1 : 0], m.x, m.y);
      for (const s of this.shells) this.drawMarker(g, s);
      for (const d of this.dhows) g.drawImage(fx.dhow, d.x, d.y + Math.round(Math.sin(this.t / 40 + d.y) * 1.2));
      if (this.well) g.drawImage(fx.well[this.well.dead ? 2 : this.well.hp <= this.well.max / 2 ? 1 : 0], this.well.x, this.well.y);
      if (this.well && this.well.flash > 0 && (this.well.flash >> 1) & 1) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(this.well.x, this.well.y, 16, 16); }
      for (const tw of this.towers) {
        if (tw.dead) continue;
        g.drawImage(fx.tower[tw.hp <= tw.max / 3 ? 2 : tw.hp <= tw.max * 2 / 3 ? 1 : 0], tw.x, tw.y);
        if (tw.flash > 0 && (tw.flash >> 1) & 1) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(tw.x, tw.y, 16, 16); }
      }
      for (const l of this.lanterns) g.drawImage(fx.lantern, l.x, l.y);
      g.globalAlpha = 0.28;
      for (const t of this.tanks) g.drawImage(S.shadow(this.designOf(t), t.dir), Math.round(t.x) + 1, Math.round(t.y) + 2);
      g.globalAlpha = 1;
      for (const c of this.camels) {
        if (c.dead || c.arrived || c.x < -16) continue;
        const img = c.flash > 0 && (c.flash >> 1) & 1 ? fx.camelHurt[c.left ? 1 : 0] : fx.camel[c.left ? 1 : 0][(c.anim >> 3) & 1];
        g.drawImage(img, Math.round(c.x), Math.round(c.y));
      }
      for (const t of this.tanks) this.drawTank(g, t);
      for (const b of this.bullets) {
        const x = Math.round(b.x), y = Math.round(b.y);
        g.fillStyle = '#1B140C';
        g.fillRect(x - 2, y - 2, 4, 4);
        g.fillStyle = b.team === 'p' ? '#FFE27A' : '#FF6B4A';
        g.fillRect(x - 1, y - 1, 2, 2);
      }
      g.drawImage(this.trees, 0, 0);
      for (const s of this.shells) this.drawShell(g, s);
      for (const s of this.spawns) {
        const img = fx.devil[Math.floor(s.t / 4) % 4], n = s.big ? 32 : 16;
        g.drawImage(img, s.x, s.y, n, n);
      }
      if (this.powerup && (this.powerup.t < 900 || (this.powerup.t >> 3) % 2)) g.drawImage(fx.powerups[this.powerup.type], this.powerup.x, this.powerup.y);
      for (const e of this.effects) {
        let img;
        if (e.kind === 'small') img = fx.boomSmall[Math.min(2, Math.floor(e.t / 4))];
        else if (e.kind === 'dust') img = fx.dust[Math.min(2, Math.floor(e.t / 4))];
        else {
          const seq = [0, 1, 2, 3, 4, 3, 2], f = seq[Math.min(seq.length - 1, Math.floor(e.t / 5))];
          img = f < 3 ? fx.boomSmall[f] : fx.boomBig[f - 3];
        }
        const sc = e.scale || 1;
        g.drawImage(img, Math.round(e.x - img.width * sc / 2), Math.round(e.y - img.height * sc / 2), img.width * sc, img.height * sc);
      }
      for (const b of this.birds) this.drawBird(g, b);
      this.drawSky(g);
      return this.frame;
    }

    designOf(t) {
      if (t.team === 'p') return PLAYER[this.players[t.pid].level].design;
      return t.kind < 0 ? 'boss' : ENEMY[t.kind].design;
    }

    drawTank(g, t) {
      const fx = this.fx, design = this.designOf(t);
      let pal = t.team === 'p' ? PALETTES[t.pid] || 'p1' : 'enemy';
      if (t.team === 'e' && t.bonus && (this.t >> 3) & 1) pal = 'bonus';
      if (t.flash > 0 && (t.flash >> 1) & 1) pal = 'hit';
      if (t.stun > 0 && (this.t >> 2) & 1) pal = 'stun';
      const x = Math.round(t.x), y = Math.round(t.y) + (t.sink > 0 ? 1 : 0);
      g.drawImage(S.vehicle(design, pal, (t.anim >> 2) & 1, t.dir), x, y);
      if (t.shield > 0) g.drawImage((t.size === 32 ? fx.shieldBig : fx.shield)[(this.t >> 1) & 1], x, y);
      if (t.team === 'e' && this.whirl > 0) g.drawImage(fx.swirl[(this.t >> 2) & 3], x + (t.size - 16) / 2, y + (t.size - 16) / 2);
      if (t.sink > 0) g.drawImage(fx.dust[(this.t >> 3) % 3], x, y + 4);
      // Small health bar once a multi-hit vehicle is damaged
      if (t.max > 1 && t.hp < t.max && t.kind >= 0) {
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillRect(x + 2, y - 3, t.size - 4, 2);
        g.fillStyle = t.team === 'p' ? '#5BD17A' : '#FF6B4A';
        g.fillRect(x + 2, y - 3, Math.max(1, Math.round((t.size - 4) * t.hp / t.max)), 2);
      }
    }

    drawMarker(g, s) {
      if ((this.t >> 2) & 1) return;
      g.strokeStyle = '#D2412E';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(Math.round(s.tx) + 0.5, Math.round(s.ty) + 0.5, 5 + (s.t % 20) / 10, 0, Math.PI * 2);
      g.stroke();
    }

    drawShell(g, s) {
      const k = s.t / s.dur, x = s.sx + (s.tx - s.sx) * k, y = s.sy + (s.ty - s.sy) * k, h = Math.sin(k * Math.PI) * 34;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2);
      g.fillStyle = '#1B140C';
      g.fillRect(Math.round(x) - 2, Math.round(y - h) - 2, 4, 4);
      g.fillStyle = '#8A8A8A';
      g.fillRect(Math.round(x) - 1, Math.round(y - h) - 1, 1, 1);
    }

    drawBird(g, b) {
      const img = this.fx.falcon[(b.t >> 2) & 1];
      g.save();
      g.globalAlpha = 0.25;
      g.translate(Math.round(b.x) + 3, Math.round(b.y) + 9);
      g.rotate(b.angle + Math.PI / 2);
      g.filter = 'brightness(0)';
      g.drawImage(img, -8, -8);
      g.restore();
      g.save();
      g.translate(Math.round(b.x), Math.round(b.y));
      g.rotate(b.angle + Math.PI / 2);
      g.drawImage(img, -8, -8);
      g.restore();
    }

    // Time of day: dawn and dusk tint the scene; at night only lights cut through the dark
    drawSky(g) {
      if (TINT[this.time]) {
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = TINT[this.time][0];
        g.fillRect(0, 0, FIELD, FIELD);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = TINT[this.time][1];
        g.fillRect(0, 0, FIELD, FIELD);
        return;
      }
      if (this.time !== 'night') return;
      const d = this.darkctx;
      let alpha = 0.86;
      if (this.mission === 'survive' && this.timerMax) {
        const left = this.timer / this.timerMax;
        if (left < 0.25) alpha = 0.2 + 0.66 * (left / 0.25);
      }
      if (this.state === 'won' || this.state === 'ended') alpha = 0.2;
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, FIELD, FIELD);
      d.fillStyle = 'rgba(6,10,28,' + alpha.toFixed(3) + ')';
      d.fillRect(0, 0, FIELD, FIELD);
      d.globalCompositeOperation = 'destination-out';
      const light = (x, y, r) => {
        const grad = d.createRadialGradient(x, y, r * 0.2, x, y, r);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = grad;
        d.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const pl of this.players) if (pl.tank) light(pl.tank.x + 8, pl.tank.y + 8, 42);
      for (const l of this.lanterns) light(l.x + 5, l.y + 5, 30 + Math.sin(this.t / 7 + l.x) * 2);
      if (this.well) light(this.well.x + 8, this.well.y + 8, 22);
      for (const e of this.effects) if (e.light || e.kind === 'big') light(e.x, e.y, 30 * (1 - e.t / 35));
      for (const b of this.bullets) if (b.age < 6) light(b.x, b.y, 14);
      for (const s of this.shells) light(s.tx, s.ty, 9);
      for (const b of this.birds) light(b.x, b.y, 16);
      if (this.powerup) light(this.powerup.x + 8, this.powerup.y + 8, 14);
      d.globalCompositeOperation = 'source-over';
      g.drawImage(this.dark, 0, 0);
    }

    // Preview of a stage (thumbnails, briefing and the editor): terrain, pieces and spawn markers
    preview(stage) {
      this.stage = stage;
      this.region = stage.region; this.time = 'day'; this.mission = stage.mission;
      this.clearEntities();
      this.well = stage.well ? { x: WELL.x, y: WELL.y, hp: 1, max: 1, dead: false, flash: 0 } : null;
      this.parse(stage.rows, stage.waypoints, !!stage.well);
      if (stage.waypoints) {
        const [sx, sy] = stage.waypoints[0];
        this.camels = [0, 1].map(i => ({ x: sx * 16 + 16 + i * 18, y: sy * 16, anim: 0, left: false, dead: false, arrived: false, flash: 0 }));
      }
    }

    renderPreview(markers) {
      const g = this.fctx, fx = this.fx;
      if (this.bgDirty) { this.bgctx.putImageData(this.bgImg, 0, 0); this.bgDirty = false; }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.drawImage(this.bg, 0, 0);
      for (const sk of this.skins) g.drawImage(fx.skin, sk.x, sk.y);
      for (const d of this.dhows) g.drawImage(fx.dhow, d.x, d.y);
      if (this.well) g.drawImage(fx.well[0], this.well.x, this.well.y);
      for (const tw of this.towers) g.drawImage(fx.tower[0], tw.x, tw.y);
      for (const l of this.lanterns) g.drawImage(fx.lantern, l.x, l.y);
      for (const c of this.camels) g.drawImage(fx.camel[0][0], c.x, c.y);
      g.drawImage(this.trees, 0, 0);
      if (markers !== false) {
        g.globalAlpha = 0.55;
        if (this.mission !== 'towers') for (const s of TOP_SPAWNS) g.drawImage(S.vehicle('jeep', 'enemy', 0, 2), s.x, s.y);
        g.drawImage(S.vehicle('A', 'p1', 0, 0), P_SPAWN[0].x, P_SPAWN[0].y);
        g.globalAlpha = 1;
      }
      return this.frame;
    }
  }

  TB.Game = Game;
  TB.consts = { FIELD, NC, EMPTY, MUD, STONE, WATER, PALM, DUNE, QUICK, WELL, P_SPAWN, TOP_SPAWNS, ENEMY, BOSS, PLAYER, DIFF, POWERUPS, FORTRESS, PALETTES };
})();
