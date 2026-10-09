// Vector icons for the menus and HUD, so they stay sharp on any screen. The battlefield keeps its
// pixel art; everything around it (journey, souq, medals, help, HUD chips, toasts) uses these.
// Each icon is a small SVG on a 64x64 grid, turned into a data URL once.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};
  const INK = '#1A1208';
  const O = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const svg = (body, defs, box) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box || '0 0 64 64'}">${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;
  const lin = (id, stops, x2, y2) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2 == null ? 1 : x2}" y2="${y2 == null ? 0 : y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const rad = (id, stops, cx, cy, r) => `<radialGradient id="${id}" cx="${cx || 0.5}" cy="${cy || 0.5}" r="${r || 0.6}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;

  // ---------- vehicles, seen from above and facing up ----------
  const PALS = {
    p1: ['#103B22', '#1F7A45', '#3FB36A', '#CBF7DA', '#F2B134'],
    p2: ['#0E2A4D', '#1C5DA6', '#4A9BE0', '#D6EDFF', '#F2B134'],
    p3: ['#2E1350', '#6A35B0', '#9F6BE0', '#EADCFF', '#F2B134'],
    p4: ['#5A2800', '#C25E0A', '#F08A2E', '#FFE3C6', '#FFFFFF'],
    enemy: ['#141317', '#38363F', '#6A6773', '#C9C6D2', '#D2412E'],
  };
  function treads(x, y, w, h, p) {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${p[0]}" ${O}/>`;
    for (let ty = y + 5; ty < y + h - 2; ty += 6) s += `<path d="M${x + 2.5} ${ty}H${x + w - 2.5}" stroke="${p[2]}" stroke-width="2.2" stroke-linecap="round"/>`;
    return s;
  }
  const wheel = (x, y, w, h, p) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${p[0]}" ${O}/><path d="M${x + 2.5} ${y + h / 2}H${x + w - 2.5}" stroke="${p[1]}" stroke-width="2"/>`;
  const barrel = (x, y, w, h, p) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.2" fill="${p[2]}" ${O}/><rect x="${x - 1.5}" y="${y - 0.5}" width="${w + 3}" height="6" rx="2" fill="${p[1]}" ${O}/>`;
  const hullDefs = p => lin('hull', [[0, p[2]], [1, p[1]]]) + rad('tur', [[0, p[3]], [0.35, p[2]], [1, p[1]]], 0.35, 0.3, 0.8);
  const VEHICLE = {
    A: p => treads(8, 12, 12, 46, p) + treads(44, 12, 12, 46, p) +
      `<rect x="17" y="17" width="30" height="38" rx="6" fill="url(#hull)" ${O}/><rect x="26" y="48" width="12" height="3.5" rx="1.75" fill="${p[4]}"/>` +
      barrel(28.5, 4, 7, 28, p) + `<circle cx="32" cy="35" r="11" fill="url(#tur)" ${O}/><circle cx="28.5" cy="31.5" r="2.6" fill="${p[3]}" opacity=".75"/>`,
    jeep: p => wheel(11, 11, 9, 14, p) + wheel(44, 11, 9, 14, p) + wheel(11, 40, 9, 14, p) + wheel(44, 40, 9, 14, p) +
      `<rect x="18" y="8" width="28" height="50" rx="9" fill="url(#hull)" ${O}/><rect x="21" y="11" width="22" height="11" rx="5" fill="${p[2]}"/>` +
      `<rect x="20.5" y="24" width="23" height="5" rx="2" fill="#9CC7DB" ${O}/><rect x="18" y="38" width="28" height="4" fill="${p[4]}"/>` +
      `<rect x="22" y="44" width="20" height="11" rx="3" fill="${p[0]}"/>` + barrel(30, 2, 4, 30, p) + `<circle cx="32" cy="34" r="5" fill="url(#tur)" ${O}/>`,
    scorpion: p => treads(8, 20, 11, 38, p) + treads(45, 20, 11, 38, p) +
      `<rect x="17" y="18" width="30" height="38" rx="6" fill="url(#hull)" ${O}/>` +
      `<path d="M17 21C9 19 6 11 10 4C12 9 15 10 18 9C16 13 18 16 21 18Z" fill="${p[2]}" ${O}/><path d="M47 21C55 19 58 11 54 4C52 9 49 10 46 9C48 13 46 16 43 18Z" fill="${p[2]}" ${O}/>` +
      `<circle cx="10" cy="4.5" r="2" fill="${p[4]}"/><circle cx="54" cy="4.5" r="2" fill="${p[4]}"/>` +
      [50, 43, 36, 29].map((y, i) => `<ellipse cx="32" cy="${y}" rx="${6 - i * 0.5}" ry="4" fill="${i % 2 ? p[2] : p[1]}" ${O}/>`).join('') +
      `<path d="M28.5 25C29 15 33 8 41 6C37 11 36 17 35.5 25Z" fill="${p[4]}" ${O}/>`,
    mortar: p => [8, 29, 46].map(y => wheel(8, y, 9, 11, p) + wheel(47, y, 9, 11, p)).join('') +
      `<rect x="16" y="6" width="32" height="52" rx="5" fill="url(#hull)" ${O}/><rect x="19" y="9" width="26" height="9" rx="3" fill="${p[2]}" ${O}/>` +
      `<circle cx="32" cy="38" r="12" fill="url(#tur)" ${O}/><circle cx="32" cy="38" r="7" fill="${p[0]}" ${O}/><circle cx="30" cy="36" r="2" fill="${p[2]}"/>` +
      [[21, 23], [43, 23], [21, 53], [43, 53]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="${p[4]}"/>`).join(''),
    miner: p => treads(8, 6, 11, 50, p) + treads(45, 6, 11, 50, p) +
      `<rect x="17" y="8" width="30" height="47" rx="6" fill="url(#hull)" ${O}/>` +
      `<clipPath id="hz"><rect x="21" y="37" width="22" height="15" rx="3"/></clipPath><g clip-path="url(#hz)"><rect x="21" y="37" width="22" height="15" fill="${p[0]}"/>` +
      [0, 1, 2, 3, 4].map(i => `<path d="M${15 + i * 8} 54L${27 + i * 8} 35" stroke="${p[4]}" stroke-width="3.2"/>`).join('') + `</g><rect x="21" y="37" width="22" height="15" rx="3" fill="none" ${O}/>` +
      barrel(29.5, 3, 5, 18, p) + `<circle cx="32" cy="22" r="7.5" fill="url(#tur)" ${O}/>`,
    heavy: p => treads(4, 6, 14, 54, p) + treads(46, 6, 14, 54, p) +
      `<rect x="15" y="11" width="34" height="49" rx="4" fill="url(#hull)" ${O}/><path d="M19 16H45M19 55H45" stroke="${p[0]}" stroke-width="2.4" stroke-linecap="round"/>` +
      barrel(24, 2, 5.5, 28, p) + barrel(34.5, 2, 5.5, 28, p) +
      `<rect x="20" y="25" width="24" height="25" rx="4" fill="url(#tur)" ${O}/>` +
      [[24, 29], [40, 29], [24, 46], [40, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${p[4]}"/>`).join(''),
    boss: p => treads(2, 8, 12, 54, p) + treads(50, 8, 12, 54, p) +
      `<rect x="12" y="12" width="40" height="50" rx="3" fill="url(#hull)" ${O}/>` +
      [16, 24, 32, 40].map(x => `<rect x="${x}" y="13.5" width="5" height="4" fill="${p[2]}"/>`).join('') +
      [22, 30, 38, 46, 54].map(y => `<rect x="13.5" y="${y}" width="4" height="4" fill="${p[2]}"/><rect x="46.5" y="${y}" width="4" height="4" fill="${p[2]}"/>`).join('') +
      barrel(19, 4, 5, 26, p) + barrel(29.5, 1, 5, 28, p) + barrel(40, 4, 5, 26, p) +
      `<circle cx="32" cy="40" r="14" fill="url(#tur)" ${O}/><circle cx="32" cy="40" r="7.5" fill="${p[0]}" ${O}/>` +
      `<circle cx="32" cy="40" r="4.2" fill="${p[4]}"/><circle cx="30.8" cy="38.8" r="1.4" fill="#FFB7A6"/>`,
  };
  const vehicle = (design, pal) => { const p = PALS[pal] || PALS.p1; return svg(VEHICLE[design](p), hullDefs(p)); };

  // ---------- the oasis ----------
  const ICONS = {
    well: () => svg(
      `<g ${O}><rect x="13" y="17" width="5.5" height="30" fill="url(#wd)"/><rect x="45.5" y="17" width="5.5" height="30" fill="url(#wd)"/>` +
      `<path d="M15 21H49" stroke-width="3"/><path d="M7 21L32 6L57 21Z" fill="url(#rf)"/><path d="M32 21V31" fill="none"/>` +
      `<path d="M27 31H37L35.5 38H28.5Z" fill="#9AA7B5"/><path d="M10 40V54Q32 62 54 54V40Z" fill="url(#st)"/>` +
      `<ellipse cx="32" cy="40" rx="22" ry="6" fill="#E2D2AE"/><ellipse cx="32" cy="40.6" rx="16" ry="3.6" fill="#29A8C3"/></g>` +
      `<g stroke="#8A7350" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M11 47Q32 54 53 47"/>` +
      `<path d="M21 44.8V50.6M33 46.3V52.3M45 44.8V50.6M16 50V55.5M27 52V58M39 52V58M49 50V55"/></g>` +
      `<path d="M12 20L32 9" stroke="#FFC4A8" stroke-width="1.8" stroke-linecap="round"/><path d="M24 39.5Q30 38 36 38.6" stroke="#9BE7F2" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,
      lin('st', [[0, '#EFE3C8'], [0.55, '#CDB78F'], [1, '#9C8460']]) + lin('wd', [[0, '#B47640'], [1, '#6E4322']]) + lin('rf', [[0, '#EC7A50'], [1, '#B6432A']], 0, 1)),

    skin: () => svg(
      `<path d="M38 13Q50 14 52 28" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/><path d="M38 13Q50 14 52 28" fill="none" stroke="#6E4322" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M25 18C10 24 9 50 22 56Q32 61 42 56C55 50 54 24 39 18Z" fill="url(#lt)" ${O}/>` +
      `<rect x="26.5" y="8" width="11" height="11" rx="3" fill="#8B5A2B" ${O}/><path d="M25.5 15.5H38.5" stroke="#E0B040" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M32 23V54" stroke="#5E3A1A" stroke-width="1.6" stroke-dasharray="3 3" stroke-linecap="round"/>` +
      `<path d="M19 30Q17 42 22 50" stroke="#D9A46A" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8"/>` +
      `<path d="M47 33C47 33 42 39 42 42A5 5 0 0 0 52 42C52 39 47 33 47 33Z" fill="#5BC8F5" ${O}/><circle cx="45.5" cy="42" r="1.3" fill="#E6F8FF"/>`,
      rad('lt', [[0, '#C68A50'], [0.6, '#9C6431'], [1, '#6E4322']], 0.38, 0.4, 0.7)),

    tower: () => svg(
      `<path d="M44 16V3" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M44.5 4L57 7.5L44.5 11.5Z" fill="#D2412E" ${O}/>` +
      `<path d="M18 59L21.5 22H42.5L46 59Z" fill="url(#ts)" ${O}/><path d="M17 23V12H23.5V16H29V12H35V16H40.5V12H47V23Z" fill="#B8A487" ${O}/>` +
      `<g stroke="#7D6A50" stroke-width="1.5" stroke-linecap="round"><path d="M21 33H43M20 44H44M27 23V33M37 33V44M29 44V52"/></g>` +
      `<path d="M27 59V49Q32 43 37 49V59Z" fill="${INK}"/><rect x="30.3" y="27" width="3.4" height="9" rx="1.7" fill="${INK}"/>` +
      `<path d="M23 26L22 40" stroke="#E7D8BC" stroke-width="2" stroke-linecap="round" opacity=".8"/>`,
      lin('ts', [[0, '#D6C3A2'], [1, '#8E7B5E']])),

    camel: () => svg(
      `<g ${O}><path d="M15 38V57M21 39V57M41 39V57M47 37V57" stroke-width="7"/></g>` +
      `<g stroke="#B0823F" stroke-width="3.4" stroke-linecap="round"><path d="M15 38V57M21 39V57M41 39V57M47 37V57"/></g>` +
      `<path d="M11 32C9 37 7 39 6 43" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      `<path d="M10 33Q9 26 15 24Q20 13 29 13Q38 13 41 24L45 27Q46 18 48.5 12.5Q51 8.5 56 9.5L60 11.5Q62 14 60.5 17L56.5 18Q54.5 19.5 53.5 22L51 34Q49.5 40 44 41H17Q11 40 10 33Z" fill="url(#cm)" ${O}/>` +
      `<path d="M20 23Q29 11 38 23L36.5 31H21.5Z" fill="#C8281A" ${O}/><path d="M21.5 27H36.8" stroke="#F2B134" stroke-width="2.4"/>` +
      `<path d="M22 31L21 35M27 31V35.5M32 31V35.5M36.5 31L37.5 35" stroke="#F2B134" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="55.3" cy="13.6" r="1.6" fill="${INK}"/><path d="M14 28Q16 22 19 20" stroke="#F3D7A2" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      lin('cm', [[0, '#E2B776'], [1, '#B0823F']], 0, 1)),

    lantern: () => svg(
      `<g ${O}><circle cx="32" cy="6.5" r="3.4" fill="none"/><path d="M22 19Q32 7 42 19Z" fill="url(#br)"/><rect x="19.5" y="18.5" width="25" height="4.5" rx="1.5" fill="url(#br)"/>` +
      `<path d="M20.5 23H43.5L47 44H17Z" fill="url(#gl)"/><rect x="15.5" y="43.5" width="33" height="4.5" rx="1.5" fill="url(#br)"/>` +
      `<path d="M20 48H44L36.5 56H27.5Z" fill="url(#br)"/><path d="M32 56V60" /></g>` +
      `<g stroke="#7A5310" stroke-width="2" stroke-linecap="round"><path d="M26.5 23.5L25 43.5M32 23.5V43.5M37.5 23.5L39 43.5"/></g>` +
      `<path d="M29 30L32 27L35 30L32 33Z" fill="#FFF7D6" opacity=".9"/><path d="M21 27L19.5 40" stroke="#FFF7D6" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`,
      rad('gl', [[0, '#FFF6C2'], [0.5, '#FFD15C'], [1, '#E08A1A']], 0.5, 0.45, 0.7) +
      lin('br', [[0, '#F7D774'], [0.5, '#D4A33A'], [1, '#8E6516']])),

    falcon: () => svg(
      `<g ${O}><path d="M30 30Q18 17 3 19Q7 23 5 26Q11 27 9.5 30.5Q15.5 30.5 14.5 34Q22 34 29.5 41Z" fill="url(#wg)"/>` +
      `<path d="M34 30Q46 17 61 19Q57 23 59 26Q53 27 54.5 30.5Q48.5 30.5 49.5 34Q42 34 34.5 41Z" fill="url(#wg2)"/>` +
      `<path d="M27.5 50L25.5 60Q32 63 38.5 60L36.5 50Z" fill="#7A5634"/>` +
      `<path d="M32 18Q41 22 38.5 41Q36.5 50 32 54Q27.5 50 25.5 41Q23 22 32 18Z" fill="#8E6640"/>` +
      `<path d="M32 25Q37 29 35.6 41Q34.4 47 32 50Q29.6 47 28.4 41Q27 29 32 25Z" fill="#EADBBF"/>` +
      `<circle cx="32" cy="16" r="7.5" fill="#6B4A2E"/></g>` +
      `<path d="M28 59.5L36 59.5M27 55.5H37" stroke="#4F3520" stroke-width="1.6"/>` +
      `<path d="M30 35.5h.1M34 35.5h.1M32 40h.1M30.5 44h.1M33.5 44h.1" stroke="#8E6640" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M27 18Q32 22.5 37 18Q36 22.5 32 23.5Q28 22.5 27 18Z" fill="#EADBBF"/>` +
      `<circle cx="29" cy="15" r="2.1" fill="#F2B134"/><circle cx="35" cy="15" r="2.1" fill="#F2B134"/><circle cx="29.3" cy="15" r="1" fill="${INK}"/><circle cx="34.7" cy="15" r="1" fill="${INK}"/>` +
      `<path d="M30.3 18.5Q32 25 33.7 18.5Z" fill="#F2B134" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<path d="M8 22Q18 21 27 29M56 22Q46 21 37 29" stroke="#C49A6C" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      lin('wg', [[0, '#5A3D24'], [1, '#9C7248']]) + lin('wg2', [[0, '#9C7248'], [1, '#5A3D24']])),

    dhow: () => svg(
      `<path d="M2 50Q10 46 18 50T34 50T50 50T66 50V64H2Z" fill="url(#sea)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<g ${O}><path d="M32 45V9" stroke-width="3"/><path d="M32 9.5L41 12.5L32 15Z" fill="#D2412E"/>` +
      `<path d="M12 11Q38 16 54 33L31 41Q24 26 12 11Z" fill="url(#sail)"/><path d="M11 10L55 34" stroke-width="2.8" fill="none"/>` +
      `<path d="M7 41H57L51 51Q32 56 13 51Z" fill="url(#wood)"/></g>` +
      `<path d="M11 45.5H53" stroke="#5A3418" stroke-width="1.5"/><path d="M19 19Q26 26 29 36" stroke="#FFFFFF" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M8 57Q14 55 20 57M38 58Q44 56 50 58" stroke="#9BDDF0" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
      lin('sea', [[0, '#2EA2C9'], [1, '#14607E']], 0, 1) + lin('sail', [[0, '#FFF6E0'], [1, '#E2CFA6']]) + lin('wood', [[0, '#B47640'], [1, '#6E4322']], 0, 1)),

    star: () => {
      let d = '';
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11.5 : 27; d += (i ? 'L' : 'M') + (32 + Math.cos(a) * r).toFixed(1) + ' ' + (34 + Math.sin(a) * r).toFixed(1); }
      return svg(`<path d="${d}Z" fill="url(#gs)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M32 13L28 25" stroke="#FFF3C4" stroke-width="2.4" stroke-linecap="round"/>`,
        lin('gs', [[0, '#FFE08A'], [0.5, '#F2B134'], [1, '#C98512']], 0.4, 1));
    },

    // the scorpion gang's mark
    foe: () => svg(
      `<g stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M25 30L16 27L12 31M25 35L15 35L12 40M26 40L17 44L15 49M39 30L48 27L52 31M39 35L49 35L52 40M38 40L47 44L49 49"/>` +
      `<path d="M27 25L19 17M37 25L45 17" stroke-width="4.5"/></g>` +
      `<g ${O}><path d="M19 19C9 19 7 7 13 3C13 9 16 11 20 11C18 7 20 4 23 3C27 9 25 18 19 19Z" fill="url(#sc)"/>` +
      `<path d="M45 19C55 19 57 7 51 3C51 9 48 11 44 11C46 7 44 4 41 3C37 9 39 18 45 19Z" fill="url(#sc)"/>` +
      `<circle cx="38" cy="54" r="3.6" fill="#38363F"/><circle cx="44.5" cy="55" r="3.4" fill="#38363F"/><circle cx="50" cy="51.5" r="3.2" fill="#38363F"/><circle cx="52.5" cy="45.5" r="3" fill="#38363F"/>` +
      `<path d="M52 42.5Q53 34 47 33Q50 37 49.5 42Z" fill="#D2412E"/>` +
      `<ellipse cx="32" cy="35" rx="8.5" ry="13" fill="url(#sc)"/><ellipse cx="32" cy="24" rx="7" ry="5" fill="#4A4752"/><circle cx="34" cy="50" r="3.8" fill="#38363F"/></g>` +
      `<path d="M26 32H38M25.5 37H38.5M26.5 42H37.5" stroke="#1C1B20" stroke-width="1.6" stroke-linecap="round"/><circle cx="29.5" cy="23" r="1.3" fill="#D2412E"/><circle cx="34.5" cy="23" r="1.3" fill="#D2412E"/>`,
      lin('sc', [[0, '#5C5966'], [1, '#26242B']])),

    boss: () => vehicle('boss', 'enemy'),

    // ---------- power-ups ----------
    shield: () => svg(
      `<circle cx="32" cy="32" r="26" fill="url(#gold)" ${O}/><circle cx="32" cy="32" r="20.5" fill="url(#steel)" stroke="#7A5A14" stroke-width="1.6"/>` +
      Array.from({ length: 8 }, (_, i) => `<ellipse cx="32" cy="19" rx="2.6" ry="5" fill="#5E6E7E" transform="rotate(${i * 45} 32 32)"/>`).join('') +
      `<circle cx="32" cy="32" r="6.5" fill="url(#gold)" ${O}/><circle cx="30" cy="30" r="1.8" fill="#FFF6D0"/>` +
      [0, 90, 180, 270].map(a => `<circle cx="32" cy="8.6" r="1.8" fill="#FFF0B8" transform="rotate(${a + 45} 32 32)"/>`).join('') +
      `<path d="M17 24Q20 16 28 13" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/>`,
      rad('steel', [[0, '#F2F5F8'], [0.6, '#BAC6D2'], [1, '#7E8D9C']], 0.38, 0.35, 0.75) + lin('gold', [[0, '#FFE08A'], [0.5, '#E2AE3C'], [1, '#A8761A']], 0.3, 1)),

    whirl: () => svg(
      `<path d="M9 12Q32 1 55 12Q47 22 43 31Q39 41 36.5 49Q34 57 29.5 61Q31 53 30 47Q23.5 39 21.5 31Q16 21 9 12Z" fill="url(#sand)" ${O}/>` +
      `<g stroke="#FFF1CF" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M14 14Q32 20 50 13"/><path d="M19 23Q33 28 45 22"/><path d="M23 32Q33 36 41 31"/><path d="M27 41Q33 44 38 40"/><path d="M29.5 50Q33 52 35.5 49"/></g>` +
      `<g fill="#C9A266"><circle cx="8" cy="30" r="2"/><circle cx="56" cy="26" r="2.2"/><circle cx="52" cy="40" r="1.6"/><circle cx="13" cy="42" r="1.6"/></g>`,
      lin('sand', [[0, '#F2DBA8'], [0.5, '#D6AE6A'], [1, '#9C7442']])),

    mason: () => svg(
      `<g ${O}>${[[6, 38, 16], [24, 38, 16], [42, 38, 16], [6, 48.5, 7], [15, 48.5, 16], [33, 48.5, 16], [51, 48.5, 7]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="9" rx="1.5" fill="url(#brick)"/>`).join('')}</g>` +
      `<g ${O}><path d="M29 31L40 20" stroke-width="7"/></g><path d="M29 31L40 20" stroke="#A86B3C" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M38 22L44 6L58 16Z" fill="url(#steel)" ${O}/><path d="M44 10L54 16" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`,
      lin('brick', [[0, '#E9DFCC'], [1, '#B4AA98']], 0, 1) + lin('steel', [[0, '#F2F5F8'], [1, '#8E9CAB']], 0, 1)),

    hammer: () => svg(
      `<g transform="rotate(-35 32 32)"><rect x="29" y="22" width="6" height="38" rx="2.5" fill="url(#hw)" ${O}/>` +
      `<path d="M15 10H46Q50 10 50 14V21Q50 25 46 25H15Q12 25 12 22V13Q12 10 15 10Z" fill="url(#head)" ${O}/><path d="M15 14H45" stroke="#F4F7FA" stroke-width="2" stroke-linecap="round"/></g>` +
      `<g fill="#F2B134" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"><path d="M53 6L55 11L60 12L55 14L53 19L51 14L46 12L51 11Z"/><path d="M9 42L10.4 45L13.5 45.6L10.4 46.8L9 50L7.6 46.8L4.5 45.6L7.6 45Z"/></g>` +
      `<g stroke="#F2B134" stroke-width="2" stroke-linecap="round"><path d="M58 26L62 28M56 31L59 35"/></g>`,
      lin('head', [[0, '#C6CDD6'], [1, '#4A525C']], 0, 1) + lin('hw', [[0, '#C0844E'], [1, '#7A4A24']])),

    dates: () => svg(
      `<g stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M32 4Q31 10 28 14M32 4Q36 10 40 13M30 9Q22 12 16 18M34 9Q42 12 48 17"/></g>` +
      `<g stroke="#E0A030" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M32 4Q31 10 28 14M32 4Q36 10 40 13M30 9Q22 12 16 18M34 9Q42 12 48 17"/></g>` +
      `<g ${O}>${[[16, 25], [28, 22], [40, 21], [50, 26], [22, 37], [34, 35], [46, 38], [28, 49], [40, 50]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="8.5" fill="url(#date)" transform="rotate(${(i % 3 - 1) * 12} ${x} ${y})"/>`).join('')}</g>` +
      [[16, 25], [28, 22], [40, 21], [50, 26], [22, 37], [34, 35], [46, 38], [28, 49], [40, 50]].map(([x, y]) => `<path d="M${x - 2.5} ${y - 4}Q${x - 3} ${y} ${x - 2} ${y + 2}" stroke="#E39A57" stroke-width="1.8" fill="none" stroke-linecap="round"/>`).join(''),
      rad('date', [[0, '#B5642A'], [1, '#5E2A0C']], 0.4, 0.35, 0.8)),

    coffee: () => svg(
      `<path d="M38 24Q51 23 49 36Q48 44 44 47" stroke="${INK}" stroke-width="6.4" fill="none" stroke-linecap="round"/><path d="M38 24Q51 23 49 36Q48 44 44 47" stroke="#C99A2E" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      `<g ${O}><path d="M25.5 33Q16 30 11 20Q8 15 4 13Q10 12 14 16Q19 22 27 28Z" fill="url(#bz)"/>` +
      `<path d="M26 31Q23 25 27 20H37Q41 25 38 31Q47 41 47 52Q47 58 41 58H23Q17 58 17 52Q17 41 26 31Z" fill="url(#bz)"/>` +
      `<rect x="24.5" y="28.5" width="15" height="4" rx="1.5" fill="#B88A22"/><path d="M27 20Q27 11 32 9Q37 11 37 20Z" fill="url(#bz)"/>` +
      `<rect x="19" y="54.5" width="26" height="5" rx="2" fill="#B88A22"/></g><path d="M32 9V4" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="4" r="2.4" fill="#F2CF5A" stroke="${INK}" stroke-width="1.6"/>` +
      `<path d="M22 46Q32 41 42 46" stroke="#8E6A12" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M23 50Q32 45.5 41 50" stroke="#8E6A12" stroke-width="1.2" fill="none" stroke-dasharray="1.5 2.5" stroke-linecap="round"/>` +
      `<path d="M23 38Q20 44 21 51" stroke="#FFF2B8" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      lin('bz', [[0, '#FBE59A'], [0.45, '#E2B848'], [1, '#9C7A20']])),
  };
  ICONS.qirba = ICONS.skin;

  // ---------- regions: small round windows onto each landscape ----------
  const vignette = (sky, body) => svg(
    `<clipPath id="c"><circle cx="32" cy="32" r="27"/></clipPath><g clip-path="url(#c)"><rect width="64" height="64" fill="url(#sky)"/>${body}</g><circle cx="32" cy="32" r="27" fill="none" stroke="${INK}" stroke-width="2.6"/>`,
    lin('sky', sky, 0, 1));
  const palm = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0Q2 -12 -1 -24" stroke="${INK}" stroke-width="5.4" fill="none" stroke-linecap="round"/><path d="M0 0Q2 -12 -1 -24" stroke="#8E6A3A" stroke-width="2.8" fill="none" stroke-linecap="round"/>` +
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" fill="#3FA65A"><path d="M-1 -24Q-12 -30 -20 -20Q-10 -25 -1 -22Z"/><path d="M-1 -24Q10 -31 19 -21Q9 -25 -1 -22Z"/><path d="M-1 -24Q-8 -34 -16 -33Q-6 -30 -1 -23Z" fill="#57C072"/><path d="M-1 -24Q7 -35 15 -33Q5 -30 -1 -23Z" fill="#57C072"/><path d="M-1 -24Q-2 -34 2 -38Q2 -30 0 -23Z" fill="#57C072"/></g></g>`;
  const REGIONS = {
    desert: () => vignette([[0, '#7EC3E6'], [1, '#FCE3B0']],
      `<circle cx="45" cy="19" r="7" fill="#FFD25A" stroke="${INK}" stroke-width="2"/><path d="M0 42Q16 28 34 38T70 36V70H0Z" fill="#E7BC6E" stroke="${INK}" stroke-width="2.2"/>` +
      `<path d="M-4 52Q18 40 40 50T72 48V70H-4Z" fill="#C9944A" stroke="${INK}" stroke-width="2.2"/><path d="M14 35Q22 31 30 36" stroke="#F6DDA4" stroke-width="2" fill="none" stroke-linecap="round"/>`),
    oasis: () => vignette([[0, '#86CDE9'], [1, '#E8F4D8']],
      `<path d="M0 46Q32 38 64 46V70H0Z" fill="#E2BC78" stroke="${INK}" stroke-width="2.2"/><ellipse cx="34" cy="51" rx="18" ry="5.5" fill="#2DB0C8" stroke="${INK}" stroke-width="2.2"/>` +
      `<path d="M24 50Q32 48 40 49.5" stroke="#B7F0F7" stroke-width="1.6" fill="none" stroke-linecap="round"/>` + palm(22, 46, 0.95) + palm(43, 45, 0.75)),
    mountains: () => vignette([[0, '#8FB7E0'], [1, '#F1E2C8']],
      `<path d="M-4 52L18 22L30 38L42 18L70 52V70H-4Z" fill="#9C7B5E" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="M18 22L23 29L20 31L16 28ZM42 18L48 26L44 28L40 24Z" fill="#E8D7C0"/><path d="M-4 56Q32 46 70 56V70H-4Z" fill="#7A5C43" stroke="${INK}" stroke-width="2.2"/>` +
      `<path d="M30 38L34 44M42 18L38 30" stroke="#6E5038" stroke-width="1.8" stroke-linecap="round"/>`),
    coast: () => vignette([[0, '#7FC6EA'], [1, '#FCE7C0']],
      `<circle cx="20" cy="22" r="6" fill="#FFD25A" stroke="${INK}" stroke-width="2"/><path d="M-4 44Q8 40 20 44T44 44T68 44V70H-4Z" fill="#2E9CC4" stroke="${INK}" stroke-width="2.2"/>` +
      `<g stroke="${INK}" stroke-width="2" stroke-linejoin="round"><path d="M41 40V18" stroke-width="2.4"/><path d="M30 17Q45 20 53 33L41 37Q37 27 30 17Z" fill="#FFF6E0"/><path d="M29 39H55L52 45Q42 48 32 45Z" fill="#9C6431"/></g>` +
      `<path d="M8 53Q14 51 20 53M36 56Q42 54 48 56" stroke="#B7E9F7" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
    oldcity: () => vignette([[0, '#3E3A78'], [1, '#E8996A']],
      `<circle cx="47" cy="17" r="4.5" fill="#FFF0C0"/><g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">` +
      `<path d="M6 60V34H14V30H20V34H24V60Z" fill="#C99A62"/><path d="M38 60V24H44V20H48V24H50V60Z" fill="#B3854F"/>` +
      `<path d="M20 60V40H46V60Z" fill="#D9AE74"/><path d="M28 60V51Q33 45 38 51V60Z" fill="#3A2412"/></g>` +
      `<path d="M41 28H47M41 33H47" stroke="${INK}" stroke-width="1.8"/><rect x="11" y="40" width="5" height="6" rx="2.5" fill="#FFC85A" stroke="${INK}" stroke-width="1.6"/>` +
      `<rect x="24" y="44" width="4" height="5" rx="2" fill="#FFC85A" stroke="${INK}" stroke-width="1.6"/><path d="M33 40V37" stroke="${INK}" stroke-width="1.6"/><circle cx="33" cy="35.5" r="2.2" fill="#FFD25A" stroke="${INK}" stroke-width="1.4"/>`),
  };

  // ---------- terrain tiles for the help page and the map editor ----------
  const tile = (body, defs) => svg(`<clipPath id="t"><rect x="3" y="3" width="58" height="58" rx="9"/></clipPath><g clip-path="url(#t)">${body}</g><rect x="3" y="3" width="58" height="58" rx="9" fill="none" stroke="${INK}" stroke-width="2.6"/>`, defs);
  const TERRAIN = {
    1: () => tile(`<rect width="64" height="64" fill="#6B4426"/>` + [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3].map(c => `<rect x="${c * 20 - (r % 2 ? 10 : 0) + 1.5}" y="${r * 13 + 1.5}" width="17" height="10" rx="2" fill="${(r + c) % 3 ? '#B9794A' : '#A86A3C'}"/><path d="M${c * 20 - (r % 2 ? 10 : 0) + 3.5} ${r * 13 + 4}H${c * 20 - (r % 2 ? 10 : 0) + 15}" stroke="#D69A68" stroke-width="1.6" stroke-linecap="round"/>`).join('')).join('')),
    2: () => tile(`<rect width="64" height="64" fill="#5D564B"/>` + [[2, 2, 28, 28], [32, 2, 30, 18], [32, 22, 30, 18], [2, 32, 18, 30], [22, 32, 22, 30], [46, 42, 16, 20]].map(([x, y, w, h]) =>
      `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="3" fill="url(#stn)"/><path d="M${x + 3.5} ${y + h - 4}V${y + 3.5}H${x + w - 4}" stroke="#F0EADD" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>`).join(''),
    lin('stn', [[0, '#D8D0C0'], [1, '#9E9584']], 0.3, 1)),
    3: () => tile(`<rect width="64" height="64" fill="url(#wt)"/>` + [12, 26, 40, 54].map((y, i) => `<path d="M${i % 2 ? -4 : 4} ${y}q6 -4 12 0t12 0t12 0t12 0" stroke="#9BE7F2" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".85"/>`).join(''),
      lin('wt', [[0, '#3BC0D8'], [1, '#14708A']], 0, 1)),
    4: () => tile(`<rect width="64" height="64" fill="#E2C48C"/>` + `<g transform="translate(32 33)">` + Array.from({ length: 7 }, (_, i) =>
      `<path d="M0 0Q6 -10 0 -24Q-6 -10 0 0Z" fill="${i % 2 ? '#3FA65A' : '#2E8A48'}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" transform="rotate(${i * 51.4})"/>`).join('') +
      `<circle r="4" fill="#8E6A3A" stroke="${INK}" stroke-width="1.6"/></g>`),
    5: () => tile(`<rect width="64" height="64" fill="#E8C98E"/>` + [8, 20, 32, 44, 56].map(y => `<path d="M-2 ${y}Q8 ${y - 6} 16 ${y}T32 ${y}T48 ${y}T64 ${y}" stroke="#C99A55" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M-2 ${y - 2.5}Q8 ${y - 8.5} 16 ${y - 2.5}T32 ${y - 2.5}T48 ${y - 2.5}T64 ${y - 2.5}" stroke="#F6E2B4" stroke-width="1.4" fill="none" stroke-linecap="round"/>`).join('')),
    6: () => {
      let d = 'M32 33';
      for (let t = 0.3; t < 19; t += 0.3) { const r = 1 + t * 1.45, a = t * 0.95; d += 'L' + (32 + Math.cos(a) * r).toFixed(1) + ' ' + (33 + Math.sin(a) * r * 0.85).toFixed(1); }
      return tile(`<rect width="64" height="64" fill="#D8B06E"/><circle cx="32" cy="33" r="24" fill="#C49452"/><path d="${d}" stroke="#8E6A3A" stroke-width="2.8" fill="none" stroke-linecap="round"/><circle cx="32" cy="33" r="3" fill="#6E4F28"/>`);
    },
  };

  // ---------- the commander ----------
  const commander = () => svg(
    `<rect width="64" height="64" fill="url(#bg)"/>` +
    `<g ${O}><path d="M4 66Q7 49 22 45H42Q57 49 60 66Z" fill="url(#thobe)"/><path d="M26 41H38V48Q32 52 26 48Z" fill="#B97B4E"/>` +
    `<path d="M17 25Q17 9 32 9Q47 9 47 25L50 49Q44 52 41 44L41.5 30Q32 23 22.5 30L23 44Q20 52 14 49Z" fill="url(#chk)"/>` +
    `<ellipse cx="32" cy="31" rx="10" ry="11.5" fill="url(#skin)"/></g>` +
    `<path d="M22.5 30Q32 23 41.5 30" stroke="${INK}" stroke-width="2.4" fill="none"/>` +
    `<path d="M23.5 33Q24 45 32 46Q40 45 40.5 33Q37.5 39 32 39Q26.5 39 23.5 33Z" fill="#2A1E14"/><path d="M27 36Q32 33 37 36Q32 37.6 27 36Z" fill="#2A1E14"/>` +
    `<path d="M26.5 27.5Q28.5 26.3 30.5 27.5M33.5 27.5Q35.5 26.3 37.5 27.5" stroke="#2A1E14" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<circle cx="28.6" cy="30" r="1.4" fill="${INK}"/><circle cx="35.4" cy="30" r="1.4" fill="${INK}"/><path d="M32 30.5V34L30.6 34.6" stroke="#8C5530" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
    `<path d="M17.5 17Q32 9 46.5 17" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M18 21.5Q32 14 46 21.5" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M29 46V60M35 46V60" stroke="#D8D2C4" stroke-width="1.4"/><circle cx="32" cy="50" r="1.2" fill="#C9A24A"/>`,
    lin('bg', [[0, '#1E7E86'], [1, '#0F4C55']], 0, 1) + lin('thobe', [[0, '#FFFFFF'], [1, '#D9D3C6']]) + rad('skin', [[0, '#D9A070'], [1, '#B07448']], 0.45, 0.4, 0.7) +
    `<pattern id="chk" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#FBF8F2"/><rect width="2.5" height="2.5" fill="#C8281A"/><rect x="2.5" y="2.5" width="2.5" height="2.5" fill="#E04A3A" opacity=".5"/></pattern>`);

  // ---------- zellige border strip for cards ----------
  const zellige = () => svg(
    `<rect width="20" height="10" fill="#0F5E63"/><path d="M0 .6H20M0 9.4H20" stroke="#F2B134" stroke-width="1.2"/>` +
    `<g transform="translate(10 5)"><rect x="-3" y="-3" width="6" height="6" fill="#F2B134"/><rect x="-3" y="-3" width="6" height="6" fill="#F2B134" transform="rotate(45)"/><circle r="1.5" fill="#0F5E63"/></g>` +
    `<path d="M0 5L1.6 3.4L3.2 5L1.6 6.6ZM16.8 5L18.4 3.4L20 5L18.4 6.6Z" fill="#35C2B6"/>`, '', '0 0 20 10');

  // ---------- engine upgrade: a tank speeding up ----------
  const engine = () => svg(`<g transform="translate(66 6) rotate(90) scale(.82)">${VEHICLE.A(PALS.p1)}</g>` +
    `<g stroke="#F2B134" stroke-width="3.2" stroke-linecap="round"><path d="M3 24H13M1 32H11M3 40H13"/></g>`, hullDefs(PALS.p1));

  const urls = new Map();
  const toURL = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  function url(name) {
    if (!urls.has(name)) {
      let s;
      if (ICONS[name]) s = ICONS[name]();
      else if (name.startsWith('region:')) s = REGIONS[name.slice(7)]();
      else if (name.startsWith('terrain:')) s = TERRAIN[name.slice(8)]();
      else if (name.startsWith('vehicle:')) { const [, design, pal] = name.split(':'); s = vehicle(design, pal); }
      else if (name === 'commander') s = commander();
      else if (name === 'zellige') s = zellige();
      else if (name === 'engine') s = engine();
      else throw new Error('no icon ' + name);
      urls.set(name, toURL(s));
    }
    return urls.get(name);
  }
  // Raw SVG markup, for building the app icon
  const markup = { vehicle, falcon: ICONS.falcon, star: ICONS.star };

  TB.icons = { url, markup, PALS };
})();
