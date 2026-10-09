// Game engine: a 208x208 field of 4px terrain cells, 16px tanks, fixed 60 ticks per second.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};
  const S = TB.sprites;

  const FIELD = 208, NC = 52;
  const EMPTY = 0, BRICK = 1, STEEL = 2, WATER = 3, TREES = 4, ICE = 5;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const BASE = { x: 96, y: 192 };
  const PLAYER_SPAWN = { x: 64, y: 192 };
  const ENEMY_SPAWNS = [{ x: 96, y: 0 }, { x: 192, y: 0 }, { x: 0, y: 0 }];
  const PLAYER_SPEED = 0.75;
  const ENEMY = [
    { design: 'A', speed: 0.5, bullet: 2, hp: 1, score: 100 },
    { design: 'B', speed: 1.0, bullet: 2, hp: 1, score: 200 },
    { design: 'C', speed: 0.6, bullet: 3.5, hp: 1, score: 300 },
    { design: 'D', speed: 0.5, bullet: 2.5, hp: 4, score: 400 },
  ];
  // Player upgrades from collected stars: faster shells, two shells, then shells that break steel
  const PLAYER = [
    { design: 'A', bullet: 2.5, max: 1, power: false },
    { design: 'B', bullet: 4, max: 1, power: false },
    { design: 'C', bullet: 4, max: 2, power: false },
    { design: 'D', bullet: 4, max: 2, power: true },
  ];
  const DIFF = {
    easy: { lives: 5, eSpeed: 0.85, eFire: 0.55, eBullet: 0.85, maxOn: 3, spawnMul: 1.3, shield: 300, chase: 0.6 },
    normal: { lives: 3, eSpeed: 1, eFire: 1, eBullet: 1, maxOn: 4, spawnMul: 1, shield: 180, chase: 1 },
    hard: { lives: 3, eSpeed: 1.12, eFire: 1.45, eBullet: 1.1, maxOn: 5, spawnMul: 0.8, shield: 150, chase: 1.3 },
  };
  const POWERUPS = ['helmet', 'clock', 'shovel', 'star', 'grenade', 'tank'];

  // 8px ring of cells around the base
  const FORTRESS = [];
  for (const bx of [88, 96, 104, 112]) {
    for (const by of [184, 192, 200]) {
      if (bx !== 88 && bx !== 112 && by !== 184) continue;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) FORTRESS.push([bx / 4 + ox, by / 4 + oy]);
    }
  }

  const hit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  const solidForTank = c => c === BRICK || c === STEEL || c === WATER;

  class Game {
    constructor(hooks) {
      this.hooks = hooks || {};
      const mk = () => { const c = document.createElement('canvas'); c.width = c.height = FIELD; return c; };
      this.frame = mk(); this.fctx = this.frame.getContext('2d');
      this.bg = mk(); this.bgctx = this.bg.getContext('2d'); this.bgImg = this.bgctx.createImageData(FIELD, FIELD);
      this.trees = mk(); this.treectx = this.trees.getContext('2d'); this.treeImg = this.treectx.createImageData(FIELD, FIELD);
      this.map = new Uint8Array(NC * NC);
      this.fx = S.effects();
      this.input = { dir: -1, fire: false };
      this.state = 'idle';
      this.tanks = []; this.bullets = []; this.effects = []; this.popups = []; this.spawns = [];
      this.waterFrame = 0; this.waterCells = [];
      this.t = 0;
    }

    sound(n) { if (this.hooks.sound) this.hooks.sound(n); }
    vibrate(p) { if (this.hooks.vibrate) this.hooks.vibrate(p); }
    emit(n, d) { if (this.hooks.event) this.hooks.event(n, d); }

    // ---------- setup ----------
    start(opts) {
      this.difficulty = DIFF[opts.difficulty] ? opts.difficulty : 'normal';
      this.diff = DIFF[this.difficulty];
      this.custom = opts.custom || null;
      this.score = 0; this.lives = this.diff.lives; this.level = 0; this.nextLife = 20000;
      this.loadStage(opts.stage || 1);
    }

    loadStage(n) {
      this.stage = n;
      const info = this.custom ? { name: 'خريطتي', map: this.custom } : TB.levels.get(n);
      this.stageName = info.name;
      this.tanks = []; this.bullets = []; this.effects = []; this.popups = []; this.spawns = [];
      this.loadMap(info.map);
      this.player = null; this.powerup = null;
      this.freeze = 0; this.shovel = 0; this.baseDead = false; this.respawn = 0;
      this.kills = [0, 0, 0, 0];
      this.queue = this.makeQueue(this.custom ? 5 : n);
      this.spawnIdx = 0; this.spawnTimer = 30;
      this.spawnInterval = Math.round(Math.max(70, 190 - n * 4) * this.diff.spawnMul);
      this.t = 0; this.clearTimer = 0; this.overTimer = 0;
      this.input.fire = false;
      this.state = 'intro';
    }

    begin() {
      if (this.state !== 'intro') return;
      this.state = 'play';
      this.spawnPlayer();
      this.sound('start');
    }

    makeQueue(n) {
      let t = (n - 1) / 14 + (this.difficulty === 'hard' ? 0.15 : this.difficulty === 'easy' ? -0.1 : 0);
      t = Math.max(0, Math.min(1, t));
      const armor = Math.round(8 * t), power = Math.round(6 * t), fast = Math.round(2 + 4 * t);
      const kinds = [];
      for (let i = 0; i < 20 - armor - power - fast; i++) kinds.push(0);
      for (let i = 0; i < fast; i++) kinds.push(1);
      for (let i = 0; i < power; i++) kinds.push(2);
      for (let i = 0; i < armor; i++) kinds.push(3);
      // Shuffle with a bias so heavier tanks tend to come later
      const order = kinds.map(k => ({ k, r: k * 0.9 + Math.random() * 2.4 })).sort((a, b) => a.r - b.r);
      return order.map((o, i) => ({ kind: o.k, bonus: i === 3 || i === 10 || i === 17 }));
    }

    // Maps are 13 rows of 16px tiles, or 26 rows of 8px blocks (custom maps from the editor)
    loadMap(rows) {
      this.map.fill(EMPTY);
      const TYPES = { '#': BRICK, '@': STEEL, '~': WATER, '%': TREES, '-': ICE };
      const HALF = {
        '[': [BRICK, 0, 0, 2, 4], ']': [BRICK, 2, 0, 2, 4], '^': [BRICK, 0, 0, 4, 2], '_': [BRICK, 0, 2, 4, 2],
        '{': [STEEL, 0, 0, 2, 4], '}': [STEEL, 2, 0, 2, 4], '/': [STEEL, 0, 0, 4, 2], '\\': [STEEL, 0, 2, 4, 2],
      };
      const k = rows.length === 26 ? 2 : 4;
      for (let ty = 0; ty < rows.length; ty++) {
        for (let tx = 0; tx < rows[ty].length; tx++) {
          const ch = rows[ty][tx];
          let type = TYPES[ch], x0 = 0, y0 = 0, w = k, h = k;
          if (!type && HALF[ch]) {
            [type, x0, y0, w, h] = HALF[ch];
            if (k === 2) { x0 /= 2; y0 /= 2; w /= 2; h /= 2; }
          }
          if (!type) continue;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.map[(ty * k + y0 + y) * NC + tx * k + x0 + x] = type;
        }
      }
      for (const [cx, cy] of FORTRESS) this.map[cy * NC + cx] = BRICK;
      this.waterCells = [];
      for (let i = 0; i < this.map.length; i++) if (this.map[i] === WATER) this.waterCells.push([i % NC, Math.floor(i / NC)]);
      this.redrawTerrain();
    }

    // ---------- terrain drawing ----------
    paintCell(cx, cy) {
      const type = this.map[cy * NC + cx], d = this.bgImg.data;
      const solid = type === BRICK || type === STEEL || type === WATER || type === ICE;
      for (let y = cy * 4; y < cy * 4 + 4; y++) {
        for (let x = cx * 4; x < cx * 4 + 4; x++) {
          const i = (y * FIELD + x) * 4, col = solid ? S.terrainPixel(type, x, y, this.waterFrame) : null;
          if (col) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; } else { d[i] = d[i + 1] = d[i + 2] = 0; }
          d[i + 3] = 255;
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
          const col = this.map[(y >> 2) * NC + (x >> 2)] === TREES ? S.terrainPixel(TREES, x, y, 0) : null;
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
    }

    setFortress(type) {
      for (const [cx, cy] of FORTRESS) {
        if (this.tanks.some(t => !t.dead && hit(cx * 4, cy * 4, 4, 4, t.x, t.y, 16, 16))) continue;
        this.setCell(cx, cy, type);
      }
    }

    // ---------- tanks ----------
    makeTank(team, kind, x, y, bonus) {
      return {
        team, kind, x, y, dir: team === 'p' ? 0 : 2, hp: team === 'p' ? 1 : ENEMY[kind].hp, bonus: !!bonus,
        bullets: 0, cooldown: 0, anim: 0, moving: false, blocked: false, shield: 0, flash: 0, slide: 0,
        dead: false, aiTimer: 0, stuck: 0,
      };
    }

    spawnPlayer() { this.spawns.push({ team: 'p', x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, t: 36 }); }

    terrainBlocks(x, y) {
      const cx0 = Math.floor(x / 4), cy0 = Math.floor(y / 4), cx1 = Math.floor((x + 15.999) / 4), cy1 = Math.floor((y + 15.999) / 4);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (solidForTank(this.map[cy * NC + cx])) return true;
      return false;
    }

    tankBlocked(t, x, y) {
      if (x < 0 || y < 0 || x > FIELD - 16 || y > FIELD - 16) return true;
      if (this.terrainBlocks(x, y)) return true;
      if (hit(x, y, 16, 16, BASE.x, BASE.y, 16, 16)) return true;
      for (const o of this.tanks) {
        if (o === t || o.dead) continue;
        // Tanks that already overlap (fresh spawns) may drive apart
        if (hit(x, y, 16, 16, o.x, o.y, 16, 16) && !hit(t.x, t.y, 16, 16, o.x, o.y, 16, 16)) return true;
      }
      return false;
    }

    // Turning onto the other axis snaps to the 8px grid so tanks slip into corridors easily
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
        const s = Math.min(1, dist);
        const nx = t.x + dx * s, ny = t.y + dy * s;
        if (!this.tankBlocked(t, nx, ny)) { t.x = nx; t.y = ny; moved = true; dist -= s; continue; }
        // Close a sub-pixel gap up to the obstacle
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

    onIce(t) {
      return this.map[Math.floor((t.y + 8) / 4) * NC + Math.floor((t.x + 8) / 4)] === ICE;
    }

    fire(t) {
      if (t.cooldown > 0) return;
      const spec = t.team === 'p' ? PLAYER[this.level] : null;
      if (t.bullets >= (spec ? spec.max : 1)) return;
      const speed = spec ? spec.bullet : ENEMY[t.kind].bullet * this.diff.eBullet;
      this.bullets.push({
        x: t.x + 8 + DX[t.dir] * 6, y: t.y + 8 + DY[t.dir] * 6, dir: t.dir, speed,
        owner: t, team: t.team, power: spec ? spec.power : false, dead: false,
      });
      t.bullets++;
      t.cooldown = spec ? (spec.max > 1 ? 10 : 6) : 25;
      this.sound(t.team === 'p' ? 'shoot' : 'eshoot');
    }

    updatePlayer() {
      const p = this.player;
      if (!p) return;
      if (p.shield > 0) p.shield--;
      if (p.cooldown > 0) p.cooldown--;
      if (this.state !== 'play') { p.moving = false; return; }
      const dir = this.input.dir, ice = this.onIce(p);
      if (dir >= 0) {
        if (dir !== p.dir) this.turn(p, dir);
        p.moving = this.moveTank(p, PLAYER_SPEED);
        p.slide = ice ? 24 : 0;
      } else if (p.slide > 0 && ice) {
        if (p.slide === 24) this.sound('slide');
        p.slide--;
        p.moving = this.moveTank(p, PLAYER_SPEED);
        if (!p.moving) p.slide = 0;
      } else {
        p.moving = false; p.slide = 0;
      }
      if (p.moving) p.anim++;
      if (this.input.fire) this.fire(p);
    }

    // ---------- enemies ----------
    enemySpawner() {
      if (!this.queue.length) return;
      const onField = this.tanks.filter(t => t.team === 'e' && !t.dead).length + this.spawns.filter(s => s.team === 'e').length;
      if (onField >= this.diff.maxOn || --this.spawnTimer > 0) return;
      for (let k = 0; k < 3; k++) {
        const sp = ENEMY_SPAWNS[(this.spawnIdx + k) % 3];
        const busy = this.tanks.some(t => !t.dead && hit(sp.x, sp.y, 16, 16, t.x, t.y, 16, 16)) ||
          this.spawns.some(s => s.x === sp.x && s.y === sp.y);
        if (busy) continue;
        const next = this.queue.shift();
        this.spawns.push({ team: 'e', x: sp.x, y: sp.y, t: 60, kind: next.kind, bonus: next.bonus });
        this.spawnIdx = (this.spawnIdx + k + 1) % 3;
        this.spawnTimer = this.spawnInterval;
        return;
      }
      this.spawnTimer = 10;
    }

    updateSpawns() {
      for (const s of this.spawns) {
        if (--s.t > 0) continue;
        if (s.team === 'p') {
          const p = this.makeTank('p', 0, s.x, s.y);
          p.shield = this.diff.shield;
          this.player = p;
          this.tanks.push(p);
        } else {
          this.tanks.push(this.makeTank('e', s.kind, s.x, s.y, s.bonus));
        }
      }
      this.spawns = this.spawns.filter(s => s.t > 0);
    }

    cellsIn(x, y, w, h, test) {
      const cx0 = Math.max(0, Math.floor(x / 4)), cy0 = Math.max(0, Math.floor(y / 4));
      const cx1 = Math.min(NC - 1, Math.floor((x + w - 0.001) / 4)), cy1 = Math.min(NC - 1, Math.floor((y + h - 0.001) / 4));
      let n = 0;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (test(this.map[cy * NC + cx])) n++;
      return n;
    }

    // Something ahead that shooting cannot clear: field edge, steel or water
    hardBlocked(e, d) {
      const x = e.x + DX[d] * 4, y = e.y + DY[d] * 4;
      if (x < 0 || y < 0 || x > FIELD - 16 || y > FIELD - 16) return true;
      return this.cellsIn(x, y, 16, 16, c => c === STEEL || c === WATER) > 0;
    }

    brickAhead(e) {
      const x = e.x + DX[e.dir] * 4, y = e.y + DY[e.dir] * 4;
      return this.cellsIn(x, y, 16, 16, c => c === BRICK) > 0 || hit(x, y, 16, 16, BASE.x, BASE.y, 16, 16);
    }

    inSight(e) {
      const targets = [BASE];
      if (this.player) targets.push(this.player);
      for (const t of targets) {
        const ax = Math.abs(t.x - e.x) < 10, ay = Math.abs(t.y - e.y) < 10;
        if ((e.dir === 0 && ax && t.y < e.y) || (e.dir === 2 && ax && t.y > e.y) ||
          (e.dir === 1 && ay && t.x > e.x) || (e.dir === 3 && ay && t.x < e.x)) return true;
      }
      return false;
    }

    think(e) {
      const r = Math.random(), p = this.player;
      const chase = Math.min(0.45, 0.15 + this.stage * 0.02) * this.diff.chase;
      let target = null;
      if (r < 0.35) target = BASE;
      else if (r < 0.35 + chase && p) target = p;
      let options;
      if (target) {
        const dx = target.x - e.x, dy = target.y - e.y, h = dx > 0 ? 1 : 3, v = dy > 0 ? 2 : 0;
        options = Math.abs(dx) > Math.abs(dy) ? [h, v] : [v, h];
        if (Math.abs(dx) < 4) options = [v, h];
        else if (Math.abs(dy) < 4) options = [h, v];
        if (Math.random() < 0.25) options.reverse();
      } else {
        options = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      }
      let dir = options[0];
      for (const d of options.concat([2, 1, 3, 0].sort(() => Math.random() - 0.5))) {
        if (!this.hardBlocked(e, d)) { dir = d; break; }
      }
      if (e.blocked && dir === e.dir && !this.brickAhead(e)) dir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
      this.turn(e, dir);
      e.aiTimer = 40 + Math.floor(Math.random() * 120);
      e.stuck = 0;
    }

    updateEnemy(e) {
      if (e.flash > 0) e.flash--;
      if (e.cooldown > 0) e.cooldown--;
      if (this.freeze > 0) { e.moving = false; return; }
      const speed = ENEMY[e.kind].speed * this.diff.eSpeed * (1 + Math.min(0.25, (this.stage - 1) * 0.012));
      e.aiTimer--;
      if (e.aiTimer <= 0 || (e.blocked && (e.stuck > 12 || Math.random() < 0.04))) this.think(e);
      e.moving = this.moveTank(e, speed);
      e.stuck = e.blocked ? e.stuck + 1 : 0;
      if (e.moving) e.anim++;
      let chance = 0.018 * this.diff.eFire * (1 + Math.min(1, this.stage * 0.04));
      if (e.blocked && this.brickAhead(e)) chance *= 4;
      if (this.inSight(e)) chance *= 5;
      if (Math.random() < chance) this.fire(e);
    }

    // ---------- bullets ----------
    killBullet(b, boom) {
      if (b.dead) return;
      b.dead = true;
      b.owner.bullets = Math.max(0, b.owner.bullets - 1);
      if (boom) this.effects.push({ x: b.x, y: b.y, kind: 'small', t: 0 });
    }

    updateBullets() {
      for (const b of this.bullets) {
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
      if (this.bulletTerrain(b)) { this.killBullet(b, true); return; }
      if (hit(b.x - 2, b.y - 2, 4, 4, BASE.x, BASE.y, 16, 16)) {
        this.killBullet(b, true);
        // On easy, the player's own shells cannot knock out the base
        if (!this.baseDead && !(b.team === 'p' && this.difficulty === 'easy')) this.destroyBase();
        return;
      }
      for (const t of this.tanks) {
        if (t.dead || t.team === b.team || !hit(b.x - 2, b.y - 2, 4, 4, t.x + 1, t.y + 1, 14, 14)) continue;
        this.killBullet(b, true);
        this.hitTank(t);
        return;
      }
      for (const o of this.bullets) {
        if (o === b || o.dead || o.team === b.team || !hit(b.x - 2, b.y - 2, 4, 4, o.x - 2, o.y - 2, 4, 4)) continue;
        this.killBullet(b, false); this.killBullet(o, false);
        return;
      }
    }

    // A shell checks the two cells under its nose; on impact it clears a 16px-wide band of bricks
    bulletTerrain(b) {
      const vertical = (b.dir & 1) === 0;
      const lead = b.dir === 0 ? b.y - 2 : b.dir === 2 ? b.y + 1.999 : b.dir === 1 ? b.x + 1.999 : b.x - 2;
      const lc = Math.floor(lead / 4), perp = vertical ? b.x : b.y;
      const at = (p, l) => (vertical ? this.map[l * NC + p] : this.map[p * NC + l]);
      let hitAny = false, steel = false;
      for (let p = Math.floor((perp - 4) / 4); p <= Math.floor((perp + 3.999) / 4); p++) {
        if (p < 0 || p >= NC) continue;
        const c = at(p, lc);
        if (c === BRICK) hitAny = true;
        else if (c === STEEL) { hitAny = true; steel = true; }
      }
      if (!hitAny) return false;
      const fwd = b.dir === 0 || b.dir === 3 ? -1 : 1, depth = b.power ? 2 : 1;
      const w0 = Math.max(0, Math.floor((perp - 8) / 4)), w1 = Math.min(NC - 1, Math.floor((perp + 7.999) / 4));
      let broke = false, brokeSteel = false;
      for (let d = 0; d < depth; d++) {
        const l = lc + d * fwd;
        if (l < 0 || l >= NC) continue;
        for (let p = w0; p <= w1; p++) {
          const cx = vertical ? p : l, cy = vertical ? l : p, c = this.map[cy * NC + cx];
          if (c === BRICK) { this.setCell(cx, cy, EMPTY); broke = true; }
          else if (c === STEEL && b.power) {
            const bx = cx & ~1, by = cy & ~1;
            for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
              if (this.map[(by + oy) * NC + bx + ox] === STEEL) this.setCell(bx + ox, by + oy, EMPTY);
            }
            brokeSteel = true;
          }
        }
      }
      if (b.team === 'p') this.sound(steel && !brokeSteel ? 'steel' : 'brick');
      else if (broke) this.sound('wall');
      return true;
    }

    hitTank(t) {
      if (t.team === 'p') {
        if (t.shield > 0) { this.sound('steel'); return; }
        this.killPlayer();
        return;
      }
      if (t.bonus) { t.bonus = false; this.spawnPowerup(); }
      if (--t.hp > 0) { t.flash = 12; this.sound('armor'); return; }
      this.killEnemy(t, true);
    }

    killEnemy(e, scored) {
      e.dead = true;
      this.effects.push({ x: e.x + 8, y: e.y + 8, kind: 'big', t: 0 });
      if (scored) {
        this.kills[e.kind]++;
        this.addScore(ENEMY[e.kind].score);
        this.popups.push({ x: e.x + 8, y: e.y + 8, val: ENEMY[e.kind].score, t: -30 });
      }
      this.sound('boom');
      this.vibrate(12);
    }

    killPlayer() {
      const p = this.player;
      p.dead = true;
      this.player = null;
      this.effects.push({ x: p.x + 8, y: p.y + 8, kind: 'big', t: 0 });
      this.sound('die');
      this.vibrate(220);
      this.level = 0;
      this.lives--;
      if (this.lives > 0) this.respawn = 50;
      else this.gameOver();
    }

    destroyBase() {
      this.baseDead = true;
      this.effects.push({ x: BASE.x + 8, y: BASE.y + 8, kind: 'big', t: 0 });
      this.sound('base');
      this.vibrate([180, 80, 320]);
      this.gameOver();
    }

    gameOver() {
      if (this.state === 'over') return;
      this.state = 'over';
      this.overTimer = 0;
      this.emit('dying', { base: this.baseDead });
    }

    addScore(n) {
      this.score += n;
      while (this.score >= this.nextLife) {
        this.lives++;
        this.nextLife += 20000;
        this.sound('life');
      }
    }

    // ---------- power-ups ----------
    spawnPowerup() {
      const type = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
      for (let i = 0; i < 50; i++) {
        const x = Math.floor(Math.random() * 25) * 8, y = Math.floor(Math.random() * 25) * 8;
        if (hit(x, y, 16, 16, 80, 176, 48, 32)) continue;
        if (this.cellsIn(x, y, 16, 16, c => c === STEEL || c === WATER) > 4) continue;
        this.powerup = { type, x, y, t: 0 };
        this.sound('appear');
        return;
      }
    }

    updatePowerup() {
      const pu = this.powerup, p = this.player;
      if (!pu) return;
      if (++pu.t > 1200) { this.powerup = null; return; }
      if (!p || !hit(p.x + 2, p.y + 2, 12, 12, pu.x, pu.y, 16, 16)) return;
      this.powerup = null;
      this.addScore(500);
      this.popups.push({ x: pu.x + 8, y: pu.y + 8, val: 500, t: 0 });
      this.vibrate(25);
      switch (pu.type) {
        case 'helmet': p.shield = 600; break;
        case 'clock': this.freeze = 600; this.sound('freeze'); break;
        case 'shovel': this.shovel = 1200; this.setFortress(STEEL); break;
        case 'star': this.level = Math.min(3, this.level + 1); break;
        case 'grenade':
          for (const e of this.tanks) if (e.team === 'e' && !e.dead) this.killEnemy(e, false);
          break;
        case 'tank': this.lives++; break;
      }
      this.sound(pu.type === 'tank' ? 'life' : 'pickup');
      this.emit('powerup', pu.type);
    }

    // ---------- main tick ----------
    update() {
      if (this.state !== 'play' && this.state !== 'over') return;
      this.t++;
      if (this.t % 40 === 0) {
        this.waterFrame = (this.waterFrame + 1) & 3;
        for (const [cx, cy] of this.waterCells) this.paintCell(cx, cy);
      }
      if (this.freeze > 0) this.freeze--;
      if (this.shovel > 0) {
        this.shovel--;
        if (this.shovel === 0) this.setFortress(BRICK);
        else if (this.shovel < 180 && this.shovel % 15 === 0) this.setFortress((this.shovel / 15) % 2 ? BRICK : STEEL);
      }
      if (this.respawn > 0 && --this.respawn === 0 && this.state === 'play') this.spawnPlayer();
      this.enemySpawner();
      this.updateSpawns();
      this.updatePlayer();
      for (const t of this.tanks) if (t.team === 'e' && !t.dead) this.updateEnemy(t);
      this.updateBullets();
      this.updatePowerup();
      for (const e of this.effects) e.t++;
      this.effects = this.effects.filter(e => e.t < (e.kind === 'big' ? 35 : 12));
      for (const p of this.popups) p.t++;
      this.popups = this.popups.filter(p => p.t < 45);
      this.tanks = this.tanks.filter(t => !t.dead);

      if (this.state === 'play' && !this.queue.length && !this.spawns.some(s => s.team === 'e') &&
        !this.tanks.some(t => t.team === 'e')) {
        if (++this.clearTimer === 150) {
          this.state = 'clear';
          this.input.fire = false;
          this.emit('clear', { stage: this.stage, kills: this.kills.slice(), points: ENEMY.map(e => e.score) });
        }
      }
      if (this.state === 'over' && ++this.overTimer === 200) {
        this.state = 'ended';
        this.emit('gameover', { stage: this.stage, score: this.score, base: this.baseDead });
      }
    }

    nextStage() {
      const lives = this.lives, score = this.score, level = this.level;
      this.loadStage(this.stage + 1);
      this.lives = lives; this.score = score; this.level = level;
    }

    enemiesLeft() {
      return this.queue ? this.queue.length : 0;
    }

    // ---------- drawing ----------
    render() {
      const g = this.fctx, fx = this.fx;
      if (this.bgDirty) { this.bgctx.putImageData(this.bgImg, 0, 0); this.bgDirty = false; }
      g.drawImage(this.bg, 0, 0);
      g.drawImage(this.baseDead ? fx.baseDead : fx.base, BASE.x, BASE.y);
      for (const t of this.tanks) this.drawTank(g, t);
      g.fillStyle = '#ECECEC';
      for (const b of this.bullets) {
        if (b.dir & 1) g.fillRect(Math.round(b.x - 2), Math.round(b.y - 1.5), 4, 3);
        else g.fillRect(Math.round(b.x - 1.5), Math.round(b.y - 2), 3, 4);
      }
      g.drawImage(this.trees, 0, 0);
      for (const s of this.spawns) g.drawImage(fx.spawn[[0, 1, 2, 3, 2, 1][Math.floor(s.t / 4) % 6]], s.x, s.y);
      if (this.powerup && (this.powerup.t >> 3) % 4 !== 3) g.drawImage(fx.powerups[this.powerup.type], this.powerup.x, this.powerup.y);
      for (const e of this.effects) {
        let img;
        if (e.kind === 'small') img = fx.boomSmall[Math.min(2, Math.floor(e.t / 4))];
        else {
          const seq = [0, 1, 2, 3, 4, 3, 2], f = seq[Math.min(seq.length - 1, Math.floor(e.t / 5))];
          img = f < 3 ? fx.boomSmall[f] : fx.boomBig[f - 3];
        }
        g.drawImage(img, Math.round(e.x - img.width / 2), Math.round(e.y - img.height / 2));
      }
      for (const p of this.popups) {
        if (p.t < 0) continue;
        const w = String(p.val).length * 4 - 1;
        S.drawNumber(g, p.val, Math.round(p.x - w / 2), Math.round(p.y - 3), '#FFFFFF');
      }
      return this.frame;
    }

    drawTank(g, t) {
      let pal = 'enemy', design;
      if (t.team === 'p') { pal = 'player'; design = PLAYER[this.level].design; }
      else {
        design = ENEMY[t.kind].design;
        if (t.bonus && (this.t >> 3) & 1) pal = 'red';
        else if (t.kind === 3) pal = t.flash > 0 && (t.flash >> 1) & 1 ? 'enemy' : ['enemy', 'silver', 'purple', 'green'][t.hp - 1];
        if (this.freeze > 0 && (this.t >> 4) & 1 && !t.bonus) pal = 'silver';
      }
      const x = Math.round(t.x), y = Math.round(t.y);
      g.drawImage(S.tank(design, pal, (t.anim >> 2) & 1, t.dir), x, y);
      if (t.shield > 0) g.drawImage(this.fx.shield[(this.t >> 1) & 1], x, y);
    }

    // Editor preview: map plus markers for spots that must stay clear
    renderPreview() {
      const g = this.fctx;
      if (this.bgDirty) { this.bgctx.putImageData(this.bgImg, 0, 0); this.bgDirty = false; }
      g.drawImage(this.bg, 0, 0);
      g.drawImage(this.fx.base, BASE.x, BASE.y);
      g.drawImage(this.trees, 0, 0);
      g.globalAlpha = 0.55;
      for (const s of ENEMY_SPAWNS) g.drawImage(S.tank('A', 'enemy', 0, 2), s.x, s.y);
      g.drawImage(S.tank('A', 'player', 0, 0), PLAYER_SPAWN.x, PLAYER_SPAWN.y);
      g.globalAlpha = 1;
      return this.frame;
    }
  }

  TB.Game = Game;
  TB.consts = { FIELD, NC, EMPTY, BRICK, STEEL, WATER, TREES, ICE, BASE, PLAYER_SPAWN, ENEMY_SPAWNS, ENEMY, FORTRESS };
})();
