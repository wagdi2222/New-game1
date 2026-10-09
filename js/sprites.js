// Pixel art drawn in code: tanks, terrain, base, power-ups and effects.
// Grids hold palette indexes (1 dark, 2 mid, 3 light, 4 shine) or CSS hex colors; 0 is transparent.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};

  const PAL = {
    player: [null, '#6B4A00', '#D89A00', '#FFD23F', '#FFF6C8'],
    enemy: [null, '#363C46', '#858D99', '#C5CBD4', '#FFFFFF'],
    red: [null, '#5C0E0E', '#C02828', '#FF6A5A', '#FFD0C8'],
    green: [null, '#16441E', '#2E8C3A', '#6CD46A', '#D8FFD0'],
    purple: [null, '#36184F', '#7A3CB8', '#B482EC', '#F2E2FF'],
    silver: [null, '#2C3A4E', '#6A86A8', '#B0CAE8', '#FFFFFF'],
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

  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function starPts(cx, cy, R, r, rot) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (rot || 0) + i * Math.PI / 5, d = i % 2 ? r : R;
      pts.push([cx + d * Math.cos(a), cy + d * Math.sin(a)]);
    }
    return pts;
  }

  // ---- tanks: four hull designs, used by enemy types and by the player's star levels ----
  function tankGrid(design, frame) {
    const g = blank(16, 16);
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = c; };
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
          const corner = (x === x0 || x === x1) && (y === y0 || y === y1);
          if (round && corner) continue;
          px(x, y, x === x1 || y === y1 ? 2 : 3);
        }
      }
    };
    const barrel = (x, y0, y1) => {
      for (let y = y0; y <= y1; y++) { px(x, y, 3); px(x + 1, y, 2); }
      px(x, y0, 2); px(x + 1, y0, 1);
    };
    if (design === 'A') {
      tread(1, 3, 2, 15, true); tread(12, 3, 2, 15, false);
      hull(4, 4, 11, 13);
      turret(5, 6, 10, 11, true);
      px(6, 7, 4);
      barrel(7, 0, 6);
    } else if (design === 'B') {
      tread(2, 2, 2, 15, true); tread(12, 2, 2, 15, false);
      hull(4, 5, 11, 14);
      rect(5, 3, 6, 2, 2);
      for (let x = 5; x <= 10; x++) px(x, 3, 3);
      px(5, 4, 3); px(10, 4, 1);
      turret(6, 7, 9, 11, true);
      px(6, 8, 4);
      barrel(7, 0, 7);
    } else if (design === 'C') {
      tread(1, 3, 3, 15, true); tread(12, 3, 3, 15, false);
      hull(4, 5, 11, 14);
      turret(4, 6, 11, 13, true);
      px(5, 7, 4); px(6, 7, 4); px(5, 8, 4);
      barrel(7, 0, 6);
      for (const y of [1, 2]) { px(6, y, 1); px(7, y, 3); px(8, y, 2); px(9, y, 1); }
    } else {
      tread(0, 4, 2, 15, true); tread(12, 4, 2, 15, false);
      hull(4, 3, 11, 15);
      for (let x = 5; x <= 10; x++) { px(x, 5, 1); px(x, 14, 1); }
      turret(5, 6, 10, 12, false);
      px(5, 6, 1); px(10, 6, 1); px(5, 12, 1); px(10, 12, 1);
      px(6, 7, 4); px(7, 7, 4);
      for (let y = 0; y <= 6; y++) { px(6, y, 3); px(9, y, 2); }
      px(6, 0, 1); px(9, 0, 1);
    }
    return g;
  }

  const tankCache = new Map();
  function tank(design, pal, frame, dir) {
    const key = design + pal + frame + dir;
    let c = tankCache.get(key);
    if (!c) {
      let g = tankGrid(design, frame);
      for (let i = 0; i < dir; i++) g = rotate(g);
      c = toCanvas(g, PAL[pal]);
      tankCache.set(key, c);
    }
    return c;
  }

  // ---- terrain: colors picked from absolute pixel position so patterns line up across cells ----
  const C = {
    brick: [178, 68, 14], brickHi: [226, 116, 48], brickLo: [130, 44, 8], mortar: [86, 86, 86],
    steelLo: [74, 76, 92], steelHi: [236, 238, 246], steel: [168, 172, 186], steelTop: [250, 250, 255],
    water: [28, 60, 206], waterHi: [140, 172, 255], waterMid: [70, 104, 250],
    ice: [206, 220, 236], iceHi: [255, 255, 255], iceLo: [170, 190, 214],
    treeD: [20, 78, 18], treeM: [50, 146, 30], treeL: [136, 214, 70],
  };
  const TREE = [
    '.dMd.dM.',
    'dMLMdMLd',
    'MLLMdLMd',
    'dMMdMMdM',
    '.dMdLMd.',
    'dLMdMMLd',
    'dMLMdLMM',
    '.dMd.dM.',
  ];
  // type codes match the engine: 1 brick, 2 steel, 3 water, 4 trees, 5 ice
  function terrainPixel(type, x, y, frame) {
    if (type === 1) {
      const row = y >> 2, off = row & 1 ? 4 : 0, lx = (x + off) & 7, ly = y & 3;
      if (ly === 3 || lx === 7) return C.mortar;
      if (ly === 0) return C.brickHi;
      if (lx === 6 || ly === 2 && lx > 3) return C.brickLo;
      return C.brick;
    }
    if (type === 2) {
      const lx = x & 7, ly = y & 7;
      if (lx === 7 || ly === 7) return C.steelLo;
      if (lx === 0 || ly === 0) return C.steelHi;
      if (lx >= 2 && lx <= 5 && ly >= 2 && ly <= 5) return C.steelTop;
      return C.steel;
    }
    if (type === 3) {
      const w = (x + (y >> 2) * 3 + frame * 2) & 7, ly = y & 3;
      if (ly === 1 && w < 2) return C.waterHi;
      if (ly === 2 && w === 2) return C.waterMid;
      return C.water;
    }
    if (type === 4) {
      const ch = TREE[y & 7][x & 7];
      return ch === 'd' ? C.treeD : ch === 'M' ? C.treeM : ch === 'L' ? C.treeL : null;
    }
    if (type === 5) {
      const d = (x + y) & 7;
      if (d === 0) return C.iceHi;
      if (d === 1 || (x & 7) === 4 && (y & 7) === 2) return C.iceLo;
      return C.ice;
    }
    return null;
  }

  // ---- headquarters: a gold star on a stone plinth ----
  function baseCanvas(destroyed) {
    const g = blank(16, 16);
    const star = destroyed ? starPts(8.4, 10.2, 5.4, 2.2, 0.55) : starPts(8, 6.6, 6.4, 2.6);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (inPoly(x + 0.5, y + 0.5, star)) g[y][x] = destroyed ? (x > 8 ? '#4A4A4A' : '#707070') : (x >= 8 ? '#E89A00' : '#FFD84A');
      }
    }
    for (let y = 12; y < 16; y++) {
      for (let x = 1; x < 15; x++) {
        const mortar = y === 13 || (y < 13 ? x % 4 === 0 : (x + 2) % 4 === 0);
        let c = mortar ? '#4C4C55' : y === 12 || y === 14 ? '#B4B4BE' : '#8A8A94';
        if (destroyed && (x * 7 + y * 3) % 5 === 0) c = '#2A2A2E';
        g[y][x] = c;
      }
    }
    if (!destroyed) { g[3][6] = '#FFFFFF'; g[4][6] = '#FFF6C8'; }
    else { for (const [x, y] of [[3, 9], [12, 8], [5, 7], [13, 11], [2, 11]]) g[y][x] = '#5A5A5A'; }
    return toCanvas(outline(g, '#000000'));
  }

  // ---- power-ups ----
  function powerupCanvas(type) {
    let g = blank(16, 16);
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = c; };
    if (type === 'helmet') {
      for (let y = 4; y <= 10; y++) {
        for (let x = 1; x <= 14; x++) {
          const dx = x + 0.5 - 8, dy = y + 0.5 - 10.5;
          if (dx * dx / 42 + dy * dy / 49 <= 1) px(x, y, x >= 10 ? '#9AA4B0' : '#E4E8EE');
        }
      }
      for (let x = 1; x <= 14; x++) { px(x, 11, '#C8CED6'); px(x, 12, '#7C8490'); }
      for (let y = 4; y <= 10; y++) { px(7, y, '#E04040'); px(8, y, '#A82828'); }
      px(4, 7, '#FFFFFF'); px(4, 8, '#FFFFFF'); px(5, 6, '#FFFFFF');
    } else if (type === 'clock') {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x + 0.5 - 7.5, y + 0.5 - 8.5);
          if (d <= 6.6) px(x, y, d > 5.3 ? '#2F5FD8' : '#F6F6F6');
        }
      }
      for (let y = 4; y <= 8; y++) px(7, y, '#202020');
      for (let x = 7; x <= 10; x++) px(x, 8, '#202020');
      px(7, 8, '#D02020');
      px(5, 1, '#2F5FD8'); px(10, 1, '#2F5FD8');
    } else if (type === 'shovel') {
      for (let x = 5; x <= 10; x++) { px(x, 1, '#C88A4A'); px(x, 2, '#8A5A28'); }
      for (let y = 3; y <= 7; y++) { px(7, y, '#C88A4A'); px(8, y, '#8A5A28'); }
      for (let x = 6; x <= 9; x++) px(x, 7, '#6E7686');
      for (let y = 8; y <= 14; y++) {
        const x0 = y <= 12 ? 4 : y === 13 ? 5 : 6, x1 = 15 - x0;
        for (let x = x0; x <= x1; x++) px(x, y, y === 8 ? '#F4F6FA' : x >= 9 ? '#8E98A8' : '#D8DEE8');
      }
    } else if (type === 'star') {
      const pts = starPts(7.5, 8.3, 7, 2.9);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inPoly(x + 0.5, y + 0.5, pts)) px(x, y, x >= 8 ? '#F2A400' : '#FFE040');
      px(7, 4, '#FFFFFF'); px(7, 5, '#FFF8C0');
    } else if (type === 'grenade') {
      for (let y = 4; y <= 14; y++) {
        for (let x = 2; x <= 13; x++) {
          const dx = (x + 0.5 - 7.5) / 5, dy = (y + 0.5 - 9.5) / 5.2;
          if (dx * dx + dy * dy <= 1) px(x, y, x === 5 || x === 10 || y === 8 || y === 11 ? '#1F4A16' : '#3F7F2C');
        }
      }
      px(4, 6, '#86C866'); px(4, 7, '#86C866'); px(3, 9, '#86C866');
      for (let x = 6; x <= 9; x++) { px(x, 2, '#C8CCD2'); px(x, 3, '#9AA0A8'); }
      px(10, 2, '#9AA0A8'); px(11, 3, '#9AA0A8'); px(12, 4, '#9AA0A8'); px(12, 5, '#9AA0A8');
      px(4, 1, '#E8C040'); px(3, 2, '#E8C040'); px(5, 2, '#E8C040'); px(4, 3, '#E8C040');
    } else if (type === 'tank') {
      const t = tankGrid('A', 0);
      g = t.map((row, y) => row.map(v => (v && y > 0 ? PAL.player[v] : 0)));
      // red "+" badge so it does not look like a real tank
      for (let y = 0; y <= 6; y++) for (let x = 9; x <= 15; x++) g[y][x] = '#FFFFFF';
      for (let i = 1; i <= 5; i++) { g[3][i + 9] = '#E0281C'; g[i][12] = '#E0281C'; }
    }
    return toCanvas(outline(g, '#000000'));
  }

  // ---- effects ----
  function boom(size, radius, seed) {
    const rand = rng(seed), g = blank(size, size), c = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / radius + (rand() - 0.5) * 0.35;
        if (d > 1 || (d > 0.6 && rand() < 0.2)) continue;
        g[y][x] = d < 0.3 ? '#FFFFFF' : d < 0.55 ? '#FFE680' : d < 0.8 ? '#FF8A1E' : '#C8281A';
      }
    }
    return toCanvas(g);
  }

  function spawnFrame(k) {
    const g = blank(16, 16), L = [1, 3, 5, 7][k];
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = c; };
    for (let i = -L; i <= L + 1; i++) {
      const far = i < -L / 2 || i > L / 2 + 1;
      for (const o of [7, 8]) { px(o, 7 + i, far ? '#7FC8FF' : '#FFFFFF'); px(7 + i, o, far ? '#7FC8FF' : '#FFFFFF'); }
    }
    for (let i = 1; i <= Math.floor(L / 2); i++) {
      px(7 - i, 7 - i, '#BFE4FF'); px(8 + i, 7 - i, '#BFE4FF'); px(7 - i, 8 + i, '#BFE4FF'); px(8 + i, 8 + i, '#BFE4FF');
    }
    return toCanvas(g);
  }

  function shieldFrame(f) {
    const g = blank(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const outer = x === 0 || y === 0 || x === 15 || y === 15;
        const inner = !outer && (x === 1 || y === 1 || x === 14 || y === 14);
        if (outer && (x + y + f * 2) % 4 < 2) g[y][x] = '#FFFFFF';
        else if (inner && (x + y + f * 2 + 2) % 4 < 1) g[y][x] = '#7FDBFF';
      }
    }
    return toCanvas(g);
  }

  function flagCanvas() {
    const g = blank(16, 16);
    for (let y = 1; y <= 15; y++) g[y][3] = '#C8C8C8';
    for (let y = 2; y <= 8; y++) for (let x = 4; x <= 12 - (y === 2 || y === 8 ? 1 : 0); x++) g[y][x] = x < 8 ? '#FF5A3C' : '#D8301C';
    g[1][3] = '#FFD23F';
    return toCanvas(outline(g, '#000000'));
  }

  // 3x5 digits for score popups
  const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
  function drawNumber(ctx, n, x, y, color) {
    const s = String(n);
    ctx.fillStyle = color || '#FFFFFF';
    for (let i = 0; i < s.length; i++) {
      const bits = DIGITS[+s[i]];
      for (let b = 0; b < 15; b++) if (bits[b] === '1') ctx.fillRect(x + i * 4 + (b % 3), y + Math.floor(b / 3), 1, 1);
    }
  }

  let fx = null;
  function effects() {
    if (!fx) {
      fx = {
        boomSmall: [boom(16, 3.2, 11), boom(16, 5.5, 23), boom(16, 7.5, 37)],
        boomBig: [boom(32, 11, 51), boom(32, 15, 67)],
        spawn: [0, 1, 2, 3].map(spawnFrame),
        shield: [shieldFrame(0), shieldFrame(1)],
        base: baseCanvas(false), baseDead: baseCanvas(true),
        flag: flagCanvas(),
        powerups: {},
      };
      for (const p of ['helmet', 'clock', 'shovel', 'star', 'grenade', 'tank']) fx.powerups[p] = powerupCanvas(p);
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

  TB.sprites = { PAL, tank, terrainPixel, effects, drawNumber, iconURL, rng };
})();
