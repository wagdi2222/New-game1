// Connections between phones over the internet with WebRTC (PeerJS). The free PeerJS cloud
// introduces the phones to each other, then data flows directly, or through PeerJS's relay
// servers when a mobile network blocks direct links. Add ?peer=host:port to use your own PeerServer.
(function () {
  'use strict';
  const TB = window.TB = window.TB || {};
  const PREFIX = 'waha-room-';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let loading = null, peer = null;

  function loadLibrary() {
    if (window.Peer) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/peerjs.min.js';
        s.onload = () => resolve();
        s.onerror = () => { loading = null; reject(new Error('lib')); };
        document.head.append(s);
      });
    }
    return loading;
  }

  function options() {
    const custom = new URLSearchParams(location.search).get('peer') || sessionStorage.getItem('waha.peer');
    if (custom) {
      try { sessionStorage.setItem('waha.peer', custom); } catch (e) { /* storage blocked */ }
      const [host, port] = custom.split(':');
      return { host, port: +port || 9000, path: '/', secure: location.protocol === 'https:' && host !== 'localhost', debug: 1 };
    }
    return { debug: 1 };
  }

  const makeCode = (n = 5) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  const cleanCode = text => String(text || '').toUpperCase().replace(/^.*[?&]room=/i, '').replace(/[^A-Z0-9]/g, '').slice(0, 5);

  function close() {
    if (peer) { try { peer.destroy(); } catch (e) { /* already gone */ } }
    peer = null;
  }

  function wire(conn, h) {
    conn.on('data', d => { if (d && typeof d === 'object') h.onData(conn, d); });
    conn.on('close', () => h.onClose(conn));
    conn.on('error', () => h.onClose(conn));
  }

  // Open a room: resolves with its code; joiners arrive through handlers.onOpen/onData/onClose
  async function host(h) {
    await loadLibrary();
    close();
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeCode();
      const p = new window.Peer(PREFIX + code, options());
      const ok = await new Promise(resolve => {
        p.on('open', () => resolve(true));
        p.on('error', err => resolve(err && err.type === 'unavailable-id' ? false : err));
        setTimeout(() => resolve(new Error('timeout')), 15000);
      });
      if (ok === true) {
        peer = p;
        p.on('connection', conn => {
          conn.on('open', () => h.onOpen(conn));
          wire(conn, h);
        });
        p.on('disconnected', () => { if (peer === p && !p.destroyed) p.reconnect(); });
        return code;
      }
      p.destroy();
      if (ok !== false) throw ok;
    }
    throw new Error('ids');
  }

  // Join a room by code: resolves with the open connection to the host
  async function join(code, h) {
    await loadLibrary();
    close();
    // Guests name themselves too, so joining needs no extra request to the PeerJS server
    const p = new window.Peer('waha-guest-' + makeCode(12), options());
    peer = p;
    return new Promise((resolve, reject) => {
      const fail = err => { if (peer === p) close(); reject(err); };
      const timer = setTimeout(() => fail(new Error('timeout')), 30000);
      p.on('error', err => { clearTimeout(timer); fail(err); });
      p.on('open', () => {
        const conn = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        wire(conn, h);
        conn.on('open', () => { clearTimeout(timer); resolve(conn); });
      });
    });
  }

  TB.net = { host, join, close, cleanCode, loadLibrary };
})();
