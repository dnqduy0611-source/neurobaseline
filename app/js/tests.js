/* NeuroBaseline – the four cognitive tasks.
   Timing: stimulus onset is stamped inside requestAnimationFrame (just before the frame is painted);
   responses use pointerdown and the event's own high-resolution timestamp. */
(function () {
  'use strict';
  var NB = window.NB, C = NB.config, ST = NB.stats;
  function t(k, v) { return NB.i18n.t(k, v); }
  function $(id) { return document.getElementById(id); }
  function stage() { return $('stage'); }

  // ---------- run control: every wait can be cancelled when the page is hidden ----------
  var run = { cancels: [], active: false, aborted: false }, seq = 0;
  function Aborted() { this.aborted = true; }
  function begin() { run = { cancels: [], active: true, aborted: false }; }
  function finish() { run.active = false; run.cancels = []; }
  function abort() {
    if (!run.active) return;
    run.aborted = true; var c = run.cancels; run.cancels = [];
    c.forEach(function (f) { try { f(); } catch (e) {} });
  }
  function wait(ms) {
    var r = run;
    return new Promise(function (res, rej) {
      if (r.aborted) return rej(new Aborted());
      var id = setTimeout(res, ms);
      r.cancels.push(function () { clearTimeout(id); rej(new Aborted()); });
    });
  }
  function evTime(e) { // prefer the event's own timestamp; fall back when a browser reports another clock
    var n = performance.now();
    return (e && typeof e.timeStamp === 'number' && e.timeStamp > 0 && Math.abs(e.timeStamp - n) < 500) ? e.timeStamp : n;
  }
  function waitDown(el, ms, pick) { // resolves {t, hit} on pointerdown, or null on timeout
    var r = run;
    return new Promise(function (res, rej) {
      if (r.aborted) return rej(new Aborted());
      var id = null;
      function h(e) {
        var hit = pick ? pick(e) : true; if (!hit) return;
        if (e.cancelable) e.preventDefault(); clean(); res({ t: evTime(e), hit: hit });
      }
      function clean() { el.removeEventListener('pointerdown', h); if (id) clearTimeout(id); }
      el.addEventListener('pointerdown', h);
      if (ms != null) id = setTimeout(function () { clean(); res(null); }, Math.max(0, ms));
      r.cancels.push(function () { clean(); rej(new Aborted()); });
    });
  }
  function showAt(el) { // make visible on the next frame; returns the onset time
    return new Promise(function (res) {
      var done = false;
      function f() { if (done) return; done = true; el.style.visibility = 'visible'; res(performance.now()); }
      requestAnimationFrame(f); setTimeout(f, 60); // fallback if frames are paused
    });
  }
  function expect(el, kind) { el.dataset.expect = kind; el.dataset.seq = String(++seq); } // also read by the QA bot

  // ---------- stage ----------
  function open() { stage().hidden = false; stage().setAttribute('role', 'region'); stage().setAttribute('aria-label', t('ui.activity')); $('app').hidden = true; document.body.classList.add('running'); }
  function close() { stage().hidden = true; stage().innerHTML = ''; $('app').hidden = false; document.body.classList.remove('running'); }
  function screen(html, buttons) { // instruction / choice screen; buttons = [[key, label, cssClass]]
    var el = stage();
    el.innerHTML = '<div class="instr">' + html + '<div class="instr-btns">' + buttons.map(function (b, i) {
      return '<button class="btn big ' + (b[2] || '') + '" data-k="' + b[0] + '" ' + (i === 0 ? 'data-expect="btn" data-seq="' + (++seq) + '"' : '') + ' disabled>' + b[1] + '</button>';
    }).join('') + '</div></div>';
    var bs = el.querySelectorAll('button[data-k]');
    var heading = el.querySelector('h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    setTimeout(function () { bs.forEach(function (b) { b.disabled = false; }); }, 700); // avoid an accidental tap carried over from the task
    return new Promise(function (res) {
      bs.forEach(function (b) { b.addEventListener('click', function () { res(b.dataset.k); }, { once: true }); });
    });
  }
  function instr(html, label) { return screen(html, [['go', label, 'primary']]); }

  // ---------- 1. Simple reaction time ----------
  async function rt(opts) {
    var cfg = C.rt, n = opts.trials, practice = !!opts.practice;
    stage().innerHTML = '<div class="area" id="tArea"><div class="fix" id="tFix">+</div><div class="stim rtstim" id="tStim"></div><div class="tmsg" id="tMsg"></div></div>';
    var area = $('tArea'), stim = $('tStim'), msg = $('tMsg');
    var trials = [], antic = 0, redo = 0, i = 0;
    begin();
    try {
      await wait(700);
      while (i < n) {
        stim.style.visibility = 'hidden'; expect(area, 'wait');
        var fore = cfg.foreMin + Math.random() * (cfg.foreMax - cfg.foreMin);
        var early = await waitDown(area, fore);
        if (early) {
          antic++; msg.textContent = t('rt.early'); await wait(900); msg.textContent = '';
          if (++redo <= 10) continue;
          trials.push({ i: i, fore: Math.round(fore), rt: null, early: true }); i++; continue;
        }
        var t0 = await showAt(stim); expect(area, 'tap');
        var r = await waitDown(area, cfg.timeout);
        stim.style.visibility = 'hidden'; expect(area, 'wait');
        var ms = r ? ST.round(r.t - t0, 1) : null;
        trials.push({ i: i, fore: Math.round(fore), rt: ms });
        if (practice) { msg.textContent = ms == null ? t('rt.miss') : Math.round(ms) + ' ms'; await wait(800); msg.textContent = ''; }
        i++;
      }
      await wait(300);
    } finally { finish(); }
    return { trials: trials, anticipations: antic };
  }

  // ---------- 2. Go / NoGo ----------
  function gngSeq(n, nNogo) { // no NoGo in the first 3 trials, never two NoGo in a row
    var nGo = n - nNogo, gaps = [];
    for (var g = 3; g <= nGo; g++) gaps.push(g);           // gap g = "after the g-th Go"
    var chosen = {}; ST.shuffle(gaps).slice(0, nNogo).forEach(function (g) { chosen[g] = true; });
    var out = [];
    for (var k = 1; k <= nGo; k++) { out.push(false); if (chosen[k]) out.push(true); }
    return out;
  }
  async function gng(opts) {
    var cfg = C.gng, practice = !!opts.practice, order = gngSeq(opts.trials, opts.nogo);
    stage().innerHTML = '<div class="area" id="tArea"><div class="fix">+</div><div class="stim go" id="tStim"></div><div class="tmsg" id="tMsg"></div></div>';
    var area = $('tArea'), stim = $('tStim'), msg = $('tMsg'), trials = [];
    begin();
    try {
      await wait(700);
      for (var i = 0; i < order.length; i++) {
        var nogo = order[i];
        stim.style.visibility = 'hidden'; stim.className = 'stim ' + (nogo ? 'nogo' : 'go'); expect(area, 'wait');
        await wait(cfg.itiMin + Math.random() * (cfg.itiMax - cfg.itiMin));
        var t0 = await showAt(stim); expect(area, nogo ? 'nogo' : 'go');
        var r = await waitDown(area, cfg.stimMs);
        stim.style.visibility = 'hidden';
        if (!r) r = await waitDown(area, cfg.windowMs - cfg.stimMs);
        expect(area, 'wait');
        trials.push({ i: i, nogo: nogo, rt: r ? ST.round(r.t - t0, 1) : null });
        if (practice) {
          var ok = nogo ? !r : !!r;
          msg.textContent = ok ? t('gng.ok') : (nogo ? t('gng.fa') : t('gng.miss'));
          msg.className = 'tmsg ' + (ok ? 'good' : 'bad'); await wait(800); msg.textContent = ''; msg.className = 'tmsg';
        }
      }
      await wait(300);
    } finally { finish(); }
    return { trials: trials };
  }

  // ---------- 3. Symbol–Digit ----------
  var SYMS = [
    '<circle cx="20" cy="20" r="12"/><path d="M8 20H32"/>',
    '<path d="M8 32H32M20 32V8"/>',
    '<path d="M12 8L30 20L12 32"/>',
    '<rect x="8" y="8" width="24" height="24"/><circle cx="20" cy="20" r="3" fill="currentColor"/>',
    '<path d="M10 8V32M10 14H30M10 26H30"/>',
    '<path d="M20 7L33 32H7Z"/>',
    '<path d="M8 32V19a12 12 0 0 1 24 0V32"/>',
    '<path d="M9 9L31 31M31 9L9 31"/>',
    '<path d="M8 10H32L8 30H32"/>'
  ];
  function sym(i) { return '<svg viewBox="0 0 40 40" class="sym" aria-hidden="true">' + SYMS[i] + '</svg>'; }
  async function sdmt(opts) { // opts: {seed, durationMs} for the timed test, or {seed, items} for practice
    var practice = opts.items != null, rng = ST.mulberry32(opts.seed);
    var perm = ST.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], rng);                 // perm[d-1] = symbol shown for digit d
    var key = '', pad = '';
    for (var d = 1; d <= 9; d++) {
      key += '<div class="kc"><div class="ks">' + sym(perm[d - 1]) + '</div><div class="kd">' + d + '</div></div>';
      pad += '<button class="pk" data-d="' + d + '">' + d + '</button>';
    }
    stage().innerHTML = '<div class="sd"><div class="sdbar"><i id="sdBar"></i></div><div class="sdkey">' + key + '</div>' +
      '<div class="sdmid"><div class="sdcur" id="sdCur"></div><div class="tmsg" id="tMsg"></div></div><div class="sdpad" id="sdPad">' + pad + '</div></div>';
    var cur = $('sdCur'), padEl = $('sdPad'), msg = $('tMsg'), bar = $('sdBar'), resps = [], prev = 0;
    begin();
    try {
      await wait(500);
      var start = performance.now();
      if (!practice) { bar.style.transition = 'width ' + opts.durationMs + 'ms linear'; requestAnimationFrame(function () { bar.style.width = '0%'; }); }
      else bar.parentNode.style.visibility = 'hidden';
      for (var k = 0; ; k++) {
        if (practice && k >= opts.items) break;
        var dg; do { dg = 1 + Math.floor(Math.random() * 9); } while (dg === prev); prev = dg;
        cur.innerHTML = sym(perm[dg - 1]); expect(padEl, 'sdmt:' + dg);
        var shown = performance.now(), remain = practice ? null : opts.durationMs - (shown - start);
        if (!practice && remain <= 0) break;
        var r = await waitDown(padEl, remain, function (e) { return e.target.closest ? e.target.closest('[data-d]') : null; });
        if (!r) break;
        var ans = +r.hit.dataset.d, ok = ans === dg;
        resps.push({ d: dg, ans: ans, ok: ok, rt: ST.round(r.t - shown, 1) });
        if (practice) { msg.textContent = ok ? t('sdmt.ok') : t('sdmt.bad', { d: dg }); msg.className = 'tmsg ' + (ok ? 'good' : 'bad'); await wait(900); msg.textContent = ''; }
      }
      expect(padEl, 'wait'); await wait(300);
    } finally { finish(); }
    return { resps: resps };
  }

  // ---------- 4. Picture memory (study at the start, recognition at the end) ----------
  // Target and foil come from the same category, so "it was a fruit" is not enough to answer.
  var POOL = [
    ['🍎', '🍐', '🍊', '🍋', '🍌', '🍇', '🍓', '🍉'], ['🥕', '🌽', '🍆', '🍅', '🥒'], ['🐎', '🐄', '🐑', '🐘', '🐒', '🐇'],
    ['🐓', '🦆', '🦉', '🐧'], ['🐟', '🐙', '🐬', '🦀'], ['🚗', '🚌', '🚲', '🚂', '⛵', '🚁'], ['🔨', '🔧', '🔑', '🔦'],
    ['🚪', '💡', '🛏', '🚿'], ['👕', '👟', '🎩', '👓'], ['🎸', '🎺', '🥁', '🎹'], ['⚽', '🏀', '🎾', '🏓'],
    ['🌳', '🌵', '🌻', '🍄'], ['🌙', '⭐', '⛅', '🌈'], ['🍞', '🧀', '🥚', '🍚'], ['📚', '📎', '📏', '📌'],
    ['📱', '💻', '📷', '⌚'], ['🏠', '🏰', '⛺', '🏢'], ['🍴', '🥄', '🍳', '☕']
  ];
  function memForm(seed) {
    var rng = ST.mulberry32(seed), cats = ST.shuffle(POOL, rng).slice(0, C.mem.targets), targets = [], probes = [];
    cats.forEach(function (c) {
      var it = ST.shuffle(c, rng);
      targets.push(it[0]); probes.push({ item: it[0], old: true }); probes.push({ item: it[1], old: false });
    });
    return { targets: ST.shuffle(targets, rng), probes: ST.shuffle(probes, rng) };
  }
  async function memStudy(form) {
    stage().innerHTML = '<div class="area" id="tArea"><div class="memitem" id="mItem"></div></div>';
    var area = $('tArea'), item = $('mItem');
    begin();
    try {
      await wait(600);
      for (var i = 0; i < form.targets.length; i++) {
        item.textContent = form.targets[i]; expect(area, 'watch');
        await wait(C.mem.studyMs); item.textContent = ''; await wait(C.mem.gapMs);
      }
    } finally { finish(); }
  }
  async function memRecog(form) {
    stage().innerHTML = '<div class="mem"><div class="memq">' + t('mem.q') + '</div><div class="memitem" id="mItem"></div>' +
      '<div class="mempad" id="mPad"><button class="mb yes" data-a="old">' + t('mem.seen') + '</button><button class="mb no" data-a="new">' + t('mem.notseen') + '</button></div></div>';
    var item = $('mItem'), pad = $('mPad'), resps = [];
    begin();
    try {
      await wait(500);
      for (var i = 0; i < form.probes.length; i++) {
        var p = form.probes[i];
        item.textContent = p.item; expect(pad, 'mem:' + (p.old ? 'old' : 'new'));
        var shown = performance.now();
        var r = await waitDown(pad, null, function (e) { return e.target.closest ? e.target.closest('[data-a]') : null; });
        var ans = r.hit.dataset.a;
        resps.push({ item: p.item, old: p.old, ans: ans, ok: (ans === 'old') === p.old, rt: ST.round(r.t - shown, 1) });
        item.textContent = ''; expect(pad, 'wait'); await wait(300);
      }
    } finally { finish(); }
    return { resps: resps };
  }

  NB.tests = {
    open: open, close: close, instr: instr, screen: screen, abort: abort, sym: sym,
    isAborted: function (e) { return !!(e && e.aborted); },
    rt: rt, gng: gng, sdmt: sdmt, memForm: memForm, memStudy: memStudy, memRecog: memRecog
  };
})();
