/* ============================================================
   anime-mascot.js — Cyber-Chan Interactive Anime Assistant
   ============================================================ */

(function () {
  'use strict';

  // Character Images
  const AVATARS = {
    full: 'images/anime_mascot.jpg',
    chibi: 'images/anime_mascot_chibi.jpg'
  };

  // State
  let currentAvatarKey = 'full';
  let soundEnabled = false;
  let panelOpen = false;
  let synthAudioContext = null;

  // Web Audio SFX synth
  function playCyberSound(type) {
    if (!soundEnabled) return;
    try {
      if (!synthAudioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        synthAudioContext = new AudioCtx();
      }
      if (synthAudioContext.state === 'suspended') {
        synthAudioContext.resume();
      }

      const osc = synthAudioContext.createOscillator();
      const gain = synthAudioContext.createGain();
      osc.connect(gain);
      gain.connect(synthAudioContext.destination);

      const now = synthAudioContext.currentTime;

      if (type === 'blip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'cheer') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'click') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      }
    } catch (e) {
      // Audio fallback silent failure
    }
  }

  // Generic & Topic-specific tips
  const HINT_DATABASE = {
    general: [
      "Welcome to the Blockchain Roadmap! I'm Cyber-Chan, your anime learning companion ⚡",
      "Tip: Click on any lesson to open live in-browser labs and interactive diagrams!",
      "Consistency is key! Completing 1 lesson every day will get you to Web3 mastery in 40 days 🚀",
      "You can toggle between Dark HUD and Light theme anytime with the theme button in the topbar!"
    ],
    m1: "Foundations Module! Mastering hashing, public keys, and Merkle trees is essential before diving into smart contracts.",
    m2: "Bitcoin Module! Pay close attention to UTXO model vs Account model — it trips up many developers!",
    m3: "Ethereum & EVM! Remember: gas pays for computation. Always optimize your loops and storage writes in Solidity.",
    m4: "Solidity Deep Dive! Always guard against reentrancy attacks with Checks-Effects-Interactions patterns.",
    m5: "Sui & Move Language! Move uses linear types where assets are true resources that cannot be implicitly duplicated or dropped.",
    m6: "Stellar & Soroban! Soroban uses WebAssembly (WASM) smart contracts built with Rust for super-fast execution.",
    m7: "dApp Frontend Development! Connecting Web3 wallets like Metamask or Phantom requires robust error handling for user rejections.",
    m8: "Security & Auditing! Never store secret keys or private data directly on-chain — all blockchain data is public!",
    m9: "DeFi & Layer 2s! AMMs like Uniswap use constant product formula x * y = k to price tokens automatically.",
    m10: "Advanced Topics & ZK-Proofs! Zero-Knowledge proofs let you verify statements without revealing the underlying data."
  };

  // Sample Quiz Database
  const QUIZ_DATABASE = {
    l01: {
      q: "What fundamental problem does a blockchain consensus solve?",
      opts: ["Double-spending without a central server", "Speeding up internet bandwidth", "Replacing HTML code", "Compressing files"],
      ans: 0,
      explain: "Sugoi! Exactly! Blockchains prevent double-spending by establishing a decentralized append-only consensus log."
    },
    default: {
      q: "Which cryptographic primitive locks transactions together into blocks?",
      opts: ["SHA-256 / Hash Functions", "Base64 Encoding", "AES-256 Symmetric Encryption", "ZIP Compression"],
      ans: 0,
      explain: "Correct! Cryptographic hashes chain each block to the previous block's hash, making history immutable."
    }
  };

  // Typewriter effect helper
  let typingTimer = null;
  function typeText(element, text, callback) {
    if (typingTimer) clearInterval(typingTimer);
    element.innerHTML = '';
    let i = 0;
    typingTimer = setInterval(() => {
      if (i < text.length) {
        element.innerHTML += text.charAt(i);
        if (i % 3 === 0) playCyberSound('blip');
        i++;
      } else {
        clearInterval(typingTimer);
        typingTimer = null;
        if (callback) callback();
      }
    }, 18);
  }

  // Mascot UI Component Construction
  function createMascotUI() {
    // 1. Toast Notification Element
    const toast = document.createElement('div');
    toast.className = 'mascot-toast';
    toast.id = 'mascotToast';
    toast.innerHTML = `
      <img id="mascotToastImg" src="${AVATARS.full}" alt="Cyber-Chan">
      <div>
        <h4 class="mascot-toast-title" id="mascotToastTitle">Lesson Completed! ⚡</h4>
        <p class="mascot-toast-desc" id="mascotToastDesc">Great job making progress!</p>
      </div>
    `;
    document.body.appendChild(toast);

    // 2. Main Mascot Floating Container
    const container = document.createElement('div');
    container.className = 'mascot-container';
    container.id = 'mascotContainer';

    // Speech Panel
    const panel = document.createElement('div');
    panel.className = 'mascot-speech-panel';
    panel.id = 'mascotPanel';
    panel.innerHTML = `
      <div class="mascot-panel-header">
        <div class="mascot-name-tag">
          <img src="${AVATARS[currentAvatarKey]}" class="mascot-avatar-mini" id="mascotMiniAvatar" alt="Cyber-Chan">
          <span>CYBER-CHAN // AI GUIDE</span>
        </div>
        <div class="mascot-header-actions">
          <button class="mascot-icon-btn" id="mascotSoundBtn" title="Toggle Sound">🔇</button>
          <button class="mascot-icon-btn" id="mascotSwitchAvatarBtn" title="Switch Avatar Style">🖼️</button>
          <button class="mascot-icon-btn" id="mascotCloseBtn" title="Minimize Panel">✕</button>
        </div>
      </div>
      <div class="mascot-panel-body">
        <p class="mascot-dialog-text" id="mascotDialogText">Kon'nichiwa, dev-san! I'm Cyber-Chan, your blockchain anime guide ⚡ How can I help you today?</p>
        <div id="mascotExtraContent"></div>
      </div>
      <div class="mascot-actions-bar">
        <button class="mascot-chip highlight" id="mascotTipBtn">💡 Current Tip</button>
        <button class="mascot-chip" id="mascotQuizBtn">⚡ Quick Quiz</button>
        <button class="mascot-chip" id="mascotMotivateBtn">🔥 Motivation</button>
      </div>
    `;

    // Mascot Trigger Button
    const trigger = document.createElement('div');
    trigger.className = 'mascot-trigger';
    trigger.id = 'mascotTrigger';
    trigger.title = 'Click to chat with Cyber-Chan!';
    trigger.innerHTML = `
      <img id="mascotMainImg" src="${AVATARS[currentAvatarKey]}" alt="Cyber-Chan Mascot">
      <div class="mascot-status-badge">
        <span class="mascot-status-dot"></span> AI
      </div>
    `;

    container.appendChild(panel);
    container.appendChild(trigger);
    document.body.appendChild(container);

    // Event Listeners
    trigger.addEventListener('click', () => {
      playCyberSound('click');
      togglePanel();
    });

    document.getElementById('mascotCloseBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      playCyberSound('click');
      closePanel();
    });

    document.getElementById('mascotSwitchAvatarBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      playCyberSound('click');
      toggleAvatarStyle();
    });

    document.getElementById('mascotSoundBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      soundEnabled = !soundEnabled;
      e.target.textContent = soundEnabled ? '🔊' : '🔇';
      playCyberSound('click');
    });

    document.getElementById('mascotTipBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      showCurrentLessonTip();
    });

    document.getElementById('mascotQuizBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      showQuickQuiz();
    });

    document.getElementById('mascotMotivateBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      showMotivation();
    });

    // Listen to hash changes & DOM lesson updates
    window.addEventListener('hashchange', () => {
      setTimeout(onRouteChanged, 100);
    });

    // Listen for progress checkbox clicks
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id && e.target.id.startsWith('chk-')) {
        if (e.target.checked) {
          triggerCompletionToast();
        }
      }
    });

    // Initial greeting
    setTimeout(() => {
      onRouteChanged();
    }, 600);
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    const panel = document.getElementById('mascotPanel');
    if (panelOpen) {
      panel.classList.add('open');
      onRouteChanged();
    } else {
      panel.classList.remove('open');
    }
  }

  function closePanel() {
    panelOpen = false;
    document.getElementById('mascotPanel').classList.remove('open');
  }

  function toggleAvatarStyle() {
    currentAvatarKey = currentAvatarKey === 'full' ? 'chibi' : 'full';
    document.getElementById('mascotMainImg').src = AVATARS[currentAvatarKey];
    document.getElementById('mascotMiniAvatar').src = AVATARS[currentAvatarKey];
    document.getElementById('mascotToastImg').src = AVATARS[currentAvatarKey];
    
    const dialog = document.getElementById('mascotDialogText');
    typeText(dialog, `Switched to ${currentAvatarKey === 'chibi' ? 'Chibi Mode! Cute & compact 🐾' : 'Full Cyber Anime Mode! High-tech & glowing ✨'}`);
  }

  // Get current active lesson or module info
  function getCurrentContext() {
    const hash = window.location.hash || '#/';
    if (hash.startsWith('#/lesson/')) {
      const lessonId = hash.replace('#/lesson/', '');
      if (window.ROADMAP && window.ROADMAP.lessons) {
        const lesson = window.ROADMAP.lessons.find(l => l.id === lessonId);
        if (lesson) return { type: 'lesson', data: lesson };
      }
    }
    return { type: 'overview' };
  }

  function onRouteChanged() {
    const ctx = getCurrentContext();
    const dialog = document.getElementById('mascotDialogText');
    const extra = document.getElementById('mascotExtraContent');
    if (!dialog) return;
    extra.innerHTML = '';

    if (ctx.type === 'lesson') {
      const l = ctx.data;
      const modKey = `m${l.module}`;
      const modHint = HINT_DATABASE[modKey] || '';
      const text = `<strong>Lesson ${l.num}: ${l.title}</strong><br>${l.summary}<br><br><em>💡 Cyber-Tip: ${modHint}</em>`;
      typeText(dialog, text);
    } else {
      const text = `<strong>Roadmap Overview</strong><br>Select any module on the left to start learning! There are 40 interactive lessons waiting for you. Let's do this! ⚡`;
      typeText(dialog, text);
    }
  }

  function showCurrentLessonTip() {
    onRouteChanged();
  }

  function showMotivation() {
    const dialog = document.getElementById('mascotDialogText');
    const extra = document.getElementById('mascotExtraContent');
    extra.innerHTML = '';

    const quotes = [
      "🔥 'The secret to getting ahead is getting started.' — Keep pushing forward!",
      "⚡ 'Code is like humor. When you have to explain it, it’s bad.' — Build clean Web3 architecture!",
      "🌟 'Every line of code brings you closer to becoming a Blockchain Architect!'",
      "🚀 'Zero-Knowledge, High Power! You're making awesome progress today!'"
    ];
    const randQuote = quotes[Math.floor(Math.random() * quotes.length)];
    typeText(dialog, `<strong>Cyber-Chan Energy Boost:</strong><br>${randQuote}`);
    playCyberSound('cheer');
  }

  function showQuickQuiz() {
    const ctx = getCurrentContext();
    const dialog = document.getElementById('mascotDialogText');
    const extra = document.getElementById('mascotExtraContent');
    
    let quiz = QUIZ_DATABASE.default;
    if (ctx.type === 'lesson' && QUIZ_DATABASE[ctx.data.id]) {
      quiz = QUIZ_DATABASE[ctx.data.id];
    }

    dialog.innerHTML = `<strong>⚡ Cyber-Chan Quick Quiz:</strong>`;

    let html = `
      <div class="mascot-quiz-box">
        <div class="mascot-quiz-q">${quiz.q}</div>
    `;
    quiz.opts.forEach((opt, idx) => {
      html += `<button class="mascot-quiz-opt" data-idx="${idx}">${opt}</button>`;
    });
    html += `</div>`;
    extra.innerHTML = html;

    extra.querySelectorAll('.mascot-quiz-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const chosen = parseInt(e.target.getAttribute('data-idx'), 10);
        if (chosen === quiz.ans) {
          e.target.classList.add('correct');
          playCyberSound('cheer');
          dialog.innerHTML = `<strong>🏆 Correct! Sugoi!</strong><br>${quiz.explain}`;
        } else {
          e.target.classList.add('wrong');
          playCyberSound('click');
          dialog.innerHTML = `<strong>❌ Not quite!</strong> Try again or check the lesson notes above!`;
        }
      });
    });
  }

  function triggerCompletionToast() {
    playCyberSound('cheer');
    const toast = document.getElementById('mascotToast');
    const title = document.getElementById('mascotToastTitle');
    const desc = document.getElementById('mascotToastDesc');

    title.textContent = 'Lesson Completed! 🏆';
    desc.textContent = 'Cyber-Chan says: Sugoi! Your Web3 skills just leveled up!';
    
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);

    // Also pop open speech panel briefly if closed
    if (!panelOpen) {
      setTimeout(() => {
        togglePanel();
        const dialog = document.getElementById('mascotDialogText');
        if (dialog) typeText(dialog, `<strong>🎉 Sugoi! You finished a lesson!</strong><br>Keep up the amazing work, dev-san! You're on fire! ⚡`);
      }, 500);
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createMascotUI);
  } else {
    createMascotUI();
  }

})();
