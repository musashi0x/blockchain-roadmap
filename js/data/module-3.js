/* Module 3 — Ethereum & Solidity (lessons 10-15) */
(function (L) {

L.push({
  id: 'l10', module: 3, num: 10,
  title: 'Ethereum Architecture and Accounts',
  level: 'Intermediate', minutes: 60,
  summary: 'Ethereum is a replicated state machine. Learn the two account types, the world state trie, and what a "transaction" really does to it.',
  objectives: [
    'Describe Ethereum as a state transition function',
    'Distinguish externally owned accounts from contract accounts',
    'Explain nonces, storage roots and code hashes',
    'Trace what happens between submitting a transaction and it landing in state'
  ],
  body: `
<h3>One formula</h3>
<p style="text-align:center"><code>σ' = Υ(σ, T)</code></p>
<p>The world state <code>σ</code> plus a transaction <code>T</code> yields a new world state <code>σ'</code>. Every node applies the same function to the same inputs and must reach the same output — determinism is non-negotiable, which is why the EVM has no randomness, no clock beyond block values, no floating point and no network access.</p>
<p>A block is a batch of transactions applied in order, plus the resulting state root committed in the header.</p>

<h3>Two kinds of account</h3>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>Externally Owned Account (EOA)</th><th>Contract Account</th></tr></thead>
<tbody>
<tr><td>Controlled by</td><td>A private key</td><td>Its own code</td></tr>
<tr><td>Has code</td><td>No (until EIP-7702 delegation)</td><td>Yes, immutable after deployment</td></tr>
<tr><td>Has storage</td><td>No</td><td>Yes</td></tr>
<tr><td>Can initiate a transaction</td><td>Yes — only EOAs can</td><td>No; it can only react</td></tr>
<tr><td>Address derived from</td><td>keccak(pubkey)[12:]</td><td>keccak(rlp(creator, nonce))[12:] or CREATE2</td></tr>
</tbody>
</table>
</div>
<p>Nothing ever happens on Ethereum without an EOA paying to start it. A contract calling another contract is an <em>internal</em> call inside one transaction, not a separate transaction — which is why internal transfers do not appear in a normal transaction list.</p>

<h3>The four fields of every account</h3>
<ul>
  <li><strong>nonce</strong> — for EOAs, the count of sent transactions (replay protection and ordering). For contracts, the number of contracts they have created.</li>
  <li><strong>balance</strong> — wei held. 1 ETH = 10<sup>18</sup> wei; gwei = 10<sup>9</sup> wei.</li>
  <li><strong>storageRoot</strong> — Merkle-Patricia root of this contract's key/value storage.</li>
  <li><strong>codeHash</strong> — keccak256 of the deployed bytecode. Immutable, which is why upgradeability requires proxies (Lesson 22).</li>
</ul>

<div class="note">
  <span class="tag">Nonce gaps stall you</span>
  <p>Transactions from one account execute in strict nonce order. Broadcast nonce 5 and nonce 7, and 7 waits in the mempool forever until 6 appears. "Stuck transaction" almost always means a gap — the fix is to resubmit the missing nonce, or replace it with a higher-fee transaction using the same nonce.</p>
</div>

<h3>The state trie</h3>
<p>Ethereum stores state in a Merkle-Patricia trie keyed by <code>keccak256(address)</code>. Each contract's storage is a second trie keyed by <code>keccak256(slot)</code>. The consequences are practical:</p>
<ul>
  <li>The block header's single <code>stateRoot</code> commits to every balance and every storage slot on the network.</li>
  <li><code>eth_getProof</code> can prove any account or slot value against that root — this is how light clients and cross-chain bridges read state.</li>
  <li>Writing state is expensive because it rewrites a path through the trie, not just a leaf. That is the real reason <code>SSTORE</code> costs thousands of gas.</li>
</ul>

<h3>Lifecycle of a transaction</h3>
<ol>
  <li>Wallet builds and signs the transaction; the sender address is implied by the signature.</li>
  <li>It is broadcast to a node, validated (signature, nonce, sufficient balance for value + max fee), and gossiped into the mempool.</li>
  <li>Searchers and builders see it. If it is profitable to reorder or sandwich, they will (Lesson 21).</li>
  <li>A block builder includes it; a proposer signs the block.</li>
  <li>Every node re-executes it and updates the state trie.</li>
  <li>After two epochs (~13 min) the containing block is finalised.</li>
</ol>

<h3>The client stack after the Merge</h3>
<p>An Ethereum node is now two processes: an <strong>execution client</strong> (Geth, Nethermind, Reth, Erigon) that runs the EVM and holds state, and a <strong>consensus client</strong> (Prysm, Lighthouse, Teku, Nimbus) that runs proof of stake. They speak over the Engine API. Client diversity matters for safety: if a single client holding more than a third of the network has a consensus bug, finality stalls; above two thirds, it can finalise an invalid chain.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'state.js',
      caption: 'The state transition, stripped to its essentials. Real execution adds gas metering, logs, refunds and access lists.',
      src: `// World state: address -> account
const state = new Map();

const account = () => ({ nonce: 0, balance: 0n, code: null, storage: new Map() });

function applyTx(state, tx) {
  const from = state.get(tx.from) ?? account();

  // 1. validity checks, in the order a client performs them
  if (tx.nonce !== from.nonce)                       throw new Error('bad nonce');
  const maxCost = tx.value + BigInt(tx.gasLimit) * tx.maxFeePerGas;
  if (from.balance < maxCost)                        throw new Error('insufficient funds');

  // 2. deduct upfront: gas is paid whether or not execution succeeds
  from.balance -= BigInt(tx.gasLimit) * tx.maxFeePerGas;
  from.nonce += 1;

  // 3. execute
  const to = state.get(tx.to) ?? account();
  let gasUsed = 21000n;                              // intrinsic cost of any tx
  try {
    from.balance -= tx.value;
    to.balance += tx.value;
    if (to.code) gasUsed += runEVM(to.code, tx.data, state);
  } catch (e) {
    // revert restores balances and storage, but the gas spent is gone
    return { status: 0, gasUsed, error: e.message };
  }

  // 4. refund the unused gas allowance
  from.balance += (BigInt(tx.gasLimit) - gasUsed) * tx.maxFeePerGas;
  return { status: 1, gasUsed };
}`
    },
    {
      lang: 'text', file: 'account.json',
      caption: 'What eth_getProof returns for a contract. Four fields plus the proof path up to the block\'s stateRoot.',
      src: `{
  "address":     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "nonce":       "0x1",
  "balance":     "0x0",
  "storageHash": "0x2f0c...b41e",   // root of this contract's storage trie
  "codeHash":    "0xb044...8c3d",   // keccak256(bytecode) - immutable
  "accountProof": [ "0xf90211a0...", "0xf90211a0...", ... ],
  "storageProof": [{
    "key":   "0x0",
    "value": "0x0de0b6b3a7640000",
    "proof": [ "0xf871808080...", ... ]
  }]
}`
    }
  ],
  lab: 'accounts',
  quiz: [
    {
      q: 'A contract needs to run a task every hour. What is the correct architecture?',
      options: [
        'Add a timer to the contract constructor',
        'Contracts cannot self-trigger; an EOA (or a keeper network paid to act as one) must send a transaction',
        'Use block.timestamp in a loop',
        'Register a cron job with the node'
      ],
      answer: 1,
      why: 'The EVM only executes in response to a transaction, and only EOAs can originate transactions. Recurring work needs an external trigger — Chainlink Automation, Gelato, or your own bot.'
    },
    {
      q: 'You send nonce 12 with a low fee, then nonce 13 with a high fee. What happens?',
      options: [
        '13 is mined first because it pays more',
        'Both are mined together',
        'Neither can be mined until 12 is included, because nonces execute in strict order',
        '13 is rejected as invalid'
      ],
      answer: 2,
      why: 'Strict per-account ordering. To unstick this, replace nonce 12 with a higher-fee transaction of the same nonce (at least 10% higher on most clients) — or cancel it by sending 0 ETH to yourself at nonce 12.'
    },
    {
      q: 'Why does writing to contract storage cost thousands of gas while reading a memory variable costs 3?',
      options: [
        'Storage writes require a signature',
        'Storage writes rewrite a path through the global state trie and must be replicated by every node forever',
        'Memory is cached on chain',
        'It is an arbitrary fee to fund the treasury'
      ],
      answer: 1,
      why: 'Memory is discarded when the call ends. Storage becomes part of consensus state that every current and future node stores and re-hashes. Gas pricing tracks that permanent, network-wide cost.'
    }
  ],
  tasks: [
    'Use the lab to send a value transfer, then a failing contract call. Note that gas is consumed in both cases but state changes revert only in the second.',
    'Look up a token contract on Etherscan and find its codeHash, then confirm the address has nonce 1 if it deployed exactly one contract.',
    'Explain in writing why internal transactions do not appear in eth_getBlockByNumber transaction lists.',
    'Check current client diversity statistics and state which single execution client failing would stall finality.'
  ],
  resources: [
    { type: 'docs', title: 'Ethereum accounts', url: 'https://ethereum.org/en/developers/docs/accounts/' },
    { type: 'read', title: 'Merkle Patricia Trie explained', url: 'https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/' },
    { type: 'data', title: 'Client diversity dashboard', url: 'https://clientdiversity.org/' }
  ]
});

L.push({
  id: 'l11', module: 3, num: 11,
  title: 'Transactions, Gas and EIP-1559',
  level: 'Intermediate', minutes: 60,
  summary: 'Gas is a metering unit, not a price. Understand base fee, priority fee, blobs, and how to stop overpaying.',
  objectives: [
    'Explain why gas exists and what it prices',
    'Compute the exact cost of a transaction under EIP-1559',
    'Describe base fee adjustment and why it targets 50% fullness',
    'Read a gas profile and identify the expensive operations'
  ],
  body: `
<h3>Why gas exists</h3>
<p>The halting problem is not a theoretical worry here: a contract can loop forever, and every node would loop with it. Gas solves this by charging per operation from a prepaid budget. When the budget runs out, execution halts and reverts — but the gas is still consumed. Denial of service becomes expensive rather than free.</p>
<p>Gas also prices externalities: an operation's gas cost approximates the resources it forces onto every node — CPU, memory, disk, and permanent state growth.</p>

<h3>Representative costs</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Operation</th><th>Gas</th><th>Why</th></tr></thead>
<tbody>
<tr><td>ADD, LT, arithmetic</td><td>3</td><td>Pure CPU</td></tr>
<tr><td>MLOAD / MSTORE</td><td>3 + expansion</td><td>Memory is quadratic beyond ~700 bytes</td></tr>
<tr><td>SLOAD (cold)</td><td>2,100</td><td>Disk read of trie state</td></tr>
<tr><td>SLOAD (warm)</td><td>100</td><td>Already accessed this transaction (EIP-2929)</td></tr>
<tr><td>SSTORE zero → non-zero</td><td>22,100</td><td>Grows the state trie permanently</td></tr>
<tr><td>SSTORE non-zero → non-zero</td><td>5,000</td><td>Modifies an existing leaf</td></tr>
<tr><td>SSTORE non-zero → zero</td><td>5,000, refunds 4,800</td><td>Shrinks state — the protocol pays you back</td></tr>
<tr><td>LOG1 with 32 bytes</td><td>~1,125</td><td>Events are cheap: not in state, only in receipts</td></tr>
<tr><td>CREATE</td><td>32,000 + 200/byte</td><td>New account plus code storage</td></tr>
<tr><td>keccak256 of 32 bytes</td><td>36</td><td>30 base + 6 per word</td></tr>
<tr><td>Base transaction</td><td>21,000</td><td>Signature recovery, nonce, intrinsic overhead</td></tr>
<tr><td>Calldata byte (non-zero)</td><td>16</td><td>Bandwidth — this dominates rollup costs</td></tr>
</tbody>
</table>
</div>
<p>Two conclusions follow immediately: <strong>storage dominates gas</strong>, and <strong>events are almost free</strong>. Emit generously; store reluctantly.</p>

<h3>EIP-1559 fee mechanics</h3>
<p>Before 1559, users blind-bid in a first-price auction and systematically overpaid. Now every block has a protocol-computed <strong>base fee</strong>:</p>
<ul>
  <li>Blocks target 15M gas but may hold 30M.</li>
  <li>If the previous block exceeded target, base fee rises by up to 12.5%; if below, it falls by up to 12.5%.</li>
  <li>The base fee is <strong>burned</strong>, not paid to the proposer. Since August 2021 this has removed millions of ETH from supply.</li>
</ul>
<p>Users set two values:</p>
<ul>
  <li><code>maxPriorityFeePerGas</code> — the tip that actually goes to the proposer.</li>
  <li><code>maxFeePerGas</code> — the total ceiling you will tolerate per gas.</li>
</ul>
<p><strong>You pay</strong> <code>gasUsed × (baseFee + min(priorityFee, maxFee − baseFee))</code>. Anything below your ceiling is refunded, so setting a generous <code>maxFeePerGas</code> is protection against a base-fee spike, not an overpayment.</p>

<h3>Blob transactions (EIP-4844)</h3>
<p>Rollups post data to L1. Doing that as calldata is expensive, so blobs added a separate market: up to 6 blobs of ~128 KB each per block, priced with their own independent base fee, and pruned by consensus clients after ~18 days. Because blob space is its own market, rollup costs decoupled from L1 execution demand and fell by an order of magnitude. Blob data is not accessible to the EVM — contracts see only a KZG commitment via <code>BLOBHASH</code>.</p>

<div class="note">
  <span class="tag">Estimating well</span>
  <p><code>eth_estimateGas</code> simulates against current state. If state changes before inclusion — a first-time storage write becoming a second write, or an allowance already set — the estimate can be wrong in either direction. Add ~20% headroom for gas limit (unused gas is refunded) but never inflate <code>maxFeePerGas</code> carelessly on chains without 1559 semantics.</p>
</div>

<h3>Gas is not the price of ETH</h3>
<p>Three numbers get confused constantly. <strong>Gas units</strong> measure work and are fixed by the opcode schedule. <strong>Gas price</strong> (gwei) is what the market charges per unit. <strong>ETH price</strong> converts to fiat. A "cheap transaction" means low gwei, not low gas usage — optimising a contract reduces gas <em>units</em>, which pays off at every price level.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'fees.js',
      caption: 'Exact EIP-1559 cost accounting, plus base fee prediction so you can size maxFeePerGas for several blocks ahead.',
      src: `function txCost({ gasUsed, baseFeeGwei, priorityGwei, maxFeeGwei }) {
  const base = BigInt(Math.round(baseFeeGwei * 1e9));
  const tip = BigInt(Math.round(priorityGwei * 1e9));
  const cap = BigInt(Math.round(maxFeeGwei * 1e9));

  if (cap < base) return { error: 'maxFeePerGas below base fee - will not be included' };

  const effectiveTip = tip < cap - base ? tip : cap - base;
  const perGas = base + effectiveTip;

  return {
    burned: BigInt(gasUsed) * base,            // destroyed forever
    toProposer: BigInt(gasUsed) * effectiveTip,
    totalWei: BigInt(gasUsed) * perGas,
    refundedWei: BigInt(gasUsed) * (cap - perGas)
  };
}

// Base fee moves at most 12.5% per block. Worst case over n blocks:
const worstCaseBaseFee = (current, n) => current * Math.pow(1.125, n);
worstCaseBaseFee(20, 10);   // 64.8 gwei - size maxFeePerGas against this,
                            // not against the current base fee`
    },
    {
      lang: 'solidity', file: 'GasPatterns.sol',
      caption: 'Four changes that cut real gas. The storage-caching one alone often saves more than every micro-optimisation combined.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GasPatterns {
    uint256 public total;
    mapping(address => uint256) public balanceOf;

    // BAD: reads and writes storage inside the loop
    function payoutSlow(address[] calldata users, uint256 amt) external {
        for (uint256 i = 0; i < users.length; i++) {
            balanceOf[users[i]] += amt;   // SLOAD + SSTORE per user
            total += amt;                 // another SLOAD + SSTORE per user
        }
    }

    // GOOD: accumulate in memory, write storage once
    function payoutFast(address[] calldata users, uint256 amt) external {
        uint256 len = users.length;       // calldata length cached
        uint256 sum;
        for (uint256 i; i < len;) {
            balanceOf[users[i]] += amt;   // unavoidable: distinct slots
            sum += amt;                   // memory arithmetic: 3 gas
            unchecked { ++i; }            // overflow impossible: i < len
        }
        total += sum;                     // ONE storage write instead of N
    }

    // Custom errors instead of require strings: ~50 gas cheaper to revert
    // and far cheaper in deployed bytecode size.
    error NotEnough(uint256 have, uint256 need);

    function withdraw(uint256 amt) external {
        uint256 bal = balanceOf[msg.sender];          // cache the SLOAD
        if (bal < amt) revert NotEnough(bal, amt);
        unchecked { balanceOf[msg.sender] = bal - amt; }
    }
}`
    }
  ],
  lab: 'gas',
  quiz: [
    {
      q: 'You set maxFeePerGas = 100 gwei, maxPriorityFeePerGas = 2 gwei. Base fee is 30 gwei. What do you pay per gas?',
      options: ['100 gwei', '32 gwei', '30 gwei', '2 gwei'],
      answer: 1,
      why: 'baseFee + priorityFee = 30 + 2 = 32 gwei. The remaining 68 gwei of your ceiling is refunded. A high ceiling is insurance against a base-fee spike, not an overpayment.'
    },
    {
      q: 'Where does the base fee go?',
      options: [
        'To the block proposer',
        'To the Ethereum Foundation',
        'It is burned — permanently removed from supply',
        'Split between proposer and stakers'
      ],
      answer: 2,
      why: 'Burning the base fee removes the incentive for proposers to fake congestion, and makes ETH supply deflationary during periods of heavy use. Only the priority fee (plus MEV) reaches the proposer.'
    },
    {
      q: 'Which change saves the most gas in a loop that updates a counter for 100 users?',
      options: [
        'Using uint8 instead of uint256 for the loop index',
        'Accumulating the total in a memory variable and writing storage once at the end',
        'Renaming variables to be shorter',
        'Marking the function external instead of public'
      ],
      answer: 1,
      why: '99 avoided SSTOREs at ~5,000 gas each is roughly 495,000 gas. Small integer types are usually *more* expensive because the EVM word is 256 bits and narrowing requires masking.'
    }
  ],
  tasks: [
    'Use the lab to price the same transaction at 5, 30 and 200 gwei base fee. Note how the burned portion scales.',
    'Take a contract you have written and count its SSTOREs on the hot path. Estimate the saving from caching them.',
    'Compare the calldata cost of 1 KB posted as calldata vs as a blob at current prices.',
    'Explain to a non-developer why "gas fees are high" is about demand for block space, not about the price of ETH.'
  ],
  resources: [
    { type: 'eip', title: 'EIP-1559 specification', url: 'https://eips.ethereum.org/EIPS/eip-1559' },
    { type: 'eip', title: 'EIP-4844 — shard blob transactions', url: 'https://eips.ethereum.org/EIPS/eip-4844' },
    { type: 'tool', title: 'evm.codes — every opcode with live gas costs', url: 'https://www.evm.codes/' }
  ]
});

L.push({
  id: 'l12', module: 3, num: 12,
  title: 'Solidity Fundamentals',
  level: 'Intermediate', minutes: 90,
  summary: 'Types, visibility, data location, the constructor, and the EVM execution model your code compiles down to.',
  objectives: [
    'Write and reason about a complete Solidity contract',
    'Choose correctly between storage, memory and calldata',
    'Use visibility and state mutability accurately',
    'Read simple EVM bytecode and understand the stack machine'
  ],
  body: `
<h3>Contract skeleton</h3>
<p>Every file starts with an SPDX identifier and a pragma. Pin the compiler version exactly for production: <code>pragma solidity 0.8.24;</code> beats a caret range, because a different compiler is different bytecode.</p>

<h3>Types you will actually use</h3>
<ul>
  <li><code>uint256</code> — the default. Smaller widths do not save gas unless several pack into one 32-byte slot.</li>
  <li><code>address</code> / <code>address payable</code> — 20 bytes. Only the payable variant has <code>.transfer</code> and <code>.send</code>, both of which you should avoid in favour of <code>.call</code>.</li>
  <li><code>bytes32</code> — fixed, cheap. <code>bytes</code> and <code>string</code> are dynamic and cost far more.</li>
  <li><code>mapping(K =&gt; V)</code> — the workhorse. Not iterable, has no length, and every key exists with a zero value by default.</li>
  <li><code>struct</code> and arrays — group related data; mind slot packing (Lesson 13).</li>
  <li><code>enum</code> — a uint8 under the hood, useful for state machines.</li>
</ul>

<div class="note">
  <span class="tag">0.8+ arithmetic</span>
  <p>Since 0.8.0, arithmetic reverts on overflow and underflow by default. SafeMath is obsolete. Use <code>unchecked { }</code> only where you have proved overflow is impossible — a loop counter bounded by array length is the canonical safe case.</p>
</div>

<h3>Data location: the number one beginner bug</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Location</th><th>Lifetime</th><th>Cost</th><th>Use for</th></tr></thead>
<tbody>
<tr><td><code>storage</code></td><td>Permanent, on chain</td><td>2,100-22,100 gas</td><td>State that must survive the call</td></tr>
<tr><td><code>memory</code></td><td>Duration of the call</td><td>3 gas + quadratic expansion</td><td>Working copies, return values</td></tr>
<tr><td><code>calldata</code></td><td>Duration of the call, read-only</td><td>Cheapest — no copy</td><td>External function parameters</td></tr>
<tr><td><code>stack</code></td><td>Per operation, 1024 slots</td><td>3 gas</td><td>Local value-type variables</td></tr>
</tbody>
</table>
</div>
<p>The trap: <code>Item storage it = items[id]</code> creates a <em>reference</em> — writing to it changes state. <code>Item memory it = items[id]</code> creates a <em>copy</em> — writing to it changes nothing, silently. This compiles without warning and is a recurring source of "my update did not persist" bugs.</p>

<h3>Visibility and mutability</h3>
<ul>
  <li><code>external</code> — callable only from outside. Prefer it for entry points; calldata parameters avoid a memory copy.</li>
  <li><code>public</code> — callable from anywhere; on a state variable it auto-generates a getter.</li>
  <li><code>internal</code> — this contract and its children. The default for helpers.</li>
  <li><code>private</code> — this contract only. <strong>Not secret</strong>: all storage is publicly readable on chain, whatever the keyword says.</li>
  <li><code>view</code> reads state, <code>pure</code> touches none. Both are free when called off chain, and both still cost gas when called inside a transaction.</li>
</ul>

<h3>The EVM underneath</h3>
<p>Solidity compiles to a stack machine with 256-bit words, 1024 stack slots, byte-addressed memory and key/value storage. A statement like <code>c = a + b</code> becomes roughly: push a, push b, ADD, store result. The lab lets you step through a small program opcode by opcode and watch the stack.</p>
<p>You do not need to write assembly, but reading opcodes explains gas, teaches why <code>DUP</code>/<code>SWAP</code> depth matters, and demystifies "stack too deep" errors — which mean exactly what they say: more than 16 reachable local variables. The fix is to group them into a struct or split the function.</p>

<h3>Calls between contracts</h3>
<ul>
  <li><code>callee.f()</code> — a normal <code>CALL</code>; runs in the callee's context and storage.</li>
  <li><code>address.call(data)</code> — low-level, returns <code>(bool success, bytes memory ret)</code>. Failure does <strong>not</strong> revert automatically; you must check.</li>
  <li><code>delegatecall</code> — runs the callee's <em>code</em> against the caller's <em>storage</em>. Proxies depend on it, and it is dangerous in exactly the same measure (Lesson 22).</li>
  <li><code>staticcall</code> — like call but reverts on state modification. This is what <code>view</code> calls compile to.</li>
</ul>
`,
  code: [
    {
      lang: 'solidity', file: 'Escrow.sol',
      caption: 'A complete, realistic contract using most fundamentals: state machine, access control, custom errors, events, and a safe ETH transfer.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Escrow with a deadline and an arbiter
contract Escrow {
    enum State { Funded, Released, Refunded, Disputed }

    address public immutable buyer;     // immutable: set once in constructor,
    address public immutable seller;    // stored in bytecode, cheap to read
    address public immutable arbiter;
    uint256 public immutable deadline;

    State public state;

    event Funded(uint256 amount);
    event Released(address indexed to, uint256 amount);
    event Disputed(address indexed by);

    error NotAuthorized(address caller);
    error WrongState(State current, State required);
    error TooEarly(uint256 nowTs, uint256 deadlineTs);
    error TransferFailed();

    modifier only(address who) {
        if (msg.sender != who) revert NotAuthorized(msg.sender);
        _;
    }

    modifier inState(State required) {
        if (state != required) revert WrongState(state, required);
        _;
    }

    constructor(address _seller, address _arbiter, uint256 _lockSeconds)
        payable
    {
        require(msg.value > 0, "fund on deploy");
        buyer    = msg.sender;
        seller   = _seller;
        arbiter  = _arbiter;
        deadline = block.timestamp + _lockSeconds;
        state    = State.Funded;
        emit Funded(msg.value);
    }

    /// Buyer is happy: release to seller.
    function release() external only(buyer) inState(State.Funded) {
        state = State.Released;                 // effects BEFORE interaction
        _send(payable(seller), address(this).balance);
        emit Released(seller, address(this).balance);
    }

    /// Deadline passed with no release: buyer reclaims.
    function refund() external only(buyer) inState(State.Funded) {
        if (block.timestamp < deadline) revert TooEarly(block.timestamp, deadline);
        state = State.Refunded;
        _send(payable(buyer), address(this).balance);
    }

    function dispute() external inState(State.Funded) {
        if (msg.sender != buyer && msg.sender != seller) revert NotAuthorized(msg.sender);
        state = State.Disputed;
        emit Disputed(msg.sender);
    }

    function resolve(address payable winner) external only(arbiter) inState(State.Disputed) {
        state = State.Released;
        _send(winner, address(this).balance);
    }

    /// call{value:} forwards all gas and works with smart-contract wallets.
    /// transfer()/send() cap gas at 2300 and break on any recipient that
    /// does meaningful work in receive().
    function _send(address payable to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}`
    },
    {
      lang: 'solidity', file: 'DataLocation.sol',
      caption: 'The storage-vs-memory trap, shown side by side. Both functions compile cleanly; only one of them works.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract DataLocation {
    struct Item { uint128 price; uint64 qty; bool active; }
    mapping(uint256 => Item) public items;

    // BROKEN: 'memory' takes a copy. The write is discarded at end of call.
    function bumpBroken(uint256 id) external {
        Item memory it = items[id];
        it.qty += 1;                 // modifies the copy, not state
    }

    // CORRECT: 'storage' is a pointer into state.
    function bumpCorrect(uint256 id) external {
        Item storage it = items[id];
        it.qty += 1;                 // SSTORE - persists
    }

    // Reading only? Use memory (or calldata for parameters) to avoid
    // repeated SLOADs of the same slot.
    function total(uint256[] calldata ids) external view returns (uint256 sum) {
        for (uint256 i; i < ids.length;) {
            Item memory it = items[ids[i]];      // one SLOAD, then free reads
            if (it.active) sum += uint256(it.price) * it.qty;
            unchecked { ++i; }
        }
    }
}`
    }
  ],
  lab: 'evm',
  quiz: [
    {
      q: 'Item memory it = items[id]; it.qty += 1;  What happens to state?',
      options: [
        'qty increases by 1',
        'Nothing — memory is a copy, and the write is discarded when the call ends',
        'Compiler error',
        'The whole struct is deleted'
      ],
      answer: 1,
      why: 'This compiles without warning and is the single most common Solidity beginner bug. Use "Item storage" when you intend to mutate; use memory only for read-only working copies.'
    },
    {
      q: 'A variable is marked private. Can anyone read its value?',
      options: [
        'No, private means encrypted',
        'Only the contract owner',
        'Yes — all storage is public on chain; private only restricts Solidity-level access',
        'Only after the contract self-destructs'
      ],
      answer: 2,
      why: 'eth_getStorageAt reads any slot of any contract. Visibility is a compile-time language feature, not a confidentiality mechanism. Never store secrets on chain.'
    },
    {
      q: 'Why prefer address.call{value: x}("") over transfer(x)?',
      options: [
        'call is cheaper',
        'transfer forwards only 2300 gas, which breaks recipients that are smart-contract wallets or do work in receive()',
        'transfer is deprecated syntax',
        'call is safer against reentrancy'
      ],
      answer: 1,
      why: 'The 2300 gas stipend was a reentrancy guard that broke as opcode costs changed. call forwards all gas — so you must apply checks-effects-interactions or a reentrancy guard yourself (Lesson 20).'
    }
  ],
  tasks: [
    'Step through the lab bytecode for a simple addition and write down the stack contents after each opcode.',
    'Rewrite the Escrow contract to support partial releases. Decide which state must persist and which can stay in memory.',
    'Trigger a "stack too deep" error deliberately, then fix it by grouping locals into a struct.',
    'Read one deployed contract on Etherscan and identify every external function and its state mutability.'
  ],
  resources: [
    { type: 'docs', title: 'Solidity documentation', url: 'https://docs.soliditylang.org/' },
    { type: 'tool', title: 'evm.codes — interactive opcode reference and playground', url: 'https://www.evm.codes/playground' },
    { type: 'practice', title: 'Ethernaut — security-focused Solidity puzzles', url: 'https://ethernaut.openzeppelin.com/' }
  ]
});

L.push({
  id: 'l13', module: 3, num: 13,
  title: 'Storage Layout, Events and Errors',
  level: 'Intermediate', minutes: 70,
  summary: 'Where variables physically live, how mappings compute their slots, and how events give you an off-chain query layer for almost no gas.',
  objectives: [
    'Compute the storage slot of any variable, including mapping entries',
    'Pack structs to cut storage costs by half or more',
    'Design event schemas with the right indexed topics',
    'Use custom errors and understand revert data'
  ],
  body: `
<h3>Slots</h3>
<p>Contract storage is 2<sup>256</sup> slots of 32 bytes each, all initially zero. The compiler assigns state variables slots in declaration order, packing consecutive variables that fit together into one slot.</p>
<ul>
  <li>Value types pack: <code>uint128 a; uint128 b;</code> share slot 0.</li>
  <li>Any variable that does not fit in the remaining space starts a new slot.</li>
  <li>Structs and arrays always start their own slot.</li>
  <li><code>constant</code> and <code>immutable</code> occupy <em>no</em> storage — they are inlined into bytecode.</li>
</ul>
<p>Declaration order therefore has direct financial consequences. The lab computes the layout for a struct you type in and shows the saving.</p>

<h3>Mapping and array slot formulas</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Declaration at slot p</th><th>Location of element</th></tr></thead>
<tbody>
<tr><td><code>mapping(K =&gt; V) m</code></td><td><code>keccak256(pad(key) ‖ pad(p))</code></td></tr>
<tr><td><code>mapping(K1 =&gt; mapping(K2 =&gt; V)) m</code></td><td><code>keccak256(pad(k2) ‖ keccak256(pad(k1) ‖ pad(p)))</code></td></tr>
<tr><td><code>T[] arr</code></td><td>length at <code>p</code>; element <em>i</em> at <code>keccak256(p) + i</code></td></tr>
<tr><td><code>T[N] fixedArr</code></td><td>element <em>i</em> at <code>p + i</code> (packed if T is small)</td></tr>
</tbody>
</table>
</div>
<p>This is why mappings cannot be enumerated: entries are scattered by hash across the whole slot space with nothing linking them. If you need iteration, maintain an explicit array of keys alongside the mapping — and remember it costs gas on every insert.</p>

<h3>Packing in practice</h3>
<p>An unpacked struct of three <code>uint256</code> fields costs three SSTOREs — about 66,000 gas on first write. The same data as <code>uint128 + uint64 + uint64</code> fits one slot: one SSTORE, about 22,000 gas. Roughly a two-thirds saving, purely from declaration order.</p>
<p>Caveat: reading a packed field costs extra masking (a few gas), and writing one field of a packed slot requires a read-modify-write. Packing wins when fields are written together, and can lose when a single hot field lives beside cold ones.</p>

<h3>Events: your query layer</h3>
<p>Events write to the transaction log, not to state. They are unreadable from Solidity but cheap (~375 gas plus 375 per indexed topic plus 8 per data byte) and permanently available to off-chain consumers.</p>
<ul>
  <li>Up to <strong>3</strong> indexed parameters (plus the event signature, which occupies topic 0). Indexed parameters are filterable.</li>
  <li>Indexing a dynamic type stores <code>keccak256(value)</code>, so you can filter by it but not recover it. Emit the raw value in the data section too if you need it.</li>
  <li>Every meaningful state change should emit. Subgraphs, dashboards, accounting and incident forensics all depend on it — a protocol with poor events is very hard to debug after the fact.</li>
</ul>

<h3>Custom errors</h3>
<p>Since 0.8.4, <code>error InsufficientBalance(uint256 available, uint256 required);</code> replaces revert strings. Revert data becomes a 4-byte selector plus ABI-encoded arguments instead of a full string — cheaper to revert, meaningfully smaller bytecode, and structured enough for a frontend to decode and render.</p>

<div class="note warn">
  <span class="tag">Errors do not propagate for free</span>
  <p>A low-level <code>call</code> returns failure as a boolean with the revert data in a bytes array. If you swallow it you lose the reason. To bubble it up, re-revert the returned bytes with inline assembly, or use OpenZeppelin's <code>Address.functionCall</code> which does it for you.</p>
</div>
`,
  code: [
    {
      lang: 'solidity', file: 'Layout.sol',
      caption: 'The same data declared two ways. The packed version costs one storage write instead of three.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract Layout {
    // ---- slot assignment, in declaration order ----
    uint256 public a;            // slot 0  (full slot)
    uint128 public b;            // slot 1, bytes 0-15
    uint64  public c;            // slot 1, bytes 16-23   <- packed
    uint64  public d;            // slot 1, bytes 24-31   <- packed
    address public owner;        // slot 2, bytes 0-19
    bool    public paused;       // slot 2, byte 20       <- packed
    mapping(address => uint256) public balances;   // slot 3 (reserved)
    uint256[] public items;                        // slot 4 (length)

    uint256 public constant RATE = 500;   // no slot: inlined into bytecode
    address public immutable factory;     // no slot: baked into bytecode

    constructor() { factory = msg.sender; }

    // balances[key] lives at keccak256(abi.encode(key, uint256(3)))
    function slotOfBalance(address key) external pure returns (bytes32) {
        return keccak256(abi.encode(key, uint256(3)));
    }

    // items[i] lives at keccak256(abi.encode(uint256(4))) + i
    function slotOfItem(uint256 i) external pure returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encode(uint256(4)))) + i);
    }
}

// ---- packing comparison ----
contract Unpacked {                 // 3 slots, ~66,000 gas to initialise
    struct Order { uint256 price; uint256 qty; uint256 expiry; }
    mapping(uint256 => Order) public orders;
}

contract Packed {                   // 1 slot, ~22,100 gas to initialise
    struct Order { uint128 price; uint64 qty; uint64 expiry; }
    mapping(uint256 => Order) public orders;
}`
    },
    {
      lang: 'solidity', file: 'Events.sol',
      caption: 'Event design: index what you filter by, emit what you display. The third example shows a common indexing mistake.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract Marketplace {
    // GOOD: filter by seller, by buyer, by listing. Amounts in the data section.
    event Sold(
        address indexed seller,
        address indexed buyer,
        uint256 indexed listingId,
        uint256 price,
        uint256 fee
    );

    // BAD: nothing indexed -> consumers must scan every log and decode it
    event SoldUnindexed(address seller, address buyer, uint256 price);

    // TRAP: an indexed string is stored as keccak256(value). You can filter
    // for a known string, but you can never read it back from the log.
    event Named(string indexed name, string nameReadable);

    error PriceTooLow(uint256 offered, uint256 minimum);
    error ListingClosed(uint256 listingId);

    mapping(uint256 => uint256) public priceOf;
    mapping(uint256 => bool) public closed;

    function buy(uint256 listingId) external payable {
        if (closed[listingId]) revert ListingClosed(listingId);

        uint256 price = priceOf[listingId];
        if (msg.value < price) revert PriceTooLow(msg.value, price);

        closed[listingId] = true;
        uint256 fee = price / 100;                 // 1%
        emit Sold(_sellerOf(listingId), msg.sender, listingId, price, fee);
    }

    function _sellerOf(uint256) internal pure returns (address) {
        return address(0);
    }
}`
    }
  ],
  lab: 'storage',
  quiz: [
    {
      q: 'A mapping is declared at slot 5. Where does balances[0xAB..] live?',
      options: [
        'Slot 5',
        'Slot 5 + the address value',
        'keccak256(abi.encode(key, uint256(5)))',
        'It is not stored in slots'
      ],
      answer: 2,
      why: 'The mapping slot itself holds nothing; it acts as a namespace. Each entry is hashed into a pseudo-random slot, which is exactly why mappings cannot be enumerated on chain.'
    },
    {
      q: 'You reorder struct fields from (uint256, uint64, uint64) to (uint64, uint256, uint64). What happens?',
      options: [
        'Same cost',
        'Cost increases: the uint256 forces a new slot, so the two uint64 fields can no longer share one',
        'Compiler rejects it',
        'Cost halves'
      ],
      answer: 1,
      why: 'Packing only merges *consecutive* variables that fit in the remaining bytes of the current slot. A full-width field in the middle splits the small ones apart — 3 slots instead of 2.'
    },
    {
      q: 'How many indexed parameters can a non-anonymous event have?',
      options: ['1', '3', '4', 'Unlimited'],
      answer: 1,
      why: 'A log has 4 topic slots. Topic 0 is the event signature hash, leaving 3 for indexed parameters. Anonymous events give up the signature topic to gain a fourth indexed field, at the cost of easy identification.'
    }
  ],
  tasks: [
    'In the lab, paste a struct from a real contract and check whether reordering fields saves a slot.',
    'Use cast storage (Foundry) or eth_getStorageAt to read slot 0 of a live token contract and interpret the bytes.',
    'Design the event schema for a lending protocol: deposits, borrows, repayments, liquidations. Justify each indexed field.',
    'Replace every require string in one of your contracts with custom errors and measure the bytecode size difference.'
  ],
  resources: [
    { type: 'docs', title: 'Solidity storage layout specification', url: 'https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html' },
    { type: 'docs', title: 'Contract ABI specification — events and errors', url: 'https://docs.soliditylang.org/en/latest/abi-spec.html' },
    { type: 'tool', title: 'Foundry cast storage', url: 'https://book.getfoundry.sh/reference/cast/cast-storage' }
  ]
});

L.push({
  id: 'l14', module: 3, num: 14,
  title: 'ERC-20: Fungible Tokens',
  level: 'Intermediate', minutes: 75,
  summary: 'The interface behind almost every token. Build one, understand approvals and their attack surface, and learn why non-standard tokens break integrations.',
  objectives: [
    'Implement ERC-20 from the specification',
    'Explain the approve/transferFrom pattern and the race it creates',
    'Handle non-standard tokens safely with SafeERC20',
    'Use EIP-2612 permit for gasless approvals'
  ],
  body: `
<h3>The interface</h3>
<p>ERC-20 is six functions and two events. Everything else — DEXes, lending markets, wallets, bridges — assumes exactly this shape.</p>
<ul>
  <li><code>totalSupply()</code>, <code>balanceOf(address)</code></li>
  <li><code>transfer(to, amount)</code> — move your own tokens.</li>
  <li><code>approve(spender, amount)</code> — authorise someone to move yours.</li>
  <li><code>allowance(owner, spender)</code>, <code>transferFrom(from, to, amount)</code></li>
  <li><code>event Transfer(address indexed from, address indexed to, uint256 value)</code></li>
  <li><code>event Approval(address indexed owner, address indexed spender, uint256 value)</code></li>
</ul>
<p><code>name</code>, <code>symbol</code> and <code>decimals</code> are optional extensions — which is why robust integrations must tolerate their absence.</p>

<div class="note">
  <span class="tag">Decimals are cosmetic</span>
  <p>The contract stores integers only. <code>decimals = 18</code> means UIs should display <code>value / 10^18</code>. USDC uses 6, WBTC uses 8. Hardcoding 18 is a classic accounting bug that produces errors of a trillion times.</p>
</div>

<h3>Why approve exists</h3>
<p>A contract cannot pull tokens from you unilaterally. To let a DEX swap your USDC, you first <code>approve</code> the router, then call <code>swap</code>, which internally calls <code>transferFrom</code>. Two transactions, two gas payments, and a standing permission that most users never revoke.</p>

<div class="note danger">
  <span class="tag">The approval race (and the infinite-approval habit)</span>
  <p>Changing an allowance from 100 to 50 is two states with a window between them. A spender watching the mempool can front-run your change, spend the old 100, then spend the new 50 — 150 total. Mitigations: set to 0 first, use <code>increaseAllowance</code>/<code>decreaseAllowance</code>, or use permit. Separately, dApps commonly request <code>type(uint256).max</code> approvals for UX; if that contract is later compromised, every approver's balance is drainable. Audit and revoke your approvals.</p>
</div>

<h3>Non-standard tokens that break code</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Deviation</th><th>Example</th><th>What breaks</th></tr></thead>
<tbody>
<tr><td>No return value on transfer</td><td>USDT, BNB</td><td>Solidity reverts on the missing return — use SafeERC20</td></tr>
<tr><td>Returns false instead of reverting</td><td>Some older tokens</td><td>Ignoring the return value silently loses funds</td></tr>
<tr><td>Fee on transfer</td><td>Deflationary tokens</td><td>Received amount ≠ sent amount; always measure balance before and after</td></tr>
<tr><td>Rebasing balances</td><td>stETH, AMPL</td><td>Cached balances go stale; never store a balance you can query</td></tr>
<tr><td>Blocklists</td><td>USDC, USDT</td><td>A transfer can revert for reasons unrelated to your logic</td></tr>
<tr><td>Approval race guard</td><td>USDT</td><td>Reverts if you change a non-zero allowance to another non-zero value</td></tr>
</tbody>
</table>
</div>
<p>The practical rule: use OpenZeppelin's <code>SafeERC20</code> for every external token, and for accounting use balance deltas rather than the amount you asked for.</p>

<h3>EIP-2612 permit</h3>
<p>Permit lets the token owner sign an off-chain EIP-712 message authorising an allowance. The spender submits that signature on chain, so approval and action fit in a single transaction — and a user with zero ETH can still authorise (a relayer pays). DAI shipped a variant before the standard settled, so its signature differs; libraries handle both.</p>

<h3>Mint, burn and supply</h3>
<p>Nothing in ERC-20 restricts minting. Whether supply is fixed, capped, owner-mintable or algorithmic is a design choice enforced by your access control. When evaluating a token, read <code>mint</code> and its modifiers first — an unrestricted mint is the difference between an asset and a rug.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'Token.sol',
      caption: 'A complete ERC-20 from scratch. Read it once so the OpenZeppelin version holds no mystery, then use OpenZeppelin in production.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Token is IERC20 {
    string public constant name = "Roadmap Token";
    string public constant symbol = "RMT";
    uint8  public constant decimals = 18;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public immutable minter;

    error InsufficientBalance(uint256 have, uint256 need);
    error InsufficientAllowance(uint256 have, uint256 need);
    error ZeroAddress();
    error NotMinter();

    constructor(uint256 initialSupply) {
        minter = msg.sender;
        _mint(msg.sender, initialSupply);
    }

    function totalSupply() external view returns (uint256) { return _totalSupply; }
    function balanceOf(address a) external view returns (uint256) { return _balances[a]; }
    function allowance(address o, address s) external view returns (uint256) {
        return _allowances[o][s];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external returns (bool)
    {
        uint256 allowed = _allowances[from][msg.sender];
        if (allowed != type(uint256).max) {          // infinite approval: skip the write
            if (allowed < amount) revert InsufficientAllowance(allowed, amount);
            unchecked { _allowances[from][msg.sender] = allowed - amount; }
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = _balances[from];
        if (bal < amount) revert InsufficientBalance(bal, amount);
        unchecked {
            _balances[from] = bal - amount;
            _balances[to] += amount;               // cannot overflow: bounded by supply
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        _totalSupply += amount;
        unchecked { _balances[to] += amount; }
        emit Transfer(address(0), to, amount);      // mint = transfer from zero
    }

    function burn(uint256 amount) external {
        uint256 bal = _balances[msg.sender];
        if (bal < amount) revert InsufficientBalance(bal, amount);
        unchecked {
            _balances[msg.sender] = bal - amount;
            _totalSupply -= amount;
        }
        emit Transfer(msg.sender, address(0), amount);
    }
}`
    },
    {
      lang: 'solidity', file: 'SafeIntegration.sol',
      caption: 'Integrating third-party tokens. The balance-delta pattern is mandatory if a fee-on-transfer token might ever be used.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public deposits;

    // WRONG for fee-on-transfer tokens: credits more than actually arrived
    function depositNaive(IERC20 token, uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][address(token)] += amount;   // may overstate
    }

    // RIGHT: measure what actually landed
    function deposit(IERC20 token, uint256 amount) external {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        deposits[msg.sender][address(token)] += received;
    }

    // Gasless approval: user signs off chain, we submit the signature
    function depositWithPermit(
        IERC20Permit token, uint256 amount,
        uint256 deadline, uint8 v, bytes32 r, bytes32 s
    ) external {
        token.permit(msg.sender, address(this), amount, deadline, v, r, s);
        IERC20(address(token)).safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][address(token)] += amount;
    }
}

interface IERC20Permit {
    function permit(address owner, address spender, uint256 value,
                    uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
}`
    }
  ],
  lab: 'erc20',
  quiz: [
    {
      q: 'Why does transferFrom exist when transfer already moves tokens?',
      options: [
        'It is cheaper',
        'It lets an approved third party (like a DEX router) move tokens on the owner\\u2019s behalf',
        'It supports multiple recipients',
        'It is the legacy version'
      ],
      answer: 1,
      why: 'Contracts cannot sign transactions. The owner grants an allowance with approve, then the contract pulls funds with transferFrom during its own execution. It is the only way for a contract to receive ERC-20 tokens as part of an operation.'
    },
    {
      q: 'You call transfer on USDT and the transaction reverts even though the balance is sufficient. Why?',
      options: [
        'USDT is paused',
        'USDT\\u2019s transfer returns no value, so a strict IERC20 interface call reverts on decoding — use SafeERC20',
        'USDT requires 6 decimals in the amount',
        'USDT only supports transferFrom'
      ],
      answer: 1,
      why: 'USDT predates the finalised standard and omits the boolean return. SafeERC20 handles both shapes by inspecting the returndata size — which is why every production integration uses it.'
    },
    {
      q: 'What is the danger of an infinite (type(uint256).max) approval?',
      options: [
        'It costs more gas',
        'If the approved contract is ever compromised or malicious, it can drain the entire balance at any future time',
        'It expires after a year',
        'It cannot be revoked'
      ],
      answer: 1,
      why: 'The approval outlives the interaction. Every user of a later-compromised router is drainable. Exact-amount approvals or permit with a deadline bound the damage; periodic revocation is good hygiene.'
    }
  ],
  tasks: [
    'In the lab, run the approval race: approve 100, then reduce to 50 while a spender front-runs. Confirm the spender extracts 150.',
    'Implement the contract above with OpenZeppelin instead and compare bytecode size and gas for a transfer.',
    'Write a test that proves your vault credits the correct amount for a fee-on-transfer token.',
    'Check your own wallet\'s outstanding approvals on a revocation tool and revoke anything you no longer use.'
  ],
  resources: [
    { type: 'eip', title: 'EIP-20 — Token Standard', url: 'https://eips.ethereum.org/EIPS/eip-20' },
    { type: 'eip', title: 'EIP-2612 — permit', url: 'https://eips.ethereum.org/EIPS/eip-2612' },
    { type: 'code', title: 'Weird ERC-20 tokens — a catalogue of real deviations', url: 'https://github.com/d-xo/weird-erc20' }
  ]
});

L.push({
  id: 'l15', module: 3, num: 15,
  title: 'ERC-721 and ERC-1155: Non-Fungible Tokens',
  level: 'Intermediate', minutes: 70,
  summary: 'Unique tokens, safe transfers, metadata, royalties — and an honest look at what an NFT does and does not guarantee.',
  objectives: [
    'Implement ERC-721 including safe transfer callbacks',
    'Design metadata and choose a storage strategy',
    'Explain when ERC-1155 is the better fit',
    'Build a mint with an allowlist, supply cap and reentrancy-safe payouts'
  ],
  body: `
<h3>What changes from ERC-20</h3>
<p>Balances become ownership of discrete <code>tokenId</code>s. Instead of <code>balanceOf → uint256</code> as the source of truth, the core mapping is <code>ownerOf(tokenId) → address</code>. Approvals exist per token (<code>approve</code>) and per collection (<code>setApprovalForAll</code>).</p>

<h3>Safe transfers and the receiver hook</h3>
<p><code>transferFrom</code> to a contract that cannot handle NFTs locks the token forever. <code>safeTransferFrom</code> therefore calls <code>onERC721Received</code> on contract recipients and reverts unless it returns the magic selector.</p>
<div class="note warn">
  <span class="tag">The hook is an external call</span>
  <p>That callback hands control to the recipient <em>before</em> your function finishes. Every "mint one per wallet" bypass in NFT history is the same bug: the receiver re-enters <code>mint</code> during the callback. Apply checks-effects-interactions and a reentrancy guard, and increment supply before minting.</p>
</div>

<h3>Metadata</h3>
<p><code>tokenURI(tokenId)</code> returns a URI pointing to JSON: <code>name</code>, <code>description</code>, <code>image</code>, <code>attributes</code>. Storage options, from weakest to strongest guarantee:</p>
<div class="table-scroll">
<table>
<thead><tr><th>Strategy</th><th>Guarantee</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>Centralised HTTPS URL</td><td>None — the server can change or vanish</td><td>Free</td></tr>
<tr><td>IPFS CID</td><td>Content-addressed: the hash proves the bytes, if someone still pins them</td><td>Pinning fees</td></tr>
<tr><td>Arweave</td><td>Paid-once permanent storage</td><td>One-off fee</td></tr>
<tr><td>Fully on chain (SVG/base64)</td><td>Strongest: lives as long as the chain</td><td>Very high gas</td></tr>
</tbody>
</table>
</div>
<p>Be clear-eyed: for most collections the token is a pointer, and the pointer's target is off chain. "Owning an NFT" means the chain records your address against a tokenId — it does not by itself convey copyright, and it does not guarantee the image persists.</p>

<h3>ERC-1155: multi-token</h3>
<p>One contract holds many token types, each fungible or not: <code>balanceOf(account, id)</code>. Advantages are batch transfers (<code>safeBatchTransferFrom</code>) which cut gas dramatically for games and editions, and a single deployment for an entire catalogue. Choose ERC-721 when each item is genuinely unique and marketplace support matters most; choose ERC-1155 for editions, in-game items or anything with quantities.</p>

<h3>Royalties (EIP-2981)</h3>
<p><code>royaltyInfo(tokenId, salePrice)</code> returns a recipient and an amount. It is a <em>signal</em>: nothing on chain enforces payment unless the marketplace chooses to honour it. After 2022 most marketplaces made royalties optional, and attempts to enforce them via transfer blocklists proved brittle and unpopular. Design your economics so they survive royalties going to zero.</p>

<h3>Minting mechanics that matter</h3>
<ul>
  <li><strong>Supply cap</strong> — check before minting, and increment before any external call.</li>
  <li><strong>Allowlist</strong> — a Merkle root (Lesson 4) beats storing thousands of addresses.</li>
  <li><strong>Randomness</strong> — <code>block.timestamp</code> and <code>blockhash</code> are manipulable by proposers. Use a VRF, or reveal metadata after mint with a committed random offset.</li>
  <li><strong>Payments</strong> — pull over push. Accumulate proceeds and let recipients withdraw, rather than transferring inside mint.</li>
</ul>
`,
  code: [
    {
      lang: 'solidity', file: 'Collection.sol',
      caption: 'A production-shaped mint: Merkle allowlist, supply cap, per-wallet limit, reentrancy-safe ordering and pull payments.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract Collection is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 5000;
    uint256 public constant MAX_PER_WALLET = 3;
    uint256 public constant PRICE = 0.05 ether;

    uint256 public totalMinted;
    bytes32 public allowlistRoot;
    string  private baseURI;
    bool    public publicOpen;

    mapping(address => uint256) public mintedBy;
    uint256 public proceeds;                 // pull payments, not push

    error SoldOut();
    error WrongPayment(uint256 sent, uint256 required);
    error WalletLimit();
    error NotAllowlisted();
    error Closed();

    constructor(bytes32 root, string memory uri)
        ERC721("Roadmap Collection", "RMC") Ownable(msg.sender)
    {
        allowlistRoot = root;
        baseURI = uri;
    }

    function allowlistMint(uint256 qty, bytes32[] calldata proof)
        external payable nonReentrant
    {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verifyCalldata(proof, allowlistRoot, leaf)) revert NotAllowlisted();
        _mintChecked(qty);
    }

    function publicMint(uint256 qty) external payable nonReentrant {
        if (!publicOpen) revert Closed();
        _mintChecked(qty);
    }

    function _mintChecked(uint256 qty) private {
        // ---- CHECKS ----
        if (totalMinted + qty > MAX_SUPPLY) revert SoldOut();
        if (mintedBy[msg.sender] + qty > MAX_PER_WALLET) revert WalletLimit();
        if (msg.value != PRICE * qty) revert WrongPayment(msg.value, PRICE * qty);

        // ---- EFFECTS (before any external call, including the 721 receiver hook) ----
        mintedBy[msg.sender] += qty;
        uint256 startId = totalMinted;
        totalMinted += qty;
        proceeds += msg.value;

        // ---- INTERACTIONS ----
        for (uint256 i; i < qty;) {
            _safeMint(msg.sender, startId + i);   // may call back into the recipient
            unchecked { ++i; }
        }
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = proceeds;
        proceeds = 0;
        (bool ok, ) = owner().call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return string.concat(baseURI, id.toString(), ".json");
    }

    function setPublicOpen(bool v) external onlyOwner { publicOpen = v; }
}`
    },
    {
      lang: 'json', file: 'metadata.json',
      caption: 'The metadata shape every marketplace expects. attributes drives trait filtering and rarity ranking.',
      src: `{
  "name": "Roadmap #1337",
  "description": "A generative piece from the Roadmap Collection.",
  "image": "ipfs://bafybeigdyrzt5.../1337.png",
  "external_url": "https://example.com/token/1337",
  "attributes": [
    { "trait_type": "Background", "value": "Nebula" },
    { "trait_type": "Eyes",       "value": "Laser" },
    { "trait_type": "Rarity",     "value": "Legendary" },
    { "display_type": "number",       "trait_type": "Generation", "value": 2 },
    { "display_type": "boost_percent","trait_type": "Speed",      "value": 40 }
  ]
}`
    }
  ],
  lab: 'nft',
  quiz: [
    {
      q: 'Why does safeTransferFrom call onERC721Received on contract recipients?',
      options: [
        'To log the transfer',
        'To confirm the recipient contract can handle NFTs, preventing tokens from being locked forever',
        'To charge a fee',
        'To verify the sender\\u2019s signature'
      ],
      answer: 1,
      why: 'A contract with no NFT handling that receives a token via plain transferFrom can never move it again. The callback must return the magic selector or the transfer reverts — at the cost of handing execution to the recipient mid-call.'
    },
    {
      q: 'A mint function calls _safeMint before incrementing totalMinted. What is the risk?',
      options: [
        'Higher gas',
        'The receiver hook can re-enter mint while the supply counter is still stale, blowing past the cap',
        'Token IDs collide',
        'No risk'
      ],
      answer: 1,
      why: 'This is the textbook NFT reentrancy. _safeMint hands control to the recipient contract, which calls mint again before the counter updated. Effects before interactions, plus nonReentrant.'
    },
    {
      q: 'What does owning an NFT guarantee about the artwork?',
      options: [
        'You hold the copyright',
        'The image is stored on chain',
        'The chain records your address as owner of a tokenId whose metadata points somewhere — persistence and rights depend entirely on that pointer and the licence',
        'The image can never change'
      ],
      answer: 2,
      why: 'On-chain ownership is of the token record. If tokenURI points at a mutable HTTPS server, the image can change or disappear. IPFS gives content addressing; only fully on-chain art gives chain-level persistence. Copyright transfers only if a licence says so.'
    }
  ],
  tasks: [
    'Use the lab to mint with an allowlist proof, then attempt to exceed the per-wallet limit and observe the revert.',
    'Deploy an ERC-1155 for a game with 3 consumable items and compare batch transfer gas against 3 separate ERC-721 transfers.',
    'Take one live collection and trace tokenURI to its final bytes. Report whether the art would survive the team disappearing.',
    'Add EIP-2981 royalty support to the Collection contract and explain why it is advisory only.'
  ],
  resources: [
    { type: 'eip', title: 'EIP-721 — Non-Fungible Token Standard', url: 'https://eips.ethereum.org/EIPS/eip-721' },
    { type: 'eip', title: 'EIP-1155 — Multi Token Standard', url: 'https://eips.ethereum.org/EIPS/eip-1155' },
    { type: 'code', title: 'ERC721A — gas-optimised batch minting', url: 'https://github.com/chiru-labs/ERC721A' }
  ]
});

})(window.ROADMAP.lessons);
