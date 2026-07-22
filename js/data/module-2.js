/* Module 2 — Bitcoin & Consensus (lessons 6-9) */
(function (L) {

L.push({
  id: 'l06', module: 2, num: 6,
  title: 'Bitcoin: UTXOs and Transactions',
  level: 'Intermediate', minutes: 65,
  summary: 'Bitcoin has no balances. It has unspent outputs, coin selection, change addresses and a tiny stack language that authorises spending.',
  objectives: [
    'Explain the UTXO model and contrast it with the account model',
    'Trace a transaction: inputs, outputs, change, fee',
    'Read a P2PKH locking and unlocking script',
    'Compute a fee rate in sat/vB and explain why UTXO consolidation matters'
  ],
  body: `
<h3>There are no accounts</h3>
<p>Bitcoin's ledger is a set of <strong>unspent transaction outputs</strong> (UTXOs). Each UTXO is a discrete chunk of value locked by a condition. Your "balance" is just the sum of the UTXOs your wallet can unlock — the number exists in your wallet, never on the chain.</p>
<p>Spending destroys whole UTXOs and creates new ones. There is no partial spend, exactly like cash: to pay 3 BTC with a 5 BTC note, you consume the 5, send 3 to the recipient and 1.9999 back to yourself as <strong>change</strong>. The missing 0.0001 is the fee, claimed by the miner.</p>

<div class="note">
  <span class="tag">The fee is implicit</span>
  <p>fee = sum(inputs) − sum(outputs). There is no fee field. Forget a change output and you tip the miner your entire balance — this has happened for real, more than once.</p>
</div>

<h3>UTXO vs account model</h3>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>UTXO (Bitcoin, Cardano)</th><th>Account (Ethereum, Solana)</th></tr></thead>
<tbody>
<tr><td>State</td><td>Set of unspent outputs</td><td>Map address → balance, nonce, code, storage</td></tr>
<tr><td>Replay protection</td><td>An output can only be spent once, by construction</td><td>Explicit per-account nonce</td></tr>
<tr><td>Parallelism</td><td>Natural — disjoint UTXOs never conflict</td><td>Hard — transactions touching the same account must serialise</td></tr>
<tr><td>Privacy</td><td>Better: new address per output is the norm</td><td>Worse: an address accumulates a full history</td></tr>
<tr><td>Smart contracts</td><td>Awkward — no persistent shared state</td><td>Natural — contracts are long-lived accounts</td></tr>
<tr><td>Wallet complexity</td><td>High: coin selection, change management</td><td>Low: one balance</td></tr>
</tbody>
</table>
</div>

<h3>Anatomy of a transaction</h3>
<ul>
  <li><strong>Inputs</strong>: each references a previous output by <code>(txid, vout)</code> and supplies a <em>witness</em> / scriptSig that satisfies its lock.</li>
  <li><strong>Outputs</strong>: each carries an amount in satoshis (1 BTC = 10<sup>8</sup> sat) and a <em>scriptPubKey</em> locking condition.</li>
  <li><strong>Locktime / sequence</strong>: earliest time or height at which the transaction is valid; also drives replace-by-fee and relative timelocks.</li>
</ul>

<h3>Script: a deliberately limited language</h3>
<p>Bitcoin Script is stack-based, has no loops, and is not Turing complete — on purpose. Validation must terminate in bounded time. The classic Pay-to-Public-Key-Hash pattern:</p>
<ul>
  <li>Lock: <code>OP_DUP OP_HASH160 &lt;pubKeyHash&gt; OP_EQUALVERIFY OP_CHECKSIG</code></li>
  <li>Unlock: <code>&lt;signature&gt; &lt;publicKey&gt;</code></li>
</ul>
<p>The unlocking script pushes signature and public key; the locking script hashes the key, compares to the committed hash, then verifies the signature over the transaction. If the stack ends with a single true value, the input is authorised.</p>
<p>Modern outputs are usually SegWit (<code>P2WPKH</code>, cheaper because witness data is discounted) or Taproot (<code>P2TR</code>, where a key-path spend looks identical to any other and complex scripts stay hidden unless used).</p>

<h3>Fees, weight and vbytes</h3>
<p>Miners maximise fee per unit of block space, not fee per transaction. Space is measured in <strong>virtual bytes</strong>: SegWit witness data counts a quarter. A wallet paying 20 sat/vB on a 140 vB transaction pays 2,800 sat regardless of whether it moves 0.01 or 100 BTC.</p>
<p>This makes UTXO hygiene financially real. Each input adds roughly 68 vB; each output roughly 31 vB. A wallet holding 200 tiny UTXOs from faucet payouts may cost more to spend than it contains — those are <em>dust</em>, economically unspendable when fees rise.</p>

<h3>Coin selection</h3>
<p>Choosing which UTXOs to spend is an optimisation problem with competing goals: minimise fee (fewer, larger inputs), avoid creating dust change, preserve privacy (avoid linking unrelated addresses) and consolidate when fees are low. Bitcoin Core uses Branch and Bound to find a <em>changeless</em> match when possible — no change output means smaller transaction and no lingering dust. The lab lets you compare strategies on the same wallet.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'utxo.js',
      caption: 'Coin selection and fee computation. Note that adding an input costs fee, which may require adding another input — the classic recursive trap.',
      src: `const IN_VB = 68, OUT_VB = 31, BASE_VB = 11;

function estimateVBytes(nIn, nOut) {
  return BASE_VB + nIn * IN_VB + nOut * OUT_VB;
}

// Greedy "largest first": cheap, low fee, but destroys privacy and
// merges unrelated address histories.
function selectLargestFirst(utxos, targetSat, feeRate) {
  const pool = [...utxos].sort((a, b) => b.value - a.value);
  const chosen = [];
  let total = 0;

  for (const u of pool) {
    chosen.push(u);
    total += u.value;
    // fee depends on how many inputs we ended up with -> recompute each round
    const feeWithChange = estimateVBytes(chosen.length, 2) * feeRate;
    if (total >= targetSat + feeWithChange) {
      const change = total - targetSat - feeWithChange;
      // dust rule: change below ~546 sat costs more to spend than it is worth
      if (change < 546) {
        const feeNoChange = estimateVBytes(chosen.length, 1) * feeRate;
        return { chosen, change: 0, fee: total - targetSat, wasted: total - targetSat - feeNoChange };
      }
      return { chosen, change, fee: feeWithChange, wasted: 0 };
    }
  }
  return { error: 'insufficient funds' };
}`
    },
    {
      lang: 'text', file: 'tx.decoded',
      caption: 'A decoded transaction. Two inputs consumed, two outputs created, and the fee is whatever is left over.',
      src: `txid: 9f2c...41ab            size: 226 B   vsize: 141 vB   fee rate: 21 sat/vB

INPUTS  (destroyed)
  [0] 3a7f...c012:1     0.04000000 BTC   witness: <sig> <pubkey>
  [1] c18e...9d55:0     0.01500000 BTC   witness: <sig> <pubkey>
                       -------------
                        0.05500000 BTC

OUTPUTS (created)
  [0] bc1q...recipient  0.04800000 BTC   P2WPKH
  [1] bc1q...change     0.00697039 BTC   P2WPKH   <- back to sender

FEE = 0.05500000 - 0.05497039 = 0.00002961 BTC  (2961 sat / 141 vB = 21 sat/vB)`
    }
  ],
  lab: 'utxo',
  quiz: [
    {
      q: 'A wallet shows 2.5 BTC. What does that number represent on chain?',
      options: [
        'A balance field in the sender\\u2019s account',
        'The sum of all unspent outputs whose locking scripts the wallet can satisfy',
        'The total of all transactions ever received',
        'A cached value from the block explorer'
      ],
      answer: 1,
      why: 'Bitcoin stores no balances. The wallet scans the UTXO set for outputs it controls and sums them. Two wallets with the same seed will always agree; a wallet that misses an address will under-report.'
    },
    {
      q: 'Why does a transaction with 40 small inputs cost far more than one with 2 large inputs, even moving the same amount?',
      options: [
        'Miners charge per BTC moved',
        'Fees are paid per virtual byte, and each input adds ~68 vB',
        'Small UTXOs require more signatures per input',
        'The protocol imposes a penalty on small amounts'
      ],
      answer: 1,
      why: 'Block space is the scarce good. 40 inputs is roughly 2,720 vB of inputs alone versus 136 vB — about 20x the fee at the same fee rate. Consolidating UTXOs during low-fee periods is real money saved.'
    },
    {
      q: 'What happens if you build a transaction with 5 BTC of inputs and a single 1 BTC output?',
      options: [
        'The remaining 4 BTC returns automatically',
        'The transaction is rejected as malformed',
        'The 4 BTC becomes the fee and goes to the miner, irreversibly',
        'The 4 BTC is burned'
      ],
      answer: 2,
      why: 'Fee is implicit: inputs minus outputs. Omitting the change output is a valid transaction that tips the miner everything. Libraries handle change automatically for exactly this reason.'
    }
  ],
  tasks: [
    'In the lab, try to pay an amount that forces dust change. Compare the "wasted" value across the three selection strategies.',
    'Decode a real transaction on a Bitcoin explorer. Identify which output is change (hint: it usually matches the input address type and script version).',
    'Calculate the fee for a 3-input, 2-output SegWit transaction at 45 sat/vB.',
    'Explain in writing why the UTXO model parallelises better than the account model, and what Ethereum gains in exchange.'
  ],
  resources: [
    { type: 'docs', title: 'Bitcoin developer reference — transactions', url: 'https://developer.bitcoin.org/reference/transactions.html' },
    { type: 'book', title: 'Mastering Bitcoin, 3rd ed. (free online)', url: 'https://github.com/bitcoinbook/bitcoinbook' },
    { type: 'read', title: 'Bitcoin Core coin selection (Branch and Bound)', url: 'https://bitcoincore.org/en/2016/06/28/coin-selection/' }
  ]
});

L.push({
  id: 'l07', module: 2, num: 7,
  title: 'Proof of Work and Mining',
  level: 'Intermediate', minutes: 70,
  summary: 'Mining is a lottery where tickets cost electricity. Understand targets, difficulty adjustment, variance and the real economics.',
  objectives: [
    'Explain the mining puzzle precisely in terms of targets, not "solving math"',
    'Compute expected attempts for a given difficulty',
    'Describe difficulty retargeting and why it stabilises block time',
    'Reason about mining economics, pools and variance'
  ],
  body: `
<h3>The puzzle</h3>
<p>A miner assembles a candidate block and repeatedly hashes its 80-byte header, changing the <code>nonce</code> field each time. The block is valid when:</p>
<p style="text-align:center"><code>SHA256(SHA256(header)) &lt; target</code></p>
<p>The target is a 256-bit threshold. A lower target means fewer valid hashes, so more attempts. Difficulty is just a human-friendly ratio: <code>difficulty = max_target / current_target</code>.</p>
<p>Nothing clever is being computed. There is no shortcut, no partial progress, no learning from failures. Every attempt is an independent Bernoulli trial — which is precisely the point: work cannot be faked, delegated or accelerated except by doing more hashing.</p>

<h3>Expected work</h3>
<p>If a valid hash needs <em>k</em> leading zero <em>bits</em>, the probability per attempt is 2<sup>−k</sup>, so the expected number of attempts is 2<sup>k</sup>. Each extra hex zero (4 bits) multiplies expected work by 16.</p>
<div class="table-scroll">
<table>
<thead><tr><th>Leading hex zeros</th><th>Expected hashes</th><th>Time at 1 MH/s (a browser)</th></tr></thead>
<tbody>
<tr><td>3</td><td>4,096</td><td>instant</td></tr>
<tr><td>5</td><td>1.05 million</td><td>~1 second</td></tr>
<tr><td>7</td><td>268 million</td><td>~4.5 minutes</td></tr>
<tr><td>19 (Bitcoin, 2024-ish)</td><td>~10<sup>23</sup></td><td>~3 billion years</td></tr>
</tbody>
</table>
</div>
<p>Bitcoin's network runs at roughly 6 × 10<sup>20</sup> hashes per second, which is how a puzzle needing 10<sup>23</sup> attempts still resolves every ten minutes.</p>

<h3>Difficulty retargeting</h3>
<p>Bitcoin recalculates the target every 2,016 blocks (about two weeks):</p>
<p><code>newTarget = oldTarget × (actualTimeFor2016Blocks / 1,209,600 seconds)</code>, clamped to a 4x change in either direction.</p>
<p>If blocks came too fast, actual time is small, the target shrinks and mining gets harder. This feedback loop is what pins average block time to 10 minutes across a hashrate that has grown by 14 orders of magnitude since 2009.</p>

<div class="note">
  <span class="tag">Variance is brutal</span>
  <p>Block discovery is a Poisson process. With 10-minute expected spacing, roughly 37% of gaps exceed 10 minutes and gaps over an hour happen several times a year. A solo miner with 0.01% of hashrate finds a block on average every ~70 days but might wait a year. That variance is exactly why mining pools exist: they pay steady shares of a pooled reward instead of a jackpot.</p>
</div>

<h3>Mining economics</h3>
<p>Revenue per block = subsidy + fees. The subsidy halves every 210,000 blocks (~4 years): 50 → 25 → 12.5 → 6.25 → 3.125 BTC. Costs are electricity, hardware depreciation and hosting.</p>
<p>Equilibrium: miners enter while revenue exceeds marginal cost, driving hashrate up, which raises difficulty, which lowers revenue per miner. Profit margins compress toward the cost of the cheapest available electricity. This is why mining concentrates near stranded hydro, flared gas and curtailed wind.</p>

<h3>The security argument, stated carefully</h3>
<p>Rewriting <em>n</em> confirmed blocks requires out-hashing the honest network from <em>n</em> blocks back. With attacker share <em>q</em> &lt; 0.5, success probability decays roughly geometrically in <em>n</em>. Six confirmations is a convention, not a law: for a coffee, zero confirmations plus a mempool check is fine; for a $50M settlement, 100 confirmations is cheap insurance.</p>

<div class="note warn">
  <span class="tag">Selfish mining</span>
  <p>Eyal and Sirer (2013) showed a miner with well under 50% can gain by withholding blocks and releasing them strategically, forcing honest miners to waste work. The naive "you need 51%" threshold is an upper bound, not a safety line.</p>
</div>

<h3>PoW's cost, honestly</h3>
<p>Energy use is the security budget, not waste in the accounting sense — but it is real. Ethereum's move to proof of stake in September 2022 cut its energy consumption by roughly 99.95%, which is the strongest empirical argument that comparable security can be bought differently. Lesson 8 covers what that trade buys and what it costs.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'mine.js',
      caption: 'The entire mining algorithm. Everything else in a real miner is optimisation: ASICs, block templates, and pool coordination.',
      src: `function mine(header, difficultyBits) {
  const target = (1n << BigInt(256 - difficultyBits));   // hash must be below this
  let nonce = 0;

  while (true) {
    const h = CL.dsha256Hex(header + nonce);
    if (BigInt('0x' + h) < target) {
      return { nonce, hash: h, attempts: nonce + 1 };
    }
    nonce++;
  }
}

// Probability of success per attempt is 2^-difficultyBits, so:
const expectedAttempts = 2 ** difficultyBits;

// A miner with fraction q of network hashrate wins each block with
// probability q. Chance of reversing n confirmations (Nakamoto section 11,
// simplified for q < 0.5):
function reorgRisk(q, n) {
  return Math.pow(q / (1 - q), n);
}
reorgRisk(0.30, 6);   // ~0.00058  -> 0.06%
reorgRisk(0.45, 6);   // ~0.30     -> 30%   (six confirmations is NOT magic)`
    }
  ],
  lab: 'mine',
  quiz: [
    {
      q: 'What are miners actually computing?',
      options: [
        'Complex mathematical proofs that benefit science',
        'Repeated hashes of a block header with a changing nonce until one falls below a target',
        'Verification of all past transactions',
        'Encryption of the block contents'
      ],
      answer: 1,
      why: 'It is a brute-force search with no shortcuts and no partial credit. The uselessness of the computation is a feature: the only way to produce more solutions is to spend more energy, which is what makes the work an unforgeable cost.'
    },
    {
      q: 'Difficulty doubles. What happens to expected time-to-block for a miner whose hashrate is unchanged?',
      options: ['Halves', 'Unchanged', 'Doubles', 'Quadruples'],
      answer: 2,
      why: 'Expected attempts scale linearly with difficulty. Same hashrate, twice the attempts needed, twice the wait — until the network-wide retarget restores the 10-minute average for the network as a whole.'
    },
    {
      q: 'An attacker controls 45% of hashrate. Are 6 confirmations safe?',
      options: [
        'Yes, 6 confirmations is always safe',
        'No — at q=0.45 the chance of reversing 6 blocks is roughly 30%',
        'Yes, because they lack 51%',
        'It depends only on transaction value'
      ],
      answer: 1,
      why: 'Security is probabilistic and degrades sharply as q approaches 0.5. Below 50% an attack is not guaranteed to fail; it is merely expected to lose money on average. Confirmation counts should scale with value at risk.'
    }
  ],
  tasks: [
    'In the lab, mine at difficulty 4 five times and record the attempt counts. Compare their spread to the expected value of 65,536 — this is Poisson variance in miniature.',
    'Compute how many hashes your browser does per second, then how many years it would need for one real Bitcoin block.',
    'Using reorgRisk(q, n), find the number of confirmations that puts a 35% attacker below 0.1% success.',
    'Research one halving event and describe what happened to hashrate in the following month.'
  ],
  resources: [
    { type: 'paper', title: 'Majority is not Enough: Bitcoin Mining is Vulnerable (Eyal & Sirer)', url: 'https://arxiv.org/abs/1311.0243' },
    { type: 'docs', title: 'Bitcoin mining and difficulty', url: 'https://developer.bitcoin.org/devguide/mining.html' },
    { type: 'data', title: 'Live hashrate and difficulty charts', url: 'https://mempool.space/graphs/mining/hashrate-difficulty' }
  ]
});

L.push({
  id: 'l08', module: 2, num: 8,
  title: 'Proof of Stake and the Consensus Zoo',
  level: 'Intermediate', minutes: 70,
  summary: 'Replace energy with collateral. Understand Ethereum\'s Gasper, slashing, finality gadgets, and how BFT protocols differ from Nakamoto consensus.',
  objectives: [
    'Explain how stake replaces hashpower as the Sybil-resistance mechanism',
    'Describe slashing and why it makes attacks cost more than PoW attacks',
    'Distinguish probabilistic finality from economic finality',
    'Compare Nakamoto, Tendermint-style BFT and Ethereum\'s hybrid'
  ],
  body: `
<h3>The substitution</h3>
<p>Sybil resistance requires something scarce. PoW uses energy, which is <em>external</em> — burned outside the system and unrecoverable. PoS uses staked capital, which is <em>internal</em> — locked inside the system and destroyable by the protocol itself.</p>
<p>That internality is the whole design: in PoW, an attacker who fails simply keeps their hardware and tries again. In PoS, an attacker who is caught equivocating has their stake burned. Attack cost changes from <em>rental</em> to <em>destruction</em>.</p>

<h3>Ethereum's design (Gasper = LMD-GHOST + Casper FFG)</h3>
<ul>
  <li><strong>Validators</strong> deposit 32 ETH (or more, post-EIP-7251) into the deposit contract.</li>
  <li><strong>Slots</strong> are 12 seconds. One validator is pseudo-randomly chosen as proposer per slot; a committee attests.</li>
  <li><strong>Epochs</strong> are 32 slots (6.4 minutes). Every validator attests exactly once per epoch.</li>
  <li><strong>LMD-GHOST</strong> is the fork-choice rule: follow the subtree with the greatest accumulated attestation weight, using each validator's latest message.</li>
  <li><strong>Casper FFG</strong> is the finality gadget: when two-thirds of stake justifies two consecutive epoch checkpoints, the earlier is <strong>finalised</strong>.</li>
</ul>
<p>Practical consequence: a transaction is finalised in roughly 13 minutes, and reverting it requires destroying at least one third of all staked ETH — currently tens of billions of dollars. That is a qualitatively different guarantee from "six confirmations".</p>

<h3>Slashing: the two cardinal sins</h3>
<ol>
  <li><strong>Double proposal</strong> — signing two different blocks for the same slot.</li>
  <li><strong>Surround / double vote</strong> — casting attestations that contradict each other about history.</li>
</ol>
<p>Both are objectively detectable from signed messages alone: anyone can submit the two conflicting signatures as proof. Penalty is an immediate burn plus a <em>correlation penalty</em> that scales with how many validators were slashed nearby in time. Slashing alone is minor; slashing together with a third of the network is catastrophic. This deliberately punishes coordinated attacks far harder than an operator's misconfigured failover.</p>

<div class="note warn">
  <span class="tag">Inactivity leak</span>
  <p>If the chain cannot finalise because more than a third of validators are offline, offline validators bleed stake until the remaining online set exceeds two thirds and finality resumes. It means the chain recovers from a large-scale outage without human intervention — at the cost of the absent validators.</p>
</div>

<h3>Nakamoto vs BFT vs hybrid</h3>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>Nakamoto (PoW)</th><th>Tendermint BFT</th><th>Ethereum (Gasper)</th></tr></thead>
<tbody>
<tr><td>Validator set</td><td>Open, anonymous</td><td>Known, bounded (~100-200)</td><td>Open, ~1M validators</td></tr>
<tr><td>Finality</td><td>Probabilistic, never absolute</td><td>Instant, single block</td><td>Economic, ~2 epochs</td></tr>
<tr><td>Liveness under partition</td><td>Keeps producing, may fork</td><td>Halts until quorum returns</td><td>Keeps producing, finality pauses</td></tr>
<tr><td>Message complexity</td><td>O(n) gossip</td><td>O(n²) voting</td><td>O(n) with BLS aggregation</td></tr>
<tr><td>CAP preference</td><td>Availability</td><td>Consistency</td><td>Availability, with consistency gadget</td></tr>
</tbody>
</table>
</div>
<p>Tendermint chains never fork but stop cold if a third of validators go offline. Bitcoin never stops but can reorganise. Ethereum keeps building optimistically and layers finality on top — a deliberate middle path.</p>

<h3>Objections to PoS, and the responses</h3>
<ul>
  <li><strong>"Nothing at stake"</strong> — validators could vote on every fork for free. Answer: slashing makes equivocation expensive; this was solved in 2014 by design, not by hope.</li>
  <li><strong>"Rich get richer"</strong> — rewards are proportional to stake, so relative shares stay constant, not compounding advantage. Real centralisation pressure comes from liquid staking providers and MEV economies of scale, not from the reward curve.</li>
  <li><strong>"Weak subjectivity"</strong> — a node syncing from genesis after being offline for months cannot distinguish the real chain from a fake built by old validators whose stake has since been withdrawn. Answer: bootstrap from a recent trusted checkpoint. This is a genuine, acknowledged difference from PoW.</li>
</ul>

<h3>Other mechanisms worth knowing</h3>
<ul>
  <li><strong>DPoS</strong> (EOS, Tron): token holders elect a small validator set. Fast, notably more centralised.</li>
  <li><strong>Proof of History</strong> (Solana): a verifiable delay function orders events before consensus, enabling very high throughput with tighter hardware requirements.</li>
  <li><strong>Proof of Space/Time</strong> (Chia): storage instead of computation.</li>
  <li><strong>Proof of Authority</strong>: identified validators; suitable only for consortium or test networks.</li>
</ul>
`,
  code: [
    {
      lang: 'javascript', file: 'stake-selection.js',
      caption: 'Stake-weighted proposer selection with a seeded RNG. Real implementations use RANDAO plus VDFs so no participant can bias the outcome.',
      src: `// Stake-weighted random selection: probability of proposing == share of stake
function selectProposer(validators, seedHex) {
  const total = validators.reduce((s, v) => s + v.stake, 0);
  // RANDAO in practice: a mix of every proposer's revealed hash contribution
  const draw = Number(BigInt('0x' + seedHex.slice(0, 12)) % BigInt(total));

  let acc = 0;
  for (const v of validators) {
    acc += v.stake;
    if (draw < acc) return v;
  }
}

// Casper FFG finality: 2/3 of *stake*, not 2/3 of validators
function isJustified(attestations, totalStake) {
  const voted = attestations.reduce((s, a) => s + a.stake, 0);
  return voted * 3 >= totalStake * 2;
}

// Correlation penalty: burn scales with how much stake was slashed together
function correlationPenalty(ownStake, slashedStake, totalStake) {
  const proportional = Math.min(1, (3 * slashedStake) / totalStake);
  return ownStake * proportional;    // one lone validator loses ~1%,
}                                    // a coordinated third loses everything`
    }
  ],
  lab: 'consensus',
  quiz: [
    {
      q: 'Why is a failed PoS attack more costly to the attacker than a failed PoW attack?',
      options: [
        'PoS requires more electricity',
        'PoW hardware retains value after a failed attack, while slashed stake is destroyed by the protocol',
        'PoS attacks are illegal',
        'They cost the same'
      ],
      answer: 1,
      why: 'PoW attack cost is rental — miners keep the hardware and can retry or resell. PoS attack cost is confiscation: provable equivocation burns the stake. The correlation penalty makes coordinated attacks approach a total loss.'
    },
    {
      q: 'Ethereum finalises a block. What exactly does that guarantee?',
      options: [
        'The block can never be reverted under any circumstances',
        'Reverting it requires at least one third of all staked ETH to be slashed',
        'The block has 6 confirmations',
        'All nodes have downloaded it'
      ],
      answer: 1,
      why: 'This is *economic* finality. Reversion is not impossible, it is priced — currently in the tens of billions of dollars, and the attacker loses the capital whether or not they succeed.'
    },
    {
      q: 'A network partition takes 40% of validators offline. What happens on a Tendermint chain vs Ethereum?',
      options: [
        'Both halt',
        'Both continue normally',
        'Tendermint halts (no 2/3 quorum); Ethereum keeps producing blocks but stops finalising and starts the inactivity leak',
        'Tendermint forks; Ethereum halts'
      ],
      answer: 2,
      why: 'A classic CAP trade-off. Tendermint chooses consistency and stops. Ethereum chooses availability, keeps the chain live, and uses the inactivity leak to eventually restore a 2/3 supermajority among the validators that are actually online.'
    }
  ],
  tasks: [
    'In the lab, set one validator to 40% stake and run 1,000 rounds. Confirm the observed proposal share converges to the stake share.',
    'Compute the cost to acquire 34% of staked ETH at current prices, and compare with the cost of 34% of Bitcoin hashrate for one hour.',
    'Explain weak subjectivity to a colleague in three sentences, including what a checkpoint is and why it is not "just trust".',
    'Read the Casper FFG paper abstract and write down the two slashing conditions in your own words.'
  ],
  resources: [
    { type: 'paper', title: 'Casper the Friendly Finality Gadget', url: 'https://arxiv.org/abs/1710.09437' },
    { type: 'docs', title: 'Ethereum proof-of-stake documentation', url: 'https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/' },
    { type: 'read', title: 'Annotated Ethereum consensus specs', url: 'https://eth2book.info/' }
  ]
});

L.push({
  id: 'l09', module: 2, num: 9,
  title: 'Forks, Reorgs and Attacks',
  level: 'Intermediate', minutes: 55,
  summary: 'Chains split constantly — by accident, by upgrade and by attack. Learn to tell the three apart and to reason about confirmation depth.',
  objectives: [
    'Distinguish accidental forks, soft forks, hard forks and malicious reorgs',
    'Explain the fork-choice rule and why heaviest, not longest, is correct',
    'Analyse a 51% double-spend end to end',
    'Set confirmation policy based on value at risk'
  ],
  body: `
<h3>Four things called "fork"</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Type</th><th>Cause</th><th>Resolution</th></tr></thead>
<tbody>
<tr><td>Accidental fork</td><td>Two valid blocks found near-simultaneously; propagation delay</td><td>Self-heals in 1-2 blocks via fork choice</td></tr>
<tr><td>Soft fork</td><td>Rule tightening — old nodes still accept new blocks</td><td>Backward compatible; needs miner/validator majority (SegWit, Taproot)</td></tr>
<tr><td>Hard fork</td><td>Rule loosening or changing — old nodes reject new blocks</td><td>Everyone must upgrade, or the chain splits permanently (ETH/ETC, BTC/BCH)</td></tr>
<tr><td>Malicious reorg</td><td>An attacker builds a heavier competing branch in secret</td><td>Prevented economically, not technically</td></tr>
</tbody>
</table>
</div>

<h3>Fork choice: heaviest, not longest</h3>
<p>The rule is "most accumulated work", not "most blocks". A branch of 100 low-difficulty blocks loses to 90 high-difficulty ones. Getting this wrong is exploitable: an attacker mines cheap blocks on a low-difficulty branch and claims length. Bitcoin compares total chainwork; Ethereum compares attestation weight under LMD-GHOST.</p>
<p>Blocks that lose the race are <strong>orphans</strong> (Bitcoin) or <strong>ommers/uncles</strong> (pre-Merge Ethereum, which partially rewarded them to reduce the advantage of well-connected miners).</p>

<h3>Anatomy of a 51% double spend</h3>
<ol>
  <li>Attacker deposits 1,000 BTC to an exchange and mines <em>privately</em> from the block before the deposit.</li>
  <li>Exchange sees 6 confirmations on the public chain, credits the account.</li>
  <li>Attacker sells for USD and withdraws.</li>
  <li>Attacker publishes their private branch, which has more accumulated work.</li>
  <li>Nodes reorganise to the heavier branch. The deposit transaction never existed there. The exchange is short 1,000 BTC; the USD is gone.</li>
</ol>
<p>Note what is <em>not</em> possible: the attacker cannot steal from arbitrary addresses (no signatures), cannot mint coins (nodes reject invalid blocks), cannot change old rules. Majority hashpower buys exactly two powers — <strong>reordering recent history</strong> and <strong>censoring transactions</strong>.</p>
<p>Smaller PoW chains are genuinely vulnerable: Ethereum Classic was reorganised repeatedly in 2019-2020, Bitcoin Gold in 2018 and 2020, because renting enough hashrate cost less than the theft. Security scales with the value of the chain's own security budget, not with the value transacted on it.</p>

<div class="note">
  <span class="tag">Confirmation policy</span>
  <p>Choose depth by value at risk, not by habit. Coffee: 0 confirmations plus a mempool double-spend check. $1,000: 1-3 blocks. $1M: 30+ blocks on Bitcoin, or wait for finalisation on Ethereum. Exchanges publish these tables — read one and notice how much deeper they go for low-hashrate chains.</p>
</div>

<h3>Ethereum's real reorg history</h3>
<p>Post-Merge, single-slot reorgs still occur (proposers building late, or attestations arriving after the deadline). Depth is usually one slot. Finalised blocks have never reverted on mainnet. Applications should nevertheless treat "latest" as provisional: index at a few blocks of lag or subscribe to reorg events, or your database will drift from chain state.</p>

<h3>Governance forks</h3>
<p>The DAO hack in 2016 drained about 3.6M ETH through a reentrancy bug. The community hard-forked to move the funds; the minority that refused kept the original chain as Ethereum Classic. Both chains still run. The technical lesson is small; the governance lesson is large: <em>immutability is a social commitment enforced by consensus, not a law of physics</em>. When enough participants agree to change the rules, the rules change.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'fork-choice.js',
      caption: 'Heaviest-chain selection, plus reorg detection. Any indexer needs the second function or its database silently diverges from chain state.',
      src: `// Total work, not block count. A branch of many easy blocks must lose
// to a branch of fewer hard ones.
function chainWork(branch) {
  return branch.reduce((sum, b) => sum + 2 ** b.difficultyBits, 0);
}

function selectCanonical(branches) {
  return branches.reduce((best, b) =>
    chainWork(b) > chainWork(best) ? b : best);
}

// Detecting a reorg: walk back until the two chains agree
function findReorg(oldChain, newChain) {
  let i = 0;
  while (i < oldChain.length && i < newChain.length &&
         oldChain[i].hash === newChain[i].hash) i++;

  return {
    commonAncestor: i - 1,
    dropped: oldChain.slice(i),     // these transactions return to the mempool
    added: newChain.slice(i),
    depth: oldChain.length - i
  };
}

// Indexer rule of thumb: never write "latest" straight to your database.
const SAFE_LAG = { ethereum: 'finalized', bitcoin: 6, polygon: 128 };`
    }
  ],
  lab: 'reorg',
  quiz: [
    {
      q: 'Which of these can an attacker with 51% of hashpower NOT do?',
      options: [
        'Reverse their own recent transactions',
        'Censor specific transactions from being mined',
        'Spend coins from an address they do not have the key for',
        'Mine most of the blocks'
      ],
      answer: 2,
      why: 'Every node validates signatures independently. Blocks containing invalid signatures are rejected no matter how much work backs them. Majority hashpower buys reordering and censorship, not forgery or inflation.'
    },
    {
      q: 'Why is the fork-choice rule "heaviest chain" rather than "longest chain"?',
      options: [
        'Heaviest is easier to compute',
        'Otherwise an attacker could mine many low-difficulty blocks and win on count while doing less total work',
        'They are the same thing',
        'Longest chain is used only by Ethereum'
      ],
      answer: 1,
      why: 'Accumulated work is the security signal. Counting blocks would let an attacker on a low-difficulty branch (or after a difficulty drop) present a "longer" chain that cost far less to produce.'
    },
    {
      q: 'Your exchange indexes deposits from the "latest" block. What goes wrong?',
      options: [
        'Nothing, latest is safe',
        'A reorg drops the block, but your database already credited the deposit — creating money out of nothing',
        'Only performance suffers',
        'Transactions get double charged'
      ],
      answer: 1,
      why: 'The classic indexing bug. Chain state is provisional at the tip. Index against a safe depth or the finalised checkpoint, and handle reorg events by rolling back dropped blocks.'
    }
  ],
  tasks: [
    'In the lab, give the attacker 45% hashpower and run 50 trials at 6 confirmations. Record how often the double spend succeeds.',
    'Look up a real 51% attack (Ethereum Classic, January 2019) and write the timeline: reorg depth, value stolen, and estimated attack cost.',
    'Write a confirmation policy table for a hypothetical exchange covering four value tiers on two chains.',
    'Explain the difference between a soft fork and a hard fork using SegWit and the DAO fork as your examples.'
  ],
  resources: [
    { type: 'data', title: 'Cost to 51% attack various chains', url: 'https://www.crypto51.app/' },
    { type: 'read', title: 'Vitalik on hard forks, soft forks and the DAO', url: 'https://blog.ethereum.org/2016/07/26/onward_from_the_hard_fork' },
    { type: 'docs', title: 'Ethereum fork-choice specification', url: 'https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/fork-choice.md' }
  ]
});

})(window.ROADMAP.lessons);
