// The journey: five regions, twenty stages with different missions, endless stages after that,
// a daily challenge everyone shares, and codes for sharing maps made in the editor.
// Maps are 13x13 tiles of 16px:
//   .  sand        #  mud wall     @  fort stone   ~  water       %  palm        -  dune       *  quicksand
//   [ ] ^ _  mud halves (left, right, top, bottom)     { } / \  stone halves
//   T  enemy tower   Q  water skin   L  lantern   B  dhow on the water (two tiles wide)
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};

  const REGION_ORDER = ['desert', 'oasis', 'mountains', 'coast', 'oldcity'];
  const REGIONS = {
    desert: { name: 'الصحراء', maqam: 'hijaz', mix: [6, 4, 0, 0, 1], icon: 'dune' },
    oasis: { name: 'الواحات', maqam: 'bayati', mix: [5, 4, 0, 3, 1], icon: 'palm' },
    mountains: { name: 'الجبال', maqam: 'kurd', mix: [4, 4, 3, 2, 2], icon: 'stone' },
    coast: { name: 'الساحل', maqam: 'saba', mix: [4, 4, 3, 3, 3], icon: 'dhow' },
    oldcity: { name: 'المدينة القديمة', maqam: 'rast', mix: [3, 4, 3, 3, 4], icon: 'lantern' },
  };

  const MISSIONS = {
    defend: { name: 'دافع عن البئر', well: true },
    collect: { name: 'اجمع القِرَب', well: false },
    towers: { name: 'دمّر الأبراج', well: true },
    escort: { name: 'رافق القافلة', well: false },
    survive: { name: 'اصمد حتى الفجر', well: true },
    boss: { name: 'القلعة المتحركة', well: true },
  };

  const CAMPAIGN = [
    { region: 'desert', mission: 'defend', time: 'day', seed: 11, name: 'طلائع العقارب', brief: 'وصلت طلائع عصابة العقارب إلى أطراف الصحراء. احمِ بئر الواحة ودمّر المركبات المهاجمة.' },
    { region: 'desert', mission: 'collect', time: 'dawn', seed: 23, name: 'قِرَب الفجر', brief: 'بعثرت العاصفة قِرَب الماء في الرمال. اجمعها قبل أن يسرقها الجوّالون.' },
    { region: 'desert', mission: 'towers', time: 'day', seed: 37, name: 'أبراج الرمل', brief: 'بنى العقارب أبراجاً تخرج منها مركباتهم. اهدمها كلها لتتوقف الغارات.' },
    { region: 'desert', mission: 'boss', time: 'dusk', seed: 41, name: 'زعيم الكثبان', brief: 'القلعة المتحركة تزحف نحو البئر مع الغروب. أوقفها قبل أن تصل!' },
    { region: 'oasis', mission: 'escort', time: 'dawn', seed: 53, name: 'قافلة التمر', brief: 'قافلة التمر تعبر الواحة مع الفجر. احمِ الجمال حتى تصل إلى الطرف الآخر.' },
    { region: 'oasis', mission: 'defend', time: 'day', seed: 67, name: 'حصار الواحة', brief: 'العقارب يحاصرون الواحة من كل جهة. اصمد ودافع عن البئر.' },
    { region: 'oasis', mission: 'survive', time: 'night', seed: 71, name: 'ليلة النخيل', brief: 'هجوم ليلي بين النخيل. لا ترى إلا ما يضيئه مصباحك والفوانيس. اصمد حتى الفجر.' },
    { region: 'oasis', mission: 'boss', time: 'dusk', seed: 83, name: 'قلعة البحيرة', brief: 'قلعة متحركة أخرى عند البحيرة، ومعها حرّاسها. أطلق عليها كل ما لديك.' },
    { region: 'mountains', mission: 'towers', time: 'day', seed: 97, name: 'أبراج الجبل', brief: 'تحصّن العقارب بين الصخور. اهدم أبراجهم في الممرات الجبلية.' },
    { region: 'mountains', mission: 'escort', time: 'dawn', seed: 101, name: 'الممر الضيق', brief: 'القافلة تعبر ممراً ضيقاً بين الجبال. انتبه لقذائف المدفعية من خلف الصخور.' },
    { region: 'mountains', mission: 'collect', time: 'day', seed: 113, name: 'ينابيع الجبل', brief: 'نبع الجبل ملأ القِرَب. اجمعها وأعدها إلى الواحة.' },
    { region: 'mountains', mission: 'boss', time: 'dusk', seed: 127, name: 'حصن الصخر', brief: 'قلعة العقارب الجبلية تتقدم بين الصخور. حطّمها قبل أن تصل.' },
    { region: 'coast', mission: 'defend', time: 'day', seed: 131, name: 'المرفأ', brief: 'المراكب في المرفأ والعقارب على الساحل. احمِ البئر وأهل الساحل.' },
    { region: 'coast', mission: 'survive', time: 'night', seed: 149, name: 'ليلة الساحل', brief: 'هجوم ليلي على الشاطئ. الفوانيس دليلك حتى يطلع الفجر.' },
    { region: 'coast', mission: 'escort', time: 'dusk', seed: 157, name: 'قافلة اللؤلؤ', brief: 'قافلة تحمل اللؤلؤ من المرفأ إلى المدينة. أوصلها سالمة.' },
    { region: 'coast', mission: 'boss', time: 'dusk', seed: 163, name: 'قلعة الموج', brief: 'قلعة متحركة على الساحل، أقوى من سابقاتها. لا تتراجع!' },
    { region: 'oldcity', mission: 'towers', time: 'day', seed: 173, name: 'أسوار المدينة', brief: 'نصب العقارب أبراجهم في أزقة المدينة القديمة. حرّر المدينة منها.' },
    { region: 'oldcity', mission: 'collect', time: 'dawn', seed: 181, name: 'سقاية الحي', brief: 'أهل الحي عطشى. اجمع القِرَب من الأزقة قبل أن يأخذها العقارب.' },
    { region: 'oldcity', mission: 'survive', time: 'night', seed: 191, name: 'ليلة السوق', brief: 'آخر هجوم ليلي على سوق المدينة. اصمد حتى الفجر.' },
    { region: 'oldcity', mission: 'boss', time: 'dusk', seed: 199, name: 'القلعة الكبرى', brief: 'زعيم العقارب بنفسه في القلعة الكبرى. انتصر عليه لتكتمل الرحلة!' },
  ];

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Tiles that must stay clear for spawns, the well, the boss and the caravan road
  function reserved(x, y, o) {
    if (y === 0 && (x === 0 || x === 6 || x === 12)) return true;
    if (y === 12 && (x === 4 || x === 8)) return true;
    if (o.well && y >= 11 && x >= 5 && x <= 7) return true;
    if (o.boss && y <= 2 && x >= 4 && x <= 8) return true;
    return !!(o.road && o.road.has(x + ',' + y));
  }

  const MIRROR = { '[': ']', ']': '[', '{': '}', '}': '{' };

  // ---------- region painters ----------
  function painter(grid, rand, mirrored) {
    const put = (x, y, ch) => {
      if (x < 0 || y < 0 || x > 12 || y > 12) return;
      grid[y][x] = ch;
      if (mirrored) grid[y][12 - x] = MIRROR[ch] || ch;
    };
    const blob = (x0, y0, w, h, ch, density) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (rand() < (density || 1)) put(x, y, ch);
    };
    const line = (x0, y0, len, horizontal, ch) => {
      for (let i = 0; i < len; i++) put(horizontal ? x0 + i : x0, horizontal ? y0 : y0 + i, ch);
    };
    const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
    return { put, blob, line, ri };
  }

  const PAINT = {
    desert(grid, rand, k) {
      const { blob, line, put, ri } = painter(grid, rand, true);
      for (let i = 0; i < 4 + k * 3; i++) blob(ri(0, 5), ri(1, 10), ri(2, 3), ri(1, 2), '-', 0.85);
      for (let i = 0; i < 3 + k * 3; i++) line(ri(0, 5), ri(1, 10), ri(2, 4), rand() < 0.5, '#');
      for (let i = 0; i < 1 + k * 2; i++) put(ri(1, 5), ri(2, 9), '@');
      for (let i = 0; i < 1 + k; i++) put(ri(1, 5), ri(2, 9), '*');
      for (let i = 0; i < ri(0, 2); i++) put(ri(0, 5), ri(1, 10), '%');
    },
    oasis(grid, rand, k) {
      const { blob, put, ri } = painter(grid, rand, true);
      const py = ri(4, 6);
      blob(5, py, 2, 2, '~');
      for (const [x, y] of [[4, py], [4, py + 1], [5, py - 1], [6, py - 1], [5, py + 2], [6, py + 2]]) if (rand() < 0.75) put(x, y, '%');
      if (rand() < 0.7) { const sx = ri(1, 2), sy = ri(7, 9); blob(sx, sy, 2, 1, '~'); put(sx, sy - 1, '%'); put(sx + 2, sy, '%'); }
      for (let i = 0; i < 2 + k * 2; i++) { const x = ri(0, 4), y = ri(1, 9); blob(x, y, 2, 2, '#', 0.8); }
      for (let i = 0; i < 1 + k; i++) put(ri(2, 5), ri(3, 9), '*');
      for (let i = 0; i < 1 + k * 2; i++) blob(ri(0, 5), ri(1, 10), 2, 1, '-', 0.8);
      for (let i = 0; i < k; i++) put(ri(0, 5), ri(1, 10), '@');
    },
    mountains(grid, rand, k) {
      const { blob, line, put, ri } = painter(grid, rand, true);
      for (let i = 0; i < 3 + k * 2; i++) line(ri(0, 5), ri(1, 10), ri(2, 4), rand() < 0.6, '@');
      for (let i = 0; i < 2 + k; i++) line(ri(0, 5), ri(1, 10), ri(2, 3), rand() < 0.5, '#');
      for (let i = 0; i < 2 + k; i++) blob(ri(0, 5), ri(1, 10), 2, 2, '-', 0.7);
      for (let i = 0; i < 1; i++) put(ri(1, 5), ri(3, 9), '*');
      if (rand() < 0.5) put(ri(1, 4), ri(3, 9), '~');
    },
    coast(grid, rand, k) {
      const { blob, line, put, ri } = painter(grid, rand, false);
      for (let y = 2; y <= 12; y++) { grid[y][0] = '~'; grid[y][1] = '~'; if (rand() < 0.3 && y > 3) grid[y][2] = '~'; }
      grid[3][0] = 'B'; grid[9][0] = 'B';
      for (const y of [3, 9]) { grid[y][1] = '~'; }
      line(0, 6, 3, true, '@');
      for (let y = 2; y <= 11; y++) if (grid[y][2] !== '~' && rand() < 0.35) grid[y][2] = '%';
      const m = painter(grid, rand, false);
      for (let i = 0; i < 3 + k * 2; i++) { const x = ri(4, 11), y = ri(1, 10); m.blob(x, y, 2, 2, '#', 0.75); }
      for (let i = 0; i < 2 + k; i++) blob(ri(4, 11), ri(1, 10), 2, 1, '-', 0.8);
      for (let i = 0; i < k + 1; i++) put(ri(4, 11), ri(2, 9), '@');
      if (rand() < 0.6) put(ri(5, 11), ri(3, 9), '*');
    },
    oldcity(grid, rand, k) {
      const { put, ri } = painter(grid, rand, true);
      for (const y of [2, 5, 8]) {
        for (const x of [1, 4]) {
          if (rand() < 0.15) continue;
          const ch = rand() < 0.2 + k * 0.08 ? '@' : '#';
          const w = rand() < 0.7 ? 2 : 1, h = rand() < 0.7 ? 2 : 1;
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, ch);
        }
      }
      put(6, 4, '~'); put(5, 4, '%');
      for (let i = 0; i < 2; i++) put(ri(0, 5), ri(1, 10), '-');
      if (rand() < 0.5) put(ri(0, 5), ri(1, 10), '*');
    },
  };

  // ---------- reachability: steel, water and boats block, everything else can be crossed or shot ----------
  const blocked = ch => ch === '@' || ch === '~' || ch === 'B' || ch === '{' || ch === '}' || ch === '/' || ch === '\\';
  function flood(grid, sx, sy) {
    const seen = new Set([sx + ',' + sy]), queue = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx > 12 || ny > 12 || seen.has(k) || blocked(grid[ny][nx])) continue;
        seen.add(k); queue.push([nx, ny]);
      }
    }
    return seen;
  }
  function connect(grid, targets, rand) {
    for (let guard = 0; guard < 80; guard++) {
      const seen = flood(grid, 4, 12);
      const missing = targets.filter(([x, y]) => !seen.has(x + ',' + y));
      if (!missing.length) return true;
      // Turn a blocking tile on the edge of the reachable area into mud, which can be shot through
      const edge = [];
      for (const k of seen) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx <= 12 && ny <= 12 && blocked(grid[ny][nx]) && grid[ny][nx] !== 'B') edge.push([nx, ny]);
        }
      }
      if (!edge.length) return false;
      const [tx, ty] = missing[0];
      edge.sort((a, b) => Math.abs(a[0] - tx) + Math.abs(a[1] - ty) - Math.abs(b[0] - tx) - Math.abs(b[1] - ty));
      const [bx, by] = edge[Math.floor(rand() * Math.min(3, edge.length))];
      grid[by][bx] = '#';
    }
    return false;
  }

  // ---------- building a stage ----------
  function build(def) {
    const rand = rng(def.seed);
    const regionIdx = REGION_ORDER.indexOf(def.region);
    const k = Math.min(2, regionIdx * 0.5 + (def.level || 0) * 0.15);
    const grid = Array.from({ length: 13 }, () => Array(13).fill('.'));
    const boss = def.mission === 'boss';
    PAINT[def.region](grid, rand, boss ? Math.max(0, k - 0.5) : k);
    // The boss is 32px wide: thin the arena out so it has room to move
    if (boss) for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (grid[y][x] !== '.' && grid[y][x] !== 'B' && rand() < 0.2) grid[y][x] = '.';

    let road = null, waypoints = null;
    if (def.mission === 'escort') {
      const r0 = 3 + Math.floor(rand() * 3), r1 = 7 + Math.floor(rand() * 3), c1 = 4 + Math.floor(rand() * 5);
      road = new Set();
      const mark = (x, y) => { if (x >= 0 && x <= 12) road.add(x + ',' + y); };
      for (let x = 0; x <= c1; x++) mark(x, r0);
      for (let y = Math.min(r0, r1); y <= Math.max(r0, r1); y++) mark(c1, y);
      for (let x = c1; x <= 12; x++) mark(x, r1);
      waypoints = [[-1, r0], [c1, r0], [c1, r1], [13, r1]];
    }
    const opts = { well: MISSIONS[def.mission].well, boss, road };
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (reserved(x, y, opts)) grid[y][x] = '.';

    const free = (x, y) => grid[y][x] === '.' && !reserved(x, y, opts);
    const targets = [[0, 0], [6, 0], [12, 0]];
    if (opts.well) targets.push([5, 10], [7, 10]);
    if (road) for (const key of road) targets.push(key.split(',').map(Number));

    if (def.mission === 'towers') {
      const n = def.towers || 3;
      const spots = n === 2 ? [[3, 3], [9, 3]] : [[2, 3], [6, 2], [10, 3]];
      for (const [sx, sy] of spots) {
        const x = Math.max(1, Math.min(11, sx + Math.floor(rand() * 3) - 1)), y = Math.max(1, Math.min(5, sy + Math.floor(rand() * 3) - 1));
        grid[y][x] = 'T';
        if (y < 12) grid[y + 1][x] = '.';
        targets.push([x, y + 1]);
      }
    }
    if (def.mission === 'collect') {
      const quads = [[0, 5, 1, 4], [7, 12, 1, 4], [0, 5, 5, 8], [7, 12, 5, 8], [2, 10, 9, 10], [3, 9, 2, 7]];
      for (const [x0, x1, y0, y1] of quads) {
        for (let tries = 0; tries < 30; tries++) {
          const x = x0 + Math.floor(rand() * (x1 - x0 + 1)), y = y0 + Math.floor(rand() * (y1 - y0 + 1));
          if (!free(x, y)) continue;
          grid[y][x] = 'Q'; targets.push([x, y]);
          break;
        }
      }
    }
    if (def.time === 'night') {
      let placed = 0;
      for (let tries = 0; tries < 80 && placed < 5; tries++) {
        const x = Math.floor(rand() * 13), y = 2 + Math.floor(rand() * 9);
        if (!free(x, y) || grid[y][x] === 'L') continue;
        grid[y][x] = 'L'; placed++;
      }
    }
    connect(grid, targets, rand);
    return { rows: grid.map(r => r.join('')), waypoints };
  }

  function params(mission, regionIdx, level) {
    switch (mission) {
      case 'defend': return { enemies: Math.min(24, 12 + level) };
      case 'collect': return { skins: 6 };
      case 'towers': return { towerHp: 5 + regionIdx * 2 };
      case 'escort': return { camels: 3, camelHp: 4 };
      case 'survive': return { seconds: 60 + regionIdx * 15 };
      case 'boss': return { bossHp: 50 + regionIdx * 15 };
    }
    return {};
  }

  function stageFrom(def, n, level) {
    const regionIdx = REGION_ORDER.indexOf(def.region);
    const towers = def.mission === 'towers' ? (level < 8 ? 2 : 3) : 0;
    const map = build(Object.assign({}, def, { level, towers }));
    return {
      n, name: def.name, region: def.region, mission: def.mission, time: def.time, brief: def.brief,
      rows: map.rows, waypoints: map.waypoints, level, regionIdx,
      well: MISSIONS[def.mission].well, mix: REGIONS[def.region].mix,
      params: params(def.mission, regionIdx, level),
    };
  }

  const MISSION_CYCLE = ['defend', 'collect', 'towers', 'escort', 'survive', 'boss'];
  const DEFAULT_BRIEF = {
    defend: 'موجة جديدة من العقارب تقترب. احمِ البئر.',
    collect: 'القِرَب متناثرة في الساحة. اجمعها قبل العدو.',
    towers: 'أبراج جديدة للعقارب. اهدمها كلها.',
    escort: 'قافلة تحتاج حمايتك حتى تعبر.',
    survive: 'ليلة طويلة. اصمد حتى الفجر.',
    boss: 'قلعة متحركة جديدة. أوقفها!',
  };
  function generated(n, seed, region, mission, level, name) {
    const time = mission === 'survive' ? 'night' : mission === 'boss' ? 'dusk' : ['day', 'dawn', 'dusk'][seed % 3];
    return stageFrom({ region, mission, time, seed, name, brief: DEFAULT_BRIEF[mission] }, n, level);
  }

  // ---------- sharing editor maps ----------
  // Each 8px block is one of 8 values; runs are packed as 3 bits value + 5 bits length, then base64url
  const CODE_CHARS = '.#@~%-*T';
  function encodeMap(rows) {
    const flat = rows.join('');
    const bytes = [];
    for (let i = 0; i < flat.length;) {
      const v = Math.max(0, CODE_CHARS.indexOf(flat[i]));
      let run = 1;
      while (run < 32 && i + run < flat.length && flat[i + run] === flat[i]) run++;
      bytes.push((v << 5) | (run - 1));
      i += run;
    }
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'W1' + b64;
  }
  function decodeMap(code) {
    try {
      const clean = String(code).trim().replace(/^.*[?&]map=/, '').replace(/\s+/g, '');
      if (!clean.startsWith('W1')) return null;
      const bin = atob(clean.slice(2).replace(/-/g, '+').replace(/_/g, '/'));
      let flat = '';
      for (let i = 0; i < bin.length; i++) {
        const b = bin.charCodeAt(i);
        flat += CODE_CHARS[b >> 5].repeat((b & 31) + 1);
      }
      if (flat.length !== 26 * 26) return null;
      return Array.from({ length: 26 }, (_, y) => flat.slice(y * 26, y * 26 + 26));
    } catch (e) {
      return null;
    }
  }

  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function seedOf(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  TB.levels = {
    REGION_ORDER, REGIONS, MISSIONS,
    count: CAMPAIGN.length,
    regionOf: n => CAMPAIGN[Math.min(n, CAMPAIGN.length) - 1].region,
    get(n) {
      if (n <= CAMPAIGN.length) return stageFrom(CAMPAIGN[n - 1], n, n - 1);
      const i = n - CAMPAIGN.length - 1, region = REGION_ORDER[i % 5], mission = MISSION_CYCLE[i % 6];
      return generated(n, n * 7919 + 13, region, mission, Math.min(30, n - 1), REGIONS[region].name + ' · ' + (n - CAMPAIGN.length));
    },
    daily(key) {
      const k = key || dayKey(), seed = seedOf('waha' + k);
      const region = REGION_ORDER[seed % 5], mission = MISSION_CYCLE[(seed >>> 3) % 6];
      const st = generated(0, seed % 100000 + 1, region, mission, 10, 'تحدي اليوم');
      st.daily = k;
      return st;
    },
    custom(rows) {
      const towers = rows.some(r => r.includes('T'));
      const mission = towers ? 'towers' : 'defend';
      return {
        n: 0, name: 'خريطتي', region: 'desert', mission, time: 'day', brief: 'خريطة من تصميمك. ' + DEFAULT_BRIEF[mission],
        rows, waypoints: null, level: 6, regionIdx: 1, well: true, mix: REGIONS.oasis.mix, custom: true,
        params: mission === 'towers' ? { towerHp: 7 } : { enemies: 20 },
      };
    },
    encodeMap, decodeMap, dayKey, reserved,
  };
})();
