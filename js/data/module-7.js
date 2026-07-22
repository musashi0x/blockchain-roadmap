/* Module 7 — Sui & Move (lessons 27-30) */
(function (L) {

L.push({
  id: 'l27', module: 7, num: 27,
  title: 'Sui’s Object-Centric Model',
  level: 'Intermediate', minutes: 60,
  summary: 'See why a Sui asset is a first-class object, how ownership controls who may use it, and why that changes transaction execution.',
  objectives: [
    'Identify owned, shared, immutable and wrapped objects',
    'Explain why independent owned-object transactions can execute in parallel',
    'Trace an object ID, version and digest through a transaction',
    'Choose an ownership model before writing a Move API'
  ],
  body: `
<h3>State is a graph of objects</h3>
<p>Ethereum applications usually treat contract storage as the centre of the world. Sui instead makes objects first-class state. A coin, an NFT, a game character, a pool and a capability can each be an object with an ID, a version, a type and an ownership relationship. A transaction names the objects it reads or changes.</p>
<p>That explicit input set gives the validator a useful fact up front: two transactions that only touch different <strong>owned</strong> objects do not conflict. They can be checked and executed independently. Shared objects are the deliberate exception: a common pool or order book needs an agreed order, so it goes through consensus.</p>

<h3>Ownership is an execution decision</h3>
<table><thead><tr><th>Kind</th><th>Who can use it?</th><th>Typical use</th><th>Execution consequence</th></tr></thead><tbody>
<tr><td>Address-owned</td><td>One address</td><td>Coin, NFT, personal vault</td><td>Can take the owned-object fast path when all mutable inputs are owned</td></tr>
<tr><td>Object-owned</td><td>The parent object</td><td>Inventory inside a character or vault</td><td>Moves with the parent; often called a wrapped child</td></tr>
<tr><td>Shared</td><td>Anyone, through its public API</td><td>AMM pool, registry, multiplayer game</td><td>Requires consensus ordering when mutated</td></tr>
<tr><td>Immutable</td><td>Anyone may read</td><td>Metadata, published configuration</td><td>Never changes, so it creates no write conflict</td></tr>
</tbody></table>
<p>An object reference is not just its ID. For a mutable object, the version and digest identify the exact state a transaction expects. If another transaction consumes that version first, yours is built against stale state and must be rebuilt from fresh data. This is normal optimistic concurrency, not a mysterious wallet error.</p>

<div class="note"><span class="tag">Design rule</span>Start with address-owned objects. Make an object shared only when unrelated users truly need to mutate the same state. Shared state is powerful, but it gives up the parallelism that makes the object model attractive.</div>

<h3>Coins are objects, not balances in a mapping</h3>
<p>A SUI coin is an object containing a balance. Paying someone can consume one or more input coin objects, create a payment coin and return a change coin. Wallets hide this selection process, but it explains why a wallet may hold many small coin objects and why a transaction can have several gas-payment inputs.</p>
`,
  code: [{
    lang: 'move', file: 'sources/badge.move', caption: 'A minimal address-owned object. The key ability permits global storage; the store ability lets this value live inside another object.',
    src: `module workshop::badge;

use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

public struct Badge has key, store {
    id: UID,
    name: vector<u8>,
    level: u8,
}

public fun mint(name: vector<u8>, ctx: &mut TxContext): Badge {
    Badge { id: object::new(ctx), name, level: 1 }
}

public entry fun mint_to_sender(name: vector<u8>, ctx: &mut TxContext) {
    transfer::transfer(mint(name, ctx), tx_context::sender(ctx));
}

public fun level(badge: &Badge): u8 { badge.level }
public fun promote(badge: &mut Badge) { badge.level = badge.level + 1; }`
  }],
  lab: 'suiobjects',
  quiz: [
    { q: 'Two people update two different address-owned badge objects. What lets Sui avoid a shared-state ordering dependency?', options: ['Both updates use the same global contract storage', 'The transaction inputs explicitly name distinct owned objects', 'The badges have the same type', 'The transactions pay different gas prices'], answer: 1, why: 'The validator can see that the mutable owned-object inputs are disjoint. Same type does not imply a conflict; touching the same mutable object does.' },
    { q: 'Which object should be shared?', options: ['A user’s profile picture', 'A protocol configuration that never changes', 'An AMM pool that many unrelated traders must swap against', 'A coin held by one address'], answer: 2, why: 'An AMM pool is intentionally common mutable state. The other examples are better address-owned or immutable, avoiding unnecessary consensus ordering.' },
    { q: 'Why can a transaction fail after another transaction changes one of its mutable inputs?', options: ['Its gas coin became invalid forever', 'Its object reference contains an older version of state', 'Object IDs are randomly reassigned', 'Move permits double-spending'], answer: 1, why: 'A mutable reference includes a version. Once the object advances, a transaction built with the old version must fetch current state and rebuild.' }
  ],
  tasks: ['Use the lab to compare an address-owned update with a shared update.', 'Sketch the objects in a game inventory: character, items, marketplace and metadata. Mark owner or parent for each.', 'Find a design that uses a shared object only as a small registry while keeping user assets address-owned.'],
  resources: [
    { type: 'docs', title: 'Sui object model', url: 'https://docs.sui.io/concepts/object-ownership' },
    { type: 'docs', title: 'Sui execution and transaction processing', url: 'https://docs.sui.io/concepts/transactions' }
  ]
});

L.push({
  id: 'l28', module: 7, num: 28,
  title: 'Move Resources, Abilities and Capabilities',
  level: 'Intermediate', minutes: 70,
  summary: 'Use Move’s type system to make assets non-copyable by default, then expose authority as an explicit capability instead of an address check.',
  objectives: [
    'Explain the four Move abilities: copy, drop, store and key',
    'Model a scarce asset as a resource that cannot be copied or discarded',
    'Use a capability object to represent administration authority',
    'Recognise why object IDs are not authorisation'
  ],
  body: `
<h3>Resources are enforced by the language</h3>
<p>Move values do not automatically copy or disappear. A type gains those powers only by declaring abilities. This is ideal for assets: a <code>Coin&lt;T&gt;</code> cannot accidentally be duplicated, and a value without <code>drop</code> must be consumed, stored or transferred before a function returns.</p>
<table><thead><tr><th>Ability</th><th>Meaning</th><th>Useful question</th></tr></thead><tbody>
<tr><td><code>copy</code></td><td>Value may be duplicated</td><td>Would a duplicate be safe?</td></tr>
<tr><td><code>drop</code></td><td>Value may be discarded</td><td>Is it safe to forget this value?</td></tr>
<tr><td><code>store</code></td><td>Value may be stored inside another value</td><td>May this be a child object or field?</td></tr>
<tr><td><code>key</code></td><td>Value may live in global storage as an object</td><td>Is this an on-chain object with a UID?</td></tr>
</tbody></table>
<p>The absence of an ability is a guardrail. A ticket with <code>key</code> and <code>store</code>, but no <code>copy</code> or <code>drop</code>, is scarce and cannot silently vanish. The compiler, not a convention in a code review, protects that invariant.</p>

<h3>Capabilities make authority tangible</h3>
<p>Instead of hard-coding an administrator address, create a one-off <code>AdminCap</code> object at package initialisation. Any function that changes privileged state takes <code>&amp;AdminCap</code>. Transferring the cap transfers authority; putting it in a multisig or a timelock composes naturally. The function does not care which address holds it.</p>
<div class="note warn"><span class="tag">Security</span>An object ID is an identifier, not permission. If a public function accepts an ID and performs an admin action without requiring an owned capability, anyone who can name that ID may call it. Require the capability reference and keep the capability scarce.</div>
`,
  code: [{
    lang: 'move', file: 'sources/treasury.move', caption: 'The initializer creates exactly one capability. Privileged entry points require a reference to it, so authority can be transferred or held by a multisig.',
    src: `module workshop::treasury;

use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::TxContext;

public struct AdminCap has key, store { id: UID }
public struct Treasury has key {
    id: UID,
    paused: bool,
}

fun init(ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, tx_context::sender(ctx));
    transfer::share_object(Treasury { id: object::new(ctx), paused: false });
}

public fun pause(_: &AdminCap, treasury: &mut Treasury) {
    treasury.paused = true;
}

public fun unpause(_: &AdminCap, treasury: &mut Treasury) {
    treasury.paused = false;
}

public fun is_paused(treasury: &Treasury): bool { treasury.paused }`
  }],
  lab: 'suicap',
  quiz: [
    { q: 'A type has key and store but no copy or drop. Which statement is true?', options: ['It can be freely duplicated', 'It can be silently discarded', 'It can become an object or child value but must be handled explicitly', 'It is necessarily shared'], answer: 2, why: 'key and store concern storage. Without copy the value is not duplicable; without drop the compiler insists it is consumed, returned, stored or transferred.' },
    { q: 'What is the main benefit of an AdminCap over checking sender == a fixed address?', options: ['It makes every function public', 'Authority becomes an object that can be transferred or composed with a multisig', 'It avoids all transaction signatures', 'It makes the package immutable'], answer: 1, why: 'A capability is explicit authority. Its holder can change without rewriting the module, and a custody object can hold it.' },
    { q: 'Why is accepting an object ID alone unsafe as an admin check?', options: ['IDs are too long', 'IDs are public identifiers, not proof that the caller controls a privileged resource', 'IDs change every epoch', 'Move cannot compare IDs'], answer: 1, why: 'Anyone can learn and supply a public object ID. The privileged function must require a scarce capability owned or controlled by the caller.' }
  ],
  tasks: ['For a minting module, decide which structs should have each ability and write down why.', 'Extend the treasury with a fee field that only an AdminCap holder can change.', 'Describe how you would move an AdminCap from one operator to a 2-of-3 multisig.'],
  resources: [
    { type: 'docs', title: 'Move abilities on Sui', url: 'https://docs.sui.io/concepts/sui-move-concepts/abilities' },
    { type: 'docs', title: 'Capabilities pattern', url: 'https://docs.sui.io/concepts/sui-move-concepts' }
  ]
});

L.push({
  id: 'l29', module: 7, num: 29,
  title: 'Programmable Transaction Blocks',
  level: 'Advanced', minutes: 70,
  summary: 'Compose split, move-call, transfer and merge commands atomically, then build the same transaction safely with the Sui TypeScript SDK.',
  objectives: [
    'Explain why a programmable transaction block is atomic',
    'Pass command results into later commands without temporary on-chain state',
    'Build a split-and-transfer transaction with the TypeScript SDK',
    'Set a precise gas budget and inspect effects after execution'
  ],
  body: `
<h3>One signature, a small program</h3>
<p>A programmable transaction block (PTB) is an ordered list of commands. Its output values can feed later commands: split a coin, call a package function with the split result, transfer the returned object, then merge leftovers. The block succeeds as one transaction or its effects are rolled back together.</p>
<p>PTBs avoid a common dApp anti-pattern: submitting a chain of dependent transactions and hoping none is front-run, rejected or abandoned halfway through. Atomic composition keeps temporary values inside the transaction rather than publishing them as public state.</p>

<h3>Inputs, results and gas</h3>
<p>The sender supplies pure inputs such as an amount and object inputs such as a coin. Each command can return a result or multiple results. The gas coin is itself a special transaction input, so it can be split for a payment. Never assume a transaction succeeded from wallet approval alone: inspect the final effects and events returned by the fullnode.</p>
<div class="note"><span class="tag">Build safely</span>Query the latest object data immediately before building a transaction, sign only after the wallet shows a human-readable summary, and after execution check status, changed objects and emitted events. Object versions make stale cached transactions a routine reality.</div>
`,
  code: [{
    lang: 'typescript', file: 'pay-and-mint.ts', caption: 'A browser or server-side transaction builder. The signer and client setup are deliberately omitted; this shows the atomic shape.',
    src: `import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();
const amount = 1_000_000n; // 1 SUI in MIST

// Split a payment object inside this transaction. No intermediate coin is
// published on chain; payment is a command result used immediately below.
const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);

const badge = tx.moveCall({
  target: '0xPACKAGE::badge::mint',
  arguments: [tx.pure.string('PTB learner')],
});

tx.transferObjects([payment, badge], tx.pure.address(recipient));
tx.setGasBudget(10_000_000);

const result = await client.signAndExecuteTransaction({ signer, transaction: tx });
const effects = await client.waitForTransaction({ digest: result.digest });

if (effects.effects?.status.status !== 'success') {
  throw new Error(effects.effects?.status.error || 'transaction failed');
}
console.log('digest', result.digest, 'changed', effects.objectChanges);`
  }],
  lab: 'suiptb',
  quiz: [
    { q: 'Why put a coin split and a transfer in one PTB?', options: ['It makes the coin copyable', 'The payment result remains inside one atomic transaction', 'It removes the need for a signature', 'It makes gas free'], answer: 1, why: 'The split result is a temporary transaction value. Either all commands commit together or none do; no intermediate coin must be managed by a follow-up transaction.' },
    { q: 'What should a dApp check after signAndExecuteTransaction returns?', options: ['Only that the wallet closed', 'The final effects status and relevant changed objects or events', 'The current SUI price', 'That the object ID has 64 characters'], answer: 1, why: 'Approval and submission are not final success. Effects tell you whether the transaction succeeded and what state it actually changed.' },
    { q: 'What commonly invalidates a transaction built from cached mutable object data?', options: ['A different object version was consumed first', 'The package has too many functions', 'The recipient changed networks', 'The client uses TypeScript'], answer: 0, why: 'Mutable object references carry versions. Fetch fresh state and rebuild when another transaction has advanced an input object.' }
  ],
  tasks: ['Use the lab to build a PTB with two payments and observe the command results.', 'Write a PTB that mints a Badge and transfers it to a recipient in the same block.', 'Add error handling that shows the digest and final effects status in your UI.'],
  resources: [
    { type: 'docs', title: 'Programmable transaction blocks', url: 'https://docs.sui.io/concepts/transactions/prog-txn-blocks' },
    { type: 'docs', title: 'Sui TypeScript SDK transaction building', url: 'https://docs.sui.io/guides/developer/sui-101/building-ptb' }
  ]
});

L.push({
  id: 'l30', module: 7, num: 30,
  title: 'Shared Objects, Dynamic Fields and a Sui dApp',
  level: 'Advanced', minutes: 80,
  summary: 'Design the shared core of a Sui application without turning it into a bottleneck, attach extensible state with dynamic fields, and ship a small Move package safely.',
  objectives: [
    'Separate shared coordination state from user-owned assets',
    'Explain when dynamic fields are useful and what they cost',
    'Use events for indexable history rather than querying every object',
    'Plan tests, package publishing and client integration for a Sui dApp'
  ],
  body: `
<h3>Share the coordination point, not everything</h3>
<p>A marketplace can have one shared <code>Market</code> object that holds configuration and a small index, while listings and purchased items stay address-owned. A game can share the match state but leave each player’s inventory owned by that player. This keeps the unavoidable coordination point small and allows unrelated asset operations to remain parallel.</p>
<p>Dynamic fields attach key/value data to an object at runtime. They are useful for registries, per-user positions and extension points whose keys are unknown when the parent type is designed. They are still state: define who may add, replace or remove keys, and expose indexable events when off-chain clients need history.</p>

<h3>Events are the application’s receipt trail</h3>
<p>Events do not replace authoritative object state, but they give indexers and UIs a compact record of meaningful actions: listing created, swap executed, score submitted. Emit stable, typed events from successful changes; then have the client query an indexer or fullnode rather than scanning an unbounded object graph on every page load.</p>

<h3>A practical release path</h3>
<ol><li>Model the objects and ownership graph before exposing entry functions.</li><li>Write unit tests for happy paths, access control, stale or missing state and arithmetic boundaries.</li><li>Publish to a non-production network, record package IDs and object IDs in configuration, never hard-code them in scattered UI components.</li><li>Build PTBs in the client, display effects and events, and test failure states as carefully as success.</li><li>Audit shared-object entry points first: they are where arbitrary users meet common mutable state.</li></ol>
<div class="note danger"><span class="tag">Do not ship blind</span>Package upgrades, package IDs, network endpoints and admin capabilities are production configuration. Document their custody and rollback plan before users send assets to your app.</div>
`,
  code: [{
    lang: 'move', file: 'sources/scoreboard.move', caption: 'A shared scoreboard keeps only common coordination state. A typed event lets a UI index submissions without reconstructing the whole object graph.',
    src: `module workshop::scoreboard;

use sui::event;
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

public struct Scoreboard has key { id: UID, high_score: u64 }
public struct ScoreSubmitted has copy, drop { player: address, score: u64 }

fun init(ctx: &mut TxContext) {
    transfer::share_object(Scoreboard { id: object::new(ctx), high_score: 0 });
}

public entry fun submit(board: &mut Scoreboard, score: u64, ctx: &mut TxContext) {
    if (score > board.high_score) board.high_score = score;
    event::emit(ScoreSubmitted { player: tx_context::sender(ctx), score });
}

public fun high_score(board: &Scoreboard): u64 { board.high_score }`
  }],
  lab: 'suishared',
  quiz: [
    { q: 'Which design best preserves parallelism in a marketplace?', options: ['Make every listing, item and user profile one shared object', 'Keep a small shared market configuration and make listings or purchased assets address-owned where possible', 'Put all state in immutable objects', 'Avoid emitting events'], answer: 1, why: 'Only the genuinely common coordination state needs sharing. User-specific assets should stay owned so independent activity does not contend for one mutable object.' },
    { q: 'What are dynamic fields best suited for?', options: ['Replacing all type definitions', 'Attaching keyed, extensible state to a parent object at runtime', 'Making an object immutable', 'Skipping access control'], answer: 1, why: 'Dynamic fields support maps and extensible child state. Their APIs still need ownership and authorisation rules.' },
    { q: 'Why emit a typed event for a successful action?', options: ['It changes object ownership', 'It gives clients and indexers a stable, queryable history while objects remain source-of-truth state', 'It makes consensus unnecessary', 'It replaces tests'], answer: 1, why: 'Events are receipts and an indexing surface; the objects are still the authoritative state.' }
  ],
  tasks: ['Use the lab to compare a shared scoreboard update with a user-owned inventory update.', 'Draw a marketplace ownership graph and mark every shared object.', 'Create a Move test plan with at least one failed authority check and one shared-object boundary case.', 'Write an event schema your frontend could use to render a recent activity feed.'],
  resources: [
    { type: 'docs', title: 'Dynamic fields', url: 'https://docs.sui.io/concepts/dynamic-fields' },
    { type: 'docs', title: 'Events', url: 'https://docs.sui.io/guides/developer/sui-101/using-events' },
    { type: 'docs', title: 'Move testing', url: 'https://docs.sui.io/guides/developer/first-app/build-test' }
  ]
});

L.push({
  id: 'l31', module: 7, num: 31,
  title: 'Kiosk, Transfer Policies and Digital Commerce',
  level: 'Advanced', minutes: 60,
  summary: 'Use Sui Kiosk patterns to hold assets for sale and make creator-enforced transfer rules explicit, composable and auditable.',
  objectives: [
    'Separate custody, listing and transfer-policy responsibilities',
    'Explain the difference between a freely transferable asset and a policy-controlled asset',
    'Model royalties or a purchase rule without trusting a marketplace frontend',
    'Identify the policy-capability risk in an NFT or game-item design'
  ],
  body: `
<h3>Commerce is an object protocol</h3>
<p>Kiosk is a Sui framework primitive for object-based commerce. A kiosk can hold an item, list it at a price and transfer it to a buyer as part of a transaction. The important design lesson is separation: the seller’s custody and listing state are distinct from the creator’s transfer policy.</p>
<p>A <strong>transfer policy</strong> is created for a specific asset type. Its rules say what must happen before that type may change hands: pay a royalty, present a matching purchase receipt, satisfy an allowlist, or complete another on-chain condition. A buyer cannot bypass those rules merely by using a different marketplace interface.</p>

<h3>Rules need a completion receipt</h3>
<p>A safe purchase flow is: take the item from the seller’s kiosk, pay and satisfy every policy rule, receive a transfer request, then confirm it against the policy before transferring the item. The request is a transaction-local proof that the required steps occurred. It should never be possible to take the item and transfer it before policy confirmation.</p>
<div class="note warn"><span class="tag">Authority</span>The policy capability controls adding or changing rules. Treat it like an AdminCap: document who holds it, whether it can upgrade rules after items are sold, and what buyers are agreeing to.</div>
`,
  code: [{
    lang: 'move', file: 'sources/royalty_rule.move', caption: 'The shape of a custom policy rule: consume payment, send the fee, and record that this transaction satisfied the rule before the transfer is confirmed.',
    src: `module workshop::royalty_rule;

use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::TxContext;

/// Teaching sketch: a real Kiosk rule plugs this action into its
/// TransferPolicy request and records a receipt for the asset type.
public fun pay_royalty(payment: Coin<SUI>, creator: address, fee: u64, ctx: &mut TxContext): Coin<SUI> {
    let mut remaining = payment;
    let fee_coin = coin::split(&mut remaining, fee, ctx);
    transfer::public_transfer(fee_coin, creator);
    remaining
}

/// The caller receives the remaining payment only after the policy rule
/// has produced its receipt and Kiosk confirms the transfer request.`
  }],
  lab: 'suikiosk',
  quiz: [
    { q: 'What should enforce a creator royalty for a policy-controlled asset?', options: ['A marketplace website’s JavaScript', 'A transfer policy rule confirmed in the transaction', 'A note in the NFT metadata', 'The buyer’s wallet extension'], answer: 1, why: 'A frontend can be replaced or bypassed. A policy rule is checked on-chain in the transfer flow, independent of the marketplace UI.' },
    { q: 'Why is a transaction-local transfer request useful?', options: ['It makes the item copyable', 'It connects taking an item to satisfying every required policy rule before transfer', 'It permanently stores the buyer’s private key', 'It makes the kiosk immutable'], answer: 1, why: 'The request is a receipt-shaped value for this transaction. Confirmation can require all configured rules before the object moves to the buyer.' },
    { q: 'Which resource deserves the strongest custody plan?', options: ['A public item ID', 'The transfer-policy capability that can change rules', 'A sale price displayed in the UI', 'An event cursor'], answer: 1, why: 'The capability governs the policy. Whoever controls it can generally manage the rules, so it needs explicit governance and recovery planning.' }
  ],
  tasks: ['Use the lab to compare a free transfer with a royalty-protected transfer.', 'Write the exact buyer-facing disclosure for a policy that can be upgraded.', 'Model an allowlist rule and decide whether it belongs in the asset, the Kiosk listing or the transfer policy.'],
  resources: [
    { type: 'docs', title: 'Sui Kiosk', url: 'https://docs.sui.io/concepts/kiosk' },
    { type: 'docs', title: 'Kiosk transfer policies', url: 'https://docs.sui.io/concepts/kiosk/transfer-policy' }
  ]
});

L.push({
  id: 'l32', module: 7, num: 32,
  title: 'Sponsored Transactions and Gas Stations',
  level: 'Advanced', minutes: 55,
  summary: 'Let an application pay gas without taking control of the user’s intent: understand the two signatures, transaction bytes and sponsor risk controls.',
  objectives: [
    'Explain the separate roles of sender and gas owner',
    'Trace the user and sponsor signatures in a sponsored transaction',
    'Design sponsorship limits that resist gas-draining abuse',
    'Show a wallet a precise transaction summary before it signs'
  ],
  body: `
<h3>Gas payment does not have to be the user’s problem</h3>
<p>In a sponsored transaction, the user remains the transaction sender and signs the commands that express their intent. A sponsor provides the gas payment and adds its own signature for that exact transaction. This can make a first interaction feel like a normal web application while preserving an on-chain signature from the user.</p>
<p>The order matters. The sponsor must never sign a vague promise to pay for “some transaction later”. It reviews final transaction bytes, gas budget, sender, target package and arguments; it signs only the same immutable bytes the user approved. Changing an argument after the user signs invalidates that signature.</p>

<h3>A gas station is an abuse-prevention service</h3>
<p>Sponsorship is an economic policy, not just a helper endpoint. Rate-limit by account and device, permit only approved Move targets, cap gas and value transferred, require a short-lived server-issued nonce, and log every digest. A public sponsor that signs arbitrary PTBs is a faucet for attackers and potentially an execution oracle for unwanted calls.</p>
<div class="note danger"><span class="tag">Never re-sign intent</span>The sponsor may pay gas; it must not rewrite recipient, amount, package or function after the user has approved the transaction. If any field changes, rebuild and require fresh user approval.</div>
`,
  code: [{
    lang: 'typescript', file: 'sponsor-policy.ts', caption: 'Server-side policy checks should inspect the completed transaction before the sponsor signs. This deliberately describes policy rather than exposing a hot-key implementation.',
    src: `type SponsorshipRequest = {
  sender: string;
  target: string;
  gasBudget: bigint;
  transactionBytes: Uint8Array;
  userSignature: string;
};

function approveForSponsorship(req: SponsorshipRequest) {
  if (!ALLOWED_TARGETS.has(req.target)) throw new Error('unsupported Move call');
  if (req.gasBudget > 10_000_000n) throw new Error('gas budget too high');
  if (!verifyUserSignature(req.sender, req.transactionBytes, req.userSignature)) {
    throw new Error('user did not sign these exact bytes');
  }
  if (rateLimitExceeded(req.sender)) throw new Error('sponsorship limit reached');

  // Only now may the sponsor sign the exact same transaction bytes.
  // Store the digest, sender, target and budget for monitoring and recovery.
  return sponsorSign(req.transactionBytes);
}`
  }],
  lab: 'suisponsor',
  quiz: [
    { q: 'Who is the sender in a correctly sponsored transaction?', options: ['Always the gas sponsor', 'The user whose intent is represented by the transaction commands', 'Nobody; sponsorship removes signatures', 'The package publisher'], answer: 1, why: 'The sponsor provides gas, but the user still signs as sender. The two roles and signatures are distinct.' },
    { q: 'What must invalidate a user approval?', options: ['The sponsor checks the gas budget', 'Any change to transaction bytes such as recipient or amount', 'The user selects a wallet', 'The transaction emits an event'], answer: 1, why: 'Signatures bind exact bytes. A changed recipient, target or amount is new intent and requires the user to review and sign again.' },
    { q: 'Which gas-station rule is most important?', options: ['Sponsor any PTB to maximise growth', 'Allow only known targets and cap/rate-limit every request', 'Hide transaction details from the user', 'Use one unlimited gas budget'], answer: 1, why: 'The sponsor is spending real funds. Target allowlists, capped budgets and rate limits bound both financial and execution risk.' }
  ],
  tasks: ['Use the lab to try a safe and an over-budget sponsorship request.', 'Write an allowlist for the one Move call your onboarding flow needs.', 'Specify what the UI displays before the user signs and what the sponsor logs afterward.'],
  resources: [
    { type: 'docs', title: 'Sponsored transactions', url: 'https://docs.sui.io/concepts/transactions/sponsored-transactions' },
    { type: 'docs', title: 'Transaction building', url: 'https://docs.sui.io/concepts/transactions' }
  ]
});

L.push({
  id: 'l33', module: 7, num: 33,
  title: 'zkLogin, Passkeys and Walletless Onboarding',
  level: 'Advanced', minutes: 65,
  summary: 'Compare Sui’s OAuth-backed zkLogin with WebAuthn passkeys, then choose an authentication and recovery model that does not quietly re-centralise custody.',
  objectives: [
    'Explain how zkLogin combines an OAuth identity, ephemeral key and zero-knowledge proof',
    'Contrast zkLogin with a WebAuthn passkey account',
    'Identify where salts, ephemeral keys and recovery options must be protected',
    'Choose an onboarding flow that matches the application’s custody promises'
  ],
  body: `
<h3>Familiar login, on-chain signature</h3>
<p>zkLogin lets a person use an OAuth identity while signing Sui transactions with an ephemeral key. A zero-knowledge proof lets validators verify that the identity claims and ephemeral key are bound correctly without putting the raw JWT on chain. The resulting address is deterministic from the zkLogin inputs, including a user salt chosen to protect privacy.</p>
<p>The application should treat the OAuth provider as an authentication dependency, not as a secret key custodian. Ephemeral private keys and salts are still sensitive client-side material. A poor implementation that uploads them to an application server may restore the very custodial risk zkLogin was meant to reduce.</p>

<h3>Passkeys solve a different part of the problem</h3>
<p>Passkeys use WebAuthn hardware-backed credentials and device authentication such as biometrics. They are attractive when you want phishing-resistant signing and platform sync/recovery. They are not interchangeable with OAuth: evaluate account recovery, device loss, provider dependence, linking multiple credentials and what your user-facing “walletless” claim actually means.</p>
<table><thead><tr><th>Choice</th><th>Best fit</th><th>Main operational question</th></tr></thead><tbody>
<tr><td>Traditional wallet</td><td>Existing crypto users</td><td>How do users back up and switch wallets?</td></tr>
<tr><td>zkLogin</td><td>Consumer OAuth onboarding</td><td>Where are salts and ephemeral keys generated and retained?</td></tr>
<tr><td>Passkey</td><td>Device-native, phishing-resistant UX</td><td>What happens after device loss or credential sync failure?</td></tr>
</tbody></table>
`,
  code: [{
    lang: 'typescript', file: 'auth-boundary.ts', caption: 'Keep secrets in the client boundary. This is a checklist-shaped interface, not a substitute for the official zkLogin or WebAuthn implementation.',
    src: `async function beginWalletlessSession() {
  // Generate the ephemeral signing key in the browser or secure client.
  const ephemeralKey = createEphemeralKeypair();
  const maxEpoch = currentEpoch + 2; // keep the session short-lived

  // Derive or retrieve a per-user salt through a privacy-reviewed design.
  // Do not log it, put it in analytics, or casually send it to your app server.
  const userSalt = await getUserSaltSafely();

  const oauthResult = await startOAuthLogin({ nonce: makeNonce(ephemeralKey, maxEpoch) });
  const proof = await obtainZkLoginProof({ jwt: oauthResult.idToken, userSalt, ephemeralKey, maxEpoch });

  return { ephemeralKey, proof, maxEpoch };
}

// For a passkey flow, verify WebAuthn challenge origin and RP ID server-side,
// then bind only the intended public credential to the on-chain account flow.`
  }],
  lab: 'suiauth',
  quiz: [
    { q: 'What binds a zkLogin transaction to the user session?', options: ['A raw JWT stored on chain', 'An ephemeral signing key bound to identity claims by a zero-knowledge proof', 'A marketplace API key', 'A copied browser cookie'], answer: 1, why: 'Validators verify the proof and signature relationship. The flow avoids publishing a raw OAuth token as the on-chain authentication mechanism.' },
    { q: 'Why is the user salt sensitive in a zkLogin design?', options: ['It determines gas price', 'It helps derive the address and can affect privacy/linkability', 'It replaces every signature', 'It makes an object shared'], answer: 1, why: 'Salt handling is part of the identity and privacy model. It needs a deliberate, reviewed lifecycle.' },
    { q: 'What should a recovery plan cover for a passkey account?', options: ['Only a faster RPC endpoint', 'Device loss, credential sync and how another trusted credential can be linked', 'Making every transaction sponsored', 'Changing an object ID'], answer: 1, why: 'Passkeys improve signing UX but do not eliminate recovery design. Users need a safe path when devices or credentials are unavailable.' }
  ],
  tasks: ['Use the lab to compare the secrets and recovery surfaces of the three onboarding choices.', 'Write a one-page threat model for a zkLogin implementation, including salt storage.', 'Design a second-credential linking flow for a passkey user.'],
  resources: [
    { type: 'docs', title: 'zkLogin', url: 'https://docs.sui.io/concepts/cryptography/zklogin' },
    { type: 'docs', title: 'Passkeys on Sui', url: 'https://docs.sui.io/concepts/cryptography/passkeys' }
  ]
});

L.push({
  id: 'l34', module: 7, num: 34,
  title: 'DeepBook and Composable On-Chain Liquidity',
  level: 'Advanced', minutes: 60,
  summary: 'Learn how a central-limit order book fits Sui’s shared-object model, then compose a quote, order placement and settlement into one transaction flow.',
  objectives: [
    'Compare a central-limit order book with an AMM for execution and liquidity',
    'Explain why a market is shared state while user coins remain owned objects',
    'Calculate a simple limit-order match and remaining order size',
    'Use PTB atomicity to keep a DeFi workflow from leaving funds mid-flight'
  ],
  body: `
<h3>Liquidity as a composable primitive</h3>
<p>A central-limit order book (CLOB) stores bids and asks ordered by price and time. DeepBook is Sui’s order-book liquidity layer: applications can route swaps, create trading UIs or use market prices without each application maintaining a separate order book. A market is shared because many traders compete for the same matching state; their coins and resulting assets can remain owned objects.</p>
<p>AMMs quote continuously from reserves and are simple to compose. A CLOB lets makers specify exact price and size, often giving tighter execution for liquid markets, but it needs order placement, cancellation, matching and settlement. Neither design is universally better: choose based on liquidity source, market structure, desired execution and user experience.</p>

<h3>Keep the user flow atomic</h3>
<p>A trading UI may split a coin, place a limit order, consume a fill, transfer output and return remaining input. A PTB lets those steps share temporary results and commit together. For a limit order, always make the limit price and minimum output explicit; a quote shown before signing is information, not a guarantee.</p>
<div class="note"><span class="tag">Integration caution</span>Use the current DeepBook package IDs, pool IDs and SDK versions for the target network from official deployment documentation. Treat every one as network configuration, not a magic constant copied into a component.</div>
`,
  code: [{
    lang: 'typescript', file: 'limit-order-math.ts', caption: 'The essential matching rule before an SDK turns it into transaction commands: a buy may fill only asks at or below its limit.',
    src: `type Ask = { price: number; size: number };

function fillBuy(limit: number, wanted: number, asks: Ask[]) {
  let remaining = wanted;
  let spent = 0;
  const fills: Ask[] = [];

  for (const ask of asks.sort((a, b) => a.price - b.price)) {
    if (ask.price > limit || remaining === 0) break;
    const size = Math.min(ask.size, remaining);
    fills.push({ price: ask.price, size });
    spent += ask.price * size;
    remaining -= size;
  }
  return { fills, spent, remaining };
}

// A real PTB uses the current DeepBook SDK to place or take the order,
// then transfers filled output and returns unspent input atomically.`
  }],
  lab: 'suibook',
  quiz: [
    { q: 'Why is an order-book market a shared object?', options: ['Every user owns the same coin', 'Orders from unrelated users must be matched against one common price-time state', 'All order books are immutable', 'A CLOB does not use transactions'], answer: 1, why: 'Matching needs one agreed order of changes to the common book. That is exactly the shared-state case.' },
    { q: 'A buy limit is 10 SUI per token. Which ask may fill?', options: ['Only asks above 10', 'Any ask at or below 10, up to the requested size', 'Every ask in the book', 'No ask; limits never execute'], answer: 1, why: 'A buyer sets a maximum price. Lower-priced asks improve execution; higher-priced asks must remain unfilled.' },
    { q: 'Why use a PTB for a composed swap or order flow?', options: ['To remove all market risk', 'To split inputs, perform the call and return outputs or change as one atomic effect', 'To hide the price from the signer', 'To make the shared market address-owned'], answer: 1, why: 'Atomicity prevents a successful early step from leaving a user with inconvenient intermediate state when a later step fails.' }
  ],
  tasks: ['Use the lab to sweep the book with a buy limit and explain each fill.', 'Compare the same trade through an AMM and an order book: list price, liquidity and failure-mode differences.', 'Write the exact PTB stages your UI would need for a buy with a minimum-output protection.'],
  resources: [
    { type: 'docs', title: 'DeepBook documentation', url: 'https://docs.sui.io/standards/deepbookv3' },
    { type: 'docs', title: 'Sui DeFi developer resources', url: 'https://docs.sui.io/guides/developer/defi' }
  ]
});

})(window.ROADMAP.lessons);
