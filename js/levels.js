// Stage maps: 13x13 tiles of 16px. Each row is one string.
//   .  empty        #  brick       @  steel       ~  water       %  trees       -  ice
//   [ ] ^ _  brick halves (left, right, top, bottom)
//   { } / \  steel halves (left, right, top, bottom)
// Enemy spawns (top row, columns 0/6/12), the player spawn (row 12, column 4) and the
// fortress around the base (rows 11-12, columns 5-7) must stay empty; the engine builds the fortress.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};

  const STAGES = [
    { name: 'البداية', map: [
      '.............',
      '..##.....##..',
      '..##.%%%.##..',
      '.....%@%.....',
      '.##.......##.',
      '.^^.##.##.^^.',
      '.....#.#.....',
      '~~.........~~',
      '...##...##...',
      '.#.#.....#.#.',
      '.#.#.###.#.#.',
      '.#.#.....#.#.',
      '.#.#.....#.#.',
    ] },
    { name: 'النهر', map: [
      '.............',
      '.##.##.##.##.',
      '.##.##.##.##.',
      '.............',
      '@@.##...##.@@',
      '......%......',
      '~~~.~~~~~.~~~',
      '......%......',
      '.##.@...@.##.',
      '.##.#.#.#.##.',
      '.....###.....',
      '.#.#.....#.#.',
      '.#.#.....#.#.',
    ] },
    { name: 'الغابة', map: [
      '.............',
      '.%%%.%%%.%%%.',
      '.%#%.%#%.%#%.',
      '.%%%.%%%.%%%.',
      '....#...#....',
      '%%.##.@.##.%%',
      '%%.........%%',
      '...%%%#%%%...',
      '.#.%.....%.#.',
      '.#.%.###.%.#.',
      '.#.........#.',
      '%%%%.....%%%%',
      '%%%.......%%%',
    ] },
    { name: 'البحيرة المتجمدة', map: [
      '.............',
      '.##.......##.',
      '.#.---.---.#.',
      '...-------...',
      '.@.--#.#--.@.',
      '...--#.#--...',
      '##.-------.##',
      '...---@---...',
      '.#.-------.#.',
      '.#..--.--..#.',
      '...#.....#...',
      '.##.......##.',
      '.#.........#.',
    ] },
    { name: 'المتاهة', map: [
      '.............',
      '.#####.#####.',
      '.#.........#.',
      '.#.###.###.#.',
      '...#.....#...',
      '##.#.#@#.#.##',
      '...#.#.#.#...',
      '.###.#.#.###.',
      '.....[.].....',
      '.#####.#####.',
      '.............',
      '.##.......##.',
      '.#.........#.',
    ] },
    { name: 'القلعة الفولاذية', map: [
      '.............',
      '..@@.....@@..',
      '..@.......@..',
      '.....###.....',
      '.@@.#...#.@@.',
      '....#.@.#....',
      '#.#.#...#.#.#',
      '....##.##....',
      '.@.........@.',
      '.@.##.%.##.@.',
      '...#..%..#...',
      '.##.......##.',
      '.@#.......#@.',
    ] },
    { name: 'الجزر', map: [
      '.............',
      '.~~~.....~~~.',
      '.~#~.#.#.~#~.',
      '.~~~.....~~~.',
      '....~~.~~....',
      '.##.~%.%~.##.',
      '.##.~~.~~.##.',
      '.............',
      '~~.~~~#~~~.~~',
      '.....#.#.....',
      '.#.#.....#.#.',
      '.#.#.....#.#.',
      '...#.....#...',
    ] },
    { name: 'رقعة الشطرنج', map: [
      '.............',
      '.#.@.#.#.@.#.',
      '#.#.#.#.#.#.#',
      '.#.#.#.#.#.#.',
      '#.@.#...#.@.#',
      '.#.#.#%#.#.#.',
      '#.#.%%%%%.#.#',
      '.#.#.#%#.#.#.',
      '#.@.#...#.@.#',
      '.#.#.#.#.#.#.',
      '#.#.#.#.#.#.#',
      '.#.#.....#.#.',
      '#.#.......#.#',
    ] },
    { name: 'الأسهم', map: [
      '.............',
      '#...........#',
      '.#....@....#.',
      '..#..#.#..#..',
      '...#.....#...',
      '@...#.#.#...@',
      '.~~..#.#..~~.',
      '.~~.......~~.',
      '....#.#.#....',
      '...#.#.#.#...',
      '..#.......#..',
      '.#.........#.',
      '#...........#',
    ] },
    { name: 'الصليب', map: [
      '.............',
      '.@@@.....@@@.',
      '.@.........@.',
      '.@.##%%%##.@.',
      '...#.....#...',
      '...#.@@@.#...',
      '%%.%.@.@.%.%%',
      '...#.@.@.#...',
      '...#.....#...',
      '.@.##%%%##.@.',
      '.@.........@.',
      '.@@@.....@@@.',
      '.............',
    ] },
    { name: 'العاصفة', map: [
      '.............',
      '.#.~~.%.~~.#.',
      '.#.~~#%#~~.#.',
      '.@...#%#...@.',
      '..##.....##..',
      '-----#.#-----',
      '-@@--#.#--@@-',
      '-----...-----',
      '..##.#.#.##..',
      '%.#..#.#..#.%',
      '%%#.......#%%',
      '.#.........#.',
      '.#.........#.',
    ] },
    { name: 'الحصن الأخير', map: [
      '.............',
      '.@.@.@.@.@.@.',
      '.#.#.#.#.#.#.',
      '~~.~~.#.~~.~~',
      '.....###.....',
      '.@#.......#@.',
      '.@#.%%%%%.#@.',
      '.@#.%@#@%.#@.',
      '....%%%%%....',
      '##.........##',
      '.~~.#.#.#.~~.',
      '.~~.......~~.',
      '...#.....#...',
    ] },
  ];

  // Tiles that must stay clear: enemy spawns, player spawn, base and its fortress
  function reserved(tx, ty) {
    if (ty === 0 && (tx === 0 || tx === 6 || tx === 12)) return true;
    if (ty === 12 && tx === 4) return true;
    if (ty >= 11 && tx >= 5 && tx <= 7) return true;
    return false;
  }

  // Seeded RNG so a generated stage looks the same every time it is played
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Tanks can drive through empty, trees, ice and (by shooting) bricks; steel and water block
  function reachable(rows) {
    const open = (x, y) => { const c = rows[y][x]; return c !== '@' && c !== '~'; };
    const seen = new Set(['4,12']);
    const queue = [[4, 12]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx > 12 || ny > 12 || seen.has(k) || !open(nx, ny)) continue;
        seen.add(k); queue.push([nx, ny]);
      }
    }
    return seen.has('0,0') && seen.has('6,0') && seen.has('12,0');
  }

  // Endless stages after the hand-made ones: mirrored random clusters that stay connected
  function generate(n) {
    const rand = rng(n * 7919 + 13);
    const harder = Math.min(1, (n - STAGES.length) / 12);
    const weights = [
      ['#', 0.55 - harder * 0.15], ['@', 0.08 + harder * 0.12], ['~', 0.1], ['%', 0.15], ['-', 0.07], ['[', 0.025], [']', 0.025],
    ];
    const pick = () => {
      let r = rand() * weights.reduce((a, w) => a + w[1], 0);
      for (const [c, w] of weights) { if ((r -= w) <= 0) return c; }
      return '#';
    };
    const mirror = { '[': ']', ']': '[' };
    for (let attempt = 0; attempt < 40; attempt++) {
      const grid = Array.from({ length: 13 }, () => Array(13).fill('.'));
      const clusters = 12 + Math.floor(rand() * 7);
      for (let i = 0; i < clusters; i++) {
        const c = pick();
        const w = 1 + Math.floor(rand() * 3), h = 1 + Math.floor(rand() * 3);
        const x0 = Math.floor(rand() * 7), y0 = 1 + Math.floor(rand() * 10);
        for (let y = y0; y < Math.min(13, y0 + h); y++) {
          for (let x = x0; x < Math.min(7, x0 + w); x++) {
            if (rand() < 0.85) { grid[y][x] = c; grid[y][12 - x] = x === 6 ? c : (mirror[c] || c); }
          }
        }
      }
      for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (reserved(x, y)) grid[y][x] = '.';
      const rows = grid.map(r => r.join(''));
      if (reachable(rows)) return rows;
    }
    return STAGES[n % STAGES.length].map;
  }

  TB.levels = {
    count: STAGES.length,
    reserved,
    reachable,
    get(n) {
      if (n <= STAGES.length) return { name: STAGES[n - 1].name, map: STAGES[n - 1].map };
      return { name: 'ساحة ' + n, map: generate(n) };
    },
  };
})();
