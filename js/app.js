/* ============================================================
   app.js — router, rendering, progress, theme, search.

   Depends on (loaded before this file):
     window.CL       js/lib/crypto-lite.js
     window.ROADMAP  js/data/modules.js + module-1..7.js
     window.LABS     js/playground.js

   No build step, no modules, no network. Runs from file://.
   ============================================================ */
(function () {
  'use strict';

  const R = window.ROADMAP;
  const LABS = window.LABS || {};

  const PROGRESS_KEY = 'br.progress.v1';
  const THEME_KEY = 'br.theme.v1';

  /* ---------------- data ---------------- */

  const lessons = R.lessons.slice().sort((a, b) =>
    a.module - b.module || a.num - b.num);
  const byId = {};
  lessons.forEach((l, i) => { byId[l.id] = l; l._i = i; });
  const modules = R.modules;
  const modColor = {};
  modules.forEach(m => modColor[m.id] = m.color);

  // the header count is derived, so adding a module never leaves it stale
  (function brandCount() {
    const em = document.querySelector('.brand-text em');
    if (em) em.textContent = lessons.length + ' lessons · ' + modules.length + ' modules · live labs';
  })();

  function lessonsOf(mid) { return lessons.filter(l => l.module === mid); }

  /* ---------------- progress ---------------- */

  let done = {};
  try { done = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {}; }
  catch (e) { done = {}; }

  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch (e) { /* private mode */ }
  }
  function isDone(id) { return !!done[id]; }
  function setDone(id, v) {
    if (v) done[id] = 1; else delete done[id];
    saveProgress();
    paintProgress();
  }
  const doneCount = () => lessons.filter(l => isDone(l.id)).length;

  /* ---------------- helpers ---------------- */

  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }

  const totalMinutes = lessons.reduce((a, l) => a + (l.minutes || 0), 0);

  /* ---------------- syntax highlighting ---------------- */

  const KW = [
    'pragma', 'solidity', 'contract', 'interface', 'library', 'abstract', 'is', 'using',
    'import', 'from', 'as', 'function', 'constructor', 'receive', 'fallback', 'modifier',
    'event', 'emit', 'error', 'revert', 'require', 'assert', 'returns', 'return',
    'public', 'private', 'internal', 'external', 'view', 'pure', 'payable',
    'memory', 'storage', 'calldata', 'immutable', 'constant', 'override', 'virtual',
    'indexed', 'unchecked', 'assembly', 'new', 'delete', 'if', 'else', 'for', 'while',
    'do', 'break', 'continue', 'try', 'catch', 'throw', 'switch', 'case', 'default',
    'mapping', 'struct', 'enum', 'type', 'let', 'const', 'var', 'async', 'await',
    'class', 'extends', 'export', 'this', 'super', 'null', 'undefined', 'true', 'false',
    'typeof', 'instanceof', 'in', 'of', 'template', 'signal', 'component', 'echo', 'set',
    'module', 'fun', 'entry', 'has', 'copy', 'drop', 'store', 'key', 'mut', 'acquires'
  ].join('|');

  const TY = [
    'u?int\\d*', 'u8', 'u16', 'u32', 'u64', 'u128', 'u256', 'address', 'bool', 'bytes\\d*', 'string', 'byte', 'vector', 'void', 'any',
    'number', 'boolean', 'bigint', 'Promise', 'Uint8Array', 'BigInt', 'Math', 'JSON',
    'console', 'msg', 'block', 'tx', 'abi', 'vm', 'wei', 'gwei', 'ether'
  ].join('|');

  const HASH_LANGS = /^(bash|sh|shell|zsh|toml|yaml|yml|ini|conf|python|env)$/i;

  function highlight(src, lang) {
    let s = esc(src);
    const comment = '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' +
      (HASH_LANGS.test(lang || '') ? '|#[^\\n]*' : '');
    const str = '"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'';
    const nums = '\\b0x[0-9a-fA-F]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b';

    const rx = new RegExp(
      '(' + comment + ')|(' + str + ')|(' + nums + ')|' +
      '\\b(' + KW + ')\\b|\\b(' + TY + ')\\b|' +
      '\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()', 'g');

    return s.replace(rx, function (m, c, q, n, k, t, f) {
      if (c) return '<span class="tk-com">' + c + '</span>';
      if (q) return '<span class="tk-str">' + q + '</span>';
      if (n) return '<span class="tk-num">' + n + '</span>';
      if (k) return '<span class="tk-kw">' + k + '</span>';
      if (t) return '<span class="tk-typ">' + t + '</span>';
      if (f) return '<span class="tk-fn">' + f + '</span>';
      return m;
    });
  }

  function codeBlock(c) {
    const node = el('div', 'code-block');
    node.innerHTML =
      '<header>' +
        '<span class="lang">' + esc(c.lang || 'code') + '</span>' +
        (c.file ? '<span class="file">' + esc(c.file) + '</span>' : '') +
        '<button class="copy" type="button">copy</button>' +
      '</header>' +
      '<pre><code>' + highlight(c.src, c.lang) + '</code></pre>' +
      (c.caption ? '<div class="cap">' + c.caption + '</div>' : '');

    node.querySelector('.copy').addEventListener('click', function () {
      const btn = this;
      copyText(c.src, ok => {
        btn.textContent = ok ? 'copied' : 'select + ⌘C';
        setTimeout(() => { btn.textContent = 'copy'; }, 1400);
      });
    });
    return node;
  }

  function copyText(text, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => cb(true), () => fallback());
    } else fallback();

    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      cb(ok);
    }
  }

  /* ---------------- sidebar ---------------- */

  const navEl = $('#nav');

  function buildNav() {
    navEl.innerHTML = '';
    modules.forEach(m => {
      const list = lessonsOf(m.id);
      const d = el('details', 'nav-module');
      d.open = true;
      d.dataset.module = m.id;

      const sum = el('summary');
      sum.innerHTML =
        '<span class="m-dot" style="background:' + m.color + '"></span>' +
        '<span>' + esc(m.name) + '</span>' +
        '<span class="m-count" data-count="' + m.id + '"></span>';
      d.appendChild(sum);

      const ul = el('ul', 'nav-list');
      list.forEach(l => {
        const li = el('li');
        li.innerHTML =
          '<a href="#/lesson/' + l.id + '" data-nav="' + l.id + '" ' +
             'data-text="' + attr((l.title + ' ' + l.summary + ' ' + (l.objectives || []).join(' ')).toLowerCase()) + '">' +
            '<span class="tick">✓</span>' +
            '<span class="num">' + String(l.num).padStart(2, '0') + '</span>' +
            '<span class="t">' + esc(l.title) + '</span>' +
          '</a>';
        ul.appendChild(li);
      });
      d.appendChild(ul);
      navEl.appendChild(d);
    });
  }

  function paintProgress() {
    const n = doneCount(), total = lessons.length;
    const p = total ? n / total : 0;
    $('#globalBarFill').style.width = (p * 100).toFixed(1) + '%';
    $('#globalBarLabel').textContent = Math.round(p * 100) + '%';

    modules.forEach(m => {
      const list = lessonsOf(m.id);
      const k = list.filter(l => isDone(l.id)).length;
      const c = navEl.querySelector('[data-count="' + m.id + '"]');
      if (c) c.textContent = k + '/' + list.length;
    });

    lessons.forEach(l => {
      const a = navEl.querySelector('[data-nav="' + l.id + '"]');
      if (a) a.classList.toggle('done', isDone(l.id));
    });

    // dashboard tiles + module bars, when the overview is on screen
    document.querySelectorAll('[data-tile]').forEach(t =>
      t.classList.toggle('done', isDone(t.getAttribute('data-tile'))));
    document.querySelectorAll('[data-mbar]').forEach(b => {
      const mid = Number(b.getAttribute('data-mbar'));
      const list = lessonsOf(mid);
      const k = list.filter(l => isDone(l.id)).length;
      b.querySelector('span').style.width = (list.length ? k / list.length * 100 : 0) + '%';
      const lbl = b.parentNode.querySelector('.mc-num');
      if (lbl) lbl.textContent = k + ' / ' + list.length + ' done';
    });
  }

  function markActiveNav(id) {
    navEl.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
    const home = document.querySelector('.nav-home');
    home.classList.toggle('active', !id);
    if (!id) return;
    const a = navEl.querySelector('[data-nav="' + id + '"]');
    if (a) {
      a.classList.add('active');
      const det = a.closest('details');
      if (det) det.open = true;
      if (a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---------------- search ---------------- */

  $('#search').addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    navEl.querySelectorAll('details').forEach(d => {
      let shown = 0;
      d.querySelectorAll('a[data-nav]').forEach(a => {
        const hit = !q || a.getAttribute('data-text').indexOf(q) >= 0;
        a.parentNode.hidden = !hit;
        if (hit) shown++;
      });
      d.hidden = shown === 0;
      if (q) d.open = true;
    });
  });

  /* ---------------- overview ---------------- */

  function renderHome() {
    const main = $('#main');
    main.innerHTML = '';
    const n = doneCount();

    const hero = el('section', 'hero');
    hero.innerHTML =
      '<h1>' + esc(R.meta.title) + '</h1>' +
      '<p class="lede">' + esc(R.meta.tagline) + '</p>' +
      '<div class="hero-stats">' +
        stat(lessons.length, 'lessons') +
        stat(modules.length, 'modules') +
        stat(Math.round(totalMinutes / 60) + 'h', 'guided time') +
        stat(Object.keys(LABS).length, 'live labs') +
        stat(n + '/' + lessons.length, 'completed') +
      '</div>' +
      '<div class="cta-row">' +
        '<a class="btn primary" href="#/lesson/' + nextUp().id + '">' +
          (n ? 'Continue: lesson ' + nextUp().num : 'Start lesson 1') + ' →</a>' +
        '<a class="btn ghost" href="#/lesson/' + lessons[0].id + '">Back to the beginning</a>' +
      '</div>';
    main.appendChild(hero);

    if (window.DIA) {
      main.appendChild(el('div', 'section-head', '<h2>The route</h2><span class="hint">' + modules.length + ' modules, in order</span>'));
      main.appendChild(diagramPanel([DIA.home()]));
    }

    main.appendChild(el('div', 'section-head',
      '<h2>How to use this roadmap</h2>'));

    const how = el('section', 'panel');
    how.innerHTML =
      '<div class="prose">' +
      '<p>One lesson is one session. Each has the same shape: what you will be able to do, the explanation, ' +
      'annotated code you can copy and run, a live lab in the page, a short quiz, and exercises that need a real keyboard.</p>' +
      '<ul>' +
      '<li><strong>Do the lab before the quiz.</strong> The labs are not illustrations — they compute the real thing. ' +
      'The hashing, signing and address derivation all run genuine algorithms in your browser.</li>' +
      '<li><strong>Type the exercises out.</strong> Reading Solidity and writing Solidity are different skills, and only the second one gets you a job or keeps your funds.</li>' +
      '<li><strong>Never reuse a key from any lab or tutorial.</strong> Test keys are public knowledge; bots sweep them within seconds.</li>' +
      '</ul>' +
      '<p>Everything works offline. Progress is stored in this browser only.</p>' +
      '</div>';
    main.appendChild(how);

    main.appendChild(el('div', 'section-head',
      '<h2>Curriculum</h2><span class="hint">' + lessons.length + ' lessons · click any to open</span>'));

    modules.forEach(m => {
      const list = lessonsOf(m.id);
      const card = el('section', 'module-card');
      card.innerHTML =
        '<header>' +
          '<div class="mc-badge" style="background:' + m.color + '">' + m.id + '</div>' +
          '<div><h3>' + esc(m.name) + '</h3><p class="mc-sub">' + esc(m.summary) + '</p></div>' +
          '<div class="mc-prog"><span class="mc-num"></span>' +
            '<div class="bar" data-mbar="' + m.id + '"><span style="background:' + m.color + '"></span></div>' +
          '</div>' +
        '</header>' +
        '<div class="lesson-grid">' +
          list.map(l =>
            '<a class="lesson-tile" data-tile="' + l.id + '" href="#/lesson/' + l.id + '">' +
              '<span class="lt-num">' + String(l.num).padStart(2, '0') + '</span>' +
              '<span><span class="lt-title">' + esc(l.title) + '</span>' +
                '<span class="lt-meta"><span>' + l.minutes + ' min</span><span>' + esc(l.level) + '</span>' +
                (l.lab ? '<span>lab</span>' : '') + '</span></span>' +
            '</a>').join('') +
        '</div>';
      main.appendChild(card);

      const out = el('div', 'note');
      out.innerHTML = '<span class="tag">Outcome</span>' + esc(m.outcome);
      main.appendChild(out);
    });

    paintProgress();
    markActiveNav(null);
    document.title = R.meta.title + ' — ' + lessons.length + ' lessons with live examples';
  }

  function stat(b, s) { return '<div class="stat"><b>' + b + '</b><span>' + s + '</span></div>'; }

  /* ---------------- diagrams ---------------- */

  /* window.DIA is optional: drop js/diagrams.js and the page still renders. */
  function figure(d) {
    return '<figure class="dia-fig">' +
      '<div class="dia-head">' +
        (d.title ? '<p class="dia-title">' + esc(d.title) + '</p>' : '') +
        '<button class="dia-replay" type="button" title="Replay the animation">▶ replay</button>' +
      '</div>' +
      '<div class="dia-scroll" role="img" aria-label="' + attr(d.title || 'diagram') + '">' + d.svg + '</div>' +
      (d.cap ? '<figcaption class="dia-cap">' + esc(d.cap) + '</figcaption>' : '') +
      '</figure>';
  }

  function diagramPanel(list) {
    const p = el('section', 'panel');
    p.innerHTML = '<h2 data-jp="図解">' + (list.length > 1 ? 'Diagrams' : 'Diagram') + '</h2>' +
      list.map(figure).join('');

    p.addEventListener('click', e => {
      const btn = e.target.closest('.dia-replay');
      if (!btn) return;
      const svg = btn.closest('.dia-fig').querySelector('svg.dia');
      if (svg && DIA.replay) DIA.replay(svg);
    });

    /* the panel is appended by the caller in this same task, so by the next
       task it is in the document and measurable. Not requestAnimationFrame:
       that never fires while the tab is hidden, and the diagrams would then
       never be prepared at all. */
    setTimeout(() => { if (window.DIA && DIA.animate) DIA.animate(p); }, 0);
    return p;
  }

  function nextUp() {
    return lessons.find(l => !isDone(l.id)) || lessons[lessons.length - 1];
  }

  /* ---------------- lesson ---------------- */

  function renderLesson(id) {
    const l = byId[id];
    if (!l) { location.hash = '#/'; return; }
    const m = modules.find(x => x.id === l.module) || { name: '', color: 'var(--accent)' };
    const main = $('#main');
    main.innerHTML = '';

    /* head */
    const head = el('header', 'lesson-head');
    head.innerHTML =
      '<div class="crumbs"><a href="#/">Roadmap</a> / Module ' + l.module + ' · ' + esc(m.name) + '</div>' +
      '<h1>' + String(l.num).padStart(2, '0') + '. ' + esc(l.title) + '</h1>' +
      '<div class="chips">' +
        '<span class="chip lvl-' + String(l.level).toLowerCase() + '">' + esc(l.level) + '</span>' +
        '<span class="chip">' + l.minutes + ' min</span>' +
        '<span class="chip">Session ' + l.num + ' of ' + lessons.length + '</span>' +
        (l.lab ? '<span class="chip">interactive lab</span>' : '') +
        (isDone(l.id) ? '<span class="chip" style="color:var(--ok)">completed ✓</span>' : '') +
      '</div>' +
      '<p class="prose" style="margin-bottom:22px">' + esc(l.summary) + '</p>';
    main.appendChild(head);

    /* objectives */
    if (l.objectives && l.objectives.length) {
      const p = el('section', 'panel');
      p.innerHTML = '<h2 data-jp="目標">By the end of this session</h2><ul class="goals">' +
        l.objectives.map(o => '<li>' + o + '</li>').join('') + '</ul>';
      main.appendChild(p);
    }

    /* body */
    const body = el('section', 'panel');
    body.innerHTML = '<h2 data-jp="レッスン">Lesson</h2><div class="prose">' + l.body + '</div>';
    main.appendChild(body);
    body.querySelectorAll('table').forEach(t => {
      if (t.parentNode.classList.contains('table-scroll')) return;
      const wrap = el('div', 'table-scroll');
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });

    /* diagrams — the picture of what the lesson just described */
    const dias = window.DIA ? DIA.get(l.id) : [];
    if (dias.length) main.appendChild(diagramPanel(dias));

    /* code */
    if (l.code && l.code.length) {
      const p = el('section', 'panel');
      p.innerHTML = '<h2 data-jp="コード">Worked examples</h2>';
      l.code.forEach(c => p.appendChild(codeBlock(c)));
      main.appendChild(p);
    }

    /* lab */
    if (l.lab) {
      const lab = LABS[l.lab];
      const p = el('section', 'panel lab');
      if (lab) {
        p.innerHTML = '<h2 data-jp="ラボ">Lab · ' + esc(lab.title) + '</h2>' +
          '<p class="lab-desc">' + lab.desc + '</p>';
        const mount = el('div');
        p.appendChild(mount);
        main.appendChild(p);
        try { lab.mount(mount); }
        catch (e) {
          mount.innerHTML = '<div class="out"><span class="bad">Lab failed to start: ' +
            esc(e.message || e) + '</span></div>';
          if (window.console) console.error('lab "' + l.lab + '" failed', e);
        }
      } else {
        p.innerHTML = '<h2 data-jp="ラボ">Lab</h2><div class="empty">No lab registered for key "' + esc(l.lab) + '".</div>';
        main.appendChild(p);
      }
    }

    /* quiz */
    if (l.quiz && l.quiz.length) {
      const p = el('section', 'panel');
      p.innerHTML = '<h2 data-jp="クイズ">Check yourself</h2>';
      l.quiz.forEach((q, qi) => {
        const box = el('div', 'quiz-q');
        box.innerHTML =
          '<p class="q">' + (qi + 1) + '. ' + esc(q.q) + '</p>' +
          q.options.map((o, oi) =>
            '<label class="opt"><input type="radio" name="' + l.id + '-q' + qi + '" value="' + oi + '">' +
            '<span>' + esc(o) + '</span></label>').join('') +
          '<div class="explain" hidden></div>';

        const opts = Array.from(box.querySelectorAll('.opt'));
        const explain = box.querySelector('.explain');
        opts.forEach((opt, oi) => {
          opt.querySelector('input').addEventListener('change', () => {
            opts.forEach((o2, i2) => {
              o2.querySelector('input').disabled = true;
              if (i2 === q.answer) o2.classList.add('correct');
            });
            if (oi !== q.answer) opt.classList.add('wrong');
            explain.hidden = false;
            explain.innerHTML = (oi === q.answer ? '<strong>Correct.</strong> ' : '<strong>Not quite.</strong> ') + q.why;
          });
        });
        p.appendChild(box);
      });
      main.appendChild(p);
    }

    /* exercises */
    if (l.tasks && l.tasks.length) {
      const p = el('section', 'panel');
      p.innerHTML = '<h2 data-jp="演習">Exercises</h2><ol class="tasks">' +
        l.tasks.map(t => '<li>' + t + '</li>').join('') + '</ol>';
      main.appendChild(p);
    }

    /* resources */
    if (l.resources && l.resources.length) {
      const p = el('section', 'panel');
      p.innerHTML = '<h2 data-jp="資料">Go deeper</h2><ul class="reslist">' +
        l.resources.map(r =>
          '<li><a href="' + attr(r.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="rt">' + esc(r.type) + '</span><span>' + esc(r.title) + '</span></a></li>').join('') +
        '</ul>';
      main.appendChild(p);
    }

    /* done bar */
    const bar = el('div', 'done-bar');
    const btn = el('button', 'btn' + (isDone(l.id) ? ' ghost' : ' primary'));
    btn.type = 'button';
    btn.textContent = isDone(l.id) ? '✓ Completed — mark as not done' : 'Mark this session complete';
    const txt = el('span', 'txt');
    const refreshBar = () => {
      txt.textContent = doneCount() + ' of ' + lessons.length + ' sessions complete · ' +
        Math.round(doneCount() / lessons.length * 100) + '%';
      btn.textContent = isDone(l.id) ? '✓ Completed — mark as not done' : 'Mark this session complete';
      btn.className = 'btn' + (isDone(l.id) ? ' ghost' : ' primary');
    };
    btn.addEventListener('click', () => {
      setDone(l.id, !isDone(l.id));
      refreshBar();
      const chips = main.querySelector('.chips');
      const old = chips.querySelector('.chip[data-c]');
      if (old) old.remove();
      if (isDone(l.id)) {
        const c = el('span', 'chip');
        c.setAttribute('data-c', '1');
        c.style.color = 'var(--ok)';
        c.textContent = 'completed ✓';
        chips.appendChild(c);
      }
    });
    refreshBar();
    bar.appendChild(btn);
    bar.appendChild(txt);
    main.appendChild(bar);

    /* pager */
    const prev = lessons[l._i - 1], next = lessons[l._i + 1];
    const pg = el('nav', 'pager');
    pg.innerHTML =
      (prev ? '<a href="#/lesson/' + prev.id + '"><span class="dir">← previous</span>' +
              '<span class="t">' + esc(prev.title) + '</span></a>'
            : '<a href="#/"><span class="dir">←</span><span class="t">Roadmap overview</span></a>') +
      (next ? '<a class="next" href="#/lesson/' + next.id + '"><span class="dir">next →</span>' +
              '<span class="t">' + esc(next.title) + '</span></a>'
            : '<a class="next" href="#/"><span class="dir">done →</span><span class="t">Back to the roadmap</span></a>');
    main.appendChild(pg);

    markActiveNav(l.id);
    paintProgress();
    document.title = l.num + '. ' + l.title + ' — ' + R.meta.title;
    main.scrollIntoView({ block: 'start' });
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  /* ---------------- router ---------------- */

  function route() {
    closeNav();
    const h = location.hash.replace(/^#/, '');
    const mm = h.match(/^\/lesson\/([a-z0-9-]+)/i);
    if (mm) renderLesson(mm[1]);
    else renderHome();
  }
  window.addEventListener('hashchange', route);

  /* ---------------- theme ---------------- */

  (function initTheme() {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (!t) {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', t);
  })();

  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem(THEME_KEY, cur); } catch (e) { /* ignore */ }
  });

  /* ---------------- reset ---------------- */

  $('#resetBtn').addEventListener('click', () => {
    const n = doneCount();
    if (!n) { flash('Nothing to reset — no sessions marked complete yet.'); return; }
    if (!confirm('Reset progress?\n\n' + n + ' completed session' + (n === 1 ? '' : 's') +
      ' will be cleared from this browser. This cannot be undone.')) return;
    done = {};
    saveProgress();
    route();
    flash('Progress cleared.');
  });

  function flash(msg) {
    const n = el('div', '', esc(msg));
    n.style.cssText =
      'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99;' +
      'background:var(--bg-elev-2);border:1px solid var(--border);border-radius:10px;' +
      'padding:10px 18px;font-size:14px;box-shadow:var(--shadow)';
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  /* ---------------- mobile nav ---------------- */

  const toggle = $('#navToggle'), scrim = $('#scrim');
  function openNav() {
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    scrim.hidden = false;
  }
  function closeNav() {
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    scrim.hidden = true;
  }
  toggle.addEventListener('click', () =>
    document.body.classList.contains('nav-open') ? closeNav() : openNav());
  scrim.addEventListener('click', closeNav);

  /* ---------------- keyboard ---------------- */

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      if (typing && tag === 'input' && e.target.id === 'search') { e.target.value = ''; e.target.dispatchEvent(new Event('input')); e.target.blur(); }
      closeNav();
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '/') { e.preventDefault(); $('#search').focus(); return; }

    const cur = (location.hash.match(/^#\/lesson\/([a-z0-9-]+)/i) || [])[1];
    const l = cur && byId[cur];
    if (!l) return;
    if (e.key === 'ArrowLeft' && lessons[l._i - 1]) location.hash = '#/lesson/' + lessons[l._i - 1].id;
    if (e.key === 'ArrowRight' && lessons[l._i + 1]) location.hash = '#/lesson/' + lessons[l._i + 1].id;
  });

  /* ---------------- boot ---------------- */

  buildNav();
  route();

  // sanity-check the hand-rolled crypto once, in the console, on load
  if (window.CL && CL.selfTest) {
    setTimeout(() => {
      try {
        const ok = CL.selfTest();
        if (!ok) console.warn('crypto-lite self-test FAILED — labs using hashes or signatures may be wrong.');
      } catch (e) { console.warn('crypto-lite self-test threw', e); }
    }, 0);
  }

  // small dev handle
  window.APP = { lessons: lessons, byId: byId, route: route, progress: () => done };
})();
