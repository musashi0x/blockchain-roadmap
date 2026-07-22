/* ============================================================
   crypto-lite.js — the real primitives, written from scratch.

   Why not window.crypto.subtle?  Because pages opened from
   file:// are not a "secure context" in Chrome, so subtle is
   undefined there. Everything below is plain JS + BigInt, so
   every lab in this course runs by double-clicking index.html.

   Exports (window.CL):
     sha256(bytes) -> Uint8Array      FIPS 180-4
     sha256Hex(str|bytes) -> hex
     dsha256(bytes)                   Bitcoin's double SHA-256
     keccak256(bytes) -> Uint8Array   Ethereum's hash (NOT SHA3-256)
     keccak256Hex(str|bytes)
     secp256k1.{genKey, pub, sign, verify, ...}
     ethAddress(pubkeyBytes) -> 0x...
     hex / bytes / utf8 helpers
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- byte helpers ---------------- */

  const HEXC = '0123456789abcdef';

  function utf8ToBytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.codePointAt(i);
      if (c > 0xffff) i++;                       // surrogate pair consumed
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function bytesToHex(b) {
    let s = '';
    for (let i = 0; i < b.length; i++) s += HEXC[b[i] >> 4] + HEXC[b[i] & 15];
    return s;
  }

  function hexToBytes(hex) {
    hex = String(hex).replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
    if (hex.length % 2) hex = '0' + hex;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function toBytes(x) {
    if (x instanceof Uint8Array) return x;
    if (Array.isArray(x)) return new Uint8Array(x);
    return utf8ToBytes(String(x));
  }

  function concat() {
    const parts = [].slice.call(arguments).map(toBytes);
    const len = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  function randomBytes(n) {
    const b = new Uint8Array(n);
    // getRandomValues works in non-secure contexts (unlike crypto.subtle)
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(b);
    else for (let i = 0; i < n; i++) b[i] = (Math.random() * 256) | 0;
    return b;
  }

  function bytesToBig(b) {
    let x = 0n;
    for (let i = 0; i < b.length; i++) x = (x << 8n) | BigInt(b[i]);
    return x;
  }

  function bigToBytes(x, len) {
    const out = new Uint8Array(len);
    for (let i = len - 1; i >= 0; i--) { out[i] = Number(x & 0xffn); x >>= 8n; }
    return out;
  }

  function bigToHex(x, len) { return bytesToHex(bigToBytes(x, len || 32)); }

  /* ---------------- SHA-256 (FIPS 180-4) ---------------- */

  const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(input) {
    const msg = toBytes(input);
    const bitLen = msg.length * 8;
    const withPad = new Uint8Array((((msg.length + 9) >> 6) + 1) << 6);
    withPad.set(msg);
    withPad[msg.length] = 0x80;
    // 64-bit big-endian length (we only fill the low 32 bits; plenty for a browser)
    new DataView(withPad.buffer).setUint32(withPad.length - 4, bitLen >>> 0, false);
    new DataView(withPad.buffer).setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    const w = new Uint32Array(64);
    const view = new DataView(withPad.buffer);

    for (let off = 0; off < withPad.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => ov.setUint32(i * 4, v, false));
    return out;
  }

  const sha256Hex = (x) => bytesToHex(sha256(x));
  const dsha256 = (x) => sha256(sha256(x));
  const dsha256Hex = (x) => bytesToHex(dsha256(x));

  /* ---------------- Keccak-256 (what Ethereum calls sha3) ---------------- */

  const M64 = (1n << 64n) - 1n;

  const KECCAK_RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
  ];

  const KECCAK_ROT = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14]
  ];

  function rotl64(x, n) {
    n = BigInt(n) % 64n;
    if (n === 0n) return x & M64;
    return ((x << n) | (x >> (64n - n))) & M64;
  }

  function keccakF(A) {
    for (let round = 0; round < 24; round++) {
      const C = new Array(5), D = new Array(5);
      for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
      for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D[x];

      const B = new Array(25).fill(0n);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(A[x + 5 * y], KECCAK_ROT[x][y]);
      }
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
        A[x + 5 * y] = B[x + 5 * y] ^ ((~B[((x + 1) % 5) + 5 * y] & M64) & B[((x + 2) % 5) + 5 * y]);
      }
      A[0] ^= KECCAK_RC[round];
    }
    return A;
  }

  function keccak256(input) {
    const msg = toBytes(input);
    const rate = 136;                       // 1088 bits for keccak-256
    const padLen = rate - (msg.length % rate);
    const buf = new Uint8Array(msg.length + padLen);
    buf.set(msg);
    buf[msg.length] = 0x01;                 // original Keccak padding, not SHA3's 0x06
    buf[buf.length - 1] |= 0x80;

    let A = new Array(25).fill(0n);
    for (let off = 0; off < buf.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) {
        let lane = 0n;
        for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(buf[off + i * 8 + b]);
        A[i] ^= lane;
      }
      A = keccakF(A);
    }

    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
      for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((A[i] >> BigInt(8 * b)) & 0xffn);
    }
    return out;
  }

  const keccak256Hex = (x) => bytesToHex(keccak256(x));

  /* ---------------- secp256k1 (Bitcoin + Ethereum curve) ---------------- */

  const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
  const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
  const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

  const mod = (a, m) => ((a % m) + m) % m;

  function invMod(a, m) {
    let [old_r, r] = [mod(a, m), m];
    let [old_s, s] = [1n, 0n];
    while (r !== 0n) {
      const q = old_r / r;
      [old_r, r] = [r, old_r - q * r];
      [old_s, s] = [s, old_s - q * s];
    }
    return mod(old_s, m);
  }

  const INF = null;   // point at infinity

  function ptAdd(p1, p2) {
    if (p1 === INF) return p2;
    if (p2 === INF) return p1;
    const [x1, y1] = p1, [x2, y2] = p2;
    if (x1 === x2 && mod(y1 + y2, P) === 0n) return INF;
    let lam;
    if (x1 === x2 && y1 === y2) lam = mod(3n * x1 * x1 * invMod(2n * y1, P), P);
    else lam = mod((y2 - y1) * invMod(mod(x2 - x1, P), P), P);
    const x3 = mod(lam * lam - x1 - x2, P);
    const y3 = mod(lam * (x1 - x3) - y1, P);
    return [x3, y3];
  }

  function ptMul(k, p) {
    let r = INF, add = p;
    k = mod(k, N);
    while (k > 0n) {
      if (k & 1n) r = ptAdd(r, add);
      add = ptAdd(add, add);
      k >>= 1n;
    }
    return r;
  }

  const G = [Gx, Gy];

  function genPrivKey() {
    let d;
    do { d = bytesToBig(randomBytes(32)); } while (d === 0n || d >= N);
    return d;
  }

  function pubKey(d) { return ptMul(d, G); }

  /** 65-byte uncompressed encoding: 0x04 || X || Y */
  function pubUncompressed(pt) { return concat([0x04], bigToBytes(pt[0], 32), bigToBytes(pt[1], 32)); }

  /** 33-byte compressed encoding: 0x02/0x03 || X  (y parity is enough to recover Y) */
  function pubCompressed(pt) { return concat([pt[1] % 2n === 0n ? 0x02 : 0x03], bigToBytes(pt[0], 32)); }

  /** deterministic nonce (RFC 6979 in spirit — reusing k across signatures leaks the key) */
  function nonce(d, z) {
    let k = bytesToBig(sha256(concat(bigToBytes(d, 32), bigToBytes(z, 32), utf8ToBytes('roadmap-k'))));
    k = mod(k, N);
    return k === 0n ? 1n : k;
  }

  function sign(d, msgBytes) {
    const z = bytesToBig(sha256(msgBytes));
    let r = 0n, s = 0n, k = nonce(d, z), guard = 0;
    while (guard++ < 64) {
      const Rp = ptMul(k, G);
      r = mod(Rp[0], N);
      if (r !== 0n) {
        s = mod(invMod(k, N) * (z + r * d), N);
        if (s !== 0n) {
          if (s > N / 2n) s = N - s;         // low-s, as Bitcoin/Ethereum require
          return { r, s };
        }
      }
      k = mod(k + 1n, N);
    }
    throw new Error('signing failed');
  }

  function verify(pt, msgBytes, sig) {
    const { r, s } = sig;
    if (r <= 0n || r >= N || s <= 0n || s >= N) return false;
    const z = bytesToBig(sha256(msgBytes));
    const sInv = invMod(s, N);
    const u1 = mod(z * sInv, N);
    const u2 = mod(r * sInv, N);
    const Rp = ptAdd(ptMul(u1, G), ptMul(u2, pt));
    if (Rp === INF) return false;
    return mod(Rp[0], N) === r;
  }

  /** Ethereum address = last 20 bytes of keccak256(uncompressed pubkey WITHOUT the 0x04 prefix) */
  function ethAddress(pt) {
    const raw = concat(bigToBytes(pt[0], 32), bigToBytes(pt[1], 32));
    const h = keccak256(raw);
    return '0x' + bytesToHex(h.slice(12));
  }

  /** EIP-55 mixed-case checksum encoding of an address */
  function toChecksumAddress(addr) {
    const lower = addr.toLowerCase().replace(/^0x/, '');
    const hash = bytesToHex(keccak256(utf8ToBytes(lower)));
    let out = '0x';
    for (let i = 0; i < lower.length; i++) {
      out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
    }
    return out;
  }

  /* ---------------- self-test (run CL.selfTest() in the console) ---------------- */

  function selfTest() {
    const results = [];
    const t = (name, got, want) => results.push({ name, ok: got === want, got, want });

    t('sha256("")', sha256Hex(''),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    t('sha256("abc")', sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    t('keccak256("")', keccak256Hex(''),
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    t('keccak256("abc")', keccak256Hex('abc'),
      '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');

    // known Ethereum key -> address vector
    const d = 0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318n;
    t('ethAddress(known key)', ethAddress(pubKey(d)).toLowerCase(),
      '0x2c7536e3605d9c16a7a3d7b1898e529396a65c23');

    // sign / verify round trip
    const k = genPrivKey(), Q = pubKey(k), msg = utf8ToBytes('gm');
    const sig = sign(k, msg);
    t('verify(valid)', verify(Q, msg, sig), true);
    t('verify(tampered)', verify(Q, utf8ToBytes('gn'), sig), false);

    const pass = results.every(r => r.ok);
    console.log('%ccrypto-lite self-test: ' + (pass ? 'ALL PASS' : 'FAILURES'),
      'color:' + (pass ? '#34d399' : '#f87171'));
    console.table(results);
    return pass;
  }

  /* ---------------- export ---------------- */

  global.CL = {
    utf8ToBytes, bytesToHex, hexToBytes, toBytes, concat, randomBytes,
    bytesToBig, bigToBytes, bigToHex,
    sha256, sha256Hex, dsha256, dsha256Hex,
    keccak256, keccak256Hex,
    secp256k1: {
      P, N, G, mod, invMod, ptAdd, ptMul,
      genPrivKey, pubKey, pubUncompressed, pubCompressed, sign, verify
    },
    ethAddress, toChecksumAddress,
    selfTest
  };
})(window);
