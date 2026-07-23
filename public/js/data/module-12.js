/* Module 12 — Oracles & Data Feeds (lessons 53-56) */
(function (L) {

L.push({
  id: 'oracle-basics', module: 12, num: 53,
  title: 'The Oracle Problem and Oracle Trust Models',
  level: 'Intermediate', minutes: 80,
  summary: 'A contract cannot look outside its own chain. Everything it "knows" about the world was put there by someone — so the oracle is part of your trust base whether you designed it or not.',
  objectives: [
    'Explain why determinism, not laziness, prevents a contract from calling an API',
    'Separate the four stages of an oracle — source, aggregation, transport, on-chain publication — and name the failure at each',
    'Compare push (scheduled feed) and pull (user-supplied signed report) delivery on cost, latency and liveness',
    'Reason about how many independent reporters are needed to survive f faulty ones',
    'State the oracle assumption of a protocol in one sentence, the way an auditor would'
  ],
  body: `
<h3>Why a contract cannot just fetch a price</h3>
<p>Every node re-executes every transaction and must reach the same state root. An HTTPS call breaks that: two nodes calling the same endpoint one second apart get different bytes, the endpoint may be down for one of them, and the response can be tailored per caller. The chain would stop agreeing. So the EVM has no network opcode, Move has no HTTP module, and Soroban contracts cannot open a socket. This is a <em>consensus</em> constraint, not a missing feature — and no amount of protocol work removes it.</p>
<p>The workaround is always the same shape: someone puts the data <strong>into a transaction</strong>, and the chain then agrees on what was written rather than on what is true. That is the oracle problem in one line. The chain guarantees the number was published; it guarantees nothing about the number.</p>

<div class="note"><span class="tag">Say it out loud</span>“This protocol is solvent as long as the oracle reports the price of X within Y% of its real value within Z seconds.” If you cannot fill in X, Y and Z, you do not yet know what you built.</div>

<h3>Four stages, four different failures</h3>
<p>Treat an oracle as a pipeline. Most incidents are not “the oracle was hacked” — they are one stage behaving exactly as designed while the consumer assumed something else.</p>
<div class="table-scroll"><table><thead><tr><th>Stage</th><th>What happens</th><th>How it fails</th></tr></thead><tbody>
<tr><td>Source</td><td>Exchanges, market makers, an API, a sensor, a court ruling</td><td>Thin real market, wash trading, a venue halting, an API returning a stale cache</td></tr>
<tr><td>Aggregation</td><td>Many sources reduced to one number, usually volume-weighted then median</td><td>All “independent” sources actually reprice off the same venue</td></tr>
<tr><td>Transport</td><td>Reporters sign; a committee combines or a relayer forwards</td><td>Collusion, key compromise, censorship, a signer set nobody audited</td></tr>
<tr><td>Publication</td><td>A transaction lands and updates on-chain storage</td><td>Gas spikes, congestion, a paused sequencer, an update that never fires</td></tr>
</tbody></table></div>
<p>Notice how many of these are <strong>liveness</strong> failures rather than lies. In a crash, an honest oracle reporting a correct but ten-minute-old price and a compromised oracle reporting a fresh lie do exactly the same damage to a lending market. Design for both.</p>

<h3>Push and pull are two different cost models</h3>
<p>A <strong>push</strong> feed is maintained by the oracle network. Reporters watch the market and send an update when a <em>deviation threshold</em> is crossed (say 0.5%) or when a <em>heartbeat</em> expires (say 1 hour) — whichever comes first. Reading it is a cheap view call, and the freshness of the answer is entirely the publisher's business. You pay indirectly, through whoever funds the feed.</p>
<p>A <strong>pull</strong> feed keeps prices off chain, signed and timestamped. The user, or a bot acting for them, fetches the latest signed report and passes it into the same transaction that needs it; the contract verifies signatures and freshness before use. Updates cost nothing when nobody trades, latency drops to sub-second, and long-tail assets become affordable. The price is complexity: every integration must carry the payload, and a caller can choose <em>which</em> valid recent report to submit — so your freshness window is also your manipulation window.</p>
<div class="table-scroll"><table><thead><tr><th></th><th>Push feed</th><th>Pull / signed report</th></tr></thead><tbody>
<tr><td>Who pays gas</td><td>Feed operator, continuously</td><td>The user, only when needed</td></tr>
<tr><td>Latency</td><td>Deviation or heartbeat bound</td><td>Sub-second, chosen by the submitter</td></tr>
<tr><td>Read path</td><td><code>view</code> call, trivially composable</td><td>Verify signatures and timestamp in the call</td></tr>
<tr><td>Long-tail assets</td><td>Expensive, so often unsupported</td><td>Cheap, so widely supported</td></tr>
<tr><td>Main risk to check</td><td>Staleness and paused updates</td><td>Report selection within the accepted window</td></tr>
</tbody></table></div>

<h3>Aggregation is about surviving faults, not averaging</h3>
<p>Use the <strong>median</strong>, not the mean. One reporter posting 10<sup>18</sup> moves a mean arbitrarily far; it moves a median by one position. With n reporters and at most f faulty ones, a median stays bounded by honest values whenever n ≥ 2f + 1 — a majority-honest assumption, and worth stating explicitly because it is the assumption you are actually buying.</p>
<pre><code>n = 2f + 1        survive f faulty reporters with a median
n = 21, f = 10    ten can lie or vanish; the median stays inside honest range
signers = 13/21   an on-chain quorum threshold is a separate, stricter parameter</code></pre>
<p>Independence is the part that quietly fails. Twenty-one reporters that all read the same three exchanges are, for manipulation purposes, three sources. When you evaluate a feed, ask what its <em>sources</em> are, not how many nodes it has.</p>

<div class="note warn"><span class="tag">Free is a trust decision</span><p>“Use the DEX pool, it is already on chain and costs nothing” is not a way to avoid an oracle. It is a choice to trust whoever can move that pool for one transaction — usually anyone with a flash loan. On-chain does not mean trustworthy; it means legible. Lesson 55 puts a number on exactly how much that trust costs an attacker.</p></div>

<h3>Choosing, in practice</h3>
<p>Match the mechanism to what the data actually is. A liquid major pair wants an aggregated market feed. A one-off subjective fact — “did this hurricane make landfall”, “was this invoice paid” — wants an optimistic oracle with a dispute window and a bond. Randomness wants a VRF, never a block hash. Cross-chain state wants a messaging protocol whose committee you have read about. Those live in lesson 56; the discipline is the same everywhere: name the assumption, then size what breaking it costs.</p>
`,
  code: [{
    lang: 'solidity', file: 'OracleShapes.sol',
    caption: 'The two delivery models as a consumer sees them. The push read is a view call; the pull read is a verification. Both must end at the same question: is this number fresh and sane enough to move money?',
    src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* ---------- push: the feed is already on chain ---------- */
interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

contract PushConsumer {
    IAggregatorV3 public immutable feed;
    uint256 public immutable maxAge; // set from the feed's published heartbeat

    error StalePrice(uint256 age);
    error BadPrice(int256 answer);

    constructor(IAggregatorV3 f, uint256 maxAge_) { feed = f; maxAge = maxAge_; }

    function price() public view returns (uint256 p, uint8 dec) {
        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        if (answer <= 0) revert BadPrice(answer);
        uint256 age = block.timestamp - updatedAt;
        if (age > maxAge) revert StalePrice(age);   // never "fail open"
        return (uint256(answer), feed.decimals());
    }
}

/* ---------- pull: the caller brings a signed report ---------- */
contract PullConsumer {
    mapping(address => bool) public isReporter;
    uint256 public constant QUORUM = 3;
    uint256 public constant MAX_AGE = 60; // seconds; also the manipulation window

    struct Report { bytes32 feedId; uint256 price; uint256 observedAt; }

    // The digest must be domain-separated (chainId + this address) so a report
    // cannot be replayed on another chain or against another consumer.
    function verify(Report calldata r, bytes32 digest, bytes[] calldata sigs)
        external view returns (uint256)
    {
        require(block.timestamp - r.observedAt <= MAX_AGE, "stale report");
        address last;
        uint256 valid;
        for (uint256 i; i < sigs.length; ++i) {
            address signer = _recover(digest, sigs[i]);
            require(signer > last, "signers must be sorted + unique"); // no double count
            last = signer;
            if (isReporter[signer]) ++valid;
        }
        require(valid >= QUORUM, "quorum not met");
        return r.price;
    }

    function _recover(bytes32, bytes calldata) internal pure returns (address) {
        return address(0); // ECDSA.recover in production; see lesson 56
    }
}`
  }],
  lab: 'oraclebasics',
  quiz: [
    { q: 'Why can a smart contract not call an HTTPS API directly?', options: ['Gas would be too expensive', 'Nodes re-executing the transaction would get different responses and could not agree on state', 'TLS is not implemented in Solidity yet', 'It would leak the caller’s IP address'], answer: 1, why: 'Execution must be deterministic and replayable by every node. A network call makes the result depend on time, location and endpoint availability, so consensus would break.' },
    { q: 'A feed has a 0.5% deviation threshold and a 1-hour heartbeat. The market is flat for 50 minutes. What does the on-chain answer look like?', options: ['It updates every block regardless', 'It may be up to an hour old, and that is normal operation', 'It reverts until a new update arrives', 'It interpolates between updates'], answer: 1, why: 'A push feed only updates on deviation or heartbeat. A quiet market means an old timestamp by design — which is why the consumer, not the feed, must decide what age is acceptable.' },
    { q: 'Why is a median preferred over a mean when aggregating reporters?', options: ['It is cheaper to compute on chain', 'A single extreme value cannot drag it far, so it survives f faulty reporters when n ≥ 2f + 1', 'It always produces the newest value', 'It removes the need for signatures'], answer: 1, why: 'The mean is unbounded in one bad input; the median moves by one position. That bound is the whole fault-tolerance argument.' },
    { q: 'Which risk is specific to a pull oracle with a 60-second acceptance window?', options: ['The feed operator stops paying gas', 'The submitter picks which valid recent report to use, so the window is also a manipulation window', 'Reads become non-deterministic', 'Signatures cannot be verified on chain'], answer: 1, why: 'Anyone can choose the most favourable signed report still inside the window. Shorten the window and treat it as an attack surface, not just a freshness parameter.' }
  ],
  tasks: [
    'Use the lab to break a mean with one faulty reporter, then repeat with a median and record how many reporters must lie before it moves.',
    'Pick a protocol you use and write its oracle assumption as one sentence with concrete X, Y and Z values.',
    'Take a live feed and list its real underlying sources; count how many are genuinely independent venues rather than mirrors.',
    'For a token you would list, estimate the annual gas cost of a push feed at a 0.5% deviation threshold versus per-transaction pull verification at your expected volume.'
  ],
  resources: [
    { type: 'docs', title: 'Chainlink — decentralised data feed architecture', url: 'https://docs.chain.link/architecture-overview/architecture-decentralized-model' },
    { type: 'docs', title: 'Pyth — how pull oracles work', url: 'https://docs.pyth.network/price-feeds/pythnet-price-feeds' },
    { type: 'read', title: 'Chainlink 2.0 whitepaper — decentralised oracle networks', url: 'https://research.chain.link/whitepaper-v2.pdf' },
    { type: 'read', title: 'Ethereum.org — oracles', url: 'https://ethereum.org/en/developers/docs/oracles/' }
  ]
});

L.push({
  id: 'oracle-feeds', module: 12, num: 54,
  title: 'Consuming Price Feeds Safely',
  level: 'Advanced', minutes: 85,
  summary: 'Reading a feed is four lines of code and about eight ways to lose money. Decimals, staleness, aggregator bounds, sequencer downtime and quote composition each have their own funeral.',
  objectives: [
    'Read every field of a feed answer and say what each one protects against',
    'Choose a staleness bound from a feed’s published heartbeat instead of a copied constant',
    'Detect the aggregator floor/ceiling problem and explain why it is not hypothetical',
    'Add an L2 sequencer-uptime check with a grace period and justify the delay',
    'Compose two feeds into a derived price without losing precision or introducing a silent decimals bug'
  ],
  body: `
<h3>The four-line integration that is wrong</h3>
<pre><code>(, int256 p, , , ) = feed.latestRoundData();
uint256 value = collateral * uint256(p) / 1e8;   // three assumptions, all unchecked</code></pre>
<p>It assumes the answer is positive, that it is recent, and that the feed has eight decimals. The first is a cast that turns a negative answer into an enormous positive number. The second is why protocols keep lending against prices from before a crash. The third is the bug that quietly prices an asset 10<sup>10</sup> times too high the day you point the same code at a feed with 18 decimals.</p>

<h3>Every field, and what it buys you</h3>
<div class="table-scroll"><table><thead><tr><th>Field</th><th>Meaning</th><th>Check</th></tr></thead><tbody>
<tr><td><code>answer</code></td><td>The price, scaled by <code>decimals()</code></td><td>Must be strictly positive; never cast blindly</td></tr>
<tr><td><code>updatedAt</code></td><td>When this answer was written on chain</td><td><code>block.timestamp - updatedAt &lt;= maxAge</code></td></tr>
<tr><td><code>roundId</code> / <code>answeredInRound</code></td><td>Round bookkeeping</td><td>A round that never carried a fresh answer should not be trusted</td></tr>
<tr><td><code>decimals()</code></td><td>Scaling of <code>answer</code></td><td>Read it; do not hard-code 8. It differs per feed</td></tr>
<tr><td><code>description()</code></td><td>Which pair this is</td><td>Assert the pair in your deploy script, not in a comment</td></tr>
</tbody></table></div>
<p>Pick <code>maxAge</code> from the feed's own heartbeat, with headroom: a one-hour heartbeat feed might use 1.5 hours, while a 24-hour heartbeat feed needs a full day of tolerance and therefore should never back an aggressive liquidation engine. Copying <code>3600</code> into a contract that reads a daily-heartbeat feed means halting on a perfectly healthy oracle; copying <code>86400</code> into a volatile-market integration means lending against yesterday's price.</p>

<div class="note warn"><span class="tag">Fail closed</span><p>A <code>try/catch</code> around the feed that falls back to “last known price” on revert converts an oracle outage into an unbounded credit facility. If the price is unusable, the correct behaviour is to block risk-increasing actions — new borrows, new mints, new leverage — while still allowing repayments and, usually, collateral top-ups.</p></div>

<h3>The aggregator floor is a real loss, not a footnote</h3>
<p>Many aggregator contracts carry a <code>minAnswer</code> and <code>maxAnswer</code> configured at deployment. When the true price moves outside that band, the feed reports the <em>bound</em>, not the truth, and it keeps reporting it with a fresh timestamp. Every staleness check passes. In May 2022 LUNA collapsed far below its configured floor; lending markets on BNB Chain kept valuing it at the floor price, and attackers borrowed against collateral that was effectively worthless. Losses ran into the tens of millions across affected forks.</p>
<p>The defence is a consumer-side sanity band, plus the discipline of treating “price pinned at exactly the same number for many rounds” as an alarm rather than as stability.</p>
<pre><code>if (answer &lt;= minAnswer || answer &gt;= maxAnswer) revert PriceOutOfBand();
// note: &gt;= and &lt;=, not &gt; and &lt;. The bound itself is the untrustworthy value.</code></pre>

<h3>On an L2, the sequencer is part of your oracle</h3>
<p>When an L2 sequencer goes down and comes back, the chain resumes with a backlog and prices that stopped updating during the outage. Users who wanted to repay or top up could not, while liquidators — who queue transactions in advance — can act on the first block after restart. Rollups publish a <strong>sequencer uptime feed</strong> for exactly this: check that it is up, and additionally require a grace period since it came back so users get a fair chance to react.</p>
<pre><code>(, int256 up, uint256 startedAt, , ) = sequencerUptime.latestRoundData();
if (up == 1) revert SequencerDown();                       // 1 = down, 0 = up
if (block.timestamp - startedAt &lt; GRACE_PERIOD) revert GracePeriodNotOver();</code></pre>

<h3>Composing feeds without a precision bug</h3>
<p>There is often no direct feed for the pair you need. Deriving TOKEN/USD from TOKEN/ETH and ETH/USD is standard, and the rule is to multiply before dividing, in a single expression, with the decimals of both feeds read at runtime.</p>
<pre><code>tokenUsd = tokenEth * ethUsd / 10**ethUsdDecimals   // one scaling step, no early division</code></pre>
<p>Each composed hop adds its own staleness and deviation error, and the errors add. Two feeds each within 0.5% give a derived price within roughly 1%. Size the liquidation bonus and safety margins against the composed error, not the individual one.</p>

<div class="note"><span class="tag">Never price these with a spot read</span>LP tokens, vault shares and rebasing wrappers. A share price obtained by dividing total assets by total supply can be inflated inside one transaction. Price them from underlying reserves with a fair-reserves formula, or from the vault's own redemption rate with a rate-of-change cap. Cream Finance lost roughly $130M in October 2021 to exactly this class of mistake.</div>
`,
  code: [{
    lang: 'solidity', file: 'SafePriceReader.sol',
    caption: 'Every check has a named error, so an integration test can assert which guard fired. The dual-feed disagreement check is the cheapest insurance available against a single feed misbehaving.',
    src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

contract SafePriceReader {
    IAggregatorV3 public immutable primary;
    IAggregatorV3 public immutable secondary;       // independent source, same pair
    IAggregatorV3 public immutable sequencerUptime; // address(0) on L1

    uint256 public constant GRACE_PERIOD = 1 hours;
    uint256 public immutable maxAge;    // from the feed's published heartbeat
    int256  public immutable minAnswer; // consumer-side sanity band
    int256  public immutable maxAnswer;
    uint256 public constant MAX_DIVERGENCE_BPS = 200; // 2%

    error SequencerDown();
    error GracePeriodNotOver();
    error StalePrice(uint256 age);
    error NonPositiveAnswer(int256 answer);
    error IncompleteRound();
    error PriceOutOfBand(int256 answer);
    error FeedsDisagree(uint256 a, uint256 b);

    constructor(
        IAggregatorV3 p, IAggregatorV3 s, IAggregatorV3 seq,
        uint256 maxAge_, int256 minAnswer_, int256 maxAnswer_
    ) {
        primary = p; secondary = s; sequencerUptime = seq;
        maxAge = maxAge_; minAnswer = minAnswer_; maxAnswer = maxAnswer_;
    }

    /// @notice Reverts rather than returning a number you should not act on.
    function price() public view returns (uint256 answer18) {
        _requireSequencerUp();
        uint256 a = _read(primary);
        uint256 b = _read(secondary);

        uint256 hi = a > b ? a : b;
        uint256 lo = a > b ? b : a;
        // Disagreement means one source is wrong and we cannot tell which.
        if ((hi - lo) * 10_000 / lo > MAX_DIVERGENCE_BPS) revert FeedsDisagree(a, b);

        return (a + b) / 2;
    }

    function _requireSequencerUp() internal view {
        if (address(sequencerUptime) == address(0)) return;
        (, int256 up, uint256 startedAt, , ) = sequencerUptime.latestRoundData();
        if (up == 1) revert SequencerDown();
        if (block.timestamp - startedAt < GRACE_PERIOD) revert GracePeriodNotOver();
    }

    /// @dev Returns the answer normalised to 18 decimals.
    function _read(IAggregatorV3 feed) internal view returns (uint256) {
        (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound)
            = feed.latestRoundData();

        if (answer <= 0) revert NonPositiveAnswer(answer);
        if (updatedAt == 0 || answeredInRound < roundId) revert IncompleteRound();
        if (answer <= minAnswer || answer >= maxAnswer) revert PriceOutOfBand(answer);

        uint256 age = block.timestamp - updatedAt;
        if (age > maxAge) revert StalePrice(age);

        uint8 dec = feed.decimals();          // read it; never assume 8
        return dec <= 18
            ? uint256(answer) * (10 ** (18 - dec))
            : uint256(answer) / (10 ** (dec - 18));
    }
}`
  }],
  lab: 'oraclefeed',
  quiz: [
    { q: 'A feed answer sits at exactly 0.10 for forty consecutive rounds while the asset trades at 0.0001 elsewhere. What is most likely?', options: ['The feed is stale and the timestamp will prove it', 'The price is pinned at the aggregator’s configured minAnswer and the timestamps are fresh', 'The decimals changed', 'The sequencer is down'], answer: 1, why: 'Bound-pinning produces fresh timestamps with an untrue answer, so staleness checks pass. Only a consumer-side sanity band catches it — the LUNA lending losses in May 2022 are the reference case.' },
    { q: 'Why add a grace period after an L2 sequencer comes back up?', options: ['To let the feed contract redeploy', 'To give users who could not transact a chance to repay or add collateral before liquidations resume', 'To reduce gas costs at restart', 'Because updatedAt is invalid after downtime'], answer: 1, why: 'Restart favours pre-queued liquidation bots over ordinary users. The grace period restores a fair window before risk actions are re-enabled.' },
    { q: 'What is wrong with catching a feed revert and using the last cached price?', options: ['Nothing, it improves availability', 'It converts an oracle outage into borrowing against an arbitrarily wrong price', 'It costs more gas', 'It breaks the decimals conversion'], answer: 1, why: 'Fail-open is an insolvency policy. Block risk-increasing actions while continuing to allow repayments and collateral top-ups.' },
    { q: 'You derive TOKEN/USD from TOKEN/ETH and ETH/USD. Which statement is true?', options: ['The composed price is as accurate as the better feed', 'The errors of the two feeds add, so margins must be sized against the composed error', 'Composition removes staleness risk', 'You may divide first to avoid overflow'], answer: 1, why: 'Both staleness and deviation compound across hops. Multiply before dividing to keep precision, and size safety parameters against the combined error.' }
  ],
  tasks: [
    'Use the lab to fire each guard in turn — stale, negative, band-pinned, sequencer down, feeds disagree — and record the revert each one produces.',
    'Look up the real heartbeat and deviation threshold for two feeds you would use, and set maxAge for each from the published value.',
    'Write a Foundry test that mocks an aggregator pinned at minAnswer with a fresh timestamp, and prove your consumer reverts.',
    'Draft the pause policy: list exactly which functions stay open when the price is unusable, and why each one cannot increase risk.'
  ],
  resources: [
    { type: 'docs', title: 'Chainlink — Data Feeds API reference', url: 'https://docs.chain.link/data-feeds/api-reference' },
    { type: 'docs', title: 'Chainlink — L2 sequencer uptime feeds', url: 'https://docs.chain.link/data-feeds/l2-sequencer-feeds' },
    { type: 'docs', title: 'Chainlink — selecting quality data feeds', url: 'https://docs.chain.link/data-feeds/selecting-data-feeds' },
    { type: 'read', title: 'Rekt — Venus / LUNA price floor incident', url: 'https://rekt.news/venus-blizz-rekt/' }
  ]
});

L.push({
  id: 'oracle-manipulation', module: 12, num: 55,
  title: 'Manipulation, TWAP and the Cost of Attack',
  level: 'Advanced', minutes: 90,
  summary: 'Oracle attacks are arithmetic. Work out what moving the price costs, what the protocol will pay out when it moves, and whether the second number is bigger.',
  objectives: [
    'Compute how much capital moves a constant-product pool by a given percentage',
    'Explain why a flash loan changes the attacker’s capital requirement but not the attack cost',
    'Choose a TWAP window from the attacker’s per-block carrying cost rather than from habit',
    'Recognise the manipulations a TWAP does not stop, including thin real markets and multi-block control',
    'Size borrow caps so the maximum extractable profit stays below the cost of moving the price'
  ],
  body: `
<h3>The only equation that matters</h3>
<p>An oracle manipulation is profitable when <em>what the protocol pays out</em> exceeds <em>what moving the price costs</em>. Everything else — flash loans, TWAP windows, sandwich structure — is a way to move one of those two numbers.</p>
<pre><code>profit  = extractable(P_manipulated) − cost(move price to P_manipulated) − fees − gas
defence = make extractable() small (caps) or cost() large (depth, time, dual sources)</code></pre>

<h3>What it costs to move a constant-product pool</h3>
<p>In an <code>x·y=k</code> pool, raising the price by a factor k requires buying into the reserve until the ratio changes. Ignoring fees, that means adding roughly <code>(√k − 1)</code> of the input reserve.</p>
<pre><code>to raise price by factor k:   Δx ≈ x · (√k − 1)
pool: 1,000 ETH / 2,000,000 USDC     price = 2,000 USDC per ETH
double the price (k = 2):            Δusdc ≈ 2,000,000 × 0.414 ≈ 828,000 USDC
the attacker keeps the tokens bought, so the true cost is slippage + fees, not the notional</code></pre>
<p>That last line is the point people miss. The attacker does not <em>spend</em> 828,000 USDC — they swap it, hold the other side, and unwind afterwards. The real cost is round-trip slippage plus swap fees plus gas, which can be a small fraction of the notional. A flash loan removes the capital requirement entirely: the attacker never needed the 828,000, only the ability to repay it in the same transaction.</p>

<div class="note warn"><span class="tag">Spot price is an execution price</span><p>An AMM's instantaneous reserve ratio tells you what a trade would cost right now. It does not tell you what an asset is worth, and it can be set to any value by anyone for the duration of one transaction. Never use <code>getReserves()</code> or a single-block <code>slot0</code> as a valuation input.</p></div>

<h3>TWAP: paying the attacker to hold the lie</h3>
<p>A time-weighted average price accumulates <code>price × time</code> and lets you read the average across a window. This defeats the single-transaction attack outright: to move a 30-minute TWAP by 10%, an attacker must hold the pool displaced for a meaningful part of those 30 minutes, and every block they hold it, arbitrageurs trade against them at a profit. That bleed is the attack cost, and it scales with the window and with pool depth.</p>
<div class="table-scroll"><table><thead><tr><th>Window</th><th>Attacker must</th><th>Protocol accepts</th></tr></thead><tbody>
<tr><td>1 block</td><td>Nothing — one transaction</td><td>Instant reaction, no manipulation resistance</td></tr>
<tr><td>~10 min</td><td>Hold displacement against arbitrage for minutes</td><td>Lag during real crashes</td></tr>
<tr><td>~30-60 min</td><td>Sustain a large, visible loss</td><td>Serious lag; liquidations fire late and bad debt accrues</td></tr>
</tbody></table></div>
<p>So the window is a direct trade: manipulation resistance bought with reaction speed. In a fast crash a long TWAP is itself a solvency risk — the protocol liquidates against a price that no longer exists. This is why mature lending markets use an aggregated market feed as the primary source and reserve TWAPs for assets that have no such feed.</p>

<h3>What a TWAP does not fix</h3>
<ul>
<li><strong>A thin real market.</strong> If an asset genuinely trades in a shallow book everywhere, an attacker can move the <em>actual</em> global price and every honest oracle will faithfully report it. Mango Markets in October 2022 lost roughly $115M this way: MNGO's real market was small enough to buy, and the positions it collateralised were not.</li>
<li><strong>Illiquid pools with long windows.</strong> Inverse Finance was drained twice in 2022; the second incident used a TWAP over a pool so shallow that sustaining the displacement was cheap relative to what could be borrowed.</li>
<li><strong>Derived prices.</strong> Cream Finance's yUSD loss came from a share-price read that could be inflated by donating assets to the vault inside one transaction — the feed itself was never touched.</li>
<li><strong>Multi-block control.</strong> With known proposer schedules, an attacker who controls consecutive slots can hold a displaced price across blocks without arbitrage exposure in between. Short windows are not automatically safe.</li>
<li><strong>Stale-by-design lag.</strong> A long TWAP that lags a genuine 40% crash lets borrowers extract value at yesterday's valuation. Manipulation is not the only failure mode.</li>
</ul>

<h3>Cap the payout, not just the price</h3>
<p>The most robust defence is not a better price — it is a smaller prize. If an asset can only ever back $2M of borrows, then no price manipulation, however cheap, extracts more than $2M, and that number can be compared directly against the cost of moving the market.</p>
<pre><code>borrowCap ≤ costToMoveOracle(byThreshold) × safetyFactor
tie the cap to observed on-chain depth, and lower it automatically when depth falls</code></pre>
<p>Stack this with the rest: an aggregated feed as primary, a second independent source with a disagreement halt, per-update price-change circuit breakers, isolation modes so an exotic asset cannot touch the main pool, and a supply cap that keeps position size bounded even when someone does move the market.</p>

<div class="note"><span class="tag">Audit habit</span>For every asset a protocol lists, compute two numbers: the dollar cost of moving its oracle price 20%, and the dollars extractable at that price. Any listing where the second exceeds the first is a scheduled incident.</div>
`,
  code: [{
    lang: 'solidity', file: 'TwapAndCaps.sol',
    caption: 'Reading a Uniswap V3 TWAP correctly, plus the two guards that matter more than the price source itself: a per-update deviation circuit breaker and a hard borrow cap.',
    src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external view returns (int56[] memory tickCumulatives, uint160[] memory);
    function slot0() external view returns (
        uint160 sqrtPriceX96, int24 tick, uint16 observationIndex,
        uint16 observationCardinality, uint16 observationCardinalityNext,
        uint8 feeProtocol, bool unlocked
    );
}

contract TwapAndCaps {
    IUniswapV3Pool public immutable pool;
    uint32 public constant WINDOW = 1800;           // 30 minutes
    uint16 public constant MIN_CARDINALITY = 200;   // the window must actually exist

    uint256 public lastPrice;
    uint256 public lastUpdate;
    uint256 public constant MAX_MOVE_BPS = 1000;    // 10% per update
    uint256 public borrowCap;                       // sized against attack cost

    error CardinalityTooLow(uint16 have);
    error MoveTooLarge(uint256 from, uint256 to);
    error CapExceeded();

    constructor(IUniswapV3Pool p, uint256 cap) { pool = p; borrowCap = cap; }

    /// @notice Mean tick over WINDOW. A pool whose observation buffer is shorter
    ///         than the window silently returns a shorter average, so check it.
    function meanTick() public view returns (int24) {
        (, , , uint16 cardinality, , , ) = pool.slot0();
        if (cardinality < MIN_CARDINALITY) revert CardinalityTooLow(cardinality);

        uint32[] memory ago = new uint32[](2);
        ago[0] = WINDOW;
        ago[1] = 0;
        (int56[] memory cum, ) = pool.observe(ago);

        int56 delta = cum[1] - cum[0];
        int24 tick = int24(delta / int56(uint56(WINDOW)));
        // Solidity truncates toward zero; round down for negative ticks.
        if (delta < 0 && (delta % int56(uint56(WINDOW)) != 0)) tick--;
        return tick;
    }

    /// @dev Rejects a jump larger than MAX_MOVE_BPS since the last accepted price.
    ///      A real crash trips this too — that is intentional. Tripping should
    ///      pause risk-increasing actions and require review, not auto-resume.
    function commitPrice(uint256 newPrice) external {
        uint256 prev = lastPrice;
        if (prev != 0) {
            uint256 hi = newPrice > prev ? newPrice : prev;
            uint256 lo = newPrice > prev ? prev : newPrice;
            if ((hi - lo) * 10_000 / lo > MAX_MOVE_BPS) revert MoveTooLarge(prev, newPrice);
        }
        lastPrice = newPrice;
        lastUpdate = block.timestamp;
    }

    function checkBorrow(uint256 amount, uint256 totalBorrowed) external view {
        // The cap is the loss ceiling when every price defence fails at once.
        if (totalBorrowed + amount > borrowCap) revert CapExceeded();
    }
}`
  }],
  lab: 'oracletwap',
  quiz: [
    { q: 'A flash loan is used in an oracle attack. What does it actually change?', options: ['It makes the price move cheaper', 'It removes the attacker’s capital requirement, while the cost stays slippage plus fees plus gas', 'It bypasses the TWAP', 'It hides the attacker’s address'], answer: 1, why: 'The economic cost of displacing a pool is unchanged. The flash loan removes the need to own the capital, which turns an attack only whales could afford into one anyone can attempt.' },
    { q: 'Lengthening a TWAP window from 10 minutes to 60 minutes has which cost?', options: ['Higher gas per read', 'Slower reaction to genuine price moves, so liquidations fire late and bad debt accrues', 'Lower manipulation resistance', 'It stops working during volatility'], answer: 1, why: 'The window trades manipulation resistance against reaction speed. In a fast crash a long window prices collateral above its real value for the whole window.' },
    { q: 'Which attack does a correctly implemented TWAP fail to prevent?', options: ['Single-block flash-loan displacement', 'Buying up a genuinely thin global market so every honest oracle reports the manipulated price', 'A one-transaction sandwich around the read', 'Reading slot0 directly'], answer: 1, why: 'If the real market is shallow, the manipulated price is the true price. Mango Markets in October 2022 is the canonical case; the defence is caps and listing standards, not a better average.' },
    { q: 'Why is a borrow cap considered a stronger defence than a better price source?', options: ['It is cheaper to compute', 'It bounds the maximum extractable amount even when every price defence fails', 'It prevents flash loans', 'It removes the need for staleness checks'], answer: 1, why: 'Caps change the payout side of the profit equation. A prize smaller than the cost of moving the market makes the attack unprofitable regardless of oracle quality.' }
  ],
  tasks: [
    'Use the lab to find the pool depth at which moving the price 25% costs less than the protocol’s borrow cap, then set a cap that closes the gap.',
    'Compute the round-trip cost of a 2x displacement on a real pool including both swap fees, and compare it with the notional.',
    'Pick two historical oracle incidents and classify each as spot manipulation, thin real market, derived-price inflation or stale lag.',
    'Write the listing checklist you would require before adding a new collateral asset, with numeric thresholds for depth, cap and oracle source.'
  ],
  resources: [
    { type: 'docs', title: 'Uniswap V3 — oracle observations and cardinality', url: 'https://docs.uniswap.org/concepts/protocol/oracle' },
    { type: 'read', title: 'Chainlink — flash loans and oracle manipulation', url: 'https://blog.chain.link/flash-loans/' },
    { type: 'read', title: 'Euler — oracle design in the Euler Vault Kit', url: 'https://docs.euler.finance/euler-vault-kit-white-paper/' },
    { type: 'read', title: 'Rekt — Mango Markets', url: 'https://rekt.news/mango-markets-rekt/' },
    { type: 'read', title: 'Rekt — Cream Finance (yUSD share price)', url: 'https://rekt.news/cream-rekt-2/' }
  ]
});

L.push({
  id: 'oracle-beyond-price', module: 12, num: 56,
  title: 'Randomness, Automation, Optimistic and Custom Oracles',
  level: 'Advanced', minutes: 85,
  summary: 'Prices are one kind of outside fact. Randomness, "did this happen", "run this when X" and "is this true elsewhere" are all oracle problems with different trust machinery.',
  objectives: [
    'Choose between a VRF, a commit-reveal scheme and a threshold beacon for on-chain randomness',
    'Write an asynchronous callback that cannot lose a result when it runs out of gas',
    'Explain how an optimistic oracle prices truth with bonds, liveness and escalation',
    'State why a cross-chain message is an oracle and identify who its real signers are',
    'Design a minimal signed-price oracle with domain separation, expiry and replay protection'
  ],
  body: `
<h3>Randomness: the request-and-verify pattern</h3>
<p>On-chain entropy does not exist. <code>block.timestamp</code>, <code>blockhash</code> and <code>prevrandao</code> are all influenced or observed by the party who most wants to influence the outcome, and any of them read inside the same transaction is trivially exploitable by a contract that simulates first and reverts on a bad roll. A <strong>VRF</strong> moves generation off chain and brings back a value plus a proof that it derives from a key committed to in advance. Nobody, including the oracle, can pick the output for a given request; the contract verifies the proof before use.</p>
<p>The engineering consequence is asynchrony. The result arrives in a second transaction, under a gas limit set by the requester, possibly many blocks later. Two rules follow: do the minimum in the callback — store the word, mark the request fulfilled, emit an event — and let the user claim in their own transaction; and never let a reverting callback destroy the result. A raffle where an out-of-gas callback loses the draw is a raffle with a free re-roll for whoever engineers the revert.</p>
<div class="table-scroll"><table><thead><tr><th>Source</th><th>Who can influence it</th><th>Use when</th></tr></thead><tbody>
<tr><td><code>blockhash</code> / <code>prevrandao</code></td><td>The proposer, who can withhold a block</td><td>Never for anything with value attached</td></tr>
<tr><td>Commit-reveal</td><td>Whoever reveals last, by not revealing</td><td>Few known participants, with a staked bond forfeited on non-reveal</td></tr>
<tr><td>VRF</td><td>Nobody, given the proof verifies</td><td>Mints, loot, matchmaking, anything an attacker would reroll</td></tr>
<tr><td>Threshold beacon (drand-style)</td><td>A colluding threshold of the committee</td><td>Public, scheduled randomness shared by many consumers</td></tr>
</tbody></table></div>

<h3>Automation is an oracle for time</h3>
<p>Contracts do not wake up. “Liquidate when health drops below 1”, “roll the epoch at midnight” and “rebalance hourly” all need an external caller, and that caller is a trust and liveness dependency exactly like a price feed. Keeper networks formalise it: a <code>checkUpkeep</code> view function decides whether work is due, and <code>performUpkeep</code> does it. The subtlety is that <code>performUpkeep</code> is <strong>permissionless in effect</strong> — the condition must be re-validated on chain inside it, because the caller controls when it runs and with what arguments. Make the work idempotent, bound its gas, and never assume it ran on schedule.</p>

<h3>Optimistic oracles: a price for subjective truth</h3>
<p>Some facts have no feed. Did a shipment arrive? Was a governance milestone met? Did an insured event occur? An <strong>optimistic oracle</strong> answers by economics rather than measurement: a proposer posts an answer with a bond, a liveness window opens, and if nobody disputes within it the answer becomes final. A disputer posts a matching bond and escalates to a slower resolution process — a token-holder vote, a committee, a court of last resort — which pays the winner from the loser's bond.</p>
<pre><code>propose(answer, bond) → liveness window (hours) → undisputed ⇒ final
                                ↓ disputed (matching bond)
                        escalation vote (days) ⇒ final, loser’s bond slashed</code></pre>
<p>The security property is that lying costs the bond, and disputing a truthful answer costs the same. So the bond must exceed what a wrong answer is worth, and the liveness window must be long enough for a watcher to notice. Both are your parameters, and both trade cost against speed. The failure mode is a bond so small that corrupting a $10M settlement costs $5,000, or a window so short that disputes cannot be filed on a congested chain.</p>

<div class="note warn"><span class="tag">Cross-chain messages are oracles too</span><p>A bridge or messaging protocol asserts “this event happened on chain A”. Unless the destination verifies a light client or a validity proof, that assertion is signed by a committee — and that committee is your oracle, with all the collusion and key-compromise risk that implies. Before integrating, find out who signs, how many of them, whether the set is upgradeable, and who controls the upgrade key.</p></div>

<h3>Rolling your own, when you must</h3>
<p>Sometimes the data is yours: a game's server state, an off-chain order book, a real-world measurement only you observe. A minimal signed-data oracle is not hard, but it has five non-negotiable parts, and every one of them has been the subject of a real exploit when omitted.</p>
<ul>
<li><strong>Domain separation.</strong> EIP-712 with <code>chainId</code> and the verifying contract address, so a signature cannot be replayed on a testnet, a fork or a sibling deployment.</li>
<li><strong>Expiry.</strong> Every payload carries <code>validUntil</code>. Without it, an old favourable price is valid forever.</li>
<li><strong>Replay protection.</strong> A monotonically increasing round id per feed; reject anything not newer than what you stored.</li>
<li><strong>Quorum with unique signers.</strong> Require m-of-n and enforce strictly increasing signer addresses, so the same key cannot be counted twice.</li>
<li><strong>Key rotation and a pause.</strong> A way to remove a compromised signer and to stop consumption entirely, held by an account that is not the same key that signs prices.</li>
</ul>
<p>Then write down the assumption in the same sentence form as lesson 53 — because a custom oracle means your protocol's solvency now depends on your own key management, monitoring and uptime. That is a real operational commitment, not a shortcut around integration work.</p>
`,
  code: [{
    lang: 'solidity', file: 'SignedPriceOracle.sol',
    caption: 'A minimal m-of-n pull oracle. The digest binds chain id and contract address; the payload carries an expiry and a round id; signers must be sorted so none is counted twice.',
    src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract SignedPriceOracle is EIP712 {
    struct PriceReport {
        bytes32 feedId;
        uint256 price;      // 18 decimals
        uint64  roundId;    // strictly increasing per feed
        uint64  validUntil; // unix seconds
    }

    bytes32 private constant REPORT_TYPEHASH = keccak256(
        "PriceReport(bytes32 feedId,uint256 price,uint64 roundId,uint64 validUntil)"
    );

    mapping(address => bool) public isSigner;
    mapping(bytes32 => uint64) public lastRound;    // feedId => highest accepted round
    mapping(bytes32 => uint256) public latestPrice;
    uint256 public immutable quorum;
    bool public paused;

    error Expired();
    error StaleRound();
    error SignersUnsorted();
    error QuorumNotMet(uint256 valid);
    error Paused();

    constructor(address[] memory signers, uint256 quorum_)
        EIP712("SignedPriceOracle", "1")
    {
        for (uint256 i; i < signers.length; ++i) isSigner[signers[i]] = true;
        quorum = quorum_;
    }

    function submit(PriceReport calldata r, bytes[] calldata sigs) external {
        if (paused) revert Paused();
        if (block.timestamp > r.validUntil) revert Expired();
        if (r.roundId <= lastRound[r.feedId]) revert StaleRound();

        // chainId and address(this) live inside the EIP-712 domain separator,
        // so this digest is not valid on any other chain or deployment.
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            REPORT_TYPEHASH, r.feedId, r.price, r.roundId, r.validUntil
        )));

        address last;
        uint256 valid;
        for (uint256 i; i < sigs.length; ++i) {
            address signer = ECDSA.recover(digest, sigs[i]);
            if (signer <= last) revert SignersUnsorted(); // also rejects duplicates
            last = signer;
            if (isSigner[signer]) ++valid;
        }
        if (valid < quorum) revert QuorumNotMet(valid);

        lastRound[r.feedId] = r.roundId;
        latestPrice[r.feedId] = r.price;
    }
}`
  }, {
    lang: 'solidity', file: 'SafeRandomConsumer.sol',
    caption: 'The callback stores and returns. It never mints, never transfers and never loops — because it runs under a gas limit chosen before anyone knew how much work the result would imply.',
    src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract SafeRandomConsumer {
    struct Request { address player; uint256 word; bool fulfilled; bool claimed; }
    mapping(uint256 => Request) public requests;

    event Requested(uint256 indexed id, address indexed player);
    event Fulfilled(uint256 indexed id);

    /// @dev Called by the VRF coordinator under a fixed gas limit.
    ///      Minimum work only: no external calls, no unbounded loops, no mint.
    function _fulfill(uint256 id, uint256[] memory words) internal {
        Request storage q = requests[id];
        if (q.fulfilled) return;            // idempotent: a retry must not overwrite
        q.word = words[0];
        q.fulfilled = true;
        emit Fulfilled(id);
    }

    /// @notice The player pays for their own settlement, in their own transaction,
    ///         so an expensive outcome can never make the callback run out of gas.
    function claim(uint256 id) external {
        Request storage q = requests[id];
        require(q.fulfilled && !q.claimed, "not ready");
        require(msg.sender == q.player, "not yours");
        q.claimed = true;
        _settle(q.player, q.word);
    }

    function _settle(address player, uint256 word) internal virtual;
}`
  }],
  lab: 'oracledesign',
  quiz: [
    { q: 'Why should a VRF callback do as little work as possible?', options: ['To save the oracle money', 'It runs under a gas limit fixed at request time, so heavy work can revert and lose the result', 'Because randomness expires', 'To keep the proof valid'], answer: 1, why: 'Store the word and mark it fulfilled; let the player settle in their own transaction. A callback that can revert hands an attacker a free re-roll.' },
    { q: 'An optimistic oracle secures a $10M settlement with a $5,000 proposer bond. What is the flaw?', options: ['The bond is locked too long', 'Lying is profitable because the cost of a wrong answer is far below its value', 'Disputes become impossible', 'The liveness window must be zero'], answer: 1, why: 'Optimistic oracles price truth. The bond must exceed what a wrong answer is worth, and the liveness window must be long enough for a watcher to dispute.' },
    { q: 'What makes a cross-chain message an oracle problem?', options: ['It uses a different hash function', 'Unless the destination verifies a light client or validity proof, a committee is asserting that the source event happened', 'Gas is paid on two chains', 'Messages are asynchronous'], answer: 1, why: 'The security of the message equals the security of whoever signs it. Ask who signs, how many, whether the set is upgradeable, and who holds the upgrade key.' },
    { q: 'Which omission lets a valid signed price be reused on a fork or sibling deployment?', options: ['Missing expiry', 'Missing domain separation over chainId and the verifying contract', 'Unsorted signers', 'A missing pause function'], answer: 1, why: 'The EIP-712 domain binds a signature to one chain and one contract. Without it, the same signature verifies everywhere the signer set is reused.' }
  ],
  tasks: [
    'Use the lab to configure a signed-price oracle and try to break it: replay an old round, submit past the expiry, and pass the same signer twice.',
    'Implement a raffle where the VRF callback only stores the word, then write a test proving a reverting settlement cannot destroy the draw.',
    'Pick an optimistic-oracle question you care about and choose a bond and liveness window; justify both against the value at stake.',
    'For one bridge you would use, document the signer set size, threshold, upgrade authority and what happens if the set stops signing.'
  ],
  resources: [
    { type: 'docs', title: 'Chainlink VRF — request and receive randomness', url: 'https://docs.chain.link/vrf' },
    { type: 'docs', title: 'Chainlink Automation — checkUpkeep and performUpkeep', url: 'https://docs.chain.link/chainlink-automation' },
    { type: 'docs', title: 'UMA — how the optimistic oracle works', url: 'https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work' },
    { type: 'eip', title: 'EIP-712 — typed structured data signing', url: 'https://eips.ethereum.org/EIPS/eip-712' },
    { type: 'docs', title: 'drand — distributed randomness beacon', url: 'https://drand.love/docs/' }
  ]
});

})(window.ROADMAP.lessons);
