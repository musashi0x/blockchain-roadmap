/* Module 13 — Ecosystem & Architecture Choices (lessons 57-62) */
(function (L) {

L.push({
  id: 'chain-choice', module: 13, num: 57,
  title: 'Choosing a Chain: Execution Models, Fees and Finality',
  level: 'Intermediate', minutes: 70,
  summary: 'Compare the execution models behind Ethereum, Solana, Sui, Cosmos app-chains and parachains, and pick one from requirements instead of marketing numbers.',
  objectives: [
    'Describe what a chain’s execution model does to your data layout and concurrency',
    'Read a finality claim precisely enough to know what you are trusting',
    'Separate throughput marketing from the properties your product actually needs',
    'Estimate the cost of being wrong — how much of your work is portable later'
  ],
  body: `
<h3>Four questions, in this order</h3>
<p>Chain selection is usually argued as a benchmark contest. Benchmarks are the least useful input. Four questions decide it, and only the last one is about speed:</p>
<ol>
<li><strong>Where does your value settle?</strong> If your product needs deep liquidity for an existing asset, you go where that asset already is. Liquidity does not follow a better VM.</li>
<li><strong>Who is allowed to break you?</strong> Sequencer operators, validator cartels, upgrade multisigs and bridge signers are all in the answer.</li>
<li><strong>What does your state actually look like?</strong> A global order book, a per-user inventory and a single shared counter want different execution models.</li>
<li><strong>How fast, and fast at what?</strong> Confirmation latency, finality, and throughput are three different numbers, and vendors quote whichever is prettiest.</li>
</ol>

<h3>Execution models decide your data layout</h3>
<p>Every chain in this course so far has used a different unit of state, and that unit is the thing you design around.</p>
<div class="table-scroll">
<table>
<thead><tr><th>Model</th><th>Unit of state</th><th>Concurrency</th><th>What that forces on you</th></tr></thead>
<tbody>
<tr><td>Bitcoin (UTXO)</td><td>Unspent output</td><td>Natural — disjoint inputs never conflict</td><td>No shared mutable state at all; logic is a spending condition (lesson 6)</td></tr>
<tr><td>Ethereum (accounts + EVM)</td><td>Contract storage slot</td><td>Serial execution of the block</td><td>Everything is a shared mutable map; hotspots contend by construction (lesson 13)</td></tr>
<tr><td>Solana (SVM)</td><td>Account, declared up front</td><td>Parallel when write sets are disjoint</td><td>Transactions must name every account they touch; shared write accounts serialise</td></tr>
<tr><td>Sui (objects, Move)</td><td>Object with an owner</td><td>Owned objects skip consensus entirely</td><td>Model assets as objects, not rows in a table (lesson 27)</td></tr>
<tr><td>Cosmos app-chain</td><td>Module keeper store</td><td>You own the whole block space</td><td>You also own the validator set, the security budget and the upgrade process</td></tr>
<tr><td>Polkadot parachain</td><td>Runtime storage</td><td>Own block space, shared security</td><td>Slot economics and a relay-chain dependency instead of your own validators</td></tr>
</tbody>
</table>
</div>
<p>The practical consequence is boring and expensive: <em>a design that is idiomatic on one model is an anti-pattern on another.</em> A global counter incremented by every user is unremarkable in the EVM and a throughput ceiling on Solana or Sui, where it turns a parallelisable workload into a serialised one. Conversely, per-user object inventories are cheap on Sui and awkward on the EVM, where every one of them is a mapping entry in one contract’s storage.</p>

<h3>Finality is a claim, and claims have fine print</h3>
<p>"Instant finality" means different things depending on what happens when the assumption breaks.</p>
<div class="table-scroll">
<table>
<thead><tr><th>Chain family</th><th>Confirmation</th><th>Finality</th><th>Failure mode</th></tr></thead>
<tbody>
<tr><td>Proof of work</td><td>1 block, probabilistic</td><td>Never absolute — deeper is safer</td><td>Reorg with enough hashrate (lesson 9)</td></tr>
<tr><td>Ethereum</td><td>~12s, probabilistic</td><td>Two epochs, ~13 min</td><td>Inactivity leak if a third goes offline; finality stalls rather than reverts</td></tr>
<tr><td>BFT chains (Cosmos, Sui, Aptos)</td><td>Sub-second to seconds</td><td>Same moment — commit is final</td><td>Halt. A BFT chain with a third offline stops producing blocks</td></tr>
<tr><td>Optimistic rollup</td><td>Sequencer, milliseconds</td><td>Inherits L1 after the challenge window</td><td>Trusting a sequencer promise until the proof window closes (lesson 25)</td></tr>
</tbody>
</table>
</div>
<div class="note"><span class="tag">Read it precisely</span>"Finality in 400ms" and "a reorg cannot happen" are not the same sentence. Ask instead: what has to go wrong for a confirmed transaction to be undone, and what happens to the chain when it does — does it revert, or does it stop? Products care about both answers, and they need different mitigations.</div>

<h3>Fees are a market, not a price</h3>
<p>An advertised fee of a fraction of a cent describes an idle chain. What matters when you are live is how the fee behaves under contention and who gets priced out. Ethereum’s EIP-1559 base fee is global: an NFT mint prices out everybody (lesson 11). Solana adds local fee markets, so contention on one hot account does not tax unrelated traffic. Sui prices by gas units with a per-epoch reference price, and owned-object transactions avoid the consensus path entirely. Cosmos app-chains simply do not have neighbours — which is the whole point, and also why you pay for the validator set yourself.</p>
<p>Anywhere fees are extremely cheap, spam is the design problem. Every high-throughput chain answers it somehow: local fee markets, stake-weighted access, priority auctions, or hardware requirements that centralise the validator set. That answer is a property you are adopting.</p>

<h3>The cost of being wrong</h3>
<p>Portability is asymmetric, and it is worth pricing before you commit:</p>
<ul>
<li><strong>EVM chain to EVM chain</strong> — usually a redeploy plus a re-audit of assumptions (block times, precompiles, oracle availability, reorg depth). Cheap.</li>
<li><strong>EVM to Move or SVM</strong> — a rewrite. The contracts, the tests, the indexing and the wallet integration all change.</li>
<li><strong>Anything to your own app-chain</strong> — you inherit an operations team: validator onboarding, upgrade coordination, monitoring, incident response (module 10).</li>
</ul>
<p>A useful default: build the first version where the liquidity and the tooling already are, keep the domain logic in a layer that is not chain-specific, and move only when you can name the constraint that forces it. "Fees" is a constraint. "Higher TPS on a slide" is not.</p>

<div class="note warn"><span class="tag">Multi-chain is not free</span>Shipping the same product on four chains means four deployments, four sets of upgrade keys, four monitoring stacks, four liquidity fragments and — if state has to agree across them — a bridge, which is the least safe component in the whole system (lesson 49).</div>
`,
  code: [
    {
      lang: 'ts', file: 'chain-fit.ts',
      caption: 'The scoring the lab runs. It is deliberately opinionated: hard requirements eliminate, they do not subtract points.',
      src: `type Need = {
  needsExistingLiquidity: boolean;   // trading against assets that already exist
  writesPerSecond: number;           // sustained, not the launch-day spike
  hardFinalitySeconds: number;       // how long you can wait before acting on a write
  sovereignUpgrades: boolean;        // must control your own runtime/upgrades
  team: 'solidity' | 'rust' | 'move' | 'none';
};

type Chain = {
  name: string;
  liquidity: 'deep' | 'medium' | 'thin';
  practicalTps: number;              // sustained, real applications, not a lab benchmark
  finalitySeconds: number;
  sovereign: boolean;
  language: 'solidity' | 'rust' | 'move';
  note: string;
};

const CHAINS: Chain[] = [
  { name: 'Ethereum L1', liquidity: 'deep', practicalTps: 15, finalitySeconds: 780,
    sovereign: false, language: 'solidity', note: 'Settlement and liquidity. Expensive per write.' },
  { name: 'EVM rollup', liquidity: 'deep', practicalTps: 300, finalitySeconds: 780,
    sovereign: false, language: 'solidity', note: 'Cheap writes; sequencer and upgrade keys are the trust.' },
  { name: 'Solana', liquidity: 'medium', practicalTps: 2000, finalitySeconds: 13,
    sovereign: false, language: 'rust', note: 'Parallel when write sets are disjoint. Declare accounts up front.' },
  { name: 'Sui', liquidity: 'medium', practicalTps: 2000, finalitySeconds: 1,
    sovereign: false, language: 'move', note: 'Owned-object writes skip consensus entirely.' },
  { name: 'Cosmos app-chain', liquidity: 'thin', practicalTps: 1000, finalitySeconds: 6,
    sovereign: true, language: 'rust', note: 'Your block space, your validator set, your pager.' }
];

function fit(need: Need) {
  const eliminated: string[] = [];

  const survivors = CHAINS.filter(c => {
    // Hard requirements. A chain that cannot meet one is not a compromise, it is out.
    if (need.sovereignUpgrades && !c.sovereign) {
      eliminated.push(c.name + ': cannot own the runtime'); return false;
    }
    if (need.writesPerSecond > c.practicalTps) {
      eliminated.push(c.name + ': sustained write rate exceeds practical throughput'); return false;
    }
    if (need.hardFinalitySeconds < c.finalitySeconds) {
      eliminated.push(c.name + ': finality slower than the product can tolerate'); return false;
    }
    if (need.needsExistingLiquidity && c.liquidity === 'thin') {
      eliminated.push(c.name + ': you would have to bootstrap the liquidity yourself'); return false;
    }
    return true;
  });

  // Soft preference: a team shipping in a language it already knows ships sooner.
  const ranked = survivors.sort((a, b) => {
    const langA = a.language === need.team ? 0 : 1;
    const langB = b.language === need.team ? 0 : 1;
    return langA - langB || b.practicalTps - a.practicalTps;
  });

  return { ranked, eliminated };
}`
    },
    {
      lang: 'solidity', file: 'Counter.sol',
      caption: 'The same feature on two models. Both are correct; each is written the way its chain wants to be written.',
      src: `// EVM: one shared slot. Every increment contends with every other increment,
// and the block executes them one after another regardless of who sent them.
contract Counter {
    uint256 public total;
    mapping(address => uint256) public perUser;

    function increment() external {
        total += 1;                // <- the global hotspot
        perUser[msg.sender] += 1;  // <- fine, disjoint per caller
    }
}

/*  Move / Sui equivalent, sketched:

    public struct Tally has key { id: UID, count: u64 }       // one object per user

    public fun increment(t: &mut Tally) { t.count = t.count + 1; }

    Each user owns their own Tally object, so increments touch disjoint state
    and never go through consensus at all. Wanting one global number back means
    a shared object — and then you have re-created the hotspot on purpose,
    which is a decision rather than an accident.                                  */`
    }
  ],
  lab: 'chainfit',
  quiz: [
    { q: 'Why can a global counter be a throughput problem on Solana or Sui but unremarkable on Ethereum?', options: ['Those chains cannot do addition', 'They execute disjoint write sets in parallel, so one shared hot account or object serialises what would otherwise run concurrently', 'Ethereum charges less gas for counters', 'Counters are banned by Move'], answer: 1, why: 'Their throughput comes from parallelism over disjoint state. A single account or object that every transaction writes removes exactly that property. On Ethereum the block was serial anyway, so nothing is lost.' },
    { q: 'A BFT chain loses a third of its validators. What normally happens?', options: ['A deep reorg reverts recent blocks', 'The chain halts rather than finalising conflicting blocks', 'Finality becomes probabilistic', 'Fees go to zero'], answer: 1, why: 'BFT finality trades liveness for safety. Below the quorum threshold the chain stops producing blocks instead of finalising two conflicting histories.' },
    { q: 'Which of these is a genuine reason to move from an EVM rollup to your own app-chain?', options: ['A benchmark showing higher TPS', 'You need to control the runtime and upgrade schedule, and you can staff validator operations', 'The rollup logo is the wrong colour', 'You want cheaper fees at idle'], answer: 1, why: 'Sovereignty is a real constraint an app-chain solves. It is also an operations commitment — validator onboarding, upgrades, monitoring and incident response become yours.' },
    { q: 'Your product must act on a payment within two seconds and settle against existing stablecoin liquidity. Which requirement eliminates the most candidates?', options: ['The two-second finality requirement', 'The colour of the block explorer', 'Solidity experience on the team', 'Nothing — every chain finalises in under two seconds'], answer: 0, why: 'Deep-liquidity chains today mostly finalise in seconds to minutes. Hard latency requirements eliminate candidates; a language preference only reorders the survivors.' }
  ],
  tasks: [
    'Run the lab with your own product’s numbers and write down which chains were eliminated and by which requirement.',
    'Take one feature of your design and describe how its state would be laid out on the EVM, on Solana and on Sui.',
    'Find the published finality claim for a chain you use, then find what happens to that chain when its quorum assumption breaks.',
    'Write the migration estimate for moving your app off its current chain. If nobody can produce that number, that is the finding.'
  ],
  resources: [
    { type: 'docs', title: 'Ethereum.org — proof of stake and finality', url: 'https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/' },
    { type: 'docs', title: 'Solana — transaction fees and prioritization', url: 'https://solana.com/docs/core/fees' },
    { type: 'docs', title: 'Sui — object model and transaction execution', url: 'https://docs.sui.io/concepts/object-model' },
    { type: 'docs', title: 'Cosmos SDK — application-specific blockchains', url: 'https://docs.cosmos.network/main/learn/intro/why-app-specific' },
    { type: 'read', title: 'Polkadot — parachains and shared security', url: 'https://wiki.polkadot.network/docs/learn-parachains' }
  ]
});

L.push({
  id: 'rpc-providers', module: 13, num: 58,
  title: 'RPC Endpoints, Node Providers and the Trust You Rent',
  level: 'Intermediate', minutes: 60,
  summary: 'Every dApp talks to the chain through somebody’s server. Learn what that server can do to you, and how to build a read path that survives it.',
  objectives: [
    'Explain what a managed RPC provider can and cannot do to your application',
    'Choose between managed endpoints, self-hosted nodes and light-client verification',
    'Design a multi-provider read path with quorum, failover and staleness checks',
    'Avoid the standard operational traps: leaked keys, silent rate limits, missed reorgs'
  ],
  body: `
<h3>The node you do not run</h3>
<p>Module 10 was about operating a node. Almost nobody does that for their frontend. In practice a dApp calls <code>eth_call</code>, <code>eth_getLogs</code> and <code>eth_sendRawTransaction</code> against a managed endpoint — Infura, Alchemy, QuickNode, Moralis, a POKT gateway, or the wallet’s own default. That is a perfectly reasonable engineering decision. It is also a trust boundary that most teams never write down.</p>
<p>What a provider genuinely cannot do: forge a signature, mint you tokens, or change what is in a block. Signatures and state roots are verified by consensus, not by whoever hands you the JSON.</p>
<p>What a provider absolutely can do:</p>
<div class="table-scroll">
<table>
<thead><tr><th>Behaviour</th><th>What you see</th><th>Consequence</th></tr></thead>
<tbody>
<tr><td>Serve stale state</td><td>A balance from twelve blocks ago</td><td>You act on a price or a nonce that has moved</td></tr>
<tr><td>Drop a broadcast</td><td><code>eth_sendRawTransaction</code> returns a hash that never appears</td><td>Silent censorship; your user thinks they transacted</td></tr>
<tr><td>Rate limit</td><td>429s, exactly when your traffic spikes</td><td>Your app degrades hardest at its busiest moment</td></tr>
<tr><td>Omit logs</td><td>A range query missing events</td><td>An indexer with a permanent hole in it (lesson 52)</td></tr>
<tr><td>Serve a fork</td><td>Blocks that were reorged out</td><td>Confirmed-looking writes that later vanish</td></tr>
<tr><td>Log your traffic</td><td>Nothing visible</td><td>Wallet addresses tied to IPs and page views</td></tr>
</tbody>
</table>
</div>
<p>None of these require the provider to be malicious. Most of them are ordinary outages, and they present identically to an attack.</p>

<h3>Three ways to read the chain</h3>
<p><strong>Managed endpoint.</strong> Fastest to ship. You are trusting an operator for liveness and honesty of reads. Fine for display; risky as the sole input to money decisions.</p>
<p><strong>Your own node.</strong> No third-party trust for reads, and full control over pruning and archive depth. You now own the disk growth, the upgrades and the pager (lessons 44 and 46). Full archive history is the expensive part; most teams need it far less than they assume.</p>
<p><strong>Light-client verification.</strong> Verify consensus evidence yourself and check state against a header you trust, rather than trusting a JSON response (lesson 4). Strongest per byte of trust, most work per feature, and the tooling maturity varies by chain.</p>
<div class="note"><span class="tag">Pick per surface, not per app</span>Displaying a token balance and executing a liquidation are not the same trust problem. Use the cheap path for cosmetics, the verified path for anything that moves value or decides a state transition.</div>

<h3>The read path that survives Tuesday</h3>
<p>Serious read paths use more than one provider. The pattern is not complicated:</p>
<ul>
<li><strong>Quorum.</strong> Ask N providers, require agreement from a majority before you believe a value that matters.</li>
<li><strong>Staleness check.</strong> Compare the block number each returned. A provider more than a few blocks behind is a broken input, not a slow one.</li>
<li><strong>Failover with hedging.</strong> Fire the second request after a short delay rather than after a timeout; timeouts are how you turn one slow provider into a slow product.</li>
<li><strong>Confirmations, not tips.</strong> Read money-relevant state at a block depth your chain’s reorg behaviour justifies, and treat the tip as provisional (lesson 52).</li>
<li><strong>Independence.</strong> Three endpoints behind the same upstream provider are one endpoint with extra steps. Check whose infrastructure you are actually on.</li>
</ul>

<h3>Writes are a separate problem</h3>
<p>Broadcasting is not reading. A transaction you send to one endpoint may never reach the wider mempool, and you cannot tell the difference between "dropped", "rate limited" and "held back deliberately" from the outside. Broadcast to more than one endpoint, watch for inclusion rather than for the RPC response, and remember that private orderflow endpoints are a deliberate, different trust choice with their own trade-offs (lesson 48).</p>
<div class="note danger"><span class="tag">API keys in the frontend are public</span>Anything your browser bundle can send, anyone can extract and replay — a key in JavaScript is published, not hidden. Use origin-restricted keys, keep privileged methods behind your own proxy with an explicit method allowlist, and set per-key spend caps so a scraped key becomes a bill you noticed rather than a bill you discovered next month.</div>

<h3>Costs</h3>
<p>Providers bill in compute units, not requests: an <code>eth_getLogs</code> across a wide block range can cost hundreds of times a single <code>eth_call</code>. The three habits that keep the bill sane are batching related calls into one request, narrowing log queries by address and topic instead of scanning, and caching anything that is derived from a finalised block — finalised data cannot change, so re-fetching it is pure waste.</p>
`,
  code: [
    {
      lang: 'ts', file: 'rpc-pool.ts',
      caption: 'A read path with quorum, staleness rejection and hedged requests. The interesting part is that disagreement is surfaced, never silently averaged.',
      src: `type Endpoint = { name: string; url: string };

type Reading<T> = { endpoint: string; block: number; value: T };

const MAX_LAG = 3;            // blocks behind the best answer before we distrust it
const HEDGE_MS = 250;         // start the next request instead of waiting on a timeout

async function callOne<T>(ep: Endpoint, method: string, params: unknown[]): Promise<Reading<T>> {
  const body = [
    { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] },
    { jsonrpc: '2.0', id: 2, method, params }
  ];
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(ep.name + ': HTTP ' + res.status);
  const out = await res.json();
  const head = out.find((r: any) => r.id === 1);
  const call = out.find((r: any) => r.id === 2);
  if (call.error) throw new Error(ep.name + ': ' + call.error.message);
  return { endpoint: ep.name, block: parseInt(head.result, 16), value: call.result };
}

// Hedge rather than wait: a slow provider should cost 250ms, not a timeout.
async function hedged<T>(eps: Endpoint[], method: string, params: unknown[]) {
  const results: Reading<T>[] = [];
  const errors: string[] = [];
  await Promise.all(eps.map((ep, i) => new Promise<void>(resolve => {
    setTimeout(async () => {
      try { results.push(await callOne<T>(ep, method, params)); }
      catch (e) { errors.push(String(e)); }
      resolve();
    }, i * HEDGE_MS);
  })));
  return { results, errors };
}

export async function readWithQuorum<T>(eps: Endpoint[], method: string, params: unknown[]) {
  const { results, errors } = await hedged<T>(eps, method, params);
  if (results.length === 0) throw new Error('every endpoint failed: ' + errors.join('; '));

  // A provider well behind the others is answering about a different chain state.
  const best = Math.max(...results.map(r => r.block));
  const fresh = results.filter(r => best - r.block <= MAX_LAG);
  const stale = results.filter(r => best - r.block > MAX_LAG).map(r => r.endpoint);

  const tally = new Map<string, Reading<T>[]>();
  for (const r of fresh) {
    const k = JSON.stringify(r.value);
    tally.set(k, [...(tally.get(k) ?? []), r]);
  }

  const [winner, backers] = [...tally.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const agreed = backers.length;
  const needed = Math.floor(fresh.length / 2) + 1;

  // Disagreement is a signal. Do not average it away, and do not hide it.
  return {
    value: agreed >= needed ? (JSON.parse(winner) as T) : null,
    agreed, needed, stale,
    disagreement: tally.size > 1,
    sources: backers.map(b => b.endpoint)
  };
}`
    },
    {
      lang: 'ts', file: 'rpc-proxy.ts',
      caption: 'The server-side half. The browser never sees the provider key, and only the methods you listed can be called through it.',
      src: `import { createServer } from 'node:http';

// The key lives here, in the process environment — never in the client bundle.
const UPSTREAM = process.env.RPC_URL!;

// Reads a frontend legitimately needs. Everything else is a 403, including
// admin_*, debug_* and any method that could be used to enumerate the node.
const ALLOWED = new Set([
  'eth_blockNumber', 'eth_call', 'eth_getBalance', 'eth_getLogs',
  'eth_getTransactionReceipt', 'eth_estimateGas', 'eth_sendRawTransaction'
]);

const MAX_LOG_RANGE = 2_000n;   // an unbounded getLogs is somebody else's bill

createServer(async (req, res) => {
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  const raw = await new Promise<string>(r => {
    let b = ''; req.on('data', c => (b += c)); req.on('end', () => r(b));
  });

  const calls = JSON.parse(raw);
  const batch = Array.isArray(calls) ? calls : [calls];

  for (const c of batch) {
    if (!ALLOWED.has(c.method)) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'method not allowed: ' + c.method }));
      return;
    }
    if (c.method === 'eth_getLogs') {
      const f = BigInt(c.params?.[0]?.fromBlock ?? '0x0');
      const t = BigInt(c.params?.[0]?.toBlock ?? '0x0');
      if (t - f > MAX_LOG_RANGE) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'log range too wide' }));
        return;
      }
    }
  }

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw
  });

  res.writeHead(upstream.status, { 'content-type': 'application/json' });
  res.end(await upstream.text());
}).listen(8545);`
    }
  ],
  lab: 'rpcpool',
  quiz: [
    { q: 'Which of these can a malicious RPC provider actually do?', options: ['Forge a signature so a transfer appears valid', 'Return stale state and quietly drop your broadcast', 'Mint tokens to itself', 'Change the contents of a finalised block'], answer: 1, why: 'Consensus protects signatures and block contents. What the provider controls is what it chooses to tell you and whether it relays what you send — omission and staleness, not forgery.' },
    { q: 'You query three endpoints and one is eight blocks behind. What should the read path do?', options: ['Average the three answers', 'Treat the lagging endpoint as a broken input and take quorum among the fresh ones', 'Always trust the lagging one, since older data is more settled', 'Fail the whole request'], answer: 1, why: 'A lagging provider is answering about a different chain state. Compare heads, drop what is beyond your lag tolerance, and take quorum among the rest — averaging state values is meaningless.' },
    { q: 'Why is an API key in your frontend bundle not a secret?', options: ['Because keys expire hourly', 'Because anything the browser can send, a user can extract and replay', 'Because HTTPS strips it', 'Because providers ignore frontend keys'], answer: 1, why: 'Shipped code is published code. Use origin restrictions, spend caps and a server-side proxy with a method allowlist for anything privileged.' },
    { q: 'Your indexer is missing events for one block range, and the RPC returned HTTP 200 the whole time. Most likely cause?', options: ['The events were deleted from the chain', 'A provider served an incomplete log response — a silent gap, not an error', 'Solidity dropped the events', 'The contract self-destructed'], answer: 1, why: 'Incomplete log responses are a well-known failure mode and they do not look like failures. Indexers need their own completeness checks: verify per-block counts and re-scan ranges rather than trusting one pass.' }
  ],
  tasks: [
    'Use the lab to configure providers and failure modes until you find a combination that reports a value with no quorum.',
    'List every RPC endpoint your application uses and find out whose infrastructure each one actually runs on.',
    'Add a staleness check to one read path: compare the returned block number with your best-known head and reject beyond a threshold.',
    'Take one privileged frontend call and move it behind a proxy with an explicit method allowlist.'
  ],
  resources: [
    { type: 'docs', title: 'Ethereum JSON-RPC API specification', url: 'https://ethereum.org/en/developers/docs/apis/json-rpc/' },
    { type: 'docs', title: 'Ethereum.org — nodes as a service', url: 'https://ethereum.org/en/developers/docs/nodes-and-clients/nodes-as-a-service/' },
    { type: 'docs', title: 'Ethereum.org — light clients and verification', url: 'https://ethereum.org/en/developers/docs/nodes-and-clients/light-clients/' },
    { type: 'tool', title: 'viem — transports, fallback and retries', url: 'https://viem.sh/docs/clients/transports/fallback' },
    { type: 'read', title: 'Ethereum.org — running your own node', url: 'https://ethereum.org/en/run-a-node/' }
  ]
});

L.push({
  id: 'l2-landscape', module: 13, num: 59,
  title: 'The L2 Landscape: Rollups, Sidechains and the Designs That Lost',
  level: 'Advanced', minutes: 70,
  summary: 'Sort every scaling design by where the data goes and where the proof comes from, then read a real chain’s training wheels honestly.',
  objectives: [
    'Classify any L2 by its data availability and its proof system',
    'Explain why plasma and payment channels lost to rollups, and where they still win',
    'Read a chain’s upgrade keys, sequencer setup and escape hatch as its real security',
    'Estimate the withdrawal latency and cost a user will actually experience'
  ],
  body: `
<h3>Two questions classify everything</h3>
<p>Lesson 25 built rollup mechanics. This lesson is the map. Ignore branding and ask two questions of any scaling design:</p>
<ol>
<li><strong>Where does the transaction data go?</strong> Onto L1 where anyone can reconstruct state, or somewhere else?</li>
<li><strong>What convinces L1 that the new state root is right?</strong> A validity proof, a fraud-proof window, or an external validator set?</li>
</ol>
<div class="table-scroll">
<table>
<thead><tr><th>Design</th><th>Data</th><th>Proof</th><th>What breaks it</th></tr></thead>
<tbody>
<tr><td>ZK rollup</td><td>L1 (calldata or blob)</td><td>Validity proof, verified on L1</td><td>A bug in the circuit or the verifier; prover liveness</td></tr>
<tr><td>Optimistic rollup</td><td>L1 (calldata or blob)</td><td>Fraud proof within a challenge window</td><td>Nobody watching, or challengers censored for the window</td></tr>
<tr><td>Validium</td><td>Off chain (committee or DAC)</td><td>Validity proof</td><td>The data committee withholds — proofs stay valid, your exit does not</td></tr>
<tr><td>Sidechain</td><td>Its own chain</td><td>Its own consensus; bridge is a separate trust</td><td>Its validator set, and the bridge signers (lesson 49)</td></tr>
<tr><td>Plasma</td><td>Off chain, commitments on L1</td><td>Exit games with challenges</td><td>Data withholding forces mass exits; general state was never solved</td></tr>
<tr><td>State/payment channel</td><td>Off chain, between participants</td><td>On-chain dispute with the latest signed state</td><td>Being offline when your counterparty submits an old state</td></tr>
</tbody>
</table>
</div>
<p>Read the table by column and the modern consensus is visible: <em>publish the data, and be able to prove the transition.</em> Everything that lost, lost on data availability.</p>

<h3>Why plasma and channels lost — and where they still win</h3>
<p>Plasma kept data off chain and relied on users exiting when an operator misbehaved. That works for a single-token transfer chain and collapses for general smart contracts: to exit you must know your state, and an operator who withholds data makes that impossible for exactly the users who need it. Worse, a mass exit is a congestion event on L1 at the moment L1 is already under stress.</p>
<p>Payment channels solved a narrower problem extremely well. Two parties sign successive states off chain and only touch L1 to open, close or dispute. The cost is a liveness assumption — you or a watchtower must be online to challenge a stale close — plus capital locked in the channel and routing complexity in a network. That is a bad fit for a general-purpose app and a very good fit for high-frequency payments between a stable set of parties, which is why Lightning still exists and plasma does not.</p>

<h3>Blobs changed the economics, not the model</h3>
<p>EIP-4844 gave rollups a separate fee market for data that expires after roughly two weeks. Costs fell by an order of magnitude, and the security argument stayed intact: the data was published long enough for anyone to reconstruct state and build proofs, which is what data availability actually requires. Full history is then a matter for archive nodes and indexers, not for consensus.</p>

<h3>The trust nobody puts on the landing page</h3>
<p>Two chains can share a proof system and have entirely different risk. What differs is the operational layer:</p>
<ul>
<li><strong>Upgrade keys.</strong> Who can replace the bridge or verifier contract, and is there a timelock long enough for users to leave? An instant upgrade key is a total-control key.</li>
<li><strong>Sequencer.</strong> Almost every production rollup has a single one. It cannot steal your funds, but it can reorder, delay and censor.</li>
<li><strong>Escape hatch.</strong> If the sequencer ignores you, can you force a transaction directly through the L1 inbox, and has anyone tested it recently?</li>
<li><strong>Proofs in production.</strong> "Fraud proofs" that are permissioned or disabled are a plan, not a mechanism. Ask whether anyone other than the team can actually submit one.</li>
</ul>
<div class="note warn"><span class="tag">Judge the stage, not the slogan</span>L2BEAT’s stage framework exists because "secured by Ethereum" is compatible with a multisig that can rewrite the bridge tomorrow. Stage 0 means training wheels on; stage 2 means proofs live and upgrades constrained by a delay users can act within. Look it up per chain, per quarter — chains move between stages.</div>

<h3>What the user actually feels: withdrawals</h3>
<p>Deposits are fast everywhere. Withdrawals are where the design shows up, and where support tickets come from.</p>
<div class="table-scroll">
<table>
<thead><tr><th>Path</th><th>Typical wait</th><th>Cost</th><th>Trust</th></tr></thead>
<tbody>
<tr><td>Optimistic, canonical bridge</td><td>~7 days</td><td>L1 gas at exit</td><td>Protocol only</td></tr>
<tr><td>ZK, canonical bridge</td><td>Minutes to hours (proof cadence)</td><td>L1 gas, amortised</td><td>Protocol + prover liveness</td></tr>
<tr><td>Fast/liquidity bridge</td><td>Minutes</td><td>A fee to the liquidity provider</td><td>That provider and its contracts</td></tr>
<tr><td>Forced inclusion via L1</td><td>Hours to a day</td><td>Highest — you pay L1 directly</td><td>Protocol only; this is the escape hatch</td></tr>
</tbody>
</table>
</div>
<p>A fast bridge is not a faster protocol. It is somebody fronting you funds and taking the settlement wait themselves, priced as a fee. That is a perfectly good product and an additional counterparty.</p>
`,
  code: [
    {
      lang: 'ts', file: 'l2-profile.ts',
      caption: 'Turning marketing categories into a trust profile. The scoring rewards published data and permissionless proofs, and punishes instant upgrade keys.',
      src: `type Profile = {
  name: string;
  data: 'l1-blob' | 'l1-calldata' | 'committee' | 'own-chain';
  proof: 'validity' | 'fraud' | 'consensus';
  proofsPermissionless: boolean;
  sequencer: 'single' | 'shared' | 'decentralised';
  forcedInclusion: boolean;
  upgradeDelayHours: number;      // 0 = instant, no time to exit
};

function assess(p: Profile) {
  const risks: string[] = [];
  let worstCase = 'Funds recoverable from L1 data by anyone.';

  if (p.data === 'committee') {
    risks.push('Data availability depends on a committee. Withheld data means you cannot construct an exit even though every proof is valid.');
    worstCase = 'Funds frozen if the committee withholds.';
  }
  if (p.data === 'own-chain') {
    risks.push('Security is the sidechain validator set plus the bridge, not the L1.');
    worstCase = 'Funds only as safe as the bridge signers.';
  }
  if (p.proof === 'fraud' && !p.proofsPermissionless) {
    risks.push('Fraud proofs exist but only a whitelist can submit them — the invalid-state defence depends on that whitelist showing up.');
  }
  if (p.sequencer === 'single' && !p.forcedInclusion) {
    risks.push('A single sequencer with no escape hatch can censor an address indefinitely.');
  }
  if (p.upgradeDelayHours === 0) {
    risks.push('Upgrades take effect instantly. Whoever holds the key can change the rules faster than users can leave.');
    worstCase = 'Upgrade key is a total-control key.';
  }

  // The exit clock a user experiences, which is rarely the number in the docs.
  const exitHours =
    p.proof === 'validity' ? 4 :
    p.proof === 'fraud' ? 24 * 7 :
    2;

  return { risks, worstCase, exitHours, forcedExitAvailable: p.forcedInclusion };
}`
    },
    {
      lang: 'solidity', file: 'ForcedInclusion.sol',
      caption: 'The escape hatch, sketched. The point is the deadline: if the sequencer ignores a queued message for long enough, L1 stops accepting its batches.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Simplified L1 inbox. A user who is being censored by the sequencer queues
/// the transaction here; the rollup contract must include queued messages
/// within a deadline or its batches stop being accepted.
contract Inbox {
    struct Queued { address from; bytes data; uint64 queuedAt; }

    uint64 public constant MAX_DELAY = 24 hours;

    Queued[] public queue;
    uint256 public consumed;          // index of the next message to include

    event Forced(uint256 indexed index, address indexed from);

    /// Anyone can queue. This is the property that makes censorship survivable:
    /// it does not need the sequencer's cooperation, only L1 inclusion.
    function forceInclude(bytes calldata data) external payable {
        queue.push(Queued({ from: msg.sender, data: data, queuedAt: uint64(block.timestamp) }));
        emit Forced(queue.length - 1, msg.sender);
    }

    /// Called on every batch submission. If the oldest unconsumed message has
    /// aged past the deadline, the sequencer cannot make progress until it
    /// includes it — censorship becomes a liveness failure it pays for.
    function assertNotCensoring() public view {
        if (consumed < queue.length) {
            require(
                block.timestamp - queue[consumed].queuedAt <= MAX_DELAY,
                "sequencer is censoring a queued message"
            );
        }
    }

    function submitBatch(bytes calldata batch, uint256 includedUpTo) external {
        assertNotCensoring();
        require(includedUpTo >= consumed, "cannot skip queued messages");
        consumed = includedUpTo;
        // ... commit the batch and its state root here ...
    }
}`
    }
  ],
  lab: 'l2pick',
  quiz: [
    { q: 'What distinguishes a validium from a ZK rollup?', options: ['Validiums use fraud proofs', 'Validiums keep transaction data off chain, so a data withholder can freeze exits even though every proof is valid', 'Validiums have no proofs at all', 'Nothing — the terms are synonyms'], answer: 1, why: 'Both use validity proofs. The difference is data availability: a validium relies on a committee, and withheld data means users cannot construct the state they need to exit.' },
    { q: 'Why did plasma fail for general smart contracts?', options: ['Proofs were too expensive to verify', 'Exiting requires knowing your state, and an operator withholding data makes that impossible exactly when you need it', 'Solidity did not support it', 'It required a validity proof per transaction'], answer: 1, why: 'Plasma’s security rests on users exiting with their own state. Withheld data removes the ability to exit, and mass exits congest L1 at the worst moment. Rollups fixed this by publishing the data.' },
    { q: 'Two rollups both use validity proofs. One has a 7-day upgrade timelock, the other has an instant upgrade key. What does that change?', options: ['Nothing, the proofs are what matter', 'The instant key can change the rules — including the bridge — faster than users can withdraw', 'The timelock makes proofs unnecessary', 'Only the fee level'], answer: 1, why: 'A proof system constrains state transitions under the current contracts. Whoever can replace those contracts instantly is outside that constraint, so the upgrade key is part of the real security model.' },
    { q: 'A user needs funds on L1 within an hour and the chain is an optimistic rollup. What actually happens?', options: ['The canonical bridge finishes in an hour', 'They use a liquidity bridge and pay a fee to someone who fronts the funds and waits out the challenge window', 'The challenge window is skipped for small amounts', 'Forced inclusion makes withdrawals instant'], answer: 1, why: 'The challenge window is the protocol’s. Speed comes from a third party supplying inventory now and settling later — a fee and an extra counterparty, not a faster protocol.' },
    { q: 'What does a forced-inclusion inbox on L1 defend against?', options: ['Invalid state roots', 'A sequencer that censors a specific address', 'A prover that goes offline', 'Reorgs on L1'], answer: 1, why: 'Forced inclusion lets a user queue a transaction directly on L1 that the rollup must include within a deadline. It addresses censorship, not validity or prover liveness.' }
  ],
  tasks: [
    'Use the lab to build a chain profile with off-chain data and an instant upgrade key, and read the worst case it produces.',
    'Pick two L2s you would consider deploying to and write down, for each: who can upgrade, how long the delay is, and whether anyone outside the team can submit a proof.',
    'Find the forced-inclusion mechanism for one rollup and describe the exact steps a censored user would take.',
    'Calculate the real cost and wait of moving 100 units of value off that chain by each available path.'
  ],
  resources: [
    { type: 'docs', title: 'Ethereum.org — layer 2 rollups', url: 'https://ethereum.org/en/layer-2/' },
    { type: 'read', title: 'L2BEAT — risk framework and stages', url: 'https://l2beat.com/scaling/summary' },
    { type: 'eip', title: 'EIP-4844: shard blob transactions', url: 'https://eips.ethereum.org/EIPS/eip-4844' },
    { type: 'paper', title: 'Plasma: scalable autonomous smart contracts', url: 'https://plasma.io/plasma.pdf' },
    { type: 'paper', title: 'The Bitcoin Lightning Network paper', url: 'https://lightning.network/lightning-network-paper.pdf' }
  ]
});

L.push({
  id: 'dstorage', module: 13, num: 60,
  title: 'Decentralised Storage: IPFS, Arweave and Filecoin',
  level: 'Intermediate', minutes: 60,
  summary: 'Chains are terrible databases. Learn the three ways to keep bytes alive off chain, what each one actually pays for, and how to anchor them so tampering is detectable.',
  objectives: [
    'Explain what a CID proves and what it does not',
    'Compare pinning, endowment and storage-deal economics honestly',
    'Design an on-chain anchor so off-chain tampering is provable',
    'Choose a storage backend from durability, mutability and privacy requirements'
  ],
  body: `
<h3>Why not just put it on chain</h3>
<p>You can. It costs roughly five figures per megabyte on Ethereum L1, every full node stores it forever, and you can never delete it. That is the right trade for a 2 KB generative SVG and the wrong one for a 4 MB image, a video, or a document set. Everything else is a way to keep bytes somewhere cheaper while keeping the guarantee that matters — that the bytes have not changed.</p>

<h3>Content addressing, precisely</h3>
<p>Lesson 41 introduced the idea. The detail worth knowing: an IPFS CID is not a location, and it is not a plain hash of the file either. Large files are chunked into a DAG; the CID identifies the root node, and the multihash inside it says which hash function was used. Two consequences follow. First, the same bytes chunked with different settings can produce different CIDs — so "the CID matches" means "these exact bytes, imported these exact ways". Second, verification is incremental: you can check a chunk as it arrives instead of trusting the whole download.</p>
<p>What a CID gives you is <strong>integrity</strong>. What it does not give you is <strong>availability</strong>. There is no network-wide obligation to keep anything. If the last node holding your bytes goes offline, the CID still describes them perfectly and nobody can serve them.</p>
<div class="note"><span class="tag">The gateway trap</span>If your app loads content through one HTTPS gateway, you have a content-addressed backend and a single point of failure and censorship in front of it. The gateway can also serve you different bytes than the CID names — unless you verify the hash client-side, which is the whole point and is exactly the step most apps skip.</div>

<h3>Three ways to pay for persistence</h3>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>IPFS + pinning</th><th>Arweave</th><th>Filecoin</th></tr></thead>
<tbody>
<tr><td>Payment model</td><td>Recurring, to a pinning service or your own node</td><td>One-time fee into an endowment</td><td>Deals with providers, priced per epoch</td></tr>
<tr><td>Durability comes from</td><td>Someone continuing to pay</td><td>Endowment maths plus miner incentives</td><td>Cryptographic storage proofs, slashing on failure</td></tr>
<tr><td>Deletion</td><td>Unpin and it eventually disappears</td><td>Not supported — treat it as permanent</td><td>Deal expires unless renewed</td></tr>
<tr><td>Retrieval</td><td>Fast via gateways or peers</td><td>Fast via gateways</td><td>Separate retrieval market; not automatically fast</td></tr>
<tr><td>Best fit</td><td>Mutable app data, working sets</td><td>Publish-once artefacts you promised were permanent</td><td>Large cold data with verifiable custody</td></tr>
</tbody>
</table>
</div>
<p>Filecoin is the one people mis-describe. It is not "IPFS with payments": providers prove they are storing your sealed data over time (proof of replication, then continuous proofs of spacetime) and lose stake if they stop. That is a verifiable storage <em>contract</em>. It is not a CDN, and retrieval performance is a separate concern you plan for.</p>
<p>Arweave sells permanence as an endowment: you overpay once, the surplus funds future storage under an assumption that storage costs keep falling. Whether that holds for a century is an economic bet — but the model at least states its assumption plainly, which recurring pinning does not.</p>

<h3>Mutability without lying</h3>
<p>Content addressing and updates are in tension by design. The honest patterns:</p>
<ul>
<li><strong>Immutable, versioned.</strong> Each version is its own CID; the chain stores the pointer. History is intact and every change is a visible on-chain event.</li>
<li><strong>IPNS or DNSLink.</strong> A mutable name resolving to a CID. Convenient, and it reintroduces a key or a domain as the trust anchor — whoever holds it can repoint you.</li>
<li><strong>Manifest anchor.</strong> Publish a manifest of file hashes, commit its Merkle root on chain (lesson 4), and let anyone verify a single file against the root without downloading the rest.</li>
</ul>

<h3>Privacy: the part that ends careers</h3>
<div class="note danger"><span class="tag">Public means public, forever</span>Anything you put on IPFS or Arweave without encrypting it is world-readable the moment its CID is known, and CIDs leak — through gateways, through your own frontend, through anyone who ever had the link. Arweave in particular has no delete. Encrypt before upload, keep the keys out of the same system, and never publish personal data on the assumption that an obscure CID is a secret. It is an address, not a password.</div>
<p>The pattern that satisfies both auditability and privacy regulation is the same one used in module 10 for logs: keep the sensitive bytes in a system you control and can erase, publish only a salted hash, and let the chain prove that what you are showing today is what existed then. A commitment is deletable in the sense that matters — the plaintext can be destroyed, and the commitment left behind proves nothing about a subject on its own.</p>
`,
  code: [
    {
      lang: 'ts', file: 'anchor.ts',
      caption: 'Hash the files, build a Merkle root over the manifest, publish the root. Any single file can then be proven against the chain without the others.',
      src: `import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sha256 = (b: Uint8Array) => new Uint8Array(createHash('sha256').update(b).digest());
const hex = (b: Uint8Array) => '0x' + Buffer.from(b).toString('hex');

type Entry = { path: string; bytes: number; digest: string };

export async function manifest(paths: string[]): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const p of paths) {
    const buf = new Uint8Array(await readFile(p));
    out.push({ path: p, bytes: buf.length, digest: hex(sha256(buf)) });
  }
  // Sorting makes the manifest canonical: the same files always produce the
  // same root, no matter what order the uploader happened to walk them in.
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

function leaf(e: Entry) {
  return sha256(new TextEncoder().encode(e.path + '\\0' + e.digest));
}

export function root(entries: Entry[]): { root: string; layers: Uint8Array[][] } {
  let level = entries.map(leaf);
  const layers = [level];
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? level[i];        // odd node pairs with itself
      const joined = new Uint8Array(a.length + b.length);
      joined.set(a); joined.set(b, a.length);
      next.push(sha256(joined));
    }
    layers.push(next);
    level = next;
  }
  return { root: hex(level[0]), layers };
}

// Proof for one file: the sibling at each level, same shape as lesson 4.
export function proof(layers: Uint8Array[][], index: number): string[] {
  const path: string[] = [];
  let i = index;
  for (let d = 0; d < layers.length - 1; d++) {
    const sib = i % 2 === 0 ? i + 1 : i - 1;
    path.push(hex(layers[d][Math.min(sib, layers[d].length - 1)]));
    i = Math.floor(i / 2);
  }
  return path;
}`
    },
    {
      lang: 'solidity', file: 'Manifest.sol',
      caption: 'The on-chain half: an append-only list of versions. Nothing is ever overwritten, so a repoint is a new version anyone can see rather than a silent edit.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Anchors off-chain content. The contract stores no bytes — only the root
/// that makes tampering with those bytes detectable, plus where to find them.
contract Manifest {
    struct Version {
        bytes32 root;        // Merkle root over (path, sha256) leaves
        string  locator;     // ipfs://…, ar://…, or an https URL
        uint64  publishedAt;
        address publisher;
    }

    address public immutable owner;
    Version[] public versions;
    bool public sealed_;

    event Published(uint256 indexed version, bytes32 root, string locator);
    event Sealed(uint256 finalVersion);

    error NotOwner();
    error AlreadySealed();

    constructor() { owner = msg.sender; }

    function publish(bytes32 root, string calldata locator) external {
        if (msg.sender != owner) revert NotOwner();
        if (sealed_) revert AlreadySealed();
        versions.push(Version(root, locator, uint64(block.timestamp), msg.sender));
        emit Published(versions.length - 1, root, locator);
    }

    /// One-way. After this the content set is fixed and the promise of
    /// permanence is enforced by the contract rather than by a blog post.
    function seal() external {
        if (msg.sender != owner) revert NotOwner();
        if (sealed_) revert AlreadySealed();
        sealed_ = true;
        emit Sealed(versions.length - 1);
    }

    /// Verify one file against a published version without fetching the rest.
    function verify(uint256 version, bytes32 leaf, bytes32[] calldata path)
        external view returns (bool)
    {
        bytes32 h = leaf;
        for (uint256 i = 0; i < path.length; i++) {
            h = h <= path[i]
                ? keccak256(abi.encodePacked(h, path[i]))
                : keccak256(abi.encodePacked(path[i], h));
        }
        return h == versions[version].root;
    }

    function versionCount() external view returns (uint256) { return versions.length; }
}`
    }
  ],
  lab: 'dstore',
  quiz: [
    { q: 'What does a matching CID prove?', options: ['That the file will remain available', 'That the bytes you received are exactly the bytes the identifier was derived from', 'That the uploader owns the copyright', 'That at least three nodes are pinning it'], answer: 1, why: 'Content addressing gives integrity, not availability. Nothing in the protocol obliges anyone to keep serving the content, and no pin count is implied by the CID.' },
    { q: 'How does Filecoin differ from a pinning service?', options: ['It is the same thing with a token attached', 'Providers submit ongoing cryptographic proofs that they still hold the data and lose stake if they stop', 'It stores data on Ethereum L1', 'It guarantees sub-second retrieval'], answer: 1, why: 'Filecoin makes storage verifiable and slashable through proof of replication and proofs of spacetime. Retrieval speed is a separate market and not implied by the storage deal.' },
    { q: 'You must publish a document set that is auditable but contains personal data. What is the defensible design?', options: ['Upload it to Arweave for permanence', 'Keep the plaintext in a system you control and publish only a salted hash as the on-chain commitment', 'Put it on IPFS and rely on the CID being hard to guess', 'Store it on chain encrypted with a key you also store on chain'], answer: 1, why: 'A commitment proves what existed without publishing it, and the plaintext stays erasable. A CID is an address, not a secret, and Arweave has no delete.' },
    { q: 'Your app loads all content through one HTTPS gateway and never checks hashes. What have you built?', options: ['A verified content-addressed system', 'A centralised system with extra steps — the gateway is a single point of failure that can serve different bytes', 'A validium', 'A light client'], answer: 1, why: 'Verification is the step that makes content addressing meaningful. Without a client-side hash check the gateway is simply a trusted server.' }
  ],
  tasks: [
    'Use the lab to compare pinning, endowment and deal-based storage over a 10-year horizon and note which failure mode each has.',
    'Build a manifest of a real folder, compute the Merkle root, and verify one file against it with a proof.',
    'Take an existing app that loads IPFS content through a gateway and add client-side hash verification.',
    'Write the retention and erasure policy for a system that anchors hashes on chain but stores personal data off chain.'
  ],
  resources: [
    { type: 'docs', title: 'IPFS — content addressing and CIDs', url: 'https://docs.ipfs.tech/concepts/content-addressing/' },
    { type: 'docs', title: 'Filecoin — proof of replication and proof of spacetime', url: 'https://docs.filecoin.io/basics/what-is-filecoin/storage-model' },
    { type: 'docs', title: 'Arweave — the permaweb and endowment model', url: 'https://docs.arweave.org/developers/mining/mining-guide' },
    { type: 'docs', title: 'IPFS — IPNS and mutable pointers', url: 'https://docs.ipfs.tech/concepts/ipns/' },
    { type: 'read', title: 'Ethereum.org — decentralized storage', url: 'https://ethereum.org/en/developers/docs/storage/' }
  ]
});

L.push({
  id: 'tokenomics-dao', module: 13, num: 61,
  title: 'Tokenomics and DAO Governance',
  level: 'Advanced', minutes: 75,
  summary: 'Supply schedules, unlock cliffs and vote-weighting are all attack surface. Price the cost of capturing a treasury before someone else does.',
  objectives: [
    'Read a token distribution and predict when sell pressure arrives',
    'Compare token-weighted, vote-escrow, quadratic and delegated voting by what each one buys',
    'Explain why snapshot voting power defeats flash-loan governance attacks',
    'Size the capital cost of capturing a vote, and design the delays that make it not worth it'
  ],
  body: `
<h3>A token is a claim plus a schedule</h3>
<p>Two facts describe most of a token’s behaviour: what holding it entitles you to, and when new supply arrives. Lesson 42 covered emissions inside a game economy; the same arithmetic governs a protocol token, with a twist — a large share of supply is usually promised to insiders before launch and released on a clock.</p>
<div class="table-scroll">
<table>
<thead><tr><th>Component</th><th>Typical shape</th><th>What it does to the market</th></tr></thead>
<tbody>
<tr><td>Public float at launch</td><td>5–15% of total supply</td><td>Thin float, high volatility, and a price that means little</td></tr>
<tr><td>Team and investors</td><td>Cliff at 12 months, then linear</td><td>The cliff date is a scheduled supply shock; everyone can read it</td></tr>
<tr><td>Ecosystem/treasury</td><td>Unlocked, spent by governance</td><td>Real sell pressure whenever grants are paid in token</td></tr>
<tr><td>Emissions/rewards</td><td>Per block or per epoch</td><td>Continuous dilution — the faucet from lesson 42</td></tr>
</tbody>
</table>
</div>
<p>Fully diluted valuation multiplies the current price by <em>all</em> supply, including the tokens that do not exist yet. When float is 8% and the cliff is nine months out, today’s price is a quote on a small fraction of a much larger future supply. That is not fraud, it is arithmetic, and it is published — but only if you go and read the schedule.</p>

<h3>What voting weight should mean</h3>
<div class="table-scroll">
<table>
<thead><tr><th>System</th><th>Weight from</th><th>Buys you</th><th>Fails when</th></tr></thead>
<tbody>
<tr><td>Token-weighted</td><td>Balance at a snapshot block</td><td>Simplicity; skin in the game</td><td>Wealth concentrates, or is rented</td></tr>
<tr><td>Vote-escrow (ve)</td><td>Amount × remaining lock time</td><td>Alignment with the long term</td><td>Lock markets and bribes re-liquefy the commitment</td></tr>
<tr><td>Quadratic</td><td>Square root of contribution</td><td>Breadth over depth</td><td>Sybils — it needs real identity to mean anything</td></tr>
<tr><td>Delegated</td><td>Balances delegated to representatives</td><td>Turnout and informed voters</td><td>A handful of delegates become the government</td></tr>
<tr><td>Conviction</td><td>Support × time held on a proposal</td><td>Resistance to last-minute swings</td><td>Slow; poor fit for anything urgent</td></tr>
</tbody>
</table>
</div>
<p>Every one of these is an answer to "who decides", and every one has a cost. What none of them fixes on its own is that <em>voting power can be borrowed</em>.</p>

<h3>The flash-loan governance attack, and its one-line fix</h3>
<p>If voting power is read as a balance at the moment of voting, an attacker borrows a large amount of the governance token within a single transaction, creates or votes on a proposal, and repays the loan — all atomically, with no capital at risk beyond fees (the mechanics are lesson 21’s). Several protocols have lost their treasuries this way.</p>
<p>The fix is to read voting power from a <em>past</em> block: the proposal records a snapshot block, and weight comes from the balance checkpointed at that block. A loan taken afterwards carries no weight, and acquiring weight before the snapshot means holding the token across blocks — real capital, real exposure, and visible on chain.</p>
<div class="note"><span class="tag">Snapshot, then delay</span>Snapshot voting power is necessary and not sufficient. The second half is a timelock between a passed vote and its execution: it converts a governance takeover from an instant theft into a public countdown during which users can exit and a guardian can veto. Delay is the defence that keeps working when your assumptions about voters turn out wrong.</div>

<h3>Sizing the attack</h3>
<p>Governance security is a number you can compute. Let <code>supply</code> be circulating supply, <code>quorum</code> the fraction required, and <code>price</code> the market price. A naive cost of passing a proposal is <code>supply × quorum × price</code>. Now adjust it for reality:</p>
<ul>
<li><strong>Thin books.</strong> Buying that much moves the price — the real cost is higher than the quote, sometimes by multiples.</li>
<li><strong>Apathy.</strong> If turnout is habitually 4% and quorum is 4%, the attacker needs a rounding error, not a war chest.</li>
<li><strong>Renting.</strong> Vote-escrow bribe markets let an attacker pay holders for a single vote instead of buying the token, which is dramatically cheaper.</li>
<li><strong>Payoff.</strong> Compare against the treasury. A protocol holding 100M with a 10M capture cost is not governed, it is a standing offer.</li>
</ul>
<p>Write that ratio down for your own protocol, then design so it stays wrong for an attacker: quorum that scales with treasury value, a timelock long enough for a bank run, a guardian multisig that can only cancel and never execute, and — the unglamorous one — actually getting turnout up.</p>

<h3>Treasuries are operations, not trophies</h3>
<p>A treasury denominated entirely in its own token is a number, not a runway: the moment it needs to be spent, selling it moves the price it is measured in. Protocols that survived a bear market did the boring thing early — diversified a share into stables, published runway in months rather than tokens, and paid contributors on a schedule that did not require selling into weakness. Treat it exactly like the sink design in lesson 42: model what happens when the price falls 80%, because eventually it does.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'SnapshotGovernor.sol',
      caption: 'The minimum viable safe governor: voting power read from a past block, a timelock before execution, and a guardian that can only cancel.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IVotes {
    /// Checkpointed balance — the whole defence lives in this one function.
    function getPastVotes(address account, uint256 blockNumber) external view returns (uint256);
    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256);
}

contract SnapshotGovernor {
    struct Proposal {
        uint256 snapshotBlock;   // voting power is read here, not at vote time
        uint64  voteEnd;
        uint64  eta;             // earliest execution, set when it passes
        uint256 forVotes;
        uint256 againstVotes;
        bool    executed;
        bool    cancelled;
        bytes32 actionHash;
    }

    IVotes public immutable token;
    address public immutable guardian;      // can cancel, can never execute

    uint64 public constant VOTING_PERIOD = 3 days;
    uint64 public constant TIMELOCK      = 2 days;
    uint256 public constant QUORUM_BPS   = 400;    // 4% of supply at the snapshot

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public count;

    error AlreadyVoted();
    error VotingClosed();
    error NotPassed();
    error TooEarly();
    error OnlyGuardian();

    constructor(IVotes t, address g) { token = t; guardian = g; }

    function propose(bytes32 actionHash) external returns (uint256 id) {
        id = ++count;
        proposals[id] = Proposal({
            // block.number - 1 is already mined, so a loan taken in *this*
            // transaction cannot have been counted in it.
            snapshotBlock: block.number - 1,
            voteEnd: uint64(block.timestamp) + VOTING_PERIOD,
            eta: 0, forVotes: 0, againstVotes: 0,
            executed: false, cancelled: false, actionHash: actionHash
        });
    }

    function castVote(uint256 id, bool support) external {
        Proposal storage p = proposals[id];
        if (block.timestamp > p.voteEnd) revert VotingClosed();
        if (hasVoted[id][msg.sender]) revert AlreadyVoted();
        hasVoted[id][msg.sender] = true;

        uint256 weight = token.getPastVotes(msg.sender, p.snapshotBlock);
        if (support) p.forVotes += weight; else p.againstVotes += weight;
    }

    function queue(uint256 id) external {
        Proposal storage p = proposals[id];
        if (block.timestamp <= p.voteEnd) revert VotingClosed();

        uint256 quorum = (token.getPastTotalSupply(p.snapshotBlock) * QUORUM_BPS) / 10_000;
        if (p.forVotes <= p.againstVotes || p.forVotes < quorum) revert NotPassed();

        // The delay is the point: a passed proposal is a public countdown,
        // during which holders can exit and the guardian can cancel.
        p.eta = uint64(block.timestamp) + TIMELOCK;
    }

    function cancel(uint256 id) external {
        if (msg.sender != guardian) revert OnlyGuardian();
        proposals[id].cancelled = true;
    }

    function execute(uint256 id, bytes calldata action) external {
        Proposal storage p = proposals[id];
        if (p.eta == 0 || block.timestamp < p.eta) revert TooEarly();
        require(!p.executed && !p.cancelled, "not executable");
        require(keccak256(action) == p.actionHash, "action mismatch");
        p.executed = true;
        // ... dispatch the encoded call here ...
    }
}`
    },
    {
      lang: 'ts', file: 'unlocks.ts',
      caption: 'Circulating supply and scheduled sell pressure. The cliff dates are public — the only question is whether you read them before or after.',
      src: `type Allocation = {
  name: string;
  total: number;        // tokens
  cliffMonths: number;  // nothing unlocks before this
  vestMonths: number;   // linear release after the cliff
};

const PLAN: Allocation[] = [
  { name: 'public',    total:  80_000_000, cliffMonths: 0,  vestMonths: 0  },
  { name: 'team',      total: 200_000_000, cliffMonths: 12, vestMonths: 36 },
  { name: 'investors', total: 250_000_000, cliffMonths: 12, vestMonths: 24 },
  { name: 'treasury',  total: 270_000_000, cliffMonths: 0,  vestMonths: 48 },
  { name: 'rewards',   total: 200_000_000, cliffMonths: 0,  vestMonths: 60 }
];

function unlockedAt(a: Allocation, month: number): number {
  if (month < a.cliffMonths) return 0;
  if (a.vestMonths === 0) return a.total;
  const elapsed = Math.min(month - a.cliffMonths, a.vestMonths);
  return (a.total * elapsed) / a.vestMonths;
}

export function schedule(months: number, priceUsd: number) {
  const totalSupply = PLAN.reduce((s, a) => s + a.total, 0);
  const rows = [];
  let previous = 0;

  for (let m = 0; m <= months; m++) {
    const circulating = PLAN.reduce((s, a) => s + unlockedAt(a, m), 0);
    const newThisMonth = circulating - previous;
    previous = circulating;

    rows.push({
      month: m,
      circulating,
      floatPct: circulating / totalSupply,
      // Everything unlocking this month is potential supply at market.
      monthlyUnlockUsd: newThisMonth * priceUsd,
      fdvUsd: totalSupply * priceUsd
    });
  }

  // The cliff months are the ones worth putting in a calendar.
  const shocks = rows
    .filter(r => r.month > 0 && r.monthlyUnlockUsd > 3 * (rows[r.month - 1]?.monthlyUnlockUsd || 1))
    .map(r => r.month);

  return { rows, shocks, totalSupply };
}`
    }
  ],
  lab: 'govern',
  quiz: [
    { q: 'Why does reading voting power at a past snapshot block defeat a flash-loan governance attack?', options: ['Flash loans cannot borrow governance tokens', 'Weight comes from a balance that already existed before the transaction, so borrowed tokens carry none', 'Snapshots make voting free', 'The snapshot encrypts the balances'], answer: 1, why: 'A flash loan exists only within one transaction. Checkpointed weight at an earlier block cannot include it, so gaining weight requires holding the token across blocks — real capital and visible exposure.' },
    { q: 'A protocol has a 4% quorum, historic turnout of 5%, and a treasury worth twenty times the cost of acquiring 4% of supply. What is the honest description?', options: ['Well governed, since quorum is met regularly', 'Capture is profitable and the low turnout means the bar is a rounding error', 'Safe, because a timelock exists somewhere', 'Nothing can be concluded without an audit'], answer: 1, why: 'Governance security is the ratio of capture cost to payoff, adjusted for turnout. When the treasury is worth far more than the votes needed to move it, the design is a standing offer.' },
    { q: 'What does a vote-escrow system actually buy, and what re-liquefies it?', options: ['Sybil resistance; identity checks undo it', 'Alignment with the long term; bribe and lock markets let holders sell their votes anyway', 'Instant finality; reorgs undo it', 'Nothing at all'], answer: 1, why: 'Locking tokens for weight ties voters to the future. Markets that pay for those votes convert the commitment back into a per-vote income stream, which is exactly what the lock was meant to prevent.' },
    { q: 'Why is a guardian that can only cancel safer than one that can also execute?', options: ['It is not, they are equivalent', 'A cancel-only guardian can stop an attack but cannot itself become one; execution rights make it an unaccountable admin', 'Cancelling costs less gas', 'Executing requires a quorum anyway'], answer: 1, why: 'Restricting the guardian to vetoes bounds the worst case to inaction, which is recoverable. Execution rights recreate the centralised control the governance process was there to replace.' },
    { q: 'A DAO treasury holds 95% of its value in its own token. What is the flaw?', options: ['There is none if the token is liquid', 'Spending it requires selling into the price it is measured in, so the runway shrinks precisely when it is needed', 'Own-token treasuries pay no gas', 'It prevents governance attacks'], answer: 1, why: 'Self-denominated treasuries are reflexive: the value falls and the sale pressure rises together. Runway should be measured in months of expenses, with enough diversification to survive a drawdown.' }
  ],
  tasks: [
    'Use the lab to find the quorum and timelock at which capturing your protocol stops being profitable.',
    'Take a real token’s published unlock schedule and mark every cliff on a calendar with the dollar value at today’s price.',
    'Check one governance contract you rely on: does it read voting power from a snapshot block, and how long is the timelock?',
    'Write the treasury policy: target stable reserves, runway in months, and the rule for when contributors are not paid in token.'
  ],
  resources: [
    { type: 'docs', title: 'OpenZeppelin Governor documentation', url: 'https://docs.openzeppelin.com/contracts/5.x/governance' },
    { type: 'eip', title: 'ERC-5805: voting with delegation and checkpoints', url: 'https://eips.ethereum.org/EIPS/eip-5805' },
    { type: 'read', title: 'Vitalik Buterin — moving beyond coin voting governance', url: 'https://vitalik.eth.limo/general/2021/08/16/voting3.html' },
    { type: 'read', title: 'Vitalik Buterin — quadratic payments', url: 'https://vitalik.eth.limo/general/2019/12/07/quadratic.html' },
    { type: 'docs', title: 'Ethereum.org — DAOs', url: 'https://ethereum.org/en/dao/' }
  ]
});

L.push({
  id: 'chain-types', module: 13, num: 62,
  title: 'Public, Permissioned and No Chain At All',
  level: 'Intermediate', minutes: 55,
  summary: 'What changes when validators are known, when a signed database beats a blockchain, and how to answer the question honestly in front of stakeholders.',
  objectives: [
    'Explain what permissioning removes from a chain’s threat model and what it adds',
    'Apply a test that separates real shared-ledger problems from database problems',
    'Design the middle option: a signed, anchored log',
    'Handle the collision between immutability and data-protection law'
  ],
  body: `
<h3>What permissioning actually changes</h3>
<p>Take away open validator entry and one whole problem disappears: Sybil resistance. There is nothing to defend against with hashpower or stake, because you cannot join without an agreement. What remains is classical BFT among a known set — the consensus literature that predates Bitcoin by two decades.</p>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>Public permissionless</th><th>Permissioned / consortium</th><th>Private (one org)</th></tr></thead>
<tbody>
<tr><td>Who validates</td><td>Anyone with stake or hashpower</td><td>Named organisations under contract</td><td>You</td></tr>
<tr><td>Sybil resistance</td><td>Required — PoW or PoS</td><td>Not needed — identities are known</td><td>Not needed</td></tr>
<tr><td>Throughput</td><td>Limited by open participation</td><td>High — small, well-connected set</td><td>Whatever your hardware does</td></tr>
<tr><td>Censorship resistance</td><td>The point</td><td>None against the consortium itself</td><td>None</td></tr>
<tr><td>Failure mode</td><td>Fees, congestion, reorgs</td><td>Members collude, or the consortium dissolves</td><td>It is a database with extra latency</td></tr>
<tr><td>Honest use</td><td>Open value, adversarial users</td><td>Mutually distrusting firms sharing a workflow</td><td>Almost none</td></tr>
</tbody>
</table>
</div>
<p>The uncomfortable observation about the private column: a chain run by one organisation provides no property that organisation could not get from a database with append-only tables and signed writes, at a fraction of the cost. If the auditor is meant to trust it, the auditor is trusting that organisation either way.</p>

<h3>The test</h3>
<p>Four questions. A shared ledger is the right answer only when all four hold:</p>
<ol>
<li><strong>Multiple writers.</strong> More than one organisation writes state — not one writer with several readers.</li>
<li><strong>Mutual distrust.</strong> They will not accept each other’s database as the record, and no single one may hold the pen.</li>
<li><strong>No acceptable intermediary.</strong> There is no neutral party they would all accept, or the cost of one is too high.</li>
<li><strong>Shared state that must agree.</strong> The parties need one consistent view, not just their own copies reconciled later.</li>
</ol>
<p>Fail any one and something simpler wins. One writer means a database. An acceptable intermediary means a clearing house — which already exists in most regulated industries and is usually cheaper than a consortium. Parties who only need to reconcile occasionally need a shared schema and an API, not consensus.</p>
<div class="note warn"><span class="tag">Why the pilots died</span>The enterprise blockchain wave of 2016–2020 mostly failed on question 1 and question 3: one dominant participant wanted the ledger, the others were being asked to fund the infrastructure of a competitor, and the coordination cost of the consortium exceeded the cost of the intermediary it replaced. The technology worked. The governance did not — deciding who runs a node, who pays, and who resolves disputes is the actual project.</div>

<h3>The middle option nobody pitches</h3>
<p>Between "blockchain" and "spreadsheet" is a design that solves most real-world integrity requirements: an <strong>append-only signed log, anchored publicly</strong>. Each participant signs its entries; the log is a hash chain (lesson 5); a Merkle root is published periodically to a public chain (lesson 4). Anyone can then verify that history was not rewritten, and nobody has to run consensus, agree a validator set, or migrate their systems.</p>
<p>What you keep: tamper evidence, third-party verifiability, cheap operations, ordinary databases and backups. What you give up: shared write ordering — the log has an operator, and a public chain proves what they published, not that they published everything. Where that gap is unacceptable you have found a genuine consensus requirement; where it is acceptable you just saved a year.</p>

<h3>Immutability meets the law</h3>
<div class="note danger"><span class="tag">Do not put personal data on a public chain</span>Erasure obligations under regimes such as the GDPR are incompatible with a ledger that cannot delete, and encryption is not erasure — a key that leaks, or a cipher that ages, retroactively publishes the data. Even a plain hash of a low-entropy identifier (a name, a national ID, an email) is brute-forceable, so it is still personal data in practice. Keep plaintext in a system you can erase, commit to salted hashes only, and destroy the salt when you destroy the record. Get this reviewed before launch, not after.</div>
<p>Permissioned platforms exist partly for this reason: they let regulated participants keep the data inside a controlled boundary while still sharing a workflow. That is a legitimate use — as long as the design is honest that its security comes from the contracts and the operators, not from a consensus algorithm defending against strangers.</p>

<h3>Saying it in front of stakeholders</h3>
<p>You will be asked for a blockchain by people who have already announced one. The professional answer is not a lecture on decentralisation; it is the four questions, answered out loud, with the alternative priced. "Two of these four do not hold, so here is the signed anchored log, it costs a fifth as much, delivers the audit property you asked for, and can migrate to a shared ledger later if the third writer ever appears." That sentence has saved more projects than any protocol choice.</p>
`,
  code: [
    {
      lang: 'ts', file: 'decide.ts',
      caption: 'The test as code. It short-circuits deliberately: the first failed condition is the answer, and further scoring would only obscure it.',
      src: `type Situation = {
  writingOrganisations: number;
  mutualDistrust: boolean;
  acceptableIntermediary: boolean;
  needsSharedOrdering: boolean;
  publicParticipants: boolean;     // strangers can join and transact
  personalData: boolean;
  writesPerSecond: number;
};

type Verdict = { answer: string; because: string; caveat?: string };

export function decide(s: Situation): Verdict {
  if (s.writingOrganisations < 2) {
    return {
      answer: 'Database with an append-only signed log',
      because: 'A single writer gains nothing from consensus. Signed, hash-chained entries give the audit property at a fraction of the cost.'
    };
  }
  if (!s.mutualDistrust) {
    return {
      answer: 'Shared database or API with a shared schema',
      because: 'Parties who accept each other\\'s records do not need Byzantine fault tolerance; they need integration.'
    };
  }
  if (s.acceptableIntermediary) {
    return {
      answer: 'Use the intermediary, anchor its log publicly',
      because: 'A neutral party everyone already accepts is cheaper than a consortium. Public anchoring keeps it honest without new infrastructure.'
    };
  }
  if (!s.needsSharedOrdering) {
    return {
      answer: 'Independent logs, cross-anchored',
      because: 'Each party keeps its own log and publishes Merkle roots. Tamper evidence without agreeing on a global order.'
    };
  }

  // All four conditions hold. Now, and only now, choose which kind of chain.
  if (s.publicParticipants) {
    return {
      answer: 'Public chain',
      because: 'Open participation and adversarial users are exactly what permissionless consensus is for.',
      caveat: s.personalData
        ? 'Personal data cannot go on chain. Store plaintext off chain and commit to salted hashes only.'
        : undefined
    };
  }
  return {
    answer: 'Permissioned consortium chain',
    because: 'Known writers who distrust each other and need one ordering. BFT among named validators, no Sybil resistance required.',
    caveat: s.writesPerSecond > 3000
      ? 'At this write rate, confirm the consortium is genuinely sharing state rather than using the chain as a message bus.'
      : 'The hard part is governance: who runs nodes, who pays, who resolves disputes. Settle that before the technology.'
  };
}`
    },
    {
      lang: 'ts', file: 'anchored-log.ts',
      caption: 'The middle option in about forty lines: a hash-chained signed log whose root gets published to a public chain periodically.',
      src: `import { createHash, sign, verify, KeyObject } from 'node:crypto';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

type Entry = {
  seq: number;
  prev: string;        // hash of the previous entry — this is the chain
  payloadHash: string; // hash of the record, never the record itself
  author: string;
  at: string;          // ISO timestamp, from the writer
  sig: string;         // author's signature over the entry hash
};

export class AnchoredLog {
  private entries: Entry[] = [];

  private hashOf(e: Omit<Entry, 'sig'>) {
    return sha256([e.seq, e.prev, e.payloadHash, e.author, e.at].join('|'));
  }

  append(payload: string, author: string, at: string, key: KeyObject): Entry {
    const seq = this.entries.length;
    const prev = seq === 0 ? '0'.repeat(64) : this.hashOf(this.entries[seq - 1]);
    const body = { seq, prev, payloadHash: sha256(payload), author, at };
    const sig = sign(null, Buffer.from(this.hashOf(body)), key).toString('hex');
    const entry = { ...body, sig };
    this.entries.push(entry);
    return entry;
  }

  /// Any auditor can run this. A rewritten entry breaks every hash after it,
  /// exactly as in lesson 5 — no consensus, no validators, no token.
  verify(keys: Record<string, KeyObject>): { ok: boolean; brokeAt?: number } {
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const expectedPrev = i === 0 ? '0'.repeat(64) : this.hashOf(this.entries[i - 1]);
      if (e.prev !== expectedPrev) return { ok: false, brokeAt: i };
      const { sig, ...body } = e;
      if (!verify(null, Buffer.from(this.hashOf(body)), keys[e.author], Buffer.from(sig, 'hex'))) {
        return { ok: false, brokeAt: i };
      }
    }
    return { ok: true };
  }

  /// Publish this to a public chain on a schedule. It costs one small
  /// transaction and it is what makes "we did not rewrite history" checkable
  /// by someone who does not trust the operator.
  head(): string {
    return this.entries.length === 0
      ? '0'.repeat(64)
      : this.hashOf(this.entries[this.entries.length - 1]);
  }
}`
    }
  ],
  lab: 'chaintype',
  quiz: [
    { q: 'What does permissioning remove from the design problem?', options: ['The need for cryptographic signatures', 'The need for Sybil resistance, because validators are known parties under agreement', 'The need for fault tolerance', 'The need for governance'], answer: 1, why: 'Open participation is what forces proof of work or stake. With named validators the problem reduces to classical BFT — and governance becomes harder, not easier.' },
    { q: 'A single company wants a private blockchain so auditors can trust its records. What actually helps?', options: ['A private chain with one validator', 'An append-only signed log with hashes anchored to a public chain', 'A consortium with the company’s subsidiaries as validators', 'Nothing can make records auditable'], answer: 1, why: 'One writer means consensus adds no property. A hash-chained signed log with public anchoring gives tamper evidence a third party can verify, cheaply.' },
    { q: 'Which condition, if it fails, most often kills an enterprise consortium?', options: ['Insufficient throughput', 'There is an intermediary all parties already accept, so the consortium is more expensive than the status quo', 'Lack of a token', 'Absence of smart contracts'], answer: 1, why: 'If a neutral party already exists and is trusted, replacing it with a consortium adds coordination cost without removing trust. Most failed pilots died on this and on having one dominant writer.' },
    { q: 'Why is publishing a hash of a customer’s email address on a public chain still a data-protection problem?', options: ['Hashes are reversible by design', 'The input space is small enough to brute-force, so the hash identifies the person in practice', 'Public chains reject hashes', 'It is not a problem'], answer: 1, why: 'Low-entropy inputs make an unsalted hash a lookup key. Use a secret salt, keep plaintext in an erasable system, and destroy the salt when erasing the record.' }
  ],
  tasks: [
    'Run the lab against a project you have actually been asked to build on a chain, and record which condition fails first.',
    'Write the one-paragraph answer you would give a stakeholder who has already announced a blockchain, including the priced alternative.',
    'Implement a hash-chained signed log for one internal record type and publish its root somewhere public once a day.',
    'Review any system you run that puts identifiers on chain and check whether those identifiers are brute-forceable.'
  ],
  resources: [
    { type: 'paper', title: 'Practical Byzantine Fault Tolerance (Castro & Liskov)', url: 'https://pmg.csail.mit.edu/papers/osdi99.pdf' },
    { type: 'docs', title: 'Hyperledger Besu — permissioned network documentation', url: 'https://besu.hyperledger.org/private-networks' },
    { type: 'docs', title: 'Hyperledger Fabric — channels and private data', url: 'https://hyperledger-fabric.readthedocs.io/en/latest/whatis.html' },
    { type: 'read', title: 'Certificate Transparency — verifiable append-only logs', url: 'https://certificate.transparency.dev/howctworks/' },
    { type: 'read', title: 'Ethereum.org — private and consortium networks', url: 'https://ethereum.org/en/developers/docs/networks/' }
  ]
});

})(window.ROADMAP.lessons);
