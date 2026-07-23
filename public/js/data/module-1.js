/* Module 1 — Foundations & Cryptography (lessons 1-5) */
(function (L) {

L.push({
  id: 'l01', module: 1, num: 1,
  title: 'What a Blockchain Actually Is',
  level: 'Beginner', minutes: 50,
  summary: 'Strip away the hype: a blockchain is a replicated append-only log whose ordering is agreed by mutually distrusting machines.',
  objectives: [
    'Define a blockchain without using the words "trust" or "revolutionary"',
    'Explain the double-spend problem and why it is hard without a central server',
    'Compare a blockchain against a normal database on six concrete axes',
    'Know when a blockchain is the wrong tool'
  ],
  body: `
<h3>The one-sentence definition</h3>
<p>A blockchain is <strong>a replicated, append-only log of transactions, ordered by a consensus rule, where every replica can independently verify the whole history from first principles</strong>.</p>
<p>Four words are doing all the work:</p>
<ul>
  <li><strong>Replicated</strong> — every node holds a full copy. There is no primary.</li>
  <li><strong>Append-only</strong> — you never edit entry 500; you append entry 501 that supersedes it. History is evidence.</li>
  <li><strong>Ordered by consensus</strong> — the hard part. Machines that do not trust each other must agree on one ordering.</li>
  <li><strong>Independently verifiable</strong> — a node accepts nothing on authority. It re-checks signatures, balances and hashes itself.</li>
</ul>

<h3>The problem it solves: double spend</h3>
<p>Digital money is a file. Files copy perfectly. If Alice has one coin and sends the same coin to Bob and to Carol at the same instant, both receive a valid-looking message. Who owns the coin?</p>
<p>Banks solve this with a single authoritative ledger: the bank sees both, applies one, rejects the other. The cost is that the bank can also freeze, reverse, censor or fail.</p>
<p>A blockchain solves it by making <em>ordering itself</em> the scarce resource. Everyone must agree that "Alice&nbsp;→&nbsp;Bob" came first. Once that ordering is locked in and expensive to revise, "Alice&nbsp;→&nbsp;Carol" is simply invalid — Alice no longer owns the coin at that point in history.</p>

<div class="note">
  <span class="tag">Core insight</span>
  <p>Blockchains do not prevent lying. They make one specific lie — rewriting agreed history — cost more than it pays.</p>
</div>

<h3>Anatomy of the stack</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Layer</th><th>Job</th><th>Example</th></tr></thead>
<tbody>
<tr><td>Cryptography</td><td>Identity + tamper evidence</td><td>SHA-256, ECDSA on secp256k1</td></tr>
<tr><td>Data structures</td><td>Efficient commitment to state</td><td>Merkle trees, Patricia tries</td></tr>
<tr><td>Networking</td><td>Gossip blocks and transactions</td><td>P2P flooding, devp2p, libp2p</td></tr>
<tr><td>Consensus</td><td>Agree on one ordering</td><td>Nakamoto PoW, Gasper PoS, Tendermint</td></tr>
<tr><td>Execution</td><td>Apply transactions to state</td><td>Bitcoin Script, EVM, SVM, Move</td></tr>
<tr><td>Application</td><td>What users actually touch</td><td>Wallets, DEXes, NFTs, bridges</td></tr>
</tbody>
</table>
</div>
<p>Lessons 2-4 build the bottom two layers by hand. Everything above is engineering on top of them.</p>

<h3>Permissionless vs permissioned</h3>
<ul>
  <li><strong>Permissionless</strong> (Bitcoin, Ethereum): anyone can run a node, validate, transact. Sybil resistance must be bought with something scarce — hashpower or stake.</li>
  <li><strong>Permissioned</strong> (Hyperledger Fabric, Corda): validators are known and vetted. You can use cheap classical BFT consensus because identities are fixed.</li>
</ul>
<p>Permissioned chains are usually a distributed database with extra steps. If you already know and trust the participants, ask hard whether Postgres with an audit log is enough.</p>

<h3>Blockchain vs database, honestly</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Axis</th><th>Postgres</th><th>Public blockchain</th></tr></thead>
<tbody>
<tr><td>Writes/sec</td><td>50,000+</td><td>15 (Ethereum L1) to a few thousand (L2s)</td></tr>
<tr><td>Latency</td><td>Milliseconds</td><td>Seconds to minutes for finality</td></tr>
<tr><td>Cost per write</td><td>~free</td><td>Cents to dollars</td></tr>
<tr><td>Who can write</td><td>Whoever holds credentials</td><td>Anyone who can pay + satisfies contract rules</td></tr>
<tr><td>Who can censor</td><td>The operator</td><td>Nobody alone; a majority coalition, temporarily</td></tr>
<tr><td>Correcting a mistake</td><td>UPDATE</td><td>Impossible; only compensating transactions</td></tr>
</tbody>
</table>
</div>

<div class="note warn">
  <span class="tag">When NOT to use one</span>
  <p>Private data (everything is public), high throughput, mutable records, a single trusted operator, or anything needing legal reversibility. "We want an immutable audit log" is usually satisfied by an append-only table plus signed hashes.</p>
</div>

<h3>What actually goes in a block</h3>
<p>A block is a header plus a list of transactions. The header is tiny — around 80 bytes in Bitcoin, a few hundred in Ethereum — and contains commitments rather than data:</p>
<ul>
  <li><code>parentHash</code> — hash of the previous header. This is the "chain".</li>
  <li><code>stateRoot</code> / <code>merkleRoot</code> — a single hash committing to all transactions and (in Ethereum) all account state.</li>
  <li><code>timestamp</code>, <code>number</code>, and consensus fields (<code>nonce</code>, <code>difficulty</code>, or a validator signature).</li>
</ul>
<p>Because the header commits to everything, checking one 32-byte hash is enough to detect any change anywhere in the block. That property is what Lesson 2 and Lesson 4 make concrete.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'mental-model.js',
      caption: 'The whole idea in twelve lines. Each block seals the previous one by hash, so editing block 1 invalidates every block after it.',
      src: `// A chain is just: block.prevHash === hash(previousBlock)
const chain = [];

function appendBlock(data) {
  const prev = chain[chain.length - 1];
  const block = {
    index: chain.length,
    data,
    prevHash: prev ? prev.hash : '0'.repeat(64),
    timestamp: Date.now()
  };
  block.hash = sha256(block.index + block.data + block.prevHash + block.timestamp);
  chain.push(block);
  return block;
}

// Verification is equally simple: recompute and compare.
function isValid() {
  return chain.every((b, i) =>
    i === 0 || b.prevHash === chain[i - 1].hash);
}`
    }
  ],
  lab: 'ledger',
  quiz: [
    {
      q: 'What makes double spending hard on a public blockchain?',
      options: [
        'Transactions are encrypted so attackers cannot read balances',
        'The network agrees on a single ordering of transactions, and revising that order is expensive',
        'Each coin has a serial number checked against a central registry',
        'Wallets refuse to sign two transactions from the same balance'
      ],
      answer: 1,
      why: 'Ordering is the scarce resource. Once "Alice → Bob" is buried under work or stake, replacing it with "Alice → Carol" costs more than the coin is worth. Transactions are public, not encrypted, and no central registry exists.'
    },
    {
      q: 'Your team wants an immutable audit log for internal compliance, with 5,000 writes/sec, readable only by staff. Best fit?',
      options: [
        'A public L1 blockchain',
        'A permissioned blockchain with 4 validators',
        'An append-only database table with periodic signed hash checkpoints',
        'An NFT per audit event'
      ],
      answer: 2,
      why: 'Single trusted operator, private data, high throughput — every property points away from a blockchain. Signed hash checkpoints (optionally anchored to a public chain daily) give tamper evidence at a fraction of the cost.'
    },
    {
      q: 'Which statement about block headers is correct?',
      options: [
        'Headers contain the full transaction list so nodes can replay them',
        'Headers are large, which is why light clients cannot exist',
        'Headers contain commitments (hashes) to the data, so a tiny header detects any change to a large block',
        'Headers are optional in most chain designs'
      ],
      answer: 2,
      why: 'A header is roughly 80-600 bytes and commits to megabytes of data through Merkle roots. This asymmetry is exactly what makes light clients and proofs possible (Lesson 4).'
    }
  ],
  tasks: [
    'Open a public block explorer and open the latest Ethereum block. Identify parentHash, stateRoot, timestamp and gas used. Then open the parent and confirm its hash equals the child parentHash.',
    'Write one paragraph arguing that your current employer should NOT put its main product on a blockchain. Be specific about latency, cost and privacy.',
    'List three real systems that solve double-spend without a blockchain (e.g. card networks) and note what each one trusts.',
    'In the lab above, drive the honest node count below the malicious count and describe in your own words what breaks.'
  ],
  resources: [
    { type: 'paper', title: 'Bitcoin: A Peer-to-Peer Electronic Cash System (Nakamoto, 9 pages)', url: 'https://bitcoin.org/bitcoin.pdf' },
    { type: 'docs', title: 'Ethereum.org — Intro to blockchain', url: 'https://ethereum.org/en/developers/docs/intro-to-ethereum/' },
    { type: 'read', title: 'Ethereum Yellow Paper (skim section 4 for the block structure)', url: 'https://ethereum.github.io/yellowpaper/paper.pdf' }
  ]
});

L.push({
  id: 'l02', module: 1, num: 2,
  title: 'Hash Functions: The Workhorse',
  level: 'Beginner', minutes: 60,
  summary: 'SHA-256 and Keccak-256 do five separate jobs in a blockchain. Learn the properties, then break your intuition with the avalanche effect.',
  objectives: [
    'State the three security properties of a cryptographic hash and give an attack that each one blocks',
    'Explain preimage vs second-preimage vs collision resistance',
    'Compute SHA-256 and Keccak-256 and explain why Ethereum uses the latter',
    'Understand why hashing is not encryption and never reversible'
  ],
  body: `
<h3>What a hash function is</h3>
<p>A cryptographic hash takes any amount of input and returns a fixed-size digest — 32 bytes for SHA-256 and Keccak-256. Same input always gives the same output. Different input almost certainly gives a completely unrelated output.</p>

<h3>The three properties that matter</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Property</th><th>Means</th><th>Blocks this attack</th></tr></thead>
<tbody>
<tr><td>Preimage resistance</td><td>Given <code>h</code>, you cannot find any <code>m</code> with <code>hash(m) = h</code></td><td>Recovering a committed secret from its commitment</td></tr>
<tr><td>Second-preimage resistance</td><td>Given <code>m1</code>, you cannot find <code>m2 ≠ m1</code> with the same hash</td><td>Swapping a specific transaction for a forged one</td></tr>
<tr><td>Collision resistance</td><td>You cannot find <em>any</em> pair <code>m1 ≠ m2</code> hashing equal</td><td>Preparing two documents and later swapping which one you "signed"</td></tr>
</tbody>
</table>
</div>
<p>Collision resistance is the weakest to attack because of the birthday bound: with an <em>n</em>-bit output you expect a collision after about 2<sup>n/2</sup> tries, not 2<sup>n</sup>. SHA-256 therefore offers 128-bit collision security and 256-bit preimage security. That is why 256-bit outputs are the norm — SHA-1 (160-bit) fell to a real collision in 2017.</p>

<h3>Avalanche</h3>
<p>Flip one bit of input and roughly half the output bits flip, unpredictably. There is no "close" in hash space. This is what makes hashes work as fingerprints: any change to any byte of a block produces a totally different header hash, which any node notices instantly.</p>

<div class="note">
  <span class="tag">Hashing ≠ encryption</span>
  <p>Encryption is reversible with a key. Hashing is a one-way, keyless compression — information is destroyed. "Decrypt this hash" is not a thing; the best anyone can do is guess inputs and compare (which is why password hashing needs slow, salted functions like Argon2, not raw SHA-256).</p>
</div>

<h3>The five jobs hashes do in a blockchain</h3>
<ol>
  <li><strong>Linking blocks</strong> — <code>block.parentHash</code> makes history tamper-evident.</li>
  <li><strong>Committing to sets</strong> — a Merkle root summarises thousands of transactions in 32 bytes (Lesson 4).</li>
  <li><strong>Identifiers</strong> — a transaction hash <em>is</em> its ID; an Ethereum address is a truncated hash of a public key.</li>
  <li><strong>Proof of work</strong> — the mining puzzle is "find input whose hash is below a target" (Lesson 7).</li>
  <li><strong>Commit-reveal</strong> — publish <code>hash(secret ‖ salt)</code> now, reveal later; nobody can front-run what they cannot read.</li>
</ol>

<h3>SHA-256 vs Keccak-256 vs SHA3-256</h3>
<ul>
  <li><strong>SHA-256</strong> — Merkle-Damgård construction, NIST 2001. Bitcoin uses it, twice (<code>SHA256(SHA256(x))</code>) for historical caution against length-extension attacks.</li>
  <li><strong>Keccak-256</strong> — sponge construction, winner of the SHA-3 competition. Ethereum adopted it <em>before</em> NIST finalised the standard.</li>
  <li><strong>SHA3-256</strong> — the finalised NIST version. Same permutation as Keccak but a different padding byte (<code>0x06</code> vs <code>0x01</code>), so <strong>the digests differ</strong>. Ethereum's <code>keccak256()</code> is <em>not</em> SHA3-256, a bug source for years.</li>
</ul>

<h3>Reading a hash</h3>
<p>Hashes are bytes, displayed as hex. 32 bytes = 64 hex characters. Leading zeros in hex are what mining targets, and every hex zero costs 16x more work (Lesson 7). The lab below lets you feel that cost directly.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'Commit.sol',
      caption: 'Commit-reveal: the classic on-chain use of preimage resistance. Bidders commit to a hidden bid, then reveal it — no front-running possible during the commit phase.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SealedBid {
    mapping(address => bytes32) public commitment;
    mapping(address => uint256) public revealed;
    uint256 public immutable revealStart;

    error TooEarly();
    error BadReveal();

    constructor(uint256 commitWindow) {
        revealStart = block.timestamp + commitWindow;
    }

    /// commit = keccak256(abi.encodePacked(bid, salt)) computed off-chain
    function commit(bytes32 c) external {
        if (block.timestamp >= revealStart) revert TooEarly();
        commitment[msg.sender] = c;
    }

    function reveal(uint256 bid, bytes32 salt) external {
        if (block.timestamp < revealStart) revert TooEarly();
        // abi.encodePacked is safe here: fixed-width types only
        if (keccak256(abi.encodePacked(bid, salt)) != commitment[msg.sender]) {
            revert BadReveal();
        }
        revealed[msg.sender] = bid;
    }
}`
    },
    {
      lang: 'javascript', file: 'hashing.js',
      caption: 'The same digests from JavaScript. Note that Bitcoin hashes twice and Ethereum uses keccak256, not sha256.',
      src: `const enc = new TextEncoder();

// Bitcoin: HASH256 = SHA256(SHA256(x))
const txid = CL.dsha256Hex(rawTxBytes);

// Ethereum: everything is keccak256
const funcSelector = CL.keccak256Hex('transfer(address,uint256)').slice(0, 8);
// => "a9059cbb"  — the 4 bytes at the front of every ERC-20 transfer calldata

// Avalanche: one character changes the entire digest
CL.sha256Hex('hello');   // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
CL.sha256Hex('hellp');   // 30cbd4bb2e6a6ce55a1c93e2e0b1c4d97bd0eb4a6cd51d7f7e1b8b5ad3a7bd35`
    }
  ],
  lab: 'hash',
  quiz: [
    {
      q: 'Why do 256-bit hashes give only ~128 bits of collision security?',
      options: [
        'Half the output bits are structurally predictable',
        'The birthday paradox: a collision is expected after roughly 2^(n/2) attempts',
        'Implementations truncate the digest before comparison',
        'Because SHA-256 processes 512-bit blocks'
      ],
      answer: 1,
      why: 'With 2^128 random samples from a 2^256 space you expect a repeat. Preimage attacks still need ~2^256 work, so preimage security is the full 256 bits.'
    },
    {
      q: 'Ethereum keccak256("") returns c5d2...a470, but SHA3-256("") returns a7ff...4a. Why?',
      options: [
        'Ethereum uses a different key',
        'They use different padding bytes, finalised after Ethereum had already shipped Keccak',
        'SHA3-256 truncates to 224 bits',
        'One is little-endian, the other big-endian'
      ],
      answer: 1,
      why: 'Same Keccak-f[1600] permutation, different domain-separation padding (0x01 vs 0x06). Mixing the two silently produces wrong hashes — a real source of integration bugs.'
    },
    {
      q: 'A contract stores keccak256(secret). Is the secret safe?',
      options: [
        'Yes, hashes are irreversible',
        'Only if the secret has high entropy — low-entropy secrets are brute-forced instantly',
        'Yes, provided the contract is not verified on Etherscan',
        'No, keccak256 is reversible with the private key'
      ],
      answer: 1,
      why: 'Preimage resistance protects against inverting the function, not against guessing. Hashing a 4-digit PIN or a known address offers zero protection: an attacker hashes all 10,000 candidates in microseconds. Always add a high-entropy salt.'
    }
  ],
  tasks: [
    'In the lab, type a sentence, then change one character and count how many hex characters of the digest stayed the same. Compare with the ~6% you would expect by chance.',
    'Compute keccak256("transfer(address,uint256)") and confirm the first 4 bytes are a9059cbb — the ERC-20 transfer selector you will see in every token transaction.',
    'Design a commit-reveal scheme for a rock-paper-scissors game. What goes in the commitment, and what breaks if you omit the salt?',
    'Find the hash rate the lab reports and calculate how long your browser would need to mine one real Bitcoin block (current difficulty needs ~10^23 hashes).'
  ],
  resources: [
    { type: 'docs', title: 'FIPS 180-4 — Secure Hash Standard', url: 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf' },
    { type: 'tool', title: 'Keccak-256 online playground', url: 'https://emn178.github.io/online-tools/keccak_256.html' },
    { type: 'read', title: 'SHAttered — the first SHA-1 collision', url: 'https://shattered.io/' }
  ]
});

L.push({
  id: 'l03', module: 1, num: 3,
  title: 'Keys, Signatures and Addresses',
  level: 'Beginner', minutes: 70,
  summary: 'Public-key cryptography is how a blockchain knows who you are. Generate a real secp256k1 key, sign a message, derive an Ethereum address.',
  objectives: [
    'Explain how a private key derives a public key, and why the reverse is infeasible',
    'Describe what ECDSA signing and verification actually compute',
    'Derive an Ethereum address from a public key, including the EIP-55 checksum',
    'Name three ways people lose funds through key mishandling'
  ],
  body: `
<h3>Ownership without accounts</h3>
<p>There is no signup. A blockchain account is simply a number you picked at random. Control of the number <em>is</em> ownership; there is no reset password, no support desk, no recovery.</p>
<ol>
  <li><strong>Private key</strong>: a random 256-bit integer <code>d</code>, between 1 and <em>n</em>-1 where <em>n</em> ≈ 1.158 × 10<sup>77</sup>.</li>
  <li><strong>Public key</strong>: the curve point <code>Q = d · G</code>, where <code>G</code> is a fixed generator point on secp256k1.</li>
  <li><strong>Address</strong>: Ethereum takes <code>keccak256(Q)</code> and keeps the last 20 bytes. Bitcoin uses <code>RIPEMD160(SHA256(Q))</code> plus Base58Check or Bech32.</li>
</ol>
<p>Each arrow is one-way. Deriving <code>Q</code> from <code>d</code> is one multiplication. Recovering <code>d</code> from <code>Q</code> is the elliptic curve discrete logarithm problem — no known practical attack, roughly 2<sup>128</sup> operations.</p>

<div class="note">
  <span class="tag">Scale check</span>
  <p>The keyspace is about 10<sup>77</sup>. There are roughly 10<sup>50</sup> atoms in the Earth. Random key collision is not a risk; <em>bad randomness</em> is. Every real "stolen by brute force" incident traces back to a broken RNG or a brain wallet, never to luck.</p>
</div>

<h3>What ECDSA actually computes</h3>
<p>To sign a 32-byte message hash <code>z</code> with private key <code>d</code>:</p>
<ol>
  <li>Pick a nonce <code>k</code> (must be secret and never reused).</li>
  <li>Compute point <code>R = k · G</code>; take <code>r = R.x mod n</code>.</li>
  <li>Compute <code>s = k<sup>-1</sup>(z + r·d) mod n</code>.</li>
  <li>Signature is the pair <code>(r, s)</code>, 64 bytes. Ethereum adds a 1-byte <code>v</code> so the public key can be <em>recovered</em> from the signature — which is why transactions do not carry the sender address.</li>
</ol>
<p>Verification, given public key <code>Q</code>: compute <code>u1 = z·s<sup>-1</sup></code>, <code>u2 = r·s<sup>-1</sup></code>, then check that <code>(u1·G + u2·Q).x mod n == r</code>. Only someone holding <code>d</code> could have produced an <code>s</code> that makes this identity hold.</p>

<div class="note danger">
  <span class="tag">Nonce reuse = key disclosure</span>
  <p>Sign two different messages with the same <code>k</code> and anyone can solve two equations for two unknowns and recover <code>d</code>. This is exactly how the PlayStation 3 signing key leaked in 2010, and how several Android wallets were drained in 2013. Modern libraries derive <code>k</code> deterministically from <code>(d, z)</code> per RFC 6979 — as does the lab below.</p>
</div>

<h3>Signature malleability and low-s</h3>
<p>If <code>(r, s)</code> is valid then so is <code>(r, n - s)</code>. Both verify, but they hash to different transaction IDs. Bitcoin (BIP-62) and Ethereum (EIP-2) therefore reject the high-<code>s</code> variant. Any contract that treats a signature as a unique ID must normalise, or an attacker replays the "other" form.</p>

<h3>The EIP-55 checksum</h3>
<p>Raw addresses are 40 hex characters with no error detection. EIP-55 re-cases the letters based on <code>keccak256</code> of the lowercase address: hex digit ≥ 8 means uppercase. Wallets that validate the casing catch roughly 99.99986% of typos. It is backwards compatible because ignoring case still yields the same address.</p>

<h3>Where keys live</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Storage</th><th>Key exposure</th><th>Use for</th></tr></thead>
<tbody>
<tr><td>Hot wallet (browser extension)</td><td>Key in browser memory</td><td>Daily amounts you would shrug off</td></tr>
<tr><td>Hardware wallet</td><td>Key never leaves the secure element; device signs</td><td>Meaningful personal holdings</td></tr>
<tr><td>Multisig (e.g. 3-of-5)</td><td>No single key is sufficient</td><td>Treasuries, protocol admin</td></tr>
<tr><td>Smart-contract wallet / account abstraction</td><td>Policy is code: limits, social recovery, session keys</td><td>Apps that need UX without seed phrases</td></tr>
</tbody>
</table>
</div>
<p>BIP-39 seed phrases encode the entropy for a whole tree of keys (BIP-32 hierarchical deterministic derivation, path <code>m/44'/60'/0'/0/0</code> for Ethereum). The 12 or 24 words <em>are</em> the master key — writing them into a screenshot, a password manager note or a chat message is equivalent to publishing the private key.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'sign.js',
      caption: 'Real secp256k1 usage. In production use ethers or noble-curves; this shows what those libraries do underneath.',
      src: `// 1. key material
const d = CL.secp256k1.genPrivKey();          // random 256-bit scalar
const Q = CL.secp256k1.pubKey(d);             // Q = d * G  (a curve point)
const address = CL.ethAddress(Q);             // last 20 bytes of keccak256(Q)

// 2. sign a message hash
const msg = CL.utf8ToBytes('Transfer 5 ETH to Bob');
const sig = CL.secp256k1.sign(d, msg);        // { r, s } with low-s normalisation

// 3. anybody can verify with only the public key
CL.secp256k1.verify(Q, msg, sig);             // true
CL.secp256k1.verify(Q, CL.utf8ToBytes('Transfer 50 ETH to Bob'), sig);  // false

// In ethers.js the same three steps are:
//   const wallet = ethers.Wallet.createRandom();
//   const sig    = await wallet.signMessage('Transfer 5 ETH to Bob');
//   const signer = ethers.verifyMessage('Transfer 5 ETH to Bob', sig);`
    },
    {
      lang: 'solidity', file: 'VerifySig.sol',
      caption: 'On-chain verification uses ecrecover, which returns the signer address. Note the three guards every production implementation needs.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Claimable {
    address public immutable authorizer;
    mapping(bytes32 => bool) public usedDigest;   // guard 1: replay protection

    constructor(address a) { authorizer = a; }

    function claim(uint256 amount, uint256 deadline, bytes calldata sig) external {
        require(block.timestamp <= deadline, "expired");

        // EIP-191 prefixed hash — what personal_sign produces
        bytes32 digest = keccak256(abi.encodePacked(
            "\\x19Ethereum Signed Message:\\n32",
            keccak256(abi.encode(msg.sender, amount, deadline, block.chainid, address(this)))
        ));

        require(!usedDigest[digest], "replayed");
        usedDigest[digest] = true;

        (bytes32 r, bytes32 s, uint8 v) = _split(sig);
        // guard 2: reject malleable high-s signatures (EIP-2)
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
                "bad s");

        address signer = ecrecover(digest, v, r, s);
        // guard 3: ecrecover returns address(0) on failure — never compare loosely
        require(signer != address(0) && signer == authorizer, "bad sig");

        _payout(msg.sender, amount);
    }

    function _split(bytes calldata sig) internal pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "len");
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
    }

    function _payout(address to, uint256 amt) internal {}
}`
    }
  ],
  lab: 'keys',
  quiz: [
    {
      q: 'A transaction on Ethereum does not include a "from" field. How does the network know the sender?',
      options: [
        'It is stored in the block header',
        'The node looks it up by nonce',
        'The sender address is recovered from the signature using ecrecover',
        'The RPC provider attaches it'
      ],
      answer: 2,
      why: 'ECDSA on secp256k1 supports public key recovery: given (r, s, v) and the message hash, you recover the public key and therefore the address. That is what the v byte is for, and it saves 20 bytes per transaction.'
    },
    {
      q: 'Why must the ECDSA nonce k be unique per signature?',
      options: [
        'Otherwise the signature is too short',
        'Reusing k across two messages lets anyone algebraically recover the private key',
        'The blockchain rejects duplicate nonces',
        'It only affects performance'
      ],
      answer: 1,
      why: 'Two signatures sharing k give s1 = k^-1(z1 + r·d) and s2 = k^-1(z2 + r·d). Subtracting solves for k, then for d. RFC 6979 removes the risk by deriving k deterministically from the key and message.'
    },
    {
      q: 'ecrecover returns address(0). What does that mean and what is the danger?',
      options: [
        'The signature is valid but from a burn address',
        'Recovery failed; if the contract compares against an unset address variable, the check passes for an invalid signature',
        'The message hash was too long',
        'Nothing — it is a normal return value'
      ],
      answer: 1,
      why: 'A malformed signature yields address(0). If your stored signer variable was never initialised it is also address(0), so the equality check succeeds and anyone can forge. Always require(signer != address(0)) first.'
    }
  ],
  tasks: [
    'Generate a key in the lab, then re-sign the same message twice. Confirm the signature is byte-identical (deterministic k) and explain why that is safe.',
    'Change one character of the message after signing and observe verification fail. Then change the public key instead.',
    'Take the raw address the lab produces, apply EIP-55 by hand for the first four characters using the keccak hash shown, and check your answer against the lab output.',
    'Read BIP-32 and write down the derivation path your wallet uses. Explain what an "extended public key" leaks and what it does not.'
  ],
  resources: [
    { type: 'docs', title: 'SEC 2 — secp256k1 curve parameters', url: 'https://www.secg.org/sec2-v2.pdf' },
    { type: 'eip', title: 'EIP-55 — Mixed-case checksum address encoding', url: 'https://eips.ethereum.org/EIPS/eip-55' },
    { type: 'code', title: 'noble-curves — audited, dependency-free secp256k1', url: 'https://github.com/paulmillr/noble-curves' }
  ]
});

L.push({
  id: 'l04', module: 1, num: 4,
  title: 'Merkle Trees and Light Clients',
  level: 'Beginner', minutes: 55,
  summary: 'How 32 bytes prove membership in a set of a million items — the data structure behind SPV wallets, airdrop allowlists and rollup withdrawals.',
  objectives: [
    'Build a Merkle tree and compute its root',
    'Generate and verify a Merkle proof, and explain why it is O(log n)',
    'Implement an on-chain allowlist using a Merkle root',
    'Recognise second-preimage and sorted-pair pitfalls'
  ],
  body: `
<h3>The problem</h3>
<p>A block holds 3,000 transactions. Your phone wants to confirm "my payment is in this block" without downloading the block. Naively you would need all 3,000. A Merkle tree reduces this to about 12 hashes.</p>

<h3>Construction</h3>
<ol>
  <li>Hash each item — these are the <strong>leaves</strong>.</li>
  <li>Pair adjacent hashes and hash each pair: <code>parent = H(left ‖ right)</code>.</li>
  <li>Repeat until one hash remains — the <strong>Merkle root</strong>.</li>
  <li>If a level has an odd count, duplicate the last node (Bitcoin) or promote it unchanged (most Ethereum libraries). The rule must be identical on both sides or proofs fail.</li>
</ol>
<p>Depth is ⌈log₂ n⌉. A million leaves is 20 levels, so a proof is 20 × 32 = 640 bytes.</p>

<h3>Proofs</h3>
<p>A proof for leaf <em>i</em> is the list of <em>sibling</em> hashes on the path to the root. The verifier recomputes upward: hash the leaf with the first sibling, then that result with the next sibling, and so on. If the final value equals the known root, the leaf is in the set. The verifier never sees the other leaves — only their compressed influence.</p>

<div class="note">
  <span class="tag">Why the order matters</span>
  <p><code>H(a ‖ b) ≠ H(b ‖ a)</code>. So a proof must specify, at each level, whether the sibling goes left or right. Two designs exist: carry a direction bit per step, or <em>sort each pair</em> before hashing so order is canonical. OpenZeppelin's <code>MerkleProof</code> uses the sorted-pair variant, which makes proofs a plain <code>bytes32[]</code>.</p>
</div>

<h3>Real uses</h3>
<ul>
  <li><strong>SPV / light clients</strong> — Bitcoin wallets verify inclusion against headers only (BIP-37, later BIP-157/158).</li>
  <li><strong>Allowlists and airdrops</strong> — store one root on chain instead of 50,000 addresses. Claim cost stays flat while the list grows.</li>
  <li><strong>Rollup withdrawals</strong> — an L2 posts a state root; withdrawing proves your balance against it.</li>
  <li><strong>Ethereum state</strong> — a Merkle-Patricia trie commits to every account and every storage slot, so <code>eth_getProof</code> can prove any balance.</li>
</ul>

<h3>Two real pitfalls</h3>
<p><strong>Second-preimage attack.</strong> If leaves and internal nodes are hashed identically, an attacker can present an internal node <em>as if</em> it were a leaf, proving membership of data that was never in the tree. Fix: domain-separate — hash leaves as <code>H(0x00 ‖ data)</code> and internal nodes as <code>H(0x01 ‖ l ‖ r)</code>. Certificate Transparency (RFC 6962) does exactly this.</p>
<p><strong>Duplicate-leaf ambiguity (CVE-2012-2459).</strong> Bitcoin's odd-node duplication means two different transaction lists can yield the same root. Reject trees where the last node was duplicated from an odd count if you rely on root uniqueness.</p>
`,
  code: [
    {
      lang: 'javascript', file: 'merkle.js',
      caption: 'Sorted-pair Merkle tree, compatible with OpenZeppelin MerkleProof.verify. Generate the root and proofs off-chain; store only the root.',
      src: `const H = (a, b) => {
  // sorted pair: canonical order removes the need for direction bits
  const [x, y] = BigInt('0x' + a) < BigInt('0x' + b) ? [a, b] : [b, a];
  return CL.keccak256Hex(CL.hexToBytes(x + y));
};

function buildTree(leaves) {
  const levels = [leaves.slice()];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(i + 1 < prev.length ? H(prev[i], prev[i + 1]) : prev[i]);
    }
    levels.push(next);
  }
  return levels;                       // levels[levels.length-1][0] is the root
}

function proofFor(levels, index) {
  const proof = [];
  for (let l = 0; l < levels.length - 1; l++) {
    const sibling = index ^ 1;         // flip the low bit
    if (sibling < levels[l].length) proof.push(levels[l][sibling]);
    index >>= 1;
  }
  return proof;
}

const verify = (leaf, proof, root) => proof.reduce(H, leaf) === root;`
    },
    {
      lang: 'solidity', file: 'MerkleAllowlist.sol',
      caption: 'A 50,000-address allowlist that costs one storage slot. Claim gas is the same for the first and the last claimer.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Airdrop {
    bytes32 public immutable root;
    mapping(address => bool) public claimed;

    error AlreadyClaimed();
    error NotInList();

    constructor(bytes32 _root) { root = _root; }

    function claim(uint256 amount, bytes32[] calldata proof) external {
        if (claimed[msg.sender]) revert AlreadyClaimed();

        // double hashing the leaf blocks the second-preimage trick where an
        // internal node is replayed as a leaf
        bytes32 leaf = keccak256(bytes.concat(
            keccak256(abi.encode(msg.sender, amount))
        ));

        if (!MerkleProof.verifyCalldata(proof, root, leaf)) revert NotInList();

        claimed[msg.sender] = true;
        _transfer(msg.sender, amount);
    }

    function _transfer(address to, uint256 amt) internal {}
}`
    }
  ],
  lab: 'merkle',
  quiz: [
    {
      q: 'A tree has 1,048,576 leaves. How large is one inclusion proof?',
      options: ['1 hash', '20 hashes (~640 bytes)', '1,024 hashes', 'Half the leaves'],
      answer: 1,
      why: 'log2(1048576) = 20 levels, one sibling per level, 32 bytes each. Proof size grows logarithmically, which is why allowlists of any size cost the same to verify.'
    },
    {
      q: 'Why do many implementations sort each pair before hashing?',
      options: [
        'It makes the root smaller',
        'It removes the need to transmit left/right direction bits, so a proof is a plain bytes32 array',
        'It prevents collisions',
        'Sorting is required by the EVM'
      ],
      answer: 1,
      why: 'Canonical ordering makes H(a,b) == H(b,a) by construction, so the verifier does not need to know which side each sibling was on. The trade-off is that you lose position information — fine for set membership, wrong for ordered logs.'
    },
    {
      q: 'What does domain separation (0x00 for leaves, 0x01 for internal nodes) prevent?',
      options: [
        'Gas exhaustion',
        'An attacker passing an internal node off as a leaf to prove membership of data never in the tree',
        'Front-running of claims',
        'Root collisions between different trees'
      ],
      answer: 1,
      why: 'Without separation, a 64-byte "leaf" that happens to equal the concatenation of two real nodes verifies successfully. Prefixing different bytes makes the two hash domains disjoint.'
    }
  ],
  tasks: [
    'In the lab, generate a proof for leaf 3, then flip one byte of the proof and watch verification fail.',
    'Build a tree with 5 leaves and write down exactly what happens to the odd node at each level in your implementation.',
    'Estimate gas for an allowlist of 10,000 addresses stored as a mapping vs a Merkle root. Assume 20,000 gas per SSTORE.',
    'Read RFC 6962 section 2.1 and explain why Certificate Transparency prefixes leaves with 0x00.'
  ],
  resources: [
    { type: 'docs', title: 'OpenZeppelin MerkleProof', url: 'https://docs.openzeppelin.com/contracts/5.x/api/utils#MerkleProof' },
    { type: 'rfc', title: 'RFC 6962 — Certificate Transparency (Merkle definitions)', url: 'https://datatracker.ietf.org/doc/html/rfc6962' },
    { type: 'code', title: 'murky — gas-efficient Merkle trees in Solidity', url: 'https://github.com/dmfxyz/murky' }
  ]
});

L.push({
  id: 'l05', module: 1, num: 5,
  title: 'Blocks, Chains and Tamper Evidence',
  level: 'Beginner', minutes: 60,
  summary: 'Assemble the primitives into a working chain, then attack it: edit history and watch every downstream block break.',
  objectives: [
    'Build a linked chain of blocks with hash pointers',
    'Demonstrate that editing any historical field invalidates all later blocks',
    'Explain why hash linking alone is not enough without proof of work or stake',
    'Describe how a node validates an incoming block'
  ],
  body: `
<h3>Hash pointers</h3>
<p>An ordinary linked list stores a pointer to the previous node. A blockchain stores the previous node's <em>hash</em>. The difference is decisive: a pointer says "it was over there", a hash says "it was exactly this, byte for byte".</p>
<p>Because block <em>n</em>'s hash covers <code>parentHash</code>, changing anything in block <em>n</em>-1 changes its hash, which invalidates block <em>n</em>'s parentHash, which changes block <em>n</em>'s hash, and so on to the tip. One edit anywhere means recomputing everything after it.</p>

<h3>Why linking is not enough</h3>
<p>Recomputing hashes is cheap — your laptop does millions per second. If hashing were the only cost, an attacker would rewrite ten blocks in a millisecond and present a plausible alternative history. Hash linking gives <strong>tamper evidence</strong>, not <strong>tamper resistance</strong>.</p>
<p>Resistance comes from making each block <em>expensive</em> to produce:</p>
<ul>
  <li><strong>Proof of work</strong> — the hash must fall below a target, so producing one costs energy (Lesson 7).</li>
  <li><strong>Proof of stake</strong> — a block needs signatures from validators who have posted collateral that gets destroyed for equivocating (Lesson 8).</li>
</ul>
<p>The lab below lets you toggle difficulty and feel the difference: with difficulty 0 a tampered chain is repaired instantly; at difficulty 4 rewriting even three blocks becomes visibly slow.</p>

<h3>What a node checks on every incoming block</h3>
<ol>
  <li><strong>Structure</strong> — fields present, sizes within limits.</li>
  <li><strong>Parent</strong> — the parent hash refers to a block we have, and the height is parent + 1.</li>
  <li><strong>Consensus seal</strong> — PoW hash below target, or a valid quorum of validator signatures.</li>
  <li><strong>Timestamp</strong> — within tolerance of local clock and after the parent (Bitcoin: greater than the median of the last 11).</li>
  <li><strong>Merkle root</strong> — recompute from the transaction list; it must match the header.</li>
  <li><strong>Transactions</strong> — every signature valid, no double spends, balances/nonces correct, gas limits respected.</li>
  <li><strong>Resulting state root</strong> — re-execute all transactions and check the resulting state hash equals the header claim.</li>
</ol>
<p>Only after all seven does the node relay the block. This is what "don't trust, verify" means operationally, and why running your own node is qualitatively different from using someone's RPC endpoint.</p>

<h3>Genesis</h3>
<p>Every chain starts with a hardcoded block whose parentHash is all zeros. It is not validated — it is agreed by shipping it inside the client software. Genesis is the one place where trust is social rather than cryptographic.</p>

<div class="note">
  <span class="tag">Terminology</span>
  <p><strong>Height</strong> = number of blocks since genesis. <strong>Confirmations</strong> = blocks built on top of the one containing your transaction. <strong>Head/tip</strong> = the newest block of the chain a node considers canonical. Nodes can briefly disagree about the tip; they should never disagree about genesis.</p>
</div>
`,
  code: [
    {
      lang: 'javascript', file: 'chain.js',
      caption: 'A minimal but honest chain: header hashing, Merkle root over transactions, mining loop, and full validation.',
      src: `class Block {
  constructor(index, txs, prevHash, difficulty) {
    this.index = index;
    this.txs = txs;
    this.prevHash = prevHash;
    this.difficulty = difficulty;
    this.timestamp = Date.now();
    this.nonce = 0;
    this.merkleRoot = merkleRoot(txs);
    this.hash = this.computeHash();
  }

  header() {
    return [this.index, this.prevHash, this.merkleRoot,
            this.timestamp, this.difficulty, this.nonce].join('|');
  }

  computeHash() { return CL.sha256Hex(this.header()); }

  mine() {
    const target = '0'.repeat(this.difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.computeHash();
    }
    return this;
  }
}

class Chain {
  constructor(difficulty = 3) {
    this.difficulty = difficulty;
    this.blocks = [new Block(0, ['genesis'], '0'.repeat(64), 0)];
  }

  add(txs) {
    const prev = this.blocks[this.blocks.length - 1];
    this.blocks.push(new Block(this.blocks.length, txs, prev.hash, this.difficulty).mine());
  }

  validate() {
    for (let i = 1; i < this.blocks.length; i++) {
      const b = this.blocks[i], p = this.blocks[i - 1];
      if (b.hash !== b.computeHash())      return { ok: false, at: i, why: 'hash does not match contents' };
      if (b.prevHash !== p.hash)           return { ok: false, at: i, why: 'broken link to parent' };
      if (b.merkleRoot !== merkleRoot(b.txs)) return { ok: false, at: i, why: 'merkle root mismatch' };
      if (!b.hash.startsWith('0'.repeat(b.difficulty)))
                                           return { ok: false, at: i, why: 'insufficient work' };
    }
    return { ok: true };
  }
}`
    }
  ],
  lab: 'chain',
  quiz: [
    {
      q: 'You edit the amount in a transaction inside block 2 of a 6-block chain. What breaks?',
      options: [
        'Only block 2',
        'Block 2 and block 3',
        'Block 2 plus every block after it, because each one commits to its parent hash',
        'Nothing until the next block is mined'
      ],
      answer: 2,
      why: 'The edit changes block 2\\u2019s Merkle root, therefore its hash, therefore block 3\\u2019s parentHash is wrong, and the break cascades to the tip. Repairing it means re-mining every affected block.'
    },
    {
      q: 'Why is hash linking alone insufficient to secure a chain?',
      options: [
        'Hashes can be reversed',
        'Recomputing hashes is cheap, so an attacker can rewrite history quickly unless block production is made expensive',
        'Linked lists cannot be replicated',
        'Because SHA-256 has known collisions'
      ],
      answer: 1,
      why: 'Linking makes tampering *detectable*, not *costly*. Proof of work or proof of stake supplies the cost, so honest history accumulates more weight than an attacker can match.'
    },
    {
      q: 'Which check would a node skip if it trusted a third-party RPC provider instead of running its own node?',
      options: [
        'None — RPC providers send proofs',
        'Effectively all of them: it accepts the provider\\u2019s claim about state and inclusion',
        'Only the timestamp check',
        'Only signature verification'
      ],
      answer: 1,
      why: 'A plain JSON-RPC response carries no proof. You trust the provider for balances, inclusion and finality. Light clients with proofs, or your own node, restore verification.'
    }
  ],
  tasks: [
    'In the lab, tamper with block 1 and note which blocks turn red. Then re-mine and observe how long repair takes at difficulty 4 vs 2.',
    'Add a transaction list to your own chain implementation and compute a real Merkle root instead of concatenating strings.',
    'Explain, in writing, why a node accepting blocks without re-executing transactions is not a full node.',
    'Look up the genesis block hash of Bitcoin and Ethereum. Note that Bitcoin\'s coinbase contains a newspaper headline — why does that matter?'
  ],
  resources: [
    { type: 'docs', title: 'Bitcoin developer guide — block chain', url: 'https://developer.bitcoin.org/reference/block_chain.html' },
    { type: 'docs', title: 'Ethereum block anatomy', url: 'https://ethereum.org/en/developers/docs/blocks/' },
    { type: 'read', title: 'Why run a node', url: 'https://ethereum.org/en/run-a-node/' }
  ]
});

})(window.ROADMAP.lessons);
