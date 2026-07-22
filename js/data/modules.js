/* Curriculum skeleton. Each js/data/module-N.js pushes its lessons
   into ROADMAP.lessons in order; app.js reads both. */
window.ROADMAP = {
  meta: {
    title: 'Blockchain Roadmap',
    tagline: 'From hash functions to deployed DeFi contracts, one session at a time.',
    totalHours: 31
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
    }
  ],

  lessons: []
};
