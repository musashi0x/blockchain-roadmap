/* Curriculum skeleton. Each js/data/module-N.js pushes its lessons
   into ROADMAP.lessons in order; app.js reads both. */
window.ROADMAP = {
  meta: {
    title: 'Blockchain Roadmap',
    tagline: 'From hash functions to deployed DeFi contracts, one session at a time.',
    totalHours: 90
  },

  modules: [
    {
      id: 1,
      name: 'Foundations & Cryptography',
      color: '#7c6cff',
      summary: 'What a blockchain actually is, and the four crypto primitives everything else is built from.',
      outcome: 'You can explain — and hand-build — hashes, signatures, Merkle trees and an append-only chain.'
    },
    {
      id: 2,
      name: 'Bitcoin & Consensus',
      color: '#f0b429',
      summary: 'The first working design: UTXOs, proof of work, forks, finality, and the alternatives that replaced it.',
      outcome: 'You can reason about double spends, reorgs, 51% attacks and why PoS finality differs from PoW.'
    },
    {
      id: 3,
      name: 'Ethereum & Solidity',
      color: '#22d3ee',
      summary: 'Accounts, the EVM, gas, and writing real smart contracts including ERC-20 and ERC-721.',
      outcome: 'You can write, reason about and gas-budget non-trivial Solidity contracts.'
    },
    {
      id: 4,
      name: 'Tooling & dApps',
      color: '#34d399',
      summary: 'Foundry and Hardhat, testing, wallets, ethers.js, indexing and shipping to a testnet.',
      outcome: 'You can take a contract from empty folder to tested, deployed, verified, with a working frontend.'
    },
    {
      id: 5,
      name: 'Security & Gas',
      color: '#f87171',
      summary: 'The attack classes that drained real protocols, plus upgradeability and gas engineering.',
      outcome: 'You can audit a contract for the top vulnerability classes and cut its gas cost meaningfully.'
    },
    {
      id: 6,
      name: 'DeFi, Scaling & Capstone',
      color: '#e879f9',
      summary: 'AMMs, lending, oracles, rollups, bridges, zero-knowledge — then you ship your own protocol.',
      outcome: 'You can design a multi-contract protocol and defend its economic and scaling choices.'
    },
    {
      id: 7,
      name: 'Sui & Move',
      color: '#6cb7ff',
      summary: 'An object-centric chain and a resource-oriented language: own assets, compose transaction blocks, design shared state, and integrate Sui DeFi primitives.',
      outcome: 'You can model assets as Sui objects, write and test a small Move package, and integrate Kiosk, sponsorship, wallets, AMMs and lending markets safely.'
    },
    {
      id: 8,
      name: 'Stellar & Soroban',
      color: '#0ec48d',
      summary: 'A payment network with native multi-asset support, federated consensus without a closed validator set, multi-sig by threshold, and a WASM smart-contract host called Soroban.',
      outcome: 'You can reason about quorum slices, build multi-sig and path-payment transactions, model trustlines and anchors, and write a small Soroban contract with explicit authorization and storage.'
    },
    {
      id: 9,
      name: 'NFTs & GameFi',
      color: '#fb923c',
      summary: 'What an NFT actually stores, how marketplaces and royalties really work, and how to design a game economy that does not eat itself.',
      outcome: 'You can audit a collection’s metadata and approvals, size sinks against faucets before launch, and pick a randomness source an attacker cannot reroll.'
    },
    {
      id: 10,
      name: 'DevOps & Validator Operations',
      color: '#a3e635',
      summary: 'Run blockchain infrastructure safely: nodes, sentries, validator keys, observability, upgrades, incidents and reproducible automation.',
      outcome: 'You can deploy, monitor, upgrade and recover a node or validator without treating key custody and consensus safety as afterthoughts.'
    },
    {
      id: 11,
      name: 'Advanced Protocol Systems',
      color: '#c4b5fd',
      summary: 'MEV, cross-chain messaging, smart wallets, production cryptography and reorg-safe data systems.',
      outcome: 'You can evaluate the trust, ordering, custody and data-integrity assumptions behind production blockchain systems.'
    },
    {
      id: 12,
      name: 'Oracles & Data Feeds',
      color: '#38bdf8',
      summary: 'How outside facts get on chain, how price feeds are read without losing money, what manipulation actually costs, and the oracles that are not prices at all.',
      outcome: 'You can state a protocol’s oracle assumption, integrate a feed with every guard, price an oracle attack against a borrow cap, and design a signed-report oracle that resists replay.'
    },
    {
      id: 13,
      name: 'Ecosystem & Architecture Choices',
      color: '#f472b6',
      summary: 'Choosing a chain, renting trust from RPC providers, the L2 landscape, decentralised storage, tokenomics and governance, and when not to use a blockchain at all.',
      outcome: 'You can justify the chain, the layer, the storage backend and the governance design of a system from its requirements — and say out loud when the answer is a database.'
    },
    {
      id: 14,
      name: 'Chainlink Core Stack',
      color: '#2a5ada',
      summary: 'A deep dive into the production oracle network: how OCR aggregates off chain, how an AggregatorV3 feed and its proxy are wired, how a VRF request is funded and fulfilled, and how Automation turns checkUpkeep into a trust-minimised keeper.',
      outcome: 'You can integrate a Chainlink feed with the right guards, request verifiable randomness safely, hand a job to a keeper with idempotent code, and explain the on-chain and off-chain trust behind every Chainlink call.'
    },
    {
      id: 15,
      name: 'Chainlink CCIP',
      color: '#5e29c5',
      summary: 'A cross-chain messaging and token-transfer protocol with a separate Risk Management Network, a commit-then-verify pipeline, a sequencing scheme that prevents replay, and two token-transfer modes with rate limits.',
      outcome: 'You can send arbitrary data or move tokens between chains with CCIP, reason about its two-stage security model, and size a transfer against its rate limits before relying on it for production volume.'
    },
    {
      id: 16,
      name: 'Chainlink Functions & Data Streams',
      color: '#3a8ee6',
      summary: 'Serverless off-chain code whose result is attested by a DON (Functions), and low-latency signed reports for derivatives and perps (Data Streams) — plus a decision procedure for picking the right Chainlink service for a given problem.',
      outcome: 'You can describe when Functions beats a push feed, when Data Streams beats a pull feed, and you can name, from a one-paragraph product requirement, the Chainlink service that fits.'
    }
  ],

  lessons: []
};
