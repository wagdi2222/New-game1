// Progress outside the battles: military ranks earned with experience, the daily gift with its
// streak, and a code that carries a player's progress to another phone.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};

  // ---------- ranks ----------
  const RANKS = [
    [0, 'جندي'], [400, 'جندي أول'], [1000, 'عريف'], [2000, 'رقيب'], [3500, 'رقيب أول'], [5500, 'ملازم'], [8000, 'ملازم أول'],
    [11000, 'نقيب'], [15000, 'رائد'], [20000, 'مقدّم'], [26000, 'عقيد'], [33000, 'عميد'], [42000, 'لواء'], [55000, 'قائد الواحة'],
  ];
  function rankOf(xp) {
    let i = 0;
    while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
    const from = RANKS[i][0], to = i + 1 < RANKS.length ? RANKS[i + 1][0] : null;
    return { index: i, name: RANKS[i][1], from, to, progress: to ? (xp - from) / (to - from) : 1 };
  }
  // Experience from one battle: winning counts most, then stars, then the score
  function xpFor(r) {
    if (!r) return 0;
    if (r.duel) return 60 + (r.myKills || 0) * 25 + (r.iWon ? 160 : 0);
    if (r.tutorial) return 150;
    return r.won ? 100 + r.stars * 50 + Math.floor(r.score / 20) : 20 + Math.floor(r.score / 40);
  }

  // ---------- the daily gift ----------
  const GIFTS = [50, 75, 100, 125, 150, 200, 250];
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // What today's gift is, or null when it was already taken today
  function giftDue(save, now) {
    const g = save.gift || {}, today = dayKey(now || new Date());
    if (g.last === today) return null;
    const y = new Date(now || Date.now()); y.setDate(y.getDate() - 1);
    const streak = g.last === dayKey(y) ? (g.streak || 0) + 1 : 1;
    const day = (streak - 1) % 7;
    return { today, streak, day, coins: GIFTS[day], falcon: day === 6 };
  }
  function takeGift(save, due) {
    save.gift = { last: due.today, streak: due.streak };
    save.dirhams += due.coins;
    if (due.falcon) { if (save.falcons < 3) save.falcons++; else save.dirhams += 150; }
  }

  // ---------- carrying progress to another phone ----------
  const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = text => { const s = atob(text.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  const sum = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(0, 5); };
  async function pipe(bytes, Stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw')));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function exportCode(save) {
    const raw = new TextEncoder().encode(JSON.stringify(save));
    let body, kind = '0';
    if (window.CompressionStream) {
      try { body = b64(await pipe(raw, window.CompressionStream)); kind = '1'; } catch (e) { body = null; }
    }
    if (!body) body = b64(raw);
    return 'WAHA' + kind + '.' + body + '.' + sum(body);
  }
  // Resolves with the saved progress, or null when the code is damaged
  async function importCode(text) {
    const m = String(text || '').replace(/\s+/g, '').match(/WAHA([01])\.([A-Za-z0-9_-]+)\.([a-z0-9]+)/);
    if (!m || sum(m[2]) !== m[3]) return null;
    try {
      let bytes = unb64(m[2]);
      if (m[1] === '1') {
        if (!window.DecompressionStream) return null;
        bytes = await pipe(bytes, window.DecompressionStream);
      }
      const data = JSON.parse(new TextDecoder().decode(bytes));
      return data && typeof data === 'object' && typeof data.dirhams === 'number' ? data : null;
    } catch (e) {
      return null;
    }
  }

  TB.progress = { RANKS, rankOf, xpFor, GIFTS, giftDue, takeGift, exportCode, importCode };
})();
