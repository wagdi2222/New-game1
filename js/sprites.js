// Pixel art drawn in code: terrain for five regions, vehicles, the well, towers, camels,
// the falcon, power-ups, the commander's portrait and the square Kufic logo.
// Grids hold palette indexes (1 dark, 2 mid, 3 light, 4 shine, 5 accent) or CSS hex colors; 0 is transparent.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};

  const PAL = {
    p1: [null, '#103B22', '#1F7A45', '#3FB36A', '#CBF7DA', '#F2B134'],
    p2: [null, '#0E2A4D', '#1C5DA6', '#4A9BE0', '#D6EDFF', '#F2B134'],
    p3: [null, '#2E1350', '#6A35B0', '#9F6BE0', '#EADCFF', '#F2B134'],
    p4: [null, '#5A2800', '#C25E0A', '#F08A2E', '#FFE3C6', '#FFFFFF'],
    enemy: [null, '#141317', '#38363F', '#625F6B', '#B5B2BE', '#D2412E'],
    bonus: [null, '#083A38', '#13807B', '#35C2B6', '#D8FFF9', '#F2B134'],
    hit: [null, '#6A6A6A', '#E4E4E4', '#FFFFFF', '#FFFFFF', '#FFFFFF'],
    stun: [null, '#3A3A3A', '#7A7A7A', '#A8A8A8', '#E0E0E0', '#A8A8A8'],
  };

  const blank = (w, h) => Array.from({ length: h }, () => Array(w).fill(0));
  const hexCache = {};
  function rgb(hex) {
    if (!hexCache[hex]) hexCache[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    return hexCache[hex];
  }

  function toCanvas(grid, colors) {
    const h = grid.length, w = grid[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = grid[y][x];
        const col = typeof v === 'string' ? v : (v && colors ? colors[v] : null);
        if (!col) continue;
        const [r, g, b] = rgb(col), i = (y * w + x) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Strings to a color grid: each character maps to a color in `map`, '.' is transparent
  function fromStrings(rows, map) {
    const w = Math.max(...rows.map(r => r.length));
    return rows.map(r => [...r.padEnd(w, '.')].map(ch => map[ch] || 0));
  }
  const mirror = rows => rows.map(r => r + [...r].reverse().join(''));
  const flipX = grid => grid.map(r => r.slice().reverse());

  // Quarter turn clockwise: a sprite facing up ends up facing right
  function rotate(grid) {
    const n = grid.length, out = blank(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y][x] = grid[n - 1 - x][y];
    return out;
  }

  function outline(grid, color) {
    const h = grid.length, w = grid[0].length, out = grid.map(r => r.slice());
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && grid[ny][nx]) { out[y][x] = color; break; }
        }
      }
    }
    return out;
  }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function hash(x, y) {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- regions: ground and terrain colors ----------
  const C = hex => rgb(hex);
  const REGIONS = {
    desert: {
      g: ['#E0BC7C', '#D9B472', '#E7C88E', '#CDA765'].map(C), speck: C('#B88F55'),
      road: [C('#C9A066'), C('#BF955B')], rut: C('#A88250'),
      mud: C('#B3743F'), mudHi: C('#CF915A'), mudLo: C('#98602F'), mudJoint: C('#6E4321'), mudSpeck: C('#DDB27A'),
      stone: C('#B4AA98'), stoneHi: C('#DCD3C2'), stoneLo: C('#8C8272'), stoneJoint: C('#5D564B'),
      water: C('#1E9AA8'), waterHi: C('#7FE0E6'), waterMid: C('#3CBFCB'),
      dune: C('#ECCF96'), duneLight: C('#F4DEAE'), duneLine: C('#C9A367'),
      quick: C('#C49C5C'), quickDark: C('#9E7B45'),
    },
    oasis: {
      g: ['#D8C088', '#CFB57B', '#E2CC98', '#C4AA70'].map(C), speck: C('#8DAA4F'),
      road: [C('#C2A26A'), C('#B8975F')], rut: C('#A08552'),
      mud: C('#A86E3E'), mudHi: C('#C68B57'), mudLo: C('#8E5A2F'), mudJoint: C('#683F20'), mudSpeck: C('#D7AE78'),
      stone: C('#ADA796'), stoneHi: C('#D6D1C1'), stoneLo: C('#857E6F'), stoneJoint: C('#58534A'),
      water: C('#1A8FA0'), waterHi: C('#8BE6E8'), waterMid: C('#35B5C2'),
      dune: C('#E6CF9E'), duneLight: C('#F0DDB6'), duneLine: C('#BFA06C'),
      quick: C('#B99A62'), quickDark: C('#8F7647'),
    },
    mountains: {
      g: ['#B39A79', '#A98E6C', '#BFA887', '#987C5C'].map(C), speck: C('#7C6550'),
      road: [C('#9C8262'), C('#927858')], rut: C('#7E6750'),
      mud: C('#9C6A43'), mudHi: C('#B8835A'), mudLo: C('#835735'), mudJoint: C('#5C3B22'), mudSpeck: C('#C79E74'),
      stone: C('#8F8C88'), stoneHi: C('#BEBBB5'), stoneLo: C('#6C6965'), stoneJoint: C('#45433F'),
      water: C('#2B86B5'), waterHi: C('#9AD4F0'), waterMid: C('#4FA8D6'),
      dune: C('#C9B08E'), duneLight: C('#D8C3A3'), duneLine: C('#9C8366'),
      quick: C('#9F865F'), quickDark: C('#7A6646'),
    },
    coast: {
      g: ['#EAD8AD', '#E2CD9E', '#F2E3BF', '#D6BF8D'].map(C), speck: C('#F8F1E3'),
      road: [C('#D6BE8C'), C('#CCB381')], rut: C('#B79E70'),
      mud: C('#B98450'), mudHi: C('#D6A06A'), mudLo: C('#9C6C3D'), mudJoint: C('#704B27'), mudSpeck: C('#E5C08C'),
      stone: C('#BDB5A5'), stoneHi: C('#E3DCCD'), stoneLo: C('#958C7C'), stoneJoint: C('#625B50'),
      water: C('#1D6EB0'), waterHi: C('#8CCBF2'), waterMid: C('#3E92D2'),
      dune: C('#F2E0B8'), duneLight: C('#FAEDD0'), duneLine: C('#D3BC8C'),
      quick: C('#D0B47F'), quickDark: C('#A88E5E'),
    },
    oldcity: {
      g: ['#C9B38E', '#C1A982', '#D2BE9B', '#B89F78'].map(C), speck: C('#A68F6C'), joint: C('#A08A68'), paving: true,
      road: [C('#B49B74'), C('#AA916A')], rut: C('#937D5B'),
      mud: C('#D9C6A0'), mudHi: C('#EDE0C4'), mudLo: C('#BFA97F'), mudJoint: C('#8E7A57'), mudSpeck: C('#F6EEDC'),
      stone: C('#A79C8A'), stoneHi: C('#D0C6B3'), stoneLo: C('#81776A'), stoneJoint: C('#554E45'),
      water: C('#1C8C9C'), waterHi: C('#86DDE3'), waterMid: C('#37B1BE'),
      dune: C('#DCC7A0'), duneLight: C('#E8D6B4'), duneLine: C('#B39C76'),
      quick: C('#B8A07A'), quickDark: C('#917D5C'),
    },
  };

  // 16px palm crown seen from above; dates hang near the trunk
  const PALM = (() => {
    const g = blank(16, 16);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7 + 0.35;
      for (let t = 1.5; t <= 7.6; t += 0.5) {
        const x = Math.round(7.5 + Math.cos(a) * t), y = Math.round(7.5 + Math.sin(a) * t * 0.95);
        if (x < 0 || y < 0 || x > 15 || y > 15) continue;
        g[y][x] = t < 3.5 ? '#2F8A3A' : '#3FA344';
        if (t > 2.5) {
          const lx = Math.round(7.5 + Math.cos(a) * t + Math.sin(a)), ly = Math.round(7.5 + Math.sin(a) * t * 0.95 - Math.cos(a));
          const rx = Math.round(7.5 + Math.cos(a) * t - Math.sin(a)), ry = Math.round(7.5 + Math.sin(a) * t * 0.95 + Math.cos(a));
          if (lx >= 0 && ly >= 0 && lx < 16 && ly < 16 && !g[ly][lx]) g[ly][lx] = '#1F5E2A';
          if (rx >= 0 && ry >= 0 && rx < 16 && ry < 16 && !g[ry][rx] && t > 4) g[ry][rx] = '#6CC04A';
        }
      }
    }
    for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) g[y][x] = '#7A5230';
    for (const [x, y] of [[6, 9], [9, 6], [9, 9], [6, 6]]) g[y][x] = '#C2711F';
    return g.map(r => r.map(c => (c ? rgb(c) : null)));
  })();

  function groundPixel(x, y, R, road) {
    const n = hash(x, y);
    if (road) {
      if (((x & 7) === 2 || (x & 7) === 5) && n < 0.35) return R.rut;
      return n < 0.6 ? R.road[0] : R.road[1];
    }
    if (R.paving) {
      const off = (y >> 3) & 1 ? 4 : 0;
      if (((x + off) & 7) === 0 || (y & 7) === 0) return R.joint;
    }
    if (n > 0.988) return R.speck;
    return n < 0.55 ? R.g[0] : n < 0.8 ? R.g[1] : n < 0.94 ? R.g[2] : R.g[3];
  }

  // type codes match the engine: 1 mud, 2 stone, 3 water, 4 palm, 5 dune, 6 quicksand
  function terrainPixel(type, x, y, frame, region, road) {
    const R = REGIONS[region] || REGIONS.desert;
    if (type === 1) {
      const row = y >> 2, off = row & 1 ? 4 : 0, lx = (x + off) & 7, ly = y & 3;
      if (ly === 3 || lx === 7) return R.mudJoint;
      if (ly === 0) return R.mudHi;
      const n = hash(x, y);
      if (n < 0.1) return R.mudSpeck;
      return lx === 6 || n < 0.25 ? R.mudLo : R.mud;
    }
    if (type === 2) {
      const lx = x & 7, ly = y & 7, v = hash(x >> 3, y >> 3) < 0.5;
      if (lx === 7 || ly === 7) return R.stoneJoint;
      if (v ? ly === 3 || (lx === 3 && ly < 3) : ly === 4 || (lx === 4 && ly > 4)) return R.stoneJoint;
      if (lx === 0 || ly === 0 || (v ? ly === 4 : ly === 5)) return R.stoneHi;
      if (lx === 6 || ly === 6 || hash(x, y) < 0.08) return R.stoneLo;
      return R.stone;
    }
    if (type === 3) {
      const w = (x + (y >> 2) * 5 + frame * 2) % 10, ly = y & 3;
      if (ly === 1 && w < 2) return R.waterHi;
      if (ly === 2 && w === 3) return R.waterMid;
      return R.water;
    }
    if (type === 4) return PALM[y & 15][x & 15];
    if (type === 5) {
      const s = Math.sin(x * 0.5 + (y >> 4) * 1.3) * 1.6, v = (((y + s) % 5) + 5) % 5;
      return v < 1 ? R.duneLine : v < 2 ? R.duneLight : R.dune;
    }
    if (type === 6) {
      const cx = (x & 15) - 7.5, cy = (y & 15) - 7.5, d = Math.hypot(cx, cy), a = Math.atan2(cy, cx);
      const v = (((d * 0.9 + a * 1.6 - frame * 0.8) % 3.2) + 3.2) % 3.2;
      return v < 1.1 || d < 1.5 ? R.quickDark : R.quick;
    }
    return groundPixel(x, y, R, road);
  }

  // ---------- vehicles (16px, or 32px for the boss), all facing up ----------
  function vehicleGrid(design, frame) {
    const n = design === 'boss' ? 32 : 16, g = blank(n, n);
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < n && y < n) g[y][x] = c; };
    const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c); };
    const tread = (x0, w, y0, y1, outerLeft) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x < x0 + w; x++) {
          let c = (y + frame) % 2 === 0 ? 3 : 2;
          if (y === y0 || y === y1) c = 1;
          if (outerLeft ? x === x0 : x === x0 + w - 1) c = c === 3 ? 2 : 1;
          px(x, y, c);
        }
      }
    };
    const hull = (x0, y0, x1, y1) => {
      rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, 2);
      for (let x = x0; x <= x1; x++) { px(x, y0, 3); px(x, y1, 1); }
      for (let y = y0; y <= y1; y++) { px(x0, y, 3); px(x1, y, 1); }
    };
    const turret = (x0, y0, x1, y1, round) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (round && (x === x0 || x === x1) && (y === y0 || y === y1)) continue;
          px(x, y, x === x1 || y === y1 ? 2 : 3);
        }
      }
    };
    const barrel = (x, y0, y1) => {
      for (let y = y0; y <= y1; y++) { px(x, y, 3); px(x + 1, y, 2); }
      px(x, y0, 2); px(x + 1, y0, 1);
    };
    const wheel = (x, y, h) => { for (let j = 0; j < h; j++) { px(x, y + j, (y + j + frame) % 2 ? 1 : 2); px(x + 1, y + j, 1); } };

    switch (design) {
      case 'A':
        tread(1, 3, 2, 15, true); tread(12, 3, 2, 15, false);
        hull(4, 4, 11, 13); turret(5, 6, 10, 11, true);
        px(6, 7, 4); barrel(7, 0, 6); px(7, 12, 5); px(8, 12, 5);
        break;
      case 'B':
        tread(2, 2, 2, 15, true); tread(12, 2, 2, 15, false);
        hull(4, 5, 11, 14); rect(5, 3, 6, 2, 2);
        for (let x = 5; x <= 10; x++) px(x, 3, 3);
        turret(6, 7, 9, 11, true); px(6, 8, 4); barrel(7, 0, 7); px(7, 13, 5); px(8, 13, 5);
        break;
      case 'C':
        tread(1, 3, 3, 15, true); tread(12, 3, 3, 15, false);
        hull(4, 5, 11, 14); turret(4, 6, 11, 13, true);
        px(5, 7, 4); px(6, 7, 4); px(5, 8, 4); barrel(7, 0, 6);
        for (const y of [1, 2]) { px(6, y, 1); px(7, y, 3); px(8, y, 2); px(9, y, 1); }
        px(9, 12, 5); px(10, 12, 5);
        break;
      case 'D':
        tread(0, 4, 2, 15, true); tread(12, 4, 2, 15, false);
        hull(4, 3, 11, 15);
        for (let x = 5; x <= 10; x++) { px(x, 5, 1); px(x, 14, 1); }
        turret(5, 6, 10, 12, false);
        px(5, 6, 5); px(10, 6, 5); px(5, 12, 5); px(10, 12, 5); px(6, 7, 4); px(7, 7, 4);
        for (let y = 0; y <= 6; y++) { px(6, y, 3); px(9, y, 2); }
        px(6, 0, 1); px(9, 0, 1);
        break;
      case 'jeep':
        wheel(3, 3, 4); wheel(11, 3, 4); wheel(3, 10, 4); wheel(11, 10, 4);
        rect(5, 2, 6, 13, 2);
        for (let x = 5; x <= 10; x++) { px(x, 2, 1); px(x, 3, 3); px(x, 4, 3); px(x, 6, 4); px(x, 12, 5); px(x, 14, 1); }
        px(5, 5, 3); px(10, 5, 1); px(7, 9, 1); px(8, 9, 1); px(7, 10, 1); px(8, 10, 1);
        for (let y = 0; y <= 8; y++) { px(7, y, 1); px(8, y, y < 2 ? 1 : 3); }
        break;
      case 'scorpion':
        tread(1, 3, 4, 15, true); tread(12, 3, 4, 15, false);
        hull(4, 4, 11, 14);
        // pincers at the front corners
        for (const [x, y] of [[1, 1], [1, 2], [2, 3], [3, 3], [3, 2], [2, 0]]) { px(x, y, 3); px(15 - x, y, 3); }
        px(1, 0, 5); px(14, 0, 5);
        // segmented stinger running over the hull to the front
        for (let y = 4; y <= 13; y++) { const c = y % 2 ? 1 : 3; px(7, y, c); px(8, y, c === 3 ? 2 : 1); }
        for (const [x, y] of [[7, 3], [8, 3], [7, 2], [8, 2], [8, 1], [9, 1], [9, 0]]) px(x, y, 5);
        break;
      case 'mortar':
        for (const y of [2, 9, 12]) { wheel(2, y, 3); wheel(12, y, 3); }
        rect(4, 1, 8, 5, 2);
        for (let x = 5; x <= 10; x++) { px(x, 1, 1); px(x, 2, 4); px(x, 4, 3); }
        rect(4, 6, 8, 10, 2);
        for (let y = 6; y <= 15; y++) { px(4, y, 3); px(11, y, 1); }
        for (let x = 4; x <= 11; x++) px(x, 15, 1);
        for (let y = 8; y <= 13; y++) for (let x = 6; x <= 9; x++) {
          const edge = x === 6 || x === 9 || y === 8 || y === 13;
          if ((x === 6 || x === 9) && (y === 8 || y === 13)) continue;
          px(x, y, edge ? 3 : 1);
        }
        px(5, 7, 5); px(10, 7, 5); px(5, 14, 5); px(10, 14, 5);
        break;
      case 'miner':
        tread(1, 3, 1, 14, true); tread(12, 3, 1, 14, false);
        hull(4, 2, 11, 13); turret(6, 4, 9, 7, true); barrel(7, 0, 4);
        px(5, 9, 3); px(10, 9, 3); px(5, 10, 1); px(10, 10, 1);
        for (let y = 11; y <= 15; y++) for (let x = 5; x <= 10; x++) px(x, y, (x + y) % 2 ? 1 : 5);
        break;
      case 'heavy':
        tread(0, 4, 1, 15, true); tread(12, 4, 1, 15, false);
        hull(4, 3, 11, 15);
        for (let x = 5; x <= 10; x++) { px(x, 4, 1); px(x, 14, 1); }
        turret(5, 6, 10, 12, false);
        for (const [x, y] of [[5, 6], [10, 6], [5, 12], [10, 12], [7, 13], [8, 13]]) px(x, y, 5);
        px(6, 7, 4); px(7, 7, 4);
        for (let y = 0; y <= 6; y++) { px(6, y, 3); px(9, y, 2); }
        px(6, 0, 1); px(9, 0, 1);
        break;
      case 'boss': {
        tread(0, 6, 2, 31, true); tread(26, 6, 2, 31, false);
        hull(6, 4, 25, 31);
        // battlements along the edges: a fortress on tracks
        for (let x = 6; x <= 25; x++) px(x, 5, (x >> 1) % 2 ? 1 : 3);
        for (let y = 6; y <= 30; y++) { px(7, y, (y >> 1) % 2 ? 1 : 3); px(24, y, (y >> 1) % 2 ? 1 : 3); }
        for (let y = 9; y <= 26; y++) {
          for (let x = 8; x <= 23; x++) {
            const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 18);
            if (d <= 7.5) px(x, y, d > 6.5 ? 1 : d < 3 ? 5 : d < 3.8 ? 1 : x < 14 && y < 15 ? 4 : 3);
          }
        }
        for (const bx of [10, 15, 20]) { for (let y = 0; y <= 11; y++) { px(bx, y, 3); px(bx + 1, y, 2); } px(bx, 0, 1); px(bx + 1, 0, 1); }
        break;
      }
    }
    return g;
  }

  const cache = new Map();
  function vehicle(design, pal, frame, dir) {
    const key = design + pal + frame + dir;
    let c = cache.get(key);
    if (!c) {
      let g = vehicleGrid(design, frame);
      for (let i = 0; i < dir; i++) g = rotate(g);
      c = toCanvas(g, PAL[pal]);
      cache.set(key, c);
    }
    return c;
  }
  function shadow(design, dir) {
    const key = 'sh' + design + dir;
    let c = cache.get(key);
    if (!c) {
      let g = vehicleGrid(design, 0);
      for (let i = 0; i < dir; i++) g = rotate(g);
      c = toCanvas(g.map(r => r.map(v => (v ? '#000000' : 0))));
      cache.set(key, c);
    }
    return c;
  }

  // ---------- the well, towers and other pieces ----------
  function wellCanvas(state) {
    const g = blank(16, 16);
    const rnd = rng(state * 31 + 7);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8), a = Math.atan2(y + 0.5 - 8, x + 0.5 - 8);
        if (d > 7.6) continue;
        if (state === 2) {
          if (d > 5.2 && rnd() < 0.55) g[y][x] = rnd() < 0.5 ? '#8C8272' : '#B4AA98';
          else if (d < 4.5) g[y][x] = rnd() < 0.3 ? '#4E3E2A' : '#5E4A32';
          continue;
        }
        if (d > 5.2) {
          const seg = Math.floor((a + Math.PI) / (Math.PI * 2) * 12);
          g[y][x] = d > 7 ? '#5D564B' : seg % 2 ? '#B4AA98' : '#D2C9B6';
          if (state === 1 && rnd() < 0.18) g[y][x] = '#3A342C';
        } else if (d > 4.4) g[y][x] = '#5D564B';
        else g[y][x] = state === 1 ? (d < 2.5 ? '#13606B' : '#0F4E58') : d < 2 || (x < 7 && y < 7 && d < 3.5) ? '#7FE0E6' : '#1E9AA8';
      }
    }
    if (state !== 2) {
      for (let x = 2; x <= 13; x++) { g[6][x] = '#A86B3C'; g[7][x] = '#7A4A24'; }
      for (let y = 4; y <= 9; y++) { g[y][1] = '#5E3A1A'; g[y][14] = '#5E3A1A'; }
      g[8][7] = '#D9C08A'; g[9][7] = '#D9C08A'; g[10][7] = '#5E3A1A'; g[10][8] = '#5E3A1A'; g[11][7] = '#3E2610';
    } else {
      for (const [x, y] of [[1, 6], [2, 6], [3, 7], [11, 8], [12, 8], [13, 9]]) g[y][x] = '#7A4A24';
    }
    return toCanvas(outline(g, '#3A2A1A'));
  }

  const SCORPION = ['..y..y.', '...yy..', '..yy...', '.yyyyy.', 'y.yyy.y', '.yyyyy.', 'y.....y'];
  function towerCanvas(state) {
    const g = blank(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const edge = x < 2 || y < 2 || x > 13 || y > 13;
        if (edge) {
          const merlon = (x < 2 || x > 13) ? (y % 5 !== 2) : (x % 5 !== 2);
          g[y][x] = merlon ? ((x + y) % 2 ? '#625C66' : '#7B7484') : '#2B2430';
          if (x === 0 || y === 0) g[y][x] = merlon ? '#958DA0' : '#2B2430';
        } else g[y][x] = '#2B2430';
      }
    }
    for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) g[y][x] = y === 4 || x === 4 ? '#E0574A' : '#C0392B';
    SCORPION.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'y') g[5 + j][4 + i] = '#F2B134'; }));
    if (state >= 1) for (const [x, y] of [[2, 5], [3, 6], [3, 7], [12, 9], [12, 10], [13, 11], [6, 13], [7, 12]]) g[y][x] = '#141017';
    if (state >= 2) for (const [x, y] of [[10, 2], [10, 3], [11, 3], [2, 11], [3, 11], [4, 12], [9, 13], [13, 4]]) g[y][x] = '#141017';
    return toCanvas(g);
  }
  function rubbleCanvas(seed) {
    const g = blank(16, 16), rnd = rng(seed);
    for (let i = 0; i < 26; i++) {
      const x = 1 + Math.floor(rnd() * 14), y = 1 + Math.floor(rnd() * 14);
      g[y][x] = rnd() < 0.5 ? '#4A4450' : '#6E6676';
      if (rnd() < 0.5 && x < 15) g[y][x + 1] = '#2E2933';
    }
    return toCanvas(g);
  }

  const CAMEL_COLORS = { b: '#B98552', l: '#D9A86C', d: '#6B4423', k: '#1A1A1A', r: '#C0392B', t: '#1FA3A3', y: '#F2B134' };
  const CAMEL_TOP = [
    '................',
    '............lb..',
    '............bbkb',
    '....yyy......bbl',
    '...yrrry....b...',
    '...rtttr...bb...',
    '..rtytytr.bb....',
    '..bbbbbbbbbb....',
    'dbbbbbbbbbbb....',
    'dlbbbbbbbbbl....',
    '..bbbbbbbbb.....',
  ];
  const CAMEL_LEGS = [
    ['..b.b...b.b.....', '..b.b...b.b.....', '..b.b...b.b.....', '..d.d...d.d.....'],
    ['..b..b.b..b.....', '.b...b.b...b....', '.b...b.b...b....', '.d...d.d...d....'],
  ];
  function camelCanvas(frame, left, hurt) {
    let g = fromStrings(CAMEL_TOP.concat(CAMEL_LEGS[frame], ['................']), hurt ? { b: '#FFFFFF', l: '#FFFFFF', d: '#DDDDDD', k: '#888888', r: '#FFFFFF', t: '#FFFFFF', y: '#FFFFFF' } : CAMEL_COLORS);
    if (left) g = flipX(g);
    return toCanvas(outline(g, '#3A2414'));
  }

  const SKIN = [
    '................',
    '..........w.....',
    '......kk..ww....',
    '.....kyyk.......',
    '......bb........',
    '.....bbbb.......',
    '....bbllbb......',
    '...bbllbbbb.....',
    '...bllbbbbbb....',
    '..bbllbbbbbbb...',
    '..bbbbbbbbbbd...',
    '..bbbbbbbbbdd...',
    '...dbbbbbbdd....',
    '....ddddddd.....',
  ];
  const skinCanvas = () => toCanvas(outline(fromStrings(SKIN, { b: '#8B5A2B', l: '#B07A45', d: '#5E3A1A', y: '#E0B040', k: '#3A2A1A', w: '#4FC3F7' }), '#2A1A0A'));

  const mineCanvas = on => toCanvas(fromStrings(['..kkkk..', '.kgggGk.', 'kggrrgGk', 'kggrrggk', 'kgggggGk', '.kgggGk.', '..kkkk..'],
    { k: '#1C1C1C', g: '#4A4A4A', G: '#6E6E6E', r: on ? '#FF3B2F' : '#7A1810' }));

  const LANTERN = ['....yy....', '...kyyk...', '..kkkkkk..', '.kOoOoOok.', '.kOoOoOok.', '.koOoOoOk.', '.kOoOoOok.', '..kkkkkk..', '...kyyk...', '....kk....'];
  const lanternCanvas = () => toCanvas(fromStrings(LANTERN, { O: '#FFE08A', o: '#F2A62B', k: '#5A3A12', y: '#C9A23A' }));

  const DHOW = [
    '..............m.................',
    '.............wm.................',
    '............wwm.................',
    '...........wwWm.................',
    '..........wwwWm.................',
    '.........wwwwWmw................',
    '........wwwwwWmww...............',
    '.......wwwwwwWmwww..............',
    '......wwwwwwwWmwwww.............',
    '.....wwwwwwwwWmwwwww............',
    '..hhhhhhhhhhhhmhhhhhhhhhhhhhh...',
    '...HHHHyHHHHHHHHHHHHHyHHHHHHh...',
    '....HHHHHHHHHHHHHHHHHHHHHHHH....',
    '.....hhhhhhhhhhhhhhhhhhhhhh.....',
    '......ff.ff.ff.ff.ff.ff.ff......',
  ];
  const dhowCanvas = () => toCanvas(fromStrings(DHOW, { w: '#F5EFE0', W: '#D8CDB6', m: '#5A3A1A', h: '#A86B3C', H: '#7A4A24', y: '#F2B134', f: '#E8F7FF' }));

  const FALCON = [
    mirror(['........', '.......k', '......ky', '......bb', '.....bBl', 'bb..bbBl', '.bbbbbBl', '..bbbbBl', '...bbbBl', '....bbBl', '......bl', '......bB', '.....bb.', '.....b..', '........', '........']),
    mirror(['........', '.......k', '......ky', '......bb', '.....bBl', '....bbBl', '...bbbBl', '...bbbBl', '....bbBl', '.....bBl', '......bl', '......bB', '.....bb.', '.....b..', '........', '........']),
  ];
  const falconCanvas = f => toCanvas(outline(fromStrings(FALCON[f], { b: '#6B4A2E', B: '#8E6640', l: '#E8D9BC', k: '#2A1E14', y: '#F2B134' }), '#20160C'));

  // ---------- power-ups ----------
  function powerupCanvas(type) {
    let g = blank(16, 16);
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = c; };
    if (type === 'shield') {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
          if (d > 6.9) continue;
          px(x, y, d > 5.6 ? (x + y < 15 ? '#E8C25A' : '#B48A28') : d < 1.6 ? '#F2B134' : d > 2.6 && d < 3.5 ? '#5E6E7E' : x + y < 13 ? '#C2CDD8' : '#8E9CAB');
        }
      }
      px(4, 5, '#FFFFFF'); px(5, 4, '#FFFFFF');
      for (const [x, y] of [[8, 3], [8, 12], [3, 8], [12, 8]]) px(x, y, '#5E6E7E');
    } else if (type === 'whirl') {
      for (let t = 0; t < 24; t += 0.25) {
        const r = 0.6 + t * 0.27, a = t * 0.8;
        const x = Math.round(7.5 + Math.cos(a) * r), y = Math.round(9 + Math.sin(a) * r * 0.7 - t * 0.12);
        px(x, y, t < 8 ? '#8E6A3A' : t < 16 ? '#C9A266' : '#EED7A6');
      }
    } else if (type === 'mason') {
      for (let y = 8; y <= 14; y++) {
        for (let x = 1; x <= 14; x++) {
          const off = y > 11 ? 3 : 0, joint = y === 11 || y === 14 || (x + off) % 6 === 0;
          px(x, y, joint ? '#5D564B' : y === 8 || y === 12 ? '#DCD3C2' : '#B4AA98');
        }
      }
      for (const [x, y] of [[10, 1], [11, 2], [12, 3], [11, 4], [10, 5], [9, 4], [8, 3], [9, 2], [10, 2], [10, 3], [10, 4], [11, 3], [9, 3]]) px(x, y, y < 3 || x > 10 ? '#E6EAF0' : '#AEB6C2');
      px(9, 6, '#7A4A24'); px(8, 7, '#7A4A24'); px(7, 7, '#A86B3C');
    } else if (type === 'hammer') {
      for (let y = 2; y <= 6; y++) for (let x = 2; x <= 11; x++) px(x, y, y === 2 ? '#C6CDD6' : y === 6 ? '#3F454E' : x < 5 ? '#6B737E' : '#8C949F');
      for (let y = 7; y <= 14; y++) { px(7, y, '#A86B3C'); px(8, y, '#7A4A24'); }
      for (const [x, y] of [[13, 1], [14, 3], [12, 0], [1, 9], [3, 10], [13, 8]]) px(x, y, '#F2B134');
    } else if (type === 'falcon') {
      g = fromStrings(FALCON[0], { b: '#6B4A2E', B: '#8E6640', l: '#E8D9BC', k: '#2A1E14', y: '#F2B134' });
    } else if (type === 'dates') {
      for (let x = 4; x <= 11; x++) px(x, 2, '#E0A030');
      for (const [x, y] of [[3, 3], [12, 3], [7, 3], [8, 3]]) px(x, y, '#E0A030');
      for (const [cx, cy] of [[4, 6], [8, 6], [12, 6], [6, 10], [10, 10], [8, 13]]) {
        for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 1; x++) {
          if ((y === cy - 2 || y === cy + 2) && x !== cx) continue;
          px(x, y, x === cx - 1 && y < cy ? '#C0702E' : '#7A3B12');
        }
      }
    } else if (type === 'coffee') {
      for (let y = 9; y <= 15; y++) {
        const half = y < 11 ? 2 : y < 13 ? 3 : y < 15 ? 4 : 3;
        for (let x = 8 - half; x <= 7 + half; x++) px(x, y, x < 7 ? '#F2CF5A' : x < 9 ? '#D4A938' : '#9C7A20');
      }
      for (let y = 6; y <= 8; y++) for (let x = 6; x <= 9; x++) px(x, y, x < 8 ? '#D4A938' : '#9C7A20');
      for (let x = 5; x <= 10; x++) px(x, 5, '#9C7A20');
      for (let y = 2; y <= 4; y++) for (let x = 7; x <= 8; x++) px(x, y, '#D4A938');
      px(7, 1, '#F2CF5A');
      for (const [x, y] of [[3, 10], [2, 9], [1, 8], [1, 7], [0, 6], [4, 11]]) px(x, y, '#D4A938');
      for (const [x, y] of [[12, 7], [13, 8], [13, 9], [13, 10], [12, 11]]) px(x, y, '#9C7A20');
    } else if (type === 'qirba') {
      g = fromStrings(SKIN, { b: '#8B5A2B', l: '#B07A45', d: '#5E3A1A', y: '#E0B040', k: '#3A2A1A', w: '#4FC3F7' });
    }
    return toCanvas(outline(g, '#1A1208'));
  }

  // ---------- effects ----------
  function boom(size, radius, seed, dust) {
    const rand = rng(seed), g = blank(size, size), c = size / 2;
    const cols = dust ? ['#F6E7C4', '#DCC08C', '#B8935C', '#8C6A3E'] : ['#FFFFFF', '#FFE680', '#FF8A1E', '#C8281A'];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / radius + (rand() - 0.5) * 0.35;
        if (d > 1 || (d > 0.6 && rand() < 0.2)) continue;
        g[y][x] = d < 0.3 ? cols[0] : d < 0.55 ? cols[1] : d < 0.8 ? cols[2] : cols[3];
      }
    }
    return toCanvas(g);
  }

  // A small dust devil swirls where an enemy is about to arrive
  function devilFrame(k) {
    const g = blank(16, 16);
    for (let t = 0; t < 14; t += 0.2) {
      for (let arm = 0; arm < 3; arm++) {
        const r = 0.6 + t * (0.25 + k * 0.08), a = t * 0.9 + arm * 2.1 + k * 0.9;
        const x = Math.round(7.5 + Math.cos(a) * r), y = Math.round(7.5 + Math.sin(a) * r * 0.8);
        if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = t < 4 ? '#8E6A3A' : t < 9 ? '#C9A266' : '#F3DDAA';
      }
    }
    return toCanvas(g);
  }

  function shieldFrame(f, size) {
    const n = size || 16, g = blank(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const outer = x === 0 || y === 0 || x === n - 1 || y === n - 1;
        const inner = !outer && (x === 1 || y === 1 || x === n - 2 || y === n - 2);
        if (outer && (x + y + f * 2) % 4 < 2) g[y][x] = '#FFF3C4';
        else if (inner && (x + y + f * 2 + 2) % 4 < 1) g[y][x] = '#F2B134';
      }
    }
    return toCanvas(g);
  }

  function swirlFrame(f) {
    const g = blank(16, 16);
    for (let t = 0; t < 10; t += 0.3) {
      const a = t + f * 1.6, r = 7 - t * 0.35;
      const x = Math.round(7.5 + Math.cos(a) * r), y = Math.round(7.5 + Math.sin(a) * r);
      if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = t < 5 ? '#F3DDAA' : '#C9A266';
    }
    return toCanvas(g);
  }

  // ---------- the commander: Qa'id Salem in a red shemagh ----------
  function portraitCanvas() {
    const n = 32, g = blank(n, n);
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < n && y < n) g[y][x] = c; };
    for (let y = 26; y < 32; y++) {
      for (let x = 2; x < 30; x++) {
        const spread = (y - 26) * 2 + 14;
        if (Math.abs(x + 0.5 - 16) > spread) continue;
        const center = Math.abs(x + 0.5 - 16);
        px(x, y, center < 3 ? '#F2EFE6' : center < 4 ? '#D4A938' : '#5A3A22');
      }
    }
    for (let y = 1; y < 30; y++) {
      for (let x = 2; x < 30; x++) {
        const top = ((x + 0.5 - 16) / 11) ** 2 + ((y + 0.5 - 12) / 11) ** 2 <= 1 && y < 14;
        const drape = y >= 12 && y < 29 && Math.abs(x + 0.5 - 16) <= 11 + (y - 12) * 0.12 && Math.abs(x + 0.5 - 16) > 3 + (y - 12) * 0.2;
        if (!top && !drape) continue;
        px(x, y, (x + y) % 4 < 1 || (x - y + 64) % 4 < 1 ? '#C8332A' : '#F4EEE6');
      }
    }
    for (let x = 6; x <= 25; x++) {
      for (const yy of [4, 6]) {
        const y = yy + Math.round(((x + 0.5 - 16) / 10) ** 2 * 2.5);
        px(x, y, '#151515');
      }
    }
    for (let y = 10; y < 27; y++) {
      for (let x = 9; x < 23; x++) {
        if (((x + 0.5 - 16) / 6.5) ** 2 + ((y + 0.5 - 18) / 8) ** 2 > 1) continue;
        px(x, y, y >= 21 ? ((x + y) % 3 ? '#4A4A4A' : '#6E6E6E') : x > 18 ? '#A8703F' : '#C68B59');
      }
    }
    for (let x = 12; x <= 14; x++) px(x, 14, '#3A2A20');
    for (let x = 18; x <= 20; x++) px(x, 14, '#3A2A20');
    px(13, 16, '#1A1A1A'); px(19, 16, '#1A1A1A'); px(12, 16, '#FFFFFF'); px(18, 16, '#FFFFFF');
    px(16, 18, '#8E5A30'); px(16, 19, '#8E5A30'); px(17, 19, '#8E5A30');
    for (let x = 12; x <= 20; x++) px(x, 21, '#2E2E2E');
    for (let x = 15; x <= 17; x++) px(x, 22, '#7A3B2A');
    return toCanvas(g);
  }

  // ---------- square Kufic: «حراس الواحة» ----------
  const KUFIC = [
    '........#.....#.#.............#........',
    '#.#.....#.....#.#.............#........',
    '...####.#.....#.#.............#....####',
    '####..#.#.....#.#.............#....#..#',
    '#.#...#.#.###.#.#.......#.#.#.#.......#',
    '#.#...#.#.#.#.#.#.......#.#.#.#.......#',
    '#######.#.#####.#...#...#####.#.#######',
    '..........#.........#...#.......#......',
    '..........#.........#####.......#......',
  ];

  // Eight-point star (khatam) tile used for the frame around the field
  function frameTile() {
    const g = blank(8, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const dx = Math.abs(x + 0.5 - 4), dy = Math.abs(y + 0.5 - 4);
        const sq = Math.max(dx, dy) <= 2.6, dia = dx + dy <= 3.6;
        g[y][x] = sq && dia ? (dx + dy < 1.5 ? '#1FA3A3' : '#F2B134') : sq || dia ? '#B8862A' : (x + y) % 2 ? '#1D3557' : '#16294A';
      }
    }
    return toCanvas(g);
  }

  let fx = null;
  function effects() {
    if (!fx) {
      fx = {
        boomSmall: [boom(16, 3.2, 11), boom(16, 5.5, 23), boom(16, 7.5, 37)],
        boomBig: [boom(32, 11, 51), boom(32, 15, 67)],
        dust: [boom(16, 3, 5, true), boom(16, 5, 9, true), boom(16, 6.5, 13, true)],
        devil: [0, 1, 2, 3].map(devilFrame),
        shield: [shieldFrame(0), shieldFrame(1)],
        shieldBig: [shieldFrame(0, 32), shieldFrame(1, 32)],
        swirl: [0, 1, 2, 3].map(swirlFrame),
        well: [wellCanvas(0), wellCanvas(1), wellCanvas(2)],
        tower: [towerCanvas(0), towerCanvas(1), towerCanvas(2)],
        rubble: [rubbleCanvas(3), rubbleCanvas(8)],
        camel: [[camelCanvas(0, false), camelCanvas(1, false)], [camelCanvas(0, true), camelCanvas(1, true)]],
        camelHurt: [camelCanvas(0, false, true), camelCanvas(0, true, true)],
        skin: skinCanvas(),
        mine: [mineCanvas(true), mineCanvas(false)],
        lantern: lanternCanvas(),
        dhow: dhowCanvas(),
        falcon: [falconCanvas(0), falconCanvas(1)],
        portrait: portraitCanvas(),
        frame: frameTile(),
        powerups: {},
      };
      for (const p of ['shield', 'whirl', 'mason', 'hammer', 'falcon', 'dates', 'coffee', 'qirba']) fx.powerups[p] = powerupCanvas(p);
    }
    return fx;
  }

  // Scale a small sprite into a crisp data URL for DOM images
  function iconURL(canvas, scale) {
    const s = scale || 4, c = document.createElement('canvas');
    c.width = canvas.width * s; c.height = canvas.height * s;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL();
  }

  function terrainSwatch(type, region, size) {
    const n = size || 16, c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d'), im = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const col = terrainPixel(type, x, y, 0, region) || terrainPixel(0, x, y, 0, region), i = (y * n + x) * 4;
        im.data[i] = col[0]; im.data[i + 1] = col[1]; im.data[i + 2] = col[2]; im.data[i + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }

  // Draw the Kufic title with a gold gradient and a deep shadow
  function kuficCanvas(cell) {
    const s = cell || 6, w = KUFIC[0].length, h = KUFIC.length, pad = s;
    const c = document.createElement('canvas');
    c.width = w * s + pad * 2; c.height = h * s + pad * 2;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, pad, 0, pad + h * s);
    grad.addColorStop(0, '#FFE08A'); grad.addColorStop(0.55, '#F2B134'); grad.addColorStop(1, '#C27A12');
    for (const [color, off] of [['#7A2E12', Math.max(2, s / 2)], [grad, 0]]) {
      ctx.fillStyle = color;
      KUFIC.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') ctx.fillRect(pad + x * s + off, pad + y * s + off, s, s); }));
    }
    return c;
  }

  TB.sprites = {
    PAL, REGIONS, vehicle, shadow, terrainPixel, terrainSwatch, effects, iconURL, kuficCanvas, rng, hash,
  };
})();
