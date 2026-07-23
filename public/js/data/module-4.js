/* Module 4 — Tooling & dApps (lessons 16-19) */
(function (L) {

L.push({
  id: 'l16', module: 4, num: 16,
  title: 'Development Environment: Foundry and Hardhat',
  level: 'Intermediate', minutes: 65,
  summary: 'Set up a real workspace: compile, run a local chain, fork mainnet, and understand the ABI that connects code to callers.',
  objectives: [
    'Scaffold a project with Foundry and know when Hardhat is the better tool',
    'Fork mainnet locally and interact with live protocol state',
    'Explain the ABI, function selectors and calldata encoding',
    'Use cast to inspect any contract from the terminal'
  ],
  body: `
<h3>Two toolchains</h3>
<div class="table-scroll">
<table>
<thead><tr><th></th><th>Foundry</th><th>Hardhat</th></tr></thead>
<tbody>
<tr><td>Tests written in</td><td>Solidity</td><td>TypeScript / JavaScript</td></tr>
<tr><td>Speed</td><td>Very fast (Rust)</td><td>Slower (Node)</td></tr>
<tr><td>Fuzzing / invariants</td><td>Built in</td><td>Via plugins</td></tr>
<tr><td>Best at</td><td>Contract engineering, gas work, security</td><td>Complex deploy scripts, JS/TS integration, plugin ecosystem</td></tr>
<tr><td>Local node</td><td>anvil</td><td>hardhat node</td></tr>
</tbody>
</table>
</div>
<p>Most teams in 2024+ use Foundry for contracts and tests, and keep Hardhat around for deployment orchestration or an existing plugin. Learning Foundry first is the higher-leverage choice: writing tests in Solidity removes an entire translation layer between your mental model and the EVM.</p>

<h3>Project layout</h3>
<p>A Foundry project is <code>src/</code> for contracts, <code>test/</code> for tests, <code>script/</code> for deployment, <code>lib/</code> for dependencies (git submodules), and <code>foundry.toml</code> for configuration. Remappings map import paths to <code>lib/</code> directories.</p>

<h3>Forking: test against reality</h3>
<p>A fork clones mainnet state at a block into your local node, then lets you execute against it. Balances, live pools, oracle prices and deployed protocols are all present. This is how you test an integration with Uniswap or Aave without deploying mocks that lie to you. It is also how post-mortems reproduce exploits: fork the block before the attack and replay it.</p>

<h3>The ABI and calldata</h3>
<p>The Application Binary Interface defines how to encode a call. Two rules cover almost everything:</p>
<ul>
  <li><strong>Selector</strong> — the first 4 bytes are <code>keccak256("name(type1,type2)")[0:4]</code>. No spaces, no parameter names, canonical types (<code>uint256</code> not <code>uint</code>).</li>
  <li><strong>Arguments</strong> — each static argument is padded to 32 bytes. Dynamic types (<code>bytes</code>, <code>string</code>, arrays) place a 32-byte offset in the head and their length plus data in the tail.</li>
</ul>
<p>So <code>transfer(0xAB…, 1e18)</code> becomes 4 + 32 + 32 = 68 bytes: <code>a9059cbb</code>, then the address left-padded to 32 bytes, then the amount. The lab computes selectors and decodes calldata so this stops being abstract.</p>

<div class="note warn">
  <span class="tag">Selector collisions</span>
  <p>Four bytes is only 4 billion values. Collisions are findable — and a proxy that routes on selector can be confused by a function on the implementation that shares a selector with one on the proxy. This is the "function clashing" problem that transparent proxies exist to solve (Lesson 22).</p>
</div>

<h3>cast: the Swiss army knife</h3>
<p>Everything you would open a block explorer for, <code>cast</code> does from the terminal — call view functions, read raw storage slots, decode calldata, look up selectors, convert units, send transactions. Learning ten cast commands removes most of your dependence on third-party UIs.</p>
`,
  code: [
    {
      lang: 'bash', file: 'setup.sh',
      caption: 'From nothing to a forked mainnet in six commands.',
      src: `# install
curl -L https://foundry.paradigm.xyz | bash && foundryup

# new project (ships with a sample contract, test and script)
forge init my-protocol && cd my-protocol

# dependencies are git submodules
forge install OpenZeppelin/openzeppelin-contracts

# build + test with gas report
forge build
forge test -vvv --gas-report

# local node forked from mainnet at a specific block (deterministic tests)
anvil --fork-url $ETH_RPC_URL --fork-block-number 19000000

# ---- cast: inspect anything ----
cast call 0xA0b8...eB48 "totalSupply()(uint256)" --rpc-url $ETH_RPC_URL
cast sig "transfer(address,uint256)"                  # -> 0xa9059cbb
cast 4byte 0xa9059cbb                                 # reverse lookup
cast calldata "transfer(address,uint256)" 0xdead... 1000000000000000000
cast storage 0xA0b8...eB48 0 --rpc-url $ETH_RPC_URL   # raw slot 0
cast --to-unit 1500000000000000000 ether              # -> 1.500000000000000000`
    },
    {
      lang: 'toml', file: 'foundry.toml',
      caption: 'Configuration worth setting on day one: optimizer runs, fuzz depth, and named RPC endpoints.',
      src: `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200          # low = smaller bytecode, high = cheaper calls
via_ir = false                # enable for hard "stack too deep" cases
gas_reports = ["*"]

[profile.default.fuzz]
runs = 1000                   # 256 is the default; 1000+ for anything financial

[profile.default.invariant]
runs = 256
depth = 100                   # calls per run
fail_on_revert = false

[profile.ci.fuzz]
runs = 10000                  # deep fuzzing only in CI

[rpc_endpoints]
mainnet = "\${ETH_RPC_URL}"
sepolia = "\${SEPOLIA_RPC_URL}"
base = "\${BASE_RPC_URL}"

[etherscan]
mainnet = { key = "\${ETHERSCAN_API_KEY}" }`
    },
    {
      lang: 'solidity', file: 'ForkTest.t.sol',
      caption: 'A fork test against live mainnet state. deal() and prank() are cheat codes — anvil lets you rewrite state for testing.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ForkTest is Test {
    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address constant WHALE = 0x28C6c06298d514Db089934071355E5743bf21d60;

    function setUp() public {
        // pin the block: floating forks make tests non-reproducible
        vm.createSelectFork(vm.rpcUrl("mainnet"), 19_000_000);
    }

    function test_realUsdcState() public view {
        assertEq(USDC.decimals(), 6);
        assertGt(USDC.totalSupply(), 0);
    }

    function test_impersonateWhale() public {
        uint256 before = USDC.balanceOf(address(this));

        vm.prank(WHALE);                       // next call comes from WHALE
        USDC.transfer(address(this), 1_000e6);

        assertEq(USDC.balanceOf(address(this)), before + 1_000e6);
    }

    function test_dealTokens() public {
        deal(address(USDC), address(this), 5_000e6);   // rewrite the balance slot
        assertEq(USDC.balanceOf(address(this)), 5_000e6);
    }
}`
    }
  ],
  lab: 'selector',
  quiz: [
    {
      q: 'What are the first 4 bytes of calldata for transfer(address,uint256)?',
      options: [
        'A random nonce',
        'keccak256("transfer(address,uint256)") truncated to 4 bytes — the function selector',
        'The contract address prefix',
        'The gas limit'
      ],
      answer: 1,
      why: 'The selector is how the dispatcher picks which function to run. The signature string must be canonical: no spaces, no parameter names, uint256 rather than uint.'
    },
    {
      q: 'Why pin a fork to a specific block number in tests?',
      options: [
        'It is faster',
        'Otherwise the fork follows the chain head and your assertions break whenever mainnet state changes',
        'It is required by Foundry',
        'To reduce RPC costs only'
      ],
      answer: 1,
      why: 'Unpinned forks give non-deterministic tests: a pool balance shifts and a passing suite starts failing for reasons unrelated to your code. Pinning also makes CI cacheable.'
    },
    {
      q: 'optimizer_runs is set to 1,000,000. What is the trade-off?',
      options: [
        'Nothing, higher is always better',
        'Runtime calls get cheaper but deployed bytecode grows, raising deployment cost and risking the 24KB contract size limit',
        'Compilation fails',
        'Tests run slower'
      ],
      answer: 1,
      why: 'The value tells the optimizer how often you expect each function to be called. High values inline aggressively for runtime speed at the cost of size. Contracts near the EIP-170 24,576-byte limit often have to lower it.'
    }
  ],
  tasks: [
    'Install Foundry, scaffold a project, and get forge test passing on the sample contract.',
    'Use the lab to compute the selectors for transfer, approve and balanceOf. Verify against cast sig.',
    'Fork mainnet at a block of your choice and read the USDC total supply with cast call.',
    'Decode the calldata of a real transaction from an explorer using the lab, and identify every argument.'
  ],
  resources: [
    { type: 'docs', title: 'Foundry Book', url: 'https://book.getfoundry.sh/' },
    { type: 'docs', title: 'Hardhat documentation', url: 'https://hardhat.org/docs' },
    { type: 'docs', title: 'Solidity ABI specification', url: 'https://docs.soliditylang.org/en/latest/abi-spec.html' }
  ]
});

L.push({
  id: 'l17', module: 4, num: 17,
  title: 'Testing: Unit, Fuzz and Invariant',
  level: 'Advanced', minutes: 80,
  summary: 'Unit tests confirm what you thought of. Fuzzing and invariant testing find what you did not — which is where the money is lost.',
  objectives: [
    'Write focused unit tests including revert and event assertions',
    'Write property-based fuzz tests and choose good properties',
    'Design invariants and a handler for stateful testing',
    'Read coverage honestly and know what it does not tell you'
  ],
  body: `
<h3>Three levels</h3>
<ol>
  <li><strong>Unit</strong> — specific input, specific expected output. Fast, precise, and blind to everything you did not imagine.</li>
  <li><strong>Fuzz</strong> — the framework generates thousands of random inputs and checks a <em>property</em> that must hold for all of them.</li>
  <li><strong>Invariant</strong> — the framework generates random <em>sequences of calls</em> and checks that a system-wide property holds after every one.</li>
</ol>
<p>Most exploited contracts had passing unit tests. They did not have properties.</p>

<h3>Choosing properties</h3>
<p>A good property is something that must be true regardless of path. Reliable sources of properties:</p>
<ul>
  <li><strong>Conservation</strong> — sum of balances equals total supply; contract token balance ≥ sum of recorded deposits.</li>
  <li><strong>Monotonicity</strong> — an index that should only increase, never decreases.</li>
  <li><strong>Round-trip</strong> — deposit then withdraw returns at most what went in (never more).</li>
  <li><strong>Access</strong> — a non-owner can never reach an owner-only state change.</li>
  <li><strong>Solvency</strong> — total collateral value ≥ total debt value at all times.</li>
</ul>

<div class="note">
  <span class="tag">Bound, do not discard</span>
  <p>In fuzz tests use <code>bound(x, min, max)</code> rather than <code>vm.assume</code> for numeric ranges. <code>assume</code> throws away runs that fail the predicate, so a narrow assumption silently reduces a 10,000-run test to a handful of real executions. <code>bound</code> maps every input into range so every run counts.</p>
</div>

<h3>Invariant testing and handlers</h3>
<p>Pointing the fuzzer directly at your contract usually wastes runs on calls that revert immediately. The fix is a <strong>handler</strong>: a wrapper exposing only sensible actions with bounded parameters, tracking ghost variables (running totals the real contract does not store). The fuzzer calls the handler; your invariant functions assert against contract state plus ghost state.</p>

<h3>Coverage is necessary, not sufficient</h3>
<p>100% line coverage means every line ran once. It says nothing about whether the <em>combination</em> that breaks you was tried. Reentrancy, oracle manipulation and rounding drift all live in states that fully-covered suites miss. Track coverage to find untested code; do not treat it as a safety score.</p>

<h3>What else to run</h3>
<ul>
  <li><strong>Slither</strong> — fast static analysis, catches a real percentage of common bugs in seconds. Run it in CI.</li>
  <li><strong>Echidna / Medusa</strong> — property fuzzers with different search strategies from Foundry's.</li>
  <li><strong>Halmos / Kontrol</strong> — symbolic execution: proves a property for <em>all</em> inputs rather than sampling.</li>
  <li><strong>Gas snapshots</strong> — <code>forge snapshot</code> makes gas regressions visible in review.</li>
</ul>
`,
  code: [
    {
      lang: 'solidity', file: 'Vault.t.sol',
      caption: 'Unit tests with revert and event assertions, then a fuzz test of a round-trip property.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";

contract VaultTest is Test {
    Vault vault;
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    event Deposited(address indexed who, uint256 amount);

    function setUp() public {
        vault = new Vault();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ---------- unit ----------
    function test_depositIncreasesBalance() public {
        vm.prank(alice);
        vault.deposit{value: 1 ether}();
        assertEq(vault.balanceOf(alice), 1 ether);
    }

    function test_revertsOnZeroDeposit() public {
        vm.prank(alice);
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.deposit{value: 0}();
    }

    function test_emitsEvent() public {
        // the four booleans select which topics/data to compare
        vm.expectEmit(true, false, false, true);
        emit Deposited(alice, 1 ether);

        vm.prank(alice);
        vault.deposit{value: 1 ether}();
    }

    function test_cannotWithdrawOthersFunds() public {
        vm.prank(alice);
        vault.deposit{value: 5 ether}();

        vm.prank(bob);
        vm.expectRevert(Vault.InsufficientBalance.selector);
        vault.withdraw(1 ether);
    }

    // ---------- fuzz ----------
    /// Property: a deposit followed by a full withdrawal is value neutral.
    function testFuzz_depositWithdrawRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);   // bound, never vm.assume for ranges
        vm.deal(alice, amount);

        uint256 before = alice.balance;
        vm.startPrank(alice);
        vault.deposit{value: amount}();
        vault.withdraw(amount);
        vm.stopPrank();

        assertEq(alice.balance, before, "round trip must be value neutral");
        assertEq(vault.balanceOf(alice), 0);
    }

    /// Property: you can never withdraw more than you deposited.
    function testFuzz_cannotOverWithdraw(uint256 dep, uint256 wd) public {
        dep = bound(dep, 1, 100 ether);
        wd  = bound(wd, dep + 1, type(uint128).max);
        vm.deal(alice, dep);

        vm.startPrank(alice);
        vault.deposit{value: dep}();
        vm.expectRevert(Vault.InsufficientBalance.selector);
        vault.withdraw(wd);
        vm.stopPrank();
    }
}`
    },
    {
      lang: 'solidity', file: 'Vault.invariant.t.sol',
      caption: 'Stateful invariant testing. The handler bounds the action space; ghost variables track what the contract itself does not.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";

/// Wraps the contract so the fuzzer makes sensible calls instead of
/// burning runs on inputs that revert instantly.
contract Handler is Test {
    Vault public vault;

    uint256 public ghostDeposited;    // running totals the vault never stores
    uint256 public ghostWithdrawn;
    address[] public actors;

    constructor(Vault v) {
        vault = v;
        for (uint256 i; i < 5; i++) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(a);
            vm.deal(a, 1000 ether);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, actor.balance);

        vm.prank(actor);
        vault.deposit{value: amount}();
        ghostDeposited += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 bal = vault.balanceOf(actor);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);

        vm.prank(actor);
        vault.withdraw(amount);
        ghostWithdrawn += amount;
    }
}

contract VaultInvariants is Test {
    Vault vault;
    Handler handler;

    function setUp() public {
        vault = new Vault();
        handler = new Handler(vault);
        targetContract(address(handler));   // fuzz the handler, not the vault
    }

    /// Solvency: the vault always holds at least what it owes.
    function invariant_solvent() public view {
        assertGe(address(vault).balance, vault.totalDeposits());
    }

    /// Conservation: ETH held equals deposits minus withdrawals, always.
    function invariant_conservation() public view {
        assertEq(
            address(vault).balance,
            handler.ghostDeposited() - handler.ghostWithdrawn()
        );
    }
}`
    }
  ],
  lab: 'fuzz',
  quiz: [
    {
      q: 'Why prefer bound() over vm.assume() for constraining fuzz inputs?',
      options: [
        'bound is faster to type',
        'assume discards runs that fail the predicate, so a narrow assumption can silently reduce 10,000 runs to a handful',
        'assume does not compile in tests',
        'They are identical'
      ],
      answer: 1,
      why: 'Rejection sampling wastes the run budget. bound maps every generated value into the valid range, so every run performs real work. Reserve assume for rare structural conditions, not numeric ranges.'
    },
    {
      q: 'What does a handler contract do in invariant testing?',
      options: [
        'Handles reverts',
        'Restricts the fuzzer to meaningful, bounded action sequences and tracks ghost state for assertions',
        'Deploys the contract',
        'Generates the coverage report'
      ],
      answer: 1,
      why: 'Unhandled invariant testing wastes most runs on calls that revert immediately. The handler exposes realistic actions with valid parameters, and ghost variables let you assert conservation properties the contract itself does not record.'
    },
    {
      q: 'Your suite reports 100% line coverage. What can you conclude?',
      options: [
        'The contract is safe',
        'Every line executed at least once — nothing about whether dangerous *combinations* of state were explored',
        'No bugs remain',
        'An audit is unnecessary'
      ],
      answer: 1,
      why: 'Coverage measures reachability, not correctness. Reentrancy, oracle manipulation and rounding drift all live in state combinations that a fully covered suite can miss entirely. Coverage finds untested code; properties find bugs.'
    }
  ],
  tasks: [
    'Use the lab to fuzz the deliberately buggy withdraw function and find the input that breaks conservation.',
    'Write three invariants for an ERC-20: supply conservation, no balance exceeding supply, and allowance monotonicity under transferFrom.',
    'Add a handler to one of your own contracts and run 256 invariant runs at depth 100.',
    'Run Slither on any contract you have written and triage every finding as true positive, false positive or accepted risk.'
  ],
  resources: [
    { type: 'docs', title: 'Foundry — fuzz and invariant testing', url: 'https://book.getfoundry.sh/forge/fuzz-testing' },
    { type: 'code', title: 'Slither static analyser', url: 'https://github.com/crytic/slither' },
    { type: 'read', title: 'Trail of Bits — building secure contracts', url: 'https://secure-contracts.com/' }
  ]
});

L.push({
  id: 'l18', module: 4, num: 18,
  title: 'Frontend dApps: Wallets, viem and ethers',
  level: 'Intermediate', minutes: 75,
  summary: 'Connect a wallet, read contract state, send transactions, subscribe to events — and handle the failure modes users actually hit.',
  objectives: [
    'Connect a wallet with EIP-1193 and handle chain/account changes',
    'Read and write contracts with viem or ethers',
    'Sign typed data (EIP-712) and verify it on chain',
    'Handle rejection, revert, replacement and reorg in the UI'
  ],
  body: `
<h3>The provider interface</h3>
<p>Wallets inject an EIP-1193 provider exposing <code>request({ method, params })</code> plus events. EIP-6963 replaced the old <code>window.ethereum</code> free-for-all with proper multi-wallet discovery, so a page with three wallets installed can present all three instead of whichever loaded last.</p>
<p>Two provider roles, and confusing them causes real bugs:</p>
<ul>
  <li><strong>Public client / provider</strong> — reads chain state. Can point at any RPC.</li>
  <li><strong>Wallet client / signer</strong> — holds the user's account and signs. Only from the wallet.</li>
</ul>

<h3>viem vs ethers</h3>
<p><strong>viem</strong> is the modern default: tree-shakeable, TypeScript-first, and it infers argument and return types straight from your ABI, so a typo in an argument is a compile error. <strong>ethers v6</strong> remains excellent and is more widely known. <strong>wagmi</strong> wraps viem in React hooks with caching and reconnection handled for you.</p>

<h3>Reading, writing, waiting</h3>
<p>Reads are free <code>eth_call</code> requests. Writes are three distinct phases the UI must show separately:</p>
<ol>
  <li><strong>Simulate</strong> — <code>eth_call</code> against current state to catch reverts <em>before</em> asking the user to sign. Skipping this is the top cause of users paying gas for failed transactions.</li>
  <li><strong>Sign and broadcast</strong> — the wallet prompts; the user may reject (error code 4001).</li>
  <li><strong>Wait for receipt</strong> — pending, then mined, then (on Ethereum) finalised. Show all three.</li>
</ol>

<div class="note warn">
  <span class="tag">Failure modes to handle explicitly</span>
  <p>User rejection (4001), insufficient funds for gas, wrong chain, transaction replaced by a speed-up (the hash changes), a revert with custom-error data your UI must decode, RPC rate limits, and a reorg dropping a "confirmed" transaction. A dApp that only handles the happy path feels broken constantly.</p>
</div>

<h3>Signing without spending</h3>
<p><code>personal_sign</code> (EIP-191) signs a prefixed string — good for login. <code>eth_signTypedData_v4</code> (EIP-712) signs structured data with a domain separator, so the wallet can display readable fields and the signature cannot be replayed on another contract or chain. Use EIP-712 for anything with meaning: permits, orders, votes, meta-transactions.</p>
<p>The domain separator must include <code>chainId</code> and <code>verifyingContract</code>. Omitting them lets a signature valid on testnet be replayed on mainnet — an actual class of exploit, not a theoretical one.</p>

<h3>Reading events for UI state</h3>
<p>Do not poll <code>balanceOf</code> in a loop. Query logs for historical state, subscribe for live updates, and for anything non-trivial use an indexer (The Graph, Ponder, or your own). Cap block ranges: most public RPCs reject <code>getLogs</code> spanning more than a few thousand blocks.</p>
`,
  code: [
    {
      lang: 'typescript', file: 'dapp.ts',
      caption: 'viem end to end: connect, read, simulate, write, wait. The simulate step is what stops users paying for failing transactions.',
      src: `import { createPublicClient, createWalletClient, custom, http,
         formatUnits, parseUnits, BaseError, ContractFunctionRevertedError } from 'viem';
import { mainnet } from 'viem/chains';

const abi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'Transfer', type: 'event', inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false } ] }
] as const;                         // 'as const' is what gives you full type inference

const publicClient = createPublicClient({ chain: mainnet, transport: http() });

export async function connect() {
  const wallet = createWalletClient({ chain: mainnet, transport: custom(window.ethereum!) });
  const [account] = await wallet.requestAddresses();

  // users switch accounts and networks mid-session - always listen
  window.ethereum!.on('accountsChanged', (a: string[]) => location.reload());
  window.ethereum!.on('chainChanged', () => location.reload());

  return { wallet, account };
}

export async function readBalance(token: \`0x\${string}\`, who: \`0x\${string}\`) {
  const raw = await publicClient.readContract({ address: token, abi, functionName: 'balanceOf', args: [who] });
  return formatUnits(raw, 18);
}

export async function send(token: \`0x\${string}\`, to: \`0x\${string}\`, human: string) {
  const { wallet, account } = await connect();

  try {
    // 1. SIMULATE first: catches reverts before the user pays anything
    const { request } = await publicClient.simulateContract({
      address: token, abi, functionName: 'transfer',
      args: [to, parseUnits(human, 18)], account
    });

    // 2. sign + broadcast
    const hash = await wallet.writeContract(request);

    // 3. wait, with a confirmation depth appropriate to the value
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
    if (receipt.status === 'reverted') throw new Error('reverted on chain');
    return receipt;

  } catch (err) {
    if (err instanceof BaseError) {
      const revert = err.walk(e => e instanceof ContractFunctionRevertedError);
      if (revert instanceof ContractFunctionRevertedError) {
        // decode the custom error the contract actually threw
        throw new Error(\`Contract rejected: \${revert.data?.errorName ?? 'unknown'}\`);
      }
      if (err.message.includes('User rejected')) throw new Error('Cancelled in wallet');
    }
    throw err;
  }
}

// live updates without polling
publicClient.watchContractEvent({
  address: TOKEN, abi, eventName: 'Transfer',
  onLogs: logs => logs.forEach(l => updateUI(l.args))
});`
    },
    {
      lang: 'typescript', file: 'eip712.ts',
      caption: 'EIP-712 typed signing. chainId and verifyingContract in the domain are what prevent cross-chain and cross-contract replay.',
      src: `const domain = {
  name: 'Roadmap Exchange',
  version: '1',
  chainId: 1,                                    // without this, a testnet
  verifyingContract: '0xYourContract'            // signature replays on mainnet
} as const;

const types = {
  Order: [
    { name: 'maker',    type: 'address' },
    { name: 'tokenIn',  type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minOut',   type: 'uint256' },
    { name: 'nonce',    type: 'uint256' },       // replay protection
    { name: 'deadline', type: 'uint256' }        // expiry
  ]
} as const;

// The wallet shows the user readable named fields, not an opaque hex blob.
const signature = await wallet.signTypedData({
  account, domain, types, primaryType: 'Order', message: order
});

// On chain, the contract rebuilds the same digest and recovers the signer:
//
//   bytes32 digest = keccak256(abi.encodePacked("\\x19\\x01",
//       DOMAIN_SEPARATOR, keccak256(abi.encode(ORDER_TYPEHASH, ...))));
//   address signer = ECDSA.recover(digest, signature);
//   require(signer == order.maker && !usedNonce[signer][order.nonce]);`
    }
  ],
  lab: 'sign',
  quiz: [
    {
      q: 'Why simulate a contract write before sending it?',
      options: [
        'It makes the transaction cheaper',
        'It catches reverts against current state so the user is not asked to pay gas for a transaction that will fail',
        'It is required by EIP-1193',
        'It speeds up confirmation'
      ],
      answer: 1,
      why: 'simulateContract runs an eth_call with the same parameters. Failures surface as a decodable error before the wallet prompt. State can still change between simulation and inclusion, so it is a strong filter, not a guarantee.'
    },
    {
      q: 'An EIP-712 domain omits chainId. What is the consequence?',
      options: [
        'Signatures are invalid',
        'A signature produced on testnet can be replayed against the same contract address on mainnet',
        'Gas costs rise',
        'The wallet cannot display the message'
      ],
      answer: 1,
      why: 'The domain separator is what binds a signature to one chain and one contract. Missing chainId or verifyingContract enables cross-chain and cross-contract replay — a documented exploit class, not a hypothetical.'
    },
    {
      q: 'A user speeds up a pending transaction in their wallet. What does your UI need to handle?',
      options: [
        'Nothing changes',
        'The transaction hash changes — waiting on the old hash hangs forever unless you handle the replacement event',
        'The nonce changes',
        'The transaction is cancelled'
      ],
      answer: 1,
      why: 'A speed-up resubmits the same nonce with a higher fee, producing a different hash. viem exposes onReplaced on waitForTransactionReceipt; ethers surfaces a TRANSACTION_REPLACED error carrying the replacement.'
    }
  ],
  tasks: [
    'Use the lab to build an EIP-191 prefixed message hash and confirm it matches what your wallet signs.',
    'Build a minimal page that connects a wallet, reads an ERC-20 balance and sends a transfer with a simulate step.',
    'Add explicit UI states for: rejected, insufficient gas, wrong chain, reverted, replaced.',
    'Query the last 1,000 blocks of Transfer events for a token and render them, respecting your RPC block-range limit.'
  ],
  resources: [
    { type: 'docs', title: 'viem documentation', url: 'https://viem.sh/' },
    { type: 'docs', title: 'wagmi — React hooks for Ethereum', url: 'https://wagmi.sh/' },
    { type: 'eip', title: 'EIP-712 — typed structured data signing', url: 'https://eips.ethereum.org/EIPS/eip-712' }
  ]
});

L.push({
  id: 'l19', module: 4, num: 19,
  title: 'Deploy, Verify, Index and Monitor',
  level: 'Intermediate', minutes: 70,
  summary: 'Shipping is a process, not a command: deterministic addresses, source verification, indexing, alerting and a rehearsed incident plan.',
  objectives: [
    'Write a deployment script and deploy to a testnet',
    'Predict contract addresses with CREATE and CREATE2',
    'Verify source and explain why it matters',
    'Set up indexing, monitoring and a pause procedure'
  ],
  body: `
<h3>Deployment addresses are predictable</h3>
<ul>
  <li><strong>CREATE</strong>: <code>address = keccak256(rlp([deployer, nonce]))[12:]</code> — depends on the deployer's nonce, so it changes if you deploy something else first.</li>
  <li><strong>CREATE2</strong>: <code>address = keccak256(0xff ‖ deployer ‖ salt ‖ keccak256(initCode))[12:]</code> — nonce-independent, so the same address is reachable on every chain given the same deployer, salt and bytecode.</li>
</ul>
<p>CREATE2 is why protocols have identical addresses across networks, and how counterfactual deployment works: you can send funds to an address before the contract exists, then deploy it later. The lab computes both.</p>

<div class="note warn">
  <span class="tag">Constructor arguments change the address</span>
  <p>They are appended to the init code, so <code>keccak256(initCode)</code> differs. Same salt plus different constructor arguments equals a different address — a routine cause of cross-chain address mismatch.</p>
</div>

<h3>Deployment checklist</h3>
<ol>
  <li>Full test suite plus invariants green; Slither triaged.</li>
  <li>Constructor arguments reviewed by a second person — they are immutable afterwards.</li>
  <li>Deploy to testnet; exercise every function against it.</li>
  <li>Verify source on the explorer.</li>
  <li>Transfer ownership to a multisig, never an EOA. Confirm the transfer completed.</li>
  <li>Monitoring and alerts live <em>before</em> announcing.</li>
  <li>Pause procedure written down and rehearsed by someone who is not you.</li>
</ol>

<h3>Verification</h3>
<p>Publishing source lets the explorer recompile it and confirm the bytecode matches. Without it, users see hex and must trust your word. Verification requires the exact compiler version, optimizer settings and constructor arguments; a mismatch in any of them fails. Sourcify offers a decentralised alternative to explorer-hosted verification.</p>

<h3>Key management</h3>
<p>Never put a mainnet private key in <code>.env</code>. Foundry supports encrypted keystores (<code>cast wallet import</code>) and hardware wallets (<code>--ledger</code>). Protocol ownership belongs in a multisig such as Safe, typically behind a timelock so users can see privileged changes coming and exit if they disagree.</p>

<h3>Indexing</h3>
<p>Reading historical state from an RPC does not scale. Index events into a queryable database:</p>
<ul>
  <li><strong>The Graph</strong> — subgraphs in AssemblyScript, hosted or decentralised.</li>
  <li><strong>Ponder</strong> — TypeScript indexer, local-first, quick to iterate.</li>
  <li><strong>Roll your own</strong> — <code>getLogs</code> into Postgres. Simple until you must handle reorgs; then it is not.</li>
</ul>
<p>Whatever you choose, handle reorgs explicitly: index at a safe depth or subscribe to reorg notifications and roll back dropped blocks.</p>

<h3>Monitoring and incident response</h3>
<p>Alert on: large or unusual transfers, privileged function calls, oracle deviation, pause state changes, TVL dropping fast, and any revert-rate spike. Tools: OpenZeppelin Defender, Tenderly alerts, Forta.</p>
<p>Write the incident runbook before launch: who can pause, what the multisig threshold is, how you reach signers at 3am, what you tell users and when, and how funds get recovered. Protocols that lose the most are usually not the ones with the worst bug — they are the ones that took six hours to respond.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'Deploy.s.sol',
      caption: 'A Foundry deployment script with CREATE2 for a deterministic address and an immediate ownership handover.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Token} from "../src/Token.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address multisig = vm.envAddress("MULTISIG");
        bytes32 salt = keccak256("roadmap.token.v1");

        vm.startBroadcast(pk);

        // CREATE2 via the salt argument: same address on every chain given the
        // same deployer, salt and init code (constructor args included).
        Token token = new Token{salt: salt}(1_000_000e18);
        console2.log("Token deployed at", address(token));

        // never leave an EOA in control of a live protocol
        token.transferOwnership(multisig);

        vm.stopBroadcast();

        require(token.owner() == multisig, "ownership handover failed");
    }
}

/*
forge script script/Deploy.s.sol:Deploy \\
  --rpc-url $SEPOLIA_RPC_URL \\
  --account deployer \\            # encrypted keystore, not a raw key in .env
  --broadcast \\
  --verify --etherscan-api-key $ETHERSCAN_API_KEY \\
  -vvvv
*/`
    },
    {
      lang: 'javascript', file: 'predict-address.js',
      caption: 'Both address derivations. CREATE2 lets you know the address before the contract exists.',
      src: `// CREATE: address = keccak256(rlp([deployer, nonce]))[12:]
function createAddress(deployer, nonce) {
  const rlp = rlpEncode([hexToBytes(deployer), nonce]);
  return '0x' + CL.keccak256Hex(rlp).slice(24);
}

// CREATE2: address = keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))[12:]
function create2Address(deployer, saltHex, initCodeHex) {
  const payload = CL.concat(
    [0xff],
    CL.hexToBytes(deployer),
    CL.hexToBytes(saltHex),                       // exactly 32 bytes
    CL.keccak256(CL.hexToBytes(initCodeHex))      // runtime code + constructor args
  );
  return '0x' + CL.keccak256Hex(payload).slice(24);
}

// initCode = creationBytecode ++ abi.encode(constructorArgs)
// Change a constructor argument and the address changes. This is the usual
// reason "the same deployment" lands on different addresses across chains.`
    }
  ],
  lab: 'create2',
  quiz: [
    {
      q: 'Why does CREATE2 give the same address across chains but CREATE does not?',
      options: [
        'CREATE2 registers the address globally',
        'CREATE depends on the deployer nonce, which differs per chain; CREATE2 depends only on deployer, salt and init code',
        'CREATE2 uses a different hash function',
        'Chains coordinate address allocation'
      ],
      answer: 1,
      why: 'Nonce is per-account per-chain and drifts as you deploy other things. CREATE2 removes it from the formula, so identical inputs yield an identical address anywhere the deployer exists.'
    },
    {
      q: 'What does contract verification on an explorer prove?',
      options: [
        'The contract is audited and safe',
        'The published source compiles to exactly the deployed bytecode with the stated compiler settings',
        'The developer is identified',
        'The contract cannot be upgraded'
      ],
      answer: 1,
      why: 'It proves source-to-bytecode correspondence and nothing more. Verified malicious contracts are common. Verification enables review; it is not a substitute for it.'
    },
    {
      q: 'Ownership of a live protocol should be held by:',
      options: [
        'The deployer EOA for fast response',
        'A multisig, typically behind a timelock',
        'A contract with no owner',
        'The auditor'
      ],
      answer: 1,
      why: 'A single key is a single point of catastrophic failure — phishing, a compromised laptop, or a lost seed. A multisig requires collusion; a timelock gives users advance notice of privileged changes so they can exit.'
    }
  ],
  tasks: [
    'Deploy a contract to Sepolia with a script and verify it. Confirm the explorer shows your source.',
    'Use the lab to predict a CREATE2 address, then change one constructor argument and observe the address change.',
    'Set up a Tenderly or Defender alert on a privileged function of a contract you deployed.',
    'Write the incident runbook for your protocol: pause authority, signer contact path, comms template, recovery steps.'
  ],
  resources: [
    { type: 'docs', title: 'Foundry — deployment scripting', url: 'https://book.getfoundry.sh/guides/scripting-with-solidity' },
    { type: 'docs', title: 'Safe — multisig for protocol ownership', url: 'https://docs.safe.global/' },
    { type: 'docs', title: 'Ponder — TypeScript indexing framework', url: 'https://ponder.sh/' }
  ]
});

})(window.ROADMAP.lessons);
