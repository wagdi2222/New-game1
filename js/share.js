// Sharing: a victory card drawn as a picture for WhatsApp, and sending the game itself to friends.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};
  const SITE = 'https://wagdi2222.github.io/New-game1/';
  const APK = 'https://github.com/wagdi2222/New-game1/releases/download/apk/tank-battle.apk';

  const load = src => new Promise(resolve => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; });
  const font = () => getComputedStyle(document.body).fontFamily;

  // data: { title, sub, stars (0-3 or null), score, extra, name, rank, rankIcon, tankIcon, medals: [icon], lines: [[text, color]] }
  async function card(data) {
    const W = 1080, H = 1080, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1E3560'); bg.addColorStop(1, '#0A1322');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // faint eight-point stars, like the menus
    g.strokeStyle = 'rgba(242,177,52,0.07)'; g.lineWidth = 3;
    for (let y = 60; y < H; y += 120) for (let x = (y / 120) % 2 ? 60 : 0; x < W + 60; x += 120) {
      g.strokeRect(x - 26, y - 26, 52, 52);
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.strokeRect(-26, -26, 52, 52); g.restore();
    }
    const tile = await load(TB.icons.url('zellige'));
    if (tile) for (let x = 0; x < W; x += 80) { g.drawImage(tile, x, 0, 80, 40); g.drawImage(tile, x, H - 40, 80, 40); }
    const logo = TB.sprites.kuficCanvas(8);
    g.imageSmoothingEnabled = false;
    const lw = 560, lh = lw * logo.height / logo.width;
    g.drawImage(logo, (W - lw) / 2, 70, lw, lh);
    g.imageSmoothingEnabled = true;
    g.textAlign = 'center'; g.direction = 'rtl';
    let y = 70 + lh + 110;
    g.fillStyle = '#F2B134'; g.font = '900 104px ' + font();
    g.fillText(data.title, W / 2, y);
    y += 70;
    g.fillStyle = '#E8DCC2'; g.font = '700 44px ' + font();
    g.fillText(data.sub || '', W / 2, y);
    if (data.stars != null) {
      const star = await load(TB.icons.url('star'));
      y += 40;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = i < data.stars ? 1 : 0.22;
        if (star) g.drawImage(star, W / 2 - 230 + i * 160, y, 140, 140);
      }
      g.globalAlpha = 1;
      y += 140;
    }
    if (data.score != null) {
      y += 100;
      g.fillStyle = '#FFF3C4'; g.font = '900 96px ' + font();
      g.fillText(data.score, W / 2, y);
      if (data.extra) { y += 56; g.fillStyle = '#9FB0CC'; g.font = '700 38px ' + font(); g.fillText(data.extra, W / 2, y); }
    }
    if (data.lines) {
      y += 30;
      g.font = '800 46px ' + font();
      for (const [text, color] of data.lines) { y += 64; g.fillStyle = color || '#E8DCC2'; g.fillText(text, W / 2, y); }
    }
    // the player: their car, name and rank
    const by = H - 250;
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.roundRect(150, by, W - 300, 130, 30); g.fill();
    const tank = data.tankIcon && await load(data.tankIcon), badge = data.rankIcon && await load(data.rankIcon);
    if (tank) g.drawImage(tank, W - 300, by + 10, 110, 110);
    if (badge) g.drawImage(badge, 190, by + 22, 86, 86);
    g.fillStyle = '#FFFFFF'; g.font = '800 46px ' + font();
    g.fillText(data.name || 'حارس', W / 2, by + 62);
    g.fillStyle = '#F2B134'; g.font = '700 34px ' + font();
    g.fillText(data.rank || '', W / 2, by + 108);
    if (data.medals && data.medals.length) {
      const icons = (await Promise.all(data.medals.slice(0, 4).map(load))).filter(Boolean);
      icons.forEach((im, i) => g.drawImage(im, W / 2 - icons.length * 40 + i * 80 + 4, by - 92, 72, 72));
    }
    g.fillStyle = '#9FB0CC'; g.font = '700 32px ' + font();
    g.fillText('حُرّاس الواحة · العبها مجاناً: wagdi2222.github.io/New-game1', W / 2, H - 66);
    return c;
  }

  const toBlob = c => new Promise(resolve => c.toBlob(resolve, 'image/png'));
  // Shares a picture: Android's share sheet inside the app, the browser's share sheet elsewhere.
  // Resolves false when this phone can't share files, so the caller can offer to save it instead.
  async function image(canvas, text) {
    if (window.TankApp && window.TankApp.shareImage) {
      window.TankApp.shareImage(canvas.toDataURL('image/png').split(',')[1], text);
      return true;
    }
    const blob = await toBlob(canvas);
    const file = blob && new File([blob], 'waha.png', { type: 'image/png' });
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return true; } catch (e) { return !!(e && e.name === 'AbortError'); }
    }
    return false;
  }

  // Sends the game itself: the share sheet when there is one, otherwise the text is copied
  async function game(onCopied, onShow) {
    const text = 'جرّب لعبة «حُرّاس الواحة» 🌴 دبابات بطابع عربي، ونقدر نلعب فيها مع بعض عبر الإنترنت:\n' + SITE +
      '\n\nولأصحاب أندرويد، هذا رابط التطبيق:\n' + APK;
    if (window.TankApp && window.TankApp.share) { window.TankApp.share(text); return; }
    if (navigator.share) {
      try { await navigator.share({ title: 'حُرّاس الواحة', text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); onCopied(); return; } catch (e) { /* fall through */ }
    onShow(text);
  }

  TB.share = { card, image, game, SITE, APK };
})();
