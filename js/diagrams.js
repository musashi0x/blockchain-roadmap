/* ============================================================
   diagrams.js — window.DIA

   A tiny inline-SVG drawing kit plus one or two hand-laid line
   diagrams for every lesson. No dependencies, no network, no
   build step. Strokes and fills use CSS custom properties, so
   every diagram re-themes with the page.

   DIA.get('l07')  -> [{ title, cap, svg }, ...]
   DIA.home()      -> the roadmap overview diagram
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- primitives ---------- */

  function n(v) { return Math.round(v * 10) / 10; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function cx(base, extra) { return extra ? base + ' ' + extra : base; }

  function svg(w, h, body) {
    return '<svg class="dia" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" ' +
      'xmlns="http://www.w3.org/2000/svg" role="img" focusable="false">' + body + '</svg>';
  }

  function txt(x, y, s, cls, anchor) {
    return '<text x="' + n(x) + '" y="' + n(y) + '" class="' + (cls || 'd-t') + '"' +
      (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(s) + '</text>';
  }
  function mid(x, y, s, cls) { return txt(x, y, s, cls || 'd-s', 'middle'); }

  /* arrow head as a real polygon: colour follows the same modifier class
     as the line, which markers cannot do portably. */
  function head(x, y, ang, cls) {
    var a = 0.42, r = 9;
    var p1 = n(x - r * Math.cos(ang - a)) + ',' + n(y - r * Math.sin(ang - a));
    var p2 = n(x - r * Math.cos(ang + a)) + ',' + n(y - r * Math.sin(ang + a));
    return '<polygon points="' + n(x) + ',' + n(y) + ' ' + p1 + ' ' + p2 + '" class="' + cx('d-head', cls) + '"/>';
  }

  function line(x1, y1, x2, y2, cls) {
    return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) +
      '" class="' + cx('d-line', cls) + '"/>';
  }

  /* straight arrow, optional label centred above it */
  function arr(x1, y1, x2, y2, cls, label) {
    var ang = Math.atan2(y2 - y1, x2 - x1);
    var s = line(x1, y1, x2 - Math.cos(ang) * 8, y2 - Math.sin(ang) * 8, cls) + head(x2, y2, ang, cls);
    if (label) s += mid((x1 + x2) / 2, (y1 + y2) / 2 - 9, label, 'd-m');
    return s;
  }

  /* horizontal-then-vertical-then-horizontal arrow */
  function elb(x1, y1, x2, y2, cls, label, bendAt) {
    var mx = bendAt == null ? (x1 + x2) / 2 : bendAt;
    var dir = x2 > mx ? 1 : -1;
    var d = 'M' + n(x1) + ' ' + n(y1) + ' H' + n(mx) + ' V' + n(y2) + ' H' + n(x2 - 8 * dir);
    var s = '<path d="' + d + '" class="' + cx('d-line', cls) + '"/>' + head(x2, y2, dir > 0 ? 0 : Math.PI, cls);
    if (label) s += mid(mx, y2 - 9, label, 'd-m');
    return s;
  }

  /* vertical-then-horizontal-then-vertical arrow */
  function elbV(x1, y1, x2, y2, cls, label, bendAt) {
    var my = bendAt == null ? (y1 + y2) / 2 : bendAt;
    var dir = y2 > my ? 1 : -1;
    var d = 'M' + n(x1) + ' ' + n(y1) + ' V' + n(my) + ' H' + n(x2) + ' V' + n(y2 - 8 * dir);
    var s = '<path d="' + d + '" class="' + cx('d-line', cls) + '"/>' + head(x2, y2, dir > 0 ? Math.PI / 2 : -Math.PI / 2, cls);
    if (label) s += txt(x2 + 8, my - 6, label, 'd-m');
    return s;
  }

  /* quadratic curve arrow; bend is the perpendicular offset in px */
  function cur(x1, y1, x2, y2, bend, cls, label) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    var px = -dy / len * bend, py = dx / len * bend;
    var qx = mx + px, qy = my + py;
    var ang = Math.atan2(y2 - qy, x2 - qx);
    var ex = x2 - Math.cos(ang) * 8, ey = y2 - Math.sin(ang) * 8;
    var s = '<path d="M' + n(x1) + ' ' + n(y1) + ' Q' + n(qx) + ' ' + n(qy) + ' ' + n(ex) + ' ' + n(ey) +
      '" class="' + cx('d-line', cls) + '"/>' + head(x2, y2, ang, cls);
    if (label) s += mid(mx + px * 0.62, my + py * 0.62 - 4, label, 'd-m');
    return s;
  }

  function poly(pts, cls) {
    return '<path d="M' + pts.map(function (p) { return n(p[0]) + ' ' + n(p[1]); }).join(' L') +
      '" class="' + cx('d-line', cls) + '"/>';
  }

  function box(o) {
    var s = '<rect x="' + n(o.x) + '" y="' + n(o.y) + '" width="' + n(o.w) + '" height="' + n(o.h) +
      '" rx="' + (o.rx == null ? 3 : o.rx) + '" class="' + cx('d-box', o.c) + '"/>';
    var mx = o.x + o.w / 2, my = o.y + o.h / 2;
    if (o.sub2) {
      s += mid(mx, my - 10, o.t, o.tc || 'd-t');
      s += mid(mx, my + 6, o.sub, 'd-s');
      s += mid(mx, my + 21, o.sub2, 'd-m');
    } else if (o.sub) {
      s += mid(mx, my - 2, o.t, o.tc || 'd-t');
      s += mid(mx, my + 15, o.sub, 'd-s');
    } else {
      s += mid(mx, my + 5, o.t, o.tc || 'd-t');
    }
    return s;
  }

  function dot(x, y, r, cls) {
    return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + r + '" class="' + cx('d-box', cls) + '"/>';
  }

  function diamond(x, y, w, h, t, cls) {
    var pts = [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
    return '<polygon points="' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' ') +
      '" class="' + cx('d-box', cls) + '"/>' + mid(x + w / 2, y + h / 2 + 4, t, 'd-s');
  }

  function cyl(x, y, w, h, t, cls) {
    var r = 9;
    var d = 'M' + x + ' ' + (y + r) + ' A' + (w / 2) + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) +
      ' V' + (y + h - r) + ' A' + (w / 2) + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) + ' Z';
    return '<path d="' + d + '" class="' + cx('d-box', cls) + '"/>' +
      '<path d="M' + x + ' ' + (y + r) + ' A' + (w / 2) + ' ' + r + ' 0 0 0 ' + (x + w) + ' ' + (y + r) +
      '" class="' + cx('d-line', cls) + '"/>' + mid(x + w / 2, y + h / 2 + 8, t, 'd-t');
  }

  /* left-to-right chain of equal boxes joined by arrows */
  function flow(x, y, w, h, gap, items, cls) {
    var s = '', cxp = x;
    items.forEach(function (it, i) {
      s += box({ x: cxp, y: y, w: w, h: h, t: it.t, sub: it.sub, sub2: it.sub2, c: it.c });
      if (i < items.length - 1) {
        s += arr(cxp + w, y + h / 2, cxp + w + gap, y + h / 2, it.ac || cls, it.lbl);
      }
      cxp += w + gap;
    });
    return s;
  }

  /* dashed vertical lifeline with a header box, for sequence diagrams */
  function life(x, top, bottom, label, cls) {
    return box({ x: x - 62, y: top, w: 124, h: 34, t: label, c: cls }) +
      line(x, top + 34, x, bottom, 'dash thin');
  }

  /* small caption pinned under a coordinate */
  function note(x, y, s, cls) { return txt(x, y, s, cls || 'd-k'); }

  /* ---------- registry ---------- */

  var D = {};
  function add(id, title, cap, w, h, body) {
    (D[id] = D[id] || []).push({ title: title, cap: cap, svg: svg(w, h, body) });
  }

  var W = 900;

  /* =========================================================
     MODULE 1 — foundations
     ========================================================= */

  add('l01', 'Centralised ledger vs replicated ledger',
    'Left: everyone trusts one writer, and one compromise rewrites history. Right: every node keeps a full copy and cross-checks its peers, so a single tampered copy is outvoted.',
    W, 300,
    (function () {
      var s = txt(20, 26, 'CENTRALISED', 'd-k') + txt(500, 26, 'REPLICATED', 'd-k');
      s += line(460, 40, 460, 280, 'dash thin');
      // centralised
      s += cyl(160, 120, 140, 86, 'Bank DB', 'hot');
      ['Alice', 'Bob', 'Carol', 'Dan'].forEach(function (nm, i) {
        var y = 60 + i * 54;
        s += box({ x: 20, y: y, w: 84, h: 34, t: nm, c: '' });
        s += arr(104, y + 17, 156, 128 + i * 12, '', '');
      });
      s += mid(230, 236, 'one writer, one point of failure', 'd-s');
      s += mid(230, 256, 'trust = trust in the operator', 'd-k');
      // replicated mesh
      var cxr = 690, cyr = 148, R = 92, pts = [];
      for (var i = 0; i < 5; i++) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        pts.push([cxr + Math.cos(a) * R, cyr + Math.sin(a) * R]);
      }
      for (var i = 0; i < 5; i++) {
        for (var j = i + 1; j < 5; j++) s += line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], 'thin');
      }
      pts.forEach(function (p, k) {
        s += box({ x: p[0] - 40, y: p[1] - 18, w: 80, h: 36, t: 'node ' + (k + 1), c: k === 3 ? 'bad' : 'acc' });
      });
      s += mid(690, 264, 'node 4 lies; the other four agree, so node 4 is ignored', 'd-s');
      return s;
    })());

  add('l01', 'How one payment becomes history',
    'The same six steps happen on every chain in this course. Only the consensus box changes.',
    W, 150,
    flow(24, 46, 122, 58, 24, [
      { t: 'Wallet', sub: 'intent', lbl: 'sign' },
      { t: 'Signed tx', sub: 'sig + data', lbl: 'gossip', c: 'acc' },
      { t: 'Mempool', sub: 'pending' , lbl: 'select' },
      { t: 'Block', sub: 'ordered set', lbl: 'consensus', c: 'acc' },
      { t: 'Chain', sub: 'appended', lbl: 'depth' },
      { t: 'Final', sub: 'irreversible', c: 'ok' }
    ]) + note(24, 132, 'REVERSIBILITY DROPS LEFT TO RIGHT'));

  add('l02', 'A hash function is a one-way funnel',
    'Any input length in, a fixed 256 bits out. The forward direction is cheap; the reverse direction has no better strategy than guessing.',
    W, 230,
    (function () {
      var s = box({ x: 30, y: 74, w: 190, h: 78, t: 'any input', sub: '1 byte or 1 GB', c: '' });
      s += arr(220, 113, 336, 113, 'acc', 'compress');
      s += box({ x: 336, y: 62, w: 190, h: 102, t: 'SHA-256', sub: '64 rounds, 32-bit words', c: 'acc' });
      s += arr(526, 113, 640, 113, 'acc');
      s += box({ x: 640, y: 74, w: 230, h: 78, t: '256-bit digest', sub: 'always 32 bytes', c: 'ok' });
      s += cur(755, 74, 125, 74, 62, 'bad dash', 'invert: 2^256 work');
      s += txt(400, 40, 'FORWARD: MICROSECONDS', 'd-k');
      s += txt(400, 208, 'BACKWARD: INFEASIBLE', 'd-k');
      s += mid(450, 200, '', 'd-s');
      return s;
    })());

  add('l02', 'The avalanche property',
    'Flip one bit of input and roughly half the output bits flip. There is no partial similarity to exploit, which is exactly what makes a hash usable as an identity.',
    W, 200,
    (function () {
      var s = box({ x: 40, y: 40, w: 250, h: 46, t: 'hello', c: '' });
      s += box({ x: 40, y: 122, w: 250, h: 46, t: 'hellp', c: 'hot' });
      s += arr(290, 63, 392, 63, '');
      s += arr(290, 145, 392, 145, 'hot');
      s += box({ x: 392, y: 34, w: 118, h: 58, t: 'SHA-256', c: 'acc' });
      s += box({ x: 392, y: 116, w: 118, h: 58, t: 'SHA-256', c: 'acc' });
      s += arr(510, 63, 596, 63, '');
      s += arr(510, 145, 596, 145, 'hot');
      s += box({ x: 596, y: 40, w: 268, h: 46, t: '2cf24dba5fb0a30e...', tc: 'd-m', c: 'ok' });
      s += box({ x: 596, y: 122, w: 268, h: 46, t: '70de5c6f4b74a1e2...', tc: 'd-m', c: 'bad' });
      s += mid(730, 186, 'one input bit changed  ~128 of 256 output bits changed', 'd-s');
      s += note(40, 24, 'INPUT');
      s += note(596, 24, 'DIGEST');
      return s;
    })());

  add('l03', 'From random bytes to an Ethereum address',
    'Every arrow here is one-way. You can always walk right; nothing known can walk left. That asymmetry is the whole of public-key cryptography.',
    W, 200,
    (function () {
      var s = flow(20, 62, 152, 76, 30, [
        { t: '32 random', sub: 'bytes', sub2: 'CSPRNG', lbl: 'is', c: 'hot' },
        { t: 'private key', sub: 'scalar d', sub2: '1 < d < n', lbl: 'd x G', c: 'hot' },
        { t: 'public key', sub: 'point (x, y)', sub2: '64 bytes', lbl: 'keccak256', c: 'acc' },
        { t: 'hash', sub: '32 bytes', sub2: 'take last 20', lbl: 'slice', c: 'acc' },
        { t: 'address', sub: '0x... 20 bytes', sub2: 'EIP-55 case', c: 'ok' }
      ]);
      s += cur(96, 62, 830, 48, -34, 'bad dash', 'no known reverse path');
      s += note(20, 172, 'SECP256K1 · ORDER n = 2^256 - 432420386565659656852420866394968145599');
      return s;
    })());

  add('l03', 'Signing and verifying',
    'The signer needs the private key. Anyone can verify with the public key alone — and on Ethereum the signature itself recovers the signer, which is why `ecrecover` exists.',
    W, 236,
    (function () {
      var s = txt(20, 26, 'SIGNER (HAS d)', 'd-k') + txt(520, 26, 'ANYONE (HAS NOTHING)', 'd-k');
      s += line(496, 40, 496, 216, 'dash thin');
      s += box({ x: 20, y: 48, w: 150, h: 52, t: 'message', c: '' });
      s += box({ x: 20, y: 128, w: 150, h: 52, t: 'private key d', c: 'hot' });
      s += arr(170, 74, 250, 100, '');
      s += arr(170, 154, 250, 128, 'hot');
      s += box({ x: 250, y: 84, w: 132, h: 60, t: 'ECDSA sign', sub: 'nonce k', c: 'acc' });
      s += arr(382, 114, 470, 114, 'acc', '(r, s, v)');
      s += box({ x: 520, y: 84, w: 140, h: 60, t: 'ecrecover', sub: 'msg + sig', c: 'acc' });
      s += arr(660, 114, 744, 114, 'acc');
      s += box({ x: 744, y: 84, w: 136, h: 60, t: 'address', sub: 'match? yes/no', c: 'ok' });
      s += mid(456, 210, 'the signature travels in public; d never leaves the signer', 'd-s');
      return s;
    })());

  add('l04', 'A Merkle tree turns n hashes into one root',
    'Pair, hash, repeat. Changing any leaf changes the root, so the 32-byte root commits to the entire set.',
    W, 300,
    (function () {
      var s = '';
      var leaves = ['tx A', 'tx B', 'tx C', 'tx D'];
      var lx = [40, 250, 460, 670];
      leaves.forEach(function (t, i) {
        var sel = i === 2;
        s += box({ x: lx[i], y: 224, w: 170, h: 48, t: t, sub: 'H(0x00 || data)', c: sel ? 'ok' : '' });
      });
      // level 1
      s += box({ x: 145, y: 132, w: 170, h: 48, t: 'H(AB)', sub: 'sibling of CD', c: 'acc' });
      s += box({ x: 565, y: 132, w: 170, h: 48, t: 'H(CD)', sub: 'on the path', c: 'ok' });
      s += box({ x: 355, y: 40, w: 170, h: 48, t: 'ROOT', sub: 'in the block header', c: 'hot' });
      s += elbV(125, 224, 200, 180, '');
      s += elbV(335, 224, 260, 180, 'acc');
      s += elbV(545, 224, 620, 180, 'ok');
      s += elbV(755, 224, 680, 180, '');
      s += elbV(230, 132, 410, 88, 'acc');
      s += elbV(650, 132, 470, 88, 'ok');
      s += note(40, 292, 'PROOF FOR TX C = [ H(D), H(AB) ]  ·  2 HASHES INSTEAD OF 4 · log2(n) GROWTH');
      s += txt(20, 214, 'LEAVES', 'd-k');
      s += txt(20, 122, 'LEVEL 1', 'd-k');
      s += txt(20, 30, 'ROOT', 'd-k');
      return s;
    })());

  add('l05', 'Each block pins the one before it',
    'The previous hash is an input to this block hash. Edit block 2 and block 2 hash changes, so block 3 prev field no longer matches — every block after the edit breaks at once.',
    W, 260,
    (function () {
      var s = '';
      var xs = [30, 320, 610];
      var names = ['Block 1', 'Block 2 (edited)', 'Block 3'];
      var cls = ['ok', 'bad', 'bad'];
      xs.forEach(function (x, i) {
        s += box({ x: x, y: 56, w: 260, h: 120, t: names[i], c: cls[i] });
        s += line(x, 92, x + 260, 92, 'thin');
        s += txt(x + 14, 112, 'prev: ' + (i === 0 ? '0x000...' : 'hash of block ' + i), 'd-m');
        s += txt(x + 14, 132, 'merkle root', 'd-s');
        s += txt(x + 14, 152, 'nonce / timestamp', 'd-s');
        s += txt(x + 14, 170, 'hash: 0x' + (i === 0 ? '1f9a' : i === 1 ? 'c40e' : '77b2') + '...', 'd-m');
        if (i < 2) s += arr(x + 260, 116, xs[i + 1], 116, i === 0 ? 'bad' : 'bad', 'prev hash');
      });
      s += txt(320, 44, 'ONE FIELD CHANGED HERE', 'd-k');
      s += cur(452, 200, 742, 200, 40, 'bad dash', 'mismatch cascades forward, forever');
      s += mid(450, 244, 'to rewrite one old block you must redo every block after it', 'd-s');
      return s;
    })());

  /* =========================================================
     MODULE 2 — bitcoin and consensus
     ========================================================= */

  add('l06', 'UTXOs are consumed whole and replaced',
    'There is no balance field anywhere. A wallet balance is the sum of the coins it can spend, and change is an output back to yourself.',
    W, 250,
    (function () {
      var s = txt(20, 26, 'INPUTS (SPENT, DESTROYED)', 'd-k') + txt(620, 26, 'OUTPUTS (CREATED)', 'd-k');
      s += box({ x: 20, y: 46, w: 190, h: 50, t: 'UTXO #1', sub: '0.6 BTC', c: 'bad' });
      s += box({ x: 20, y: 112, w: 190, h: 50, t: 'UTXO #2', sub: '0.3 BTC', c: 'bad' });
      s += box({ x: 20, y: 178, w: 190, h: 50, t: 'UTXO #3', sub: '0.2 BTC', c: 'bad' });
      s += box({ x: 330, y: 90, w: 190, h: 88, t: 'transaction', sub: 'in 1.1 / out 1.0999', c: 'acc' });
      s += arr(210, 71, 330, 116, '');
      s += arr(210, 137, 330, 134, '');
      s += arr(210, 203, 330, 152, '');
      s += box({ x: 640, y: 76, w: 230, h: 50, t: 'to merchant', sub: '0.75 BTC', c: 'ok' });
      s += box({ x: 640, y: 142, w: 230, h: 50, t: 'change to self', sub: '0.3499 BTC', c: 'ok' });
      s += arr(520, 120, 640, 101, 'ok');
      s += arr(520, 148, 640, 167, 'ok');
      s += note(330, 210, 'FEE = SUM(IN) - SUM(OUT) = 0.0001 BTC, CLAIMED BY THE MINER');
      return s;
    })());

  add('l07', 'Proof of work is a guessing loop',
    'Nothing is clever here on purpose. The only way to find a hash below the target is to try, which is what makes the work measurable — and expensive to repeat.',
    W, 274,
    (function () {
      var s = box({ x: 30, y: 100, w: 168, h: 64, t: 'block header', sub: 'prev, root, time', c: '' });
      s += arr(198, 132, 286, 132, '');
      s += box({ x: 286, y: 100, w: 150, h: 64, t: 'nonce = k', sub: '4 bytes', c: 'hot' });
      s += arr(436, 132, 520, 132, '');
      s += box({ x: 520, y: 100, w: 150, h: 64, t: 'SHA-256d', sub: 'hash it twice', c: 'acc' });
      s += arr(670, 132, 720, 132, 'acc');
      s += diamond(720, 88, 150, 90, 'hash < target?', 'acc');
      s += arr(795, 178, 795, 224, 'ok', 'yes');
      s += box({ x: 660, y: 224, w: 230, h: 40, t: 'block solved, broadcast', c: 'ok' });
      s += '<path d="M720 133 H700 V44 H361 V100" class="d-line bad"/>' + head(361, 100, Math.PI / 2, 'bad');
      s += mid(530, 36, 'no: k = k + 1, and try again (billions of times per second)', 'd-s');
      s += note(30, 200, 'DIFFICULTY RETARGETS EVERY 2016 BLOCKS TO HOLD ~10 MINUTES PER BLOCK');
      return s;
    })());

  add('l08', 'Proof of stake: propose, attest, finalise',
    'Blocks arrive on a clock instead of a lottery. Finality is a vote with money behind it: reverting a finalised checkpoint requires a third of all staked ETH to be slashed.',
    W, 270,
    (function () {
      var s = txt(20, 26, 'SLOTS (12s EACH)', 'd-k');
      var x0 = 30, sw = 96, gap = 14;
      for (var i = 0; i < 8; i++) {
        var x = x0 + i * (sw + gap);
        var c = i === 5 ? 'hot' : 'acc';
        s += box({ x: x, y: 42, w: sw, h: 52, t: 'slot ' + (i + 1), sub: i === 5 ? 'missed' : 'block', c: i === 5 ? 'ghost' : c });
        if (i < 7) s += line(x + sw, 68, x + sw + gap, 68, 'thin');
      }
      s += line(30, 120, 870, 120, 'dash thin');
      s += box({ x: 30, y: 140, w: 190, h: 56, t: 'validator set', sub: '32 ETH each', c: '' });
      s += arr(220, 168, 320, 168, '', 'RANDAO pick');
      s += box({ x: 320, y: 140, w: 176, h: 56, t: 'proposer', sub: '1 per slot', c: 'hot' });
      s += arr(496, 168, 590, 168, 'hot', 'broadcast');
      s += box({ x: 590, y: 140, w: 132, h: 56, t: 'committee', sub: 'attesters', c: 'acc' });
      s += arr(722, 168, 800, 168, 'acc');
      s += box({ x: 800, y: 140, w: 90, h: 56, t: 'finalised', sub: '2 epochs', c: 'ok' });
      s += cur(386, 196, 386, 236, 30, 'bad', '');
      s += txt(410, 244, 'equivocate or contradict a finalised checkpoint = slashed stake', 'd-s');
      return s;
    })());

  add('l09', 'A reorg is a heavier branch winning',
    'Your transaction was in block 4a. When branch B arrives longer, 4a and 5a are orphaned and every transaction inside them returns to the mempool. This is why confirmations are counted.',
    W, 280,
    (function () {
      var s = '';
      s += box({ x: 30, y: 116, w: 130, h: 54, t: 'block 2', c: 'ok' });
      s += box({ x: 190, y: 116, w: 130, h: 54, t: 'block 3', sub: 'fork point', c: 'ok' });
      s += arr(160, 143, 190, 143, 'ok');
      // branch A (loses)
      s += box({ x: 390, y: 44, w: 130, h: 54, t: 'block 4a', sub: 'your tx', c: 'bad' });
      s += box({ x: 560, y: 44, w: 130, h: 54, t: 'block 5a', c: 'bad' });
      s += elb(320, 143, 390, 71, 'bad', '', 355);
      s += arr(520, 71, 560, 71, 'bad');
      s += txt(706, 76, 'orphaned: tx back to mempool', 'd-s');
      // branch B (wins)
      s += box({ x: 390, y: 188, w: 130, h: 54, t: 'block 4b', c: 'ok' });
      s += box({ x: 560, y: 188, w: 130, h: 54, t: 'block 5b', c: 'ok' });
      s += box({ x: 730, y: 188, w: 130, h: 54, t: 'block 6b', sub: 'heaviest', c: 'ok' });
      s += elb(320, 143, 390, 215, 'ok', '', 355);
      s += arr(520, 215, 560, 215, 'ok');
      s += arr(690, 215, 730, 215, 'ok');
      s += note(30, 268, 'CANONICAL CHAIN = MOST ACCUMULATED WORK (PoW) OR HEAVIEST ATTESTED (PoS) — NOT "FIRST SEEN"');
      return s;
    })());

  /* =========================================================
     MODULE 3 — ethereum and solidity
     ========================================================= */

  add('l10', 'Ethereum state: one trie, two kinds of leaf',
    'The block header commits to a state root. Under it, every account is a leaf with the same four fields — a contract just has a non-empty codeHash and storageRoot.',
    W, 300,
    (function () {
      var s = box({ x: 340, y: 30, w: 220, h: 52, t: 'block header', sub: 'stateRoot', c: 'hot' });
      s += arr(450, 82, 450, 118, 'hot');
      s += box({ x: 330, y: 118, w: 240, h: 48, t: 'state trie (MPT)', sub: 'address to account', c: 'acc' });
      s += elb(330, 142, 210, 214, 'acc', '', 270);
      s += elb(570, 142, 690, 214, 'acc', '', 630);
      s += box({ x: 40, y: 190, w: 340, h: 96, t: 'EOA', sub: 'controlled by a private key', c: 'ok' });
      s += txt(58, 250, 'nonce 7 · balance 1.2 ETH', 'd-m');
      s += txt(58, 270, 'codeHash = keccak("") · storageRoot = empty', 'd-s');
      s += box({ x: 520, y: 190, w: 340, h: 96, t: 'Contract account', sub: 'controlled by its own code', c: 'acc' });
      s += txt(538, 250, 'nonce 3 (deploy count) · balance 0 ETH', 'd-m');
      s += txt(538, 270, 'codeHash = keccak(runtime) · storageRoot = its trie', 'd-s');
      s += note(40, 176, 'BOTH ARE 20-BYTE ADDRESSES; THE NETWORK TELLS THEM APART BY codeHash');
      return s;
    })());

  add('l11', 'EIP-1559 splits one fee into two destinations',
    'You do not pay maxFeePerGas. You pay baseFee plus the tip, capped by it; the difference is refunded. The base fee is burned, so it cannot be paid back to the block producer.',
    W, 280,
    (function () {
      var s = txt(30, 28, 'ONE UNIT OF GAS', 'd-k');
      var x = 30, y = 44, w = 560, bh = 40;
      s += box({ x: x, y: y, w: w * 0.55, h: bh, t: 'baseFeePerGas', c: 'bad' });
      s += box({ x: x + w * 0.55, y: y, w: w * 0.18, h: bh, t: 'priority tip', c: 'ok' });
      s += box({ x: x + w * 0.73, y: y, w: w * 0.27, h: bh, t: 'refunded', c: 'ghost' });
      s += line(x, y + bh + 12, x + w, y + bh + 12, 'thin');
      s += txt(x, y + bh + 30, 'maxFeePerGas (your ceiling)', 'd-s');
      s += arr(x + w * 0.27, y + bh + 46, x + w * 0.27, y + 130, 'bad');
      s += arr(x + w * 0.64, y + bh + 46, x + w * 0.64, y + 130, 'ok');
      s += box({ x: 60, y: 130, w: 220, h: 52, t: 'BURNED', sub: 'supply drops', c: 'bad' });
      s += box({ x: 320, y: 130, w: 220, h: 52, t: 'to the validator', sub: 'the only real bribe', c: 'ok' });
      // feedback loop
      s += box({ x: 640, y: 44, w: 230, h: 52, t: 'block 50% full?', c: 'acc' });
      s += arr(755, 96, 755, 130, 'acc');
      s += box({ x: 640, y: 130, w: 230, h: 52, t: 'next baseFee', sub: 'moves +/- 12.5% max', c: 'acc' });
      s += cur(870, 156, 870, 70, -46, 'acc dash', 'feedback');
      s += note(30, 226, 'FULLER THAN HALF: BASE FEE RISES. EMPTIER: IT FALLS. IT NEVER JUMPS MORE THAN 12.5% PER BLOCK.');
      s += note(30, 252, 'EFFECTIVE PRICE = min(maxFee, baseFee + maxPriorityFee)');
      return s;
    })());

  add('l12', 'The EVM is a stack machine with four memories',
    'Every opcode pops its arguments off the stack and pushes its result back. What separates the four regions is lifetime and price.',
    W, 300,
    (function () {
      var s = box({ x: 30, y: 40, w: 200, h: 58, t: 'calldata', sub: 'read-only, per call', c: '' });
      s += box({ x: 30, y: 118, w: 200, h: 58, t: 'stack', sub: '1024 slots x 32 bytes', c: 'acc' });
      s += box({ x: 30, y: 196, w: 200, h: 58, t: 'memory', sub: 'wiped after the call', c: '' });
      s += box({ x: 640, y: 196, w: 230, h: 58, t: 'storage', sub: 'persists forever', c: 'hot' });
      s += box({ x: 330, y: 108, w: 220, h: 80, t: 'opcode dispatch', sub: 'pop, compute, push', sub2: 'charge gas', c: 'acc' });
      s += arr(230, 69, 330, 130, '', 'CALLDATALOAD');
      s += arr(230, 147, 330, 147, 'acc');
      s += arr(330, 165, 230, 225, '', '');
      s += txt(240, 244, 'MLOAD / MSTORE · 3 gas', 'd-m');
      s += arr(550, 160, 640, 214, 'hot', 'SSTORE 20000');
      s += arr(640, 236, 550, 178, 'hot', 'SLOAD 2100');
      s += box({ x: 640, y: 40, w: 230, h: 58, t: 'gas counter', sub: 'hits 0 = revert all', c: 'bad' });
      s += arr(550, 128, 640, 78, 'bad', 'charge');
      s += note(30, 285, 'ALL-OR-NOTHING: A REVERT UNDOES EVERY STATE WRITE, BUT THE GAS IS STILL SPENT');
      return s;
    })());

  add('l13', 'Where each variable actually lives',
    'Value types fill slots in declaration order and pack when they fit. Mappings and dynamic arrays do not sit in their slot at all — the slot number is only a seed for a keccak hash.',
    W, 320,
    (function () {
      var s = txt(30, 26, 'DECLARATION', 'd-k') + txt(470, 26, 'SLOT LAYOUT', 'd-k');
      s += box({ x: 30, y: 42, w: 370, h: 44, t: 'uint128 a; uint128 b;', tc: 'd-m', c: 'ok' });
      s += box({ x: 30, y: 98, w: 370, h: 44, t: 'address owner; bool live;', tc: 'd-m', c: 'ok' });
      s += box({ x: 30, y: 154, w: 370, h: 44, t: 'mapping(address => uint) bal;', tc: 'd-m', c: 'acc' });
      s += box({ x: 30, y: 210, w: 370, h: 44, t: 'uint[] items;', tc: 'd-m', c: 'hot' });
      s += arr(400, 64, 470, 64, 'ok');
      s += arr(400, 120, 470, 120, 'ok');
      s += arr(400, 176, 470, 176, 'acc');
      s += arr(400, 232, 470, 232, 'hot');
      s += box({ x: 470, y: 42, w: 400, h: 44, t: 'slot 0  =  [ b | a ]  one SSTORE', tc: 'd-m', c: 'ok' });
      s += box({ x: 470, y: 98, w: 400, h: 44, t: 'slot 1  =  [ pad | live | owner ]', tc: 'd-m', c: 'ok' });
      s += box({ x: 470, y: 154, w: 400, h: 44, t: 'slot 2  =  empty; key at keccak(k . 2)', tc: 'd-m', c: 'acc' });
      s += box({ x: 470, y: 210, w: 400, h: 44, t: 'slot 3  =  length; data at keccak(3)+i', tc: 'd-m', c: 'hot' });
      s += note(30, 284, 'REORDER THE DECLARATIONS AND TWO 20000-GAS WRITES BECOME ONE. THE SLOT NUMBERS ARE PART OF YOUR ABI:');
      s += note(30, 306, 'A PROXY UPGRADE THAT SHIFTS THEM CORRUPTS EVERY EXISTING VALUE.');
      return s;
    })());

  add('l14', 'ERC-20 approve then transferFrom',
    'The token contract is the only ledger. A "transfer" is two number edits inside one contract — nothing moves, and the DEX never holds your key, only an allowance.',
    W, 300,
    (function () {
      var s = life(120, 24, 262, 'Owner (EOA)', 'ok') +
        life(450, 24, 262, 'Token contract', 'acc') +
        life(780, 24, 262, 'DEX (spender)', 'hot');
      s += arr(120, 100, 450, 100, 'ok', 'approve(DEX, 100)');
      s += txt(462, 124, 'allowance[owner][DEX] = 100', 'd-m');
      s += arr(780, 160, 450, 160, 'hot', 'transferFrom(owner, DEX, 60)');
      s += txt(462, 184, 'check allowance >= 60, then subtract', 'd-s');
      s += txt(462, 204, 'balanceOf[owner] -= 60; balanceOf[DEX] += 60', 'd-m');
      s += arr(450, 236, 780, 236, 'acc', 'Transfer event');
      s += note(30, 288, 'THE REMAINING ALLOWANCE IS 40 AND STAYS THERE UNTIL REVOKED — INFINITE APPROVALS ARE A STANDING WITHDRAWAL RIGHT');
      return s;
    })());

  add('l15', 'ERC-721 vs ERC-1155 in one picture',
    'A 721 maps one id to one owner. A 1155 maps one id to a balance per owner, which is why it can carry both unique items and stacks of fungible ones in the same contract.',
    W, 260,
    (function () {
      var s = txt(30, 26, 'ERC-721 — ONE OWNER PER ID', 'd-k') + txt(490, 26, 'ERC-1155 — BALANCE PER (ID, OWNER)', 'd-k');
      s += line(462, 40, 462, 236, 'dash thin');
      s += box({ x: 30, y: 46, w: 130, h: 42, t: 'id 1', c: 'acc' });
      s += box({ x: 30, y: 104, w: 130, h: 42, t: 'id 2', c: 'acc' });
      s += box({ x: 30, y: 162, w: 130, h: 42, t: 'id 3', c: 'acc' });
      s += box({ x: 280, y: 46, w: 150, h: 42, t: 'Alice', c: 'ok' });
      s += box({ x: 280, y: 104, w: 150, h: 42, t: 'Bob', c: 'ok' });
      s += box({ x: 280, y: 162, w: 150, h: 42, t: 'Alice', c: 'ok' });
      s += arr(160, 67, 280, 67, '') + arr(160, 125, 280, 125, '') + arr(160, 183, 280, 183, '');
      s += mid(230, 228, 'ownerOf(id)', 'd-m');
      s += box({ x: 490, y: 46, w: 130, h: 42, t: 'id 7 sword', c: 'acc' });
      s += box({ x: 490, y: 132, w: 130, h: 42, t: 'id 9 gold', c: 'acc' });
      s += box({ x: 730, y: 40, w: 140, h: 34, t: 'Alice: 1', tc: 'd-m', c: 'ok' });
      s += box({ x: 730, y: 82, w: 140, h: 34, t: 'Bob: 0', tc: 'd-m', c: 'ghost' });
      s += box({ x: 730, y: 126, w: 140, h: 34, t: 'Alice: 500', tc: 'd-m', c: 'ok' });
      s += box({ x: 730, y: 168, w: 140, h: 34, t: 'Bob: 1200', tc: 'd-m', c: 'ok' });
      s += arr(620, 67, 730, 57, '') + arr(620, 67, 730, 99, '');
      s += arr(620, 153, 730, 143, '') + arr(620, 153, 730, 185, '');
      s += mid(700, 228, 'balanceOf(owner, id) · batch transfers in one call', 'd-m');
      return s;
    })());

  /* =========================================================
     MODULE 4 — tooling and dApps
     ========================================================= */

  add('l16', 'The Foundry loop',
    'Everything runs locally against a forked or fresh EVM. No testnet, no waiting, no faucet — the network only appears at the last step.',
    W, 230,
    (function () {
      var s = flow(20, 44, 128, 62, 18, [
        { t: 'forge init', sub: 'src / test', lbl: 'write' },
        { t: 'src/*.sol', sub: 'contracts', lbl: 'forge build', c: 'acc' },
        { t: 'bytecode', sub: '+ ABI', lbl: 'forge test', c: 'acc' },
        { t: 'test/*.t.sol', sub: 'Solidity tests', lbl: 'pass?', c: 'ok' },
        { t: 'forge script', sub: 'broadcast', lbl: 'RPC', c: 'hot' },
        { t: 'chain', sub: 'deployed', c: 'hot' }
      ]);
      s += cur(668, 106, 314, 106, 62, 'bad dash', 'fail: fix and rerun, in milliseconds');
      s += note(20, 200, 'anvil GIVES A LOCAL CHAIN · cast IS THE CLI FOR EVERY RPC CALL · forge fmt AND forge coverage COMPLETE THE SET');
      return s;
    })());

  add('l17', 'Three layers of test, three kinds of bug',
    'Unit tests check the cases you thought of. Fuzzing checks the cases you did not. Invariants check the property that must hold no matter what sequence a user runs.',
    W, 280,
    (function () {
      var s = '';
      var rows = [
        { t: 'unit', sub: 'you pick the inputs', c: '', w: 300, ex: 'transfer(alice, 10) works' },
        { t: 'fuzz', sub: 'the runner picks the inputs', c: 'acc', w: 460, ex: 'transfer(x, y) never overflows' },
        { t: 'invariant', sub: 'random call sequences, one property', c: 'hot', w: 620, ex: 'sum(balances) == totalSupply' }
      ];
      rows.forEach(function (r, i) {
        var y = 40 + i * 74;
        var x = 30 + (620 - r.w) / 2;
        s += box({ x: x, y: y, w: r.w, h: 54, t: r.t, sub: r.sub, c: r.c });
        s += txt(680, y + 32, r.ex, 'd-m');
      });
      s += arr(340, 94, 340, 114, 'acc') + arr(340, 168, 340, 188, 'hot');
      s += note(30, 268, 'AN INVARIANT SUITE NEEDS A HANDLER TO KEEP CALLS VALID, AND GHOST VARIABLES TO TRACK WHAT THE CONTRACT DOES NOT STORE');
      return s;
    })());

  add('l18', 'What happens between a click and a transaction',
    'The wallet is the only component holding a key. Your frontend never sees it; it hands over an intent and gets back a signature or a rejection.',
    W, 300,
    (function () {
      var s = flow(24, 50, 150, 66, 22, [
        { t: 'React UI', sub: 'user clicks', lbl: 'viem call' },
        { t: 'viem', sub: 'encodes ABI', lbl: 'EIP-1193', c: 'acc' },
        { t: 'wallet', sub: 'holds the key', lbl: 'signed tx', c: 'hot' },
        { t: 'RPC node', sub: 'eth_sendRaw', lbl: 'gossip', c: 'acc' },
        { t: 'chain', sub: 'mined', c: 'ok' }
      ]);
      s += box({ x: 24, y: 176, w: 260, h: 56, t: 'simulateContract', sub: 'would it revert?', c: 'acc' });
      s += box({ x: 320, y: 176, w: 260, h: 56, t: 'writeContract', sub: 'ask for the signature', c: 'hot' });
      s += box({ x: 616, y: 176, w: 260, h: 56, t: 'waitForTransactionReceipt', sub: 'status 1 or 0', c: 'ok' });
      s += arr(284, 204, 320, 204, '') + arr(580, 204, 616, 204, '');
      s += note(24, 262, 'SKIPPING simulate MEANS THE USER PAYS GAS TO WATCH A REVERT. status: 0 IS A FAILED TX, NOT A THROWN ERROR.');
      s += note(24, 286, 'A RECEIPT IS NOT FINALITY — WAIT FOR CONFIRMATIONS BEFORE SHOWING SUCCESS FOR ANYTHING VALUABLE.');
      return s;
    })());

  add('l19', 'CREATE drifts, CREATE2 does not',
    'A plain deploy address depends on your nonce, so it moves every time you deploy anything. CREATE2 replaces the nonce with a salt and the init code hash, so the address is knowable before the contract exists.',
    W, 270,
    (function () {
      var s = txt(30, 26, 'CREATE', 'd-k');
      s += box({ x: 30, y: 42, w: 400, h: 78, t: 'keccak(rlp([sender, nonce]))[12:]', tc: 'd-m', c: '' });
      s += txt(48, 106, 'nonce 0 -> 0x5FbDB2...  nonce 1 -> 0xe7f172...', 'd-s');
      s += txt(30, 150, 'CREATE2', 'd-k');
      s += box({ x: 30, y: 166, w: 400, h: 78, t: 'keccak(0xff . sender . salt . keccak(init))[12:]', tc: 'd-m', c: 'ok' });
      s += txt(48, 230, 'same salt and same init code -> same address on every chain', 'd-s');
      s += flow(470, 60, 128, 58, 22, [
        { t: 'compile', sub: 'solc', lbl: 'deploy' },
        { t: 'broadcast', sub: 'forge script', lbl: 'wait', c: 'acc' },
        { t: 'verify', sub: 'etherscan', c: 'ok' }
      ]);
      s += arr(534, 118, 534, 166, 'bad');
      s += box({ x: 470, y: 166, w: 400, h: 78, t: 'source must match byte for byte', sub: 'same compiler, same optimizer runs, same metadata', c: 'bad' });
      s += note(470, 44, 'DEPLOY PIPELINE');
      return s;
    })());

  /* =========================================================
     MODULE 5 — security and gas
     ========================================================= */

  add('l20', 'The reentrancy drain, call by call',
    'The bug is the order of two lines. The external call hands control to code the attacker wrote, while your balance ledger still says they are owed money.',
    W, 330,
    (function () {
      var s = life(150, 24, 292, 'Attacker contract', 'bad') + life(560, 24, 292, 'Vulnerable vault', 'acc');
      s += arr(150, 84, 560, 84, 'bad', 'withdraw()');
      s += txt(572, 108, 'reads balance[attacker] = 1 ETH', 'd-s');
      s += arr(560, 132, 150, 132, 'bad', 'call{value: 1 ETH}("")');
      s += txt(20, 222, 'receive() fires here — the balance is NOT yet zeroed', 'd-s');
      s += arr(150, 180, 560, 180, 'bad', 'withdraw() again');
      s += txt(572, 204, 'balance still says 1 ETH, so it pays again', 'd-bad d-s');
      s += cur(150, 196, 150, 88, -110, 'bad dash') + txt(12, 148, 'repeat', 'd-m');
      s += line(30, 236, 870, 236, 'dash thin');
      s += box({ x: 30, y: 250, w: 260, h: 62, t: 'CEI order', sub: 'zero the balance first', c: 'ok' });
      s += box({ x: 320, y: 250, w: 260, h: 62, t: 'nonReentrant', sub: 'a mutex on the entry point', c: 'ok' });
      s += box({ x: 610, y: 250, w: 260, h: 62, t: 'pull payments', sub: 'no external call at all', c: 'ok' });
      s += note(30, 328, 'CEI ALONE FIXES THIS ONE. CROSS-FUNCTION AND READ-ONLY REENTRANCY NEED THE MUTEX TOO.');
      return s;
    })());

  add('l21', 'The MEV supply chain',
    'Your pending transaction is public information. Between broadcast and inclusion, it passes through actors paid to reorder it — which is why slippage limits are a security setting, not a preference.',
    W, 280,
    (function () {
      var s = flow(24, 48, 138, 66, 24, [
        { t: 'your tx', sub: 'public mempool', lbl: 'seen', c: '' },
        { t: 'searcher', sub: 'finds profit', lbl: 'bundle', c: 'bad' },
        { t: 'builder', sub: 'orders the block', lbl: 'bid', c: 'acc' },
        { t: 'relay', sub: 'blind auction', lbl: 'header', c: 'acc' },
        { t: 'proposer', sub: 'signs the top bid', c: 'ok' }
      ]);
      s += txt(30, 168, 'INSIDE THE BUNDLE', 'd-k');
      s += box({ x: 30, y: 186, w: 250, h: 52, t: '1. bot buys', sub: 'price pushed up', c: 'bad' });
      s += box({ x: 320, y: 186, w: 250, h: 52, t: '2. your swap', sub: 'fills at the worse price', c: 'hot' });
      s += box({ x: 610, y: 186, w: 250, h: 52, t: '3. bot sells', sub: 'pockets the difference', c: 'bad' });
      s += arr(280, 212, 320, 212, 'bad') + arr(570, 212, 610, 212, 'bad');
      s += note(30, 266, 'DEFENCE: A TIGHT minAmountOut MAKES THE SANDWICH UNPROFITABLE. PRIVATE RELAYS SKIP THE MEMPOOL.');
      return s;
    })());

  add('l22', 'A proxy splits code from storage',
    'delegatecall runs the logic contract bytecode inside the proxy storage. That is the whole trick — and the whole danger, because both contracts must agree on what every slot means.',
    W, 300,
    (function () {
      var s = box({ x: 30, y: 110, w: 150, h: 56, t: 'user', c: '' });
      s += arr(180, 138, 300, 138, '', 'any call');
      s += box({ x: 300, y: 74, w: 230, h: 130, t: 'Proxy', sub: 'holds ALL storage', sub2: 'holds the ETH', c: 'hot' });
      s += arr(530, 116, 680, 116, 'acc', 'delegatecall');
      s += arr(680, 164, 530, 164, 'acc', 'state writes land here');
      s += box({ x: 680, y: 74, w: 200, h: 130, t: 'Implementation', sub: 'code only', sub2: 'its storage unused', c: 'acc' });
      s += box({ x: 300, y: 226, w: 230, h: 54, t: 'slot 0..n', sub: 'layout is a contract', c: 'ok' });
      s += arr(415, 204, 415, 226, 'hot');
      s += txt(560, 248, 'EIP-1967 puts the implementation pointer at a hashed slot', 'd-s');
      s += txt(560, 268, 'so it can never collide with slot 0 of your logic', 'd-s');
      s += note(30, 200, 'UUPS: THE UPGRADE');
      s += note(30, 222, 'FUNCTION LIVES IN THE');
      s += note(30, 244, 'IMPLEMENTATION.');
      s += note(30, 266, 'SHIP ONE WITHOUT IT');
      s += note(30, 288, 'AND IT IS BRICKED.');
      return s;
    })());

  /* =========================================================
     MODULE 6 — defi, scaling, capstone
     ========================================================= */

  add('l23', 'x · y = k — why big trades cost more',
    'The pool never quotes a price; it just refuses to let the product fall. Buying pushes you along the curve, and the marginal price is the slope where you land.',
    W, 330,
    (function () {
      var s = '';
      var ox = 90, oy = 280, w = 420, h = 230;
      var k = 100 * 100;
      s += line(ox, oy, ox + w, oy, 'thin') + line(ox, oy, ox, oy - h, 'thin');
      s += txt(ox + w - 60, oy + 24, 'token X', 'd-s') + txt(ox - 66, oy - h + 4, 'token Y', 'd-s');
      var pts = [];
      for (var i = 0; i <= 60; i++) {
        var xv = 60 + i * (300 - 60) / 60;
        var yv = k / xv;
        pts.push([ox + (xv - 40) / 280 * w, oy - (yv - 20) / 200 * h]);
      }
      s += poly(pts, 'acc');
      function P(xv) { var yv = k / xv; return [ox + (xv - 40) / 280 * w, oy - (yv - 20) / 200 * h]; }
      var a = P(100), b = P(120), c = P(220);
      s += dot(a[0], a[1], 5, 'ok') + txt(a[0] + 10, a[1] - 10, 'start 100 / 100', 'd-m');
      s += dot(b[0], b[1], 5, 'acc') + txt(b[0] + 12, b[1] - 6, 'small trade', 'd-m');
      s += dot(c[0], c[1], 5, 'bad') + txt(c[0] + 12, c[1] + 16, 'large trade', 'd-m');
      s += line(a[0], a[1], a[0], oy, 'dash thin') + line(b[0], b[1], b[0], oy, 'dash thin') + line(c[0], c[1], c[0], oy, 'dash thin');
      s += txt(ox + w + 30, 60, 'PRICE IMPACT IS NOT LINEAR', 'd-k');
      s += box({ x: ox + w + 30, y: 80, w: 320, h: 56, t: '+20 X in', sub: 'you get 16.7 Y — near spot', c: 'ok' });
      s += box({ x: ox + w + 30, y: 148, w: 320, h: 56, t: '+120 X in', sub: 'you get 54.5 Y — 9% worse', c: 'bad' });
      s += box({ x: ox + w + 30, y: 216, w: 320, h: 56, t: 'k only ever grows', sub: 'the 0.3% fee stays in the pool', c: 'acc' });
      s += note(30, 322, 'IMPERMANENT LOSS: SIMPLY HOLDING THE PAIR BEATS PROVIDING LIQUIDITY WHENEVER THE PRICE MOVES — EITHER WAY');
      return s;
    })());

  add('l24', 'Health factor decides who owns your collateral',
    'One number, checked on every action. Above 1 you are a borrower; at 1 you are inventory, and a bot is already computing whether liquidating you clears its gas cost.',
    W, 290,
    (function () {
      var s = '';
      var x = 40, y = 60, w = 800, h = 42;
      s += box({ x: x, y: y, w: w * 0.28, h: h, t: 'HF < 1 — liquidatable', c: 'bad' });
      s += box({ x: x + w * 0.28, y: y, w: w * 0.24, h: h, t: '1.0 - 1.3 danger', c: 'hot' });
      s += box({ x: x + w * 0.52, y: y, w: w * 0.22, h: h, t: '1.3 - 2.0 tight', c: 'acc' });
      s += box({ x: x + w * 0.74, y: y, w: w * 0.26, h: h, t: 'HF > 2 comfortable', c: 'ok' });
      s += arr(x + w * 0.28, y + h + 26, x + w * 0.28, y + h + 4, 'bad');
      s += txt(x + w * 0.28 - 40, y + h + 44, 'HF = 1.0', 'd-m');
      s += txt(40, 40, 'HF  =  (collateral x liquidationThreshold)  /  debt', 'd-m');
      s += line(40, 168, 860, 168, 'dash thin');
      s += flow(40, 190, 148, 62, 24, [
        { t: 'price drops', sub: 'oracle update', lbl: 'HF < 1', c: 'bad' },
        { t: 'bot spots it', sub: 'watching events', lbl: 'call', c: 'hot' },
        { t: 'repays debt', sub: 'up to close factor', lbl: 'seizes', c: 'acc' },
        { t: 'takes collateral', sub: '+5-10% bonus', lbl: 'HF up', c: 'acc' },
        { t: 'position safe', sub: 'you paid for it', c: 'ok' }
      ]);
      s += note(40, 278, 'THE BONUS IS THE POINT: LIQUIDATION MUST BE PROFITABLE OR NOBODY DOES IT AND THE PROTOCOL TAKES BAD DEBT');
      return s;
    })());

  add('l25', 'A rollup executes off-chain and proves on-chain',
    'Execution moves to one sequencer; data and settlement stay on L1. What differs between optimistic and ZK rollups is only how L1 becomes convinced the new state root is right.',
    W, 320,
    (function () {
      var s = txt(30, 26, 'LAYER 2', 'd-k');
      s += flow(30, 42, 160, 62, 26, [
        { t: 'users', sub: 'cheap txs', lbl: 'to sequencer' },
        { t: 'sequencer', sub: 'orders + executes', lbl: 'batch', c: 'acc' },
        { t: 'batch', sub: 'compressed', c: 'acc' }
      ]);
      s += arr(430, 104, 430, 152, 'acc', 'post to L1');
      s += line(30, 152, 870, 152, 'dash thin');
      s += txt(30, 176, 'LAYER 1 — ETHEREUM', 'd-k');
      s += box({ x: 30, y: 190, w: 250, h: 66, t: 'blob (EIP-4844)', sub: 'data available ~18 days', c: 'hot' });
      s += box({ x: 320, y: 190, w: 250, h: 66, t: 'rollup contract', sub: 'holds the state root', c: 'acc' });
      s += box({ x: 610, y: 190, w: 260, h: 66, t: 'bridge', sub: 'withdrawals settle here', c: 'ok' });
      s += arr(280, 223, 320, 223, 'hot') + arr(570, 223, 610, 223, 'acc');
      s += box({ x: 320, y: 274, w: 250, h: 40, t: 'optimistic: 7-day challenge', c: 'hot' });
      s += box({ x: 610, y: 274, w: 260, h: 40, t: 'ZK: validity proof, minutes', c: 'ok' });
      s += arr(445, 256, 445, 274, 'hot') + arr(740, 256, 740, 274, 'ok');
      s += note(30, 284, 'CALLDATA WAS');
      s += note(30, 304, '~10x THE COST');
      return s;
    })());

  add('l26', 'Commit-reveal removes the front-running window',
    'Phase one publishes a hash, which leaks nothing if it contains a secret salt. Phase two publishes the inputs, and the contract checks they hash to what you already committed.',
    W, 290,
    (function () {
      var s = line(40, 92, 860, 92, '');
      [[40, 'T0'], [300, 'T1'], [560, 'T2'], [860, 'T3']].forEach(function (p) {
        s += line(p[0], 84, p[0], 100, '') + txt(p[0] - 8, 76, p[1], 'd-k');
      });
      s += box({ x: 40, y: 110, w: 250, h: 74, t: 'COMMIT phase', sub: 'send keccak(bid, salt, addr)', sub2: 'nothing readable on-chain', c: 'acc' });
      s += box({ x: 310, y: 110, w: 240, h: 74, t: 'REVEAL phase', sub: 'send bid + salt', sub2: 'contract re-hashes and compares', c: 'hot' });
      s += box({ x: 570, y: 110, w: 290, h: 74, t: 'SETTLE', sub: 'highest valid reveal wins', sub2: 'no-shows forfeit their deposit', c: 'ok' });
      s += arr(290, 147, 310, 147, 'acc') + arr(550, 147, 570, 147, 'hot');
      s += box({ x: 40, y: 208, w: 380, h: 62, t: 'no salt = brute-forceable', sub: 'a bot tries every plausible bid in seconds', c: 'bad' });
      s += box({ x: 460, y: 208, w: 400, h: 62, t: 'no deposit = free option', sub: 'losers simply never reveal, and lose nothing', c: 'bad' });
      s += note(40, 44, 'ON-CHAIN DATA IS PUBLIC THE INSTANT IT IS BROADCAST — SO HIDE THE VALUE BEHIND A HASH UNTIL IT IS SAFE');
      return s;
    })());

  /* =========================================================
     MODULE 7 — SUI & MOVE
     ========================================================= */

  add('l27', 'Objects make the transaction’s state footprint explicit',
    'Independent owned-object updates can proceed without a common mutable input. A shared pool is intentionally common state, so its writes are ordered through consensus.',
    W, 300,
    (function () {
      var s = box({ x: 35, y: 42, w: 220, h: 72, t: 'Alice’s Badge', sub: 'owned object · v4', c: 'ok' });
      s += box({ x: 35, y: 174, w: 220, h: 72, t: 'Bob’s Badge', sub: 'owned object · v9', c: 'ok' });
      s += box({ x: 355, y: 42, w: 205, h: 72, t: 'Alice tx', sub: 'promote badge', c: 'acc' });
      s += box({ x: 355, y: 174, w: 205, h: 72, t: 'Bob tx', sub: 'promote badge', c: 'acc' });
      s += arr(255, 78, 355, 78, 'ok', 'distinct input') + arr(255, 210, 355, 210, 'ok', 'distinct input');
      s += box({ x: 660, y: 42, w: 200, h: 72, t: 'parallel execute', sub: 'no write conflict', c: 'ok' });
      s += arr(560, 78, 660, 78, 'ok') + arr(560, 210, 660, 114, 'ok');
      s += box({ x: 35, y: 260, w: 250, h: 30, t: 'shared AMM pool → consensus orders each mutation', c: 'hot' });
      s += note(35, 28, 'OWNERSHIP IS PART OF THE EXECUTION PLAN');
      return s;
    })());

  add('l28', 'A capability is the object that proves authority',
    'The initializer creates one AdminCap and transfers it to its first holder. Every privileged call takes a reference to that scarce resource; an ID alone proves nothing.',
    W, 285,
    (function () {
      var s = box({ x: 40, y: 48, w: 210, h: 70, t: 'package init', sub: 'creates exactly one cap', c: 'acc' });
      s += box({ x: 340, y: 48, w: 210, h: 70, t: 'AdminCap', sub: 'key · store · scarce', c: 'ok' });
      s += box({ x: 640, y: 48, w: 210, h: 70, t: 'multisig / holder', sub: 'controls the cap', c: 'hot' });
      s += arr(250, 83, 340, 83, 'acc', 'transfer') + arr(550, 83, 640, 83, 'ok', 'custody');
      s += box({ x: 340, y: 180, w: 210, h: 64, t: 'pause(&AdminCap)', sub: 'privileged function', c: 'ok' });
      s += arr(745, 118, 530, 180, 'hot', 'provides &cap');
      s += box({ x: 40, y: 180, w: 205, h: 64, t: 'public object ID', sub: 'identifier only', c: 'bad' });
      s += line(245, 212, 320, 212, 'bad dash') + mid(282, 203, 'not authority', 'd-m');
      s += note(40, 30, 'MOVE ABILITIES MAKE ASSET INVARIANTS PART OF THE TYPE');
      return s;
    })());

  add('l29', 'A PTB passes temporary results from command to command',
    'Split a payment, mint an object and transfer both results in one atomic transaction. If any command fails, none of the changes become effects.',
    W, 290,
    (function () {
      var s = box({ x: 35, y: 108, w: 155, h: 62, t: 'gas coin', sub: '5,000,000 MIST', c: 'hot' });
      s += box({ x: 265, y: 108, w: 175, h: 62, t: 'SplitCoins', sub: '→ payment', c: 'acc' });
      s += box({ x: 515, y: 38, w: 180, h: 62, t: 'MoveCall', sub: '→ Badge object', c: 'ok' });
      s += box({ x: 750, y: 108, w: 120, h: 62, t: 'transfer', sub: 'recipient', c: 'ok' });
      s += arr(190, 139, 265, 139, 'hot') + arr(440, 139, 750, 139, 'acc', 'payment result');
      s += arr(695, 69, 810, 108, 'ok', 'badge result');
      s += box({ x: 265, y: 220, w: 430, h: 38, t: 'ONE SIGNATURE · ATOMIC EFFECTS OR ROLLBACK', c: 'hot' });
      s += note(35, 28, 'COMMAND RESULTS EXIST ONLY INSIDE THIS TRANSACTION UNTIL COMMIT');
      return s;
    })());

  add('l30', 'Keep shared coordination small; keep user assets owned',
    'A shared board is the common coordination point and emits an event. Each player’s inventory remains address-owned, so independent changes do not all queue behind the board.',
    W, 300,
    (function () {
      var s = box({ x: 330, y: 45, w: 245, h: 70, t: 'shared Scoreboard', sub: 'high score + small config', c: 'hot' });
      s += box({ x: 35, y: 170, w: 190, h: 62, t: 'Alice inventory', sub: 'address-owned', c: 'ok' });
      s += box({ x: 355, y: 170, w: 190, h: 62, t: 'Bob inventory', sub: 'address-owned', c: 'ok' });
      s += box({ x: 675, y: 170, w: 190, h: 62, t: 'Carol inventory', sub: 'address-owned', c: 'ok' });
      s += arr(130, 170, 405, 115, 'acc', 'submit score') + arr(450, 170, 452, 115, 'acc') + arr(770, 170, 500, 115, 'acc');
      s += box({ x: 620, y: 45, w: 220, h: 70, t: 'ScoreSubmitted event', sub: 'indexer / activity feed', c: 'acc' });
      s += arr(575, 80, 620, 80, 'hot', 'emit');
      s += note(35, 30, 'SHARE WHAT MUST COORDINATE — NOT EVERY PIECE OF USER STATE');
      return s;
    })());

  add('l31', 'Kiosk custody and transfer policy have different jobs',
    'The Kiosk holds and lists an object. A transfer-policy rule must produce its receipt before the request can be confirmed and the asset reaches its buyer.',
    W, 285,
    (function () {
      var s = box({ x: 35, y: 102, w: 160, h: 64, t: 'seller Kiosk', sub: 'listed item', c: 'acc' });
      s += box({ x: 285, y: 102, w: 180, h: 64, t: 'transfer request', sub: 'transaction-local', c: 'hot' });
      s += box({ x: 555, y: 34, w: 195, h: 64, t: 'royalty rule', sub: 'payment → receipt', c: 'ok' });
      s += box({ x: 555, y: 184, w: 195, h: 64, t: 'policy confirm', sub: 'all rules satisfied', c: 'ok' });
      s += box({ x: 805, y: 102, w: 65, h: 64, t: 'buyer', sub: 'item', c: 'acc' });
      s += arr(195, 134, 285, 134, 'acc', 'take') + arr(465, 134, 555, 66, 'hot', 'pay') + arr(652, 98, 652, 184, 'ok', 'receipt') + arr(750, 216, 805, 134, 'ok', 'transfer');
      s += note(35, 30, 'A MARKETPLACE UI CANNOT BYPASS A POLICY THE ASSET TYPE REQUIRES');
      return s;
    })());

  add('l32', 'Sponsored transactions bind two signatures to one intent',
    'The user reviews and signs the final transaction bytes. The gas station checks its policy and signs those same bytes as gas owner — it must not rewrite the transaction.',
    W, 285,
    (function () {
      var s = box({ x: 35, y: 96, w: 180, h: 68, t: 'user', sub: 'reviews + signs intent', c: 'ok' });
      s += box({ x: 315, y: 96, w: 220, h: 68, t: 'final transaction bytes', sub: 'sender · target · args · gas', c: 'hot' });
      s += box({ x: 635, y: 96, w: 190, h: 68, t: 'gas station', sub: 'policy checks + signs', c: 'acc' });
      s += arr(215, 130, 315, 130, 'ok', 'user signature') + arr(535, 130, 635, 130, 'acc', 'same bytes');
      s += box({ x: 315, y: 220, w: 220, h: 36, t: 'submit → atomic effects', c: 'ok' });
      s += arr(730, 164, 475, 220, 'hot', 'both signatures');
      s += note(35, 30, 'CHANGE ONE BYTE → REQUIRE FRESH USER APPROVAL');
      return s;
    })());

  add('l33', 'Walletless onboarding still has a custody boundary',
    'zkLogin binds an OAuth identity to an ephemeral signing key with a proof; passkeys use WebAuthn credentials. Both need intentional recovery and secret-handling design.',
    W, 285,
    (function () {
      var s = box({ x: 35, y: 44, w: 175, h: 62, t: 'OAuth issuer', sub: 'identity token', c: 'acc' });
      s += box({ x: 295, y: 44, w: 190, h: 62, t: 'client', sub: 'salt + ephemeral key', c: 'hot' });
      s += box({ x: 570, y: 44, w: 190, h: 62, t: 'zkLogin proof', sub: 'binds claims + key', c: 'ok' });
      s += box({ x: 775, y: 44, w: 95, h: 62, t: 'Sui', sub: 'verify', c: 'acc' });
      s += arr(210, 75, 295, 75, 'acc') + arr(485, 75, 570, 75, 'hot') + arr(760, 75, 775, 75, 'ok');
      s += box({ x: 260, y: 185, w: 390, h: 58, t: 'Passkey alternative: WebAuthn credential + recovery plan', sub: 'device authentication is not the same thing as OAuth', c: 'ok' });
      s += note(35, 30, 'DO NOT MOVE EPHEMERAL KEYS OR SALTS INTO UNREVIEWED SERVER LOGS');
      return s;
    })());

  add('l34', 'A shared order book matches owned user assets at a limit price',
    'The market is common mutable state. The buyer’s coin enters a PTB, fills only eligible asks, then output and change return as owned objects.',
    W, 285,
    (function () {
      var s = box({ x: 35, y: 100, w: 180, h: 64, t: 'buyer coin', sub: 'address-owned', c: 'ok' });
      s += box({ x: 305, y: 100, w: 220, h: 64, t: 'shared DeepBook market', sub: 'price-time matching', c: 'hot' });
      s += box({ x: 615, y: 38, w: 190, h: 64, t: 'eligible asks', sub: 'price ≤ limit', c: 'acc' });
      s += box({ x: 615, y: 190, w: 190, h: 64, t: 'filled output + change', sub: 'owned objects', c: 'ok' });
      s += arr(215, 132, 305, 132, 'ok', 'PTB input') + arr(525, 132, 615, 70, 'hot', 'match') + arr(710, 102, 710, 190, 'acc', 'settle');
      s += note(35, 30, 'LIMIT PRICE AND MINIMUM OUTPUT BELONG IN THE SIGNED TRANSACTION');
      return s;
    })());

  /* =========================================================
     HOME — the whole roadmap on one line
     ========================================================= */

  function homeSvg() {
    var mods = (global.ROADMAP && global.ROADMAP.modules) || [];
    var w = 900, h = 250;
    var s = txt(20, 26, 'THE ROUTE', 'd-k');
    var bw = 112, gap = 12, x0 = 20, y = 56;
    var body = '';
    mods.forEach(function (m, i) {
      var x = x0 + i * (bw + gap);
      body += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="72" rx="3" class="d-box" ' +
        'style="stroke:' + m.color + ';fill:color-mix(in srgb, ' + m.color + ' 14%, transparent)"/>';
      body += mid(x + bw / 2, y + 30, 'MODULE ' + m.id, 'd-k');
      body += mid(x + bw / 2, y + 50, m.name.split(' ')[0].replace(/[^A-Za-z0-9]+$/, ''), 'd-t');
      if (i < mods.length - 1) body += arr(x + bw, y + 36, x + bw + gap, y + 36, 'acc');
      // drop line to a one-word outcome
      var labels = ['hash · sign · prove', 'UTXO · PoW · PoS', 'EVM · gas · ERC', 'test · deploy · ship', 'exploit · defend', 'AMM · rollup · ZK', 'objects · Move · PTB'];
      body += line(x + bw / 2, y + 72, x + bw / 2, y + 96 + (i % 2) * 22, 'thin dash');
      body += mid(x + bw / 2, y + 112 + (i % 2) * 22, labels[i], 'd-m');
    });
    s += body;
    s += line(20, 212, 880, 212, 'thin');
    s += txt(20, 236, 'BEGINNER', 'd-k') + txt(760, 236, 'PRODUCTION-READY', 'd-k');
    s += arr(140, 212, 740, 212, 'hot');
    return svg(w, h, s);
  }

  /* ============================================================
     animation

     Diagrams draw themselves when they scroll into view: boxes
     pop, lines draw along their own length, then heads and
     labels fade in. Once a diagram has finished drawing it keeps
     a little ambient motion — marching dashes on flow arrows and
     a pulse travelling down the busiest wires.

     Everything is CSS transitions driven by two classes on the
     <svg> (.run, .flow), so the browser animates on the compositor
     and prefers-reduced-motion switches the whole thing off.
     ============================================================ */

  var reduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var io = null;

  function len(e) {
    try { return e.getTotalLength(); } catch (err) { return 0; }
  }

  /* next frame if the page is visible, next task if it is not: rAF never
     fires in a hidden tab, and a diagram must not be left mid-reset. */
  function soon(fn) {
    var done = false;
    function go() { if (done) return; done = true; fn(); }
    if (global.requestAnimationFrame) global.requestAnimationFrame(go);
    setTimeout(go, 40);
  }

  /* travelling pulse: a clone of the line wearing a short dash that
     marches from one end to the other. Capped per diagram, longest
     accent arrows first, so it reads as emphasis and not as noise. */
  function sparks(sv) {
    var cand = [];
    sv.querySelectorAll('.d-line.acc, .d-line.hot').forEach(function (e) {
      if (e.classList.contains('dash') || e.classList.contains('thin')) return;
      var L = len(e);
      if (L > 70) cand.push({ e: e, L: L });
    });
    cand.sort(function (a, b) { return b.L - a.L; });
    cand.slice(0, 3).forEach(function (c) {
      var s = c.e.cloneNode(false);
      s.removeAttribute('style');
      s.setAttribute('class', 'd-spark' + (c.e.classList.contains('hot') ? ' hot' : ''));
      s.style.setProperty('--len', c.L);
      s.style.strokeDasharray = '10 ' + n(c.L - 10);
      s.style.animationDuration = Math.max(3.2, c.L / 70) + 's';
      sv.appendChild(s);
    });
  }

  /* one pass over the diagram: tag every element with how it enters
     and when. Runs once per <svg>; the result is cached on the node. */
  function prepare(sv) {
    if (sv.__prepped) return;
    sv.__prepped = true;
    sv.classList.add('anim');

    var last = 0, bi = 0, li = 0, hi = 0, ti = 0;
    sv.querySelectorAll('.d-box, .d-line, .d-head, text').forEach(function (e) {
      var d;
      if (e.classList.contains('d-box')) {
        d = Math.min(bi++ * 46, 820);
        e.classList.add('a-pop');
      } else if (e.classList.contains('d-head')) {
        d = 1250 + Math.min(hi++ * 44, 1100);
        e.classList.add('a-fade');
      } else if (e.tagName === 'text') {
        d = 1050 + Math.min(ti++ * 26, 1200);
        e.classList.add('a-fade');
      } else {
        d = 420 + Math.min(li++ * 48, 1150);
        var L = e.classList.contains('dash') ? 0 : len(e);
        if (L > 0.5) {
          e.classList.add('a-draw');
          e.dataset.len = L;
          e.style.strokeDasharray = L;
          e.style.strokeDashoffset = L;
        } else {
          e.classList.add('a-fade');   /* dashed lines fade rather than draw:
                                          drawing them would flash solid first */
        }
      }
      e.style.transitionDelay = d + 'ms';
      if (d > last) last = d;
    });

    sv.__total = last + 1300;   /* must outlast the slowest transition above */
    sparks(sv);
  }

  function run(sv) {
    sv.classList.add('run');
    sv.querySelectorAll('.a-draw').forEach(function (e) { e.style.strokeDashoffset = '0'; });
    clearTimeout(sv.__t);
    sv.__t = setTimeout(function () {
      /* hand the strokes back to the stylesheet so .dash patterns return */
      sv.querySelectorAll('.a-draw').forEach(function (e) {
        e.style.strokeDasharray = '';
        e.style.strokeDashoffset = '';
      });
      sv.classList.add('flow');
    }, sv.__total);
  }

  /* snap back to the pre-draw state. .noanim kills transitions while we do
     it, otherwise the browser sees 1 -> 0 -> 1 in one frame and reverses the
     transition instead of restarting it, which makes replay look like nothing
     happened. */
  function reset(sv) {
    clearTimeout(sv.__t);
    sv.classList.add('noanim');
    sv.classList.remove('run', 'flow');
    sv.querySelectorAll('.a-draw').forEach(function (e) {
      e.style.strokeDasharray = e.dataset.len;
      e.style.strokeDashoffset = e.dataset.len;
    });
    void sv.getBoundingClientRect();   /* flush the reset before .run returns */
  }

  function onView(entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      run(en.target);
    });
  }

  /* called by the app after a diagram panel is in the document */
  function animate(root) {
    var svgs = (root || document).querySelectorAll('svg.dia');
    if (!svgs.length) return;
    if (reduce) return;                       /* leave every diagram static */
    if (!global.IntersectionObserver) {
      svgs.forEach(function (sv) { prepare(sv); run(sv); });
      return;
    }
    if (io) io.disconnect(); else io = new global.IntersectionObserver(onView, { threshold: 0.12 });
    svgs.forEach(function (sv) { prepare(sv); io.observe(sv); });
  }

  function replay(sv) {
    if (!sv || reduce) return;
    prepare(sv);
    reset(sv);
    soon(function () {
      sv.classList.remove('noanim');
      run(sv);
    });
  }

  /* ---------- export ---------- */

  global.DIA = {
    get: function (id) { return D[id] || []; },
    home: function () { return { title: 'Six modules, one path', cap: 'Each module assumes the one before it. The labs get harder in exactly the same order.', svg: homeSvg() }; },
    count: function () { var t = 0; for (var k in D) if (Object.prototype.hasOwnProperty.call(D, k)) t += D[k].length; return t; },
    ids: function () { return Object.keys(D); },
    animate: animate,
    replay: replay,
    reduced: function () { return reduce; },
    /* the drawing kit, exported so labs can draw too */
    kit: { svg: svg, box: box, arr: arr, line: line, elb: elb, elbV: elbV, cur: cur, txt: txt, mid: mid, flow: flow, dot: dot, diamond: diamond, cyl: cyl, life: life, note: note, poly: poly }
  };
})(window);
