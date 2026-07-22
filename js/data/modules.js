/* Curriculum skeleton. Each js/data/module-N.js pushes its lessons
   into ROADMAP.lessons in order; app.js reads both. */
window.ROADMAP = {
  meta: {
    title: 'Blockchain Roadmap',
    tagline: 'From hash functions to deployed DeFi contracts, one session at a time.',
    totalHours: 63
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
    }
  ],

  lessons: []
};
