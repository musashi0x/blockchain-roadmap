/* Module 8 — Stellar & Soroban (lesson 37) */
(function (L) {

L.push({
  id: 'stellar-assets', module: 8, num: 37,
  title: 'Stellar Assets, Trustlines, Anchors and Path Payments',
  level: 'Intermediate', minutes: 75,
  summary: 'Model a Stellar payment as a change to account entries: issuers create assets, holders opt in with trustlines, anchors bridge outside money, and path payments trade through the ledger without trusting an intermediary.',
  objectives: [
    'Distinguish XLM, a credit asset and an external asset represented by an anchor',
    'Explain why a trustline is an explicit opt-in, a balance and a credit limit rather than a token approval',
    'Calculate the reserve impact of adding account entries and identify the operations that need XLM headroom',
    'Choose between strict-send and strict-receive path payments and state the limit that protects the user',
    'Recognise issuer, distribution and anchor operational risks before accepting an asset'
  ],
  body: `
<h3>Stellar’s ledger is natively multi-asset</h3>
<p>On Stellar, an asset is either the native asset <strong>XLM</strong> or a pair: an asset code and an issuing account. <code>USD:GB…</code> does not mean “every dollar on Stellar”; it means a credit issued by that exact public key. The issuer can create any amount of its credit asset, so the issuer identity is part of the asset’s name, not incidental metadata.</p>
<p>An issuing account normally sends its asset to a separate <strong>distribution account</strong>. The issuer’s balance appears as a negative amount because it is the liability side of the system; holders’ positive balances are the outstanding credit. Keeping issuance authority offline while a distribution account handles day-to-day payments limits the damage of a hot-key compromise.</p>

<div class="table-scroll"><table><thead><tr><th>Thing</th><th>What it represents</th><th>Who carries the key risk?</th></tr></thead><tbody>
<tr><td><code>XLM</code></td><td>The native network asset; no issuer and no trustline</td><td>The account holder</td></tr>
<tr><td><code>USD:issuer</code></td><td>Credit created by one Stellar account</td><td>Holder and issuer</td></tr>
<tr><td>Anchor deposit/withdrawal</td><td>Movement between a bank, cash rail or another chain and the credit asset</td><td>Holder, issuer and the off-chain anchor</td></tr>
<tr><td>Trustline</td><td>A holder’s on-ledger decision to hold up to a chosen amount of one credit asset</td><td>The holder controls whether it exists; issuer may control authorisation</td></tr>
</tbody></table></div>

<h3>A trustline is consent with a limit</h3>
<p>Before receiving a non-XLM asset, an account adds a trustline to that exact code-and-issuer pair. It records a balance and a maximum amount it is willing to hold. This prevents an issuer—or a stranger—from filling your account with arbitrary assets and making you pay storage for them. It is not an ERC-20 allowance: it gives no one permission to spend from your balance.</p>
<p>Each trustline is a ledger entry, and ledger entries require XLM reserve. An account needs reserve for its base account plus each subentry, such as a trustline, offer, signer or data entry. The network’s <em>base reserve</em> is a protocol parameter, so production software must read it from the current network rather than hard-code a tutorial value.</p>
<pre><code>minimum balance = (2 + number of subentries) × base reserve
available XLM   = XLM balance − minimum balance</code></pre>
<p>If available XLM is insufficient, an operation that creates an entry fails even if the account looks funded in a wallet. Removing an unused trustline generally requires first bringing its asset balance to zero; otherwise deleting it would strand a claim you still hold.</p>

<div class="note warn"><span class="tag">Issuer controls matter</span><p>Some issuers require approval before a trustline can hold their asset, can later revoke authorisation under their policy, or can set their issuer flags so new trustlines cannot be created. These controls can be appropriate for regulated assets, but they mean the holder has counterparty risk. Check the issuer key, flags, domain and anchor terms—not just an asset code that says “USD”.</p></div>

<h3>Anchors connect the ledger to the outside world</h3>
<p>An <strong>anchor</strong> is the business that accepts an external asset and issues, redeems or otherwise supports its Stellar representation. For a fiat asset, deposit usually means the anchor receives money through a bank rail and sends its Stellar credit; withdrawal burns or returns that credit and sends money out. Stellar can prove the ledger transfer. It cannot make a bank transfer settle, establish a customer’s identity, or guarantee that an issuer remains solvent.</p>
<p>SEP standards make those workflows interoperable: for example, a wallet can discover an anchor’s capabilities and obtain deposit or withdrawal instructions. The standards reduce integration friction; they do not remove KYC, sanctions, custody, redemption or issuer-default risk.</p>

<h3>Path payments use prices already committed to the ledger</h3>
<p>A simple payment moves one asset directly. A <strong>path payment</strong> lets the sender pay with asset A while the recipient receives asset B. Stellar’s matching engine finds a route through order-book offers and, where available, liquidity pools. Every conversion and the final delivery settle atomically: if any hop cannot meet its limit, the entire transaction fails and no partial exchange remains.</p>
<div class="table-scroll"><table><thead><tr><th>Operation</th><th>User promises</th><th>User protects</th><th>Use it when</th></tr></thead><tbody>
<tr><td><code>pathPaymentStrictReceive</code></td><td>The recipient gets an exact destination amount</td><td><code>sendMax</code>: never spend more than this</td><td>An invoice must arrive as exactly 50 USDC</td></tr>
<tr><td><code>pathPaymentStrictSend</code></td><td>Spend an exact source amount</td><td><code>destMin</code>: never receive less than this</td><td>You want to convert exactly 100 XLM</td></tr>
</tbody></table></div>
<p>Do not treat a quote as a guarantee. Offers can be consumed before your transaction closes. Set the appropriate limit from a fresh quote with a margin you understand, and treat a failed path payment as a normal, safe result—not a reason to retry without a limit.</p>

<div class="note"><span class="tag">Design rule</span>Display the complete asset identity—code <em>and</em> issuer—and the redemption path. “USDC” without the issuer key and anchor relationship is an ambiguous label, not enough information to make a payment decision.</div>
`,
  code: [{
    lang: 'typescript', file: 'pay-in-asset.ts',
    caption: 'A strict-receive payment says what the recipient must receive and caps what the sender can spend. The recipient needs a trustline to the destination asset; the source account needs enough XLM for fees and reserve.',
    src: `import {
  Asset, Keypair, Networks, Operation, TransactionBuilder
} from "@stellar/stellar-sdk";

const source = Keypair.fromSecret(process.env.SOURCE_SECRET!);
const destination = "GDESTINATION_ACCOUNT…";

// Asset identity is both its code and the issuer public key.
const usd = new Asset("USD", "GUSD_ISSUER_ACCOUNT…");
const xlm = Asset.native();

// account is fetched from Horizon immediately before building in real code.
const tx = new TransactionBuilder(account, {
  fee: "100",                 // read the network fee stats in production
  networkPassphrase: Networks.PUBLIC,
})
  .addOperation(Operation.pathPaymentStrictReceive({
    sendAsset: xlm,
    sendMax: "82.5000000",    // price/slippage protection for the sender
    destination,
    destAsset: usd,
    destAmount: "50.0000000", // recipient must receive exactly this much
    path: [],                  // Horizon may suggest intermediate assets
  }))
  .setTimeout(60)
  .build();

tx.sign(source);
// Submit tx to a Horizon server. If offers disappear and 50 USD cannot be
// delivered for <= 82.5 XLM, the whole transaction fails atomically.`
  }],
  lab: 'stellarassets',
  quiz: [
    { q: 'An account wants to receive USD issued by GISSUER. What must it do before someone can send that asset?', options: ['Approve the issuer to spend its XLM', 'Add a trustline to USD:GISSUER with a suitable limit', 'Stake XLM with the issuer', 'Create a new Stellar account'], answer: 1, why: 'A trustline is the account’s explicit opt-in to that code-and-issuer pair. It stores the balance and chosen maximum holding; it does not grant spending authority.' },
    { q: 'What makes USD:GISSUER different from another asset also labelled USD?', options: ['Only the wallet icon', 'The issuer public key is part of the asset identity', 'One must use a liquidity pool', 'The amount of XLM in the sender account'], answer: 1, why: 'Stellar credit assets are identified by code and issuer. A familiar code is not evidence that an issuer is the anchor or organisation you intend to use.' },
    { q: 'A strict-receive path payment asks to deliver 50 USD with sendMax = 82.5 XLM. What happens if the available route now costs 83 XLM?', options: ['It spends 83 XLM because delivery is more important', 'It delivers a smaller amount of USD', 'The whole transaction fails without a partial exchange', 'It creates a debt to the issuer'], answer: 2, why: 'sendMax is the protection in strict-receive mode. Atomic execution means no intermediate conversion remains if the final limit cannot be satisfied.' },
    { q: 'Why can adding a trustline fail even when an account owns some XLM?', options: ['Trustlines must be approved by every validator', 'The new ledger entry increases the account’s minimum reserve and there is not enough available XLM', 'Only issuers may add trustlines', 'A trustline consumes the account sequence number permanently'], answer: 1, why: 'Trustlines are subentries. The account must keep the XLM reserve required by its base account and all entries after the new one is created.' }
  ],
  tasks: [
    'Use the lab to add trustlines and offers, then compare strict-send with strict-receive when the best offer is removed.',
    'Choose an anchor asset from the public Stellar ecosystem and record its code, issuer key, home domain, deposit rail, withdrawal rail and redemption terms.',
    'For an account with 5 XLM, a base reserve of 0.5 XLM and four existing subentries, calculate whether it can add two more trustlines while keeping a 0.1 XLM fee buffer.',
    'Write the UI copy for a payment confirmation that makes the asset issuer and the user’s send limit impossible to miss.'
  ],
  resources: [
    { type: 'docs', title: 'Stellar assets and trustlines', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets' },
    { type: 'docs', title: 'Stellar accounts and reserves', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts' },
    { type: 'docs', title: 'Path payments', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-operations/path-payments' },
    { type: 'sep', title: 'SEP-6: Deposit and withdrawal API', url: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md' },
    { type: 'sdk', title: 'Stellar JavaScript SDK', url: 'https://stellar.github.io/js-stellar-sdk/' }
  ]
});

L.push({
  id: 'stellar-consensus', module: 8, num: 38,
  title: 'Stellar Consensus Protocol: Quorum Slices and Trust',
  level: 'Advanced', minutes: 75,
  summary: 'Understand Stellar Consensus Protocol as an overlapping web of validator choices: safety comes from quorum intersection, liveness comes from reachable slices, and neither is guaranteed by a token stake.',
  objectives: [
    'Define a validator, quorum slice, quorum and quorum intersection',
    'Explain why a healthy-looking validator list can still fail safety or liveness',
    'Trace how a local slice choice becomes a network-wide trust assumption',
    'Separate validator availability from concentration and correlated-failure risk',
    'Evaluate a quorum configuration without mistaking an explorer statistic for a security proof'
  ],
  body: `
<h3>Validators choose whom they need to hear from</h3>
<p>Stellar Consensus Protocol (SCP) is federated Byzantine agreement. There is no protocol-wide fixed validator set or stake-weighted lottery that every node must accept. Instead, each validator declares one or more <strong>quorum slices</strong>: sets of other validators sufficient for <em>that validator</em> to agree that a statement is accepted.</p>
<p>A <strong>quorum</strong> is a set of validators where every member has at least one of its slices entirely inside the set. The global property that protects safety is <strong>quorum intersection</strong>: any two possible quorums overlap in at least one honest validator. Without it, two disconnected groups can each confirm incompatible histories while following their own configurations perfectly.</p>

<div class="table-scroll"><table><thead><tr><th>Term</th><th>Plain meaning</th><th>What can go wrong?</th></tr></thead><tbody>
<tr><td>Validator</td><td>Node that participates in SCP and publishes a quorum-set configuration</td><td>Offline, compromised or operated with hidden correlated dependencies</td></tr>
<tr><td>Quorum slice</td><td>One sufficient set of peers for a particular validator</td><td>Too narrow: centralisation; too broad: difficult to reach</td></tr>
<tr><td>Quorum</td><td>Mutually self-sufficient group under the configured slices</td><td>Separate quorums can threaten safety if they do not intersect</td></tr>
<tr><td>Blocking set</td><td>Validators whose loss prevents progress for a group</td><td>A shared cloud, region or operator outage can halt the network</td></tr>
</tbody></table></div>

<h3>Safety and liveness ask different questions</h3>
<p><strong>Safety:</strong> can honest nodes avoid confirming two different values for the same slot? Quorum intersection is the central condition. <strong>Liveness:</strong> can the network eventually agree on a value? A configuration can intersect safely but be so dependent on unavailable validators that it cannot make progress. It can also look diverse by public-key count while relying on the same organisation, cloud region or network link.</p>
<p>Think of a slice as a statement of operational trust, not a popularity vote. Adding a well-known validator might improve availability; copying somebody else’s exact configuration can also import its concentrated dependencies. The right question is not “how many validators do I list?” but “which independent failures can prevent my node from finding an honest, reachable slice?”</p>

<div class="note danger"><span class="tag">Safety boundary</span><p>SCP does not make an issuer trustworthy. Consensus can establish that <code>USD:GISSUER</code> moved according to the ledger rules; it cannot establish that GISSUER has dollars, honours redemption, or will not use its asset controls. Network consensus and asset counterparty risk are separate layers.</p></div>

<h3>Configuration is part of the protocol</h3>
<p>Validator operators publish quorum-set information and should monitor their own reachability, externalisation behaviour and dependencies. Network observers can analyse published configurations for intersection, but analysis is time-sensitive: an operator can change configuration, hosts can fail together, and a validator key can represent a cluster rather than a single machine. Use configuration analysis as a review tool, then maintain operational diversity in the real world.</p>
`,
  code: [{
    lang: 'toml', file: 'stellar-core.cfg (teaching excerpt)',
    caption: 'A quorum set declares the local validator’s trust choices. The names and keys are illustrative; production operators use current, independently verified public keys and review the full configuration.',
    src: `# One validator's local policy. This is not a global membership list.
NODE_IS_VALIDATOR=true
NODE_SEED="S… private validator seed — keep out of config management"

[QUORUM_SET]
THRESHOLD_PERCENT=67
VALIDATORS=[
  "GVALIDATOR_A…", # independent organisation / region
  "GVALIDATOR_B…",
  "GVALIDATOR_C…",
  "GVALIDATOR_D…"
]

# Before using a set, ask:
# - Do plausible quorums overlap with the network's other sets?
# - Which 2-of-4 failures stop my 67% slice?
# - Are the keys really independent operators, hosts and networks?`
  }],
  lab: 'stellarquorum',
  quiz: [
    { q: 'What does quorum intersection protect?', options: ['Every validator earns the same fee', 'Two possible quorums share honest validators, preventing incompatible confirmations', 'Every issuer must redeem its asset', 'A transaction can never fail'], answer: 1, why: 'Intersection is the safety condition. An honest validator in the overlap does not confirm contradictory values for the same consensus slot.' },
    { q: 'A quorum set names five public keys hosted by one company in one region. What is the main concern?', options: ['The keys are too short', 'It has five independent failure domains', 'The apparent key count hides a correlated availability and trust dependency', 'It cannot use SCP'], answer: 2, why: 'Public-key count is not operational independence. One company, cloud region or network failure can remove several validators at once.' },
    { q: 'Can a network configuration have quorum intersection and still stop progressing?', options: ['No; intersection also guarantees liveness', 'Yes; enough required validators may be unreachable to form a live slice', 'Only if XLM has no price', 'Only when a path payment is pending'], answer: 1, why: 'Safety and liveness are separate. A conservative, intersecting configuration can still be unavailable if its dependencies fail.' }
  ],
  tasks: [
    'Use the lab to compare a shared-core configuration with two disconnected groups; identify the property that changes.',
    'Draw the operator, cloud-region and network-provider dependencies behind four validator keys. Count failure domains, not keys.',
    'Write a change-review checklist for adding a validator to a quorum set.',
    'Explain why trust in an anchor’s USD redemption policy cannot be solved by quorum-slice design.'
  ],
  resources: [
    { type: 'paper', title: 'The Stellar Consensus Protocol', url: 'https://stellar.org/papers/stellar-consensus-protocol.pdf' },
    { type: 'docs', title: 'Stellar consensus overview', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-consensus-protocol' },
    { type: 'tool', title: 'Stellar quorum explorer', url: 'https://stellarbeat.io/' }
  ]
});

L.push({
  id: 'stellar-transactions', module: 8, num: 39,
  title: 'Stellar Transactions: Sequence Numbers, Atomic Operations and Threshold Multisig',
  level: 'Intermediate', minutes: 80,
  summary: 'Build a transaction as a bounded, atomic instruction list: sequence numbers prevent replay, time bounds limit its validity, and signer weights let an account require the right combination of people or systems.',
  objectives: [
    'Explain why a Stellar transaction consumes exactly one account sequence number',
    'Use atomic operation ordering to avoid partial account-state changes',
    'Set time bounds and identify the risk of signing an unbounded transaction',
    'Model low, medium and high threshold policies using signer weights',
    'Recognise fee-bump sponsorship and transaction signatures as distinct authorisations'
  ],
  body: `
<h3>One envelope, many all-or-nothing operations</h3>
<p>A Stellar transaction is an ordered list of operations signed by a source account. It either applies every operation in order or applies none. This lets you create a trustline, make a payment and update a signer policy as one state transition—but it also means an operation late in the list can invalidate all earlier work. Build and simulate the whole transaction before asking people to sign.</p>
<p>Every normal transaction uses the next <strong>sequence number</strong> of its source account. Once accepted, that number advances. A second transaction built from the old sequence number cannot replay or race successfully; it must be rebuilt from current account state. This is also why unrelated clients sharing one source account need coordination.</p>

<h3>Bound the authority you give a signature</h3>
<p>Time bounds tell the network when an envelope is valid. A short upper bound makes a payment request expire instead of living in someone’s inbox indefinitely. Pre-authorised transaction hashes and signed payloads can support more specialised flows, but the same principle applies: authority should be narrow in amount, operation, source and time.</p>
<div class="note warn"><span class="tag">Signing rule</span>Before signing, inspect the network passphrase, source account, sequence number, operations, assets with issuers, destinations, fee and time bounds. A valid signature only proves that the key approved the bytes—not that the bytes represented the intent you thought you were approving.</div>

<h3>Multisig is a threshold policy, not a wallet brand</h3>
<p>An account can have signer keys with integer weights and three thresholds: low, medium and high. Each operation type asks for one threshold. For example, a treasury can require one operations key for low-risk actions, two of three people for payments, and three of three for adding or removing signers. The sum of supplied signer weights must reach the operation’s threshold.</p>
<p>Keep the master key’s weight deliberate. Setting it to zero can be a useful hardening step only after alternative signer recovery has been tested; losing every signer above the required threshold makes the account unrecoverable. A threshold policy should specify who holds each key, how a lost key is replaced, and which actions are intentionally impossible during an incident.</p>

<h3>Fee payer is not necessarily the source account</h3>
<p>A fee-bump transaction wraps an inner transaction and pays its fee from a separate account. The inner transaction still needs the authorisation required by its own source accounts; the outer fee source authorises only fee payment. This is useful for sponsored onboarding, but it must not be described as “the sponsor approved the payment” unless it also signed the inner payment.</p>
`,
  code: [{
    lang: 'typescript', file: 'treasury-payment.ts',
    caption: 'Two independent keys sign one medium-threshold payment. A short timeout turns a stale approval request into an invalid envelope; the current account sequence number is fetched immediately before building.',
    src: `import { Asset, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const signerA = Keypair.fromSecret(process.env.SIGNER_A!);
const signerB = Keypair.fromSecret(process.env.SIGNER_B!);

const tx = new TransactionBuilder(treasuryAccount, {
  fee: "100",
  networkPassphrase: Networks.PUBLIC,
})
  .addOperation(Operation.payment({
    destination: "GVENDOR…",
    asset: Asset.native(),
    amount: "250.0000000",
  }))
  .setTimeout(300) // expire five minutes after construction
  .build();

// Treasury medium threshold = 2, each signer weight = 1.
tx.sign(signerA);
tx.sign(signerB);
// The network checks the threshold, sequence number and time bound before
// applying this payment. One bad operation would revert the whole envelope.`
  }],
  lab: 'stellarmultisig',
  quiz: [
    { q: 'What happens to the operations before a failing operation in the same Stellar transaction?', options: ['They remain applied', 'They are rolled back; the transaction is atomic', 'They are queued for the next ledger', 'They are paid for by the fee-bump account'], answer: 1, why: 'A transaction is all-or-nothing. Operations execute in order only if all validation and execution succeeds.' },
    { q: 'Why does a transaction use an account sequence number?', options: ['To choose the validator leader', 'To make a signed transaction unique and prevent replay from the same source account', 'To calculate a trustline limit', 'To identify an asset issuer'], answer: 1, why: 'The network accepts only the next sequence number. A stale envelope cannot be submitted again after another transaction advances the account.' },
    { q: 'What does the outer signer of a fee-bump transaction authorise?', options: ['Every operation in the inner transaction', 'Only payment of the outer transaction fee', 'The asset issuer’s flags', 'A new trustline for the destination'], answer: 1, why: 'The inner envelope retains its own sources and required signatures. Fee sponsorship does not automatically approve the action being sponsored.' }
  ],
  tasks: [
    'Use the lab to create a 2-of-3 medium threshold, then try to submit with one and with two signers.',
    'Design low, medium and high threshold rules for a small company treasury, including a lost-key recovery path.',
    'Write an approval screen that exposes the source, sequence, asset issuer, destination, time bound and required signers.',
    'Describe a sponsored onboarding flow and mark exactly which party authorises fees, account creation and the first payment.'
  ],
  resources: [
    { type: 'docs', title: 'Stellar transactions and sequence numbers', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-operations-and-transactions' },
    { type: 'docs', title: 'Multisig and thresholds', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-operations-and-transactions/multi-sig' },
    { type: 'docs', title: 'Fee-bump transactions', url: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-operations-and-transactions/fee-bump-transactions' }
  ]
});

L.push({
  id: 'soroban-auth-storage', module: 8, num: 40,
  title: 'Soroban: Authorization, Storage and a Safe WASM Contract',
  level: 'Advanced', minutes: 85,
  summary: 'Write a small Soroban contract that makes authority explicit, stores state deliberately, emits an auditable event, and treats storage lifetime as part of the application design.',
  objectives: [
    'Describe Soroban as a WASM contract host embedded in the Stellar network',
    'Use Address.require_auth to bind a state-changing action to an authoriser',
    'Choose instance, persistent or temporary storage from access and lifetime needs',
    'Explain why storage TTL and extension are correctness concerns, not housekeeping',
    'Identify the authorisation, input validation and upgrade decisions in a contract review'
  ],
  body: `
<h3>Contracts run in a bounded host, not a private chain</h3>
<p>Soroban executes WebAssembly contracts as part of Stellar transactions. A contract invocation is still an operation inside the same ledger world as accounts and assets, with metered CPU, memory and storage work. The host exposes typed values, cryptographic functions, events, contract calls and storage through <code>Env</code>. Rust is the common authoring language, but the runtime is WASM.</p>
<p>The important shift from a familiar EVM tutorial is not syntax; it is authority. A function that changes a user’s state should receive the relevant <code>Address</code> and call <code>require_auth()</code>. The host verifies that the transaction’s authorisation tree covers that invocation. Do not replace it with “the caller supplied an address” or an unauthenticated storage key.</p>

<h3>Storage has scope and lifetime</h3>
<div class="table-scroll"><table><thead><tr><th>Storage</th><th>Good fit</th><th>Lifetime design question</th></tr></thead><tbody>
<tr><td>Instance</td><td>Small contract-wide configuration or counters</td><td>How will it be updated and, if needed, extended?</td></tr>
<tr><td>Persistent</td><td>User balances, positions and durable application state</td><td>Who keeps its TTL alive, and what happens if they do not?</td></tr>
<tr><td>Temporary</td><td>Short-lived nonces, caches and rate-limit windows</td><td>Is expiry an acceptable and intended deletion path?</td></tr>
</tbody></table></div>
<p>Soroban storage has a time-to-live (TTL). Entries can expire if an application does not extend them, so expiry is a business-logic event to plan for—not merely an operational cleanup. Durable user value should use the appropriate durable storage and a clear extension policy. Conversely, temporary replay-protection data is useful precisely because it can disappear after its validity window.</p>

<h3>Keep the authorization boundary narrow</h3>
<p>In the example, an owner authorises an increment that only changes that owner’s counter. It does not give a global administrator the ability to write every user’s value. If an administrator is genuinely necessary, model that capability explicitly, make upgrade authority visible, and test the failure cases: wrong signer, malformed amount, repeated call and expired storage.</p>
<div class="note danger"><span class="tag">Review rule</span><p>Every state-changing entry point needs a sentence of the form “<em>who</em> can change <em>which state</em>, under <em>which bounds</em>?” If the answer is “any caller can pass an address,” the contract has described an identifier, not authorisation.</p></div>

<h3>Events are a public interface</h3>
<p>Emit compact, stable events for facts that indexers and users need: a counter changed, a deposit occurred, an administrator changed. Events are not a substitute for state, but they make external reconstruction and monitoring practical. Version event topics deliberately; downstream applications will depend on them once the contract is live.</p>
`,
  code: [{
    lang: 'rust', file: 'lib.rs',
    caption: 'A small Soroban counter. The owner must authorise the call, values are bounded, and an event records the change. In a real app, choose a TTL-extension policy for every stored value.',
    src: `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
#[derive(Clone)]
enum Key { Count(Address) }

#[contract]
pub struct Counter;

#[contractimpl]
impl Counter {
    pub fn increment(env: Env, owner: Address, by: u32) -> u32 {
        owner.require_auth();             // not merely an address parameter
        assert!(by > 0 && by <= 100);

        let key = Key::Count(owner.clone());
        let old: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        let next = old.checked_add(by).expect("counter overflow");

        env.storage().persistent().set(&key, &next);
        env.events().publish((symbol_short!("count"), owner), next);
        next
    }

    pub fn get(env: Env, owner: Address) -> u32 {
        env.storage().persistent().get(&Key::Count(owner)).unwrap_or(0)
    }
}`
  }],
  lab: 'sorobanauth',
  quiz: [
    { q: 'What does owner.require_auth() establish in a Soroban function?', options: ['That owner is a valid-looking public key', 'That the transaction authorisation covers this invocation for owner', 'That owner has an XLM trustline', 'That the contract is upgradeable'], answer: 1, why: 'An Address argument identifies a principal; require_auth asks the host to verify that the required principal authorised this call in the transaction.' },
    { q: 'Which storage is suitable for a short replay-protection nonce that may disappear after a defined window?', options: ['Temporary storage', 'A contract event only', 'The issuer account balance', 'A quorum slice'], answer: 0, why: 'Temporary storage is designed for bounded-lifetime data. The expiry must be part of the protocol design, not an accidental loss of durable user state.' },
    { q: 'Why should a contract plan for storage TTL extension?', options: ['WASM cannot store data', 'Entries may expire, so neglecting their lifetime can become application-state loss or a failed workflow', 'It replaces access control', 'It makes all invocations free'], answer: 1, why: 'Soroban storage lifetime is explicit. Durable state needs a deliberate extension policy and temporary state needs expiry-safe behaviour.' }
  ],
  tasks: [
    'Use the lab to compare an authenticated owner update with a forged-address attempt, then select durable versus temporary storage for each state item.',
    'Add a per-owner daily increment limit to the example and identify the storage key and TTL policy it needs.',
    'Write three events for a simple escrow contract and state which fields belong in topics versus data.',
    'Review a contract API and write an authorisation sentence for every state-changing method.'
  ],
  resources: [
    { type: 'docs', title: 'Soroban smart-contract fundamentals', url: 'https://developers.stellar.org/docs/build/smart-contracts/getting-started' },
    { type: 'docs', title: 'Soroban authorization', url: 'https://developers.stellar.org/docs/build/guides/auth' },
    { type: 'docs', title: 'Soroban storage and TTL', url: 'https://developers.stellar.org/docs/build/guides/storage' },
    { type: 'sdk', title: 'soroban-sdk Rust API', url: 'https://docs.rs/soroban-sdk/' }
  ]
});

})(window.ROADMAP.lessons);
