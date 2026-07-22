/* Module 5 — Security & Gas (lessons 20-22) */
(function (L) {

L.push({
  id: 'l20', module: 5, num: 20,
  title: 'Reentrancy, Access Control and the Classics',
  level: 'Advanced', minutes: 85,
  summary: 'The bug classes that have drained the most money, how each one works mechanically, and the patterns that close them.',
  objectives: [
    'Trace a reentrancy attack call by call and fix it three different ways',
    'Distinguish single-function, cross-function and read-only reentrancy',
    'Design access control that survives key loss and operator error',
    'Recognise unchecked-return, delegatecall and self-destruct hazards'
  ],
  body: `
<h3>Reentrancy: the mechanics</h3>
<p>An external call hands control to the callee <em>in the middle of your function</em>. If you send ETH before updating your own state, the receiver's <code>receive()</code> can call back into you while your storage still says they have a balance.</p>
<pre><code>Attacker.attack()
  Vault.withdraw()            balance[att] = 10       // read
    att.call{value: 10}("")    ---- control transfers ----
      Attacker.receive()
        Vault.withdraw()      balance[att] STILL 10   // never updated
          att.call{value:10}  ...repeat until drained
    balance[att] = 0          // finally runs, far too late</code></pre>
<p>The DAO lost 3.6M ETH to exactly this in 2016 and it still appears in audits every month.</p>

<h3>Checks-Effects-Interactions</h3>
<ol>
  <li><strong>Checks</strong> — validate inputs and preconditions, revert early.</li>
  <li><strong>Effects</strong> — update <em>all</em> your own state.</li>
  <li><strong>Interactions</strong> — only now call anything external.</li>
</ol>
<p>Follow this ordering and the re-entrant call sees already-updated state, so it fails its own check. Add <code>nonReentrant</code> as defence in depth, not as a replacement for the ordering.</p>

<h3>Three flavours</h3>
<ul>
  <li><strong>Single-function</strong> — re-enter the same function. A simple mutex stops it.</li>
  <li><strong>Cross-function</strong> — re-enter a <em>different</em> function that shares state. A per-function mutex does not stop this; the guard must cover every function touching that state.</li>
  <li><strong>Read-only</strong> — re-enter a <code>view</code> function during a mid-transaction inconsistent state. No state is written, but an external protocol reading your price or share ratio sees a corrupted value and acts on it. Curve pools lost tens of millions this way in 2023. Guards on write functions do not help; the fix is to make the view function revert while a guard is engaged, or to make reads independent of transient state.</li>
</ul>

<h3>Access control</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Mistake</th><th>Consequence</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>Missing modifier on an admin function</td><td>Anyone calls it — the single most common critical finding</td><td>Test every privileged function from a non-privileged address</td></tr>
<tr><td>Uninitialized proxy implementation</td><td>Attacker initializes and takes ownership</td><td><code>_disableInitializers()</code> in the constructor</td></tr>
<tr><td><code>tx.origin</code> for auth</td><td>Any contract the user calls can impersonate them</td><td>Always <code>msg.sender</code></td></tr>
<tr><td>One-step ownership transfer</td><td>A typo in the address bricks the protocol permanently</td><td><code>Ownable2Step</code> — new owner must accept</td></tr>
<tr><td>EOA as owner</td><td>One phished key ends the protocol</td><td>Multisig, ideally behind a timelock</td></tr>
</tbody>
</table>
</div>

<h3>Other classics still landing</h3>
<ul>
  <li><strong>Unchecked return values</strong> — old ERC-20s return <code>false</code> instead of reverting; ignore it and you credit a transfer that never happened. Use <code>SafeERC20</code>.</li>
  <li><strong>Unsafe delegatecall</strong> — runs foreign code against <em>your</em> storage. Delegatecall to a user-supplied address is a total compromise.</li>
  <li><strong>Fee-on-transfer / rebasing tokens</strong> — the amount received is not the amount sent. Measure the balance delta, never trust the parameter.</li>
  <li><strong>Force-fed ETH</strong> — <code>selfdestruct</code> and block rewards bypass <code>receive()</code>, so <code>address(this).balance</code> can exceed your accounting. Never make it an invariant.</li>
  <li><strong>Weak randomness</strong> — <code>block.timestamp</code>, <code>blockhash</code> and <code>prevrandao</code> are all miner/validator-influenceable or predictable. Anything valuable needs a VRF or commit-reveal.</li>
</ul>
`,
  code: [
    {
      lang: 'solidity', file: 'Reentrancy.sol',
      caption: 'The bug, the attacker, and three independent fixes. Run this in Foundry and watch the vault drain.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// ============ VULNERABLE ============
contract BadVault {
    mapping(address => uint256) public balance;

    function deposit() external payable { balance[msg.sender] += msg.value; }

    function withdraw() external {
        uint256 amount = balance[msg.sender];
        require(amount > 0, "nothing to withdraw");

        // INTERACTION BEFORE EFFECT - control leaves while state is stale
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");

        balance[msg.sender] = 0;      // never reached until the loop unwinds
    }
}

// ============ ATTACKER ============
contract Attacker {
    BadVault immutable vault;
    constructor(BadVault v) { vault = v; }

    function attack() external payable {
        vault.deposit{value: 1 ether}();
        vault.withdraw();                       // starts the loop
        payable(msg.sender).transfer(address(this).balance);
    }

    receive() external payable {
        if (address(vault).balance >= 1 ether) vault.withdraw();  // re-enter
    }
}

// ============ FIX 1: checks-effects-interactions ============
contract GoodVault {
    mapping(address => uint256) public balance;

    function deposit() external payable { balance[msg.sender] += msg.value; }

    function withdraw() external {
        uint256 amount = balance[msg.sender];   // CHECK
        require(amount > 0, "nothing to withdraw");

        balance[msg.sender] = 0;                // EFFECT first

        (bool ok, ) = msg.sender.call{value: amount}("");  // INTERACTION last
        require(ok, "send failed");
    }
}

// ============ FIX 2: mutex (defence in depth, not a substitute) ============
abstract contract Guard {
    uint256 private _lock = 1;                  // 1/2 is cheaper than 0/1
    modifier nonReentrant() {
        require(_lock == 1, "reentrant");
        _lock = 2;
        _;
        _lock = 1;
    }
}

// ============ FIX 3: pull payments ============
contract PullVault {
    mapping(address => uint256) public owed;

    function credit(address to, uint256 amt) internal { owed[to] += amt; }

    /// Users withdraw for themselves. No external call inside protocol logic
    /// means no reentrancy surface at all.
    function claim() external {
        uint256 amount = owed[msg.sender];
        owed[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
    }
}`
    },
    {
      lang: 'solidity', file: 'ReadOnlyReentrancy.sol',
      caption: 'The subtle one. No state is corrupted permanently — but an external reader sees a lie mid-transaction and acts on it.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract Pool {
    uint256 public totalShares;
    uint256 public totalAssets;
    mapping(address => uint256) public shares;

    uint256 private _lock = 1;
    modifier nonReentrant() {
        require(_lock == 1, "reentrant");
        _lock = 2; _; _lock = 1;
    }

    /// Guarded - cannot be re-entered directly.
    function redeem(uint256 amt) external nonReentrant {
        uint256 assets = amt * totalAssets / totalShares;

        shares[msg.sender] -= amt;
        totalShares -= amt;                 // shares drop here...

        (bool ok, ) = msg.sender.call{value: assets}("");
        require(ok, "send failed");

        totalAssets -= assets;              // ...assets only drop here.
        // Between the two, price() is WRONG - and the external call above
        // gave the attacker control during exactly that window.
    }

    /// UNGUARDED VIEW - this is the hole.
    function price() public view returns (uint256) {
        return totalShares == 0 ? 1e18 : totalAssets * 1e18 / totalShares;
    }

    /// FIX: make reads revert while the guard is engaged, so any protocol
    /// reading mid-transaction fails loudly instead of trading on a bad price.
    function safePrice() public view returns (uint256) {
        require(_lock == 1, "reentrant read");
        return price();
    }
}

// A lender using pool.price() as collateral valuation can be made to see an
// inflated price during redeem() and issue an undercollateralised loan.
// This is the Curve read-only reentrancy class, ~$70M across 2022-2023.`
    },
    {
      lang: 'solidity', file: 'AccessControl.sol',
      caption: 'Roles, two-step ownership and a pause switch — the boring parts that decide whether an incident is survivable.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract Protocol is AccessControl, Pausable {
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    constructor(address admin, address pauser) {
        // admin = multisig behind a timelock.
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        // pauser = hot key: it can only stop the protocol, never move funds,
        // so a compromised pauser is an outage, not a loss.
        _grantRole(PAUSER_ROLE, pauser);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }

    // Unpausing is the dangerous direction - keep it with the admin.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function withdrawTreasury(address to, uint256 amt)
        external onlyRole(TREASURY_ROLE) whenNotPaused
    {
        (bool ok, ) = to.call{value: amt}("");
        require(ok, "send failed");
    }

    // tx.origin is NEVER auth: any contract the user calls inherits their origin.
    // require(tx.origin == owner);   <-- phishing-complete, do not write this
}`
    }
  ],
  lab: 'reentrancy',
  quiz: [
    {
      q: 'Why does checks-effects-interactions stop reentrancy without any mutex?',
      options: [
        'It blocks external calls',
        'State is already updated when control transfers, so the re-entrant call fails its own check',
        'It costs more gas than an attacker can pay',
        'It makes the function view'
      ],
      answer: 1,
      why: 'The attack depends on stale state during the external call. Zeroing the balance before the call means the second withdraw reads zero and reverts. The mutex is useful defence in depth, but the ordering is the actual fix.'
    },
    {
      q: 'A nonReentrant modifier guards every state-changing function. Are you safe from read-only reentrancy?',
      options: [
        'Yes, fully protected',
        'No — an unguarded view function can still be read mid-transaction while state is inconsistent, and an external protocol acts on the wrong value',
        'Yes, views cannot be reentered',
        'Only if the contract holds no ETH'
      ],
      answer: 1,
      why: 'The guard prevents writes, not reads. If an external call sits between two related state updates, any protocol reading your price or share ratio in that window gets a corrupted value. Make the view revert while the guard is engaged.'
    },
    {
      q: 'Why is tx.origin unsafe for authorisation?',
      options: [
        'It costs more gas',
        'It is the original EOA, so any contract the user is tricked into calling can act with their authority',
        'It is deprecated',
        'It returns a zero address'
      ],
      answer: 1,
      why: 'tx.origin stays the EOA through the whole call chain. A malicious contract the user interacts with can call your protocol and pass the tx.origin check. msg.sender is the immediate caller and is the only correct basis for auth.'
    }
  ],
  tasks: [
    'Use the lab to run the reentrancy attack step by step, then apply each of the three fixes and confirm the attack fails.',
    'Write a Foundry test that drains BadVault and passes against GoodVault unchanged.',
    'Audit one of your own contracts: list every external call and confirm no state update follows it.',
    'Find one real read-only reentrancy post-mortem and write the exact call sequence that produced the wrong price.'
  ],
  resources: [
    { type: 'read', title: 'Smart Contract Weakness Registry (SWC)', url: 'https://swcregistry.io/' },
    { type: 'code', title: 'Damn Vulnerable DeFi — exploit challenges', url: 'https://www.damnvulnerabledefi.xyz/' },
    { type: 'read', title: 'Rekt — incident post-mortems', url: 'https://rekt.news/' }
  ]
});

L.push({
  id: 'l21', module: 5, num: 21,
  title: 'Oracles, MEV and Economic Attacks',
  level: 'Advanced', minutes: 80,
  summary: 'The contract is correct and still loses money: manipulated prices, flash loans, sandwiches, and signatures replayed where they should not be.',
  objectives: [
    'Explain why a spot AMM price is not a price feed',
    'Use flash loans as the attacker does, and defend against them',
    'Describe the MEV supply chain and what sandwiching costs users',
    'Close signature replay with nonces, deadlines and domain separation'
  ],
  body: `
<h3>Spot price is not a price</h3>
<p>A constant-product pool's instantaneous price is just its current reserve ratio, and anyone with capital can move it inside a single transaction. Reading <code>getReserves()</code> and dividing is the single most exploited pattern in DeFi.</p>
<p>With a flash loan the capital requirement disappears entirely. In one atomic transaction: borrow 50M, dump it into the pool, read the now-wrong price from the victim, extract value, restore the pool, repay the loan. No collateral, no risk beyond gas.</p>

<h3>Oracle options</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Source</th><th>Manipulation cost</th><th>Latency</th><th>Use for</th></tr></thead>
<tbody>
<tr><td>AMM spot</td><td>Near zero with a flash loan</td><td>Instant</td><td>Nothing valuable</td></tr>
<tr><td>AMM TWAP (30 min)</td><td>Must hold the price across many blocks</td><td>Lags real moves</td><td>Low-stakes, deep pools only</td></tr>
<tr><td>Chainlink push feed</td><td>Requires compromising the oracle network</td><td>Heartbeat or deviation threshold</td><td>Lending, derivatives, liquidations</td></tr>
<tr><td>Pull oracle (Pyth, RedStone)</td><td>Signed by publishers, verified on chain</td><td>Sub-second</td><td>Perps, high-frequency needs</td></tr>
</tbody>
</table>
</div>
<p>Whichever you pick, validate it: reject stale rounds, reject zero or negative answers, check the round is complete, and enforce sane bounds. A feed that returns a stale price during volatility has caused more losses than one that was manipulated.</p>

<h3>MEV</h3>
<p>Maximal Extractable Value is profit a block producer (or anyone paying one) can capture by choosing transaction order.</p>
<ul>
  <li><strong>Arbitrage</strong> — equalises prices across venues. Benign, arguably useful.</li>
  <li><strong>Liquidations</strong> — competitive racing to close bad debt. Necessary for protocol health.</li>
  <li><strong>Sandwich</strong> — buy in front of a user's swap, let their trade push the price up, sell behind it. Pure extraction from the user, paid as extra slippage.</li>
  <li><strong>JIT liquidity</strong> — add concentrated liquidity one block before a large swap, collect the fee, remove it. Free-rides on real LPs.</li>
</ul>
<p>Defences that actually work: tight <code>minAmountOut</code> from a fresh quote, short deadlines, private mempools (Flashbots Protect, MEV Blocker), batch auctions (CoW Swap), and for protocols, commit-reveal or a design where ordering does not create value.</p>

<div class="note danger">
  <span class="tag">Never do this</span>
  <p><code>swapExactTokensForTokens(amountIn, 0, path, to, deadline)</code> — <code>minOut = 0</code> authorises unlimited slippage. A sandwich bot can take essentially the whole trade. Same for <code>deadline = type(uint256).max</code>: the transaction can sit pending for days and execute at a price from another era.</p>
</div>

<h3>Signature replay</h3>
<p>A signature is a bearer instrument. Every one of these must be present or it can be reused:</p>
<ul>
  <li><strong>Nonce</strong> — mark it used; reject the second submission.</li>
  <li><strong>Deadline</strong> — a signature with no expiry is valid forever.</li>
  <li><strong>chainId</strong> — otherwise it replays on every fork and every L2.</li>
  <li><strong>verifyingContract</strong> — otherwise it replays against a sibling deployment.</li>
  <li><strong>Malleability</strong> — for every valid <code>(r, s)</code> there is a valid <code>(r, N - s)</code>. Reject high-s values and <code>v ∉ {27, 28}</code>, or use OpenZeppelin's <code>ECDSA</code>.</li>
  <li><strong>ecrecover returning zero</strong> — an invalid signature yields <code>address(0)</code>. If your stored address is also zero, the check passes.</li>
</ul>
`,
  code: [
    {
      lang: 'solidity', file: 'OracleAttack.sol',
      caption: 'The vulnerable price read, the flash-loan attack that exploits it, and a validated feed.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// ============ VULNERABLE ============
contract BadLending {
    IUniswapV2Pair public pair;

    /// Spot reserves. Flash-loan manipulable inside one transaction.
    function getPrice() public view returns (uint256) {
        (uint112 r0, uint112 r1, ) = pair.getReserves();
        return uint256(r1) * 1e18 / uint256(r0);
    }

    function borrow(uint256 collateral) external {
        uint256 value = collateral * getPrice() / 1e18;
        _lend(msg.sender, value * 75 / 100);          // 75% LTV against a lie
    }
}

/*
  ATTACK (one atomic transaction, no capital required):
    1. flashLoan(50_000_000 USDC)
    2. swap all of it into the pool  -> collateral token price 10x
    3. BadLending.borrow(smallCollateral) -> huge loan at the inflated price
    4. swap back, restoring the pool
    5. repay the flash loan
    6. keep the borrowed funds
  Cost: gas plus the flash-loan fee. This is the Mango / Cream / bZx pattern.
*/

// ============ FIXED ============
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract GoodLending {
    AggregatorV3Interface public immutable feed;
    uint256 public constant MAX_STALENESS = 1 hours;   // match the feed heartbeat

    error StalePrice(uint256 age);
    error InvalidPrice();

    constructor(AggregatorV3Interface f) { feed = f; }

    function getPrice() public view returns (uint256) {
        (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound)
            = feed.latestRoundData();

        if (answer <= 0) revert InvalidPrice();                    // never trust a sign
        if (updatedAt == 0 || answeredInRound < roundId) revert InvalidPrice();
        uint256 age = block.timestamp - updatedAt;
        if (age > MAX_STALENESS) revert StalePrice(age);           // stale kills protocols

        return uint256(answer) * 1e10;   // Chainlink USD feeds are 8 decimals
    }
}`
    },
    {
      lang: 'solidity', file: 'SignatureSafety.sol',
      caption: 'Every replay vector closed at once: nonce, deadline, domain separator, malleability, zero-address.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract SafeSigs is EIP712 {
    using ECDSA for bytes32;

    // per-signer nonce: single-use signatures
    mapping(address => uint256) public nonces;

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(address to,uint256 amount,uint256 nonce,uint256 deadline)");

    error Expired();
    error BadSignature();

    constructor() EIP712("SafeSigs", "1") {}   // binds chainId + this address

    function claim(
        address to, uint256 amount, uint256 deadline, bytes calldata sig
    ) external {
        if (block.timestamp > deadline) revert Expired();          // 1. expiry

        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH, to, amount, nonces[to]++, deadline     // 2. nonce, consumed
        ));
        bytes32 digest = _hashTypedDataV4(structHash);             // 3. domain separated

        // ECDSA.recover reverts on malleable s, bad v, and address(0)  // 4, 5, 6
        address signer = digest.recover(sig);
        if (signer != to) revert BadSignature();

        _payout(to, amount);
    }
}

/*
  Raw ecrecover, for contrast - every line below is a real exploit class:

    address signer = ecrecover(hash, v, r, s);
    // no zero check      -> invalid sig returns address(0); if your stored
    //                       address is also 0, the comparison passes
    // no s bound         -> (r, N - s) is a second valid signature for the
    //                       same message: a nonce keyed by signature hash
    //                       can be bypassed once
    // no nonce           -> infinite replay
    // no deadline        -> valid forever
    // no domain          -> replays on every chain and sibling deployment
*/`
    },
    {
      lang: 'javascript', file: 'mev-defence.js',
      caption: 'Client-side slippage protection. Computing minOut from a fresh quote is what actually caps sandwich profit.',
      src: `// WRONG: unlimited slippage, sandwich bots take the whole trade
await router.swapExactTokensForTokens(
  amountIn, 0, path, to, ethers.MaxUint256   // minOut = 0, deadline = forever
);

// RIGHT: quote, apply a tolerance, use a short deadline
const quoted = await router.getAmountsOut(amountIn, path);
const expected = quoted[quoted.length - 1];

const BPS = 50n;                                    // 0.50%
const minOut = expected - (expected * BPS) / 10_000n;
const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);   // 5 minutes

await router.swapExactTokensForTokens(amountIn, minOut, path, to, deadline);

// Sandwich profit is bounded by the slippage you authorise. Tight tolerance
// makes most sandwiches unprofitable - they revert instead of extracting.

// Stronger: keep the transaction out of the public mempool entirely.
const provider = new ethers.JsonRpcProvider('https://rpc.flashbots.net');
// or https://rpc.mevblocker.io - the bots never see the transaction to front-run.`
    }
  ],
  lab: 'sandwich',
  quiz: [
    {
      q: 'Why is reading getReserves() from an AMM pool an unsafe price oracle?',
      options: [
        'Reserves update too slowly',
        'The ratio is manipulable within a single transaction, and a flash loan removes the capital requirement to do so',
        'It costs too much gas',
        'Uniswap does not expose it'
      ],
      answer: 1,
      why: 'Spot price is just the current reserve ratio. Any trade moves it, and a flash loan supplies unlimited capital atomically. This is the core mechanism behind bZx, Cream, Mango and many others.'
    },
    {
      q: 'What makes a sandwich attack possible?',
      options: [
        'A bug in the router',
        'Public mempool visibility plus loose slippage tolerance — the bot buys ahead, lets your trade move the price, sells behind',
        'Slow block times',
        'Reentrancy'
      ],
      answer: 1,
      why: 'The bot needs to see your pending swap and needs room to move the price within your minAmountOut. Removing either — a private RPC, or a tight tolerance — removes the profit.'
    },
    {
      q: 'A signed permit includes a nonce and a deadline but the domain omits chainId. What breaks?',
      options: [
        'Nothing important',
        'The signature can be replayed against the same contract address on a different chain, including forks and L2s',
        'The nonce stops working',
        'Gas costs rise'
      ],
      answer: 1,
      why: 'The nonce prevents reuse on one chain; it does not exist on the others. Deploy the same contract at the same address on another chain and the identical signature is valid there. chainId in the domain separator is what binds it.'
    }
  ],
  tasks: [
    'Use the lab to run a sandwich against your own trade at 0.1%, 1% and 5% slippage. Record the attacker profit for each.',
    'Add staleness, zero and round-completeness checks to any Chainlink read you have written.',
    'Write a fork test that manipulates a small pool with a flash loan and shows a spot-price oracle returning a wrong value.',
    'Take a signature scheme without a nonce and demonstrate the replay in a test, then close it.'
  ],
  resources: [
    { type: 'docs', title: 'Chainlink — data feed best practices', url: 'https://docs.chain.link/data-feeds/using-data-feeds' },
    { type: 'read', title: 'Flashbots documentation', url: 'https://docs.flashbots.net/' },
    { type: 'read', title: 'Flash Boys 2.0 (original MEV paper)', url: 'https://arxiv.org/abs/1904.05234' }
  ]
});

L.push({
  id: 'l22', module: 5, num: 22,
  title: 'Gas Optimisation and Upgradeability',
  level: 'Advanced', minutes: 75,
  summary: 'Where gas actually goes, the optimisations that are worth the readability cost, and how to change code that is supposed to be immutable.',
  objectives: [
    'Rank operations by real cost and optimise the expensive ones first',
    'Apply packing, caching and calldata correctly',
    'Explain proxy delegatecall, storage collisions and the initializer problem',
    'Choose between UUPS, transparent, diamond and immutable-plus-migration'
  ],
  body: `
<h3>Where the gas is</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Operation</th><th>Gas</th><th>Note</th></tr></thead>
<tbody>
<tr><td>SSTORE zero to non-zero</td><td>20,000</td><td>Dominates almost every function</td></tr>
<tr><td>SSTORE non-zero to non-zero</td><td>2,900</td><td>Much cheaper than the first write</td></tr>
<tr><td>SSTORE non-zero to zero</td><td>refund up to 4,800</td><td>Capped at 20% of the transaction</td></tr>
<tr><td>SLOAD (cold / warm)</td><td>2,100 / 100</td><td>EIP-2929 access lists</td></tr>
<tr><td>External call (cold / warm)</td><td>2,600 / 100</td><td>Plus the callee's own cost</td></tr>
<tr><td>Calldata byte (non-zero / zero)</td><td>16 / 4</td><td>Why L2 calldata compression matters</td></tr>
<tr><td>keccak256</td><td>30 + 6/word</td><td>Cheap</td></tr>
<tr><td>Arithmetic, memory, stack</td><td>3-5</td><td>Effectively free by comparison</td></tr>
</tbody>
</table>
</div>
<p>Storage is 1000x arithmetic. Optimise storage access, contract calls and calldata size. Micro-optimising loop arithmetic while writing three separate storage slots is wasted effort.</p>

<h3>Optimisations that pay</h3>
<ul>
  <li><strong>Pack structs and storage variables</strong> — group values that fit in 32 bytes together. <code>uint128 + uint64 + uint32 + bool</code> is one slot instead of four. Order matters: the compiler packs sequentially and does not reorder.</li>
  <li><strong>Cache storage in memory</strong> — read a storage variable once into a local, use the local in the loop, write back once.</li>
  <li><strong>calldata over memory</strong> for external function array and string parameters — skips the copy entirely.</li>
  <li><strong>Custom errors over require strings</strong> — a string literal costs bytecode and gas; a 4-byte selector does not.</li>
  <li><strong>immutable / constant</strong> — inlined into bytecode, no SLOAD at all.</li>
  <li><strong>unchecked</strong> where overflow is provably impossible, typically loop counters.</li>
  <li><strong>Short-circuit ordering</strong> — put the cheap check first so the expensive one is skipped on failure.</li>
</ul>

<div class="note warn">
  <span class="tag">Optimisations that cost more than they save</span>
  <p>Using <code>uint8</code> for a standalone variable is <em>more</em> expensive — the EVM word is 256 bits and narrowing needs masking. Packing only helps when values share a slot. Likewise, assembly for a 200-gas saving buys you a new audit surface: measure first, and keep <code>forge snapshot</code> in CI so you know the number rather than guessing.</p>
</div>

<h3>Upgradeability</h3>
<p>Deployed bytecode is immutable. Upgradeable systems put a permanent <strong>proxy</strong> in front: it holds the storage and the address, and <code>delegatecall</code>s all logic to an implementation contract that can be swapped. Because delegatecall runs foreign code in <em>your</em> storage context, layout compatibility becomes a hard safety requirement.</p>
<ul>
  <li><strong>Storage collision</strong> — the proxy's own variables must not overlap the implementation's. Solved by EIP-1967, which puts the implementation address at a hashed pseudo-random slot.</li>
  <li><strong>Append only</strong> — never reorder, remove or change the type of an existing variable across versions. Add new ones at the end. Reserve <code>uint256[50] __gap</code> in upgradeable base contracts.</li>
  <li><strong>No constructors</strong> — constructor code runs against the implementation's storage, not the proxy's. Use an <code>initialize()</code> function with the <code>initializer</code> modifier, and call <code>_disableInitializers()</code> in the implementation constructor so nobody can seize the implementation directly.</li>
</ul>

<h3>Choosing a pattern</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Pattern</th><th>Upgrade logic lives in</th><th>Trade-off</th></tr></thead>
<tbody>
<tr><td>Transparent</td><td>Proxy</td><td>Higher per-call gas; solves selector clashing</td></tr>
<tr><td>UUPS</td><td>Implementation</td><td>Cheaper calls; a version without the upgrade function bricks it forever</td></tr>
<tr><td>Beacon</td><td>Shared beacon</td><td>Upgrade many proxies at once; extra indirection</td></tr>
<tr><td>Diamond (EIP-2535)</td><td>Facet registry</td><td>No size limit, per-function routing; genuinely complex</td></tr>
<tr><td>Immutable + migration</td><td>Nowhere</td><td>Maximum trust; users must move funds to v2</td></tr>
</tbody>
</table>
</div>
<p>An upgradeable contract is a contract whose owner can replace all its logic. That is a trust assumption, not a feature — which is why the upgrade key belongs to a multisig behind a timelock, always.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'GasOptimised.sol',
      caption: 'Same behaviour, roughly a third of the gas. Every change targets storage, calldata or bytecode — never arithmetic.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// ============ BEFORE ============
contract Unoptimised {
    uint256 public totalUsers;      // slot 0
    bool public paused;             // slot 1  (wastes 31 bytes)
    uint256 public fee;             // slot 2
    address public owner;           // slot 3  (wastes 12 bytes)

    struct User { uint256 balance; uint256 lastSeen; bool active; }  // 3 slots
    mapping(address => User) public users;

    function batchCredit(address[] memory to, uint256[] memory amt) external {
        require(msg.sender == owner, "not owner");      // string in bytecode
        require(to.length == amt.length, "length mismatch");

        for (uint256 i = 0; i < to.length; i++) {       // .length read each pass
            users[to[i]].balance += amt[i];
            users[to[i]].lastSeen = block.timestamp;     // second mapping lookup
            totalUsers++;                                // SSTORE every iteration
        }
    }
}

// ============ AFTER ============
contract Optimised {
    // slot 0: 12 + 1 + 12 = 25 bytes, one slot instead of four
    uint96  public totalUsers;      // 12 bytes, ample
    bool    public paused;          // 1 byte
    address public immutable owner; // 20 bytes... does not fit, so:
    // -> immutable lives in BYTECODE, not storage. Zero SLOAD, zero slot used.

    uint256 public fee;             // slot 1

    struct User {
        uint128 balance;            // ┐
        uint64  lastSeen;           // ├ one slot: 16 + 8 + 1 = 25 bytes
        bool    active;             // ┘
    }
    mapping(address => User) public users;

    error NotOwner();               // 4-byte selector, no string in bytecode
    error LengthMismatch();

    constructor() { owner = msg.sender; }

    function batchCredit(
        address[] calldata to,      // calldata: no memory copy
        uint128[] calldata amt
    ) external {
        if (msg.sender != owner) revert NotOwner();
        uint256 len = to.length;                     // cached
        if (len != amt.length) revert LengthMismatch();

        uint96 added;                                 // accumulate in memory
        for (uint256 i; i < len;) {
            User storage u = users[to[i]];            // ONE mapping lookup
            u.balance  += amt[i];
            u.lastSeen  = uint64(block.timestamp);    // same slot, packed
            unchecked { ++i; ++added; }               // cannot overflow: i < len
        }
        totalUsers += added;                          // ONE SSTORE, not len of them
    }
}

// forge snapshot --diff   ->  batchCredit(10): 247,301 -> 91,455 gas`
    },
    {
      lang: 'solidity', file: 'UUPSUpgradeable.sol',
      caption: 'A UUPS upgradeable contract with the three rules that keep it safe: disabled initializers, a storage gap, and an append-only V2.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract VaultV1 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // ---- storage: APPEND ONLY across versions ----
    mapping(address => uint256) public balance;   // slot 0
    uint256 public totalDeposits;                 // slot 1

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Stops anyone initializing the IMPLEMENTATION directly and
        // taking ownership of it. Missing this is a real, repeated exploit.
        _disableInitializers();
    }

    /// Replaces the constructor. Runs once, against the PROXY's storage.
    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
    }

    function deposit() external payable {
        balance[msg.sender] += msg.value;
        totalDeposits += msg.value;
    }

    /// The only thing standing between a user and total loss.
    /// In production: onlyOwner where owner is a multisig behind a timelock.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// Reserved slots so V2 can add variables without colliding with any
    /// state a future base contract introduces.
    uint256[48] private __gap;
}

// ============ V2: append only ============
contract VaultV2 is VaultV1 {
    // MUST come after every V1 variable. Reordering or inserting above
    // reinterprets existing storage - balances become garbage.
    uint256 public withdrawalFeeBps;    // new slot, appended

    function initializeV2(uint256 feeBps) external reinitializer(2) {
        withdrawalFeeBps = feeBps;
    }

    function withdraw(uint256 amt) external {
        balance[msg.sender] -= amt;
        totalDeposits -= amt;
        uint256 fee = amt * withdrawalFeeBps / 10_000;
        (bool ok, ) = msg.sender.call{value: amt - fee}("");
        require(ok, "send failed");
    }
}

// Validate before shipping - this catches layout breakage:
//   forge clean && forge build
//   npx @openzeppelin/upgrades-core validate out/build-info`
    }
  ],
  lab: 'gasopt',
  quiz: [
    {
      q: 'Which change saves the most gas in a typical function?',
      options: [
        'Replacing i++ with ++i',
        'Packing three storage writes into one slot, eliminating two SSTOREs',
        'Shortening variable names',
        'Using uint8 instead of uint256 for a standalone variable'
      ],
      answer: 1,
      why: 'An SSTORE is 20,000 gas cold and 2,900 warm; arithmetic is 3-5. Removing storage writes dwarfs every micro-optimisation. A standalone uint8 is actually worse than uint256 because of masking overhead.'
    },
    {
      q: 'Why must an upgradeable contract use initialize() instead of a constructor?',
      options: [
        'Constructors are deprecated',
        'Constructor code runs in the implementation\\u2019s context, so the proxy\\u2019s storage would never be set',
        'It saves gas',
        'Solidity forbids it'
      ],
      answer: 1,
      why: 'The proxy delegatecalls the implementation, but the constructor already ran at implementation deploy time against implementation storage. The proxy would be left uninitialized. Hence initialize() plus _disableInitializers() on the implementation.'
    },
    {
      q: 'V2 inserts a new variable *before* an existing one in the storage layout. What happens?',
      options: [
        'The compiler rejects it',
        'Every subsequent variable shifts one slot, so existing storage is reinterpreted as the wrong values — balances become garbage',
        'Nothing, layout is dynamic',
        'Only new users are affected'
      ],
      answer: 1,
      why: 'Slots are assigned by declaration order and the proxy keeps the old data. Shifting the layout means old bytes are read as a different variable. Always append; keep a __gap; run the upgrades validator in CI.'
    }
  ],
  tasks: [
    'Use the lab to pack a struct and compare the slot count and gas before and after.',
    'Run forge snapshot on one of your contracts, apply three optimisations, and report the measured diff.',
    'Deploy a UUPS proxy on a testnet, upgrade it to a V2 that appends a variable, and confirm existing state survives.',
    'Deliberately break the layout by inserting a variable at the top and observe what the stored balances become.'
  ],
  resources: [
    { type: 'docs', title: 'OpenZeppelin Upgrades — writing upgradeable contracts', url: 'https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable' },
    { type: 'eip', title: 'EIP-1967 — standard proxy storage slots', url: 'https://eips.ethereum.org/EIPS/eip-1967' },
    { type: 'read', title: 'EVM opcode gas reference', url: 'https://www.evm.codes/' }
  ]
});

})(window.ROADMAP.lessons);
