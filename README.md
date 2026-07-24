# Blockchain Roadmap

A complete, self-contained blockchain learning course: **66 lessons across 14 modules**, one lesson per
session, each with a line diagram, worked code examples and a live lab that runs in the page.

A **React 18 + Vite** shell owns the routing, navigation, progress, search and theme, and renders each
lesson. The curriculum data, the 66 interactive labs and the 84 diagrams are the original vanilla-JS
code — untouched, loaded as classic scripts, and wrapped by React rather than rewritten.

```bash
npm install
npm run dev        # http://localhost:5173
```

No network access, no telemetry. Progress is stored in your own browser's `localStorage` and never
leaves the machine.

---

## What is in it

| Module | Title | Lessons | Focus |
|---|---|---|---|
| 1 | Foundations & Cryptography | 5 | ledgers, hashing, keys and signatures, Merkle trees, chains |
| 2 | Bitcoin & Consensus | 4 | UTXOs, proof of work, proof of stake, forks and reorgs |
| 3 | Ethereum & Solidity | 6 | accounts, gas and EIP-1559, the EVM, storage layout, ERC-20, ERC-721/1155 |
| 4 | Tooling & dApps | 4 | Foundry and Hardhat, fuzz and invariant testing, viem frontends, deploy/verify/index |
| 5 | Security & Gas | 3 | reentrancy and the classic bug families, oracles/MEV/signatures, gas and upgradeability |
| 6 | DeFi, Scaling & Capstone | 4 | AMMs, lending and liquidation, rollups and bridges, a ZK sealed-bid auction capstone |
| 7 | Sui & Move | 10 | object ownership, Move, PTBs, shared dApps, Kiosk policies, sponsorship, walletless auth, DeepBook, AMMs and lending |
| 8 | Stellar & Soroban | 4 | assets and anchors, SCP quorum slices, atomic multisig transactions, Soroban authorization and storage |
| 9 | NFTs & GameFi | 3 | metadata, marketplaces, royalties, game economies, assets and randomness |
| 10 | DevOps & Validator Operations | 4 | node capacity, validator safety, observability, releases and recovery |
| 11 | Advanced Protocol Systems | 5 | MEV, cross-chain messaging, smart wallets, production cryptography and reorg-safe indexing |
| 12 | Oracles & Data Feeds | 4 | the oracle problem, push and pull feeds, feed guards, manipulation cost and TWAPs, VRF, keepers, optimistic and custom oracles |
| 13 | Ecosystem & Architecture Choices | 6 | picking a chain, RPC providers and rented trust, the L2 landscape, decentralised storage, tokenomics and DAO governance, and when a database wins |
| 14 | Chainlink Core Stack | 4 | OCR data-feed architecture, safe feed integration and monitoring, VRF request lifecycles, and idempotent Automation upkeeps |

Every lesson contains:

- **objectives** — what you can do afterwards, not what you will have read
- **explanation** — the mechanics, including the failure modes
- **a line diagram** — the same mechanics as a picture; it draws itself when you reach it
- **worked code** — Move, Solidity, TypeScript, shell, all copyable
- **a live lab** — 66 of them, listed below
- **a quiz** — with an explanation on every answer, right or wrong
- **exercises** — the part that needs a keyboard
- **resources** — specs, docs and primary sources

Roughly 80 hours of guided material, plus the exercises.

## The labs

These are not animations. They compute the real thing.

| Lesson | Lab | What it does |
|---|---|---|
| 01 | `ledger` | five node copies, corrupt one, majority consensus repairs it |
| 02 | `hash` | SHA-256 / Keccak-256 / SHA-256d with a live bit-avalanche count |
| 03 | `keys` | real secp256k1 keygen, EIP-55 address derivation, sign, verify, tamper |
| 04 | `merkle` | build a tree, extract an inclusion proof, verify it step by step |
| 05 | `chain` | editable blocks; tamper with one and watch everything after it break |
| 06 | `utxo` | select unspent outputs, compute change, catch dust and overspends |
| 07 | `mine` | genuine proof of work, adjustable difficulty, live hash rate |
| 08 | `consensus` | stake-weighted proposer selection over thousands of slots, plus slashing |
| 09 | `reorg` | two branches; extend either and watch confirmed transactions revert |
| 10 | `accounts` | EOA versus contract account, both addresses derived from scratch |
| 11 | `gas` | EIP-1559 burn/tip split, refunds, and base-fee projection |
| 12 | `evm` | a stepping stack machine: stack, memory, storage and gas per opcode |
| 13 | `storage` | slot arithmetic for values, mappings, nested mappings and arrays |
| 14 | `erc20` | balances, allowances, `transferFrom` — and the approve front-running race |
| 15 | `nft` | ERC-721 versus ERC-1155 ledgers side by side |
| 16 | `selector` | signature → 4-byte selector, calldata encode and decode |
| 17 | `fuzz` | randomised sequences break a fee-token's supply invariant |
| 18 | `sign` | EIP-191 and EIP-712 digests; change the chain id and watch replay protection work |
| 19 | `create2` | CREATE address drift by nonce versus deterministic CREATE2 |
| 20 | `reentrancy` | call-stack trace of a drain, then the same attack against CEI and a mutex |
| 21 | `sandwich` | solves for the bot's most profitable front-run given your slippage tolerance |
| 22 | `gasopt` | struct packing calculator: declaration order versus gas |
| 23 | `amm` | x·y=k swaps, non-linear price impact, impermanent loss |
| 24 | `lending` | health factor, liquidation price, and a working partial liquidation |
| 25 | `rollup` | calldata versus blob economics, and the three withdrawal paths |
| 26 | `commit` | commit-reveal — then crack a saltless commitment by brute force |
| 27 | `suiobjects` | owned, shared and immutable objects; see the execution path change |
| 28 | `suicap` | Move abilities and an AdminCap authority check |
| 29 | `suiptb` | assemble a split, move call and transfer as one programmable transaction block |
| 30 | `suishared` | compare shared coordination with address-owned state and inspect events |
| 31 | `suikiosk` | Kiosk custody, transfer-policy receipts and creator royalties |
| 32 | `suisponsor` | user intent and gas-station policy checks in a sponsored transaction |
| 33 | `suiauth` | compare wallets, zkLogin and passkeys through their custody and recovery boundaries |
| 34 | `suibook` | sweep a limit-order book while respecting the signed limit price |
| 35 | `suiamm` | quote a shared-pool swap, then test a signed slippage limit after earlier execution |
| 36 | `suilend` | calculate health factor, liquidation price and partial-liquidation incentive |
| 37 | `stellarassets` | add a trustline, check XLM reserve, then compare strict-send and strict-receive path-payment limits |
| 38 | `stellarquorum` | compare intersecting and disconnected quorum configurations under validator failures |
| 39 | `stellarmultisig` | meet a threshold, bound a transaction in time and observe atomic rollback on a failed operation |
| 40 | `sorobanauth` | test explicit authorization and choose a TTL policy for durable or temporary contract state |
| 41 | `nftmeta` | compare metadata storage choices and inspect the pointer chain behind an NFT |
| 42 | `gamefi` | size faucets and sinks, then watch a reward economy’s supply and price feedback loop |
| 43 | `gameassets` | compare game-asset custody and randomness sources against a reverting attacker |
| 44 | `nodeops` | size node storage and map public, private and validator network boundaries |
| 45 | `valops` | test safe validator failover and key-separation decisions |
| 46 | `opsobserve` | turn node signals into useful alert and incident decisions |
| 47 | `opsrelease` | evaluate a safe release, backup and restore plan |
| 48 | `mevflow` | compare a quoted swap, signed slippage tolerance and an adverse ordering move |
| 49 | `xchain` | test source-domain verification and single-use message consumption |
| 50 | `smartwallet` | check a session-key call against target, value and expiry policy bounds |
| 51 | `cryptops` | compare single-key, multisig and threshold-custody availability under participant failure |
| 52 | `indexer` | ingest a chain event, then handle a reorg by updating canonical status |
| 53 | `oraclebasics` | add faulty reporters to a committee and compare what a median and a mean do with them |
| 54 | `oraclefeed` | fire every price-feed guard in turn: stale, negative, band-pinned, sequencer down, feeds disagreeing |
| 55 | `oracletwap` | price an oracle attack from pool depth, TWAP window and borrow cap |
| 56 | `oracledesign` | try to sneak a replayed, expired or double-signed report past a custom m-of-n oracle |
| 57 | `chainfit` | eliminate chains against hard requirements — throughput, finality, language, liquidity, sovereignty |
| 58 | `rpcpool` | break a multi-provider quorum with downed, lagging and lying endpoints behind one upstream |
| 59 | `l2pick` | build an L2 from data location, proof type and escape hatches, then read back its stage and worst case |
| 60 | `dstore` | price the same bytes on pinning, Arweave, Filecoin and calldata across a retention horizon |
| 61 | `govern` | attack a DAO: buy the quorum, price the slippage, compare the cost against the treasury prize |
| 62 | `chaintype` | run the four-question test and watch it answer "database" more often than "blockchain" |
| 63 | `chainlinkocr` | trace a price from sources through an OCR quorum and identify the trust boundary at every stage |
| 64 | `chainlinkfeed` | normalise feed decimals, trip freshness checks and choose an outage policy for each risk action |
| 65 | `chainlinkvrf` | follow concurrent VRF requests through delayed fulfilment and safe, separate claims |
| 66 | `chainlinkautomation` | process a bounded upkeep backlog while handling stale simulations and repeated calls |

## Running it

```bash
npm install        # once
npm run dev        # dev server with HMR at http://localhost:5173
```

To build a static bundle:

```bash
npm run build      # emits dist/
npm run preview    # serves the built dist/ to check it
```

The build uses `base: './'`, so `dist/` is fully relative — everything, including the cryptography,
the labs and saved progress, still works when opened straight from `file://`.

Node 18+ is required.

## Keyboard

| Key | Action |
|---|---|
| `/` | focus the lesson search |
| `←` `→` | previous / next lesson |
| `Esc` | clear search, close the mobile sidebar |

The header buttons toggle the theme (`◐`) and reset progress (`⟲`).

## Layout

The React shell lives in `src/`. The legacy engine — the parts that are hard to improve on and were
never the point of the rewrite — lives in `public/`, served verbatim and exposed on `window`.

```
index.html                    Vite entry: #root, the classic <script>s, then /src/main.jsx
vite.config.js                base: './', @vitejs/plugin-react

src/main.jsx                  mounts <App/> once the window globals exist
src/App.jsx                   shell: route + navOpen + query + theme + reset + keyboard shortcuts
src/data.js                   derives modules/lessons/labs from window.ROADMAP + window.LABS
src/hooks/                    useProgress (localStorage), useTheme, useHashRoute
src/lib/                      highlight.js (syntax highlighter), flash.js (toast)
src/components/               Topbar, Sidebar, Home, Lesson, Lab, DiagramPanel, CodeBlock, Quiz

public/css/style.css          layout and components; light and dark via [data-theme]
public/css/anime.css          the anime skin — palette, glow, brackets, diagram styling
public/js/lib/crypto-lite.js  window.CL — SHA-256, Keccak-256, secp256k1, EIP-55 — from scratch
public/js/data/modules.js     window.ROADMAP — module metadata + the empty lessons array
public/js/data/module-1..14.js the 66 lessons
public/js/diagrams.js         window.DIA — 84 inline-SVG line diagrams + their draw-in animation
public/js/playground.js       window.LABS — all 66 interactive labs
```

The classic scripts are plain `<script>` tags, so they run in order during parse — before the deferred
React module bundle — and their globals are ready when React mounts. Load order still matters:
`crypto-lite` → `modules` → `module-1..13` → `diagrams` → `playground`, then `/src/main.jsx`.

React only owns the shell and lesson rendering. It **wraps** the imperative code rather than porting it:
each lab is mounted with `LABS[key].mount(el)` inside a `useEffect`, and each diagram is handed to
`DIA.animate(container)` the same way. `dangerouslySetInnerHTML` injects the lesson HTML the data files
already carry. Nothing in `public/js/` was rewritten.

The pre-React app is kept for reference at `index.legacy.html` and `public/js/app.legacy.js`.
`anime.css` loads after `style.css` and only overrides presentation; delete it and the app still works.

## The diagrams

Every lesson gets a **Diagram** panel between the explanation and the code — 84 of them, plus a
roadmap overview on the home page. They are hand-laid inline SVG built by a small drawing kit in
`public/js/diagrams.js` (`box`, `arr`, `elb`, `cur`, `flow`, `life`, `diamond`, `cyl`, …).

Nothing is rasterised and nothing is fetched. Strokes and fills read CSS custom properties, so the
diagrams re-theme with the page and stay sharp at any zoom. Arrowheads are real polygons rather than
SVG `<marker>`s, because a marker cannot portably inherit the colour of the line that references it.
On narrow screens each diagram scrolls sideways inside its figure instead of shrinking the labels.

**They draw themselves.** When a diagram scrolls into view the boxes pop in, each line draws along its
own length, then the arrowheads and labels arrive — so you watch the flow being built in the order it
happens rather than meeting it all at once. Afterwards a little ambient motion remains: dashed flow
arrows march, and a pulse travels down the busiest wires. **▶ replay** on any figure runs it again.

The mechanism is an `IntersectionObserver` plus two classes on the `<svg>` — `.run` while it draws,
`.flow` once it has settled — so the browser animates opacity, transform and `stroke-dashoffset` and
nothing runs off-screen. `prefers-reduced-motion: reduce` skips the whole thing: every diagram renders
static and finished, and the replay button is hidden. Printing does the same.

Add one by calling `add(lessonId, title, caption, width, height, svgBody)` in `public/js/diagrams.js`;
the lesson picks it up automatically.

### Why the crypto is hand-rolled

Pages opened from `file://` are not a *secure context*, so `window.crypto.subtle` is `undefined` there —
and a `base: './'` production build is meant to open that way. Rather than depend on the platform,
`public/js/lib/crypto-lite.js` implements SHA-256 (FIPS 180-4), Keccak-256 (the pre-standard padding
Ethereum uses, `0x01`, not SHA-3's `0x06`) and secp256k1 ECDSA with low-`s` normalisation, in plain
JavaScript and `BigInt`.

`CL.selfTest()` runs automatically on load and prints a table to the console. It checks the published
test vectors for both hash functions, derives a known Ethereum address, and round-trips a signature.
Run it yourself any time from the console.

> **This is teaching code.** It is not constant-time and has had no audit. Use it to learn what the
> algorithms do; use `noble-curves`, `viem` or `ethers` for anything that touches real value.
> Never reuse a key generated by a lab, a tutorial or a test suite — those are public knowledge and
> sweeper bots empty them within seconds.

## Adding a lesson

1. Append to the relevant `public/js/data/module-N.js`:

```js
L.push({
  id: 'l31', module: 7, num: 31,
  title: 'Your Lesson',
  level: 'Intermediate',        // Beginner | Intermediate | Advanced
  minutes: 70,
  summary: 'One sentence.',
  objectives: ['...'],
  body: '<p>HTML. Use .note, .note.warn, .note.danger, tables, code.</p>',
  code: [{ lang: 'solidity', file: 'Thing.sol', caption: 'Optional.', src: '...' }],
  lab: 'yourLabKey',            // must exist in window.LABS
  quiz: [{ q: '...', options: ['a','b','c','d'], answer: 0, why: '...' }],
  tasks: ['...'],
  resources: [{ type: 'spec', title: '...', url: '...' }]
});
```

2. Register the lab in `public/js/playground.js`:

```js
reg('yourLabKey', 'Lab title', 'What the learner should try.', function (el) {
  el.innerHTML = '<div class="field">…</div><div class="out" id="x-log"></div>';
});
```

Lesson data lives inside template literals, so: no backticks in `body` or `src`, escape `\${` when a
sample contains a JS template literal, and write apostrophes in quiz text as `’`.

Available lab classes: `.field`, `.row` (+ `.shrink`), `.out` (+ `.tight`), `.btn` (+ `.primary`,
`.ghost`, `.sm`), `.kv`, `.block-card` (+ `.valid`, `.invalid`), `.chain-flow`, `.tree` / `.tree-level`
/ `.node`, `.bars` / `.barrow`, and the inline colours `.hash`, `.good`, `.bad`, `.dim`, `.hl`.

## Browser support

Any current Chrome, Firefox, Safari or Edge. Requires `BigInt`, `Array.flatMap` and CSS
`color-mix()`. Responsive down to phone width; the sidebar collapses below 980px.
`prefers-reduced-motion` and printing are both handled.

## Licence

Do whatever you like with it. The linked specifications and documentation belong to their authors.
