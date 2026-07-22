/* Module 6 — DeFi, Scaling & Capstone (lessons 23-26) */
(function (L) {

L.push({
  id: 'l23', module: 6, num: 23,
  title: 'AMMs and Decentralised Exchanges',
  level: 'Advanced', minutes: 80,
  summary: 'Derive the constant-product formula from scratch, price a swap by hand, and understand what impermanent loss really costs a liquidity provider.',
  objectives: [
    'Derive and apply x·y=k including fees',
    'Compute price impact and explain why it grows non-linearly',
    'Quantify impermanent loss for a given price move',
    'Compare constant product, stable-swap and concentrated liquidity'
  ],
  body: `
<h3>Why not an order book?</h3>
<p>On-chain order books need cheap, frequent updates: every quote change is a transaction. At Ethereum L1 gas prices that is unaffordable. An automated market maker replaces the book with a formula — liquidity sits in a pool and price is a function of the reserves. It is always quotable, always available, and needs no counterparty.</p>

<h3>Constant product</h3>
<p>The invariant is <code>x · y = k</code>. Reserves of the two tokens multiply to a constant. Swapping means moving along that hyperbola.</p>
<p>Selling <code>dx</code> of token X for token Y, with a fee rate <code>f</code> (0.003 for 0.3%):</p>
<pre><code>dx_eff = dx · (1 − f)
dy     = (y · dx_eff) / (x + dx_eff)</code></pre>
<p>The spot price before the trade is <code>y / x</code>. The <em>executed</em> price is <code>dy / dx</code>, which is always worse — and the gap grows with trade size relative to pool depth. That gap is <strong>price impact</strong>, and it is what makes flash-loan manipulation of small pools so effective.</p>
<p>Notice the pool can never be emptied: as <code>dx</code> grows, <code>dy</code> asymptotically approaches <code>y</code> but never reaches it. Draining a pool requires infinite input.</p>

<h3>Impermanent loss</h3>
<p>An LP holds a claim on reserves that rebalance automatically. When the price of one asset moves, arbitrageurs trade against the pool until it matches the market — leaving the LP with more of the asset that fell and less of the one that rose. Compared to simply holding both tokens, that is a loss.</p>
<p>For a price ratio change of <code>r</code>:</p>
<pre><code>IL = 2·√r / (1 + r) − 1</code></pre>
<div class="table-scroll">
<table>
<thead><tr><th>Price change</th><th>IL vs holding</th></tr></thead>
<tbody>
<tr><td>1.25x</td><td>−0.6%</td></tr>
<tr><td>1.5x</td><td>−2.0%</td></tr>
<tr><td>2x</td><td>−5.7%</td></tr>
<tr><td>4x</td><td>−20.0%</td></tr>
<tr><td>10x</td><td>−42.5%</td></tr>
</tbody>
</table>
</div>
<p>"Impermanent" is a misleading name: it only reverses if the price returns to where it started. Withdraw at a different price and the loss is realised. LPing is profitable only when accumulated fees exceed IL — which is why correlated pairs (stablecoins, ETH/stETH) and high-volume pairs dominate.</p>

<h3>The design space</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Design</th><th>Invariant</th><th>Best for</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>Uniswap V2</td><td>x·y=k</td><td>Any pair, zero maintenance</td><td>Capital spread across all prices, most of it unused</td></tr>
<tr><td>Curve stable-swap</td><td>Hybrid constant-sum / constant-product</td><td>Pegged assets</td><td>Breaks badly if the peg breaks</td></tr>
<tr><td>Uniswap V3</td><td>x·y=k within a chosen range</td><td>Capital efficiency</td><td>Active management; out-of-range positions earn nothing</td></tr>
<tr><td>Uniswap V4</td><td>V3 plus hooks</td><td>Custom logic per pool</td><td>Hook code is now part of your risk</td></tr>
</tbody>
</table>
</div>
<p>Concentrated liquidity is the big one: providing only between $1,800 and $2,200 instead of $0 to infinity can be 100x more capital efficient — while the price stays in range. Outside it, the position is entirely in one asset and earns nothing. It converts passive LPing into an active position with real management risk.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'MiniAMM.sol',
      caption: 'A complete constant-product AMM: liquidity accounting, swap maths, and the k-invariant check that makes it safe.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// Teaching implementation of x*y=k. Production pools add TWAP oracles,
/// flash swaps, protocol fees and far more careful rounding.
contract MiniAMM {
    using SafeERC20 for IERC20;

    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint112 private reserve0;
    uint112 private reserve1;

    uint256 public totalShares;
    mapping(address => uint256) public shares;

    uint256 private constant FEE_BPS = 30;        // 0.30%
    uint256 private constant MIN_LIQUIDITY = 1000; // burned, blocks share inflation

    error InsufficientOutput();
    error InsufficientLiquidity();
    error KInvariant();

    constructor(IERC20 a, IERC20 b) { token0 = a; token1 = b; }

    function getReserves() public view returns (uint112, uint112) {
        return (reserve0, reserve1);
    }

    // ---------------- liquidity ----------------
    function addLiquidity(uint256 amt0, uint256 amt1) external returns (uint256 minted) {
        (uint112 r0, uint112 r1) = getReserves();

        if (totalShares == 0) {
            minted = _sqrt(amt0 * amt1) - MIN_LIQUIDITY;
            totalShares = MIN_LIQUIDITY;          // permanently locked
        } else {
            // must deposit at the current ratio, else you gift value to the pool
            minted = _min(amt0 * totalShares / r0, amt1 * totalShares / r1);
        }
        if (minted == 0) revert InsufficientLiquidity();

        token0.safeTransferFrom(msg.sender, address(this), amt0);
        token1.safeTransferFrom(msg.sender, address(this), amt1);

        shares[msg.sender] += minted;
        totalShares += minted;
        _update();
    }

    function removeLiquidity(uint256 amount) external returns (uint256 out0, uint256 out1) {
        (uint112 r0, uint112 r1) = getReserves();

        out0 = amount * r0 / totalShares;
        out1 = amount * r1 / totalShares;

        shares[msg.sender] -= amount;             // effects before interactions
        totalShares -= amount;

        token0.safeTransfer(msg.sender, out0);
        token1.safeTransfer(msg.sender, out1);
        _update();
    }

    // ---------------- swap ----------------
    /// Quote helper: dy = (y * dx * 9970) / (x * 10000 + dx * 9970)
    function getAmountOut(uint256 amountIn, uint256 rIn, uint256 rOut)
        public pure returns (uint256)
    {
        uint256 inWithFee = amountIn * (10_000 - FEE_BPS);
        return (inWithFee * rOut) / (rIn * 10_000 + inWithFee);
    }

    function swap(bool zeroForOne, uint256 amountIn, uint256 minOut)
        external returns (uint256 amountOut)
    {
        (uint112 r0, uint112 r1) = getReserves();
        (uint256 rIn, uint256 rOut) = zeroForOne ? (uint256(r0), uint256(r1))
                                                 : (uint256(r1), uint256(r0));

        amountOut = getAmountOut(amountIn, rIn, rOut);
        if (amountOut < minOut) revert InsufficientOutput();   // caller's slippage bound

        (IERC20 tIn, IERC20 tOut) = zeroForOne ? (token0, token1) : (token1, token0);
        tIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tOut.safeTransfer(msg.sender, amountOut);

        // k must never decrease. This single check is what makes the pool safe
        // against any arithmetic mistake above it.
        uint256 n0 = token0.balanceOf(address(this));
        uint256 n1 = token1.balanceOf(address(this));
        if (n0 * n1 < uint256(r0) * uint256(r1)) revert KInvariant();

        _update();
    }

    function _update() private {
        reserve0 = uint112(token0.balanceOf(address(this)));
        reserve1 = uint112(token1.balanceOf(address(this)));
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) { return a < b ? a : b; }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) { z = y; uint256 x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; } }
        else if (y != 0) { z = 1; }
    }
}`
    },
    {
      lang: 'javascript', file: 'amm-math.js',
      caption: 'The same maths off-chain: quoting, price impact, and impermanent loss.',
      src: `const FEE = 0.003;   // 0.30%

// Output for a given input along x*y=k
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const inWithFee = amountIn * (1 - FEE);
  return (inWithFee * reserveOut) / (reserveIn + inWithFee);
}

// How far the executed price sits from the pre-trade spot price
function priceImpact(amountIn, reserveIn, reserveOut) {
  const spot     = reserveOut / reserveIn;
  const out      = getAmountOut(amountIn, reserveIn, reserveOut);
  const executed = out / amountIn;
  return (spot - executed) / spot;          // fraction, 0.01 = 1%
}

// Impermanent loss vs holding, for a price ratio change r
function impermanentLoss(r) {
  return (2 * Math.sqrt(r)) / (1 + r) - 1;  // negative
}

// Pool: 100 ETH / 200,000 USDC  (spot 2000 USDC per ETH)
getAmountOut(1,   100, 200_000);  // 1,974 USDC   impact  ~1.3%
getAmountOut(10,  100, 200_000);  // 18,132 USDC  impact  ~9.3%
getAmountOut(50,  100, 200_000);  // 66,466 USDC  impact ~33.5%  <- thin pool

impermanentLoss(2);    // -0.0572  ->  5.72% worse than holding
impermanentLoss(4);    // -0.2000  -> 20.0%
impermanentLoss(0.5);  // -0.0572  ->  symmetric: down 2x hurts the same

// LP profit = accumulated fees - IL. Fees scale with VOLUME, IL with the
// SIZE OF THE PRICE MOVE. High volume plus low volatility is the good regime.`
    }
  ],
  lab: 'amm',
  quiz: [
    {
      q: 'A pool holds 100 ETH and 200,000 USDC. Why does selling 50 ETH get far less than 50 × 2000 USDC?',
      options: [
        'Fees take the difference',
        'Price impact — each unit sold moves the reserve ratio, so later units execute at progressively worse prices along the x·y=k curve',
        'The pool is broken',
        'USDC has 6 decimals'
      ],
      answer: 1,
      why: 'Spot price 2000 applies only to an infinitesimal trade. Selling half the pool depth pushes far along the curve: the executed price is roughly 1,329 per ETH, about 33% impact. Fees are only 0.3% of that gap.'
    },
    {
      q: 'ETH doubles in price. What does an ETH/USDC LP experience?',
      options: [
        'A 100% gain, same as holding ETH',
        'About 5.7% less value than simply holding both tokens, because arbitrage rebalanced them into the asset that fell',
        'No change',
        'A total loss'
      ],
      answer: 1,
      why: 'IL = 2√2/(1+2) − 1 ≈ −5.72%. The LP still gains in absolute terms; they just gain less than holding. Fees earned over the period may or may not cover the gap.'
    },
    {
      q: 'What is the main risk of a concentrated liquidity position?',
      options: [
        'Higher gas',
        'Price leaving the chosen range: the position becomes 100% one asset and earns zero fees until it returns',
        'Smart contract risk only',
        'Nothing, it is strictly better'
      ],
      answer: 1,
      why: 'Concentration multiplies capital efficiency inside the range and gives you nothing outside it. It also amplifies IL within the range. Passive LPing becomes an actively managed position.'
    }
  ],
  tasks: [
    'Use the lab to swap against a pool and record price impact at 1%, 10% and 50% of pool depth.',
    'Compute IL for a 3x price move by hand, then verify with the formula.',
    'Deploy MiniAMM locally, seed it, and write a fuzz test asserting k never decreases across any swap.',
    'Model a concentrated position between 1,800 and 2,200 and calculate its efficiency multiplier versus full range.'
  ],
  resources: [
    { type: 'read', title: 'Uniswap V2 whitepaper', url: 'https://uniswap.org/whitepaper.pdf' },
    { type: 'read', title: 'Uniswap V3 whitepaper (concentrated liquidity)', url: 'https://uniswap.org/whitepaper-v3.pdf' },
    { type: 'read', title: 'Curve StableSwap paper', url: 'https://curve.fi/files/stableswap-paper.pdf' }
  ]
});

L.push({
  id: 'l24', module: 6, num: 24,
  title: 'Lending, Stablecoins and Liquidations',
  level: 'Advanced', minutes: 80,
  summary: 'Overcollateralised credit without identity: health factors, interest rate curves, liquidation incentives, and how stablecoins hold a peg.',
  objectives: [
    'Compute a health factor and the exact liquidation price',
    'Explain utilisation-based interest rate models',
    'Describe the liquidation auction and why the bonus exists',
    'Compare collateralised, algorithmic and fiat-backed stablecoins'
  ],
  body: `
<h3>Credit without identity</h3>
<p>No credit checks, no recourse, no courts. The only enforcement mechanism is collateral held by the contract, so every loan is overcollateralised: deposit $150 of ETH, borrow at most $100 of USDC.</p>

<h3>Health factor</h3>
<pre><code>HF = Σ(collateral · price · liquidationThreshold) / Σ(debt · price)</code></pre>
<p><code>HF &lt; 1</code> means anyone may liquidate the position. Worked example — 10 ETH at $2,000, 82.5% threshold, $10,000 of debt:</p>
<pre><code>HF = (10 · 2000 · 0.825) / 10000 = 1.65
liquidation price = 10000 / (10 · 0.825) = $1,212</code></pre>
<p>ETH falling to $1,212 puts the position at HF = 1.0. Note the two distinct parameters: <strong>LTV</strong> caps what you may borrow at open, while the <strong>liquidation threshold</strong> is where you get liquidated. The gap between them is your buffer.</p>

<h3>Interest rates from utilisation</h3>
<p>Rates are algorithmic, not set by anyone. Utilisation <code>U = borrowed / supplied</code> drives a kinked curve:</p>
<pre><code>U ≤ kink:   rate = base + (U / kink) · slope1          // gentle
U &gt; kink:   rate = base + slope1 + ((U − kink)/(1 − kink)) · slope2   // steep</code></pre>
<p>Below the kink (typically 80%) borrowing stays cheap. Above it the rate climbs violently — often to 100%+ APR at full utilisation. That spike is a control mechanism: it forces repayment and attracts new deposits so lenders can always withdraw. A protocol at 100% utilisation with a flat curve has effectively frozen its lenders' funds.</p>

<h3>Liquidation</h3>
<p>Liquidators repay part of the debt and receive collateral at a discount — typically 5-10%. That bonus is not a gift; it is the payment for a service the protocol cannot perform itself. Without a profitable incentive, underwater positions sit unliquidated and the shortfall becomes protocol bad debt.</p>
<p>Liquidation is intensely competitive MEV: bots monitor every position, and the moment HF drops below 1 they race to submit. Most use a flash loan, so they need no capital at all.</p>

<div class="note warn">
  <span class="tag">Cascade risk</span>
  <p>Price falls, positions liquidate, liquidators dump collateral on the market, price falls further, more positions liquidate. Add thin liquidity and the spiral outruns the oracle. This is how protocols end up with bad debt despite being "overcollateralised" — and why parameters (thresholds, caps, bonuses) are risk management, not configuration.</p>
</div>

<h3>Stablecoins</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Type</th><th>Backing</th><th>Failure mode</th></tr></thead>
<tbody>
<tr><td>Fiat-backed (USDC, USDT)</td><td>Bank deposits and T-bills</td><td>Custodian or banking failure; censorship and freezes</td></tr>
<tr><td>Crypto-collateralised (DAI)</td><td>Overcollateralised crypto</td><td>Collateral crash faster than liquidation can respond</td></tr>
<tr><td>Algorithmic (UST)</td><td>A mint-and-burn mechanism only</td><td>Reflexive death spiral — $40B in three days</td></tr>
<tr><td>Delta-neutral (USDe)</td><td>Spot long plus perp short</td><td>Sustained negative funding; exchange counterparty risk</td></tr>
</tbody>
</table>
</div>
<p>Terra/UST is the reference lesson: the mechanism only worked while demand grew. When redemptions exceeded what the peg arbitrage could absorb, minting LUNA to defend the peg crashed LUNA, which destroyed the backing, which broke the peg further. Backing that is denominated in your own token is not backing.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'MiniLending.sol',
      caption: 'Health factor, borrow limits and a liquidation path with a bonus — the whole model in one contract.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IOracle { function price(address asset) external view returns (uint256); }

contract MiniLending {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;   // e.g. WETH
    IERC20 public immutable debtToken;         // e.g. USDC
    IOracle public immutable oracle;

    uint256 public constant LTV_BPS       = 7500;  // may borrow up to 75%
    uint256 public constant THRESHOLD_BPS = 8250;  // liquidatable below 82.5%
    uint256 public constant BONUS_BPS     = 10500; // liquidator gets +5%
    uint256 public constant CLOSE_FACTOR  = 5000;  // max 50% of debt per call

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;

    error Undercollateralised();
    error Healthy();

    constructor(IERC20 c, IERC20 d, IOracle o) {
        collateralToken = c; debtToken = d; oracle = o;
    }

    // ---------------- core accounting ----------------
    function collateralValue(address u) public view returns (uint256) {
        return collateral[u] * oracle.price(address(collateralToken)) / 1e18;
    }

    function debtValue(address u) public view returns (uint256) {
        return debt[u] * oracle.price(address(debtToken)) / 1e18;
    }

    /// 1e18 == exactly at the liquidation boundary. Below 1e18 = liquidatable.
    function healthFactor(address u) public view returns (uint256) {
        uint256 d = debtValue(u);
        if (d == 0) return type(uint256).max;                  // no debt, no risk
        return collateralValue(u) * THRESHOLD_BPS * 1e18 / (d * 10_000);
    }

    // ---------------- user actions ----------------
    function deposit(uint256 amt) external {
        collateral[msg.sender] += amt;
        collateralToken.safeTransferFrom(msg.sender, address(this), amt);
    }

    function borrow(uint256 amt) external {
        debt[msg.sender] += amt;                               // effects first

        // LTV is the OPEN limit and is stricter than the liquidation threshold.
        // The gap is the borrower's safety buffer.
        uint256 maxDebt = collateralValue(msg.sender) * LTV_BPS / 10_000;
        if (debtValue(msg.sender) > maxDebt) revert Undercollateralised();

        debtToken.safeTransfer(msg.sender, amt);
    }

    function withdraw(uint256 amt) external {
        collateral[msg.sender] -= amt;
        if (healthFactor(msg.sender) < 1e18) revert Undercollateralised();
        collateralToken.safeTransfer(msg.sender, amt);
    }

    // ---------------- liquidation ----------------
    /// Repay someone else's debt, receive their collateral at a discount.
    function liquidate(address user, uint256 repay) external {
        if (healthFactor(user) >= 1e18) revert Healthy();

        // Partial liquidations only: taking the whole position at once is
        // needlessly punitive and worsens cascades.
        uint256 maxRepay = debt[user] * CLOSE_FACTOR / 10_000;
        if (repay > maxRepay) repay = maxRepay;

        uint256 seize = repay
            * oracle.price(address(debtToken))
            * BONUS_BPS
            / (oracle.price(address(collateralToken)) * 10_000);

        if (seize > collateral[user]) seize = collateral[user];   // bad debt case

        debt[user] -= repay;
        collateral[user] -= seize;

        debtToken.safeTransferFrom(msg.sender, address(this), repay);
        collateralToken.safeTransfer(msg.sender, seize);
    }
}`
    },
    {
      lang: 'javascript', file: 'risk-math.js',
      caption: 'Health factors, liquidation prices and the kinked rate curve, computed off-chain.',
      src: `// ---------- position risk ----------
function healthFactor(collateralAmt, collateralPrice, threshold, debtValue) {
  if (debtValue === 0) return Infinity;
  return (collateralAmt * collateralPrice * threshold) / debtValue;
}

// The number that actually matters to a borrower: at what price do I get hit?
function liquidationPrice(collateralAmt, threshold, debtValue) {
  return debtValue / (collateralAmt * threshold);
}

// 10 ETH at $2000, 82.5% threshold, $10,000 borrowed
healthFactor(10, 2000, 0.825, 10_000);      // 1.65  - comfortable
liquidationPrice(10, 0.825, 10_000);        // $1,212

// Borrow 5,000 more and the buffer collapses:
healthFactor(10, 2000, 0.825, 15_000);      // 1.10  - one bad day away
liquidationPrice(10, 0.825, 15_000);        // $1,818

// ---------- interest rates ----------
function borrowRate(utilisation, { base = 0.00, slope1 = 0.04,
                                   slope2 = 0.75, kink = 0.80 } = {}) {
  return utilisation <= kink
    ? base + (utilisation / kink) * slope1
    : base + slope1 + ((utilisation - kink) / (1 - kink)) * slope2;
}

borrowRate(0.50);   // 2.5%   plenty of liquidity
borrowRate(0.80);   // 4.0%   at the kink
borrowRate(0.95);   // 60.3%  punishing - forces repayment
borrowRate(1.00);   // 79.0%  lenders cannot withdraw; rate must be brutal

// Supply rate is the borrow rate scaled by utilisation, minus the reserve cut:
const supplyRate = (u, reserveFactor = 0.10) =>
  borrowRate(u) * u * (1 - reserveFactor);`
    }
  ],
  lab: 'lending',
  quiz: [
    {
      q: '10 ETH collateral at $2,000, 82.5% liquidation threshold, $10,000 debt. At what ETH price is the position liquidatable?',
      options: ['$1,000', '$1,212', '$1,500', '$2,000'],
      answer: 1,
      why: 'HF = 1 when collateral × price × threshold = debt. price = 10,000 / (10 × 0.825) = $1,212. Above that the position is safe; at or below it, liquidators can act.'
    },
    {
      q: 'Why do interest rates spike sharply above the utilisation kink?',
      options: [
        'To maximise protocol revenue',
        'To force repayment and attract deposits, so lenders can still withdraw — 100% utilisation means their funds are frozen',
        'It is an arbitrary parameter',
        'To discourage all borrowing'
      ],
      answer: 1,
      why: 'The kink is a liquidity control. Full utilisation means no lender can exit. A steep rate above the kink makes borrowing expensive enough to push utilisation back down quickly.'
    },
    {
      q: 'Why do liquidators receive a bonus on seized collateral?',
      options: [
        'To punish the borrower',
        'To pay for a service the protocol cannot perform itself — without a profitable incentive, underwater positions go unliquidated and become bad debt',
        'It is a legacy artefact',
        'To reduce gas costs'
      ],
      answer: 1,
      why: 'Liquidators take gas cost, price risk and competition risk. The 5-10% discount compensates them. Set it too low and nobody liquidates; too high and borrowers are needlessly penalised and cascades worsen.'
    }
  ],
  tasks: [
    'Use the lab to build a position, drop the price, and liquidate it. Record the liquidator profit.',
    'Compute the liquidation price for three different LTVs and explain the trade-off to a borrower.',
    'Plot the kinked rate curve from 0 to 100% utilisation and mark the kink.',
    'Write the failure sequence of UST in five steps, naming the reflexive loop.'
  ],
  resources: [
    { type: 'docs', title: 'Aave V3 technical paper', url: 'https://github.com/aave/aave-v3-core' },
    { type: 'docs', title: 'Compound III documentation', url: 'https://docs.compound.finance/' },
    { type: 'read', title: 'MakerDAO / Sky documentation', url: 'https://docs.makerdao.com/' }
  ]
});

L.push({
  id: 'l25', module: 6, num: 25,
  title: 'Layer 2s, Rollups and Bridges',
  level: 'Advanced', minutes: 75,
  summary: 'How rollups inherit L1 security, why optimistic withdrawals take a week, and why bridges are the most-exploited component in the entire industry.',
  objectives: [
    'Explain the rollup model: execute off chain, settle on chain',
    'Compare optimistic and validity proofs including withdrawal latency',
    'Describe data availability and why EIP-4844 cut L2 fees so sharply',
    'Assess bridge trust models and identify the failure points'
  ],
  body: `
<h3>The scaling problem</h3>
<p>Every full node re-executes every transaction. That is what makes the chain verifiable — and it caps throughput at whatever the weakest node can handle. The rollup answer: execute elsewhere, but post enough data to L1 that anyone can reconstruct and challenge the result. Security comes from L1; throughput does not.</p>

<h3>Anatomy of a rollup</h3>
<ol>
  <li>Users submit transactions to a <strong>sequencer</strong>.</li>
  <li>The sequencer orders and executes them, returning a near-instant soft confirmation.</li>
  <li>It posts compressed transaction data to L1 (since EIP-4844, as <strong>blobs</strong>).</li>
  <li>It posts the resulting state root.</li>
  <li>That root is validated — by a challenge window (optimistic) or a proof (validity).</li>
</ol>

<h3>Optimistic vs validity proofs</h3>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>Optimistic</th><th>Validity (ZK)</th></tr></thead>
<tbody>
<tr><td>Assumption</td><td>State root is correct unless challenged</td><td>Nothing — the proof establishes it</td></tr>
<tr><td>Withdrawal to L1</td><td>~7 days challenge window</td><td>Minutes to hours</td></tr>
<tr><td>Requires</td><td>At least one honest challenger</td><td>Sound cryptography and a correct circuit</td></tr>
<tr><td>EVM compatibility</td><td>Very high, mature</td><td>Improving fast</td></tr>
<tr><td>Cost profile</td><td>Cheap to post, expensive to challenge</td><td>Proving cost, amortised over the batch</td></tr>
<tr><td>Examples</td><td>Arbitrum, Optimism, Base</td><td>zkSync, Starknet, Scroll, Linea</td></tr>
</tbody>
</table>
</div>
<p>The seven-day wait is not arbitrary: it is the window in which a fraud proof can be submitted. "Fast bridges" simply have a liquidity provider front you the funds on L1 and wait out the window themselves — you are paying a fee for their capital and taking their counterparty risk.</p>

<h3>Data availability</h3>
<p>A rollup is only trustless if its data is <em>available</em> — without it, nobody can reconstruct state or prove fraud. Where that data lives defines the security tier:</p>
<ul>
  <li><strong>Rollup</strong> — data on Ethereum L1 (calldata or blobs). Full L1 security.</li>
  <li><strong>Validium</strong> — proofs on L1, data held off chain by a committee. Cheaper, but the committee can withhold data and freeze funds.</li>
  <li><strong>Optimium / alt-DA</strong> — data on Celestia, EigenDA or similar. Security of that DA layer, not Ethereum's.</li>
</ul>
<p><strong>EIP-4844</strong> introduced blobs: a separate, temporary data space priced by its own fee market and pruned after ~18 days — long enough to challenge, short enough to be cheap. It cut L2 fees by roughly 10-100x overnight and is the single largest scaling change since the Merge.</p>

<div class="note warn">
  <span class="tag">Sequencer centralisation</span>
  <p>Nearly every major L2 runs a single sequencer today. It can censor and reorder (though not steal, since state transitions are validated). Escape hatches exist — force-inclusion via L1 — but are slow and rarely tested. Decentralised sequencing is the open problem across the entire L2 landscape.</p>
</div>

<h3>Bridges: the weakest link</h3>
<p>Bridge hacks account for the largest losses in crypto history: Ronin $624M, Poly Network $611M, Wormhole $326M, Nomad $190M. The pattern is consistent — the bridge holds enormous value and its security reduces to signature verification or a multisig.</p>
<ul>
  <li><strong>Native / canonical</strong> — the L2's own bridge, secured by the rollup itself. Safest, slowest.</li>
  <li><strong>Multisig / federated</strong> — n-of-m signers. Compromise n keys and take everything. Ronin was 5-of-9; the attacker got 5.</li>
  <li><strong>Light client / IBC</strong> — each chain verifies the other's consensus. Strong, expensive, complex.</li>
  <li><strong>Liquidity network</strong> — no minting; LPs hold inventory on both sides. Risk is the LP's, not a giant honeypot's.</li>
</ul>
<p>Rule of thumb: for large or long-term value, use the canonical bridge and accept the wait. Third-party bridges are a fee-for-speed trade with a strictly worse trust model.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'L1L2Messaging.sol',
      caption: 'Deposit into a rollup and withdraw back out. The withdrawal path is where the challenge window lives.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// ---------------- L1 side ----------------
interface IL2Messenger {
    function sendMessage(address target, bytes calldata message, uint32 gasLimit) external;
}

contract L1Bridge {
    IL2Messenger public immutable messenger;
    address public immutable l2Bridge;

    mapping(bytes32 => bool) public finalizedWithdrawals;   // replay protection

    event DepositInitiated(address indexed from, address indexed to, uint256 amount);

    constructor(IL2Messenger m, address l2) { messenger = m; l2Bridge = l2; }

    /// L1 -> L2. Fast: the sequencer picks it up within minutes.
    function depositETH(address to) external payable {
        messenger.sendMessage(
            l2Bridge,
            abi.encodeWithSignature("finalizeDeposit(address,uint256)", to, msg.value),
            200_000
        );
        emit DepositInitiated(msg.sender, to, msg.value);
    }

    /// L2 -> L1. Only callable after the challenge window has elapsed and the
    /// withdrawal has been proven against a finalised state root.
    function finalizeWithdrawal(
        address to, uint256 amount, uint256 nonce, bytes32[] calldata proof
    ) external {
        bytes32 hash = keccak256(abi.encode(to, amount, nonce));
        require(!finalizedWithdrawals[hash], "already finalized");

        // 1. the state root containing this withdrawal is past the 7-day window
        // 2. the Merkle proof shows the withdrawal is inside that root
        require(_isFinalized(proof[0]), "challenge window open");
        require(_verifyInclusion(hash, proof), "bad proof");

        finalizedWithdrawals[hash] = true;                   // effects first
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send failed");
    }

    function _isFinalized(bytes32) internal pure returns (bool) { return true; }
    function _verifyInclusion(bytes32, bytes32[] calldata) internal pure returns (bool) { return true; }
}

// ---------------- L2 side ----------------
contract L2Bridge {
    uint256 public nonce;
    event WithdrawalInitiated(address indexed to, uint256 amount, uint256 nonce);

    /// Burn on L2, emit the event. The user then waits out the challenge
    /// window and proves the withdrawal on L1. There is no way to make this
    /// faster without introducing a trusted third party.
    function withdraw(address to) external payable {
        emit WithdrawalInitiated(to, msg.value, nonce++);
    }
}`
    },
    {
      lang: 'javascript', file: 'l2-economics.js',
      caption: 'Why L2 transactions are cheap, and what EIP-4844 actually changed.',
      src: `// An L2 transaction pays two costs:
//   1. L2 execution  - tiny, the sequencer sets it
//   2. L1 data       - the real cost, amortised across the batch

function l2Cost({ txBytes, txsInBatch, l1GasPrice, blobGasPrice, useBlobs }) {
  if (useBlobs) {
    // EIP-4844: blobs are priced by their own fee market, usually near zero
    const blobGasPerByte = 1;
    const l1Share = (txBytes * blobGasPerByte * blobGasPrice) / txsInBatch;
    return l1Share + 0.00001;
  }
  // pre-4844: calldata at 16 gas per non-zero byte
  const l1Share = (txBytes * 16 * l1GasPrice) / txsInBatch;
  return l1Share + 0.00001;
}

// A compressed swap is roughly 120 bytes, batched ~500 at a time.
l2Cost({ txBytes: 120, txsInBatch: 500, l1GasPrice: 30e-9, useBlobs: false });
// ~0.12 USD

l2Cost({ txBytes: 120, txsInBatch: 500, blobGasPrice: 1e-12, useBlobs: true });
// ~0.001 USD   <- roughly 100x cheaper

// Consequences:
//   - batching is the whole business model: more transactions per batch,
//     lower cost per transaction
//   - compression is a first-class engineering concern on L2
//   - blob fees have their own EIP-1559 market, so L2 costs spike when
//     many rollups compete for the same blob space`
    }
  ],
  lab: 'rollup',
  quiz: [
    {
      q: 'Why does withdrawing from an optimistic rollup take about seven days?',
      options: [
        'The proof takes that long to compute',
        'It is the challenge window during which anyone can submit a fraud proof against the state root',
        'L1 is congested',
        'It is a regulatory requirement'
      ],
      answer: 1,
      why: 'Optimistic rollups assume the posted root is valid unless challenged. The window must be long enough that an honest challenger can act even under censorship. Validity rollups replace the assumption with a proof and skip the wait.'
    },
    {
      q: 'A validium posts proofs to L1 but keeps data with an off-chain committee. What is the risk?',
      options: [
        'Invalid state transitions',
        'Data withholding — the state is provably correct but nobody can reconstruct it, so users cannot prove their balances and funds freeze',
        'Higher gas costs',
        'No risk, proofs cover everything'
      ],
      answer: 1,
      why: 'A validity proof guarantees the transition was correct; it does not give you the data. Without it you cannot compute your own balance or exit. Data availability is a separate property from validity, and it is exactly what a true rollup buys by posting to L1.'
    },
    {
      q: 'Why have bridges lost more money than any other component in crypto?',
      options: [
        'Bad Solidity',
        'They hold huge concentrated value while their security often reduces to an n-of-m multisig or a signature check — compromise the keys and take everything',
        'Bridges are unnecessary',
        'They are unaudited'
      ],
      answer: 1,
      why: 'Ronin ($624M) was a 5-of-9 multisig where the attacker obtained 5 keys. Wormhole ($326M) was a signature verification flaw. Value concentration plus a trust assumption weaker than the chains it connects is the recurring shape.'
    }
  ],
  tasks: [
    'Use the lab to compare withdrawal timelines and cost across optimistic, ZK and third-party bridge routes.',
    'Bridge a small amount to a testnet L2 with the canonical bridge and time both directions.',
    'Look up L2BEAT for two rollups and write down their exact trust assumptions and stage.',
    'Read one bridge post-mortem and identify the single trust assumption that failed.'
  ],
  resources: [
    { type: 'read', title: 'L2BEAT — rollup risk analysis', url: 'https://l2beat.com/' },
    { type: 'eip', title: 'EIP-4844 — proto-danksharding (blobs)', url: 'https://eips.ethereum.org/EIPS/eip-4844' },
    { type: 'docs', title: 'Ethereum.org — layer 2 rollups', url: 'https://ethereum.org/en/developers/docs/scaling/' }
  ]
});

L.push({
  id: 'l26', module: 6, num: 26,
  title: 'Zero-Knowledge Proofs and Capstone',
  level: 'Advanced', minutes: 90,
  summary: 'Prove a statement without revealing why it is true — then ship something of your own that uses everything in this roadmap.',
  objectives: [
    'Explain completeness, soundness and zero-knowledge',
    'Build a commit-reveal scheme and know its limits',
    'Compare SNARKs, STARKs and their trust setups',
    'Scope, build, test and deploy a capstone project'
  ],
  body: `
<h3>What a zero-knowledge proof is</h3>
<p>A protocol where a prover convinces a verifier that a statement is true while revealing nothing beyond that fact. Three properties:</p>
<ul>
  <li><strong>Completeness</strong> — a true statement with an honest prover always verifies.</li>
  <li><strong>Soundness</strong> — a false statement cannot be made to verify, except with negligible probability.</li>
  <li><strong>Zero-knowledge</strong> — the verifier learns nothing except that the statement holds.</li>
</ul>
<p>Concretely: prove you are over 18 without revealing your birthday; prove you own an NFT in a set without revealing which; prove a batch of 10,000 transactions executed correctly with a proof a contract verifies in milliseconds.</p>

<h3>Commitments: the accessible primitive</h3>
<p>You do not need a proving system to get real privacy value. A hash commitment is <strong>hiding</strong> (reveals nothing about the value) and <strong>binding</strong> (you cannot change it later):</p>
<pre><code>commitment = keccak256(value ‖ salt)</code></pre>
<p>The salt is essential. Without it, a small value space is brute-forced instantly — committing to a vote of "yes" or "no" without a salt gives zero hiding, because the attacker just hashes both. This is the mechanism behind sealed-bid auctions, MEV-resistant voting, and fair on-chain games.</p>
<p>Its limit: commit-reveal needs two transactions and a reveal deadline, and it must handle non-reveals (usually by forfeiting a deposit). A ZK proof achieves in one transaction what commit-reveal needs two rounds for.</p>

<h3>SNARKs and STARKs</h3>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>Groth16 SNARK</th><th>PLONK / Halo2</th><th>STARK</th></tr></thead>
<tbody>
<tr><td>Proof size</td><td>~200 bytes</td><td>~500 bytes</td><td>~50-200 KB</td></tr>
<tr><td>Verify gas</td><td>~200k</td><td>~300k</td><td>~1-5M</td></tr>
<tr><td>Trusted setup</td><td>Per circuit</td><td>Universal, updatable</td><td>None</td></tr>
<tr><td>Post-quantum</td><td>No</td><td>No</td><td>Yes</td></tr>
<tr><td>Proving speed</td><td>Slower</td><td>Medium</td><td>Fastest at scale</td></tr>
</tbody>
</table>
</div>
<p>The <strong>trusted setup</strong> is the uncomfortable part of SNARKs: a ceremony generates parameters, and the randomness used ("toxic waste") must be destroyed. Anyone retaining it can forge proofs. Multi-party ceremonies fix this by requiring only <em>one</em> honest participant out of thousands — Ethereum's KZG ceremony had over 140,000. STARKs avoid the problem entirely at the cost of much larger proofs.</p>

<div class="note">
  <span class="tag">Where ZK is actually used</span>
  <p><strong>Scaling</strong> is the dominant use, not privacy: a validity rollup proves a batch executed correctly, and the L1 verifies it cheaply. Also: private transfers (Tornado-style mixers, Aztec), identity and age proofs without disclosure, proof of solvency for exchanges, and verifiable off-chain compute.</p>
</div>

<h3>Capstone</h3>
<p>Pick one and build it end to end. The point is integration — contracts, tests, frontend, deployment and a written security argument.</p>
<ul>
  <li><strong>Sealed-bid auction</strong> — commit-reveal bidding, deposit forfeiture for non-reveal, pull-payment refunds.</li>
  <li><strong>Yield vault</strong> — ERC-4626 compliant, share accounting, a strategy, fee mechanics, invariant tests on share price.</li>
  <li><strong>Prediction market</strong> — outcome tokens, an oracle resolution path with a dispute window, AMM pricing.</li>
  <li><strong>Streaming payments</strong> — per-second vesting, cancellable, delegable, with a clean withdrawal path.</li>
  <li><strong>NFT marketplace</strong> — EIP-712 off-chain orders, on-chain settlement, ERC-2981 royalties, nonce cancellation.</li>
</ul>

<h3>Definition of done</h3>
<ol>
  <li>Contracts compile with zero warnings, using custom errors and NatSpec.</li>
  <li>Unit tests plus at least three fuzz properties plus one invariant with a handler.</li>
  <li>Slither run and every finding triaged in writing.</li>
  <li>Deployed and verified on a testnet, ownership held by a multisig.</li>
  <li>A frontend that connects, reads, simulates, writes and handles the failure states.</li>
  <li>A README with the threat model: what you trust, what breaks it, and what is explicitly out of scope.</li>
  <li>A gas report, and a note on where you chose readability over optimisation.</li>
</ol>
<p>That last document matters most. Anyone can ship a contract; the mark of an engineer is being able to state precisely what their system assumes and where it fails.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'SealedAuction.sol',
      caption: 'A complete commit-reveal sealed-bid auction — the capstone-grade version, with deposit forfeiture and pull payments.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Bids are hidden during bidding, revealed afterwards. Nobody - including
/// the seller and any observer of the mempool - can see a bid before the
/// reveal phase opens.
contract SealedAuction {
    struct Bid { bytes32 commitment; uint256 deposit; bool revealed; }

    address public immutable seller;
    uint256 public immutable commitDeadline;
    uint256 public immutable revealDeadline;
    uint256 public immutable minDeposit;

    mapping(address => Bid) public bids;
    mapping(address => uint256) public refunds;      // pull payments

    address public highBidder;
    uint256 public highBid;
    bool public settled;

    error WrongPhase();
    error BadReveal();
    error AlreadyBid();
    error DepositTooLow();

    event Committed(address indexed bidder);
    event Revealed(address indexed bidder, uint256 amount);
    event Settled(address indexed winner, uint256 amount);

    constructor(uint256 commitWindow, uint256 revealWindow, uint256 minDep) {
        seller = msg.sender;
        commitDeadline = block.timestamp + commitWindow;
        revealDeadline = commitDeadline + revealWindow;
        minDeposit = minDep;
    }

    // ---------- phase 1: commit ----------
    /// commitment = keccak256(abi.encodePacked(amount, salt, msg.sender))
    ///   - salt      hides the amount (without it, small ranges are brute-forced)
    ///   - msg.sender stops someone copying your commitment as their own bid
    function commit(bytes32 commitment) external payable {
        if (block.timestamp >= commitDeadline) revert WrongPhase();
        if (bids[msg.sender].commitment != 0) revert AlreadyBid();
        if (msg.value < minDeposit) revert DepositTooLow();

        bids[msg.sender] = Bid(commitment, msg.value, false);
        emit Committed(msg.sender);
    }

    // ---------- phase 2: reveal ----------
    function reveal(uint256 amount, bytes32 salt) external {
        if (block.timestamp < commitDeadline || block.timestamp >= revealDeadline)
            revert WrongPhase();

        Bid storage b = bids[msg.sender];
        if (b.revealed) revert BadReveal();
        if (keccak256(abi.encodePacked(amount, salt, msg.sender)) != b.commitment)
            revert BadReveal();

        b.revealed = true;

        // A bid larger than the deposit is invalid: the deposit is what makes
        // the commitment binding. Without this, bidders could commit huge
        // unbacked bids to block the auction.
        if (amount <= b.deposit && amount > highBid) {
            if (highBidder != address(0)) refunds[highBidder] += highBid;  // outbid
            highBidder = msg.sender;
            highBid = amount;
            refunds[msg.sender] += b.deposit - amount;     // excess deposit back
        } else {
            refunds[msg.sender] += b.deposit;              // losing bid, full refund
        }
        emit Revealed(msg.sender, amount);
    }

    // ---------- phase 3: settle ----------
    /// Deposits of bidders who never revealed are forfeited to the seller.
    /// Without this, a bidder could commit and simply decline to reveal a
    /// losing bid at zero cost - and the scheme provides no honesty guarantee.
    function settle() external {
        if (block.timestamp < revealDeadline) revert WrongPhase();
        if (settled) revert WrongPhase();
        settled = true;

        refunds[seller] += highBid;
        emit Settled(highBidder, highBid);
    }

    /// Pull, never push: a push refund to a contract that reverts on receive
    /// would let one bidder freeze the whole auction.
    function claim() external {
        uint256 amount = refunds[msg.sender];
        refunds[msg.sender] = 0;                            // effects first
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
    }
}`
    },
    {
      lang: 'circom', file: 'age_check.circom',
      caption: 'A minimal ZK circuit: prove age ≥ 18 without revealing the birth year. The Solidity verifier is generated from this.',
      src: `pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

// PRIVATE: birthYear, salt   - never leave the prover's machine
// PUBLIC:  currentYear, commitment, isAdult
//
// Proves: I know a birthYear whose commitment matches the public one,
//         AND currentYear - birthYear >= 18.
// Reveals: nothing else. Not the year, not the salt.
template AgeCheck() {
    signal input birthYear;      // private
    signal input salt;           // private
    signal input currentYear;    // public
    signal input commitment;     // public
    signal output isAdult;       // public

    // 1. bind the private year to the public commitment, so the prover
    //    cannot just make up a convenient birth year
    component hash = Poseidon(2);
    hash.inputs[0] <== birthYear;
    hash.inputs[1] <== salt;
    commitment === hash.out;     // constraint: must match

    // 2. the actual comparison
    component ge = GreaterEqThan(8);
    ge.in[0] <== currentYear - birthYear;
    ge.in[1] <== 18;

    isAdult <== ge.out;
    isAdult === 1;               // proof only exists if the statement is true
}

component main {public [currentYear, commitment]} = AgeCheck();

/*
  circom age_check.circom --r1cs --wasm --sym
  snarkjs groth16 setup age_check.r1cs pot12_final.ptau age.zkey
  snarkjs zkey export solidityverifier age.zkey Verifier.sol

  On chain:
    require(verifier.verifyProof(a, b, c, [currentYear, commitment, 1]));
  The contract learns the user is an adult. It never learns their age.
*/`
    },
    {
      lang: 'javascript', file: 'commit-reveal.js',
      caption: 'Client side of the scheme. The salt is the whole security property — lose it and the bid can never be revealed.',
      src: `// Commitment must bind the value, a salt, and the bidder's address.
function makeCommitment(amountWei, saltHex, bidder) {
  return CL.keccak256Hex(CL.concat(
    CL.bigToBytes(BigInt(amountWei), 32),
    CL.hexToBytes(saltHex),
    CL.hexToBytes(bidder)
  ));
}

// 32 random bytes. Generate once, store it, never reuse it across bids.
const salt = CL.bytesToHex(CL.randomBytes(32));

const commitment = makeCommitment('1500000000000000000', salt, myAddress);
await auction.commit(commitment, { value: ethers.parseEther('2') });

// Persist locally - the contract cannot help you recover it.
localStorage.setItem('auction-salt', salt);

// ...reveal phase opens...
await auction.reveal('1500000000000000000', localStorage.getItem('auction-salt'));

// WITHOUT A SALT the scheme provides nothing: an observer hashes every
// plausible bid amount and matches yours in milliseconds. Hiding requires
// enough entropy that the input space cannot be enumerated.`
    }
  ],
  lab: 'commit',
  quiz: [
    {
      q: 'Why must a commitment include a random salt?',
      options: [
        'To save gas',
        'Without it the input space can be brute-forced — an observer hashes every plausible value and matches the commitment instantly',
        'To make the hash valid',
        'To prevent reentrancy'
      ],
      answer: 1,
      why: 'Hashing is deterministic and public. Committing to "yes" or "no", or to a round bid amount, is trivially reversed by enumeration. The salt supplies the entropy that makes the commitment actually hiding.'
    },
    {
      q: 'What does a trusted setup ceremony require to be secure?',
      options: [
        'All participants must be honest',
        'At least one participant must destroy their contribution — a single honest participant out of thousands is enough',
        'A government authority',
        'Nothing, it is trustless'
      ],
      answer: 1,
      why: 'Contributions compose: the toxic waste can only be reconstructed if every participant colludes. This is why Ethereum ran a ceremony with 140,000+ participants. STARKs avoid the requirement entirely, at the cost of much larger proofs.'
    },
    {
      q: 'What is the dominant production use of ZK proofs on Ethereum today?',
      options: [
        'Anonymous transactions',
        'Scaling — validity rollups proving a whole batch executed correctly, verified cheaply on L1',
        'Voting',
        'Identity'
      ],
      answer: 1,
      why: 'Succinctness matters more than privacy in practice: a small proof verifies thousands of transactions. Privacy applications exist and are growing, but validity rollups are where the overwhelming majority of ZK verification gas is spent.'
    }
  ],
  tasks: [
    'Use the lab to run a full commit-reveal auction and demonstrate that a saltless commitment is brute-forceable.',
    'Choose a capstone from the list and write its threat model before writing any code.',
    'Build it: contracts, unit tests, three fuzz properties, one invariant with a handler.',
    'Deploy and verify on a testnet, ship a frontend, and publish the README with the gas report and security argument.'
  ],
  resources: [
    { type: 'read', title: 'Vitalik — ZK-SNARKs under the hood', url: 'https://vitalik.eth.limo/general/2017/02/01/zk_snarks.html' },
    { type: 'docs', title: 'Circom documentation', url: 'https://docs.circom.io/' },
    { type: 'read', title: 'ZK-learning course (MOOC)', url: 'https://zk-learning.org/' }
  ]
});

})(window.ROADMAP.lessons);
