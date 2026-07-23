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

  /* ============================================================
     MODULE 7
     ============================================================ */

  /* ---------- Sui object ownership ---------- */
  reg('suiobjects', 'Sui object ownership and execution',
    'Choose an object’s ownership and see which execution path its update needs. The simulation also advances the object version, just like a successful mutable-object transaction.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Object kind</label><select id="so-kind"><option value="owned">Address-owned badge</option><option value="shared">Shared AMM pool</option><option value="immutable">Immutable metadata</option><option value="wrapped">Object-owned inventory item</option></select></div>
          <div class="field"><label>Current version</label><input id="so-ver" type="number" value="4" min="1"></div>
          <div class="field shrink"><button class="btn primary" id="so-run">Build update</button></div>
        </div>
        <div class="out" id="so-log"></div>`;
      const kind = $(el, '#so-kind'), version = $(el, '#so-ver'), log = $(el, '#so-log');
      function run() {
        const v = Math.max(1, Math.floor(Number(version.value) || 1));
        const k = kind.value;
        const cfg = {
          owned: { name: 'address-owned Badge', path: 'owned-object fast path', use: 'Alice alone controls the mutable input.', result: 'Badge level increases and ownership remains with Alice.' },
          shared: { name: 'shared AMM pool', path: 'consensus ordering', use: 'Any trader can target the same mutable pool, so validators must agree on order.', result: 'Pool reserves update after its ordered transaction executes.' },
          immutable: { name: 'immutable metadata', path: 'read-only input', use: 'No transaction may mutate an immutable object.', result: 'Rejected: choose an owned or shared object for an update.' },
          wrapped: { name: 'object-owned inventory item', path: 'parent-authorised object access', use: 'The item is controlled through its parent inventory object.', result: 'The parent inventory and its child item advance together.' }
        }[k];
        const next = k === 'immutable' ? v : v + 1;
        log.innerHTML =
          `OBJECT INPUT\n  kind    ${cfg.name}\n  reference  0xBAD6…E001 @ version ${v}\n\n` +
          `EXECUTION PATH\n  <span class="${k === 'shared' ? 'hash' : k === 'immutable' ? 'bad' : 'good'}">${cfg.path}</span>\n  ${cfg.use}\n\n` +
          `EFFECT\n  ${cfg.result}\n` +
          (k === 'immutable' ? '' : `  new reference  0xBAD6…E001 @ version ${next}\n\n<span class="dim">A later transaction built with version ${v} is now stale and must fetch this new version.</span>`);
        version.value = next;
      }
      $(el, '#so-run').onclick = run; kind.onchange = run; run();
    });

  /* ---------- abilities and capability ---------- */
  reg('suicap', 'Move abilities and capability checks',
    'Toggle a type’s abilities, then try a privileged operation with and without the scarce AdminCap resource.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field shrink"><label><input id="sc-copy" type="checkbox"> copy</label></div>
          <div class="field shrink"><label><input id="sc-drop" type="checkbox"> drop</label></div>
          <div class="field shrink"><label><input id="sc-store" type="checkbox" checked> store</label></div>
          <div class="field shrink"><label><input id="sc-key" type="checkbox" checked> key</label></div>
          <div class="field shrink"><label><input id="sc-cap" type="checkbox" checked> caller supplies AdminCap</label></div>
          <div class="field shrink"><button class="btn primary" id="sc-run">Check design</button></div>
        </div>
        <div class="out" id="sc-log"></div>`;
      function checked(id) { return $(el, id).checked; }
      function run() {
        const copy = checked('#sc-copy'), drop = checked('#sc-drop'), store = checked('#sc-store'), key = checked('#sc-key'), cap = checked('#sc-cap');
        const lines = [];
        lines.push(`TYPE DECLARATION\n  public struct Ticket has ${[copy && 'copy', drop && 'drop', store && 'store', key && 'key'].filter(Boolean).join(', ') || '(no abilities)'}`);
        lines.push(`\nASSET SAFETY\n  duplicate ticket  ${copy ? '<span class="bad">ALLOWED — unsuitable for a scarce ticket</span>' : '<span class="good">REJECTED by Move</span>'}`);
        lines.push(`  discard ticket    ${drop ? '<span class="bad">ALLOWED — unused tickets may silently vanish</span>' : '<span class="good">REJECTED by Move</span>'}`);
        lines.push(`  store as child    ${store ? '<span class="good">allowed</span>' : '<span class="dim">not allowed</span>'}`);
        lines.push(`  global object     ${key ? '<span class="good">allowed (needs a UID field)</span>' : '<span class="dim">not an object</span>'}`);
        lines.push(`\nADMIN ACTION\n  pause(treasury)  ${cap ? '<span class="good">ACCEPTED — caller proves authority with &AdminCap</span>' : '<span class="bad">REJECTED — object ID is not an authorisation check</span>'}`);
        $(el, '#sc-log').innerHTML = lines.join('\n');
      }
      $$(el, 'input').forEach(i => i.onchange = run); $(el, '#sc-run').onclick = run; run();
    });

  /* ---------- programmable transaction block ---------- */
  reg('suiptb', 'Programmable transaction block builder',
    'Split the gas coin into payments, optionally mint a Badge, and transfer every result. The commands execute atomically in the displayed order.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Gas coin balance (MIST)</label><input id="sp-balance" type="number" value="5000000" min="0"></div>
          <div class="field"><label>First payment (MIST)</label><input id="sp-pay1" type="number" value="1000000" min="0"></div>
          <div class="field"><label>Second payment (MIST)</label><input id="sp-pay2" type="number" value="500000" min="0"></div>
          <div class="field shrink"><label><input id="sp-mint" type="checkbox" checked> mint Badge</label></div>
          <div class="field shrink"><button class="btn primary" id="sp-build">Build PTB</button></div>
        </div>
        <div class="out" id="sp-log"></div>`;
      function run() {
        const balance = Math.max(0, Math.floor(Number($(el, '#sp-balance').value) || 0));
        const a = Math.max(0, Math.floor(Number($(el, '#sp-pay1').value) || 0));
        const b = Math.max(0, Math.floor(Number($(el, '#sp-pay2').value) || 0));
        const mint = $(el, '#sp-mint').checked, total = a + b;
        if (total > balance) {
          $(el, '#sp-log').innerHTML = `<span class="bad">BUILD FAILED.</span> splitCoins requests ${num(total)} MIST but the gas coin only has ${num(balance)} MIST. No command is signed or executed.`;
          return;
        }
        const commands = [
          `0  SplitCoins(gas, [${num(a)}, ${num(b)}])  → payment0, payment1`,
          mint ? '1  MoveCall(workshop::badge::mint, "PTB learner")  → badge' : null,
          `2  TransferObjects([payment0], recipientA)`,
          `3  TransferObjects([payment1${mint ? ', badge' : ''}], recipientB)`
        ].filter(Boolean);
        $(el, '#sp-log').innerHTML =
          `<span class="good">PTB READY — one signature, all-or-nothing.</span>\n\nCOMMANDS\n${commands.join('\n')}\n\nRESULTS\n  gas coin change      ${num(balance - total)} MIST\n  recipient A          ${num(a)} MIST\n  recipient B          ${num(b)} MIST${mint ? '\n  badge                newly minted object' : ''}\n\n<span class="dim">The split outputs are transaction-local values. They are never published as loose intermediate objects.</span>`;
      }
      $$(el, 'input').forEach(i => i.oninput = run); $(el, '#sp-build').onclick = run; run();
    });

  /* ---------- shared state ---------- */
  reg('suishared', 'Shared coordination versus owned state',
    'Submit scores to one shared scoreboard, or update independent user inventories. The counters make the contention difference visible without pretending to be a real network benchmark.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Player</label><select id="ss-player"><option>Alice</option><option>Bob</option><option>Carol</option></select></div>
          <div class="field"><label>Score</label><input id="ss-score" type="number" value="10" min="0"></div>
          <div class="field shrink"><button class="btn primary" id="ss-shared">Submit to shared board</button></div>
          <div class="field shrink"><button class="btn ghost" id="ss-owned">Add to owned inventory</button></div>
        </div>
        <div class="out" id="ss-log"></div>`;
      let high = 0, sharedWrites = 0, ownedWrites = 0, events = [];
      function render(last) {
        $(el, '#ss-log').innerHTML =
          `STATE\n  shared Scoreboard high score   <span class="hash">${num(high)}</span>\n  shared mutations ordered       ${num(sharedWrites)}\n  independent owned mutations    ${num(ownedWrites)}\n\n` +
          `${last || '<span class="dim">Choose an action to produce a transaction effect.</span>'}\n\n` +
          `EVENTS\n${events.length ? events.slice(-4).map(e => `  ScoreSubmitted { player: ${e.player}, score: ${e.score} }`).join('\n') : '  (none yet)'}\n\n` +
          '<span class="dim">The shared scoreboard is a deliberate coordination point. Inventory changes touch separate address-owned objects and do not contend with one another.</span>';
      }
      $(el, '#ss-shared').onclick = () => {
        const player = $(el, '#ss-player').value, score = Math.max(0, Math.floor(Number($(el, '#ss-score').value) || 0));
        high = Math.max(high, score); sharedWrites++; events.push({ player, score });
        render(`<span class="good">SHARED OBJECT UPDATED.</span> ${player} submitted ${num(score)}; consensus orders this mutation against other scoreboard submissions.`);
      };
      $(el, '#ss-owned').onclick = () => {
        const player = $(el, '#ss-player').value; ownedWrites++;
        render(`<span class="good">OWNED OBJECT UPDATED.</span> ${player} received an inventory item; this address-owned mutation can execute independently of other players’ inventories.`);
      };
      render();
    });

  /* ---------- Kiosk policy ---------- */
  reg('suikiosk', 'Kiosk transfer-policy simulator',
    'Put an item in a Kiosk, select a transfer policy, and see the payment, policy receipt and final transfer as one flow.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Listed price (SUI)</label><input id="sk-price" type="number" value="12" min="0" step="0.1"></div>
          <div class="field"><label>Policy</label><select id="sk-policy"><option value="free">Free transfer</option><option value="royalty">5% creator royalty</option><option value="allow">Allowlist required</option></select></div>
          <div class="field shrink"><label><input id="sk-allowed" type="checkbox" checked> buyer is allowlisted</label></div>
          <div class="field shrink"><button class="btn primary" id="sk-buy">Purchase through Kiosk</button></div>
        </div>
        <div class="out" id="sk-log"></div>`;
      function run() {
        const price = Math.max(0, Number($(el, '#sk-price').value) || 0);
        const policy = $(el, '#sk-policy').value, allowed = $(el, '#sk-allowed').checked;
        if (policy === 'allow' && !allowed) {
          $(el, '#sk-log').innerHTML = `<span class="bad">TRANSFER NOT CONFIRMED.</span> The policy did not issue its allowlist receipt, so the Kiosk request cannot release the item. Seller and buyer balances stay unchanged.`;
          return;
        }
        const royalty = policy === 'royalty' ? price * 0.05 : 0;
        const seller = price - royalty;
        const steps = [
          '1  Kiosk takes the listed item into a transaction-local request',
          `2  Buyer supplies ${price.toFixed(2)} SUI payment`,
          policy === 'free' ? '3  Free-transfer policy records no additional rule' :
            policy === 'royalty' ? `3  Royalty rule sends ${royalty.toFixed(2)} SUI to creator and records receipt` :
              '3  Allowlist rule verifies buyer and records receipt',
          '4  TransferPolicy confirms request; item moves to buyer'
        ];
        $(el, '#sk-log').innerHTML = `<span class="good">TRANSFER CONFIRMED.</span>\n\n${steps.join('\n')}\n\nSETTLEMENT\n  seller     ${seller.toFixed(2)} SUI\n  creator    ${royalty.toFixed(2)} SUI\n  buyer      receives the object\n\n<span class="dim">A different UI cannot skip an on-chain transfer policy. It must satisfy the same rules before confirmation.</span>`;
      }
      $$(el, 'input, select').forEach(i => i.oninput = run); $(el, '#sk-buy').onclick = run; run();
    });

  /* ---------- sponsored transactions ---------- */
  reg('suisponsor', 'Sponsored-transaction policy gate',
    'Ask a gas station to sponsor an onboarding call. Change the target or budget to see the checks that should happen before a sponsor key signs.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Move target</label><select id="sg-target"><option value="badge">workshop::badge::mint</option><option value="score">workshop::scoreboard::submit</option><option value="unknown">unknown::drain::all</option></select></div>
          <div class="field"><label>Gas budget (MIST)</label><input id="sg-gas" type="number" value="5000000" min="0"></div>
          <div class="field shrink"><label><input id="sg-user" type="checkbox" checked> user signed exact bytes</label></div>
          <div class="field shrink"><button class="btn primary" id="sg-check">Request sponsorship</button></div>
        </div>
        <div class="out" id="sg-log"></div>`;
      function run() {
        const target = $(el, '#sg-target').value, gas = Math.max(0, Number($(el, '#sg-gas').value) || 0), signed = $(el, '#sg-user').checked;
        const errors = [];
        if (target === 'unknown') errors.push('target is not on the sponsor allowlist');
        if (gas > 10_000_000) errors.push('gas budget exceeds 10,000,000 MIST cap');
        if (!signed) errors.push('no valid user signature over final transaction bytes');
        $(el, '#sg-log').innerHTML = errors.length
          ? `<span class="bad">SPONSOR DECLINED.</span>\n\n${errors.map(x => '  • ' + x).join('\n')}\n\n<span class="dim">Nothing should reach the sponsor signing key until every policy check passes.</span>`
          : `<span class="good">SPONSOR APPROVED.</span>\n\n  sender          user address\n  gas owner       gas station\n  target          ${target === 'badge' ? 'workshop::badge::mint' : 'workshop::scoreboard::submit'}\n  budget          ${num(gas)} MIST\n\nSIGNATURES\n  1  user signs transaction intent\n  2  sponsor signs the same final bytes\n\n<span class="dim">A changed recipient, amount or target changes the bytes and requires a fresh user signature.</span>`;
      }
      $$(el, 'input, select').forEach(i => i.oninput = run); $(el, '#sg-check').onclick = run; run();
    });

  /* ---------- authentication choices ---------- */
  reg('suiauth', 'Walletless authentication threat model',
    'Choose an onboarding approach and inspect the secret material, external dependency and recovery question it introduces.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Account approach</label><select id="sa-mode"><option value="wallet">Traditional wallet</option><option value="zklogin">zkLogin with OAuth</option><option value="passkey">WebAuthn passkey</option></select></div>
          <div class="field shrink"><button class="btn primary" id="sa-show">Inspect flow</button></div>
        </div>
        <div class="out" id="sa-log"></div>`;
      const flows = {
        wallet: { title: 'TRADITIONAL WALLET', secrets: 'private key / seed phrase held by the wallet', dependency: 'wallet provider and the user’s backup practice', recovery: 'restore or connect another wallet; never ask your app server for a seed phrase', steps: ['wallet displays transaction', 'user signs with account key', 'client submits signature'] },
        zklogin: { title: 'ZKLOGIN', secrets: 'ephemeral private key and privacy-sensitive user salt', dependency: 'OAuth issuer, proof generation path and client key storage', recovery: 'define salt and account-linking recovery without turning the app server into a key custodian', steps: ['OAuth login returns identity token', 'client binds token to ephemeral key and max epoch', 'proof + ephemeral signature authorise transaction'] },
        passkey: { title: 'PASSKEY', secrets: 'WebAuthn credential private key protected by authenticator', dependency: 'authenticator, RP ID/origin checks and platform credential sync', recovery: 'link a second credential or recovery guardian before the first device is lost', steps: ['client creates a WebAuthn challenge', 'authenticator signs after local user verification', 'server verifies origin, challenge and credential'] }
      };
      function run() {
        const f = flows[$(el, '#sa-mode').value];
        $(el, '#sa-log').innerHTML = `<span class="hash">${f.title}</span>\n\nFLOW\n${f.steps.map((x, i) => `  ${i + 1}  ${x}`).join('\n')}\n\nSENSITIVE MATERIAL\n  ${f.secrets}\n\nEXTERNAL DEPENDENCY\n  ${f.dependency}\n\nRECOVERY QUESTION\n  ${f.recovery}\n\n<span class="dim">“Walletless” changes the UX, not the need for a precise custody and recovery promise.</span>`;
      }
      $(el, '#sa-mode').onchange = run; $(el, '#sa-show').onclick = run; run();
    });

  /* ---------- order book ---------- */
  reg('suibook', 'Limit-order book matcher',
    'Sweep a small ask book with a buy limit. Only asks at or below the limit may fill; any unfilled size remains the buyer’s order or is returned by the chosen execution policy.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Buy limit (SUI / token)</label><input id="sb-limit" type="number" value="10" min="0" step="0.1"></div>
          <div class="field"><label>Wanted tokens</label><input id="sb-size" type="number" value="8" min="0" step="0.1"></div>
          <div class="field shrink"><button class="btn primary" id="sb-match">Match order</button></div>
        </div>
        <div class="out" id="sb-log"></div>`;
      const asks = [{ price: 9.2, size: 2 }, { price: 9.8, size: 4 }, { price: 10.4, size: 5 }];
      function run() {
        const limit = Math.max(0, Number($(el, '#sb-limit').value) || 0), wanted = Math.max(0, Number($(el, '#sb-size').value) || 0);
        let remaining = wanted, spent = 0, fills = [];
        asks.forEach(ask => {
          if (ask.price > limit || remaining <= 0) return;
          const size = Math.min(ask.size, remaining); remaining -= size; spent += size * ask.price; fills.push({ price: ask.price, size });
        });
        $(el, '#sb-log').innerHTML =
          `ASK BOOK\n${asks.map(a => `  ${a.size.toFixed(1)} tokens @ ${a.price.toFixed(2)} SUI`).join('\n')}\n\n` +
          `FILLS\n${fills.length ? fills.map(f => `  buy ${f.size.toFixed(1)} @ ${f.price.toFixed(2)} = ${(f.size * f.price).toFixed(2)} SUI`).join('\n') : '  <span class="bad">none — every ask is above the limit</span>'}\n\n` +
          `RESULT\n  filled      ${(wanted - remaining).toFixed(1)} / ${wanted.toFixed(1)} tokens\n  spent       ${spent.toFixed(2)} SUI\n  remaining   ${remaining.toFixed(1)} tokens${remaining ? ' <span class="dim">(resting limit order or returned input)</span>' : ''}\n\n` +
          '<span class="dim">A real PTB can place/take the order, transfer filled output and return change atomically around the shared market call.</span>';
      }
      $$(el, 'input').forEach(i => i.oninput = run); $(el, '#sb-match').onclick = run; run();
    });

  /* ---------- Sui AMM ---------- */
  reg('suiamm', 'Shared-pool swap and slippage guard',
    'Quote an exact-input swap, then let another trade move the shared pool before yours. Your signed minOut decides whether the transaction can execute.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Pool X reserve</label><input id="sam-x" type="number" value="100" min="1" step="1"></div>
          <div class="field"><label>Pool Y reserve</label><input id="sam-y" type="number" value="200000" min="1" step="100"></div>
          <div class="field"><label>Your X input</label><input id="sam-in" type="number" value="10" min="0.01" step="0.1"></div>
        </div>
        <div class="row">
          <div class="field"><label>Slippage tolerance (bps)</label><input id="sam-slip" type="number" value="50" min="0" max="5000" step="10"></div>
          <div class="field"><label>Earlier X trade</label><input id="sam-before" type="number" value="0" min="0" step="0.1"></div>
          <div class="field shrink"><button class="btn primary" id="sam-run">Evaluate swap</button></div>
        </div>
        <div class="out" id="sam-log"></div>`;
      const quote = (input, x, y) => {
        const effective = input * 0.997;
        return (effective * y) / (x + effective);
      };
      function run() {
        const x = Math.max(1, Number($(el, '#sam-x').value) || 1);
        const y = Math.max(1, Number($(el, '#sam-y').value) || 1);
        const amount = Math.max(0, Number($(el, '#sam-in').value) || 0);
        const bps = Math.min(10_000, Math.max(0, Number($(el, '#sam-slip').value) || 0));
        const earlier = Math.max(0, Number($(el, '#sam-before').value) || 0);
        const quoted = quote(amount, x, y);
        const minOut = quoted * (10_000 - bps) / 10_000;
        const earlierOut = quote(earlier, x, y);
        const actual = quote(amount, x + earlier, y - earlierOut);
        const spot = y / x;
        const executed = amount ? actual / amount : 0;
        const status = actual >= minOut ? '<span class="good">SWAP CAN EXECUTE</span>' : '<span class="bad">SWAP ABORTS: minOut not met</span>';
        $(el, '#sam-log').innerHTML =
          `POOL AT SIGNING\n  spot price     ${num(spot, 2)} Y per X\n  quoted output  ${num(quoted, 2)} Y\n  signed minOut  ${num(minOut, 2)} Y\n\nPOOL AT EXECUTION\n  earlier trade   ${num(earlier, 2)} X → ${num(earlierOut, 2)} Y\n  actual output   ${num(actual, 2)} Y\n  execution price ${num(executed, 2)} Y per X\n  price impact    ${pct(spot ? (spot - executed) / spot : 0)}\n\n${status}\n\n<span class="dim">The earlier trade is ordered first because both swaps mutate the same shared Pool object. A PTB makes your input, pool update and output one atomic transaction once execution begins.</span>`;
      }
      $$(el, 'input').forEach(i => i.oninput = run); $(el, '#sam-run').onclick = run; run();
    });

  /* ---------- Sui lending ---------- */
  reg('suilend', 'Health factor and liquidation boundary',
    'Change collateral, price and debt in an overcollateralised Sui lending position. The market’s threshold and liquidation bonus determine when and how a liquidator can act.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Collateral (SUI)</label><input id="sl-coll" type="number" value="10" min="0" step="0.1"></div>
          <div class="field"><label>SUI oracle price (USD)</label><input id="sl-price" type="number" value="2000" min="0" step="10"></div>
          <div class="field"><label>Debt (USDC)</label><input id="sl-debt" type="number" value="10000" min="0" step="100"></div>
        </div>
        <div class="row">
          <div class="field"><label>Liquidation threshold (bps)</label><input id="sl-threshold" type="number" value="8250" min="1" max="10000" step="50"></div>
          <div class="field"><label>Liquidation bonus (bps)</label><input id="sl-bonus" type="number" value="500" min="0" max="5000" step="50"></div>
          <div class="field shrink"><button class="btn primary" id="sl-run">Evaluate position</button></div>
        </div>
        <div class="out" id="sl-log"></div>`;
      function run() {
        const collateral = Math.max(0, Number($(el, '#sl-coll').value) || 0);
        const price = Math.max(0, Number($(el, '#sl-price').value) || 0);
        const debt = Math.max(0, Number($(el, '#sl-debt').value) || 0);
        const threshold = Math.min(10_000, Math.max(1, Number($(el, '#sl-threshold').value) || 1));
        const bonus = Math.min(10_000, Math.max(0, Number($(el, '#sl-bonus').value) || 0));
        const hf = debt ? collateral * price * threshold / 10_000 / debt : Infinity;
        const liquidationPrice = collateral && threshold ? debt * 10_000 / (collateral * threshold) : Infinity;
        const repay = debt * 0.5;
        const seize = price ? Math.min(collateral, repay * (10_000 + bonus) / 10_000 / price) : collateral;
        const status = hf < 1 ? '<span class="bad">LIQUIDATABLE</span>' : '<span class="good">ABOVE LIQUIDATION THRESHOLD</span>';
        $(el, '#sl-log').innerHTML =
          `POSITION\n  collateral value    $${num(collateral * price, 2)}\n  debt value          $${num(debt, 2)}\n  health factor       ${num(hf, 3)}\n  liquidation price   $${num(liquidationPrice, 2)} per SUI\n\n${status}\n\nPARTIAL LIQUIDATION (50% close factor)\n  liquidator repays   $${num(repay, 2)} USDC\n  collateral seized   ${num(seize, 4)} SUI\n  bonus value         $${num(Math.max(0, seize * price - repay), 2)}\n\n<span class="dim">This calculation assumes a fresh $1 USDC price and a trusted SUI oracle. A real market accrues debt through a global index and caps the repayment and seizure based on current position state.</span>`;
      }
      $$(el, 'input').forEach(i => i.oninput = run); $(el, '#sl-run').onclick = run; run();
    });

  /* ---------- node operations ---------- */
  reg('nodeops', 'Node capacity planner',
    'Estimate retained chain data, snapshot space, logs and a 30% operating margin before selecting a disk.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Current chain data (GB)</label><input id="no-current" type="number" value="850" min="0" step="10"></div>
          <div class="field"><label>Daily growth (GB)</label><input id="no-growth" type="number" value="8" min="0" step="0.5"></div>
          <div class="field"><label>Retention (days)</label><input id="no-days" type="number" value="90" min="1" step="1"></div>
        </div>
        <div class="row">
          <div class="field"><label>Snapshot workspace (GB)</label><input id="no-snapshot" type="number" value="400" min="0" step="10"></div>
          <div class="field"><label>Log budget (GB)</label><input id="no-logs" type="number" value="50" min="0" step="5"></div>
          <div class="field shrink"><button class="btn primary" id="no-run">Plan capacity</button></div>
        </div><div class="out" id="no-log"></div>`;
      function v(id) { return Math.max(0, Number($(el, id).value) || 0); }
      function run() {
        const current = v('#no-current'), growth = v('#no-growth'), days = v('#no-days');
        const snapshot = v('#no-snapshot'), logs = v('#no-logs');
        const base = current + growth * days + snapshot + logs;
        const headroom = base * 0.30, total = base + headroom;
        $(el, '#no-log').innerHTML = `STORAGE PLAN\n  current + retained growth  ${num(current + growth * days, 1)} GB\n  snapshot workspace         ${num(snapshot, 1)} GB\n  log budget                 ${num(logs, 1)} GB\n  30% headroom               ${num(headroom, 1)} GB\n\nRECOMMENDED MINIMUM\n  ${num(total, 1)} GB  (${num(total / 1024, 2)} TB)\n\n<span class="dim">This is a capacity floor. Validate IOPS, restore duration, pruning behaviour and peak snapshot overlap on the actual client and chain.</span>`;
      }
      $$(el, 'input').forEach(i => i.oninput = run); $(el, '#no-run').onclick = run; run();
    });

  /* ---------- validator operations ---------- */
  reg('valops', 'Validator failover safety gate',
    'A standby may start only after the primary is fenced from both the network and consensus-signing authority.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Primary process</label><select id="vo-process"><option value="active">Still active</option><option value="stopped">Confirmed stopped</option><option value="unknown">Unknown / timed out</option></select></div>
          <div class="field"><label>Primary network</label><select id="vo-network"><option value="open">Still reachable</option><option value="fenced">Fenced / powered off</option></select></div>
          <div class="field"><label>Consensus-key access</label><select id="vo-key"><option value="available">Primary can still access it</option><option value="revoked">Revoked or remote signer fenced</option></select></div>
        </div><div class="out" id="vo-log"></div>`;
      function run() {
        const process = $(el, '#vo-process').value, network = $(el, '#vo-network').value, key = $(el, '#vo-key').value;
        const safe = process === 'stopped' && network === 'fenced' && key === 'revoked';
        const missing = [];
        if (process !== 'stopped') missing.push('primary process is not confirmed stopped');
        if (network !== 'fenced') missing.push('primary host is not fenced from the network');
        if (key !== 'revoked') missing.push('primary may still reach consensus-signing authority');
        $(el, '#vo-log').innerHTML = safe
          ? '<span class="good">STANDBY MAY START</span>\n\nVerify chain ID, validator public key and latest signer state before enabling production signing.\n\n<span class="dim">Record fence evidence and time in the incident timeline.</span>'
          : `<span class="bad">REFUSE FAILOVER</span>\n\n${missing.map(x => '  • ' + x).join('\n')}\n\n<span class="dim">A timeout is evidence of trouble, not evidence that the old validator cannot still sign.</span>`;
      }
      $$(el, 'select').forEach(i => i.onchange = run); run();
    });

  /* ---------- observability ---------- */
  reg('opsobserve', 'Validator alert triage',
    'Change current telemetry and see which conditions need a page before they become a consensus or capacity outage.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Block lag</label><input id="oo-lag" type="number" value="0" min="0" step="1"></div>
          <div class="field"><label>Missed votes remaining</label><input id="oo-votes" type="number" value="50" min="0" step="1"></div>
          <div class="field"><label>Disk fills in (hours)</label><input id="oo-disk" type="number" value="120" min="0" step="1"></div>
        </div><div class="out" id="oo-log"></div>`;
      function run() {
        const lag = Math.max(0, Number($(el, '#oo-lag').value) || 0);
        const votes = Math.max(0, Number($(el, '#oo-votes').value) || 0);
        const disk = Math.max(0, Number($(el, '#oo-disk').value) || 0);
        const alerts = [];
        if (lag > 3) alerts.push('<span class="bad">PAGE</span>  Validator falling behind — inspect peers, consensus process and disk I/O.');
        if (votes < 10) alerts.push('<span class="bad">PAGE</span>  Missed-vote budget low — investigate signer and network before jail threshold.');
        if (disk < 24) alerts.push('<span class="hash">TICKET</span>  Disk exhaustion forecast under 24 hours — expand storage or prune safely.');
        $(el, '#oo-log').innerHTML = alerts.length
          ? alerts.join('\n\n') + '\n\n<span class="dim">Each alert should name a first decision and link to a tested runbook.</span>'
          : '<span class="good">NO ACTIVE OPERATIONAL ALERTS</span>\n\nContinue to observe trends: healthy current values do not prove future capacity or peer health.';
      }
      $$(el, 'input').forEach(i => i.oninput = run); run();
    });

  /* ---------- release automation ---------- */
  reg('opsrelease', 'IaC release-plan review',
    'Review a node release plan for pinned artifacts, isolated secrets, restore proof and a bounded rollout path.',
    function (el) {
      el.innerHTML = `
        <div class="row"><label class="opt"><input id="or-pin" type="checkbox" checked><span>Image or binary digest is pinned and verified</span></label><label class="opt"><input id="or-secret" type="checkbox" checked><span>Consensus key stays outside infrastructure state</span></label></div>
        <div class="row"><label class="opt"><input id="or-restore" type="checkbox"><span>Isolated restore met the recovery-time objective</span></label><label class="opt"><input id="or-canary" type="checkbox" checked><span>Canary and rollback decision are documented</span></label></div>
        <div class="out" id="or-log"></div>`;
      function run() {
        const checks = [['#or-pin', 'release artifact is not pinned and verified'], ['#or-secret', 'signing authority is not separated from infrastructure state'], ['#or-restore', 'backup recovery has not been proven by an isolated restore'], ['#or-canary', 'canary rollout or rollback conditions are missing']];
        const missing = checks.filter(c => !$(el, c[0]).checked).map(c => c[1]);
        $(el, '#or-log').innerHTML = missing.length
          ? `<span class="bad">DO NOT PROMOTE</span>\n\n${missing.map(x => '  • ' + x).join('\n')}\n\n<span class="dim">Fix the plan first; operational pressure is when untested assumptions become outages.</span>`
          : '<span class="good">PLAN HAS THE REQUIRED SAFETY CONTROLS</span>\n\nProceed through the canary with monitoring and stop at the documented abort condition rather than improvising mid-upgrade.';
      }
      $$(el, 'input').forEach(i => i.onchange = run); run();
    });

  /* ---------- advanced protocol systems ---------- */
  reg('mevflow', 'Slippage and sandwich room', 'Compare quoted output, signed tolerance and a simulated adverse move before execution.', function (el) {
    el.innerHTML = '<div class="row"><div class="field"><label>Quoted output</label><input id="mf-q" type="number" value="1000" min="0"></div><div class="field"><label>Slippage (bps)</label><input id="mf-s" type="number" value="50" min="0" max="10000"></div><div class="field"><label>Adverse move (%)</label><input id="mf-m" type="number" value="0.3" min="0" step="0.1"></div></div><div class="out" id="mf-o"></div>';
    function run() { const q=Math.max(0,+$(el,'#mf-q').value||0), s=Math.min(10000,Math.max(0,+$(el,'#mf-s').value||0)), m=Math.max(0,+$(el,'#mf-m').value||0)/100, min=q*(10000-s)/10000, actual=q*(1-m); $(el,'#mf-o').innerHTML=`SIGNED minOut  ${num(min,2)}\nACTUAL OUTPUT  ${num(actual,2)}\n\n${actual>=min?'<span class="good">EXECUTES</span>':'<span class="bad">REVERTS</span>'}\n\n<span class="dim">Tolerance above the normal price move is room an adversarial ordering strategy can potentially capture.</span>`; } $$(el,'input').forEach(i=>i.oninput=run); run();
  });
  reg('xchain', 'Message domain and replay guard', 'Deliver a message, replay it, or change its claimed source domain.', function (el) {
    el.innerHTML='<div class="row"><div class="field"><label>Source chain</label><input id="xc-chain" type="number" value="1"></div><div class="field"><label>Nonce</label><input id="xc-nonce" type="number" value="7"></div><div class="field"><label><input id="xc-replay" type="checkbox"> replay this message</label></div><div class="field"><label><input id="xc-wrong" type="checkbox"> wrong source domain</label></div></div><div class="out" id="xc-o"></div>';
    const seen=new Set(); function run(){const c=+$(el,'#xc-chain').value||0,n=+$(el,'#xc-nonce').value||0,id=c+':remote-app:'+n; let r; if($(el,'#xc-wrong').checked)r='<span class="bad">REJECT: wrong source domain</span>'; else if($(el,'#xc-replay').checked||seen.has(id))r='<span class="bad">REJECT: replayed message ID</span>'; else {seen.add(id);r='<span class="good">ACCEPT: mark ID consumed, then handle payload</span>';} $(el,'#xc-o').innerHTML=`MESSAGE ID  ${id}\n${r}\n\n<span class="dim">A real receiver also binds destination, sender, payload hash and verifier result.</span>`;} $$(el,'input').forEach(i=>i.oninput=run);run();
  });
  reg('smartwallet', 'Session-key policy checker', 'Try a session-key call against target, value and expiry restrictions.', function (el) {
    el.innerHTML='<div class="row"><div class="field"><label>Target</label><select id="sw-t"><option value="game">approved game</option><option value="dex">unapproved DEX</option></select></div><div class="field"><label>Value (ETH)</label><input id="sw-v" type="number" value="0.01" min="0" step="0.01"></div><div class="field"><label><input id="sw-exp" type="checkbox"> session expired</label></div></div><div class="out" id="sw-o"></div>';
    function run(){const t=$(el,'#sw-t').value,v=Math.max(0,+$(el,'#sw-v').value||0),e=$(el,'#sw-exp').checked; const ok=t==='game'&&v<=0.05&&!e; $(el,'#sw-o').innerHTML=`POLICY\n  target: game only\n  value cap: 0.05 ETH\n  expiry: active\n\n${ok?'<span class="good">USER OPERATION VALID</span>':'<span class="bad">USER OPERATION REJECTED</span>'}\n\n<span class="dim">Constrain every delegated key on chain; revocation must take effect immediately.</span>`;} $$(el,'input,select').forEach(i=>i.oninput=run);run();
  });
  reg('cryptops', 'Custody availability comparison', 'Compare a single key, multisig and threshold workflow when one participant is offline.', function (el) {
    el.innerHTML='<div class="row"><div class="field"><label>Scheme</label><select id="co-s"><option value="single">single key</option><option value="multi">2-of-3 multisig</option><option value="threshold">2-of-3 threshold</option></select></div><div class="field"><label>Available participants</label><input id="co-a" type="number" value="2" min="0" max="3"></div></div><div class="out" id="co-o"></div>';
    function run(){const s=$(el,'#co-s').value,a=Math.max(0,+$(el,'#co-a').value||0),need=s==='single'?1:2,ok=a>=need; $(el,'#co-o').innerHTML=`${s.toUpperCase()}\n  available  ${a}\n  required   ${need}\n\n${ok?'<span class="good">CAN AUTHORIZE</span>':'<span class="bad">CANNOT AUTHORIZE</span>'}\n\n<span class="dim">Threshold custody can reduce single-device compromise while adding participant and recovery availability requirements.</span>`;} $$(el,'input,select').forEach(i=>i.oninput=run);run();
  });
  reg('indexer', 'Reorg-safe event ingestion', 'Ingest an event, then replace its block with a reorg and inspect canonical status.', function (el) {
    el.innerHTML='<div class="row"><div class="field"><label>Block height</label><input id="ix-h" type="number" value="100" min="0"></div><div class="field"><label><input id="ix-r" type="checkbox"> simulate reorg</label></div></div><div class="out" id="ix-o"></div>';
    function run(){const h=+$(el,'#ix-h').value||0,r=$(el,'#ix-r').checked; $(el,'#ix-o').innerHTML=`EVENT KEY  chain:1 tx:0xabc log:0\nBLOCK      ${h} / ${r?'0xnew':'0xold'}\nCANONICAL  ${r?'<span class="bad">old branch = false</span>\n          <span class="good">replacement event = true</span>':'<span class="good">true</span>'}\n\n<span class="dim">Keep hash and parent-hash provenance. Retries use a stable event key; product views read canonical records only.</span>`;} $$(el,'input').forEach(i=>i.oninput=run);run();
  });

  /* ---------- NFT metadata pointer chain ---------- */
  reg('nftmeta', 'Metadata pointer chain',
    'Pick a storage strategy, then attack it: swap the image, repoint the base URI, or let the host disappear. Watch which failures the chain can still detect.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Storage strategy</label><select id="nm-mode">
            <option value="http">HTTP URL</option>
            <option value="ipfs">Content-addressed (IPFS CID)</option>
            <option value="onchain">Fully on chain (data: URI)</option>
          </select></div>
          <div class="field shrink"><label><input id="nm-swap" type="checkbox"> creator swaps the image file</label></div>
          <div class="field shrink"><label><input id="nm-frozen" type="checkbox" checked> base URI frozen</label></div>
          <div class="field shrink"><label><input id="nm-repoint" type="checkbox"> owner calls setBaseURI</label></div>
          <div class="field shrink"><label><input id="nm-down" type="checkbox"> host / pin disappears</label></div>
        </div>
        <div class="out" id="nm-log"></div>`;

      const CID_A = 'bafybeib4o7…9c41e';   // hash of the original bytes
      const CID_B = 'bafybeif2m3…7a3d2';   // hash of the swapped bytes

      function run() {
        const mode = $(el, '#nm-mode').value;
        const swap = $(el, '#nm-swap').checked;
        const frozen = $(el, '#nm-frozen').checked;
        const repoint = $(el, '#nm-repoint').checked && !frozen;
        const down = $(el, '#nm-down').checked;
        const blocked = $(el, '#nm-repoint').checked && frozen;

        const hops = [];
        let served, detect, note;

        hops.push('  ownerOf(42)          <span class="good">0xA11ce  — consensus protects this</span>');

        if (mode === 'onchain') {
          hops.push('  tokenURI(42)         data:application/json;base64,eyJ…');
          hops.push('  metadata             <span class="good">decoded from contract storage</span>');
          hops.push('  image                <span class="good">SVG built inside the contract</span>');
          served = swap
            ? '<span class="good">ORIGINAL ARTWORK.</span> There is no file to swap. Changing the bytes means changing contract code, which is a visible on-chain event, not a quiet upload.'
            : '<span class="good">ORIGINAL ARTWORK.</span> No host, no gateway, no pin. The artwork exists wherever the chain state exists.';
          detect = 'Nothing off chain to trust.';
          note = 'Cost: every byte was paid for at mint, and the art has to be renderable in Solidity.';
        } else if (mode === 'ipfs') {
          const cid = repoint ? CID_B : CID_A;
          hops.push('  tokenURI(42)         ipfs://' + cid + '/42.json' +
            (repoint ? ' <span class="bad">← repointed by the owner</span>' : ''));
          hops.push(down
            ? '  gateway              <span class="bad">timeout — nobody is pinning this CID</span>'
            : '  gateway              200 OK (any gateway serves the same bytes)');
          hops.push(down ? '  image                <span class="bad">unavailable</span>'
            : '  image                ipfs://…/42.png');
          if (down) {
            served = '<span class="bad">NOTHING SERVED.</span> The CID still proves exactly which bytes belong to token 42 — but proof is not availability. Somebody has to keep paying to pin it.';
            detect = 'A substitution would be detectable; a disappearance is not preventable by hashing.';
          } else if (repoint) {
            served = '<span class="bad">DIFFERENT ARTWORK.</span> The bytes were not tampered with — the pointer was. Content addressing protects the file, not the string in the contract.';
            detect = 'Detectable on chain: the tokenURI changed, and that is a state change anyone can diff.';
          } else if (swap) {
            served = '<span class="good">ORIGINAL ARTWORK.</span> The swapped file hashes to ' + CID_B + ', so the old pointer cannot resolve to it. The substitution simply does not reach holders.';
            detect = 'Tamper-evident by construction.';
          } else {
            served = '<span class="good">ORIGINAL ARTWORK.</span>';
            detect = 'Tamper-evident by construction.';
          }
          note = blocked
            ? 'setBaseURI reverted with MetadataFrozen — the one-way switch is why the pointer can be trusted.'
            : (frozen ? 'Base URI is frozen, so the pointer itself can never move again.'
              : 'Base URI is NOT frozen. The owner can move every token’s pointer at any time.');
        } else {
          hops.push('  tokenURI(42)         https://api.example.com/meta/42' +
            (repoint ? ' <span class="bad">← repointed by the owner</span>' : ''));
          hops.push(down
            ? '  api.example.com      <span class="bad">404 / domain expired</span>'
            : '  api.example.com      200 OK  ' + (swap ? '<span class="bad">(file replaced this morning)</span>' : ''));
          hops.push(down ? '  image                <span class="bad">unavailable</span>'
            : '  image                ' + (swap ? '<span class="bad">a grey placeholder</span>' : 'the picture you bought'));
          served = down
            ? '<span class="bad">NOTHING SERVED.</span> One expired domain and the collection is blank everywhere at once.'
            : (swap || repoint)
              ? '<span class="bad">DIFFERENT ARTWORK.</span> No transaction, no event, no trace. The chain records that you own token 42 and nothing about what it looks like.'
              : '<span class="good">ORIGINAL ARTWORK — for now.</span> Whoever controls that server controls what every holder sees.';
          detect = swap && !repoint
            ? 'Undetectable on chain. Only somebody who archived the old bytes can prove the change.'
            : repoint ? 'The repoint is on chain, so at least the change is visible.'
              : 'Nothing is pinned to a hash, so a future change would leave no on-chain trace.';
          note = blocked
            ? 'setBaseURI reverted with MetadataFrozen — but a frozen pointer to a mutable host still guarantees nothing about the bytes.'
            : 'Mutable metadata is the right choice for an item that is meant to change. It is dishonest for art sold as permanent.';
        }

        $(el, '#nm-log').innerHTML =
          'RESOLUTION CHAIN\n' + hops.join('\n') + '\n\n' +
          'WHAT THE HOLDER SEES\n  ' + served + '\n\n' +
          'DETECTABILITY\n  <span class="dim">' + detect + '</span>\n\n' +
          '<span class="dim">' + note + '</span>';
      }
      $$(el, 'input, select').forEach(i => i.oninput = run); run();
    });

  /* ---------- GameFi faucet / sink model ---------- */
  reg('gamefi', 'Faucets, sinks and 180 days',
    'A deliberately small economy model. Emissions grow supply, burns shrink it, and players decide whether to stay based on what a day of play is worth in dollars.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Emitted / player / day</label><input id="gf-earn" type="number" value="60" min="0" step="5"></div>
          <div class="field"><label>Spent / player / day</label><input id="gf-spend" type="number" value="25" min="0" step="5"></div>
          <div class="field"><label>Share of spend burned</label><input id="gf-burn" type="range" min="0" max="100" value="40"> <span class="mono" id="gf-burnv">40%</span></div>
          <div class="field"><label>Wage floor (USD/day)</label><input id="gf-wage" type="number" value="6" min="0.5" step="0.5"></div>
        </div>
        <div class="row">
          <div class="field"><label>Players at day 0</label><input id="gf-players" type="number" value="50000" min="100" step="1000"></div>
          <div class="field"><label>Circulating supply</label><input id="gf-supply" type="number" value="200000000" min="1000" step="1000000"></div>
          <div class="field"><label>Token price (USD)</label><input id="gf-price" type="number" value="0.25" min="0.0001" step="0.01"></div>
        </div>
        <div class="out" id="gf-log"></div>
        <div class="bars" id="gf-bars" style="margin-top:12px"></div>`;

      function sim(p, days) {
        let players = p.players, supply = p.supply, price = p.price;
        const k = (price * supply) / players;          // toy: price tracks players per token
        const out = [];
        for (let day = 1; day <= days; day++) {
          const emitted = players * p.earn;
          const burned = players * p.spend * p.burn;
          supply += emitted - burned;
          const dailyUsd = p.earn * price;
          // players judge the game in dollars per day, not in tokens
          const growth = Math.max(-0.12, Math.min(0.12, 0.25 * (dailyUsd / p.wage - 1)));
          players = Math.max(0, players * (1 + growth));
          price = players > 0 && supply > 0 ? (k * players) / supply : 0;
          out.push({ day: day, players: players, supply: supply, price: price, dailyUsd: p.earn * price });
        }
        return out;
      }

      function run() {
        const p = {
          earn: Math.max(0, Number($(el, '#gf-earn').value) || 0),
          spend: Math.max(0, Number($(el, '#gf-spend').value) || 0),
          burn: Number($(el, '#gf-burn').value) / 100,
          wage: Math.max(0.5, Number($(el, '#gf-wage').value) || 0.5),
          players: Math.max(100, Number($(el, '#gf-players').value) || 100),
          supply: Math.max(1000, Number($(el, '#gf-supply').value) || 1000),
          price: Math.max(0.0001, Number($(el, '#gf-price').value) || 0.0001)
        };
        $(el, '#gf-burnv').textContent = pct(p.burn, 0);

        const h = sim(p, 180);
        const coverage = p.earn > 0 ? (p.spend * p.burn) / p.earn : Infinity;
        const marks = [0, 29, 59, 89, 119, 149, 179];
        const rows = marks.map(i => {
          const d = h[i];
          return '  day ' + String(d.day).padStart(3) + '   ' +
            num(d.players, 0).padStart(11) + ' players   ' +
            num(d.supply / 1e6, 1).padStart(8) + 'M supply   $' +
            d.price.toFixed(4).padStart(8) + '   $' + d.dailyUsd.toFixed(2).padStart(6) + '/day';
        }).join('\n');

        const last = h[h.length - 1];
        const verdict = coverage >= 1
          ? '<span class="good">SINK COVERAGE ' + coverage.toFixed(2) + '.</span> Burns match or beat emissions, so supply is not the thing hurting you.'
          : '<span class="bad">SINK COVERAGE ' + coverage.toFixed(2) + '.</span> Every day emits ' +
            num(p.earn - p.spend * p.burn, 0) + ' more tokens per player than it destroys. Demand has to grow at least that fast, forever.';

        $(el, '#gf-log').innerHTML =
          'PER PLAYER PER DAY\n  emitted   ' + num(p.earn, 0) + '\n  burned    ' + num(p.spend * p.burn, 1) +
          '  <span class="dim">(the rest of the spend went to a treasury — still in existence)</span>\n\n' +
          'TRAJECTORY\n' + rows + '\n\n' +
          'AFTER 180 DAYS\n  players   ' + num(last.players, 0) + '  <span class="dim">(' + pct(last.players / p.players - 1, 0) + ')</span>' +
          '\n  supply    ' + num(last.supply / p.supply, 2) + 'x\n  price     ' + pct(last.price / p.price - 1, 0) + '\n\n' +
          verdict + '\n\n<span class="dim">This is a toy. The price rule is one line and no model predicts a market. What it does show honestly is the direction of the loop: earnings set growth, growth sets demand, demand sets earnings.</span>';

        const maxP = Math.max.apply(null, h.map(x => x.price));
        $(el, '#gf-bars').innerHTML = marks.map(i => {
          const d = h[i];
          return '<div class="barrow"><span>day ' + d.day + '</span>' +
            '<span class="track"><i style="width:' + (maxP > 0 ? (d.price / maxP * 100).toFixed(1) : 0) + '%"></i></span>' +
            '<span>$' + d.price.toFixed(4) + '</span></div>';
        }).join('') + '<div class="dim" style="font-size:12px;margin-top:6px">Token price over 180 days. Raise the burn share until this stops falling, then ask whether players would actually pay that sink.</div>';
      }
      $$(el, 'input').forEach(i => i.oninput = run); run();
    });

  /* ---------- game randomness under attack ---------- */
  reg('gameassets', 'Loot box randomness under attack',
    '1000 loot boxes, a 5% legendary rate, and a player who is allowed to undo outcomes they dislike. Same draws every run, so you can compare sources fairly.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Randomness source</label><select id="ga-src">
            <option value="naive">block.timestamp in one transaction</option>
            <option value="commit">commit-reveal, two transactions</option>
            <option value="vrf">VRF request + callback</option>
          </select></div>
          <div class="field"><label>Player</label><select id="ga-who">
            <option value="honest">honest wallet</option>
            <option value="attacker">contract that reverts on a bad roll</option>
          </select></div>
          <div class="field"><label>Box price (ETH)</label><input id="ga-price" type="number" value="0.01" min="0" step="0.005"></div>
          <div class="field"><label>Gas per attempt (ETH)</label><input id="ga-gas" type="number" value="0.0004" min="0" step="0.0001"></div>
        </div>
        <div class="out" id="ga-log"></div>
        <div class="bars" id="ga-bars" style="margin-top:12px"></div>`;

      const BOXES = 1000, RARE = 0.05;

      function run() {
        const src = $(el, '#ga-src').value;
        const attacker = $(el, '#ga-who').value === 'attacker';
        const price = Math.max(0, Number($(el, '#ga-price').value) || 0);
        const gas = Math.max(0, Number($(el, '#ga-gas').value) || 0);
        const rand = rng(1337);

        let legendary = 0, attempts = 0, settled = 0, abandoned = 0;

        for (let i = 0; i < BOXES; i++) {
          if (src === 'naive' && attacker) {
            // the roll happens inside the caller's transaction, so a losing
            // outcome can simply be discarded and retried
            let tries = 0, hit = false;
            while (!hit && tries < 400) { tries++; hit = rand() < RARE; }
            attempts += tries; settled++; if (hit) legendary++;
          } else if (src === 'commit' && attacker) {
            // prediction is impossible, but the reveal can be withheld
            attempts += 1;
            if (rand() < RARE) { settled++; legendary++; } else { abandoned++; }
          } else {
            attempts += 1; settled++; if (rand() < RARE) legendary++;
          }
        }

        const rate = settled > 0 ? legendary / settled : 0;
        const spent = BOXES * price + attempts * gas;
        const perLegendary = legendary > 0 ? spent / legendary : Infinity;
        const honestCost = (BOXES * price + BOXES * gas) / (BOXES * RARE);

        const lines = [
          '  boxes paid for      ' + num(BOXES, 0),
          '  transactions sent   ' + num(attempts, 0) + (attempts > BOXES ? '  <span class="bad">(retries are free apart from gas)</span>' : ''),
          '  outcomes settled    ' + num(settled, 0),
          '  legendary           ' + num(legendary, 0) + '   <span class="' + (rate > RARE * 2 ? 'bad' : 'good') + '">' + pct(rate, 1) + ' of settled rolls</span>',
          '  advertised rate     ' + pct(RARE, 1)
        ];
        if (abandoned) lines.push('  never revealed      ' + num(abandoned, 0) + '  <span class="bad">(stake forfeited if you designed it that way — free if you did not)</span>');

        const verdicts = {
          naive: attacker
            ? '<span class="bad">BROKEN.</span> The attacker never had to predict anything. They called the box from a contract, checked the result, and reverted the whole transaction whenever it was not legendary — paying only gas per attempt. Your 5% became ' + pct(rate, 1) + '.'
            : 'Honest players get the advertised odds. That tells you nothing: the source is only as safe as your least honest caller.',
          commit: attacker
            ? '<span class="bad">LEAKY.</span> Commit-reveal stops prediction, so every commitment was a fair 5%. It does not stop <em>withholding</em> — this player simply never revealed the ' + num(abandoned, 0) + ' bad rolls. Charge for the commitment and forfeit the stake when the reveal window closes, or losing costs nothing.'
            : 'Fair, and it needs no oracle. Two transactions and a reveal deadline are the price.',
          vrf: attacker
            ? '<span class="good">HELD.</span> The result arrives in a separate transaction the player does not control, so there is nothing to revert and nothing to withhold. The attacker got ' + pct(rate, 1) + ' — the same as everyone else.'
            : 'Fair, asynchronous, and it costs a subscription. Keep the callback cheap and let players claim separately.'
        };

        $(el, '#ga-log').innerHTML =
          '1000 BOXES, SEED 1337\n' + lines.join('\n') + '\n\n' +
          'ECONOMICS\n  spent               ' + spent.toFixed(3) + ' ETH\n' +
          '  per legendary       ' + (isFinite(perLegendary) ? perLegendary.toFixed(4) + ' ETH' : '—') +
          '   <span class="dim">(honest baseline ' + honestCost.toFixed(4) + ' ETH)</span>\n\n' +
          verdicts[src];

        const cmp = [
          { k: 'naive, honest', v: RARE },
          { k: 'naive, attacker', v: 1 },
          { k: 'commit, withheld', v: 1 },
          { k: 'VRF, either', v: RARE }
        ];
        $(el, '#ga-bars').innerHTML = cmp.map(c =>
          '<div class="barrow"><span>' + c.k + '</span><span class="track"><i style="width:' +
          (c.v * 100).toFixed(0) + '%"></i></span><span>' + pct(c.v, 0) + '</span></div>').join('') +
          '<div class="dim" style="font-size:12px;margin-top:6px">Legendary rate an attacker can reach against each source. Only the last row costs them nothing to attack because there is nothing to attack.</div>';
      }
      $$(el, 'input, select').forEach(i => i.oninput = run); run();
    });

  /* =========================================================
     MODULE 8 — STELLAR & SOROBAN
     ========================================================= */

  /* ---------- stellarquorum ---------- */
  reg('stellarquorum', 'Quorum intersection inspector',
    'Switch between a shared quorum core and two disconnected groups. The same number of validator keys can have very different safety and availability properties.',
    function (el) {
      el.innerHTML = `
        <div class="row"><div class="field"><label>Configuration</label><select id="sq-mode"><option value="shared">Shared 3-of-4 quorum</option><option value="split">Two disconnected 2-of-2 groups</option></select></div>
        <div class="field shrink"><label>&nbsp;</label><label class="opt"><input id="sq-a" type="checkbox" checked><span>Validator A online</span></label></div>
        <div class="field shrink"><label>&nbsp;</label><label class="opt"><input id="sq-b" type="checkbox" checked><span>Validator B online</span></label></div>
        <div class="field shrink"><label>&nbsp;</label><label class="opt"><input id="sq-c" type="checkbox" checked><span>Validator C online</span></label></div>
        <div class="field shrink"><label>&nbsp;</label><label class="opt"><input id="sq-d" type="checkbox" checked><span>Validator D online</span></label></div></div>
        <div class="out" id="sq-out"></div><div id="sq-verdict"></div>`;
      function run() {
        const online = ['a', 'b', 'c', 'd'].filter(k => $(el, '#sq-' + k).checked).map(k => k.toUpperCase());
        const split = $(el, '#sq-mode').value === 'split';
        const possible = split
          ? [['A', 'B'], ['C', 'D']].filter(q => q.every(x => online.includes(x)))
          : online.length >= 3 ? [online] : [];
        const quorums = split ? 'AB and CD are each self-sufficient quorums.' : 'Any three of A, B, C and D form a quorum.';
        const intersection = split ? 'AB ∩ CD = ∅' : 'Every 3-of-4 quorum pair shares at least two validators.';
        $(el, '#sq-out').innerHTML =
          'CONFIGURATION\n  ' + quorums + '\n\nONLINE\n  ' + (online.join(', ') || 'none') +
          '\n\nLIVE QUORUMS\n  ' + (possible.length ? possible.map(q => q.join('')).join('  ·  ') : 'none');
        $(el, '#sq-verdict').innerHTML = split
          ? '<div class="note danger"><span class="tag">No quorum intersection</span>' + intersection + ' Either group can externalise a different value. Both groups may be live, but the safety model is broken.</div>'
          : '<div class="note"><span class="tag">Intersection holds</span>' + intersection + (possible.length ? ' The selected online set can make progress.' : ' Fewer than three validators are online, so liveness is lost safely rather than confirming a conflicting value.') + '</div>';
      }
      $$(el, 'input, select').forEach(i => i.oninput = run); run();
    });

  /* ---------- stellarmultisig ---------- */
  reg('stellarmultisig', 'Threshold multisig transaction gate',
    'A treasury payment needs a medium threshold of two. Toggle signer approvals, expire the envelope, or make an operation fail to see that a valid signature set is necessary but not sufficient for settlement.',
    function (el) {
      el.innerHTML = `
        <div class="row"><div class="field shrink"><label>Signer approvals (weight 1 each)</label><label class="opt"><input id="sm-a" type="checkbox" checked><span>A</span></label><label class="opt"><input id="sm-b" type="checkbox"><span>B</span></label><label class="opt"><input id="sm-c" type="checkbox"><span>C</span></label></div>
        <div class="field"><label>Transaction time</label><select id="sm-time"><option value="valid">Before timeout</option><option value="expired">After timeout</option></select></div>
        <div class="field"><label>Second operation</label><select id="sm-op"><option value="ok">Valid trustline update</option><option value="bad">Fails: insufficient reserve</option></select></div></div>
        <div class="out" id="sm-out"></div>`;
      function run() {
        const signers = ['a', 'b', 'c'].filter(k => $(el, '#sm-' + k).checked).map(k => k.toUpperCase());
        const weight = signers.length;
        const timely = $(el, '#sm-time').value === 'valid';
        const opOk = $(el, '#sm-op').value === 'ok';
        let verdict = weight < 2 ? '<span class="bad">REJECTED: medium threshold 2 is not met.</span>'
          : !timely ? '<span class="bad">REJECTED: transaction time bound has expired.</span>'
          : !opOk ? '<span class="bad">REVERTED: the second operation fails, so the payment also does not apply.</span>'
          : '<span class="good">SETTLES: both operations apply atomically.</span>';
        $(el, '#sm-out').innerHTML = 'ENVELOPE\n  source sequence: 481\n  medium threshold: 2\n  supplied signers: ' + (signers.join(', ') || 'none') + '  → weight ' + weight + '\n  time bound: ' + (timely ? 'valid' : 'expired') + '\n  operations: payment → trustline update\n\n' + verdict;
      }
      $$(el, 'input, select').forEach(i => i.oninput = run); run();
    });

  /* ---------- sorobanauth ---------- */
  reg('sorobanauth', 'Soroban authorization and TTL boundary',
    'Choose who invokes a per-owner update, where the value lives and how long it has left. The host authorises the owner, while the application must choose a storage lifetime that matches the value.',
    function (el) {
      el.innerHTML = `
        <div class="row"><div class="field"><label>Invoker</label><select id="ss-caller"><option value="owner">Owner authorises increment</option><option value="attacker">Attacker passes owner address</option></select></div>
        <div class="field"><label>Storage class</label><select id="ss-store"><option value="persistent">Persistent: user counter</option><option value="temporary">Temporary: replay nonce</option></select></div>
        <div class="field"><label>TTL remaining (ledgers)</label><input id="ss-ttl" type="number" min="0" step="1" value="100"></div>
        <div class="field shrink"><label>&nbsp;</label><label class="opt"><input id="ss-extend" type="checkbox"><span>Extend TTL now</span></label></div></div>
        <div class="out" id="ss-out"></div>`;
      function run() {
        const authorised = $(el, '#ss-caller').value === 'owner';
        const persistent = $(el, '#ss-store').value === 'persistent';
        const ttl = Math.max(0, Number($(el, '#ss-ttl').value) || 0);
        const extend = $(el, '#ss-extend').checked;
        const finalTtl = extend ? Math.max(ttl, 1000) : ttl;
        const auth = authorised ? '<span class="good">AUTH OK:</span> owner.require_auth() is satisfied.' : '<span class="bad">AUTH FAIL:</span> an address argument is not a signature; require_auth() rejects this invocation.';
        const life = finalTtl === 0 ? '<span class="bad">EXPIRED:</span> the entry is no longer readable.'
          : persistent && finalTtl < 100 ? '<span class="bad">DURABLE-STATE RISK:</span> extend this user value before it expires.'
          : persistent ? '<span class="good">DURABLE POLICY:</span> persistent storage has a planned TTL horizon.'
          : '<span class="good">TEMPORARY POLICY:</span> expiry is acceptable for a bounded replay nonce.';
        $(el, '#ss-out').innerHTML = 'CONTRACT INVOCATION\n  key: Count(owner)\n  storage: ' + (persistent ? 'persistent user state' : 'temporary nonce') + '\n  TTL after this call: ' + finalTtl + ' ledgers\n\n' + auth + '\n' + life;
      }
      $$(el, 'input, select').forEach(i => i.oninput = run); run();
    });

  /* ---------- stellarassets ---------- */
  reg('stellarassets', 'Trustlines, reserves and atomic path payments',
    'Give a recipient a USD trustline, reserve the XLM needed for its ledger entry, then choose strict-receive or strict-send. The route is deliberately small, but its limits and all-or-nothing result behave like a real Stellar path payment.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Recipient XLM balance</label><input id="sa-xlm" type="number" min="0" step="0.1" value="5"></div>
          <div class="field"><label>Existing subentries</label><input id="sa-entries" type="number" min="0" step="1" value="2"></div>
          <div class="field"><label>Base reserve (XLM)</label><input id="sa-reserve" type="number" min="0" step="0.01" value="0.5"></div>
          <div class="field shrink"><label>&nbsp;</label><label class="opt"><input id="sa-trust" type="checkbox" checked><span>Add USD:GISSUER trustline</span></label></div>
        </div>
        <div class="row" style="margin-top:10px">
          <div class="field"><label>Payment mode</label><select id="sa-mode"><option value="receive">Strict receive</option><option value="send">Strict send</option></select></div>
          <div class="field"><label id="sa-amount-label">USD recipient must get</label><input id="sa-amount" type="number" min="0" step="0.1" value="50"></div>
          <div class="field"><label id="sa-limit-label">Maximum XLM to spend</label><input id="sa-limit" type="number" min="0" step="0.1" value="55"></div>
        </div>
        <div class="out" id="sa-reserve-out"></div>
        <div id="sa-route"></div>
        <div class="out" id="sa-result"></div>`;

      function n(sel) { return Math.max(0, Number($(el, sel).value) || 0); }
      function fixed(v) { return num(v, 4); }
      function run() {
        const xlm = n('#sa-xlm');
        const existing = Math.floor(n('#sa-entries'));
        const reserve = n('#sa-reserve');
        const addTrust = $(el, '#sa-trust').checked;
        const entriesAfter = existing + (addTrust ? 1 : 0);
        const minBefore = (2 + existing) * reserve;
        const minAfter = (2 + entriesAfter) * reserve;
        const availableAfter = xlm - minAfter;
        const reserveOk = xlm >= minAfter;
        const mode = $(el, '#sa-mode').value;
        const amount = n('#sa-amount');
        const limit = n('#sa-limit');
        const rate = 0.96; // USD received per XLM: XLM -> EUR -> USD
        const needXlm = amount / rate;
        const getUsd = amount * rate;

        $(el, '#sa-amount-label').textContent = mode === 'receive' ? 'USD recipient must get' : 'Exact XLM to spend';
        $(el, '#sa-limit-label').textContent = mode === 'receive' ? 'Maximum XLM to spend' : 'Minimum USD to receive';
        $(el, '#sa-reserve-out').innerHTML =
          'RESERVE CHECK\n' +
          '  before: (' + (2 + existing) + ' entries × ' + fixed(reserve) + ') = ' + fixed(minBefore) + ' XLM minimum\n' +
          '  after:  (' + (2 + entriesAfter) + ' entries × ' + fixed(reserve) + ') = ' + fixed(minAfter) + ' XLM minimum\n' +
          '  available after entry change: ' + fixed(availableAfter) + ' XLM  ' +
          (reserveOk ? '<span class="good">RESERVE HELD</span>' : '<span class="bad">INSUFFICIENT RESERVE</span>');

        $(el, '#sa-route').innerHTML = '<div class="chain-flow">' +
          '<div class="chain-block"><b>XLM</b><span>sender asset</span></div>' +
          '<div class="chain-arrow">→</div><div class="chain-block"><b>EUR</b><span>offer: 0.80 EUR/XLM</span></div>' +
          '<div class="chain-arrow">→</div><div class="chain-block"><b>USD:GISSUER</b><span>offer: 1.20 USD/EUR</span></div>' +
          '</div><p class="dim" style="margin:8px 0 12px">Route rate: 1 XLM → 0.80 EUR → 0.96 USD. In a real transaction, offers may change before the ledger closes.</p>';

        let result;
        if (!addTrust) {
          result = '<span class="bad">FAILED: destination has no trustline for USD:GISSUER.</span> It has not opted in to this credit asset.';
        } else if (!reserveOk) {
          result = '<span class="bad">FAILED: adding the trustline would violate the XLM reserve.</span> Fund the account or remove an unused subentry first.';
        } else if (mode === 'receive') {
          result = needXlm <= limit
            ? '<span class="good">SETTLES ATOMICALLY.</span> Spend ' + fixed(needXlm) + ' XLM and deliver exactly ' + fixed(amount) + ' USD. ' + fixed(limit - needXlm) + ' XLM of sendMax remains unused.'
            : '<span class="bad">SAFE FAILURE.</span> Delivering ' + fixed(amount) + ' USD needs ' + fixed(needXlm) + ' XLM, above sendMax ' + fixed(limit) + '. No offer is consumed.';
        } else {
          result = getUsd >= limit
            ? '<span class="good">SETTLES ATOMICALLY.</span> Spend exactly ' + fixed(amount) + ' XLM and receive ' + fixed(getUsd) + ' USD, above destMin ' + fixed(limit) + '.'
            : '<span class="bad">SAFE FAILURE.</span> ' + fixed(amount) + ' XLM would yield only ' + fixed(getUsd) + ' USD, below destMin ' + fixed(limit) + '. No offer is consumed.';
        }
        $(el, '#sa-result').innerHTML = 'PATH PAYMENT\n  ' + result;
      }
      $$(el, 'input, select').forEach(i => i.oninput = run);
      run();
    });

  /* ---------- oracle aggregation ---------- */
  reg('oraclebasics', 'Median versus mean under faulty reporters',
    'Add faulty reporters to an oracle committee and watch what each aggregation rule does with them. The median holds while honest reporters remain a majority; the mean does not hold at all.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Reporters (n)</label><input id="ob-n" type="number" value="21" min="3" max="51" step="2"></div>
          <div class="field"><label>Faulty reporters (f)</label><input id="ob-f" type="number" value="3" min="0" max="51" step="1"></div>
          <div class="field"><label>True price (USD)</label><input id="ob-price" type="number" value="2000" min="0.0001" step="10"></div>
        </div>
        <div class="row">
          <div class="field"><label>Faulty behaviour</label><select id="ob-mode">
            <option value="high">Report an absurd high value</option>
            <option value="zero">Report zero</option>
            <option value="stale">Report a stale price, 30% low</option>
            <option value="collude">Collude on one wrong price, 40% high</option>
          </select></div>
          <div class="field"><label>Honest jitter (bps)</label><input id="ob-jitter" type="number" value="20" min="0" max="500" step="5"></div>
        </div><div class="out" id="ob-log"></div>`;
      function run() {
        const n = Math.max(3, Math.min(51, Math.round(Number($(el, '#ob-n').value) || 3)));
        const f = Math.max(0, Math.min(n, Math.round(Number($(el, '#ob-f').value) || 0)));
        const p = Math.max(0.0001, Number($(el, '#ob-price').value) || 1);
        const mode = $(el, '#ob-mode').value;
        const jitter = Math.max(0, Number($(el, '#ob-jitter').value) || 0) / 10000;

        const r = rng(0xC0FFEE);
        const values = [];
        for (let i = 0; i < n - f; i++) values.push(p * (1 + (r() - 0.5) * 2 * jitter));
        for (let i = 0; i < f; i++) {
          values.push(mode === 'high' ? p * 1000 : mode === 'zero' ? 0
            : mode === 'stale' ? p * 0.7 : p * 1.4);
        }
        const sorted = values.slice().sort((a, b) => a - b);
        const median = sorted.length % 2
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;

        const medErr = Math.abs(median - p) / p, meanErr = Math.abs(mean - p) / p;
        const majority = n >= 2 * f + 1;

        $(el, '#ob-log').innerHTML =
          'COMMITTEE\n  reporters ' + n + '   faulty ' + f + '   honest ' + (n - f) +
          '\n  n >= 2f + 1 ?  ' + (majority
            ? '<span class="good">yes — a median stays inside the honest range</span>'
            : '<span class="bad">no — faulty reporters can place the median themselves</span>') +
          '\n\nAGGREGATION\n' +
          '  median  ' + num(median, 2) + ' USD   error ' + (medErr > 0.005
            ? '<span class="bad">' + pct(medErr) + '</span>' : '<span class="good">' + pct(medErr) + '</span>') +
          '\n  mean    ' + num(mean, 2) + ' USD   error ' + (meanErr > 0.005
            ? '<span class="bad">' + pct(meanErr) + '</span>' : '<span class="good">' + pct(meanErr) + '</span>') +
          '\n\n<span class="dim">One reporter is enough to make the mean useless. The median only moves once faulty reporters ' +
          'reach half the committee — which is the whole fault-tolerance argument, and also why source independence ' +
          'matters more than node count.</span>';
      }
      $$(el, 'input, select').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- price feed guards ---------- */
  reg('oraclefeed', 'Price feed safety gate',
    'Every guard from SafePriceReader, in the order the contract runs them. Break one input at a time and watch which revert fires first.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Primary answer</label><input id="of-answer" type="number" value="2000" step="1"></div>
          <div class="field"><label>Feed decimals</label><select id="of-dec"><option value="8">8</option><option value="18">18</option><option value="6">6</option></select></div>
          <div class="field"><label>Answer age (s)</label><input id="of-age" type="number" value="900" min="0" step="60"></div>
          <div class="field"><label>maxAge (s)</label><input id="of-maxage" type="number" value="5400" min="1" step="60"></div>
        </div>
        <div class="row">
          <div class="field"><label>Band min</label><input id="of-min" type="number" value="1" step="1"></div>
          <div class="field"><label>Band max</label><input id="of-max" type="number" value="100000" step="1000"></div>
          <div class="field"><label>Secondary answer</label><input id="of-second" type="number" value="2004" step="1"></div>
          <div class="field"><label>Sequencer</label><select id="of-seq">
            <option value="l1">L1 — no check</option>
            <option value="up">Up for hours</option>
            <option value="fresh">Back up 5 min ago</option>
            <option value="down">Down</option>
          </select></div>
        </div><div class="out" id="of-log"></div>`;
      function run() {
        const answer = Number($(el, '#of-answer').value) || 0;
        const dec = Number($(el, '#of-dec').value);
        const age = Math.max(0, Number($(el, '#of-age').value) || 0);
        const maxAge = Math.max(1, Number($(el, '#of-maxage').value) || 1);
        const lo = Number($(el, '#of-min').value) || 0;
        const hi = Number($(el, '#of-max').value) || 0;
        const second = Number($(el, '#of-second').value) || 0;
        const seq = $(el, '#of-seq').value;

        const line = (ok, label, detail) =>
          '  ' + (ok ? '<span class="good">pass</span>' : '<span class="bad">REVERT</span>') +
          '  ' + label + (detail ? '   ' + detail : '');

        const checks = [];
        let failed = null;
        function check(ok, label, err, detail) {
          checks.push(line(ok, label, detail));
          if (!ok && !failed) failed = err;
        }

        check(seq !== 'down', 'sequencer up', 'SequencerDown()',
          seq === 'l1' ? 'L1: check skipped' : seq === 'down' ? 'uptime feed reports down' : 'reported up');
        check(seq !== 'fresh', 'grace period elapsed', 'GracePeriodNotOver()',
          seq === 'fresh' ? 'only 5 min since restart, need 60' : seq === 'l1' ? 'not applicable' : 'restart is old enough');
        check(answer > 0, 'answer > 0', 'NonPositiveAnswer()', answer <= 0 ? 'a negative answer casts to a huge uint' : '');
        check(answer > lo && answer < hi, 'inside sanity band', 'PriceOutOfBand()',
          answer <= lo ? 'pinned at or below minAnswer — the LUNA failure' : answer >= hi ? 'at or above maxAnswer' : '');
        check(age <= maxAge, 'fresh enough', 'StalePrice()', 'age ' + num(age) + 's vs maxAge ' + num(maxAge) + 's');

        const divergence = second > 0 && answer > 0
          ? Math.abs(answer - second) / Math.min(answer, second) : 1;
        check(divergence <= 0.02, 'feeds agree within 2%', 'FeedsDisagree()', pct(divergence) + ' apart');

        // The feed publishes answer × 10^dec as an integer. A consumer that
        // hard-codes 1e8 misreads it by exactly 10^(dec - 8).
        const mid = (answer + second) / 2;
        const hardCodedError = Math.pow(10, dec - 8);

        $(el, '#of-log').innerHTML = 'GUARDS, IN CONTRACT ORDER\n' + checks.join('\n') + '\n\n' +
          (failed
            ? '<span class="bad">price() reverts with ' + failed + '</span>\n\n<span class="dim">Reverting is the ' +
              'correct outcome. The consumer must now block borrows, mints and leverage while still allowing ' +
              'repayments and collateral top-ups. A cached fallback price here is an unbounded credit facility.</span>'
            : '<span class="good">price() returns ' + num(mid, 4) + ' USD</span>   <span class="dim">(mean of the two ' +
              'feeds, normalised to 18 decimals internally)</span>\n\nDECIMALS\n' +
              '  raw integer on chain          ' + (mid * Math.pow(10, dec)).toExponential(3) + '   <span class="dim">(answer × 10^' + dec + ')</span>\n' +
              '  read via decimals()           ' + num(mid, 4) + ' USD   <span class="good">correct</span>\n' +
              '  divided by a hard-coded 1e8   ' + num(mid * hardCodedError, 4) + ' USD   ' +
              (hardCodedError === 1 ? '<span class="dim">right by luck: this feed happens to use 8</span>'
                : '<span class="bad">wrong by ' + num(hardCodedError, hardCodedError < 1 ? 4 : 0) + 'x</span>'));
      }
      $$(el, 'input, select').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- manipulation cost ---------- */
  reg('oracletwap', 'Oracle attack-cost calculator',
    'Price the attack instead of guessing at it: pool depth sets the cost of displacement, the TWAP window sets how long it must be carried, and the borrow cap sets the prize.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Quote reserve (USD)</label><input id="ot-quote" type="number" value="2000000" min="1000" step="100000"></div>
          <div class="field"><label>Price multiple (k)</label><input id="ot-k" type="number" value="2" min="1.01" step="0.25"></div>
          <div class="field"><label>Swap fee (bps)</label><input id="ot-fee" type="number" value="30" min="0" max="300" step="5"></div>
        </div>
        <div class="row">
          <div class="field"><label>TWAP window (min)</label><input id="ot-window" type="number" value="30" min="0" max="240" step="5"></div>
          <div class="field"><label>Arb restores per block (%)</label><input id="ot-arb" type="number" value="50" min="0" max="100" step="5"></div>
          <div class="field"><label>Extractable / borrow cap (USD)</label><input id="ot-cap" type="number" value="3000000" min="0" step="100000"></div>
        </div><div class="out" id="ot-log"></div>`;
      function run() {
        const quote = Math.max(1000, Number($(el, '#ot-quote').value) || 1000);
        const k = Math.max(1.01, Number($(el, '#ot-k').value) || 1.01);
        const feeBps = Math.max(0, Number($(el, '#ot-fee').value) || 0);
        const windowMin = Math.max(0, Number($(el, '#ot-window').value) || 0);
        const arb = Math.min(1, Math.max(0, Number($(el, '#ot-arb').value) || 0) / 100);
        const cap = Math.max(0, Number($(el, '#ot-cap').value) || 0);

        const notional = quote * (Math.sqrt(k) - 1);         // input needed to move price by k
        const roundTripFee = notional * (feeBps / 10000) * 2; // buy leg and unwind leg
        const blocks = Math.ceil(windowMin * 60 / 12);        // 12s slots
        // Holding a TWAP displaced means re-pushing whatever arbitrage restores,
        // block after block. Each re-push pays fees and slippage on the restored part.
        const carry = blocks * notional * arb * (feeBps / 10000) * 2;
        const total = roundTripFee + carry;
        const profit = cap - total;
        const safeCap = total * 0.5;

        $(el, '#ot-log').innerHTML =
          'DISPLACEMENT\n' +
          '  input needed to move price ' + num(k, 2) + 'x     ' + num(notional, 0) + ' USD   <span class="dim">(quote reserve x (sqrt(k) - 1))</span>\n' +
          '  round-trip fees and slippage             ' + num(roundTripFee, 0) + ' USD   <span class="dim">(the notional is swapped, not spent)</span>\n' +
          (windowMin > 0
            ? '\nCARRYING A ' + num(windowMin, 0) + '-MINUTE TWAP\n' +
              '  blocks to hold                           ' + num(blocks, 0) + '\n' +
              '  arbitrage bleed while displaced          ' + num(carry, 0) + ' USD\n'
            : '\nSPOT ORACLE — NOTHING TO CARRY\n  <span class="bad">one transaction, no time cost at all</span>\n') +
          '\nATTACK ECONOMICS\n' +
          '  total cost to attacker   ' + num(total, 0) + ' USD\n' +
          '  extractable at cap       ' + num(cap, 0) + ' USD\n  ' +
          (profit > 0
            ? '<span class="bad">PROFITABLE: ' + num(profit, 0) + ' USD of profit.</span> Lower the borrow cap to about ' +
              num(safeCap, 0) + ' USD, require deeper liquidity, or move to an aggregated feed.'
            : '<span class="good">UNPROFITABLE: the attack loses ' + num(-profit, 0) + ' USD.</span> Re-check after any drop ' +
              'in pool depth — the cost side falls with liquidity while the cap does not.') +
          '\n\n<span class="dim">A teaching model, deliberately optimistic for the defender: it ignores flash-loan fees, gas and ' +
          'MEV competition, and it assumes the attacker cannot control consecutive blocks. It also cannot price a thin real ' +
          'market, where the manipulated price is the true price and every honest oracle reports it.</span>';
      }
      $$(el, 'input').forEach(i => i.oninput = run); run();
    });

  /* ---------- custom signed oracle ---------- */
  reg('oracledesign', 'Signed report validator',
    'Submit a signed price report to a custom m-of-n oracle and try to sneak one past it. Each rejected submission names the check that a real exploit would have skipped.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Signed for</label><select id="od-chain">
            <option value="same">This chain and this contract</option>
            <option value="other">Another chain id</option>
            <option value="sibling">Sibling deployment, same chain</option>
          </select></div>
          <div class="field"><label>validUntil (s from now)</label><input id="od-valid" type="number" value="30" step="10"></div>
          <div class="field"><label>Report roundId</label><input id="od-round" type="number" value="1042" min="0" step="1"></div>
          <div class="field"><label>Stored lastRound</label><input id="od-last" type="number" value="1041" min="0" step="1"></div>
        </div>
        <div class="row">
          <div class="field"><label>Signer set (n)</label><input id="od-n" type="number" value="5" min="1" max="21" step="1"></div>
          <div class="field"><label>Quorum (m)</label><input id="od-m" type="number" value="3" min="1" max="21" step="1"></div>
          <div class="field"><label>Signatures supplied</label><input id="od-sigs" type="number" value="3" min="0" max="21" step="1"></div>
          <div class="field shrink"><label>&nbsp;</label><label class="opt"><input id="od-dup" type="checkbox"><span>One key signed twice</span></label></div>
        </div>
        <div class="row"><label class="opt"><input id="od-paused" type="checkbox"><span>Oracle paused by guardian</span></label></div>
        <div class="out" id="od-log"></div>`;
      function run() {
        const chain = $(el, '#od-chain').value;
        const valid = Number($(el, '#od-valid').value) || 0;
        const round = Math.max(0, Number($(el, '#od-round').value) || 0);
        const last = Math.max(0, Number($(el, '#od-last').value) || 0);
        const n = Math.max(1, Number($(el, '#od-n').value) || 1);
        const m = Math.max(1, Number($(el, '#od-m').value) || 1);
        const sigs = Math.max(0, Number($(el, '#od-sigs').value) || 0);
        const dup = $(el, '#od-dup').checked;
        const paused = $(el, '#od-paused').checked;

        const unique = dup ? Math.max(0, Math.min(sigs - 1, n)) : Math.min(sigs, n);
        const rows = [];
        let err = null;
        function check(ok, label, error, note) {
          rows.push('  ' + (ok ? '<span class="good">pass</span>' : '<span class="bad">REVERT</span>') +
            '  ' + label + (note ? '   ' + note : ''));
          if (!ok && !err) err = error;
        }

        check(!paused, 'not paused', 'Paused()', paused ? 'guardian halted consumption' : '');
        check(valid > 0, 'not expired', 'Expired()',
          valid > 0 ? num(valid, 0) + 's of validity left' : 'an expired report is a free replay of an old price');
        check(round > last, 'round is newer', 'StaleRound()',
          round > last ? 'round ' + round + ' > stored ' + last : 'replaying round ' + round + ' over ' + last);
        check(!dup, 'signers sorted and unique', 'SignersUnsorted()',
          dup ? 'the same key counted twice would fake quorum' : '');
        check(unique >= m, 'quorum met', 'QuorumNotMet(' + unique + ')', unique + ' of ' + m + ' required, set size ' + n);
        check(chain === 'same', 'domain separator matches', 'invalid signer recovered',
          chain === 'same' ? 'chainId + address(this) bound into the digest'
            : chain === 'other' ? 'signed for a different chain id — a fork replay'
            : 'signed for a sibling deployment on this chain');

        $(el, '#od-log').innerHTML = 'submit(report, signatures)\n' + rows.join('\n') + '\n\n' +
          (err
            ? '<span class="bad">REJECTED: ' + err + '</span>\n\n<span class="dim">Each of these checks exists because ' +
              'omitting it has cost somebody money. The digest binding is the one most often skipped in custom oracles: ' +
              'without chainId and the contract address, one valid signature works on every deployment that shares the ' +
              'signer set.</span>'
            : '<span class="good">ACCEPTED: price stored, lastRound advanced to ' + round + '.</span>\n\n' +
              '<span class="dim">Now the operational half: who rotates a compromised signer, who can pause, and how you ' +
              'find out that reporters stopped publishing at 3am. A custom oracle makes your key management part of the ' +
              'protocol’s solvency.</span>');
      }
      $$(el, 'input, select').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- chain selection ---------- */
  reg('chainfit', 'Chain fit from requirements',
    'State what the product actually needs. Hard requirements eliminate chains outright — the ranking below only orders whatever survived.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Sustained writes / second</label><input id="cf-tps" type="number" value="40" min="1" step="10"></div>
          <div class="field"><label>Can wait for finality (seconds)</label><input id="cf-fin" type="number" value="60" min="1" step="10"></div>
          <div class="field"><label>Team ships fastest in</label><select id="cf-lang">
            <option value="solidity">Solidity</option>
            <option value="rust">Rust</option>
            <option value="move">Move</option>
            <option value="none">no preference</option>
          </select></div>
        </div>
        <div class="row">
          <label class="opt"><input id="cf-liq" type="checkbox" checked><span>Needs liquidity that already exists</span></label>
          <label class="opt"><input id="cf-sov" type="checkbox"><span>Must control its own runtime and upgrades</span></label>
        </div>
        <div class="out" id="cf-out"></div>`;

      const CHAINS = [
        { name: 'Ethereum L1', liq: 'deep', tps: 15, fin: 780, sov: false, lang: 'solidity',
          note: 'settlement and liquidity; every write is expensive' },
        { name: 'EVM rollup', liq: 'deep', tps: 300, fin: 780, sov: false, lang: 'solidity',
          note: 'cheap writes; the sequencer and the upgrade keys are the trust' },
        { name: 'Solana', liq: 'medium', tps: 2000, fin: 13, sov: false, lang: 'rust',
          note: 'parallel while write sets stay disjoint; declare accounts up front' },
        { name: 'Sui', liq: 'medium', tps: 2000, fin: 1, sov: false, lang: 'move',
          note: 'owned-object writes never reach consensus' },
        { name: 'Cosmos app-chain', liq: 'thin', tps: 1000, fin: 6, sov: true, lang: 'rust',
          note: 'your block space, your validator set, your pager' }
      ];

      function run() {
        const tps = Math.max(1, Number($(el, '#cf-tps').value) || 1);
        const fin = Math.max(1, Number($(el, '#cf-fin').value) || 1);
        const lang = $(el, '#cf-lang').value;
        const needLiq = $(el, '#cf-liq').checked;
        const sov = $(el, '#cf-sov').checked;

        const out = [], gone = [];
        CHAINS.forEach(c => {
          if (sov && !c.sov) { gone.push([c.name, 'cannot own the runtime']); return; }
          if (tps > c.tps) { gone.push([c.name, 'needs ' + num(tps, 0) + ' w/s, practical ceiling ' + num(c.tps, 0)]); return; }
          if (fin < c.fin) { gone.push([c.name, 'finality ' + num(c.fin, 0) + 's, product tolerates ' + num(fin, 0) + 's']); return; }
          if (needLiq && c.liq === 'thin') { gone.push([c.name, 'you would bootstrap the liquidity yourself']); return; }
          out.push(c);
        });
        out.sort((a, b) => (a.lang === lang ? 0 : 1) - (b.lang === lang ? 0 : 1) || b.tps - a.tps);

        const lines = out.length
          ? out.map((c, i) => '  ' + (i === 0 ? '<span class="good">' + c.name + '</span>' : '<span class="hl">' + c.name + '</span>') +
              '\n      ' + c.note + (c.lang === lang ? '   <span class="good">team already ships in ' + c.lang + '</span>'
                : '   <span class="dim">a ' + c.lang + ' rewrite</span>')).join('\n')
          : '  <span class="bad">nothing survives these requirements.</span>\n      Relax one of them, or the product is not a single-chain product.';

        $(el, '#cf-out').innerHTML =
          'SURVIVORS, best first\n' + lines +
          '\n\nELIMINATED\n' + (gone.length
            ? gone.map(g => '  <span class="bad">' + g[0] + '</span> — ' + g[1]).join('\n')
            : '  <span class="dim">nothing — these requirements do not constrain the choice yet</span>') +
          '\n\n<span class="dim">Eliminations are the useful output. A requirement that removes nothing was not a requirement, ' +
          'and a benchmark that removes nothing is marketing. Note what a wrong answer costs: EVM to EVM is a redeploy and a ' +
          're-audit, EVM to Move or SVM is a rewrite, and anything to an app-chain hires an operations team.</span>';
      }
      $$(el, 'input, select').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- multi-provider reads ---------- */
  reg('rpcpool', 'Quorum across RPC providers',
    'Break the providers one at a time and watch what the read path can still conclude. The interesting states are the ones where it returns a value it should not.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Providers queried</label><input id="rp-n" type="number" value="3" min="1" max="9" step="1"></div>
          <div class="field"><label>Down (timeout / 429)</label><input id="rp-down" type="number" value="0" min="0" max="9" step="1"></div>
          <div class="field"><label>Lagging past tolerance</label><input id="rp-stale" type="number" value="1" min="0" max="9" step="1"></div>
          <div class="field"><label>Returning a wrong value</label><input id="rp-bad" type="number" value="0" min="0" max="9" step="1"></div>
        </div>
        <div class="row">
          <label class="opt"><input id="rp-shared" type="checkbox"><span>All endpoints resolve to one upstream provider</span></label>
          <label class="opt"><input id="rp-lag" type="checkbox" checked><span>Compare block heads before comparing values</span></label>
        </div>
        <div class="out" id="rp-out"></div>`;

      function run() {
        const n = Math.max(1, Math.min(9, Number($(el, '#rp-n').value) || 1));
        let down = Math.max(0, Number($(el, '#rp-down').value) || 0);
        let stale = Math.max(0, Number($(el, '#rp-stale').value) || 0);
        let bad = Math.max(0, Number($(el, '#rp-bad').value) || 0);
        const shared = $(el, '#rp-shared').checked;
        const lagCheck = $(el, '#rp-lag').checked;

        down = Math.min(down, n);
        stale = Math.min(stale, n - down);
        bad = Math.min(bad, n - down - stale);

        // Correlated infrastructure is one provider wearing several names.
        const effective = shared ? 1 : n;
        const responded = n - down;
        // Without a head comparison a lagging endpoint is counted as if it were current.
        const counted = lagCheck ? responded - stale : responded;
        const wrong = bad + (lagCheck ? 0 : stale);
        const honest = counted - wrong;
        const needed = Math.floor(counted / 2) + 1;

        const rows = [];
        for (let i = 0; i < n; i++) {
          const tag = i < down ? ['down', 'bad', 'no answer at all']
            : i < down + stale ? ['lagging', lagCheck ? 'dim' : 'bad', '14 blocks behind the best head']
            : i < down + stale + bad ? ['wrong', 'bad', 'answers, disagrees with the majority']
            : ['fresh', 'good', 'current head, agrees'];
          rows.push('  provider ' + String.fromCharCode(65 + i) + '  <span class="' + tag[1] + '">' +
            tag[0] + '</span>' + '   <span class="dim">' + tag[2] + '</span>');
        }

        let verdict, why;
        if (counted === 0) {
          verdict = '<span class="bad">NO ANSWER</span>';
          why = 'Every endpoint failed or was rejected. Correct outcome — a read path with nothing to report must say so rather than reuse a cache.';
        } else if (honest >= needed) {
          verdict = '<span class="good">VALUE ACCEPTED</span>';
          why = num(honest, 0) + ' of ' + num(counted, 0) + ' counted responses agree, quorum is ' + num(needed, 0) + '.';
        } else if (wrong >= needed) {
          verdict = '<span class="bad">WRONG VALUE ACCEPTED</span>';
          why = 'The bad responses are the majority of what was counted. The read path is confidently wrong, which is worse than returning nothing.';
        } else {
          verdict = '<span class="bad">NO QUORUM</span>';
          why = 'Responses disagree and none reaches ' + num(needed, 0) + '. Surface the disagreement; do not average two different chain states together.';
        }

        $(el, '#rp-out').innerHTML =
          rows.join('\n') +
          '\n\n  counted ' + num(counted, 0) + ' · quorum needed ' + num(needed, 0) +
          ' · agreeing ' + num(Math.max(0, honest), 0) +
          '\n\n' + verdict + '\n  ' + why +
          (shared ? '\n\n<span class="bad">All ' + num(n, 0) + ' endpoints sit behind one upstream, so the independence is fictional: ' +
            'effective providers = ' + num(effective, 0) + '. One outage takes every one of them, and the quorum only proves ' +
            'that one server is consistent with itself.</span>' : '') +
          (!lagCheck && stale > 0 ? '\n\n<span class="bad">No head comparison, so ' + num(stale, 0) + ' stale response(s) were counted ' +
            'as current. A provider twelve blocks behind is not slow, it is answering about a different state.</span>' : '') +
          '\n\n<span class="dim">Reads are only half of it. A broadcast that one endpoint quietly drops looks identical to one it ' +
          'accepted: you get a transaction hash either way. Watch for inclusion, not for the RPC response, and send to more than ' +
          'one endpoint.</span>';
      }
      $$(el, 'input').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- L2 trust profile ---------- */
  reg('l2pick', 'Build an L2 and read its real trust',
    'Choose the properties instead of the brand. The worst case is derived from where the data goes, who may prove, and how fast the rules can change.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Transaction data</label><select id="lp-data">
            <option value="l1">published to L1 (blob or calldata)</option>
            <option value="committee">held by a data committee</option>
            <option value="own">its own chain</option>
          </select></div>
          <div class="field"><label>What convinces L1</label><select id="lp-proof">
            <option value="validity">validity proof</option>
            <option value="fraud">fraud proof</option>
            <option value="consensus">an external validator set</option>
          </select></div>
          <div class="field"><label>Upgrade delay (hours)</label><input id="lp-up" type="number" value="0" min="0" max="336" step="12"></div>
        </div>
        <div class="row">
          <div class="field"><label>Sequencer</label><select id="lp-seq">
            <option value="single">single, operated by the team</option>
            <option value="shared">shared / rotating</option>
            <option value="decentralised">decentralised</option>
          </select></div>
          <label class="opt"><input id="lp-perm" type="checkbox"><span>Anyone may submit a proof</span></label>
          <label class="opt"><input id="lp-force" type="checkbox"><span>Forced inclusion via L1</span></label>
        </div>
        <div class="out" id="lp-out"></div>`;

      function run() {
        const data = $(el, '#lp-data').value;
        const proof = $(el, '#lp-proof').value;
        const seq = $(el, '#lp-seq').value;
        const perm = $(el, '#lp-perm').checked;
        const force = $(el, '#lp-force').checked;
        const up = Math.max(0, Number($(el, '#lp-up').value) || 0);

        const family = data === 'own' ? 'sidechain'
          : data === 'committee' ? (proof === 'validity' ? 'validium' : 'plasma-shaped design')
          : proof === 'validity' ? 'ZK rollup'
          : proof === 'fraud' ? 'optimistic rollup'
          : 'a chain that posts data it cannot prove';

        const risks = [];
        let worst = 'Anyone can rebuild state from L1 data and exit without the operator.';

        if (data === 'committee') {
          risks.push('Data availability rests on a committee. Withheld data blocks your exit even while every proof stays valid.');
          worst = 'Funds frozen if the committee withholds.';
        }
        if (data === 'own') {
          risks.push('Security is the sidechain validator set plus the bridge, not the L1 you deposited from.');
          worst = 'Funds are exactly as safe as the bridge signers.';
        }
        if (proof === 'fraud' && !perm) {
          risks.push('Fraud proofs exist but only a whitelist may submit them. The defence against an invalid state root is that list showing up.');
        }
        if (proof === 'consensus' && data === 'l1') {
          risks.push('Data is published but nothing on L1 checks the transition, so publishing buys reconstruction, not enforcement.');
        }
        if (seq === 'single' && !force) {
          risks.push('One sequencer and no escape hatch: an address can be censored indefinitely with no on-chain remedy.');
        }
        if (seq === 'single' && force) {
          risks.push('One sequencer, but forced inclusion bounds censorship to the inbox deadline. Confirm somebody has exercised it recently.');
        }
        if (up === 0) {
          risks.push('Upgrades are instant. Whoever holds the key can replace the bridge or verifier faster than users can withdraw.');
          worst = 'The upgrade key is a total-control key, whatever the proof system does.';
        }

        const exitH = proof === 'validity' ? 4 : proof === 'fraud' ? 24 * 7 : 2;
        const stage = (data === 'l1' && perm && up >= 168) ? 'stage 2 — proofs live, upgrades constrained'
          : (data === 'l1' && up >= 24) ? 'stage 1 — training wheels, but users can leave before a change lands'
          : 'stage 0 — the operators are the security';

        $(el, '#lp-out').innerHTML =
          'CLASSIFIED AS  <span class="hl">' + esc(family) + '</span>\n' +
          '  ' + esc(stage) +
          '\n\nWITHDRAWAL\n  canonical exit ≈ ' + (exitH >= 24 ? num(exitH / 24, 1) + ' days' : num(exitH, 0) + ' hours') +
          '\n  <span class="dim">a fast bridge shortens this by paying somebody to wait instead of you — a fee and one more counterparty</span>' +
          (force ? '\n  <span class="good">forced inclusion available</span>' : '\n  <span class="bad">no forced-inclusion path</span>') +
          '\n\nRISKS\n' + (risks.length
            ? risks.map(r => '  <span class="bad">•</span> ' + r).join('\n')
            : '  <span class="good">none of the standard training wheels are present</span>') +
          '\n\nWORST CASE\n  ' + (worst.indexOf('rebuild') === 0 || worst.indexOf('Anyone') === 0
            ? '<span class="good">' + worst + '</span>' : '<span class="bad">' + worst + '</span>') +
          '\n\n<span class="dim">Two chains can share a proof system and have nothing else in common. The proof constrains state ' +
          'transitions under the current contracts; whoever can replace those contracts is outside that constraint entirely.</span>';
      }
      $$(el, 'input, select').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- storage backends ---------- */
  reg('dstore', 'Cost and failure mode of keeping bytes',
    'Price the same data across storage models over a real horizon. The number matters less than the sentence underneath it: what has to keep happening for the bytes to survive.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Data size (GB)</label><input id="ds-gb" type="number" value="20" min="0.001" step="1"></div>
          <div class="field"><label>Horizon (years)</label><input id="ds-yr" type="number" value="10" min="1" max="100" step="1"></div>
          <div class="field"><label>Copies / pinning services</label><input id="ds-rep" type="number" value="2" min="1" max="9" step="1"></div>
        </div>
        <div class="row">
          <label class="opt"><input id="ds-enc" type="checkbox"><span>Encrypted before upload</span></label>
          <label class="opt"><input id="ds-pii" type="checkbox"><span>Contains personal data</span></label>
        </div>
        <div class="out" id="ds-out"></div>`;

      function run() {
        const gb = Math.max(0.001, Number($(el, '#ds-gb').value) || 0.001);
        const yr = Math.max(1, Number($(el, '#ds-yr').value) || 1);
        const rep = Math.max(1, Number($(el, '#ds-rep').value) || 1);
        const enc = $(el, '#ds-enc').checked;
        const pii = $(el, '#ds-pii').checked;

        // Rough public list prices, deliberately order-of-magnitude only.
        const pinPerGbMonth = 0.15, arweaveOnce = 6.5, filecoinPerGbYear = 0.02;
        const chainPerGb = 1.6e7;   // L1 calldata, at a boring gas price

        const models = [
          { n: 'IPFS + pinning', cost: gb * rep * pinPerGbMonth * 12 * yr, c: 'hl',
            f: 'Survives while somebody keeps paying. The invoice is the durability guarantee, and it outlives whoever set it up by exactly zero days.' },
          { n: 'Arweave endowment', cost: gb * arweaveOnce, c: 'good',
            f: 'Paid once. Durability rests on the endowment maths, which assumes storage costs keep falling. No delete, ever.' },
          { n: 'Filecoin deals', cost: gb * rep * filecoinPerGbYear * yr, c: 'good',
            f: 'Providers prove they still hold it and lose stake if they stop. Renew the deals — and plan retrieval separately, it is not a CDN.' },
          { n: 'On chain (L1 calldata)', cost: gb * chainPerGb, c: 'bad',
            f: 'Every full node stores it forever and you can never remove it. Correct for a 2 KB artefact, absurd above that.' }
        ];

        const rows = models.map(m =>
          '  <span class="' + m.c + '">' + m.n.padEnd(22) + '</span>' +
          (m.cost >= 1e6 ? '$' + num(m.cost / 1e6, 1) + 'M' : m.cost >= 1000 ? '$' + num(m.cost / 1000, 1) + 'k' : '$' + num(m.cost, 2)) +
          '\n      <span class="dim">' + m.f + '</span>').join('\n\n');

        $(el, '#ds-out').innerHTML =
          num(gb, 3) + ' GB over ' + num(yr, 0) + ' years, ' + num(rep, 0) + ' cop' + (rep === 1 ? 'y' : 'ies') + '\n\n' + rows +
          '\n\nANCHOR\n  Publish a Merkle root of the manifest on chain (one small transaction) and any single file can be proven ' +
          'against it later without fetching the rest. That is the part the chain is actually good at.' +
          (pii
            ? '\n\n<span class="bad">PERSONAL DATA: do not publish these bytes.</span>\n  Erasure obligations and an ' +
              'append-only store cannot both hold. Keep the plaintext where you can delete it, publish only salted hashes, and ' +
              'destroy the salt with the record. ' + (enc
                ? 'Encryption is not erasure — a leaked or aged key republishes everything retroactively.'
                : 'Nothing here is even encrypted yet.')
            : enc
              ? '\n\n<span class="good">Encrypted before upload.</span> Keep the keys out of the same system, and remember a CID ' +
                'is an address, not a password — obscurity has never protected an unencrypted upload.'
              : '\n\n<span class="dim">Unencrypted uploads are world-readable the moment the CID is known, and CIDs leak through ' +
                'gateways, frontends and anyone who ever had the link.</span>');
      }
      $$(el, 'input').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- governance capture ---------- */
  reg('govern', 'Price a governance takeover',
    'Set the distribution, the quorum and the delays, then compare what capture costs with what the treasury holds. Turn the snapshot off to watch a flash loan walk in.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Circulating supply (M)</label><input id="gv-sup" type="number" value="300" min="1" step="10"></div>
          <div class="field"><label>Price (USD)</label><input id="gv-px" type="number" value="0.40" min="0.0001" step="0.05"></div>
          <div class="field"><label>Quorum (% of supply)</label><input id="gv-q" type="number" value="4" min="0.1" max="60" step="0.5"></div>
          <div class="field"><label>Habitual turnout (%)</label><input id="gv-turn" type="number" value="6" min="0.1" max="100" step="1"></div>
        </div>
        <div class="row">
          <div class="field"><label>Order-book depth (USD, 2% move)</label><input id="gv-depth" type="number" value="250000" min="1000" step="50000"></div>
          <div class="field"><label>Treasury (USD M)</label><input id="gv-tre" type="number" value="120" min="1" step="10"></div>
          <div class="field"><label>Timelock (days)</label><input id="gv-tl" type="number" value="2" min="0" max="30" step="1"></div>
        </div>
        <div class="row">
          <label class="opt"><input id="gv-snap" type="checkbox" checked><span>Voting power read at a snapshot block</span></label>
          <label class="opt"><input id="gv-bribe" type="checkbox"><span>An active vote-rental market exists</span></label>
        </div>
        <div class="out" id="gv-out"></div>`;

      function run() {
        const supply = Math.max(1, Number($(el, '#gv-sup').value) || 1) * 1e6;
        const px = Math.max(0.0001, Number($(el, '#gv-px').value) || 0.0001);
        const qPct = Math.max(0.1, Number($(el, '#gv-q').value) || 0.1) / 100;
        const turnout = Math.max(0.1, Number($(el, '#gv-turn').value) || 0.1) / 100;
        const depth = Math.max(1000, Number($(el, '#gv-depth').value) || 1000);
        const treasury = Math.max(1, Number($(el, '#gv-tre').value) || 1) * 1e6;
        const timelock = Math.max(0, Number($(el, '#gv-tl').value) || 0);
        const snap = $(el, '#gv-snap').checked;
        const bribe = $(el, '#gv-bribe').checked;

        // Enough to out-vote the habitual turnout, but never below the quorum bar.
        const share = Math.max(qPct, turnout / 2 + 0.0001);
        const naive = supply * share * px;
        // Sweeping a thin book costs more than the quote: 2% of depth per 2% of move.
        const impact = 1 + Math.min(9, naive / depth);
        const buyCost = naive * impact;
        // Renting votes skips the inventory risk entirely and is priced per vote.
        const rentCost = naive * 0.08;
        const cost = bribe ? Math.min(buyCost, rentCost) : buyCost;

        const ratio = treasury / cost;
        const safeQuorum = Math.min(0.5, (treasury / 3) / (supply * px * impact));

        $(el, '#gv-out').innerHTML =
          'TO CARRY A VOTE\n' +
          '  tokens needed        ' + num(supply * share / 1e6, 2) + 'M  <span class="dim">(' + pct(share, 2) + ' of supply' +
            (share > qPct ? ', above quorum because turnout is ' + pct(turnout, 1) : '') + ')</span>\n' +
          '  quoted cost          $' + num(naive / 1e6, 2) + 'M\n' +
          '  after price impact   <span class="hash">$' + num(buyCost / 1e6, 2) + 'M</span>  <span class="dim">×' + num(impact, 2) +
            ' on a book that absorbs $' + num(depth / 1000, 0) + 'k per 2%</span>\n' +
          (bribe ? '  or rent the votes    <span class="bad">$' + num(rentCost / 1e6, 2) + 'M</span>  <span class="dim">bribe markets sell ' +
            'a single vote without the inventory risk</span>\n' : '') +
          '\nAGAINST A TREASURY OF $' + num(treasury / 1e6, 0) + 'M\n' +
          (ratio > 1
            ? '  <span class="bad">CAPTURE IS PROFITABLE — the prize is ' + num(ratio, 1) + '× the cost.</span>\n' +
              '  Quorum would need to be about ' + pct(safeQuorum, 1) + ' of supply before that stops being true.'
            : '  <span class="good">Capture costs ' + num(1 / ratio, 1) + '× what it could take.</span>  Re-check after any drawdown: ' +
              'the cost side falls with the price while the treasury does not.') +
          '\n\nFLASH LOAN\n' +
          (snap
            ? '  <span class="good">Blocked.</span> Weight comes from balances checkpointed at the proposal’s snapshot block, so tokens ' +
              'borrowed and repaid inside one transaction carry none. Acquiring weight means holding across blocks — visible, and at risk.'
            : '  <span class="bad">Open.</span> Voting power is read at vote time, so an attacker borrows the supply, votes and repays ' +
              'atomically. Cost of the attack: fees. Several protocols have lost their treasury exactly this way.') +
          '\n\nDELAY\n' +
          (timelock > 0
            ? '  <span class="good">' + num(timelock, 0) + '-day timelock.</span> A passed proposal becomes a public countdown: holders ' +
              'can exit and a cancel-only guardian can veto. Delay keeps working when your assumptions about voters do not.'
            : '  <span class="bad">No timelock.</span> A vote that passes executes immediately, so nobody finds out in time to leave. ' +
              'This is the single cheapest fix on this page.') +
          '\n\n<span class="dim">A teaching model: it ignores the tokens that never vote, the cost of exiting the position afterwards, ' +
          'and any social layer that forks away from a hostile outcome. It is deliberately generous to the attacker on price impact ' +
          'and generous to the defender everywhere else.</span>';
      }
      $$(el, 'input').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- do you need a chain ---------- */
  reg('chaintype', 'Do you actually need a blockchain',
    'Four questions, answered in order. The first one that fails is the answer — everything after it is a more expensive way to get the same property.',
    function (el) {
      el.innerHTML = `
        <div class="row">
          <div class="field"><label>Organisations that write</label><input id="ct-w" type="number" value="3" min="1" max="50" step="1"></div>
          <div class="field"><label>Sustained writes / second</label><input id="ct-tps" type="number" value="50" min="1" step="10"></div>
        </div>
        <div class="row">
          <label class="opt"><input id="ct-dist" type="checkbox" checked><span>They refuse each other’s records as the truth</span></label>
          <label class="opt"><input id="ct-int" type="checkbox"><span>An intermediary they all accept exists</span></label>
        </div>
        <div class="row">
          <label class="opt"><input id="ct-ord" type="checkbox" checked><span>They need one agreed ordering, not later reconciliation</span></label>
          <label class="opt"><input id="ct-pub" type="checkbox"><span>Strangers can join and transact</span></label>
          <label class="opt"><input id="ct-pii" type="checkbox"><span>The records contain personal data</span></label>
        </div>
        <div class="out" id="ct-out"></div>`;

      function run() {
        const writers = Math.max(1, Number($(el, '#ct-w').value) || 1);
        const tps = Math.max(1, Number($(el, '#ct-tps').value) || 1);
        const distrust = $(el, '#ct-dist').checked;
        const inter = $(el, '#ct-int').checked;
        const ordering = $(el, '#ct-ord').checked;
        const pub = $(el, '#ct-pub').checked;
        const pii = $(el, '#ct-pii').checked;

        const checks = [
          [writers >= 2, 'two or more writing organisations', writers + ' writer' + (writers === 1 ? '' : 's')],
          [distrust, 'mutual distrust', distrust ? 'nobody may hold the pen alone' : 'they accept each other’s records'],
          [!inter, 'no acceptable intermediary', inter ? 'one exists and is already trusted' : 'none they would all accept'],
          [ordering, 'shared ordering required', ordering ? 'one consistent view' : 'reconciliation is enough']
        ];

        const rows = checks.map(c => '  ' + (c[0] ? '<span class="good">holds</span>' : '<span class="bad">FAILS</span>') +
          '   ' + c[1] + '   <span class="dim">' + c[2] + '</span>').join('\n');

        let answer, because, caveat = '';
        if (writers < 2) {
          answer = 'A database with an append-only signed log';
          because = 'A single writer gains nothing from consensus. Hash-chain the entries, sign them, publish a root periodically, ' +
            'and an auditor can verify that history was never rewritten — for the cost of one small transaction a day.';
        } else if (!distrust) {
          answer = 'A shared database or an API with a shared schema';
          because = 'Parties who accept each other’s records do not have a Byzantine problem. They have an integration problem, ' +
            'and consensus is an expensive way to avoid writing an interface.';
        } else if (inter) {
          answer = 'Use the intermediary, and anchor its log publicly';
          because = 'A neutral party everyone already accepts is cheaper than a consortium. Anchoring its log keeps it honest ' +
            'without asking every participant to run infrastructure.';
        } else if (!ordering) {
          answer = 'Independent logs, cross-anchored';
          because = 'Each party keeps its own log and publishes Merkle roots. You get tamper evidence without anyone having to ' +
            'agree a global order — which is the expensive half.';
        } else if (pub) {
          answer = 'A public chain';
          because = 'Open participation and adversarial users are precisely what permissionless consensus was built for. ' +
            'Everything in the first twelve modules applies.';
        } else {
          answer = 'A permissioned consortium chain';
          because = 'Known writers who distrust each other and need one ordering: BFT among named validators, no Sybil resistance ' +
            'required, throughput up, censorship resistance gone.';
          caveat = 'The hard part is not the technology. Who runs a node, who pays, who resolves a dispute and what happens when ' +
            'a member leaves — settle that first, because it is what killed the last wave of pilots.' +
            (tps > 3000 ? ' At ' + num(tps, 0) + ' writes/second, check the parties are genuinely sharing state rather than using a chain as a message bus.' : '');
        }

        $(el, '#ct-out').innerHTML =
          rows + '\n\n<span class="hl">' + esc(answer) + '</span>\n  ' + because +
          (caveat ? '\n\n<span class="dim">' + caveat + '</span>' : '') +
          (pii
            ? '\n\n<span class="bad">PERSONAL DATA</span>\n  Erasure obligations and an immutable ledger are incompatible, and ' +
              'encryption is not erasure. Even a plain hash of a name, an email or a national ID is brute-forceable, so it is still ' +
              'personal data in practice. Keep plaintext in a system you can erase, commit to salted hashes, and destroy the salt ' +
              'with the record. Have this reviewed before launch, not after.'
            : '') +
          '\n\n<span class="dim">Say it out loud in the meeting: which conditions fail, what the alternative costs, and that it can ' +
          'migrate to a shared ledger the day a third independent writer actually appears.</span>';
      }
      $$(el, 'input').forEach(i => { i.oninput = run; i.onchange = run; }); run();
    });

  /* ---------- export ---------- */
  global.LABS = LABS;
})(window);
