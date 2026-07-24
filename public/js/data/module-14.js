/* Module 14 — Chainlink Core Stack (lessons 63-66) */
(function (L) {

L.push({
  id: 'chainlink-ocr', module: 14, num: 63,
  title: 'Chainlink Data Feeds and OCR', level: 'Advanced', minutes: 75,
  summary: 'A Chainlink price is not fetched by your contract. Learn the off-chain reporting pipeline, what the on-chain aggregator actually verifies, and the trust assumptions hidden behind a familiar read call.',
  objectives: [
    'Trace a price from market sources through an OCR report to <code>latestRoundData()</code>',
    'Distinguish source aggregation, node quorum, transmission and consumer validation',
    'Explain why a threshold signature proves agreement, not market truth',
    'Identify the feed proxy, aggregator and configuration boundaries you must monitor'
  ],
  body: `
<h3>The read is simple; the system behind it is not</h3>
<p>Your contract calls <code>latestRoundData()</code> on a proxy. That call does <em>not</em> query exchanges, select reporters, or run a median. It reads the latest answer that an off-chain Decentralized Oracle Network (DON) has already agreed to publish. The useful mental model is: a Chainlink feed is a signed, on-chain checkpoint of an off-chain reporting process.</p>
<p>Each node gathers data from configured sources, builds an observation, and exchanges observations with the other nodes. The DON reaches a report according to its configured protocol and quorum; one transmitter submits the compact report on chain. The aggregator verifies that the report is authorised and stores a new round. This moves expensive communication and aggregation off chain while leaving a durable answer and audit trail on chain.</p>

<h3>Four claims, four different kinds of evidence</h3>
<div class="table-scroll"><table><thead><tr><th>Claim</th><th>Where it is established</th><th>What can still fail</th></tr></thead><tbody>
<tr><td>“This venue said 2,000”</td><td>Node source adapter</td><td>Venue halt, bad API, thin or manipulated market</td></tr>
<tr><td>“The DON agreed on this report”</td><td>OCR quorum / report signatures</td><td>Too many faulty or unavailable nodes; correlated sources</td></tr>
<tr><td>“This is an authorised feed update”</td><td>Aggregator contract</td><td>Wrong feed, changed configuration, stalled transmissions</td></tr>
<tr><td>“It is safe for <em>my</em> protocol”</td><td>Your consumer contract</td><td>Stale, wrong decimals, unsuitable heartbeat, bad risk limits</td></tr>
</tbody></table></div>
<p>OCR reduces on-chain gas and the number of transactions, but it does not turn an external fact into consensus truth. A quorum is evidence that the configured network agreed, under its fault assumptions. It is not evidence that the underlying market was liquid or that the answer is fresh enough for your liquidation engine. That final judgment remains yours.</p>

<h3>Why the proxy is part of the integration</h3>
<p>Consumers usually point at a stable <strong>proxy</strong>, while the proxy can be updated to a new aggregator implementation or configuration. This is how a feed can migrate without every integrator redeploying. It is also why an address copied from a block explorer is not the whole integration: record the chain, proxy address, pair, decimals, heartbeat, underlying aggregator, and the people or process authorised to change the proxy.</p>
<div class="note warn"><span class="tag">Do not infer a heartbeat</span><p>A feed can legitimately keep the same answer during a quiet market. Freshness is measured by <code>updatedAt</code> against the feed’s published update policy, not by whether the price value changed. A consumer that cannot tolerate the heartbeat should not use that feed for that risk path.</p></div>
`,
  code: [{ lang: 'solidity', file: 'InspectFeed.sol', caption: 'Read from the proxy, but emit the metadata an operator needs to pin and monitor. Addresses below are deployment inputs, never universal constants.', src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

contract FeedInspector {
    AggregatorV3Interface public immutable feedProxy;
    uint256 public immutable maxAge;
    error InvalidAnswer(int256 answer);
    error Stale(uint256 age, uint256 allowed);

    constructor(AggregatorV3Interface proxy, uint256 maxAge_) {
        feedProxy = proxy; maxAge = maxAge_;
    }

    function read() external view returns (uint256 answer, uint8 decimals_, uint80 roundId) {
        (roundId, int256 raw, , uint256 updatedAt, ) = feedProxy.latestRoundData();
        if (raw <= 0) revert InvalidAnswer(raw);
        uint256 age = block.timestamp - updatedAt;
        if (age > maxAge) revert Stale(age, maxAge);
        return (uint256(raw), feedProxy.decimals(), roundId);
    }
}` }],
  lab: 'chainlinkocr',
  quiz: [
    { q: 'What does an OCR quorum establish?', options: ['That every exchange price is true', 'That the configured oracle network agreed to an authorised report', 'That your contract’s risk limits are correct', 'That every node published an on-chain transaction'], answer: 1, why: 'The report is agreement evidence under the DON’s assumptions. Source quality and consumer suitability are separate questions.' },
    { q: 'Why should a consumer normally use a feed proxy rather than hard-coding an aggregator implementation?', options: ['A proxy makes reads free', 'The proxy provides a stable consumer address while the underlying aggregator can be migrated', 'Aggregators cannot expose latestRoundData', 'A proxy verifies exchange APIs'], answer: 1, why: 'The proxy is the compatibility boundary. Still monitor who can move it and validate the feed metadata after a migration.' },
    { q: 'A price value has not changed for 30 minutes. Is that alone proof the feed is stale?', options: ['Yes, every feed must change every block', 'No; a quiet market can publish the same answer, so check updatedAt against the documented policy', 'Yes, OCR refuses equal observations', 'No, timestamps are irrelevant'], answer: 1, why: 'Value equality is not freshness. The update timestamp and the integration’s permitted age are what matter.' }
  ],
  tasks: ['Find a feed on the network you use and record its proxy, decimals, description, current round and update timestamp.', 'Draw the trust boundary for one price: sources, DON, transmitter, proxy administration and your consumer.', 'Write a monitoring alert for a feed that is older than your protocol can safely tolerate.'],
  resources: [
    { type: 'docs', title: 'Chainlink Data Feeds — architecture', url: 'https://docs.chain.link/data-feeds/architecture' },
    { type: 'docs', title: 'Chainlink Data Feeds — API reference', url: 'https://docs.chain.link/data-feeds/api-reference' },
    { type: 'read', title: 'Chainlink 2.0 — Off-Chain Reporting', url: 'https://research.chain.link/whitepaper-v2.pdf' }
  ]
});

L.push({
  id: 'chainlink-feed-integration', module: 14, num: 64,
  title: 'Integrating and Monitoring a Chainlink Feed', level: 'Advanced', minutes: 80,
  summary: 'A feed address is a deployment dependency, not a magic constant. Build a consumer that validates its answer, normalises units, and gives operations a way to detect a migration or stalled update before it becomes a loss.',
  objectives: [
    'Choose a feed and max-age policy for a specific risk action',
    'Normalise feed decimals without a hidden 8-decimal assumption',
    'Separate risk-increasing and risk-reducing behaviour when a feed is unhealthy',
    'Detect proxy or metadata changes as operational events'
  ],
  body: `
<h3>Start from the action, not the address book</h3>
<p>“Use ETH/USD” is incomplete. A wallet display can tolerate a minute-old quote; an under-collateralised liquidation engine may need a much tighter policy; a daily-settled product may require something different again. Choose the feed <em>and</em> the maximum age from the damage a wrong or late answer can cause.</p>
<p>Read the proxy’s <code>decimals()</code> once at deployment or treat it as a runtime value. Never silently divide by <code>1e8</code>. Normalise into a known unit, preferably 18 decimals at your protocol boundary, then use only that unit internally. This keeps the feed boundary narrow and audit-friendly.</p>

<h3>Failure mode decides the product behaviour</h3>
<div class="table-scroll"><table><thead><tr><th>Action while price is unhealthy</th><th>Default</th><th>Reason</th></tr></thead><tbody>
<tr><td>Open borrow / mint / increase leverage</td><td>Block</td><td>A stale high collateral price creates unbacked credit</td></tr>
<tr><td>Repay debt / add collateral</td><td>Allow</td><td>Users should be able to make the system safer</td></tr>
<tr><td>Liquidate</td><td>Protocol-specific</td><td>Stopping can worsen bad debt; allowing can be unfair after an outage</td></tr>
<tr><td>Withdraw collateral</td><td>Usually block</td><td>It makes the position and system less safe</td></tr>
</tbody></table></div>
<p>There is no universal “fallback price.” A cached price is acceptable only when the action is explicitly designed around it and bounded. A catch block that returns the old price for new borrows is not resilience; it is a loan priced by an unknown moment in history.</p>

<h3>Monitor the thing you actually deployed</h3>
<p>Alert on age, non-positive or out-of-band answers, round progression, and configuration changes. On an L2, include the sequencer uptime feed and a post-recovery grace period. Keep the feed proxy address and expected metadata in deployment configuration, review changes through the same process as code changes, and rehearse the pause path.</p>
`,
  code: [{ lang: 'solidity', file: 'NormalisedPrice.sol', caption: 'One narrow boundary returns an 18-decimal USD price. The calling protocol gets either a value in a documented unit or a revert.', src: `pragma solidity ^0.8.24;

interface Feed { function decimals() external view returns (uint8); function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80); }

library Price {
    error BadPrice(); error StalePrice(); error UnsupportedDecimals();
    function usd18(Feed f, uint256 maxAge) internal view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) = f.latestRoundData();
        if (answer <= 0 || updatedAt == 0) revert BadPrice();
        if (block.timestamp - updatedAt > maxAge) revert StalePrice();
        uint8 d = f.decimals();
        if (d > 18) revert UnsupportedDecimals(); // use mulDiv if wider feeds are required
        return uint256(answer) * 10 ** (18 - d);
    }
}

contract BorrowGate {
    using Price for Feed;
    Feed public immutable ethUsd; uint256 public immutable maxAge;
    constructor(Feed feed, uint256 age) { ethUsd = feed; maxAge = age; }
    function borrow(uint256 collateralEth) external view returns (uint256 maxDebt) {
        uint256 p = ethUsd.usd18(maxAge); // reverts closed if unusable
        return collateralEth * p / 1e18 / 2; // example 50% LTV, all values 18-decimal
    }
}` }],
  lab: 'chainlinkfeed',
  quiz: [
    { q: 'Which action should normally remain possible during a feed outage?', options: ['Open a new borrow', 'Withdraw collateral', 'Repay debt or add collateral', 'Increase leverage'], answer: 2, why: 'Those actions reduce risk. Risk-increasing actions should fail closed until the price is usable again.' },
    { q: 'Why is dividing every answer by 1e8 unsafe?', options: ['All answers are already 18 decimals', 'Feed decimals vary; the same code can misprice an asset by many orders of magnitude', 'It consumes too much gas', 'OCR reports only float values'], answer: 1, why: 'The scale is part of the feed interface. Read it and normalise at a single boundary.' },
    { q: 'What should trigger a feed integration review?', options: ['Only a changed answer', 'A proxy/configuration or metadata change, as well as unhealthy answer conditions', 'Every block', 'Nothing after deployment'], answer: 1, why: 'A stable proxy allows migration. Treat that migration and unexpected metadata changes as meaningful operational events.' }
  ],
  tasks: ['Set a max age for a display, a borrow and a liquidation path; justify why the three values differ.', 'Write an outage matrix for your protocol: which functions fail closed, which remain available, and why.', 'Add a test that deploys a mock feed with 6, 8 and 18 decimals and proves the same 18-decimal output.'],
  resources: [
    { type: 'docs', title: 'Chainlink Data Feeds — selecting a feed', url: 'https://docs.chain.link/data-feeds/price-feeds/addresses' },
    { type: 'docs', title: 'Chainlink — L2 sequencer uptime feeds', url: 'https://docs.chain.link/data-feeds/l2-sequencer-feeds' },
    { type: 'read', title: 'Chainlink — monitoring data feeds', url: 'https://docs.chain.link/data-feeds/monitoring' }
  ]
});

L.push({
  id: 'chainlink-vrf', module: 14, num: 65,
  title: 'Chainlink VRF: Randomness as an Asynchronous Protocol', level: 'Advanced', minutes: 75,
  summary: 'VRF is not a random-number function call. It is a funded request, an asynchronous proof-backed fulfilment, and a consumer callback that must remain safe if it is delayed, retried or out of gas.',
  objectives: [
    'Model a VRF request and fulfilment as a state machine',
    'Choose confirmations, callback gas and word count from the settlement design',
    'Keep a callback idempotent and too small to grief',
    'Prevent players from re-rolling, claiming another player’s result or exploiting a delayed fulfilment'
  ],
  body: `
<h3>Request now, settle later</h3>
<p>A VRF coordinator receives a request tied to a subscription or funded payment path. After the required confirmations, the oracle produces random words and a proof; the coordinator verifies the proof and calls your consumer. This is deliberately asynchronous. Your request transaction cannot know the random outcome, and your fulfilment callback cannot assume the original caller is still present or that the outcome is cheap to process.</p>
<p>Store the request id, user, request-time configuration and lifecycle state. Associate every later action with that id. Do not use a mutable “current player” variable; a second request can overwrite it before the first callback arrives.</p>

<h3>The callback is an adversarial boundary</h3>
<p>Callback gas is chosen when you request. If fulfilment executes a complex mint, loops through an unbounded list, or calls an external contract that reverts, the random result may not be recorded. The robust pattern is tiny: store the word, mark fulfilment, emit an event. Let the user call a separate claim function that performs expensive settlement under ordinary transaction gas.</p>
<div class="note"><span class="tag">Confirmations are a trade-off</span><p>More confirmations raise the cost of influencing the request block but add latency. Pick them from the value at stake and the chain’s reorganisation properties. Document the choice; “the default” is not a security argument.</p></div>
`,
  code: [{ lang: 'solidity', file: 'RaffleConsumer.sol', caption: 'Coordinator details are omitted so the lifecycle is visible. The only privileged callback work is recording a verified result.', src: `pragma solidity ^0.8.24;

abstract contract VRFConsumerBase { function requestRandomWords() internal virtual returns (uint256); }

contract Raffle is VRFConsumerBase {
    struct Request { address player; uint256 word; bool fulfilled; bool claimed; }
    mapping(uint256 => Request) public request;
    error UnknownRequest(); error NotReady(); error NotPlayer(); error AlreadyClaimed();

    function enter() external returns (uint256 id) {
        id = requestRandomWords();
        request[id].player = msg.sender; // bind before fulfilment can arrive
    }

    function fulfillRandomWords(uint256 id, uint256[] calldata words) external /* onlyCoordinator */ {
        Request storage r = request[id];
        if (r.player == address(0)) revert UnknownRequest();
        if (r.fulfilled) return;              // retry-safe
        r.word = words[0]; r.fulfilled = true; // no mint, transfer or external call
    }

    function claim(uint256 id) external {
        Request storage r = request[id];
        if (!r.fulfilled) revert NotReady();
        if (msg.sender != r.player) revert NotPlayer();
        if (r.claimed) revert AlreadyClaimed();
        r.claimed = true;
        _settle(msg.sender, r.word);
    }
    function _settle(address player, uint256 word) internal { /* mint / assign prize */ }
}` }],
  lab: 'chainlinkvrf',
  quiz: [
    { q: 'Why should a VRF callback avoid minting a complex prize directly?', options: ['VRF cannot write storage', 'Callback gas is bounded and a reverting settlement can prevent recording the result', 'Random words expire after one block', 'Only users can mint'], answer: 1, why: 'Record first, then let a normal user transaction settle. This makes the paid-for randomness durable even if settlement is expensive.' },
    { q: 'What must be stored per request?', options: ['Only the latest random word', 'A request id with its player and lifecycle state', 'The coordinator private key', 'The block timestamp only'], answer: 1, why: 'Multiple requests are in flight. Per-request state prevents callbacks and claims from being mixed between users.' },
    { q: 'What is the security effect of more request confirmations?', options: ['It makes the output less random', 'It trades more latency for a higher cost to influence the request block', 'It removes the need for a callback', 'It lets users choose their outcome'], answer: 1, why: 'The correct value depends on the prize and the chain; it is a security/latency parameter, not decoration.' }
  ],
  tasks: ['Implement a mock coordinator test that fulfils requests out of order.', 'Make settlement revert, then prove the random word remains recorded and claim can be retried after fixing the settlement path.', 'Choose confirmations and callback gas for a raffle prize; write the value-at-risk argument.'],
  resources: [
    { type: 'docs', title: 'Chainlink VRF — request and receive random values', url: 'https://docs.chain.link/vrf/v2-5/overview' },
    { type: 'docs', title: 'Chainlink VRF — security considerations', url: 'https://docs.chain.link/vrf/v2-5/security' }
  ]
});

L.push({
  id: 'chainlink-automation', module: 14, num: 66,
  title: 'Chainlink Automation and Idempotent Upkeeps', level: 'Advanced', minutes: 70,
  summary: 'Automation can call a maintenance function when an off-chain simulation says work is needed. Design the on-chain function so it remains correct when checks are late, repeated, competing or temporarily unavailable.',
  objectives: [
    'Separate off-chain <code>checkUpkeep</code> simulation from on-chain <code>performUpkeep</code>',
    'Write an upkeep that is permissionless and idempotent',
    'Bound each execution so one job cannot exhaust gas or block the next',
    'Decide what your protocol does when automation is delayed or absent'
  ],
  body: `
<h3>Automation is a caller, not a clock</h3>
<p>Automation nodes simulate <code>checkUpkeep</code> off chain and, when it reports work, submit a transaction to <code>performUpkeep</code>. The simulation is a hint; only the latter changes chain state. Between them another user can execute the work, the condition can disappear, gas can rise, or the chain can be congested. Your contract must therefore validate its own preconditions at execution time.</p>
<p>Never make correctness depend on a particular keeper arriving at an exact time. If a task is safety-critical, expose a permissionless function that anyone can call and make the consequences of lateness explicit. Automation improves liveness; it does not replace a protocol’s liveness design.</p>

<h3>Idempotence is the core property</h3>
<p>Calling an upkeep twice should either do nothing on the second call or safely process the next bounded unit of work. Include a cursor or range in <code>performData</code>, recheck every item, and cap work per transaction. This makes retries, competing callers, and long backlogs routine rather than incident-shaped.</p>
<div class="note warn"><span class="tag">Do not trust performData</span><p>It is calldata supplied by a transaction. Validate it against current storage. A stale simulation result must not cause duplicate payouts, process an already-settled epoch, or access an arbitrary range of user state.</p></div>
`,
  code: [{ lang: 'solidity', file: 'BoundedUpkeep.sol', caption: 'The check suggests a bounded range; perform validates the range again and safely skips entries already completed by another caller.', src: `pragma solidity ^0.8.24;

contract BoundedUpkeep {
    uint256 public cursor; uint256 public constant BATCH = 20;
    mapping(uint256 => bool) public settled;

    function checkUpkeep(bytes calldata) external view returns (bool needed, bytes memory data) {
        uint256 end = cursor + BATCH;
        return (cursor < jobsLength(), abi.encode(cursor, end));
    }

    function performUpkeep(bytes calldata data) external {
        (uint256 start, uint256 end) = abi.decode(data, (uint256, uint256));
        uint256 length = jobsLength();
        if (start != cursor || start >= length) return; // stale or already handled
        end = end > length ? length : end;
        if (end - start > BATCH) end = start + BATCH;   // calldata cannot unbound gas
        for (uint256 i = start; i < end; ++i) {
            if (settled[i]) continue;
            settled[i] = true; // effects before interaction; _settle must be safe too
            _settle(i);
        }
        cursor = end;
    }
    function jobsLength() public view returns (uint256) { return 100; }
    function _settle(uint256) internal { }
}` }],
  lab: 'chainlinkautomation',
  quiz: [
    { q: 'Why must performUpkeep revalidate checkUpkeep’s result?', options: ['Simulation cannot read state', 'The world can change between simulation and the submitted transaction', 'It makes the callback random', 'Automation signs every item twice'], answer: 1, why: 'A user or another keeper may already have done the work. performUpkeep is the state-changing authority and must be correct by itself.' },
    { q: 'What does idempotent upkeep code mean?', options: ['It runs exactly once', 'Repeating it is harmless or safely advances a bounded next unit of work', 'It can only be called by one keeper', 'It skips all validation'], answer: 1, why: 'Retries and competition are normal distributed-systems behaviour. Make them uneventful.' },
    { q: 'What should a safety-critical protocol offer in addition to Automation?', options: ['A hidden owner-only function', 'A permissionless execution path and a defined response to lateness', 'A hard-coded gas price', 'No manual path'], answer: 1, why: 'Automation improves liveness but can be delayed. Correctness and recovery cannot depend on one external caller.' }
  ],
  tasks: ['Write a test where two callers submit the same performData and prove no job is settled twice.', 'Add a backlog test with more jobs than one batch and verify progress resumes from the cursor.', 'List the protocol consequences if no upkeep is executed for one hour, then design a permissionless recovery path.'],
  resources: [
    { type: 'docs', title: 'Chainlink Automation — overview', url: 'https://docs.chain.link/chainlink-automation' },
    { type: 'docs', title: 'Chainlink Automation — compatible contracts', url: 'https://docs.chain.link/chainlink-automation/guides/compatible-contracts' }
  ]
});

})(window.ROADMAP.lessons);
