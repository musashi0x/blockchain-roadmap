/* Module 9 — NFTs & GameFi (lessons 41-43) */
(function (L) {

L.push({
  id: 'nft-metadata', module: 9, num: 41,
  title: 'NFTs Beyond the Token: Metadata, Provenance and Markets',
  level: 'Intermediate', minutes: 70,
  summary: 'Follow the pointer chain from ownerOf to the actual picture, learn where it breaks, and see how signed off-chain orders, approvals and royalties really work.',
  objectives: [
    'Trace every hop between a token id and the bytes a user sees',
    'Choose between HTTP, content-addressed and fully on-chain metadata, and justify it',
    'Explain how a marketplace settles a signed off-chain order, and what the approval grants',
    'Describe why EIP-2981 royalties are a query rather than an enforcement mechanism',
    'Read a collection’s floor price and volume with the right amount of suspicion'
  ],
  body: `
<h3>The token is a receipt, not the artwork</h3>
<p>Lesson 15 built the ledger half of ERC-721: a mapping from token id to owner, plus transfer rules. That is genuinely all the standard guarantees. Everything a user actually looks at — the name, the image, the stats a game reads — lives behind one string returned by <code>tokenURI(tokenId)</code>.</p>
<p>So an NFT is a chain of pointers, and the chain is only as strong as its weakest hop:</p>
<div class="table-scroll">
<table>
<thead><tr><th>Hop</th><th>Who controls it</th><th>Failure mode</th></tr></thead>
<tbody>
<tr><td><code>ownerOf(id)</code></td><td>The contract, on chain</td><td>Essentially none — this is the part consensus protects</td></tr>
<tr><td><code>tokenURI(id)</code></td><td>The contract — unless it has a setter</td><td>A <code>setBaseURI</code> owner can repoint the whole collection</td></tr>
<tr><td>Host / gateway</td><td>Whoever pays for the server or pins the CID</td><td>404, rate limit, domain expiry, quiet substitution</td></tr>
<tr><td>Metadata JSON</td><td>Same host</td><td>Traits edited after sale; nothing on chain notices</td></tr>
<tr><td>Image bytes</td><td>Same host again</td><td>The famous "my NFT is now a grey placeholder"</td></tr>
</tbody>
</table>
</div>

<h3>Three storage strategies</h3>
<p><strong>HTTP URL.</strong> <code>https://api.example.com/meta/42</code>. Cheap, flexible, revealable, and completely mutable. Fine for a game that intends its items to change; dishonest for art sold as permanent.</p>
<p><strong>Content addressing.</strong> An IPFS or Arweave identifier is derived from a hash of the bytes themselves. Change one pixel and the identifier changes, so the old pointer can never resolve to the new file. That is tamper <em>evidence</em>, not availability: if nobody pins the content, the hash still proves what it was but nobody can serve it. Pinning is an ongoing operational cost someone must keep paying.</p>
<p><strong>Fully on chain.</strong> Return a <code>data:application/json;base64,…</code> URI built in Solidity, often wrapping an SVG. No host, no pinning, no gateway. It costs real gas and constrains you to what you can render in a contract, which is why on-chain collections look the way they do.</p>
<div class="note"><span class="tag">Design rule</span>Decide first whether the artwork is <em>supposed</em> to be immutable. If it is, freeze the base URI, use a content-addressed identifier, and emit a permanent event recording the hash. If it is not — a game item that levels up — say so plainly instead of implying permanence you never had.</div>

<h3>Provenance is an event log, not a badge</h3>
<p>The chain can prove that address X minted token 42 in block N and that it has moved three times since. It cannot prove that address X is the artist. A blue check on a marketplace is that marketplace’s claim, stored in its own database, and it disappears when you view the same token somewhere else.</p>
<p>The strongest provenance you can add yourself is boring: mint from an address you control and announce publicly, commit to the full metadata hash <em>before</em> the sale (the same commit-reveal idea as lesson 26, used here for fairness rather than secrecy), and never ship a contract whose owner can rewrite the URI after mint.</p>

<h3>Markets: the order is off chain, the settlement is on chain</h3>
<p>Listing an NFT for sale does not send a transaction. The seller signs an EIP-712 typed message — collection, token id, price, currency, expiry, a nonce — and the marketplace stores that signature in an ordinary database. The seller pays no gas and can cancel by invalidating the nonce.</p>
<p>The buyer submits the transaction. The exchange contract verifies the seller’s signature, checks the nonce is unused and the order is unexpired, pulls the NFT using the approval the seller granted earlier, splits the payment, and marks the nonce spent. One on-chain transaction; the order book itself was never on chain.</p>
<p>That design has one uncomfortable consequence, and it is the single biggest source of NFT theft:</p>
<div class="note danger"><span class="tag">The approval is the asset</span><p><code>setApprovalForAll(exchange, true)</code> lets that address move <em>every</em> token you own in that collection, for as long as the approval stands. A phishing site that gets you to sign this — or to sign an order priced at zero — does not need your private key. Review approvals periodically, revoke what you no longer use, and read what a wallet is actually asking you to sign, not the picture next to it.</p></div>

<h3>Royalties: a query, not a rule</h3>
<p>EIP-2981 adds exactly one view function, <code>royaltyInfo(tokenId, salePrice)</code>, returning a recipient and an amount. It has no power to make anyone pay. A marketplace that calls it and splits the payment is choosing to; a marketplace that ignores it settles the trade just fine, and a direct wallet-to-wallet <code>transferFrom</code> never involves a marketplace at all.</p>
<p>Enforcement, where it exists, is built one layer down: the token itself refuses to transfer to or through addresses that do not honour the policy (an operator allowlist, as in the ERC-721C family), or the chain provides a transfer policy the asset type cannot escape — which is exactly what Sui Kiosk does in lesson 31. Both work by restricting transfers, which is a real trade-off, not a free lunch. Decide whether you are selling an asset users fully own or an asset with rules attached, and put it in writing.</p>

<h3>Reading the numbers</h3>
<p>Floor price is the cheapest open listing, so it is a quote on the thinnest part of the book — one seller can move it. Volume is trivially self-generated: sell to your own second wallet, repeatedly, and the collection appears liquid. Where a token’s own royalty or a rewards programme pays out per trade, wash trading is directly profitable. Before trusting a chart, ask how many distinct funded owners exist, how much volume came from wallets that were funded by each other, and whether the bids are real depth or one address quoting itself.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'AnchoredNFT.sol',
      caption: 'Immutable content-addressed metadata plus EIP-2981. The base URI can be frozen exactly once, and freezing is an event anyone can verify later.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract AnchoredNFT is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    string private _base;          // ipfs://<cid>/
    bool public frozen;            // once true, _base can never change
    uint256 public nextId;

    event BaseFrozen(string baseURI);

    error MetadataFrozen();

    constructor(address creator, uint96 royaltyBps)
        ERC721("Anchored", "ANCH")
        Ownable(msg.sender)
    {
        // 500 = 5%. This is a request to marketplaces, not an enforcement.
        _setDefaultRoyalty(creator, royaltyBps);
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        if (frozen) revert MetadataFrozen();
        _base = uri;
    }

    /// One-way switch. After this, tokenURI output is fixed forever and the
    /// event is the public record that it happened.
    function freeze() external onlyOwner {
        frozen = true;
        emit BaseFrozen(_base);
    }

    function mint(address to) external onlyOwner {
        _safeMint(to, ++nextId);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return string.concat(_base, id.toString(), ".json");
    }

    function supportsInterface(bytes4 iid)
        public view override(ERC721, ERC2981) returns (bool)
    {
        return super.supportsInterface(iid);
    }
}`
    },
    {
      lang: 'solidity', file: 'Exchange.sol',
      caption: 'The settlement half of a marketplace. The order was signed off chain and cost the seller nothing; this function is where it becomes real.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Exchange is EIP712 {
    struct Order {
        address seller;
        address collection;
        uint256 tokenId;
        uint256 price;
        uint256 expiry;
        uint256 nonce;
    }

    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address collection,uint256 tokenId,uint256 price,uint256 expiry,uint256 nonce)"
    );

    uint256 public constant FEE_BPS = 250;                 // 2.5% to the market
    mapping(address => mapping(uint256 => bool)) public nonceUsed;

    error BadSignature();
    error Expired();
    error NonceUsed();
    error WrongPayment();

    constructor() EIP712("Exchange", "1") {}

    function fill(Order calldata o, bytes calldata sig) external payable {
        if (block.timestamp > o.expiry) revert Expired();
        if (nonceUsed[o.seller][o.nonce]) revert NonceUsed();
        if (msg.value != o.price) revert WrongPayment();

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            ORDER_TYPEHASH, o.seller, o.collection, o.tokenId, o.price, o.expiry, o.nonce
        )));
        if (ECDSA.recover(digest, sig) != o.seller) revert BadSignature();

        nonceUsed[o.seller][o.nonce] = true;

        uint256 fee = (o.price * FEE_BPS) / 10_000;
        uint256 royalty;
        address receiver;

        // The royalty is whatever the collection asks for. Nothing forces this
        // contract to ask, which is the entire problem with EIP-2981.
        try IERC2981(o.collection).royaltyInfo(o.tokenId, o.price)
            returns (address r, uint256 amount)
        {
            receiver = r;
            royalty = amount;
        } catch {}

        // Pulls the token using the seller's standing approval.
        IERC721(o.collection).transferFrom(o.seller, msg.sender, o.tokenId);

        if (royalty > 0) payable(receiver).transfer(royalty);
        payable(o.seller).transfer(o.price - fee - royalty);
    }
}`
    }
  ],
  lab: 'nftmeta',
  quiz: [
    { q: 'A collection sells out, then every image changes to a placeholder. The contract was never upgraded. What most likely happened?', options: ['A reorg rewrote the token owners', 'The metadata host stopped serving the files the tokenURI points at', 'The ERC-721 standard expired the tokens', 'The buyers’ approvals were revoked'], answer: 1, why: 'Only ownership lives on chain. tokenURI is a string pointing at somebody’s server or pinned content; if that content stops being served, the chain neither notices nor cares.' },
    { q: 'What does content addressing (an IPFS CID) actually guarantee?', options: ['That the file will always be available', 'That the identifier can only ever resolve to the exact bytes it was derived from', 'That the creator cannot sell more tokens', 'That royalties will be paid'], answer: 1, why: 'The CID is a hash of the content, so substituted bytes produce a different CID. Availability is separate and depends on somebody continuing to pin and serve it.' },
    { q: 'Listing an NFT on a typical marketplace costs no gas. Why?', options: ['The marketplace pays the gas for the seller', 'The listing is an EIP-712 signature stored off chain; only the buyer’s fill is a transaction', 'Listings are free on all EVM chains', 'The NFT is escrowed into the marketplace first'], answer: 1, why: 'The seller signs a typed order that lives in the marketplace database. Settlement happens when a buyer submits it on chain, using the seller’s earlier approval to pull the token.' },
    { q: 'Why can a marketplace pay zero royalties without violating EIP-2981?', options: ['EIP-2981 only applies to ERC-1155', 'royaltyInfo is a view function that returns a suggested amount; nothing in the token enforces payment', 'Royalties expire after one year', 'The buyer can opt out on chain'], answer: 1, why: 'EIP-2981 standardises how to ask, not how to compel. Enforcement requires transfer restrictions in the token itself or a chain-level transfer policy.' }
  ],
  tasks: [
    'Use the lab to edit a metadata file under each storage mode and note which modes make the change detectable.',
    'Pick any NFT you can find on a block explorer, call tokenURI, and follow every hop to the image bytes yourself.',
    'List the addresses your own wallet has granted setApprovalForAll to, and revoke the ones you no longer use.',
    'Write the disclosure text for a collection whose owner can still call setBaseURI. Then decide whether you would buy from it.'
  ],
  resources: [
    { type: 'eip', title: 'EIP-721: Non-Fungible Token Standard', url: 'https://eips.ethereum.org/EIPS/eip-721' },
    { type: 'eip', title: 'EIP-2981: NFT Royalty Standard', url: 'https://eips.ethereum.org/EIPS/eip-2981' },
    { type: 'eip', title: 'EIP-712: Typed structured data hashing and signing', url: 'https://eips.ethereum.org/EIPS/eip-712' },
    { type: 'docs', title: 'IPFS: content addressing and CIDs', url: 'https://docs.ipfs.tech/concepts/content-addressing/' },
    { type: 'docs', title: 'OpenZeppelin ERC721 and ERC2981', url: 'https://docs.openzeppelin.com/contracts/5.x/erc721' }
  ]
});

L.push({
  id: 'gamefi-economy', module: 9, num: 42,
  title: 'GameFi Economies: Faucets, Sinks and the Death Spiral',
  level: 'Advanced', minutes: 75,
  summary: 'Treat a play-to-earn economy as what it is — an emissions schedule with a game attached — and learn to size sinks against faucets before the token, not after.',
  objectives: [
    'Classify every faucet and sink in a game economy and compute net emission per player',
    'Explain the reflexive loop that links token price, player earnings and new-user growth',
    'Show why a dual-token design postpones a supply problem rather than solving it',
    'Design sinks that scale with player power instead of with player count',
    'State the metrics that reveal an economy is running on new deposits'
  ],
  body: `
<h3>A play-to-earn game is a monetary policy</h3>
<p>Strip away the art and the loop is arithmetic. Tokens enter circulation because players play — that is a <strong>faucet</strong>. Tokens leave circulation when players spend them on something that destroys them — that is a <strong>sink</strong>. If faucets exceed sinks, supply grows. If supply grows faster than demand, the price falls. If the price falls, the reward that made people play falls with it.</p>
<p>Nothing about this is specific to blockchains; every MMO with a currency has fought gold inflation for thirty years. What a token adds is a liquid market price, which converts a slow design problem into a fast reflexive one.</p>

<h3>Faucets and sinks, honestly labelled</h3>
<div class="table-scroll">
<table>
<thead><tr><th>Mechanism</th><th>Faucet or sink</th><th>Note</th></tr></thead>
<tbody>
<tr><td>Quest and battle rewards</td><td>Faucet</td><td>Scales with active players; usually the largest single tap</td></tr>
<tr><td>Staking / liquidity emissions</td><td>Faucet</td><td>Pays holders for holding — pure dilution with extra steps</td></tr>
<tr><td>Referral and airdrop programmes</td><td>Faucet</td><td>Front-loaded, and attracts exactly the users who leave</td></tr>
<tr><td>Crafting, upgrades, repairs</td><td>Sink <em>only if burned</em></td><td>Routing fees to a treasury moves supply; it does not remove it</td></tr>
<tr><td>Breeding / minting costs</td><td>Sink</td><td>Also a faucet of new NFTs, which compete with existing ones</td></tr>
<tr><td>Marketplace fee</td><td>Sink or transfer</td><td>Depends entirely on whether the fee is burned</td></tr>
<tr><td>Entry tickets, energy refills, durability</td><td>Sink</td><td>Recurring and proportional to engagement — the good kind</td></tr>
</tbody>
</table>
</div>
<p>The distinction that matters most: a fee paid to the treasury is <em>not</em> a sink. Those tokens still exist and the treasury will eventually spend them. Only a burn, or a permanently locked contract with no withdrawal path, removes supply. Write the number down for both, separately.</p>
<div class="note"><span class="tag">The one metric</span><p>Sink coverage = tokens burned ÷ tokens emitted, over the same window. Below 1.0 the supply grows every day. Track it daily from launch, not after the chart looks bad.</p></div>

<h3>The reflexive loop</h3>
<p>Here is why these economies fail quickly rather than slowly. Players do not evaluate rewards in tokens; they evaluate them in their local currency per hour. That makes the loop circular:</p>
<p><strong>token price ↑</strong> → daily earnings in fiat ↑ → new players join to farm → they buy the starter assets → demand ↑ → <strong>token price ↑</strong></p>
<p>Every arrow reverses. When the price falls, earnings fall, marginal players leave, their assets hit the market, and demand falls further. The loop that produced the parabola produces the collapse, and it does so faster because selling is instant while onboarding is not.</p>
<p>The uncomfortable structural point: if the tokens paid to today’s players are funded mainly by the purchases of tomorrow’s players, the economy is redistributive. Demand must eventually come from somewhere other than the expectation of extracting more than you put in — the game being worth playing, cosmetics people want, spectators, sponsorship, anything that survives the token going flat.</p>

<h3>Does a dual-token design fix it?</h3>
<p>The standard pattern splits a capped governance token from an uncapped soft currency, and lets only the soft currency be earned in-game. It genuinely helps: the scarce asset is insulated from the reward tap, and you can tune the two independently.</p>
<p>What it does not do is create demand for the soft currency. Unless the soft currency has a sink large enough to absorb what players earn — and one they choose to use — it inflates on schedule and the earnings problem returns in a token users are told matters less. Meanwhile the governance token’s vesting cliffs are their own supply events, arriving on a calendar that has nothing to do with how the game is doing.</p>

<h3>Sinks that survive contact with players</h3>
<ul>
<li><strong>Scale the cost with power, not with headcount.</strong> A sink that costs the same at level 1 and level 60 stops mattering exactly when players have the most currency.</li>
<li><strong>Make it recurring.</strong> Consumables, durability and entry fees are paid forever. A one-off upgrade is a one-off burn.</li>
<li><strong>Sell time and status, not power.</strong> Cosmetics, names, slots and rankings can be priced arbitrarily high without wrecking the game’s balance.</li>
<li><strong>Burn the fee.</strong> If the treasury needs revenue, take it in a stable asset and burn the game token, so the two policies do not have to fight.</li>
<li><strong>Cap what one account can earn.</strong> Emission per player per day should have a hard ceiling, otherwise bots set your monetary policy.</li>
</ul>
<div class="note warn"><span class="tag">Bots are a monetary actor</span><p>Any automatable faucet will be automated at scale. Bots do not buy cosmetics, do not churn, and sell everything immediately — they are a pure withdrawal from the economy. Rate limits, proof-of-humanity gates and non-transferable progression are economic controls, not just anti-cheat.</p></div>

<h3>Before you write the contract</h3>
<ol>
<li>Model 180 days: emission per active player, sink coverage, supply, and a demand assumption you are willing to defend out loud.</li>
<li>Find the point where growth stops. Every model looks fine while players double; write down what the chart does at zero growth.</li>
<li>Decide what fraction of demand is speculative and state it. If it is most of it, you are running a financial product and the disclosures should say so.</li>
<li>Give yourself levers you can pull without a migration: adjustable emission rate, adjustable sink prices, an emergency cap — all behind a timelock so the levers are not themselves the risk.</li>
</ol>
<div class="note danger"><span class="tag">Real people, real money</span><p>Players in these economies have bought assets on credit and quit jobs to farm them. If your design depends on new entrants to pay existing ones, say that clearly before anyone deposits, and expect the disclosure obligations of a financial product rather than a game. This is a place where "we did not think about it" is not a neutral position.</p></div>
`,
  code: [
    {
      lang: 'typescript', file: 'economy.ts',
      caption: 'The same model the lab runs. The price rule is a deliberate toy — the point is the feedback direction, not a forecast.',
      src: `type Params = {
  players: number;      // daily active players at t=0
  supply: number;       // circulating tokens at t=0
  price: number;        // token price in USD at t=0
  earn: number;         // tokens emitted per player per day
  spend: number;        // tokens spent per player per day
  burnShare: number;    // 0..1 of spend that is burned rather than pooled
  wage: number;         // USD/day that keeps a marginal player playing
};

export function simulate(p: Params, days = 180) {
  let { players, supply, price } = p;

  // Toy demand model: price is proportional to players per circulating token.
  // Its only job is to make the feedback loop visible.
  const k = (price * supply) / players;
  const history = [];

  for (let day = 1; day <= days; day++) {
    const emitted = players * p.earn;
    const burned = players * p.spend * p.burnShare;

    supply += emitted - burned;

    // Players judge the game in USD per day, not in tokens.
    const dailyUsd = p.earn * price;
    const growth = Math.max(-0.12, Math.min(0.12, 0.25 * (dailyUsd / p.wage - 1)));
    players = Math.max(0, players * (1 + growth));

    price = players > 0 ? (k * players) / supply : 0;
    history.push({ day, players, supply, price, coverage: emitted ? burned / emitted : 0 });
  }
  return history;
}`
    },
    {
      lang: 'solidity', file: 'Forge.sol',
      caption: 'A sink that actually removes supply, priced off the item being upgraded rather than off a flat fee.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface IGameItems {
    function levelOf(uint256 itemId) external view returns (uint8);
    function ownerOf(uint256 itemId) external view returns (address);
    function levelUp(uint256 itemId) external;
}

contract Forge {
    ERC20Burnable public immutable gold;
    IGameItems public immutable items;

    uint256 public baseCost = 100e18;
    uint8 public constant MAX_LEVEL = 60;

    error NotOwner();
    error MaxLevel();

    event Upgraded(uint256 indexed itemId, uint8 newLevel, uint256 burned);

    constructor(ERC20Burnable g, IGameItems i) { gold = g; items = i; }

    /// Cost grows with the level being bought, so the sink keeps pace with
    /// the players who hold the most currency.
    function costFor(uint256 itemId) public view returns (uint256) {
        uint8 lvl = items.levelOf(itemId);
        return baseCost * (uint256(lvl) + 1) * (uint256(lvl) + 1);
    }

    function upgrade(uint256 itemId) external {
        if (items.ownerOf(itemId) != msg.sender) revert NotOwner();
        uint8 lvl = items.levelOf(itemId);
        if (lvl >= MAX_LEVEL) revert MaxLevel();

        uint256 cost = costFor(itemId);

        // burnFrom, not transferFrom: a fee to the treasury is not a sink.
        gold.burnFrom(msg.sender, cost);
        items.levelUp(itemId);

        emit Upgraded(itemId, lvl + 1, cost);
    }
}`
    }
  ],
  lab: 'gamefi',
  quiz: [
    { q: 'A game routes all upgrade fees to a treasury multisig. What has it built?', options: ['A sink, because players no longer hold the tokens', 'A transfer, because the tokens still exist and can re-enter circulation', 'A faucet', 'A burn'], answer: 1, why: 'Only destruction or a permanently unspendable lock reduces supply. Treasury balances are deferred sell pressure, not removed supply.' },
    { q: 'Sink coverage is 0.4 and player growth has just stopped. What happens next in the model?', options: ['Supply stabilises because growth stopped', 'Supply keeps growing while demand does not, so price and per-player earnings fall', 'Price rises because fewer tokens are spent', 'Nothing until the treasury sells'], answer: 1, why: 'Coverage below 1.0 means every day emits more than it burns. Without new demand the token price absorbs the difference, and earnings fall with it.' },
    { q: 'What is the strongest argument that a dual-token design does not by itself fix inflation?', options: ['Two tokens are harder to list on exchanges', 'Splitting the tokens changes which token inflates, not whether the soft currency has a sink big enough to absorb what players earn', 'Governance tokens cannot be traded', 'Soft currencies are always capped'], answer: 1, why: 'The split protects the scarce asset from the reward tap, which is real. It creates no demand for the earned currency; that still needs sinks players choose to use.' },
    { q: 'Why are bots an economic problem rather than only a fairness problem?', options: ['They make servers slower', 'They maximise every faucet, never buy sinks and sell immediately — a pure net withdrawal', 'They increase sink coverage', 'They pay higher gas'], answer: 1, why: 'A bot farm is an unbounded emission tap attached to a permanent seller. Rate limits and per-account emission caps are monetary policy tools.' }
  ],
  tasks: [
    'Use the lab to find the sink coverage at which the 180-day price stops falling, holding everything else fixed.',
    'Take any live GameFi project and classify all of its faucets and sinks into the table above. Compute its coverage from public data if you can.',
    'Redesign one faucet from that project so its cost scales with player power, and estimate the effect on coverage.',
    'Write the zero-growth paragraph for your own design: what the economy does when player count is flat for 90 days.'
  ],
  resources: [
    { type: 'read', title: 'Ethereum.org: NFTs and gaming', url: 'https://ethereum.org/en/nft/' },
    { type: 'docs', title: 'OpenZeppelin ERC20 burnable extension', url: 'https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20Burnable' },
    { type: 'docs', title: 'OpenZeppelin TimelockController', url: 'https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController' }
  ]
});

L.push({
  id: 'game-assets', module: 9, num: 43,
  title: 'On-Chain Game Assets: Rentals, Bound Accounts and Fair Randomness',
  level: 'Advanced', minutes: 75,
  summary: 'Decide what belongs on chain, split ownership from use so guilds work without custody, give an NFT its own inventory, and pick a randomness source an attacker cannot reroll.',
  objectives: [
    'Choose which parts of game state belong on chain and defend the boundary',
    'Separate owner from user with ERC-4907 so rentals need no custody transfer',
    'Explain what a token-bound account (ERC-6551) enables, and the scam it enables too',
    'Break naive on-chain randomness with the revert-on-loss attack',
    'Compare commit-reveal and VRF, including how each one fails'
  ],
  body: `
<h3>Put the settlement on chain, not the game</h3>
<p>Every state write costs gas and takes a block. A game loop does not fit in that budget and does not need to. The useful boundary is ownership and outcomes on chain, simulation off it.</p>
<div class="table-scroll">
<table>
<thead><tr><th>State</th><th>Where</th><th>Why</th></tr></thead>
<tbody>
<tr><td>Who owns an item</td><td>On chain</td><td>The whole point; it must survive the studio</td></tr>
<tr><td>Trades, rentals, crafting results</td><td>On chain</td><td>Value moves; disputes need a referee nobody controls</td></tr>
<tr><td>Match simulation, positions, physics</td><td>Off chain</td><td>Latency and cost; nobody wants a block per frame</td></tr>
<tr><td>Match <em>result</em> and rewards</td><td>On chain, batched</td><td>Sign server results, or settle a Merkle root of many matches at once</td></tr>
<tr><td>Hidden state (fog of war, unrevealed loot)</td><td>Commitment on chain</td><td>Chain state is public; store a hash now, reveal later (lesson 26)</td></tr>
</tbody>
</table>
</div>
<p>Batching matters more than it sounds. A per-match transaction is unaffordable at scale; a daily Merkle root with per-player claim proofs — the tree from lesson 4 — turns a million writes into one, and each player pays only for their own claim.</p>

<h3>Owner and user are different people</h3>
<p>Guild scholarship models started with the worst possible mechanism: the owner literally sends the NFT to the player and hopes. ERC-4907 fixes it with two extra fields — a <code>user</code> address and an <code>expires</code> timestamp — and one rule the contract enforces: <code>userOf(id)</code> returns the zero address once the lease expires, automatically, with no transaction and no trust.</p>
<p>The asset never leaves the owner’s wallet. The game reads <code>userOf</code> rather than <code>ownerOf</code> when deciding who may play with the item. A rental market becomes an ordinary listing: sign a lease, pay, get the user role until it lapses.</p>

<h3>An NFT that owns things</h3>
<p>ERC-6551 gives every NFT a deterministic smart-contract account address — computed from chain id, token contract and token id — controlled by whoever currently owns the token. The character can hold its own coins, items and approvals. Selling the character sells the backpack, atomically, without unequipping anything.</p>
<div class="note warn"><span class="tag">The backpack cuts both ways</span><p>Because the contents follow the token, a buyer must value the account, not the picture. Sellers can drain the bound account in the same block a sale settles, or list a character whose inventory was emptied one transaction earlier. Any marketplace flow for 6551 assets needs an inventory snapshot the buyer’s transaction can verify — otherwise you have built a way to sell an empty box that looked full when it was listed.</p></div>

<h3>Randomness, and the attack everyone gets caught by</h3>
<p>There is no randomness on a deterministic replicated state machine. Anything you compute from chain state is computable by everyone else, including the person opening the loot box.</p>
<p>Start with the naive version and break it:</p>
<div class="note danger"><span class="tag">Revert on loss</span><p><code>uint(keccak256(abi.encode(block.timestamp, msg.sender))) % 100</code> is not just predictable by the proposer — it is defeatable by any contract. The attacker calls your loot box <em>from a contract</em> that checks the result and reverts the whole transaction unless the drop is legendary, then tries again. They pay gas per attempt and get a 100% legendary rate. The randomness was never the weak part; letting the caller undo the outcome was.</p></div>
<p><strong>Commit-reveal</strong> (lesson 26) splits it into two transactions: commit <code>keccak256(secret ‖ salt)</code>, then reveal after a delay, mixing the revealed secret with a future block hash the committer could not know. This removes prediction. It does not remove <em>withholding</em>: a player who dislikes the outcome can simply never reveal. That is why the commitment must be paid for up front and the stake forfeited if the reveal window closes unused.</p>
<p><strong>VRF</strong> moves the entropy off chain with a proof: you request, an oracle returns a value plus a proof that it was derived from a key committed to in advance, and the contract verifies the proof before using it. Nobody — including the oracle — can choose the output for a given request. The costs are real: a second transaction arrives asynchronously, you must fund the subscription, and the callback runs under a gas limit. Do the minimum work in the callback, store the result, and let the player claim in their own transaction; a callback that runs out of gas must not lose the roll.</p>
<div class="table-scroll">
<table>
<thead><tr><th>Source</th><th>Predictable by</th><th>Manipulable by</th><th>Use when</th></tr></thead>
<tbody>
<tr><td><code>block.timestamp</code> / <code>prevrandao</code></td><td>Anyone in the same block</td><td>Caller (revert), proposer</td><td>Nothing of value at stake</td></tr>
<tr><td>Future blockhash</td><td>Nobody, until it exists</td><td>Proposer (weakly); expires after 256 blocks</td><td>Low value, with a commit and a deadline</td></tr>
<tr><td>Commit-reveal</td><td>Nobody</td><td>Withholder, unless slashed</td><td>Two-party games; stake covers the forfeit</td></tr>
<tr><td>VRF</td><td>Nobody</td><td>Nobody, given an honest key setup</td><td>Loot boxes, mints, anything paid for</td></tr>
</tbody>
</table>
</div>

<h3>Making it feel like a game</h3>
<p>A wallet popup per action is fatal to a game loop. Account abstraction (ERC-4337) lets a player approve a <strong>session key</strong> once: a temporary key that may call only your game contract, only certain functions, only up to a spend cap, only until it expires. Combine it with a paymaster and the player’s first hour costs them nothing and prompts them once.</p>
<p>Scope it like a capability, exactly as lesson 28 argued on Sui: the narrowest permission that still lets the session work, an expiry short enough that a leak is survivable, and a revocation path the player can actually find. A session key that can call any contract for any amount is a private key with extra latency.</p>
`,
  code: [
    {
      lang: 'solidity', file: 'RentableItem.sol',
      caption: 'ERC-4907 in the smallest honest form. Nothing needs to run at expiry — the read is the enforcement.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract RentableItem is ERC721 {
    struct Lease { address user; uint64 expires; }

    mapping(uint256 => Lease) private _leases;

    event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);

    error NotOwner();

    constructor() ERC721("Rentable", "RENT") {}

    function setUser(uint256 tokenId, address user, uint64 expires) external {
        if (msg.sender != ownerOf(tokenId)) revert NotOwner();
        _leases[tokenId] = Lease(user, expires);
        emit UpdateUser(tokenId, user, expires);
    }

    /// The lease ends by itself. No keeper, no cron, no transaction.
    function userOf(uint256 tokenId) public view returns (address) {
        Lease storage l = _leases[tokenId];
        return l.expires >= block.timestamp ? l.user : address(0);
    }

    /// A sale must not carry the previous tenant with it.
    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address)
    {
        address from = super._update(to, tokenId, auth);
        if (from != to && _leases[tokenId].user != address(0)) {
            delete _leases[tokenId];
            emit UpdateUser(tokenId, address(0), 0);
        }
        return from;
    }
}`
    },
    {
      lang: 'solidity', file: 'LootBox.sol',
      caption: 'The two-transaction shape that defeats revert-on-loss: the roll is requested in one transaction and settled in another, so the caller can no longer undo an outcome they dislike.',
      src: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Sketch of a VRF-style flow. The coordinator interface is deliberately
/// minimal; use the real one for your network.
interface IRandomness {
    function requestRandomWords(uint32 numWords) external returns (uint256 requestId);
}

contract LootBox {
    IRandomness public immutable vrf;

    struct Roll { address player; bool settled; }

    mapping(uint256 => Roll) public rolls;   // requestId => roll
    mapping(address => uint8) public pending;
    mapping(address => uint256) public prize;

    uint256 public constant PRICE = 0.01 ether;

    error WrongPrice();
    error NotCoordinator();
    error AlreadySettled();

    event Requested(address indexed player, uint256 requestId);
    event Settled(address indexed player, uint256 requestId, uint8 rarity);

    constructor(IRandomness v) { vrf = v; }

    /// Transaction 1. The player pays now and learns nothing.
    function open() external payable {
        if (msg.value != PRICE) revert WrongPrice();
        uint256 id = vrf.requestRandomWords(1);
        rolls[id] = Roll(msg.sender, false);
        pending[msg.sender] += 1;
        emit Requested(msg.sender, id);
    }

    /// Transaction 2, arriving asynchronously from the coordinator. Keep this
    /// cheap: a callback that runs out of gas must not destroy the roll.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata words) external {
        if (msg.sender != address(vrf)) revert NotCoordinator();
        Roll storage r = rolls[requestId];
        if (r.settled) revert AlreadySettled();

        r.settled = true;
        pending[r.player] -= 1;

        uint256 draw = words[0] % 1000;
        uint8 rarity = draw < 5 ? 3 : draw < 60 ? 2 : draw < 300 ? 1 : 0;

        // Record only. The player claims in their own transaction, so an
        // expensive mint can never make this callback revert.
        prize[r.player] = uint256(rarity);
        emit Settled(r.player, requestId, rarity);
    }
}`
    }
  ],
  lab: 'gameassets',
  quiz: [
    { q: 'A loot box rolls on keccak256(block.timestamp, msg.sender). An attacker calls it from a contract. What is the practical outcome?', options: ['They get the same odds as everyone else', 'They simulate the result and revert unless it is rare, achieving a near-100% rare rate for the price of gas', 'They can only attack if they are the block proposer', 'They must break keccak256 first'], answer: 1, why: 'The outcome is computed inside their transaction, so they can discard it. Prediction is not required when the caller can undo the result.' },
    { q: 'What does ERC-4907 change about renting a game item?', options: ['The item is escrowed by the rental contract', 'The owner keeps the token; a separate user role expires on its own with no transaction', 'The renter becomes a co-owner', 'Royalties are enforced during the rental'], answer: 1, why: 'user and expires are stored alongside ownership. userOf returns the zero address after expiry, so no keeper or return transaction is needed and the owner never gives up custody.' },
    { q: 'What is the specific new risk of a token-bound (ERC-6551) character?', options: ['The account address is unpredictable', 'The contents move with the token, so a buyer can pay for an inventory that was emptied moments before settlement', 'It cannot hold ERC-20 tokens', 'It removes the need for approvals'], answer: 1, why: 'The bound account is controlled by the current owner. Purchase flows must verify the inventory inside the buyer’s own transaction rather than trusting what a listing showed earlier.' },
    { q: 'Which failure is specific to commit-reveal rather than VRF?', options: ['The oracle can choose the output', 'A participant who dislikes the outcome simply never reveals', 'The result is predictable in the same block', 'It requires a subscription balance'], answer: 1, why: 'Commit-reveal prevents prediction but not withholding. The commitment must be staked and forfeited when the reveal window closes, or losing becomes free.' },
    { q: 'Why should a VRF callback record the result instead of minting the reward directly?', options: ['Minting is not allowed in callbacks', 'The callback runs under a gas limit; heavy work there risks losing a paid-for roll', 'It would make the randomness predictable', 'Callbacks cannot write storage'], answer: 1, why: 'Coordinators cap callback gas. Keep it to a storage write and let the player claim separately, so an expensive mint cannot revert the settlement.' }
  ],
  tasks: [
    'Use the lab to run 1000 draws as an honest player and as a reverting attacker under each randomness source, and record the rare-drop rates.',
    'Draw the on-chain / off-chain boundary for a game you know. Justify each item, then find the cheapest thing you moved on chain and try to move it off.',
    'Write the buyer-side checks a marketplace needs before it can safely settle a sale of an ERC-6551 character with items inside.',
    'Specify a session key for one game action: which contract, which functions, what spend cap, what expiry, and how a player revokes it.'
  ],
  resources: [
    { type: 'eip', title: 'EIP-4907: Rental NFT extension', url: 'https://eips.ethereum.org/EIPS/eip-4907' },
    { type: 'eip', title: 'ERC-6551: Non-fungible Token Bound Accounts', url: 'https://eips.ethereum.org/EIPS/eip-6551' },
    { type: 'eip', title: 'ERC-4337: Account Abstraction', url: 'https://eips.ethereum.org/EIPS/eip-4337' },
    { type: 'docs', title: 'Chainlink VRF', url: 'https://docs.chain.link/vrf' },
    { type: 'docs', title: 'Chainlink VRF security considerations', url: 'https://docs.chain.link/vrf/v2-5/security' }
  ]
});

})(window.ROADMAP.lessons);
