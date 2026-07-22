/* ============================================================
   playground.js — every interactive lab in the roadmap.

   window.LABS[key] = { title, desc, mount(element) }
   app.js looks up lesson.lab and calls mount() on a container
   that already carries the .lab panel styling.

   No dependencies beyond window.CL (js/lib/crypto-lite.js).
   ============================================================ */
(function (global) {
  'use strict';

  const CL = global.CL;
  const LABS = {};
  function reg(key, title, desc, mount) { LABS[key] = { title: title, desc: desc, mount: mount }; }

  /* ---------------- tiny DOM + format helpers ---------------- */

  const $ = (r, s) => r.querySelector(s);
  const $$ = (r, s) => Array.from(r.querySelectorAll(s));

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function short(hex, n) {
    hex = String(hex);
    n = n || 8;
    return hex.length <= n * 2 + 3 ? hex : hex.slice(0, n) + '…' + hex.slice(-n);
  }
  function num(n, d) {
    if (!isFinite(n)) return '∞';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: d === undefined ? 0 : d,
      maximumFractionDigits: d === undefined ? 2 : d
    });
  }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 2 : d) + '%'; }

  // deterministic PRNG so lab runs are reproducible from a seed
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pad32Hex(x) {
    const s = (typeof x === 'bigint' ? x.toString(16) : String(x).replace(/^0x/i, ''));
    return s.padStart(64, '0');
  }

  // minimal RLP for [address, nonce] — all we need for CREATE addresses
  function rlpAddrNonce(addrHex, nonce) {
    const addr = CL.hexToBytes(addrHex);
    const encAddr = CL.concat([0x80 + addr.length], addr);
    let encNonce;
    if (nonce === 0) encNonce = new Uint8Array([0x80]);
    else if (nonce < 0x80) encNonce = new Uint8Array([nonce]);
    else {
      let h = nonce.toString(16); if (h.length % 2) h = '0' + h;
      const b = CL.hexToBytes(h);
      encNonce = CL.concat([0x80 + b.length], b);
    }
    const payload = CL.concat(encAddr, encNonce);
    return CL.concat([0xc0 + payload.length], payload);
  }

  const ADDRS = {
    alice: '0xA11CE00000000000000000000000000000000001',
    bob: '0xB0B0000000000000000000000000000000000002',
    carol: '0xCa401000000000000000000000000000000000003'.slice(0, 42)
  };

  /* ============================================================
     MODULE 1
     ============================================================ */

  /* ---------- ledger ---------- */
  reg('ledger', 'Distributed ledger vs one database',
    'Five nodes each keep a full copy. Add entries, corrupt one node, then let the network compare hashes. Nobody is in charge — the majority simply wins.',
    function (el) {
      const NODES = 5;
      let entries = [
        { from: 'Alice', to: 'Bob', amt: 50 },
        { from: 'Bob', to: 'Carol', amt: 20 }
      ];
      let copies = [];
      function resync() { copies = Array.from({ length: NODES }, () => entries.map(e => Object.assign({}, e))); }
      resync();

      el.innerHTML = `
        <div class="row">
          <div class="field"><label>From</label><input type="text" id="lg-from" value="Carol"></div>
          <div class="field"><label>To</label><input type="text" id="lg-to" value="Dave"></div>
          <div class="field"><label>Amount</label><input type="number" id="lg-amt" value="15"></div>
          <div class="field shrink"><button class="btn primary" id="lg-add">Broadcast entry</button></div>
        </div>
        <div class="row" style="margin-bottom:14px">
          <div class="field shrink"><button class="btn ghost sm" id="lg-tamper">Corrupt node 3</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="lg-check">Run consensus check</button></div>
        </div>
        <div id="lg-nodes"></div>
        <div class="out" id="lg-log">Ledger replicated across ${NODES} nodes.</div>`;

      function ledgerHash(list) {
        return CL.sha256Hex(list.map(e => e.from + '>' + e.to + ':' + e.amt).join('|'));
      }

      function render() {
        const hashes = copies.map(ledgerHash);
        const tally = {};
        hashes.forEach(h => tally[h] = (tally[h] || 0) + 1);
        const majority = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];

        $(el, '#lg-nodes').innerHTML = '<div class="chain-flow">' + copies.map((c, i) => {
          const h = hashes[i];
          const ok = h === majority;
          return `<div class="block-card ${ok ? 'valid' : 'invalid'}">
            <h4>Node ${i + 1} <span class="badge ${ok ? 'ok' : 'no'}">${ok ? 'in sync' : 'divergent'}</span></h4>
            ${c.map(e => `<div>${esc(e.from)} → ${esc(e.to)}: ${e.amt}</div>`).join('')}
            <div class="dim" style="margin-top:6px">root <span class="hash">${short(h, 6)}</span></div>
          </div>`;
        }).join('') + '</div>';
        return { hashes, tally, majority };
      }
      render();

      $(el, '#lg-add').onclick = () => {
        const e = {
          from: $(el, '#lg-from').value || 'X',
          to: $(el, '#lg-to').value || 'Y',
          amt: Number($(el, '#lg-amt').value) || 0
        };
        entries.push(e);
        copies.forEach(c => c.push(Object.assign({}, e)));
        $(el, '#lg-log').innerHTML = `Entry broadcast to all ${NODES} nodes. Every copy still agrees.`;
        render();
      };

      $(el, '#lg-tamper').onclick = () => {
        if (!copies[2].length) return;
        copies[2][0].amt = 999999;
        $(el, '#lg-log').innerHTML =
          '<span class="bad">Node 3 rewrote entry 1 to 999999.</span> Its ledger hash no longer matches the others. ' +
          'In a single-database system this edit would be the new truth.';
        render();
      };

      $(el, '#lg-check').onclick = () => {
        const { tally, majority } = render();
        const agree = tally[majority];
        const bad = copies.map((c, i) => ledgerHash(c) === majority ? -1 : i + 1).filter(i => i > 0);
        if (!bad.length) {
          $(el, '#lg-log').innerHTML = `<span class="good">Consensus: ${agree}/${NODES} nodes agree on root <span class="hash">${short(majority, 8)}</span>.</span>`;
        } else {
          copies = copies.map((c, i) => bad.indexOf(i + 1) >= 0 ? entries.map(e => Object.assign({}, e)) : c);
          $(el, '#lg-log').innerHTML =
            `<span class="good">Consensus: ${agree}/${NODES} nodes agree.</span> Node(s) ${bad.join(', ')} rejected and re-synced from the majority.\n` +
            'No administrator intervened. Rewriting history requires controlling most of the network, not one machine.';
          render();
        }
      };
    });

  /* ---------- hash ---------- */
  reg('hash', 'Hash function explorer',
    'Type anything. Watch determinism, the avalanche effect and the fact that a one-bit change produces a completely unrelated output.',
    function (el) {
      el.innerHTML = `
        <div class="field"><label>Input</label>
          <textarea id="h-in">blockchain</textarea></div>
        <div class="row" style="margin-bottom:14px">
          <div class="field shrink"><button class="btn ghost sm" id="h-flip">Change one character</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="h-rand">Random input</button></div>
        </div>
        <dl class="kv" id="h-out"></dl>
        <div class="out" id="h-ava" style="margin-top:14px"></div>`;

      let prev = null;
      function bitsDiff(a, b) {
        const A = CL.hexToBytes(a), B = CL.hexToBytes(b);
        let d = 0;
        for (let i = 0; i < A.length; i++) {
          let x = A[i] ^ B[i];
          while (x) { d += x & 1; x >>= 1; }
        }
        return d;
      }

      function run() {
        const s = $(el, '#h-in').value;
        const sha = CL.sha256Hex(s);
        const kec = CL.keccak256Hex(s);
        const dbl = CL.dsha256Hex(s);

        $(el, '#h-out').innerHTML = `
          <dt>bytes in</dt><dd>${CL.utf8ToBytes(s).length}</dd>
          <dt>SHA-256</dt><dd class="hash">${sha}</dd>
          <dt>Keccak-256</dt><dd class="hash">${kec}</dd>
          <dt>SHA-256d</dt><dd class="hash">${dbl}</dd>`;

        let msg = 'Same input always gives the same output. Different input gives an output with no visible relationship to the last one.';
        if (prev && prev.sha !== sha) {
          const d = bitsDiff(prev.sha, sha);
          msg = `Previous input: "${esc(short(prev.s, 18))}"\n` +
            `Previous digest: ${prev.sha}\n` +
            `Current  digest: ${sha}\n\n` +
            `Bits changed: ${d} of 256 (${pct(d / 256, 1)}) — ` +
            (d > 100 && d < 156
              ? '<span class="good">textbook avalanche: about half the bits flip regardless of how small the input change was.</span>'
              : 'still statistically unrelated to the input change.');
        }
        $(el, '#h-ava').innerHTML = msg;
        prev = { s: s, sha: sha };
      }

      $(el, '#h-in').addEventListener('input', run);
      $(el, '#h-flip').onclick = () => {
        const t = $(el, '#h-in');
        const v = t.value || 'a';
        const i = Math.floor(Math.random() * v.length);
        const c = v[i];
        const nc = c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
        t.value = v.slice(0, i) + (nc === c ? String.fromCharCode(c.charCodeAt(0) + 1) : nc) + v.slice(i + 1);
        run();
      };
      $(el, '#h-rand').onclick = () => {
        $(el, '#h-in').value = CL.bytesToHex(CL.randomBytes(8));
        run();
      };
      run();
    });

  /* ---------- keys ---------- */
  reg('keys', 'Keys, signatures and an Ethereum address',
    'Generate a real secp256k1 keypair, derive the address exactly as Ethereum does, sign a message and verify it. Then tamper with the message and watch verification fail.',
    function (el) {
      el.innerHTML = `
        <div class="row" style="margin-bottom:12px">
          <div class="field shrink"><button class="btn primary" id="k-gen">Generate keypair</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="k-sign">Sign message</button></div>
        </div>
        <dl class="kv" id="k-out"><dt>status</dt><dd class="dim">no key yet</dd></dl>
        <div class="field" style="margin-top:14px"><label>Message</label>
          <input type="text" id="k-msg" value="I authorise this transfer"></div>
        <div class="out" id="k-log">secp256k1 over a 256-bit field. The private key is a number; everything else is derived from it.</div>`;

      let key = null, sig = null, signed = null;

      function derive() {
        const d = key;
        const pt = CL.secp256k1.pubKey(d);
        const addr = CL.toChecksumAddress(CL.ethAddress(pt));
        $(el, '#k-out').innerHTML = `
          <dt>private key</dt><dd class="bad">0x${CL.bigToHex(d, 32)}</dd>
          <dt>public key X</dt><dd>${CL.bigToHex(pt[0], 32)}</dd>
          <dt>public key Y</dt><dd>${CL.bigToHex(pt[1], 32)}</dd>
          <dt>compressed</dt><dd class="hash">0x${CL.bytesToHex(CL.secp256k1.pubCompressed(pt))}</dd>
          <dt>address</dt><dd class="hash">${addr}</dd>`;
        return pt;
      }

      $(el, '#k-gen').onclick = () => {
        key = CL.secp256k1.genPrivKey();
        sig = null; signed = null;
        derive();
        $(el, '#k-log').innerHTML =
          'address = last 20 bytes of keccak256(public key without the 0x04 prefix), then EIP-55 mixed-case checksum.\n' +
          '<span class="bad">Never paste a real private key anywhere. This one is generated locally and never leaves the page.</span>';
      };

      $(el, '#k-sign').onclick = () => {
        if (!key) { $(el, '#k-log').innerHTML = '<span class="bad">Generate a keypair first.</span>'; return; }
        signed = $(el, '#k-msg').value;
        const msg = CL.sha256(signed);
        sig = CL.secp256k1.sign(key, msg);
        check();
      };

      function check() {
        if (!sig) return;
        const pt = CL.secp256k1.pubKey(key);
        const current = $(el, '#k-msg').value;
        const ok = CL.secp256k1.verify(pt, CL.sha256(current), sig);
        $(el, '#k-log').innerHTML =
          `signed message : "${esc(signed)}"\n` +
          `current message: "${esc(current)}"\n\n` +
          `r = ${CL.bigToHex(sig.r, 32)}\n` +
          `s = ${CL.bigToHex(sig.s, 32)}   <span class="dim">(low-s normalised, EIP-2)</span>\n\n` +
          (ok
            ? '<span class="good">VALID — the signature proves the holder of that private key signed exactly this message.</span>'
            : '<span class="bad">INVALID — the message changed. A signature commits to one exact byte string; edit anything and it is worthless.</span>');
      }
      $(el, '#k-msg').addEventListener('input', check);
    });

  /* ---------- merkle ---------- */
  reg('merkle', 'Merkle tree and inclusion proof',
    'Build a tree from a list, then pick one leaf and get the proof. A light client verifies membership from log2(n) hashes instead of the whole dataset.',
    function (el) {
      el.innerHTML = `
        <div class="field"><label>Leaves (one per line)</label>
          <textarea id="m-in" style="min-height:96px">tx: alice -> bob 10
tx: bob -> carol 4
tx: carol -> dave 7
tx: dave -> erin 2
tx: erin -> frank 9</textarea></div>
        <div class="row" style="margin-bottom:14px">
          <div class="field"><label>Prove leaf</label><select id="m-sel"></select></div>
          <div class="field shrink"><button class="btn primary" id="m-go">Build + prove</button></div>
        </div>
        <div class="tree" id="m-tree"></div>
        <div class="out" id="m-log" style="margin-top:14px"></div>`;

      function leaves() {
        return $(el, '#m-in').value.split('\n').map(s => s.trim()).filter(Boolean);
      }
      function build(items) {
        // leaf domain separation: prefix 0x00 so a leaf can never be read as a node
        let level = items.map(x => CL.sha256Hex(CL.concat([0x00], CL.utf8ToBytes(x))));
        const levels = [level];
        while (level.length > 1) {
          const next = [];
          for (let i = 0; i < level.length; i += 2) {
            const a = level[i];
            const b = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate odd tail
            next.push(CL.sha256Hex(CL.concat([0x01], CL.hexToBytes(a), CL.hexToBytes(b))));
          }
          levels.push(next);
          level = next;
        }
        return levels;
      }
      function proofFor(levels, index) {
        const proof = [];
        let idx = index;
        for (let L = 0; L < levels.length - 1; L++) {
          const lvl = levels[L];
          const isRight = idx % 2 === 1;
          const sib = isRight ? idx - 1 : (idx + 1 < lvl.length ? idx + 1 : idx);
          proof.push({ hash: lvl[sib], right: !isRight });
          idx = Math.floor(idx / 2);
        }
        return proof;
      }

      function syncSelect() {
        const items = leaves();
        const sel = $(el, '#m-sel');
        const keep = sel.value;
        sel.innerHTML = items.map((s, i) => `<option value="${i}">${i}: ${esc(short(s, 14))}</option>`).join('');
        if (keep && keep < items.length) sel.value = keep;
      }
      $(el, '#m-in').addEventListener('input', syncSelect);
      syncSelect();

      $(el, '#m-go').onclick = () => {
        const items = leaves();
        if (!items.length) { $(el, '#m-log').textContent = 'Add at least one leaf.'; return; }
        const levels = build(items);
        const idx = Math.min(Number($(el, '#m-sel').value) || 0, items.length - 1);
        const proof = proofFor(levels, idx);

        // mark which nodes are on the path so the tree render can highlight them
        const onPath = levels.map(() => new Set());
        let p = idx;
        for (let L = 0; L < levels.length; L++) { onPath[L].add(p); p = Math.floor(p / 2); }

        $(el, '#m-tree').innerHTML = levels.slice().reverse().map((lvl, ri) => {
          const L = levels.length - 1 - ri;
          return '<div class="tree-level">' + lvl.map((h, i) => {
            let cls = 'node';
            if (L === levels.length - 1) cls += ' root';
            else if (L === 0 && i === idx) cls += ' leaf-sel';
            else if (onPath[L].has(i)) cls += ' leaf-sel';
            else if (proof.some(pr => pr.hash === h)) cls += ' path';
            return `<span class="${cls}" title="${h}">${short(h, 5)}</span>`;
          }).join('') + '</div>';
        }).join('');

        // verify the proof the way a light client would
        let computed = CL.sha256Hex(CL.concat([0x00], CL.utf8ToBytes(items[idx])));
        const steps = ['leaf   ' + computed];
        proof.forEach((pr, i) => {
          computed = pr.right
            ? CL.sha256Hex(CL.concat([0x01], CL.hexToBytes(computed), CL.hexToBytes(pr.hash)))
            : CL.sha256Hex(CL.concat([0x01], CL.hexToBytes(pr.hash), CL.hexToBytes(computed)));
          steps.push(`step ${i + 1} + ${pr.right ? 'right' : 'left '} sibling ${short(pr.hash, 6)} = ${computed}`);
        });
        const root = levels[levels.length - 1][0];
        const ok = computed === root;

        $(el, '#m-log').innerHTML =
          `leaves: ${items.length}   tree height: ${levels.length - 1}   proof size: ${proof.length} hashes\n\n` +
          steps.map(esc).join('\n') + '\n\n' +
          `root (on chain): <span class="hash">${root}</span>\n` +
          (ok ? '<span class="good">PROOF VALID</span> — ' : '<span class="bad">PROOF INVALID</span> — ') +
          `verified membership in a ${items.length}-item set using ${proof.length} hashes instead of all ${items.length}. ` +
          `A million items would need only ${Math.ceil(Math.log2(1e6))}.`;
      };
      $(el, '#m-go').click();
    });

  /* ---------- chain ---------- */
  reg('chain', 'Tamper-evident chain',
    'Each block commits to the previous one. Edit any block’s data and every block after it breaks at once — that is the whole security argument.',
    function (el) {
      const DIFF = '00';
      let blocks = [];

      function mine(b) {
        b.nonce = 0;
        for (;;) {
          b.hash = hashOf(b);
          if (b.hash.startsWith(DIFF)) return;
          b.nonce++;
        }
      }
      function hashOf(b) {
        return CL.sha256Hex(b.index + '|' + b.data + '|' + b.prev + '|' + b.nonce);
      }
      function rebuild() {
        blocks = [
          { index: 0, data: 'genesis', prev: '0'.repeat(64) },
          { index: 1, data: 'alice -> bob 10', prev: '' },
          { index: 2, data: 'bob -> carol 4', prev: '' },
          { index: 3, data: 'carol -> dave 7', prev: '' }
        ];
        blocks.forEach((b, i) => { if (i) b.prev = blocks[i - 1].hash; mine(b); });
      }
      rebuild();

      el.innerHTML = `
        <div class="row" style="margin-bottom:14px">
          <div class="field shrink"><button class="btn ghost sm" id="c-reset">Rebuild valid chain</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="c-remine">Re-mine everything</button></div>
        </div>
        <div id="c-blocks"></div>
        <div class="out" id="c-log"></div>`;

      function render() {
        const html = blocks.map((b, i) => {
          const linkOK = i === 0 || b.prev === blocks[i - 1].hash;
          const powOK = hashOf(b).startsWith(DIFF);
          const ok = linkOK && powOK;
          return `<div class="block-card ${ok ? 'valid' : 'invalid'}">
            <h4>Block ${b.index} <span class="badge ${ok ? 'ok' : 'no'}">${ok ? 'valid' : 'broken'}</span></h4>
            <div class="field" style="margin:6px 0"><label>data</label>
              <input type="text" data-i="${i}" class="c-data" value="${esc(b.data)}"></div>
            <div class="dim">prev <span class="hash">${short(b.prev, 6)}</span></div>
            <div class="dim">nonce ${b.nonce}</div>
            <div>hash <span class="${powOK ? 'hash' : 'bad'}">${short(hashOf(b), 6)}</span></div>
            ${ok ? '' : `<button class="btn ghost sm" data-mine="${i}" style="margin-top:8px">Re-mine this block</button>`}
          </div>`;
        }).join('');
        $(el, '#c-blocks').innerHTML = '<div class="chain-flow">' + html + '</div>';

        const firstBad = blocks.findIndex((b, i) =>
          !hashOf(b).startsWith(DIFF) || (i > 0 && b.prev !== blocks[i - 1].hash));
        $(el, '#c-log').innerHTML = firstBad < 0
          ? '<span class="good">Chain valid.</span> Every hash meets the difficulty target and every prev pointer matches.'
          : `<span class="bad">Chain breaks at block ${firstBad}.</span> Its hash no longer starts with "${DIFF}", ` +
            `and every later block still points at the OLD hash. Rewriting one block means re-mining it and all ${blocks.length - firstBad - 1} after it — ` +
            'on a real chain, against everyone else’s combined hash power.';

        $$(el, '.c-data').forEach(inp => {
          inp.addEventListener('input', e => {
            blocks[Number(e.target.dataset.i)].data = e.target.value;
            const pos = e.target.selectionStart;
            render();
            const again = $(el, `.c-data[data-i="${e.target.dataset.i}"]`);
            again.focus(); again.setSelectionRange(pos, pos);
          });
        });
        $$(el, '[data-mine]').forEach(btn => {
          btn.onclick = () => {
            const i = Number(btn.dataset.mine);
            if (i > 0) blocks[i].prev = blocks[i - 1].hash;
            mine(blocks[i]);
            render();
          };
        });
      }
      $(el, '#c-reset').onclick = () => { rebuild(); render(); };
      $(el, '#c-remine').onclick = () => {
        blocks.forEach((b, i) => { if (i) b.prev = blocks[i - 1].hash; mine(b); });
        render();
      };
      render();
    });

  /* ============================================================
     MODULE 2
     ============================================================ */

  /* ---------- utxo ---------- */
  reg('utxo', 'Build a Bitcoin transaction from UTXOs',
    'You cannot spend "part" of a coin. Select whole unspent outputs, and anything left over after the payment and fee must come back to you as change.',
    function (el) {
      let utxos = [
        { id: 'a1b2…:0', amt: 0.35, sel: false },
        { id: 'c3d4…:1', amt: 0.12, sel: false },
        { id: 'e5f6…:0', amt: 0.80, sel: false },
        { id: '9a8b…:2', amt: 0.05, sel: false }
      ];
      el.innerHTML = `
        <div class="field"><label>Your unspent outputs</label><div id="u-list"></div></div>
        <div class="row">
          <div class="field"><label>Pay (BTC)</label><input type="number" id="u-pay" value="0.40" step="0.01"></div>
          <div class="field"><label>Fee (BTC)</label><input type="number" id="u-fee" value="0.0005" step="0.0001"></div>
        </div>
        <div class="out" id="u-log"></div>`;

      function render() {
        $(el, '#u-list').innerHTML = utxos.map((u, i) =>
          `<label style="display:flex;gap:9px;align-items:center;font-family:var(--mono);font-size:13px;padding:5px 0;text-transform:none;letter-spacing:0">
            <input type="checkbox" data-i="${i}" ${u.sel ? 'checked' : ''} style="width:auto">
            <span class="hash">${u.id}</span><span>${u.amt.toFixed(4)} BTC</span>
          </label>`).join('');
        $$(el, '#u-list input').forEach(c => c.onchange = e => {
          utxos[Number(e.target.dataset.i)].sel = e.target.checked; calc();
        });
        calc();
      }
      function calc() {
        const sel = utxos.filter(u => u.sel);
        const inSum = sel.reduce((a, u) => a + u.amt, 0);
        const pay = Number($(el, '#u-pay').value) || 0;
        const fee = Number($(el, '#u-fee').value) || 0;
        const change = inSum - pay - fee;

        let msg = `INPUTS  (${sel.length})\n` +
          (sel.length ? sel.map(u => `  ${u.id}  ${u.amt.toFixed(4)}`).join('\n') : '  <span class="dim">none selected</span>') +
          `\n  total in : ${inSum.toFixed(4)} BTC\n\nOUTPUTS\n  to payee : ${pay.toFixed(4)} BTC\n`;

        if (change > 1e-9) {
          msg += `  change   : ${change.toFixed(4)} BTC  <span class="dim">(back to your own new address)</span>\n`;
          msg += `  fee      : ${fee.toFixed(4)} BTC  <span class="dim">(implicit: inputs minus outputs, never an explicit field)</span>\n\n`;
          msg += '<span class="good">VALID.</span> Selected inputs are consumed entirely and destroyed; two new UTXOs are created.';
        } else if (Math.abs(change) < 1e-9) {
          msg += `  fee      : ${fee.toFixed(4)} BTC\n\n<span class="good">VALID, no change output.</span> Exact match — rare in practice.`;
        } else {
          msg += `\n<span class="bad">INVALID.</span> Inputs total ${inSum.toFixed(4)} but you are trying to spend ${(pay + fee).toFixed(4)}. ` +
            'Select more UTXOs. A transaction whose outputs exceed its inputs is rejected by every node.';
        }
        if (change > 1e-9 && change < 0.0001) {
          msg += '\n<span class="bad">Warning:</span> that change output is dust — it would cost more in fees to spend later than it is worth.';
        }
        $(el, '#u-log').innerHTML = msg;
      }
      $(el, '#u-pay').addEventListener('input', calc);
      $(el, '#u-fee').addEventListener('input', calc);
      render();
    });

  /* ---------- mine ---------- */
  reg('mine', 'Proof of work',
    'Real mining, in your browser. There is no shortcut: the only way to find a hash below the target is to keep changing the nonce and trying again.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Block data</label><input type="text" id="p-data" value="alice -> bob 10"></div>
          <div class="field shrink"><label>Difficulty (leading zeros)</label>
            <input type="range" id="p-diff" min="1" max="6" value="4" style="width:170px"></div>
        </div>
        <div class="row" style="margin-bottom:14px">
          <div class="field shrink"><button class="btn primary" id="p-go">Start mining</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="p-stop">Stop</button></div>
        </div>
        <div class="out" id="p-log">Target: hash must start with 0000…</div>`;

      let running = false, nonce = 0, tries = 0, t0 = 0;

      function target() { return '0'.repeat(Number($(el, '#p-diff').value)); }
      $(el, '#p-diff').addEventListener('input', () => {
        const d = Number($(el, '#p-diff').value);
        if (!running) $(el, '#p-log').innerHTML =
          `Target: hash must start with ${target()}…\n` +
          `Expected attempts: 16^${d} = ${num(Math.pow(16, d))} on average.`;
      });

      function step() {
        if (!running) return;
        const data = $(el, '#p-data').value;
        const tgt = target();
        let hash = '';
        for (let i = 0; i < 2500; i++) {
          hash = CL.sha256Hex(data + '|' + nonce);
          tries++;
          if (hash.startsWith(tgt)) {
            const secs = (performance.now() - t0) / 1000;
            running = false;
            $(el, '#p-log').innerHTML =
              `<span class="good">BLOCK FOUND</span>\n` +
              `nonce   : ${num(nonce)}\n` +
              `hash    : <span class="hash">${hash}</span>\n` +
              `attempts: ${num(tries)}\n` +
              `time    : ${secs.toFixed(2)}s at ${num(tries / Math.max(secs, 0.001))} H/s\n\n` +
              `Verification is one hash. Finding it took ${num(tries)}. That asymmetry is the entire security model — ` +
              'and Bitcoin’s network does roughly 10^21 of these every second.';
            return;
          }
          nonce++;
        }
        const secs = (performance.now() - t0) / 1000;
        $(el, '#p-log').innerHTML =
          `<span class="spin"></span> mining…\n` +
          `nonce   : ${num(nonce)}\n` +
          `last    : <span class="dim">${hash}</span>\n` +
          `attempts: ${num(tries)} at ${num(tries / Math.max(secs, 0.001))} H/s`;
        setTimeout(step, 0);
      }

      $(el, '#p-go').onclick = () => {
        if (running) return;
        running = true; nonce = 0; tries = 0; t0 = performance.now();
        step();
      };
      $(el, '#p-stop').onclick = () => {
        running = false;
        $(el, '#p-log').innerHTML += '\n<span class="bad">stopped.</span>';
      };
    });

  /* ---------- consensus ---------- */
  reg('consensus', 'Proof of stake selection',
    'Proposers are chosen with probability proportional to stake. Run enough slots and the distribution converges on the stake shares — no hardware, no energy.',
    function (el) {
      let vals = [
        { name: 'Validator A', stake: 320, slashed: false },
        { name: 'Validator B', stake: 160, slashed: false },
        { name: 'Validator C', stake: 96, slashed: false },
        { name: 'Validator D', stake: 32, slashed: false }
      ];
      el.innerHTML = `
        <div id="s-vals"></div>
        <div class="row" style="margin:12px 0 14px">
          <div class="field"><label>Slots to simulate</label><input type="number" id="s-slots" value="1000"></div>
          <div class="field shrink"><button class="btn primary" id="s-run">Run epoch</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="s-slash">Slash Validator C</button></div>
        </div>
        <div class="bars" id="s-bars"></div>
        <div class="out" id="s-log" style="margin-top:14px"></div>`;

      function renderVals() {
        $(el, '#s-vals').innerHTML = '<div class="row">' + vals.map((v, i) =>
          `<div class="field"><label>${esc(v.name)} (ETH)</label>
             <input type="number" data-i="${i}" class="s-stake" value="${v.stake}" ${v.slashed ? 'disabled' : ''}></div>`
        ).join('') + '</div>';
        $$(el, '.s-stake').forEach(inp => inp.oninput = e => {
          vals[Number(e.target.dataset.i)].stake = Math.max(0, Number(e.target.value) || 0);
        });
      }
      renderVals();

      $(el, '#s-run').onclick = () => {
        const active = vals.filter(v => !v.slashed && v.stake > 0);
        const total = active.reduce((a, v) => a + v.stake, 0);
        if (!total) { $(el, '#s-log').textContent = 'No active stake.'; return; }
        const slots = Math.max(1, Math.min(200000, Number($(el, '#s-slots').value) || 1000));
        const r = rng(1337);
        const counts = new Map(active.map(v => [v.name, 0]));

        for (let i = 0; i < slots; i++) {
          let x = r() * total;
          for (const v of active) { x -= v.stake; if (x <= 0) { counts.set(v.name, counts.get(v.name) + 1); break; } }
        }

        $(el, '#s-bars').innerHTML = active.map(v => {
          const got = counts.get(v.name) / slots;
          const want = v.stake / total;
          return `<div class="barrow">
            <span>${esc(v.name.replace('Validator ', 'Val '))}</span>
            <span class="track"><i style="width:${(got * 100).toFixed(1)}%"></i></span>
            <span>${pct(got, 1)}</span>
          </div>`;
        }).join('') + vals.filter(v => v.slashed).map(v =>
          `<div class="barrow"><span class="bad">${esc(v.name.replace('Validator ', 'Val '))}</span>
            <span class="track"></span><span class="bad">slashed</span></div>`).join('');

        $(el, '#s-log').innerHTML =
          `${slots} slots, ${total} ETH active stake.\n\n` +
          active.map(v =>
            `${v.name.padEnd(12)} stake ${pct(v.stake / total, 1).padStart(6)}   proposed ${pct(counts.get(v.name) / slots, 1).padStart(6)}`
          ).join('\n') +
          '\n\nSelection is weighted, not competitive: no extra hardware buys you more slots. ' +
          'Doubling your influence means doubling capital at risk — which is exactly what slashing threatens.';
      };

      $(el, '#s-slash').onclick = () => {
        const c = vals[2];
        if (c.slashed) return;
        const penalty = Math.round(c.stake * 0.0625);
        c.slashed = true;
        renderVals();
        $(el, '#s-log').innerHTML =
          `<span class="bad">Validator C slashed.</span>\n` +
          `Immediate penalty: ${penalty} ETH (1/32 of stake, correlation penalty can take far more).\n` +
          'Forcibly exited, cannot propose again, and the remaining stake is withdrawn only after a delay.\n\n' +
          'This is the difference from proof of work: a PoW attacker who fails keeps their hardware. ' +
          'A PoS attacker who equivocates provably destroys their own capital.';
      };
    });

  /* ---------- reorg ---------- */
  reg('reorg', 'Forks, reorgs and the heaviest chain',
    'Two miners find a block at the same height. Extend either branch and watch the network switch — taking any transaction that was only in the losing branch with it.',
    function (el) {
      let A, B, canonical, history;
      function reset() {
        A = [{ h: 1, txs: ['alice -> bob 10'] }, { h: 2, txs: ['bob -> carol 4'] }];
        B = [{ h: 1, txs: ['alice -> bob 10'] }];
        canonical = 'A'; history = [];
      }
      reset();

      el.innerHTML = `
        <div class="row" style="margin-bottom:14px">
          <div class="field shrink"><button class="btn ghost sm" id="r-a">Mine on branch A</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="r-b">Mine on branch B</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="r-reset">Reset</button></div>
        </div>
        <div id="r-view"></div>
        <div class="out" id="r-log"></div>`;

      function render(note) {
        const branch = (list, name) =>
          `<div class="block-card ${canonical === name ? 'valid' : ''}">
            <h4>Branch ${name} <span class="badge ${canonical === name ? 'ok' : 'no'}">${canonical === name ? 'canonical' : 'orphaned'}</span></h4>
            <div class="dim">height ${list.length}</div>
            ${list.map(b => `<div>#${b.h} · ${b.txs.map(esc).join(', ')}</div>`).join('')}
          </div>`;
        $(el, '#r-view').innerHTML = '<div class="chain-flow">' + branch(A, 'A') + branch(B, 'B') + '</div>';

        const winner = canonical === 'A' ? A : B;
        const loser = canonical === 'A' ? B : A;
        const orphanedTxs = loser.slice(1).flatMap(b => b.txs)
          .filter(t => !winner.flatMap(b => b.txs).includes(t));

        $(el, '#r-log').innerHTML =
          (note ? note + '\n\n' : '') +
          `Canonical: branch ${canonical} at height ${winner.length}.\n` +
          `Confirmations for block #1: ${winner.length}\n` +
          (orphanedTxs.length
            ? `<span class="bad">Reverted by the reorg:</span> ${orphanedTxs.map(esc).join(', ')}\n` +
              'Anyone who treated those as final — a merchant who shipped goods — just lost them.'
            : 'No transactions have been reverted.') +
          '\n\nNodes follow the branch with the most accumulated work, not the one they saw first. ' +
          'Confirmations are a probability, never a guarantee.' +
          (history.length ? '\n\n' + history.slice(-4).map(esc).join('\n') : '');
      }

      function mineOn(name) {
        const list = name === 'A' ? A : B;
        const h = list.length + 1;
        list.push({ h: h, txs: [name === 'A' ? `tx-a${h}` : `tx-b${h}`] });
        const before = canonical;
        canonical = A.length >= B.length ? 'A' : 'B';
        let note = `Block #${h} mined on branch ${name}.`;
        if (before !== canonical) {
          const depth = (before === 'A' ? A.length : B.length) - 1;
          history.push(`REORG: switched ${before} → ${canonical}, depth ${Math.max(1, depth)}.`);
          note = `<span class="bad">REORG.</span> Branch ${canonical} is now heavier. Every node abandons branch ${before} and rewrites its view of "confirmed".`;
        }
        render(note);
      }
      $(el, '#r-a').onclick = () => mineOn('A');
      $(el, '#r-b').onclick = () => mineOn('B');
      $(el, '#r-reset').onclick = () => { reset(); render('Reset. Two branches share block #1 and now disagree.'); };
      render();
    });

  /* ============================================================
     MODULE 3
     ============================================================ */

  /* ---------- accounts ---------- */
  reg('accounts', 'EOA vs contract account',
    'Ethereum has one state trie and two kinds of account in it. Compare their fields, and derive both kinds of address.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Private key (EOA)</label><input type="text" id="a-pk" value="0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"></div>
          <div class="field shrink"><button class="btn ghost sm" id="a-rand">Random</button></div>
        </div>
        <div class="row">
          <div class="field"><label>Deployer address</label><input type="text" id="a-dep" value="0x2c7536e3605d9c16a7a3d7b1898e529396a65c23"></div>
          <div class="field"><label>Deployer nonce</label><input type="number" id="a-nonce" value="0" min="0"></div>
        </div>
        <div class="out" id="a-log" style="margin-top:8px"></div>`;

      function run() {
        let pk;
        try {
          pk = BigInt($(el, '#a-pk').value.trim());
        } catch (e) { $(el, '#a-log').innerHTML = '<span class="bad">Private key must be a hex number.</span>'; return; }
        if (pk <= 0n || pk >= CL.secp256k1.N) {
          $(el, '#a-log').innerHTML = '<span class="bad">Key out of range: must be 1 ≤ d &lt; n.</span>'; return;
        }
        const pt = CL.secp256k1.pubKey(pk);
        const eoa = CL.toChecksumAddress(CL.ethAddress(pt));

        const dep = $(el, '#a-dep').value.trim();
        const nonce = Math.max(0, Number($(el, '#a-nonce').value) || 0);
        let created = '(invalid deployer address)';
        if (/^0x[0-9a-fA-F]{40}$/.test(dep)) {
          const rlp = rlpAddrNonce(dep, nonce);
          created = CL.toChecksumAddress('0x' + CL.keccak256Hex(rlp).slice(24));
        }

        $(el, '#a-log').innerHTML =
          `EXTERNALLY OWNED ACCOUNT\n` +
          `  address    <span class="hash">${eoa}</span>\n` +
          `  nonce      transactions sent\n` +
          `  balance    wei\n` +
          `  codeHash   keccak256("") — <span class="dim">no code</span>\n` +
          `  storageRoot empty\n` +
          `  controlled by a private key; can initiate transactions\n\n` +
          `CONTRACT ACCOUNT  (CREATE from that deployer at nonce ${nonce})\n` +
          `  address    <span class="hash">${created}</span>\n` +
          `  nonce      contracts created via CREATE\n` +
          `  balance    wei\n` +
          `  codeHash   keccak256(runtime bytecode)\n` +
          `  storageRoot root of its own storage trie\n` +
          `  no key exists; only acts when called\n\n` +
          `address = keccak256(rlp([deployer, nonce]))[12:]\n` +
          `<span class="dim">Deploy anything else first and the nonce moves — the address changes with it. ` +
          'That is why cross-chain deployments use CREATE2 instead.</span>';
      }
      $$(el, '#a-pk, #a-dep, #a-nonce').forEach(i => i.addEventListener('input', run));
      $(el, '#a-rand').onclick = () => {
        $(el, '#a-pk').value = '0x' + CL.bigToHex(CL.secp256k1.genPrivKey(), 32);
        run();
      };
      run();
    });

  /* ---------- gas ---------- */
  reg('gas', 'EIP-1559 fee calculator',
    'Work out exactly what a transaction costs, how much ether is burned, what the validator keeps, and how the base fee reacts to demand.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Base fee (gwei)</label><input type="number" id="g-base" value="20" step="1"></div>
          <div class="field"><label>Priority fee (gwei)</label><input type="number" id="g-tip" value="2" step="0.5"></div>
          <div class="field"><label>Max fee (gwei)</label><input type="number" id="g-max" value="40" step="1"></div>
          <div class="field"><label>Gas used</label><input type="number" id="g-used" value="120000" step="1000"></div>
        </div>
        <div class="field"><label>Block fullness (target is 50%)</label>
          <input type="range" id="g-full" min="0" max="100" value="75"></div>
        <div class="out" id="g-log"></div>`;

      function run() {
        const base = Number($(el, '#g-base').value) || 0;
        const tip = Number($(el, '#g-tip').value) || 0;
        const max = Number($(el, '#g-max').value) || 0;
        const used = Number($(el, '#g-used').value) || 0;
        const full = Number($(el, '#g-full').value) / 100;

        const effective = Math.min(max, base + tip);
        const actualTip = Math.max(0, effective - base);
        const burned = base * used / 1e9;
        const toValidator = actualTip * used / 1e9;
        const total = effective * used / 1e9;
        const refund = (max - effective) * used / 1e9;

        // base fee adjusts up to +/-12.5% per block toward 50% fullness
        let projected = base, line = [];
        for (let i = 1; i <= 6; i++) {
          projected = projected * (1 + ((full - 0.5) / 0.5) * 0.125);
          line.push(`  block +${i}: ${projected.toFixed(2)} gwei`);
        }

        const tooLow = max < base;
        $(el, '#g-log').innerHTML =
          (tooLow
            ? '<span class="bad">maxFeePerGas is below the base fee — this transaction cannot be included at all.</span>\n\n'
            : '') +
          `effective gas price : ${effective.toFixed(2)} gwei  <span class="dim">= min(maxFee, baseFee + priorityFee)</span>\n` +
          `actual tip          : ${actualTip.toFixed(2)} gwei\n\n` +
          `total paid          : ${total.toFixed(6)} ETH\n` +
          `  <span class="bad">burned</span>            : ${burned.toFixed(6)} ETH  <span class="dim">(destroyed forever — EIP-1559)</span>\n` +
          `  <span class="good">to validator</span>      : ${toValidator.toFixed(6)} ETH\n` +
          `unspent, refunded   : ${refund.toFixed(6)} ETH  <span class="dim">(you are never charged your max)</span>\n\n` +
          `Base fee projection at ${pct(full, 0)} full:\n${line.join('\n')}\n` +
          (full > 0.5
            ? '<span class="dim">Above 50% the base fee rises up to 12.5% per block — sustained demand gets expensive fast, by design.</span>'
            : full < 0.5
              ? '<span class="dim">Below 50% it falls up to 12.5% per block until demand returns.</span>'
              : '<span class="dim">Exactly at target: the base fee holds steady.</span>');
      }
      $$(el, '#g-base, #g-tip, #g-max, #g-used, #g-full').forEach(i => i.addEventListener('input', run));
      run();
    });

  /* ---------- evm ---------- */
  reg('evm', 'EVM stack machine',
    'The EVM is a stack machine with 1024 slots and 256-bit words. Step through a program and watch the stack, memory, storage and gas.',
    function (el) {
      el.innerHTML = `
        <div class="field"><label>Program (one opcode per line)</label>
          <textarea id="v-src" style="min-height:150px">PUSH1 0x05
PUSH1 0x03
ADD
PUSH1 0x02
MUL
DUP1
PUSH1 0x00
SSTORE
STOP</textarea></div>
        <div class="row" style="margin-bottom:14px">
          <div class="field shrink"><button class="btn primary" id="v-step">Step</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="v-run">Run</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="v-reset">Reset</button></div>
        </div>
        <div class="out tight" id="v-log"></div>`;

      const COST = {
        STOP: 0, PUSH1: 3, ADD: 3, SUB: 3, MUL: 5, DIV: 5, MOD: 5, LT: 3, GT: 3, EQ: 3,
        ISZERO: 3, AND: 3, OR: 3, XOR: 3, NOT: 3, POP: 2, DUP1: 3, DUP2: 3, SWAP1: 3,
        SWAP2: 3, MSTORE: 3, MLOAD: 3, SSTORE: 20000, SLOAD: 2100
      };
      let st, halted;
      function reset() {
        st = { pc: 0, stack: [], mem: {}, store: {}, gas: 0, err: null, log: [] };
        halted = false;
        render();
      }
      function lines() {
        return $(el, '#v-src').value.split('\n').map(s => s.trim()).filter(Boolean);
      }
      const MASK = (1n << 256n) - 1n;
      const w = x => ((x % (1n << 256n)) + (1n << 256n)) % (1n << 256n);

      function step() {
        if (halted) return;
        const src = lines();
        if (st.pc >= src.length) { halted = true; st.log.push('-- end of program --'); return render(); }
        const parts = src[st.pc].split(/\s+/);
        const op = parts[0].toUpperCase();
        const arg = parts[1];
        const S = st.stack;
        const pop = () => S.length ? S.pop() : (st.err = 'stack underflow', 0n);

        try {
          switch (op) {
            case 'STOP': halted = true; break;
            case 'PUSH1': case 'PUSH32': S.push(w(BigInt(arg))); break;
            case 'ADD': { const a = pop(), b = pop(); S.push(w(a + b)); break; }
            case 'SUB': { const a = pop(), b = pop(); S.push(w(a - b)); break; }
            case 'MUL': { const a = pop(), b = pop(); S.push(w(a * b)); break; }
            case 'DIV': { const a = pop(), b = pop(); S.push(b === 0n ? 0n : a / b); break; }
            case 'MOD': { const a = pop(), b = pop(); S.push(b === 0n ? 0n : a % b); break; }
            case 'LT': { const a = pop(), b = pop(); S.push(a < b ? 1n : 0n); break; }
            case 'GT': { const a = pop(), b = pop(); S.push(a > b ? 1n : 0n); break; }
            case 'EQ': { const a = pop(), b = pop(); S.push(a === b ? 1n : 0n); break; }
            case 'ISZERO': S.push(pop() === 0n ? 1n : 0n); break;
            case 'AND': { const a = pop(), b = pop(); S.push(a & b); break; }
            case 'OR': { const a = pop(), b = pop(); S.push(a | b); break; }
            case 'XOR': { const a = pop(), b = pop(); S.push(a ^ b); break; }
            case 'NOT': S.push(pop() ^ MASK); break;
            case 'POP': pop(); break;
            case 'DUP1': S.push(S[S.length - 1]); break;
            case 'DUP2': S.push(S[S.length - 2]); break;
            case 'SWAP1': { const n = S.length; const t = S[n - 1]; S[n - 1] = S[n - 2]; S[n - 2] = t; break; }
            case 'SWAP2': { const n = S.length; const t = S[n - 1]; S[n - 1] = S[n - 3]; S[n - 3] = t; break; }
            case 'MSTORE': { const off = pop(), val = pop(); st.mem[off.toString()] = val; break; }
            case 'MLOAD': { const off = pop(); S.push(st.mem[off.toString()] || 0n); break; }
            case 'SSTORE': { const key = pop(), val = pop(); st.store[key.toString()] = val; break; }
            case 'SLOAD': { const key = pop(); S.push(st.store[key.toString()] || 0n); break; }
            default: st.err = 'unknown opcode: ' + op; halted = true;
          }
        } catch (e) { st.err = String(e.message || e); halted = true; }

        st.gas += COST[op] === undefined ? 3 : COST[op];
        st.log.push(`${String(st.pc).padStart(2)}  ${src[st.pc].padEnd(14)} gas ${String(st.gas).padStart(6)}`);
        st.pc++;
        if (st.err) halted = true;
        render();
      }

      function render() {
        const stack = st.stack.length
          ? st.stack.slice().reverse().map((v, i) =>
              `  [${st.stack.length - 1 - i}] ${v.toString()}${v > 255n ? '  (0x' + v.toString(16) + ')' : ''}`).join('\n')
          : '  <span class="dim">(empty)</span>';
        const store = Object.keys(st.store).length
          ? Object.keys(st.store).map(k => `  slot ${k} = ${st.store[k]}`).join('\n')
          : '  <span class="dim">(empty)</span>';
        const mem = Object.keys(st.mem).length
          ? Object.keys(st.mem).map(k => `  0x${Number(k).toString(16)} = ${st.mem[k]}`).join('\n')
          : '  <span class="dim">(empty)</span>';

        $(el, '#v-log').innerHTML =
          `STACK (top first)\n${stack}\n\nSTORAGE (persists between calls)\n${store}\n\nMEMORY (cleared after the call)\n${mem}\n\n` +
          `gas used: ${st.gas}${st.err ? '   <span class="bad">ERROR: ' + esc(st.err) + '</span>' : ''}\n` +
          (halted && !st.err ? '<span class="good">halted</span>\n' : '') +
          (st.log.length ? '\nTRACE\n' + st.log.slice(-12).map(esc).join('\n') : '') +
          (Object.keys(st.store).length
            ? '\n\n<span class="dim">Note the gas: one SSTORE to a fresh slot is 20,000 — more than every other instruction here combined.</span>'
            : '');
      }
      $(el, '#v-step').onclick = step;
      $(el, '#v-run').onclick = () => { let n = 0; while (!halted && n++ < 500) step(); };
      $(el, '#v-reset').onclick = reset;
      $(el, '#v-src').addEventListener('input', reset);
      reset();
    });

  /* ---------- storage ---------- */
  reg('storage', 'Storage slot calculator',
    'Every state variable lives at a computable slot. Work out where, exactly — the same arithmetic a debugger or an exploit uses.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Variable kind</label>
            <select id="st-kind">
              <option value="value">value type (uint/address/bool)</option>
              <option value="map">mapping(key =&gt; value)</option>
              <option value="map2">nested mapping</option>
              <option value="arr">dynamic array element</option>
            </select></div>
          <div class="field"><label>Declared slot</label><input type="number" id="st-slot" value="3" min="0"></div>
        </div>
        <div class="row">
          <div class="field"><label>Key / index</label><input type="text" id="st-k1" value="0x2c7536e3605d9c16a7a3d7b1898e529396a65c23"></div>
          <div class="field"><label>Second key (nested only)</label><input type="text" id="st-k2" value="0xA11CE00000000000000000000000000000000001"></div>
        </div>
        <div class="out" id="st-log"></div>`;

      function asWord(v) {
        v = String(v).trim();
        if (/^0x/i.test(v)) return pad32Hex(v);
        return pad32Hex(BigInt(v || 0));
      }
      function run() {
        const kind = $(el, '#st-kind').value;
        const slot = Math.max(0, Number($(el, '#st-slot').value) || 0);
        const k1 = $(el, '#st-k1').value;
        const k2 = $(el, '#st-k2').value;
        let out = '';
        try {
          if (kind === 'value') {
            out = `slot = ${slot}\n\n<span class="hash">0x${pad32Hex(BigInt(slot))}</span>\n\n` +
              'Value types get slots in declaration order, packed left to right when they fit together in 32 bytes.';
          } else if (kind === 'map') {
            const pre = asWord(k1) + pad32Hex(BigInt(slot));
            const h = CL.keccak256Hex(CL.hexToBytes(pre));
            out = `slot = keccak256(abi.encode(key, uint256(${slot})))\n\n` +
              `key  padded : ${asWord(k1)}\n` +
              `slot padded : ${pad32Hex(BigInt(slot))}\n\n` +
              `<span class="hash">0x${h}</span>\n\n` +
              'The declared slot itself stores nothing. Mapping entries are scattered across the whole 2^256 space, ' +
              'which is why a mapping can never be enumerated on chain.';
          } else if (kind === 'map2') {
            const inner = CL.keccak256Hex(CL.hexToBytes(asWord(k1) + pad32Hex(BigInt(slot))));
            const outer = CL.keccak256Hex(CL.hexToBytes(asWord(k2) + inner));
            out = `slot = keccak256(abi.encode(key2, keccak256(abi.encode(key1, uint256(${slot})))))\n\n` +
              `inner : <span class="dim">0x${inner}</span>\n` +
              `final : <span class="hash">0x${outer}</span>\n\n` +
              'This is the allowance layout in every ERC-20: allowance[owner][spender].';
          } else {
            const base = CL.keccak256Hex(CL.hexToBytes(pad32Hex(BigInt(slot))));
            const i = BigInt(/^0x/i.test(k1.trim()) ? k1.trim() : (k1.trim() || '0'));
            const addr = (BigInt('0x' + base) + i) % (1n << 256n);
            out = `array length lives at slot ${slot}\n` +
              `element[i] at keccak256(uint256(${slot})) + i\n\n` +
              `base  : <span class="dim">0x${base}</span>\n` +
              `i     : ${i}\n` +
              `<span class="hash">0x${pad32Hex(addr)}</span>\n\n` +
              'Elements are contiguous, so arrays can be iterated — unlike mappings.';
          }
        } catch (e) { out = '<span class="bad">' + esc(e.message || e) + '</span>'; }
        $(el, '#st-log').innerHTML = out;
      }
      $$(el, '#st-kind, #st-slot, #st-k1, #st-k2').forEach(i => i.addEventListener('input', run));
      $(el, '#st-kind').addEventListener('change', run);
      run();
    });

  /* ---------- erc20 ---------- */
  reg('erc20', 'ERC-20 token, including the approve race',
    'Drive balances, allowances and transferFrom by hand — then reproduce the front-running problem that made increaseAllowance necessary.',
    function (el) {
      let bal, allow, log;
      function reset() {
        bal = { Alice: 1000, Bob: 250, Exchange: 0 };
        allow = { 'Alice>Exchange': 0, 'Bob>Exchange': 0 };
        log = ['Deploy: total supply 1250, Alice 1000, Bob 250.'];
      }
      reset();

      el.innerHTML = `
        <div class="row">
          <div class="field"><label>From</label><select id="e-from"><option>Alice</option><option>Bob</option></select></div>
          <div class="field"><label>To</label><select id="e-to"><option>Bob</option><option>Alice</option><option>Exchange</option></select></div>
          <div class="field"><label>Amount</label><input type="number" id="e-amt" value="100"></div>
          <div class="field shrink"><button class="btn primary" id="e-transfer">transfer</button></div>
        </div>
        <div class="row" style="margin-bottom:14px">
          <div class="field shrink"><button class="btn ghost sm" id="e-approve">approve(Exchange, amount)</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="e-tf">Exchange: transferFrom</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="e-race">Show the approve race</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="e-reset">Reset</button></div>
        </div>
        <div class="out" id="e-log"></div>`;

      function render(extra) {
        const supply = Object.values(bal).reduce((a, b) => a + b, 0);
        $(el, '#e-log').innerHTML =
          'BALANCES\n' + Object.keys(bal).map(k => `  ${k.padEnd(9)} ${String(bal[k]).padStart(6)}`).join('\n') +
          `\n  ${'total'.padEnd(9)} ${String(supply).padStart(6)}  <span class="dim">(must never change on transfer)</span>\n\n` +
          'ALLOWANCES\n' + Object.keys(allow).map(k => `  ${k.replace('>', ' → ').padEnd(20)} ${allow[k]}`).join('\n') +
          '\n\nEVENT LOG\n' + log.slice(-8).map(s => '  ' + s).join('\n') +
          (extra ? '\n\n' + extra : '');
      }

      $(el, '#e-transfer').onclick = () => {
        const f = $(el, '#e-from').value, t = $(el, '#e-to').value, a = Number($(el, '#e-amt').value) || 0;
        if (f === t) return render('<span class="bad">Self-transfer: allowed by the standard, but pointless.</span>');
        if (bal[f] < a) return render(`<span class="bad">revert: transfer amount exceeds balance (${f} has ${bal[f]}).</span>`);
        bal[f] -= a; bal[t] += a;
        log.push(`Transfer(${f}, ${t}, ${a})`);
        render('<span class="good">Balances updated, Transfer event emitted.</span> No tokens moved anywhere — only two numbers in this contract changed.');
      };

      $(el, '#e-approve').onclick = () => {
        const f = $(el, '#e-from').value, a = Number($(el, '#e-amt').value) || 0;
        allow[f + '>Exchange'] = a;
        log.push(`Approval(${f}, Exchange, ${a})`);
        render('Approval set. The Exchange contract may now pull up to that amount — at any time, until revoked.');
      };

      $(el, '#e-tf').onclick = () => {
        const f = $(el, '#e-from').value, a = Number($(el, '#e-amt').value) || 0;
        const key = f + '>Exchange';
        if ((allow[key] || 0) < a) return render(`<span class="bad">revert: insufficient allowance (${allow[key] || 0} &lt; ${a}).</span>`);
        if (bal[f] < a) return render('<span class="bad">revert: insufficient balance.</span>');
        allow[key] -= a; bal[f] -= a; bal.Exchange += a;
        log.push(`Transfer(${f}, Exchange, ${a})`);
        render('transferFrom succeeded: the allowance was spent down by exactly the amount moved.');
      };

      $(el, '#e-race').onclick = () => {
        allow['Alice>Exchange'] = 100;
        log.push('Approval(Alice, Exchange, 100)');
        // spender front-runs the change
        bal.Alice -= 100; bal.Exchange += 100; allow['Alice>Exchange'] = 0;
        log.push('Transfer(Alice, Exchange, 100)  <-- front-run, spends the OLD allowance');
        allow['Alice>Exchange'] = 50;
        log.push('Approval(Alice, Exchange, 50)   <-- Alice’s intended new limit lands');
        bal.Alice -= 50; bal.Exchange += 50; allow['Alice>Exchange'] = 0;
        log.push('Transfer(Alice, Exchange, 50)   <-- spends the NEW allowance too');
        render(
          '<span class="bad">THE APPROVE RACE.</span>\n' +
          'Alice approved 100, then tried to reduce it to 50. The spender saw the pending change in the mempool and\n' +
          'front-ran it, spending the old 100 first — then spent the new 50 as well. Total taken: 150, not 50.\n\n' +
          'Fixes: approve(0) before approving a new value, use increaseAllowance/decreaseAllowance, or use\n' +
          'EIP-2612 permit with a nonce and deadline. This is a standard flaw, not an implementation bug.');
      };

      $(el, '#e-reset').onclick = () => { reset(); render(); };
      render();
    });

  /* ---------- nft ---------- */
  reg('nft', 'ERC-721 and ERC-1155',
    'One ledger maps a token id to exactly one owner; the other maps (id, owner) to a quantity. That single difference is the whole distinction.',
    function (el) {
      let owners = { 1: 'Alice', 2: 'Alice', 3: 'Bob' };
      let next = 4;
      let bal1155 = { 'SWORD:Alice': 1, 'GOLD:Alice': 500, 'GOLD:Bob': 120 };
      let log = [];

      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Token id (721)</label><input type="number" id="n-id" value="1" min="1"></div>
          <div class="field"><label>New owner</label><select id="n-to"><option>Alice</option><option>Bob</option><option>Carol</option></select></div>
          <div class="field shrink"><button class="btn primary" id="n-xfer">transferFrom</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="n-mint">mint to Carol</button></div>
        </div>
        <div class="row" style="margin-bottom:14px">
          <div class="field"><label>1155 id</label><select id="n-1155"><option>GOLD</option><option>SWORD</option></select></div>
          <div class="field"><label>Amount</label><input type="number" id="n-amt" value="50"></div>
          <div class="field shrink"><button class="btn ghost sm" id="n-batch">Alice → Bob (1155)</button></div>
        </div>
        <div class="out" id="n-log"></div>`;

      function render(extra) {
        const counts = {};
        Object.values(owners).forEach(o => counts[o] = (counts[o] || 0) + 1);
        $(el, '#n-log').innerHTML =
          'ERC-721  mapping(uint256 => address)\n' +
          Object.keys(owners).map(id =>
            `  tokenId ${String(id).padStart(3)}  owner ${owners[id].padEnd(7)} tokenURI ipfs://Qm…/${id}.json`).join('\n') +
          '\n  balanceOf: ' + Object.keys(counts).map(k => `${k}=${counts[k]}`).join('  ') +
          '\n  <span class="dim">Each id has exactly one owner. Ownership is not divisible.</span>\n\n' +
          'ERC-1155  mapping(uint256 => mapping(address => uint256))\n' +
          Object.keys(bal1155).map(k => {
            const p = k.split(':');
            return `  id ${p[0].padEnd(6)} ${p[1].padEnd(7)} balance ${bal1155[k]}`;
          }).join('\n') +
          '\n  <span class="dim">Same contract holds a unique SWORD and 620 fungible GOLD. One deployment, both semantics.</span>' +
          (log.length ? '\n\nEVENT LOG\n' + log.slice(-6).map(s => '  ' + s).join('\n') : '') +
          (extra ? '\n\n' + extra : '');
      }

      $(el, '#n-xfer').onclick = () => {
        const id = String(Number($(el, '#n-id').value));
        const to = $(el, '#n-to').value;
        if (!owners[id]) return render(`<span class="bad">revert: ERC721NonexistentToken(${id}).</span>`);
        if (owners[id] === to) return render('<span class="bad">Already the owner — nothing to do.</span>');
        log.push(`Transfer(${owners[id]}, ${to}, ${id})`);
        owners[id] = to;
        render('<span class="good">Owner replaced.</span> There is no quantity here: the mapping entry is simply overwritten.');
      };
      $(el, '#n-mint').onclick = () => {
        owners[next] = 'Carol';
        log.push(`Transfer(0x0, Carol, ${next})  // mint`);
        next++;
        render('Minted. A mint is a Transfer from the zero address — indexers rely on exactly that convention.');
      };
      $(el, '#n-batch').onclick = () => {
        const id = $(el, '#n-1155').value;
        const amt = Number($(el, '#n-amt').value) || 0;
        const from = id + ':Alice', to = id + ':Bob';
        if ((bal1155[from] || 0) < amt) return render(`<span class="bad">revert: insufficient balance (Alice has ${bal1155[from] || 0} ${id}).</span>`);
        bal1155[from] -= amt; bal1155[to] = (bal1155[to] || 0) + amt;
        log.push(`TransferSingle(Alice, Bob, ${id}, ${amt})`);
        render('1155 moves a quantity of an id. safeBatchTransferFrom would move several ids in one call — one transaction, one approval, much less gas.');
      };
      render();
    });

  /* ============================================================
     MODULE 4
     ============================================================ */

  /* ---------- selector ---------- */
  reg('selector', 'Function selectors and calldata',
    'Compute the 4-byte selector for any signature, encode arguments, and decode raw calldata back into 32-byte words.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Function signature</label><input type="text" id="f-sig" value="transfer(address,uint256)"></div>
        </div>
        <div class="field"><label>Arguments (comma separated — static types only)</label>
          <input type="text" id="f-args" value="0x2c7536e3605d9c16a7a3d7b1898e529396a65c23, 1000000000000000000"></div>
        <div class="field"><label>Or decode raw calldata</label>
          <textarea id="f-cd" style="min-height:60px"></textarea></div>
        <div class="out" id="f-log"></div>`;

      function encodeArg(a) {
        a = a.trim();
        if (a === 'true') return pad32Hex(1n);
        if (a === 'false') return pad32Hex(0n);
        if (/^0x[0-9a-fA-F]+$/.test(a)) return pad32Hex(a);
        return pad32Hex(BigInt(a));
      }
      function run() {
        const sig = $(el, '#f-sig').value.trim();
        const raw = $(el, '#f-cd').value.trim();
        let out = '';

        if (sig) {
          const canonical = sig.replace(/\s+/g, '');
          const sel = CL.keccak256Hex(canonical).slice(0, 8);
          out += `signature : ${esc(canonical)}\n` +
            `keccak256 : ${CL.keccak256Hex(canonical)}\n` +
            `selector  : <span class="hash">0x${sel}</span>  <span class="dim">(first 4 bytes)</span>\n\n`;

          const args = $(el, '#f-args').value.trim();
          if (args) {
            try {
              const words = args.split(',').map(encodeArg);
              out += 'CALLDATA\n';
              out += `  0x${sel}${' '.repeat(56)}<span class="dim">// selector</span>\n`;
              words.forEach((wd, i) => { out += `    ${wd}  <span class="dim">// arg ${i}</span>\n`; });
              out += `\nfull: <span class="hash">0x${sel}${words.join('')}</span>\n` +
                `size: ${4 + words.length * 32} bytes` +
                `  <span class="dim">(gas: ${4 + words.length * 32} bytes at 16 gas per non-zero byte — this is why L2 calldata compression matters)</span>\n\n`;
            } catch (e) { out += '<span class="bad">Could not encode: ' + esc(e.message || e) + '</span>\n\n'; }
          }
        }

        if (raw) {
          const hex = raw.replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
          out += 'DECODE\n';
          out += `  selector 0x${hex.slice(0, 8)}\n`;
          for (let i = 8; i < hex.length; i += 64) {
            const wd = hex.slice(i, i + 64);
            let hint = '';
            try {
              const v = BigInt('0x' + wd);
              hint = v < 10n ** 30n ? `uint: ${v}` : '';
              if (/^0{24}[0-9a-f]{40}$/.test(wd)) hint = 'address: 0x' + wd.slice(24);
            } catch (e) { /* ignore */ }
            out += `  word ${((i - 8) / 64)}  ${wd}  <span class="dim">${hint}</span>\n`;
          }
        }
        if (!out) out = 'Enter a signature.';
        $(el, '#f-log').innerHTML = out;
      }
      $$(el, '#f-sig, #f-args, #f-cd').forEach(i => i.addEventListener('input', run));
      run();
    });

  /* ---------- fuzz ---------- */
  reg('fuzz', 'Fuzzing finds what unit tests miss',
    'A token with a fee has a conservation bug. Unit tests pass. Run random operation sequences against an invariant and watch it break.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Implementation</label>
            <select id="z-impl">
              <option value="buggy">buggy (fee deducted from sender, credited nowhere)</option>
              <option value="fixed">fixed (fee credited to the treasury)</option>
            </select></div>
          <div class="field"><label>Runs</label><input type="number" id="z-runs" value="500"></div>
          <div class="field"><label>Seed</label><input type="number" id="z-seed" value="42"></div>
          <div class="field shrink"><button class="btn primary" id="z-go">Run fuzzer</button></div>
        </div>
        <div class="out" id="z-log">Invariant: sum(balances) + treasury == totalSupply, after every single operation.</div>`;

      $(el, '#z-go').onclick = () => {
        const impl = $(el, '#z-impl').value;
        const runs = Math.max(1, Math.min(20000, Number($(el, '#z-runs').value) || 500));
        const r = rng(Number($(el, '#z-seed').value) || 42);
        const actors = ['A', 'B', 'C', 'D'];
        const bal = { A: 250, B: 250, C: 250, D: 250 };
        let treasury = 0;
        const SUPPLY = 1000;
        const seq = [];

        for (let i = 0; i < runs; i++) {
          const from = actors[Math.floor(r() * 4)];
          let to = actors[Math.floor(r() * 4)];
          if (to === from) to = actors[(actors.indexOf(from) + 1) % 4];
          const amt = Math.floor(r() * (bal[from] + 1));
          if (amt === 0) continue;

          const fee = Math.floor(amt * 100 / 10000);      // 1% fee
          seq.push(`transfer(${from} → ${to}, ${amt})  fee ${fee}`);

          bal[from] -= amt;
          bal[to] += amt - fee;
          if (impl === 'fixed') treasury += fee;          // buggy version drops it

          const total = actors.reduce((a, k) => a + bal[k], 0) + treasury;
          if (total !== SUPPLY) {
            $(el, '#z-log').innerHTML =
              `<span class="bad">INVARIANT VIOLATED after ${i + 1} operations.</span>\n\n` +
              `expected total: ${SUPPLY}\n` +
              `actual total  : ${total}   <span class="bad">(${SUPPLY - total} tokens vanished)</span>\n\n` +
              'FAILING SEQUENCE (last 6 calls)\n' + seq.slice(-6).map(s => '  ' + esc(s)).join('\n') + '\n\n' +
              'FINAL STATE\n' + actors.map(k => `  ${k}: ${bal[k]}`).join('\n') + `\n  treasury: ${treasury}\n\n` +
              'Every individual transfer "worked". Only the invariant caught it. A unit test asserting\n' +
              '"Bob received the right amount" passes here forever — which is exactly how this class of bug ships.';
            return;
          }
        }
        $(el, '#z-log').innerHTML =
          `<span class="good">${runs} runs, invariant held.</span>\n\n` +
          `sum(balances) = ${actors.reduce((a, k) => a + bal[k], 0)}\n` +
          `treasury      = ${treasury}\n` +
          `total         = ${actors.reduce((a, k) => a + bal[k], 0) + treasury} == ${SUPPLY}\n\n` +
          'Passing is not proof — it means the fuzzer did not find a counterexample within this run budget. ' +
          'Raise the runs, widen the operation set, or reach for symbolic execution when the stakes justify it.';
      };
    });

  /* ---------- sign ---------- */
  reg('sign', 'EIP-191 and EIP-712 signing',
    'Build the exact digest a wallet signs, then change the chain id and watch the digest move — that is what stops a signature replaying elsewhere.',
    function (el) {
      el.innerHTML = `
        <div class="field"><label>Message (personal_sign / EIP-191)</label>
          <input type="text" id="g7-msg" value="Sign in to Roadmap Exchange"></div>
        <div class="row">
          <div class="field"><label>Chain id (EIP-712 domain)</label><input type="number" id="g7-chain" value="1"></div>
          <div class="field"><label>Verifying contract</label><input type="text" id="g7-vc" value="0x2c7536e3605d9c16a7a3d7b1898e529396a65c23"></div>
          <div class="field shrink"><button class="btn primary" id="g7-sign">Sign both</button></div>
        </div>
        <div class="out" id="g7-log"></div>`;

      const key = CL.secp256k1.genPrivKey();
      const pt = CL.secp256k1.pubKey(key);
      const addr = CL.toChecksumAddress(CL.ethAddress(pt));

      function digests() {
        const msg = $(el, '#g7-msg').value;
        const bytes = CL.utf8ToBytes(msg);
        const prefixed = CL.concat(
          CL.utf8ToBytes('\x19Ethereum Signed Message:\n' + bytes.length), bytes);
        const d191 = CL.keccak256Hex(prefixed);

        const chain = BigInt(Number($(el, '#g7-chain').value) || 1);
        const vc = $(el, '#g7-vc').value.trim();
        const domainTypeHash = CL.keccak256Hex(
          'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
        const domainSep = CL.keccak256Hex(CL.hexToBytes(
          domainTypeHash +
          CL.keccak256Hex('Roadmap Exchange') +
          CL.keccak256Hex('1') +
          pad32Hex(chain) +
          pad32Hex(vc)));
        const structHash = CL.keccak256Hex(CL.hexToBytes(
          CL.keccak256Hex('Login(string statement,uint256 nonce)') +
          CL.keccak256Hex(msg) +
          pad32Hex(1n)));
        const d712 = CL.keccak256Hex(CL.concat([0x19, 0x01], CL.hexToBytes(domainSep), CL.hexToBytes(structHash)));
        return { d191, d712, domainSep, structHash, len: bytes.length };
      }

      function run(withSig) {
        const d = digests();
        let sigTxt = '';
        if (withSig) {
          const s1 = CL.secp256k1.sign(key, CL.hexToBytes(d.d191));
          const ok = CL.secp256k1.verify(pt, CL.hexToBytes(d.d191), s1);
          sigTxt = `\nSIGNATURE over the EIP-191 digest\n` +
            `  r ${CL.bigToHex(s1.r, 32)}\n` +
            `  s ${CL.bigToHex(s1.s, 32)}\n` +
            `  recovered signer matches ${addr}: ` +
            (ok ? '<span class="good">yes</span>' : '<span class="bad">no</span>') + '\n';
        }
        $(el, '#g7-log').innerHTML =
          `signer address: <span class="hash">${addr}</span>\n\n` +
          `EIP-191 (personal_sign)\n` +
          `  preimage : "\\x19Ethereum Signed Message:\\n${d.len}" + message\n` +
          `  digest   : <span class="hash">0x${d.d191}</span>\n` +
          `  <span class="dim">The 0x19 prefix makes this unable to collide with a real transaction — without it,\n` +
          `  a site could get you to "sign a login" that is actually a transfer.</span>\n\n` +
          `EIP-712 (typed data)\n` +
          `  domainSeparator : 0x${d.domainSep}\n` +
          `  structHash      : 0x${d.structHash}\n` +
          `  digest          : <span class="hash">0x${d.d712}</span>\n` +
          `  <span class="dim">Change the chain id or the verifying contract above and this digest changes completely.\n` +
          `  That is the entire replay defence: a signature is only valid where it was meant to be used.</span>` +
          sigTxt;
      }
      $$(el, '#g7-msg, #g7-chain, #g7-vc').forEach(i => i.addEventListener('input', () => run(false)));
      $(el, '#g7-sign').onclick = () => run(true);
      run(false);
    });

  /* ---------- create2 ---------- */
  reg('create2', 'Predict a contract address',
    'CREATE depends on the deployer’s nonce; CREATE2 does not. That is why the same protocol can hold the same address on every chain.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Deployer</label><input type="text" id="d-dep" value="0x2c7536e3605d9c16a7a3d7b1898e529396a65c23"></div>
          <div class="field"><label>Nonce (CREATE)</label><input type="number" id="d-nonce" value="0" min="0"></div>
        </div>
        <div class="row">
          <div class="field"><label>Salt (any string)</label><input type="text" id="d-salt" value="roadmap.token.v1"></div>
          <div class="field"><label>Init code (creation bytecode + constructor args)</label><input type="text" id="d-init" value="0x6080604052348015600f57600080fd5b50"></div>
        </div>
        <div class="out" id="d-log"></div>`;

      function run() {
        const dep = $(el, '#d-dep').value.trim();
        if (!/^0x[0-9a-fA-F]{40}$/.test(dep)) {
          $(el, '#d-log').innerHTML = '<span class="bad">Deployer must be a 20-byte address.</span>'; return;
        }
        const nonce = Math.max(0, Number($(el, '#d-nonce').value) || 0);
        const createAddr = CL.toChecksumAddress('0x' + CL.keccak256Hex(rlpAddrNonce(dep, nonce)).slice(24));

        const saltHex = CL.keccak256Hex($(el, '#d-salt').value);
        const initHash = CL.keccak256Hex(CL.hexToBytes($(el, '#d-init').value));
        const payload = CL.concat([0xff], CL.hexToBytes(dep), CL.hexToBytes(saltHex), CL.hexToBytes(initHash));
        const create2Addr = CL.toChecksumAddress('0x' + CL.keccak256Hex(payload).slice(24));

        // show how CREATE drifts with the nonce
        const drift = [0, 1, 2, 3].map(n =>
          `  nonce ${n}: ${CL.toChecksumAddress('0x' + CL.keccak256Hex(rlpAddrNonce(dep, n)).slice(24))}`).join('\n');

        $(el, '#d-log').innerHTML =
          `CREATE\n  keccak256(rlp([deployer, nonce]))[12:]\n  <span class="hash">${createAddr}</span>\n\n` +
          `  The address moves with every deployment you make:\n${drift}\n` +
          `  <span class="dim">Deploy something else first and you land somewhere different. Not reproducible across chains.</span>\n\n` +
          `CREATE2\n  keccak256(0xff ‖ deployer ‖ salt ‖ keccak256(initCode))[12:]\n` +
          `  salt hash  : ${saltHex}\n` +
          `  init hash  : ${initHash}\n` +
          `  <span class="hash">${create2Addr}</span>\n\n` +
          `  <span class="dim">No nonce anywhere in that formula. Same deployer, salt and init code gives this exact address on\n` +
          `  every EVM chain — and you can compute it before the contract exists, which is what makes counterfactual\n` +
          `  deployment and deterministic cross-chain addresses possible.\n` +
          `  Change one constructor argument and initCode changes, so the address changes too.</span>`;
      }
      $$(el, '#d-dep, #d-nonce, #d-salt, #d-init').forEach(i => i.addEventListener('input', run));
      run();
    });

  /* ============================================================
     MODULE 5
     ============================================================ */

  /* ---------- reentrancy ---------- */
  reg('reentrancy', 'Reentrancy, step by step',
    'Watch the call stack as the attacker re-enters. Then switch on a fix and run the identical attack against it.',
    function (el) {
      el.innerHTML = `
        <div class="row" style="margin-bottom:14px">
          <div class="field"><label>Vault implementation</label>
            <select id="re-mode">
              <option value="bad">vulnerable (external call before state update)</option>
              <option value="cei">checks-effects-interactions</option>
              <option value="mutex">nonReentrant mutex</option>
            </select></div>
          <div class="field shrink"><button class="btn primary" id="re-go">Run attack</button></div>
        </div>
        <div class="out" id="re-log">Vault holds 10 ETH from honest users. The attacker deposits 1 ETH, then calls withdraw().</div>`;

      $(el, '#re-go').onclick = () => {
        const mode = $(el, '#re-mode').value;
        let vault = 10, recorded = { attacker: 0 }, stolen = 0, locked = false;
        const L = [];
        const pad = d => '  '.repeat(d);

        L.push('vault balance: 10 ETH (honest users)');
        recorded.attacker = 1; vault += 1;
        L.push('attacker.deposit(1 ETH)          vault = 11, balance[attacker] = 1');
        L.push('');

        let depth = 0;
        (function withdraw() {
          if (depth > 12) return;
          L.push(pad(depth) + `→ vault.withdraw()   depth ${depth}`);

          if (mode === 'mutex' && locked) {
            L.push(pad(depth) + '  <span class="good">revert: reentrant</span>  ← mutex already engaged');
            return;
          }
          if (mode === 'mutex') locked = true;

          const amount = recorded.attacker;
          L.push(pad(depth) + `  read balance[attacker] = ${amount}`);
          if (amount === 0) {
            L.push(pad(depth) + '  <span class="good">revert: nothing to withdraw</span>  ← state was already zeroed');
            if (mode === 'mutex') locked = false;
            return;
          }

          if (mode !== 'bad') {
            recorded.attacker = 0;
            L.push(pad(depth) + '  <span class="good">balance[attacker] = 0   (EFFECT first)</span>');
          }

          vault -= amount; stolen += amount;
          L.push(pad(depth) + `  send ${amount} ETH  — control transfers to the attacker, vault = ${vault}`);

          depth++;
          if (vault >= 1) {
            L.push(pad(depth) + 'attacker.receive() fires');
            withdraw();
          } else {
            L.push(pad(depth) + 'attacker.receive() fires — vault drained, stops');
          }
          depth--;

          if (mode === 'bad') {
            recorded.attacker = 0;
            L.push(pad(depth) + '  <span class="bad">balance[attacker] = 0   (too late — the loop already finished)</span>');
          }
          if (mode === 'mutex') locked = false;
        })();

        const verdict = stolen > 1
          ? `<span class="bad">DRAINED. Attacker deposited 1 ETH and withdrew ${stolen} ETH. Vault left with ${vault}.</span>\n\n` +
            'The balance was read before the call and written after it. Every re-entrant call saw the same stale 1.'
          : `<span class="good">ATTACK FAILED. Attacker withdrew ${stolen} ETH — exactly what they deposited. Vault holds ${vault}.</span>\n\n` +
            (mode === 'cei'
              ? 'State was updated before control left the contract, so the second call read zero and reverted.'
              : 'The mutex rejected the second entry outright. Note this stops single- and cross-function reentrancy, ' +
                'but not read-only reentrancy through an unguarded view.');

        $(el, '#re-log').innerHTML = L.join('\n') + '\n\n' + verdict;
      };
    });

  /* ---------- sandwich ---------- */
  reg('sandwich', 'Sandwich attack economics',
    'Your swap is visible in the mempool before it executes. Set a slippage tolerance and see exactly how much a bot can take.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Pool: ETH reserve</label><input type="number" id="w-x" value="100"></div>
          <div class="field"><label>Pool: USDC reserve</label><input type="number" id="w-y" value="200000"></div>
        </div>
        <div class="row">
          <div class="field"><label>Your swap (USDC in)</label><input type="number" id="w-in" value="20000"></div>
          <div class="field"><label>Slippage tolerance</label>
            <select id="w-slip">
              <option value="0.001">0.1%</option>
              <option value="0.005" selected>0.5%</option>
              <option value="0.01">1%</option>
              <option value="0.05">5%</option>
              <option value="1">unlimited (minOut = 0)</option>
            </select></div>
          <div class="field shrink"><button class="btn primary" id="w-go">Simulate</button></div>
        </div>
        <div class="out" id="w-log"></div>`;

      const FEE = 0.003;
      const out = (dIn, rIn, rOut) => {
        const eff = dIn * (1 - FEE);
        return (eff * rOut) / (rIn + eff);
      };

      $(el, '#w-go').onclick = () => {
        let x = Number($(el, '#w-x').value) || 100;          // ETH
        let y = Number($(el, '#w-y').value) || 200000;       // USDC
        const victimIn = Number($(el, '#w-in').value) || 0;
        const slip = Number($(el, '#w-slip').value);

        const cleanOut = out(victimIn, y, x);
        const minOut = slip >= 1 ? 0 : cleanOut * (1 - slip);

        // find the attacker's most profitable front-run that still lets the victim's tx land
        let best = { profit: -Infinity, front: 0, victimOut: cleanOut, reverted: false };
        for (let f = 0; f <= 200000; f += Math.max(250, victimIn / 200)) {
          let X = x, Y = y;
          const aBought = out(f, Y, X); Y += f; X -= aBought;         // front-run buy
          const vOut = out(victimIn, Y, X);
          if (vOut < minOut) continue;                                // victim tx would revert
          Y += victimIn; X -= vOut;
          const aBack = out(aBought, X, Y); X += aBought; Y -= aBack; // back-run sell
          const profit = aBack - f;
          if (profit > best.profit) best = { profit: profit, front: f, victimOut: vOut, reverted: false };
        }
        if (best.profit < 0) best = { profit: 0, front: 0, victimOut: cleanOut, reverted: false };

        const lost = cleanOut - best.victimOut;
        const lostUsd = lost * (y / x);

        $(el, '#w-log').innerHTML =
          `Pool: ${num(x)} ETH / ${num(y)} USDC   spot ${num(y / x)} USDC per ETH\n\n` +
          `WITHOUT an attacker\n` +
          `  you receive        : ${num(cleanOut, 4)} ETH\n` +
          `  your minAmountOut  : ${slip >= 1 ? '<span class="bad">0 — you authorised unlimited slippage</span>' : num(minOut, 4) + ' ETH (' + pct(slip, 1) + ' tolerance)'}\n\n` +
          `WITH a sandwich bot\n` +
          `  bot front-runs with: ${num(best.front)} USDC\n` +
          `  you receive        : ${num(best.victimOut, 4)} ETH\n` +
          `  you lost           : <span class="bad">${num(lost, 4)} ETH (≈ $${num(lostUsd)})</span>\n` +
          `  bot profit         : <span class="bad">$${num(best.profit)}</span>\n\n` +
          (best.profit <= 0.01
            ? '<span class="good">The tolerance is tight enough that no profitable sandwich exists.</span> ' +
              'Any front-run large enough to be worth the gas would push your output below minAmountOut and revert your transaction — ' +
              'which costs the bot money instead of making it.'
            : slip >= 1
              ? '<span class="bad">minOut = 0 authorises the bot to take essentially the whole trade.</span> ' +
                'This is not a bug in the router; you explicitly told it any output was acceptable.'
              : 'Your slippage tolerance is the bot’s budget. It will extract exactly up to the limit you set and no further.') +
          '\n\nDefences: tighten the tolerance, quote immediately before sending, use a short deadline, ' +
          'or route through a private mempool so the bot never sees the transaction.';
      };
      $(el, '#w-go').click();
    });

  /* ---------- gasopt ---------- */
  reg('gasopt', 'Storage packing and gas',
    'Build a struct field by field. The compiler packs sequentially and never reorders — so declaration order alone can double your gas.',
    function (el) {
      const SIZES = { 'uint256': 32, 'uint128': 16, 'uint96': 12, 'uint64': 8, 'uint32': 4, 'address': 20, 'bool': 1, 'bytes32': 32 };
      let fields = [
        { name: 'balance', type: 'uint128' },
        { name: 'owner', type: 'address' },
        { name: 'lastSeen', type: 'uint64' },
        { name: 'active', type: 'bool' }
      ];

      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Field name</label><input type="text" id="o-name" value="flags"></div>
          <div class="field"><label>Type</label><select id="o-type">${Object.keys(SIZES).map(t => `<option>${t}</option>`).join('')}</select></div>
          <div class="field shrink"><button class="btn ghost sm" id="o-add">Add field</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="o-clear">Clear</button></div>
        </div>
        <div class="out" id="o-log"></div>`;

      function pack(list) {
        const slots = [];
        let cur = [], used = 0;
        list.forEach(f => {
          const sz = SIZES[f.type];
          if (used + sz > 32) { slots.push({ items: cur, used: used }); cur = []; used = 0; }
          cur.push(f); used += sz;
        });
        if (cur.length) slots.push({ items: cur, used: used });
        return slots;
      }
      function show(slots) {
        return slots.map((s, i) =>
          `  slot ${i}  [${String(s.used).padStart(2)}/32 bytes]  ` +
          s.items.map(f => `${f.type} ${f.name}`).join(' + ') +
          (s.used < 32 ? `  <span class="dim">(${32 - s.used} wasted)</span>` : '')
        ).join('\n');
      }

      function run() {
        if (!fields.length) { $(el, '#o-log').innerHTML = 'Add some fields.'; return; }
        const asIs = pack(fields);
        const sorted = pack(fields.slice().sort((a, b) => SIZES[b.type] - SIZES[a.type]));
        const costA = asIs.length * 20000, costB = sorted.length * 20000;

        $(el, '#o-log').innerHTML =
          'AS DECLARED\n' + show(asIs) + `\n  slots: ${asIs.length}   first-write cost: ${num(costA)} gas\n\n` +
          'REORDERED (largest first)\n' + show(sorted) + `\n  slots: ${sorted.length}   first-write cost: ${num(costB)} gas\n\n` +
          (costA > costB
            ? `<span class="good">Saving: ${num(costA - costB)} gas per fresh write (${pct((costA - costB) / costA, 0)}), from reordering alone.</span>\n` +
              'No logic changed. The compiler packs in declaration order and will not reorder for you.'
            : '<span class="good">Already optimally packed.</span> No reordering can reduce the slot count.') +
          '\n\n<span class="dim">SSTORE zero → non-zero costs 20,000; non-zero → non-zero costs 2,900; SLOAD costs 2,100 cold / 100 warm.\n' +
          'Arithmetic costs 3. Optimise slots, calls and calldata — never loop arithmetic.\n' +
          'Careful: a standalone uint8 is MORE expensive than uint256, because narrowing needs masking. ' +
          'Packing only pays when values share a slot.</span>';
      }
      $(el, '#o-add').onclick = () => {
        const n = $(el, '#o-name').value.trim() || ('f' + fields.length);
        fields.push({ name: n, type: $(el, '#o-type').value });
        run();
      };
      $(el, '#o-clear').onclick = () => { fields = []; run(); };
      run();
    });

  /* ============================================================
     MODULE 6
     ============================================================ */

  /* ---------- amm ---------- */
  reg('amm', 'Constant product AMM',
    'Swap against x·y=k and watch price impact grow non-linearly, then price the impermanent loss an LP takes on any move.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Reserve X (ETH)</label><input type="number" id="m-x" value="100"></div>
          <div class="field"><label>Reserve Y (USDC)</label><input type="number" id="m-y" value="200000"></div>
          <div class="field"><label>Sell (ETH)</label><input type="number" id="m-in" value="5" step="0.5"></div>
          <div class="field"><label>Fee</label>
            <select id="m-fee"><option value="0.003" selected>0.30%</option><option value="0.0005">0.05%</option><option value="0.01">1.00%</option></select></div>
        </div>
        <div class="out" id="m-out" style="margin-bottom:14px"></div>
        <div class="bars" id="m-bars"></div>
        <div class="field" style="margin-top:16px"><label>Impermanent loss: price ratio change</label>
          <input type="range" id="m-il" min="10" max="400" value="200"></div>
        <div class="out" id="m-ilout"></div>`;

      function amountOut(dIn, rIn, rOut, fee) {
        const eff = dIn * (1 - fee);
        return (eff * rOut) / (rIn + eff);
      }
      function run() {
        const x = Number($(el, '#m-x').value) || 1;
        const y = Number($(el, '#m-y').value) || 1;
        const dIn = Number($(el, '#m-in').value) || 0;
        const fee = Number($(el, '#m-fee').value);

        const spot = y / x;
        const dOut = amountOut(dIn, x, y, fee);
        const exec = dIn > 0 ? dOut / dIn : spot;
        const impact = (spot - exec) / spot;
        const k0 = x * y, k1 = (x + dIn) * (y - dOut);

        $(el, '#m-out').innerHTML =
          `k = ${num(k0)}   spot = ${num(spot)} USDC/ETH\n\n` +
          `  sell        : ${num(dIn, 4)} ETH\n` +
          `  receive     : ${num(dOut, 2)} USDC\n` +
          `  executed at : ${num(exec, 2)} USDC/ETH\n` +
          `  price impact: <span class="${impact > 0.02 ? 'bad' : 'good'}">${pct(impact)}</span>  <span class="dim">(fee is only ${pct(fee, 2)} of it)</span>\n` +
          `  new reserves: ${num(x + dIn, 2)} ETH / ${num(y - dOut, 2)} USDC\n` +
          `  new k       : ${num(k1)}  <span class="good">≥ old k</span>  <span class="dim">(fees grow k — that is how LPs earn)</span>\n` +
          `  new spot    : ${num((y - dOut) / (x + dIn), 2)} USDC/ETH`;

        const fracs = [0.01, 0.05, 0.10, 0.25, 0.50, 1.00];
        const maxImp = 0.55;
        $(el, '#m-bars').innerHTML = fracs.map(f => {
          const a = x * f;
          const o = amountOut(a, x, y, fee);
          const imp = (spot - o / a) / spot;
          return `<div class="barrow">
            <span>${pct(f, 0)} of pool</span>
            <span class="track"><i style="width:${Math.min(100, imp / maxImp * 100).toFixed(1)}%"></i></span>
            <span>${pct(imp, 1)}</span></div>`;
        }).join('') + '<div class="dim" style="font-size:12px;margin-top:6px">Price impact against trade size. It is not linear — which is exactly why a flash loan can distort a thin pool so cheaply.</div>';
      }

      function runIL() {
        const r = Number($(el, '#m-il').value) / 100;
        const il = (2 * Math.sqrt(r)) / (1 + r) - 1;
        $(el, '#m-ilout').innerHTML =
          `price ratio change: ${r.toFixed(2)}x\n` +
          `IL = 2√ r / (1 + r) − 1 = <span class="${il < -0.02 ? 'bad' : 'dim'}">${pct(il)}</span> versus simply holding both tokens\n\n` +
          'Arbitrageurs rebalance the pool toward the market price, leaving the LP holding more of the asset that fell.\n' +
          '"Impermanent" only if the price comes back — withdraw at a different price and the loss is realised.\n' +
          'LP profit = accumulated fees − IL. Fees scale with volume; IL scales with the size of the move.';
      }
      $$(el, '#m-x, #m-y, #m-in, #m-fee').forEach(i => i.addEventListener('input', run));
      $(el, '#m-il').addEventListener('input', runIL);
      run(); runIL();
    });

  /* ---------- lending ---------- */
  reg('lending', 'Health factor and liquidation',
    'Open a position, then drag the price down until a liquidator can take it. The numbers are the same ones Aave and Compound run on.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Collateral (ETH)</label><input type="number" id="l-col" value="10"></div>
          <div class="field"><label>Debt (USDC)</label><input type="number" id="l-debt" value="10000"></div>
          <div class="field"><label>Liquidation threshold</label>
            <select id="l-thr"><option value="0.825" selected>82.5%</option><option value="0.75">75%</option><option value="0.90">90%</option></select></div>
        </div>
        <div class="field"><label>ETH price: <span id="l-plabel">$2000</span></label>
          <input type="range" id="l-price" min="500" max="3500" value="2000" step="10"></div>
        <div class="out" id="l-log" style="margin-bottom:12px"></div>
        <button class="btn primary" id="l-liq">Attempt liquidation</button>`;

      function state() {
        const col = Number($(el, '#l-col').value) || 0;
        const debt = Number($(el, '#l-debt').value) || 0;
        const thr = Number($(el, '#l-thr').value);
        const price = Number($(el, '#l-price').value);
        const hf = debt > 0 ? (col * price * thr) / debt : Infinity;
        const liqPrice = col > 0 ? debt / (col * thr) : 0;
        return { col: col, debt: debt, thr: thr, price: price, hf: hf, liqPrice: liqPrice };
      }
      function run(extra) {
        const s = state();
        $(el, '#l-plabel').textContent = '$' + num(s.price);
        const cls = s.hf >= 1.5 ? 'good' : s.hf >= 1.05 ? 'dim' : 'bad';
        $(el, '#l-log').innerHTML =
          `collateral value : $${num(s.col * s.price)}   (${num(s.col, 2)} ETH at $${num(s.price)})\n` +
          `debt             : $${num(s.debt)}\n` +
          `max borrow (75% LTV): $${num(s.col * s.price * 0.75)}\n\n` +
          `health factor    : <span class="${cls}">${s.hf === Infinity ? '∞' : s.hf.toFixed(3)}</span>` +
          (s.hf < 1 ? '  <span class="bad">← LIQUIDATABLE</span>' : '') + '\n' +
          `liquidation price: <span class="hash">$${num(s.liqPrice)}</span>  <span class="dim">(ETH price where HF hits 1.00)</span>\n` +
          `buffer           : ${pct((s.price - s.liqPrice) / s.price, 1)} below current price\n\n` +
          (s.hf >= 1
            ? 'Position is safe. Note the two separate parameters: LTV caps what you may borrow when opening, ' +
              'the liquidation threshold is where you get taken. The gap between them is your buffer.'
            : '<span class="bad">Anyone may now repay part of this debt and seize collateral at a discount.</span> ' +
              'Bots watch every position continuously and race for it — usually funded by a flash loan, so they need no capital.') +
          (extra ? '\n\n' + extra : '');
      }
      $(el, '#l-liq').onclick = () => {
        const s = state();
        if (s.hf >= 1) return run('<span class="bad">revert: position is healthy (HF ≥ 1). Liquidation is not permitted.</span>');
        const repay = s.debt * 0.5;                            // 50% close factor
        const seizeUsd = repay * 1.05;                         // 5% bonus
        const seizeEth = seizeUsd / s.price;
        $(el, '#l-col').value = (s.col - seizeEth).toFixed(4);
        $(el, '#l-debt').value = (s.debt - repay).toFixed(2);
        run(`<span class="good">LIQUIDATED.</span>\n` +
          `  liquidator repays : $${num(repay)}  <span class="dim">(50% close factor — partial, not the whole position)</span>\n` +
          `  collateral seized : ${num(seizeEth, 4)} ETH ($${num(seizeUsd)})\n` +
          `  liquidator profit : $${num(seizeUsd - repay)}  <span class="dim">(the 5% bonus)</span>\n\n` +
          'The bonus is not a punishment for its own sake — it pays for a service the protocol cannot perform itself. ' +
          'Set it too low and underwater positions go unliquidated, and the shortfall becomes protocol bad debt.\n' +
          'Notice the position is now healthier: partial liquidation is deliberately self-correcting.');
      };
      $$(el, '#l-col, #l-debt, #l-thr, #l-price').forEach(i => i.addEventListener('input', () => run()));
      run();
    });

  /* ---------- rollup ---------- */
  reg('rollup', 'Rollup economics and withdrawal paths',
    'L2 fees are dominated by what it costs to publish data on L1. Change the batch size and see why EIP-4844 mattered so much.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Txs per batch</label><input type="number" id="ro-n" value="500"></div>
          <div class="field"><label>Bytes per tx (compressed)</label><input type="number" id="ro-b" value="120"></div>
          <div class="field"><label>L1 gas price (gwei)</label><input type="number" id="ro-g" value="30"></div>
          <div class="field"><label>ETH price ($)</label><input type="number" id="ro-e" value="3000"></div>
        </div>
        <div class="out" id="ro-log"></div>`;

      function run() {
        const n = Math.max(1, Number($(el, '#ro-n').value) || 1);
        const b = Math.max(1, Number($(el, '#ro-b').value) || 1);
        const g = Number($(el, '#ro-g').value) || 1;
        const eth = Number($(el, '#ro-e').value) || 1;

        const calldataGas = b * 16;                       // 16 gas per non-zero byte
        const calldataUsd = calldataGas * g * 1e-9 * eth;
        const blobGas = b * 1;                            // ~1 gas per byte, own fee market
        const blobUsd = blobGas * (g / 1000) * 1e-9 * eth; // blob market typically far below L1
        const l2Exec = 0.00002 * eth;
        const l1Direct = 100000 * g * 1e-9 * eth;         // a plain L1 swap

        $(el, '#ro-log').innerHTML =
          `Per transaction, ${num(n)} txs per batch, ${b} bytes each:\n\n` +
          `  L1 direct (swap, ~100k gas)     $${l1Direct.toFixed(4)}\n` +
          `  L2 with calldata (pre-4844)     $${(calldataUsd + l2Exec).toFixed(4)}   <span class="dim">${num(l1Direct / (calldataUsd + l2Exec), 0)}x cheaper than L1</span>\n` +
          `  L2 with blobs (EIP-4844)        <span class="good">$${(blobUsd + l2Exec).toFixed(5)}</span>   <span class="dim">${num(l1Direct / (blobUsd + l2Exec), 0)}x cheaper than L1</span>\n\n` +
          `Batch data posted to L1: ${num(n * b)} bytes for ${num(n)} transactions.\n` +
          `<span class="dim">Cost per transaction falls as the batch grows — batching IS the business model, and\n` +
          `compression is a first-class engineering concern on every L2.</span>\n\n` +
          `WITHDRAWAL BACK TO L1\n` +
          `  optimistic (Arbitrum, Optimism, Base)   ~7 days   <span class="dim">the fraud-proof challenge window</span>\n` +
          `  validity / ZK (zkSync, Starknet, Scroll) minutes to hours  <span class="dim">no challenge needed, the proof settles it</span>\n` +
          `  third-party "fast bridge"               minutes   <span class="dim">an LP fronts you the funds and waits out the window —\n` +
          `                                                    you are paying for their capital and taking their counterparty risk</span>\n\n` +
          `<span class="dim">Where the data lives decides the security tier: on L1 = rollup (full L1 security);\n` +
          'off-chain committee = validium (they can withhold data and freeze your funds);\n' +
          'alt-DA layer = the security of that layer, not Ethereum’s.</span>';
      }
      $$(el, '#ro-n, #ro-b, #ro-g, #ro-e').forEach(i => i.addEventListener('input', run));
      run();
    });

  /* ---------- commit ---------- */
  reg('commit', 'Commit-reveal, and why the salt is everything',
    'Hide a bid behind a hash, then reveal it. Drop the salt and watch the commitment get cracked in milliseconds.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Your bid</label><input type="number" id="cm-bid" value="1500"></div>
          <div class="field"><label>Salt</label><input type="text" id="cm-salt" value=""></div>
          <div class="field shrink"><button class="btn ghost sm" id="cm-rand">Random salt</button></div>
          <div class="field shrink"><button class="btn primary" id="cm-commit">Commit</button></div>
        </div>
        <div class="row" style="margin-bottom:14px">
          <div class="field"><label>Reveal value</label><input type="number" id="cm-rev" value="1500"></div>
          <div class="field shrink"><button class="btn ghost sm" id="cm-reveal">Reveal</button></div>
          <div class="field shrink"><button class="btn ghost sm" id="cm-crack">Attacker: crack it</button></div>
        </div>
        <div class="out" id="cm-log">A commitment must be HIDING (reveals nothing) and BINDING (cannot be changed later). Only one of those is free.</div>`;

      let committed = null;
      function commitment(bid, salt) {
        return CL.keccak256Hex(CL.concat(
          CL.bigToBytes(BigInt(bid), 32),
          CL.utf8ToBytes(salt),
          CL.hexToBytes(ADDRS.alice)));
      }

      $(el, '#cm-rand').onclick = () => { $(el, '#cm-salt').value = CL.bytesToHex(CL.randomBytes(16)); };
      $(el, '#cm-commit').onclick = () => {
        const bid = Math.max(0, Math.floor(Number($(el, '#cm-bid').value) || 0));
        const salt = $(el, '#cm-salt').value;
        committed = { bid: bid, salt: salt, h: commitment(bid, salt) };
        $(el, '#cm-log').innerHTML =
          `commitment = keccak256(abi.encodePacked(amount, salt, msg.sender))\n\n` +
          `  amount : ${bid}  <span class="dim">(hidden)</span>\n` +
          `  salt   : ${salt ? esc(salt) : '<span class="bad">EMPTY — no entropy at all</span>'}\n` +
          `  sender : ${ADDRS.alice}  <span class="dim">(stops anyone copying your commitment as their own bid)</span>\n\n` +
          `  <span class="hash">0x${committed.h}</span>\n\n` +
          'This is what goes on chain. Nobody — including the seller — can see the bid until the reveal phase opens.' +
          (salt ? '' : '\n<span class="bad">With no salt, that claim is false. Try the crack button.</span>');
      };

      $(el, '#cm-reveal').onclick = () => {
        if (!committed) return;
        const v = Math.max(0, Math.floor(Number($(el, '#cm-rev').value) || 0));
        const h = commitment(v, committed.salt);
        const ok = h === committed.h;
        $(el, '#cm-log').innerHTML =
          `reveal(${v}, "${esc(committed.salt)}")\n\n` +
          `  recomputed : 0x${h}\n` +
          `  stored     : 0x${committed.h}\n\n` +
          (ok
            ? '<span class="good">ACCEPTED.</span> The commitment is binding: you can only reveal the exact value you committed to. ' +
              'Changing your mind would require finding a hash collision.'
            : '<span class="bad">REJECTED.</span> Hashes differ, so this is not the value that was committed. ' +
              'This is the binding property doing its job.\n\n' +
              'A real auction also forfeits the deposit of anyone who never reveals — otherwise a bidder could commit ' +
              'and simply decline to reveal a losing bid at zero cost.');
      };

      $(el, '#cm-crack').onclick = () => {
        if (!committed) { $(el, '#cm-log').innerHTML = 'Commit something first.'; return; }
        const t0 = performance.now();
        let found = null, tried = 0;
        for (let v = 0; v <= 20000; v += 1) {
          tried++;
          if (commitment(v, committed.salt) === committed.h) { found = v; break; }
        }
        const ms = performance.now() - t0;
        $(el, '#cm-log').innerHTML = found !== null
          ? `<span class="bad">COMMITMENT CRACKED in ${ms.toFixed(0)}ms after ${num(tried)} guesses.</span>\n\n` +
            `  recovered bid: ${found}\n\n` +
            'The attacker only had to hash every plausible bid and compare. Hashing is public and deterministic — ' +
            'hiding requires entropy the attacker cannot enumerate.\n' +
            'This is exactly why a saltless commit-reveal vote of "yes" or "no" provides zero privacy: two guesses.'
          : `<span class="good">Not cracked.</span> Tried ${num(tried)} candidate bids in ${ms.toFixed(0)}ms and found nothing.\n\n` +
            'The salt adds 128 bits of entropy, so the attacker would have to search 2^128 combinations rather than 20,000. ' +
            'Same hash function, same bid — the only difference is the random value mixed in.\n' +
            '<span class="dim">Store the salt locally: the contract cannot help you recover it, and without it your bid can never be revealed.</span>';
      };
    });

  /* ---------- export ---------- */
  global.LABS = LABS;
})(window);
