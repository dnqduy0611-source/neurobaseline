/* NeuroBaseline – screens and session flow. */
(function () {
  'use strict';
  var NB = window.NB, C = NB.config, I = NB.i18n, S = NB.store, ST = NB.stats, T = NB.tests;
  function t(k, v) { return I.t(k, v); }
  var RK = NB.risk;
  var ui = { screen: 'home', ind: 'rt', ctx: {}, prof: {}, lastId: null, agree: false, running: false, risk: {}, riskStep: 0, riskAgree: false, expRisk: false, expEeg: false };
  ui.profileStep = 0; ui.contextStep = 0;
  var advanceTimer = null, advancing = false, pendingAnswerNext = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function app() { return document.getElementById('app'); }

  function fmtDate(ms) { return new Date(ms).toLocaleDateString(I.lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function fmtShort(ms) { var d = new Date(ms); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); }
  function fmtVal(id, v) {
    if (!ST.isNum(v)) return '–';
    if (id === 'rt') return Math.round(v) + ' ms';
    if (id === 'gng') return Math.round(v) + '%';
    return String(Math.round(v * 10) / 10);
  }
  function evalNow() { return ST.evaluate(S.data.sessions, C, NB.now(), S.data.epoch || 0); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // ---------- shared pieces ----------
  function icon(name) {
    var paths = {
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
      history: '<path d="M4 4v5h5M4.5 8a8 8 0 1 1-.4 7"/><path d="M12 7v5l3 2"/>',
      settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
      mem: '<rect x="4" y="3" width="13" height="16" rx="3"/><path d="M8 21h9a3 3 0 0 0 3-3V8M8 8h5M8 12h3"/>',
      rt: '<path d="m13 2-8 12h7l-1 8 8-12h-7Z"/>',
      gng: '<circle cx="8" cy="8" r="5"/><rect x="12" y="12" width="9" height="9" rx="2"/>',
      sdmt: '<rect x="3" y="3" width="7" height="7" rx="2"/><circle cx="17" cy="7" r="4"/><path d="m6.5 14 4 7h-8Z"/><path d="M14 17h7m-3.5-3.5v7"/>',
      health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
      eeg: '<path d="M3 12h3l2-6 3 12 3-9 2 3h5"/>',
      lang: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      file: '<path d="M12 3v12m0 0-4-4m4 4 4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>',
      shield: '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z"/><path d="m9 12 2 2 4-4"/>',
      hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7c-2.6 0-4.2-1.3-5.6-3.6L4 14.5A1.5 1.5 0 0 1 6.5 13L8 15"/>',
      eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
    };
    return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }
  function waveArt() { return '<svg class="wave-art" viewBox="0 0 400 300" fill="none" aria-hidden="true"><path d="M-30 180C75 80 125 265 240 160S390 125 450 130V330H-30Z" fill="#aabaff"/><path d="M-30 215C75 115 125 300 240 195S390 160 450 165V330H-30Z" fill="#718eff"/><path d="M-30 250C75 150 125 335 240 230S390 195 450 200V330H-30Z" fill="#4168fc"/></svg>'; }
  function bottomNav() {
    return '<nav class="app-nav" aria-label="' + t('ui.navigation') + '">' + [['home', 'ui.home'], ['history', 'home.history'], ['settings', 'home.settings']].map(function (item) {
      return '<button data-act="go" data-v="' + item[0] + '"' + (ui.screen === item[0] ? ' class="active" aria-current="page"' : '') + '>' + icon(item[0]) + '<span>' + t(item[1]) + '</span></button>';
    }).join('') + '</nav>';
  }
  function head() {
    return '<header class="top"><a class="brand" href="index.html" aria-label="NeuroBaseline"><span class="brand-mark" aria-hidden="true">n<span>·</span></span>NeuroBaseline</a><button class="language" data-act="lang2" data-v="' + (I.lang === 'vi' ? 'en' : 'vi') + '">' + t('ui.lang') + '</button><div class="tag">' + t('app.tag') + '</div></header>' +
      (S.mode === 'demo' ? '<div class="banner demo"><span>' + t('home.demo') + '</span><button class="text-btn" data-act="demo">' + t('set.demo.off') + '</button></div>' : '') +
      (!S.okWrite ? '<div class="banner warn">' + t('home.nosave') + '</div>' : '');
  }
  function ring(e) { // progress towards the usual level while it is being recorded, then the current status. Decorative: the heading says the same.
    var R = 22, L = 2 * Math.PI * R, building = e.phase !== 'monitoring', frac = building ? (e.total ? e.done / e.total : 0) : 1;
    var label = building ? e.done + '/' + e.total : ({ green: '✓', yellow: '↻', red: '!' }[e.light] || '–');
    return '<svg class="ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="ring-track" cx="28" cy="28" r="' + R + '"/>' +
      (frac > 0 ? '<circle class="ring-arc" cx="28" cy="28" r="' + R + '" stroke-dasharray="' + (L * frac).toFixed(1) + ' ' + L.toFixed(1) + '" transform="rotate(-90 28 28)"/>' : '') +
      '<text x="28" y="33" text-anchor="middle">' + label + '</text></svg>';
  }
  function statusCard(e) {
    var key = e.phase !== 'monitoring' ? (e.rebased ? 'rebase' : e.phase) : (e.light || 'ready');   // phase: new | building | monitoring
    var h = '<section class="card status ' + (e.light || 'none') + '">' + ring(e) + '<div class="grow"><h2>' +
      t('st.' + key + '.t', { done: e.done, total: e.total }) + '</h2><p>' + t('st.' + key + '.x', { total: e.total }) + '</p>';
    var a = e.last;
    if (e.light && a && a.light !== 'green') {
      h += '<div class="why"><b>' + t('why.title') + '</b><ul>';
      a.exceed.forEach(function (id) {
        var x = a.ind[id];
        h += '<li>' + t('why.line', { name: t('ind.' + id), v: fmtVal(id, x.value), base: fmtVal(id, x.band.mean), lim: fmtVal(id, x.band.limit) }) + '</li>';
      });
      a.reasons.forEach(function (r) {
        if (r === 'context') h += '<li>' + t('st.ctx') + '</li>';
        else if (r === 'trend' || r === 'trendWatch') {                 // name the areas that carry the trend
          var ids = Object.keys(a.trend.parts).sort(function (p, q) { return a.trend.parts[q] - a.trend.parts[p]; });
          var strong = ids.filter(function (id) { return a.trend.parts[id] >= 1; });
          h += '<li>' + t('why.' + r, { n: a.trend.months, names: (strong.length ? strong : ids.slice(0, 1)).map(function (id) { return t('ind.' + id); }).join(', ') }) + '</li>';
        } else h += '<li>' + t('why.' + r) + '</li>';
      });
      h += '</ul></div>';
      var rk = riskEval(); // risk context next to a yellow or red light
      if (rk && rk.present.length) h += '<p class="small">' + t('risk.status', { n: rk.present.length }) + '</p><button class="btn" data-act="riskView">' + t('risk.card.view') + '</button>';
      if (a.light === 'red') h += '<button class="btn" data-act="go" data-v="settings">' + t('st.red.file') + '</button>';   // the file the clinician view reads
    }
    return h + '</div></section>';
  }
  function statTiles(e) { // the latest value and the usual level of the indicator on show
    var pts = e.sessions.filter(function (a) { return a.role !== 'previous' && a.role !== 'control' && ST.isNum(a.s.measures[ui.ind]); });
    if (!pts.length) return '';
    var last = pts[pts.length - 1], b = e.bands[ui.ind];
    return '<div class="stat-tiles"><div class="stat-tile accent"><span>' + t('ui.stat.last') + '</span><b>' + fmtVal(ui.ind, last.s.measures[ui.ind]) + '</b><small>' + fmtShort(Date.parse(last.s.startedAt)) + '</small></div>' +
      '<div class="stat-tile"><span>' + t('role.baseline') + '</span><b>' + (b ? fmtVal(ui.ind, b.mean) : '–') + '</b><small>' +
      (b ? t('ui.stat.range', { lo: fmtVal(ui.ind, Math.min(b.lo, b.hi)), hi: fmtVal(ui.ind, Math.max(b.lo, b.hi)) }) : t('ui.stat.none')) + '</small></div></div>';
  }
  function chartCard(e) {
    var tabs = C.indicators.map(function (ind) {
      return '<button class="tab' + (ui.ind === ind.id ? ' on' : '') + '" aria-pressed="' + (ui.ind === ind.id) + '" data-act="ind" data-v="' + ind.id + '">' + t('ind.' + ind.id) + '</button>';
    }).join('');
    var col = NB.chart.COL;
    function lg(c, k, hollow) { return '<span class="lg"><i style="' + (hollow ? 'background:#fff;border:2px solid ' + c : 'background:' + c) + '"></i>' + t(k) + '</span>'; }
    return '<section class="card"><h3>' + t('home.chart') + '</h3><div class="tabs" role="group" aria-label="' + t('home.chart') + '">' + tabs + '</div>' + statTiles(e) + '<div id="chartHost"></div>' +
      '<p class="muted small">' + t('ind.' + ui.ind + '.d') + '</p><div class="legend">' + lg(col.fam, 'lg.fam') + lg(col.base, 'lg.base') + lg(col.fu, 'lg.fu') +
      lg(col.out, 'lg.out') + lg(col.ctl, 'lg.ctl') + lg(col.fu, 'lg.flag', true) + '<span class="lg"><i class="bandkey"></i>' + t('lg.band') + '</span></div></section>';
  }
  function seg(k, opts) { // segmented answer
    return '<div class="seg">' + opts.map(function (o) {
      return '<button data-act="ctx" data-k="' + k + '" data-v="' + o[0] + '" class="' + (String(ui.ctx[k]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  // ---------- screens ----------
  var V = {};
  V.lang = function () {
    return '<div class="center language-screen"><span class="brand-mark" aria-hidden="true">n<span>·</span></span><div class="eyebrow">NeuroBaseline</div><h1>Một chút thời gian<br>cho chính bạn.</h1><p class="muted">Choose your language · Chọn ngôn ngữ</p>' +
      I.langs.map(function (l) { return '<button class="btn big" data-act="lang" data-v="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>';
  };
  V.intro = function () {
    return head() + '<div class="welcome-layout"><main class="welcome"><div class="eyebrow">' + t('ui.personal') + '</div><h1>' + t('ui.welcome') + '</h1><p class="welcome-lead">' + t('ui.welcome.x') + '</p><div class="welcome-meta"><span>' + t('ui.minutes') + '</span><span>' + t('ui.private') + '</span></div><button class="btn big primary" data-act="go" data-v="consent">' + t('ui.begin') + ' <span aria-hidden="true">→</span></button><button class="btn demo-btn" data-act="demo">' + t('ui.demo') + '</button><p class="small muted">' + t('intro.note') + '</p></main><div class="welcome-visual" aria-hidden="true"><div class="visual-orbit"><span>n·</span></div>' + waveArt() + '</div></div><section class="journey"><h2>' + t('ui.journey') + '</h2>' + [1, 2, 3].map(function (n) { return '<div><span class="journey-num">0' + n + '</span><b>' + t('ui.j' + n) + '</b><p>' + t('ui.j' + n + '.x') + '</p></div>'; }).join('') + '</section>';
  };
  V.consent = function () {
    return head() + '<section class="card"><h1>' + t('consent.title') + '</h1><ul class="loose">' + t('consent.body') + '</ul>' +
      '<label class="check"><input type="checkbox" id="agree"' + (ui.agree ? ' checked' : '') + '> <span>' + t('consent.check') + '</span></label>' +
      '<button class="btn big primary" data-act="consent"' + (ui.agree ? '' : ' disabled') + ' id="consentBtn">' + t('btn.continue') + '</button></section>';
  };
  V.profile = function () {
    var qs = profileQuestions(), k = ui.profileStep, q = qs[k];
    if (!q) return flow('ui.profile', 'ui.profile.x', 3, 3, '<h1 tabindex="-1" id="questionTitle">' + t('ui.review') + '</h1><p class="muted">' + t('ui.review.x') + '</p><div class="answer-review">' + qs.map(function (item, i) { return '<div><span>' + t(item.label) + '</span><b>' + esc(answerLabel(item, ui.prof[item.id])) + '</b><button class="text-btn" data-act="profileEdit" data-v="' + i + '">' + t('ui.edit') + '</button></div>'; }).join('') + '</div><button class="btn big primary" data-act="profile">' + t('btn.continue') + ' <span aria-hidden="true">→</span></button>', '<span class="small muted">' + t('profile.code') + ' <b class="code">' + esc(S.data.code) + '</b></span>');
    return flow('ui.profile', 'ui.profile.x', k, qs.length, '<h1 id="questionTitle" tabindex="-1">' + t(q.title) + '</h1><p class="question-hint">' + t(q.hint) + '</p>' + choices(q, ui.prof[q.id], 'profileAnswer') + '<p class="auto-hint">' + t('ui.answerHint') + '</p>', flowBack('profileBack', k));
  };
  function profileQuestions() {
    return [
      { id: 'ageBand', label: 'profile.age', title: 'ui.age', hint: 'ui.age.h', compact: true, opts: ['18-29', '30-39', '40-49', '50-59', '60-69', '70+'].map(function (a) { return [a, a.replace('-', '–')]; }) },
      { id: 'edu', label: 'profile.edu', title: 'ui.edu', hint: 'ui.edu.h', opts: ['1', '2', '3', '4'].map(function (v) { return [v, t('edu.' + v)]; }) },
      { id: 'hand', label: 'profile.hand', title: 'ui.hand', hint: 'ui.hand.h', compact: true, opts: [['R', t('hand.R')], ['L', t('hand.L')]] }
    ];
  }
  function answerLabel(q, v) { var o = q.opts.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : '–'; }
  function choices(q, value, action) {
    return '<div class="answer-options' + (q.compact ? ' compact' : '') + '" role="group" aria-labelledby="questionTitle">' + q.opts.map(function (o, i) {
      var on = String(value) === String(o[0]);
      return '<button class="answer' + (on ? ' selected' : '') + '" aria-pressed="' + on + '" data-act="' + action + '" data-k="' + q.id + '" data-v="' + o[0] + '"><span class="answer-index" aria-hidden="true">' + (i + 1) + '</span><span>' + o[1] + '</span><span class="answer-check" aria-hidden="true">' + (on ? '✓' : '→') + '</span></button>';
    }).join('') + '</div>';
  }
  function flowBack(action, k) { return '<button class="text-btn" data-act="' + action + '">← ' + t(k ? 'ui.back' : 'btn.back') + '</button>'; }
  function flow(title, desc, k, n, body, footer) {
    return head() + '<main class="flow-layout"><aside class="flow-aside"><div class="eyebrow">NeuroBaseline / ' + t('ui.personal') + '</div><h2>' + t(title) + '</h2><p>' + t(desc) + '</p><div class="flow-track" aria-hidden="true">' + Array.from({ length: n }, function (_, i) { return '<i class="' + (i < k ? 'done' : i === k ? 'current' : '') + '"></i>'; }).join('') + '</div><div class="flow-count">' + (k < n ? t('ui.step', { k: k + 1, n: n }) : n + ' / ' + n) + '</div><div class="privacy-caption"><span aria-hidden="true">◌</span>' + t('ui.private') + '</div></aside><section class="question-stage"><div class="question-content">' + body + '</div><footer class="question-footer">' + (footer || '') + '</footer></section></main>';
  }
  function autoAdvance(el, next, event) {
    if (advancing) return;
    advancing = true;
    var group = el.parentElement;
    group.querySelectorAll('button').forEach(function (b) { var on = b === el; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('.answer-check').textContent = on ? '✓' : '→'; });
    if ((event && event.detail === 0) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      advancing = false; pendingAnswerNext = next;
      var hint = group.parentElement.querySelector('.auto-hint');
      var message = t('ui.manualHint', { answer: el.children[1].textContent });
      if (hint) hint.textContent = message;
      if (!group.parentElement.querySelector('[data-act="answerNext"]')) group.insertAdjacentHTML('afterend', '<button class="btn primary" data-act="answerNext">' + t('ui.next') + ' →</button>');
      NB.access.announce(message); return;
    }
    advanceTimer = setTimeout(function () { advancing = false; advanceTimer = null; next(); }, 280);
  }
  V.home = function () {
    var e = evalNow(), now = NB.now(), due = e.nextDue, days = Math.ceil((due - now) / 864e5);
    var h = head() + '<main class="home-layout tiles"><div class="home-heading"><div class="eyebrow">' + t('ui.personal') + '</div><h1>' + t('ui.activity') + '</h1><p class="muted">' + t('ui.activity.x') + '</p></div>' +
      '<section class="card session-card">' + waveArt() + '<div class="lbl">' + t('home.next') + '</div><div class="bigtxt">' +
      (due <= now ? t('home.dueNow') : t('ui.dueIn', { n: '<span class="due-num">' + days + '</span>' }) + '<span class="due-date">' + fmtDate(due) + '</span>') + '</div>' +
      '<div class="session-meta"><span>' + t('ui.minutes') + '</span><span>' + t('ui.session') + '</span></div>' +
      '<button class="btn big primary hero-cta" data-act="start"><span>' + t('home.start') + '</span><span class="cta-arrow" aria-hidden="true">→</span></button><p class="muted small">' + t('home.tip') + '</p></section>' +
      '<aside class="home-status">' + statusCard(e) + '<p class="privacy-caption">' + t('ui.private') + '</p></aside>' + activityTiles();
    if (e.sessions.some(function (a) { return a.role !== 'previous'; })) h += chartCard(e);
    h += '<div class="extra-tiles">' + extraTile('health', riskCard()) + (NB.eegUi ? extraTile('eeg', NB.eegUi.card()) : '') + '</div>';
    return h + '</main>';
  };
  function activityTiles() { // the four tasks of a session, in the order they are done
    return '<section class="activity-grid" aria-label="' + t('ui.session') + '">' + ['mem', 'rt', 'gng', 'sdmt'].map(function (k, n) {
      return '<div class="tile"><span class="activity-icon">' + icon(k) + '</span><span class="tile-num" aria-hidden="true">0' + (n + 1) + '</span><b>' + t('ui.' + k) + '</b></div>';
    }).join('') + '</section>';
  }
  function extraTile(name, card) { return '<div class="extra-tile"><span class="activity-icon">' + icon(name) + '</span>' + card + '</div>'; }
  function setHead(name, key) { return '<div class="set-head"><span class="activity-icon">' + icon(name) + '</span><h3>' + t(key) + '</h3></div>'; }
  V.device = function () { // the baseline was recorded on another device
    return head() + '<section class="card"><h1>' + t('dev.title') + '</h1><p>' + t('dev.lead') + '</p>' +
      '<button class="btn big primary" data-act="go" data-v="home">' + t('dev.back') + '</button>' +
      '<button class="btn big" data-act="devSwitch">' + t('dev.switch') + '</button><p class="muted small">' + t('dev.switch.x', { n: C.baseline.n }) + '</p>' +
      '<button class="btn link" data-act="devSame">' + t('dev.same') + '</button></section>';
  };
  V.redflags = function () {
    return head() + '<section class="card"><h1>' + t('rf.title') + '</h1><p>' + t('rf.lead') + '</p><ul class="loose"><li>' + t('rf.1') + '</li><li>' + t('rf.2') + '</li><li>' + t('rf.3') + '</li><li>' + t('rf.4') +
      '</li></ul><button class="btn big primary" data-act="rfNone">' + t('rf.none') + '</button><button class="btn big danger" data-act="rfSome">' + t('rf.some') + '</button>' +
      '<button class="btn link" data-act="go" data-v="home">' + t('btn.back') + '</button></section>';
  };
  V.emergency = function () {
    return head() + '<section class="card emergency"><h1>' + t('em.title') + '</h1><p>' + t('em.body') + '</p><p class="muted">' + t('em.note') + '</p><button class="btn big" data-act="go" data-v="home">' + t('btn.home') + '</button></section>';
  };
  V.accessCheck = function () {
    return head() + '<main class="card"><h1>' + t('ui.access.title') + '</h1><p>' + t('ui.access.body') + '</p><p class="note">' + t('ui.access.light') + '</p><button class="btn big primary" data-act="accessContinue">' + t('ui.access.yes') + '</button><button class="btn" data-act="accessUnable">' + t('ui.access.no') + '</button><button class="btn link" data-act="go" data-v="home">' + t('btn.back') + '</button></main>';
  };
  V.accessHelp = function () {
    return head() + '<main class="card"><h1>' + t('ui.access.help') + '</h1><p>' + t('ui.access.help.body') + '</p><p class="note">' + t('ui.access.notstarted') + '</p><button class="btn primary" data-act="go" data-v="home">' + t('btn.home') + '</button></main>';
  };
  V.context = function () {
    var yn = [['0', t('btn.no')], ['1', t('btn.yes')]], qs = [
      { id: 'sleep', title: 'ctx.sleep', opts: [['poor', t('ctx.sleep.poor')], ['ok', t('ctx.sleep.ok')], ['good', t('ctx.sleep.good')]] },
      { id: 'unwell', title: 'ctx.unwell', opts: yn, compact: true },
      { id: 'mood', title: 'ctx.mood', opts: [['low', t('ctx.mood.low')], ['ok', t('ctx.mood.ok')], ['good', t('ctx.mood.good')]] },
      { id: 'med', title: 'ctx.med', opts: yn, compact: true }
    ], k = ui.contextStep, q = qs[k];
    if (!q) return flow('ui.today', 'ui.today.x', 4, 4, '<h1 id="questionTitle" tabindex="-1">' + t('ui.ready') + '</h1><p class="question-hint">' + t('ui.ready.x') + '</p><p class="note">' + t('ctx.setup') + '</p>' + activityList() + '<button class="btn big primary" data-act="begin">' + t('btn.start') + ' <span aria-hidden="true">→</span></button>', flowBack('contextBack', k));
    return flow('ui.today', 'ui.today.x', k, qs.length, '<h1 id="questionTitle" tabindex="-1">' + t(q.title) + '</h1>' + choices(q, ui.ctx[q.id], 'contextAnswer') + '<p class="auto-hint">' + t('ui.answerHint') + '</p>', flowBack('contextBack', k));
  };
  function activityList() { return '<div class="activity-list">' + ['mem', 'rt', 'gng', 'sdmt'].map(function (k) { return '<div><span class="activity-icon">' + icon(k) + '</span>' + t('ui.' + k) + '</div>'; }).join('') + '</div>'; }
  function measureRows(a) {
    var h = '<table class="mt">';
    C.indicators.forEach(function (ind) {
      var v = a.s.measures[ind.id]; if (!ST.isNum(v)) return;
      var x = a.ind[ind.id], chip;
      if (a.role === 'familiarization') chip = '<span class="chip">' + t('res.warm') + '</span>';
      else if (!x) chip = '<span class="chip">' + t('res.nobase') + '</span>';
      else if (x.exceeds) chip = '<span class="chip bad">' + t('res.worse') + '</span>';
      else if (x.better) chip = '<span class="chip good">' + t('res.better') + '</span>';
      else chip = '<span class="chip ok">' + t('res.within') + '</span>';
      h += '<tr><td>' + t('ind.' + ind.id) + '</td><td class="num">' + fmtVal(ind.id, v) + '</td><td>' + chip + '</td></tr>';
    });
    return h + '</table>';
  }
  V.result = function () {
    var e = evalNow(), a = e.sessions.filter(function (x) { return x.s.id === ui.lastId; })[0];
    if (!a) return V.home();
    var h = head() + '<h1 class="pad">' + t('res.title') + '</h1>';
    if (a.role === 'control') {
      var has = Object.keys(a.ind).length > 0;
      h += '<section class="card status ' + (has ? (a.detected ? 'ctl' : 'none') : 'none') + '"><div class="dot"></div><div class="grow"><h2>' + t('res.ctl.t') + '</h2><p>' +
        (has ? t(a.detected ? 'res.ctl.yes' : 'res.ctl.no') : t('res.ctl.need')) + '</p></div></section>';
    } else h += statusCard(e);
    h += '<section class="card">' + measureRows(a) + '</section>';
    return h + '<p class="note pad">' + t('res.disclaimer') + '</p><div class="pad"><button class="btn big primary" data-act="go" data-v="home">' + t('btn.home') + '</button></div>';
  };
  V.history = function () {
    var e = evalNow(), h = head() + '<h1 class="pad">' + t('hist.title') + '</h1>';
    if (!e.sessions.length) return h + '<p class="muted pad">' + t('hist.none') + '</p>' + backBtn();
    h += chartCard(e) + '<section class="card scroll"><table class="ht"><tr><th>' + t('hist.date') + '</th><th></th>' +
      C.indicators.map(function (i) { return '<th>' + t('ind.' + i.id) + '</th>'; }).join('') + '</tr>';
    e.sessions.slice().reverse().forEach(function (a) {
      h += '<tr><td>' + fmtShort(Date.parse(a.s.startedAt)) + '</td><td><span class="ldot ' + (a.light || (a.role === 'control' ? 'ctl' : 'none')) + '" aria-hidden="true"></span>' + t('role.' + a.role) + (a.light ? '<span class="hist-light"> · ' + t('hist.l.' + a.light) + '</span>' : '') + '</td>' +
        C.indicators.map(function (i) { var x = a.ind[i.id]; return '<td class="num' + (x && x.exceeds ? ' out' : '') + '">' + fmtVal(i.id, a.s.measures[i.id]) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</table></section>' + backBtn();
  };
  function backupCard() { // a full copy the person keeps, and the way back from it
    var m = ui.restoreMsg, msg = m ? '<p id="restoreMsg" class="small ' + (m.ok ? 'msg-ok' : 'msg-err') + '" role="status">' + esc(m.text) + '</p>' : '';
    if (S.mode === 'demo') return '<section class="card">' + setHead('shield', 'set.backup.t') + '<p class="muted">' + t('set.backup.demo') + '</p></section>';
    return '<section class="card">' + setHead('shield', 'set.backup.t') + '<p class="muted">' + t('set.backup.x') + '</p><button class="btn" data-act="backup">' + t('set.backup.dl') + '</button>' +
      '<input type="file" id="restoreFile" accept=".json,application/json" hidden><button class="btn" data-act="restorePick">' + t('set.restore') + '</button>' + msg + '</section>';
  }
  function backBtn() { return '<div class="pad"><button class="btn big" data-act="go" data-v="home">' + t('btn.home') + '</button></div>'; }
  V.settings = function () {
    var canShare = !!(navigator.share && navigator.canShare);
    return head() + '<h1 class="pad">' + t('set.title') + '</h1>' +
      '<section class="card">' + setHead('lang', 'set.lang') + '<div class="seg">' + I.langs.map(function (l) {
        return '<button data-act="lang2" data-v="' + l[0] + '" class="' + (I.lang === l[0] ? 'on' : '') + '">' + l[1] + '</button>';
      }).join('') + '</div></section>' +
      '<section class="card">' + setHead('file', 'set.export.t') + '<p class="muted">' + t('set.export.x') + '</p><p class="muted">' + t('profile.code') + ': <b class="code">' + S.data.code + '</b></p>' +
      (S.data.risk ? '<label class="check"><input type="checkbox" id="expRisk"' + (ui.expRisk ? ' checked' : '') + '> <span>' + t('set.expRisk') + '</span></label>' : '') +
      ((S.data.eeg || []).length ? '<label class="check"><input type="checkbox" id="expEeg"' + (ui.expEeg ? ' checked' : '') + '> <span>' + t('set.expEeg') + '</span></label>' : '') +
      '<button class="btn" data-act="download">' + t('set.download') + '</button>' + (canShare ? '<button class="btn" data-act="share">' + t('set.share') + '</button>' : '') +
      '<button class="btn" data-act="copy" id="copyBtn">' + t('set.copy') + '</button></section>' +
      backupCard() +
      '<section class="card">' + setHead('hand', 'set.pilot.t') + '<p class="muted">' + t('set.ctl.x') + '</p><button class="btn" data-act="control">' + t('set.ctl') + '</button></section>' +
      '<section class="card">' + setHead('eye', 'set.demo.t') + '<p class="muted">' + t('set.demo.x') + '</p><button class="btn" data-act="demo">' + t(S.mode === 'demo' ? 'set.demo.off' : 'set.demo.on') + '</button></section>' +
      '<section class="card"><button class="btn danger" data-act="reset">' + t('set.reset') + '</button><p class="muted small">' + t('set.about', { v: C.version }) + '</p><p class="small"><a href="clinician.html">' + t('set.clin') + '</a></p></section>' + backBtn();
  };

  // ---------- risk profile (Tier 2a) ----------
  function riskEval() { return S.data.risk ? RK.evaluate(S.data.risk.answers, S.data.profile) : null; }
  function riskCard() {
    var r = riskEval();
    return '<section class="card"><h3>' + t('risk.card.t') + '</h3>' + (r
      ? '<p class="muted">' + (r.unknown.length ? t('ui.health.card.partial', { date: fmtShort(Date.parse(S.data.risk.updatedAt)) }) : t('risk.card.done', { date: fmtShort(Date.parse(S.data.risk.updatedAt)), n: r.present.length })) + '</p><button class="btn" data-act="riskView">' + t('risk.card.view') + '</button>'
      : '<p class="muted">' + t('risk.card.none') + '</p><button class="btn" data-act="go" data-v="riskIntro">' + t('risk.card.start') + '</button>') + '</section>';
  }
  V.riskIntro = function () {
    return head() + '<section class="card"><h1>' + t('risk.intro.t') + '</h1><p>' + t('risk.intro.p') + '</p><ul class="loose"><li>' + t('risk.intro.b1') + '</li><li>' + t('risk.intro.b2') +
      '</li><li>' + t('risk.intro.b3') + '</li><li>' + t('risk.intro.b4') + '</li></ul><label class="check"><input type="checkbox" id="riskAgree"' + (ui.riskAgree ? ' checked' : '') + '> <span>' +
      t('risk.intro.check') + '</span></label><button class="btn big primary" data-act="riskBegin" id="riskBtn"' + (ui.riskAgree ? '' : ' disabled') + '>' + t('btn.continue') +
      '</button><button class="btn link" data-act="go" data-v="home">' + t('btn.back') + '</button></section>';
  };
  V.riskForm = function () {
    var qs = riskQuestions(), k = ui.riskStep, q = qs[k], a = ui.risk, body;
    if (!q) {
      body = '<h1 id="questionTitle" tabindex="-1">' + t('ui.health.done') + '</h1><p class="question-hint">' + t('ui.health.count', { n: Object.keys(a).length, total: qs.length }) + '</p><button class="btn big primary" data-act="riskSave">' + t('ui.health.save') + '</button>';
    } else {
      body = '<div class="eyebrow">' + t('risk.g.' + q.group) + ' · ' + t('ui.optional') + '</div>' + (q.scale ? '<p class="question-hint">' + t('q.phq.lead') + '</p>' : '') + '<h1 id="questionTitle" tabindex="-1">' + t('q.' + q.id) + '</h1>';
      var hint = t('q.' + q.id + '.h');
      if (hint !== 'q.' + q.id + '.h') body += '<p class="question-hint">' + hint + '</p>';
      if (q.type === 'num') {
        var unit = q.id === 'height' ? 'cm' : 'kg';
        body += '<form id="riskNumberForm" novalidate><label class="number-answer"><span class="sr-only">' + t('q.' + q.id) + '</span><input id="riskNumber" type="number" step="any" inputmode="decimal" data-rnum="' + q.id + '" min="' + q.min + '" max="' + q.max + '" value="' + esc(a[q.id]) + '" aria-describedby="numberHint numberError"><span>' + unit + '</span></label><p id="numberHint" class="small muted">' + t('ui.number.h', { min: q.min, max: q.max, unit: unit }) + '</p><p id="numberError" class="field-error" aria-live="polite"></p><button class="btn primary" type="submit">' + t('ui.next') + ' →</button></form>';
      } else body += choices(q, a[q.id], 'rq') + '<p class="auto-hint">' + t('ui.answerHint') + '</p>';
    }
    return flow('ui.health', 'ui.health.x', k, qs.length, body, flowBack('riskBack', k) + (q ? '<button class="text-btn" data-act="riskSkip">' + t('ui.skip') + '</button>' : ''));
  };
  function riskQuestions() {
    var out = [];
    RK.GROUPS.forEach(function (g) { g.items.forEach(function (item) {
      var q = Object.assign({}, item, { group: g.id });
      if (q.type !== 'num') q.opts = q.type === 'yn' ? [['yes', t('opt.yes')], ['no', t('opt.no')], ['unsure', t('opt.unsure')]] : q.opts.map(function (o) { return [o, t(q.scale ? 'q.phq.' + o : 'q.' + q.id + '.' + o)]; });
      out.push(q);
    }); });
    return out;
  }
  V.riskSum = function () {
    var r = riskEval(); if (!r) return V.riskIntro();
    function names(ids) { return ids.map(function (id) { return t('f.' + id); }).join(', '); }
    function row(k, ids) { return ids.length ? '<p><span class="lbl">' + t(k) + '</span><br>' + names(ids) + '</p>' : ''; }
    var assessedTotal = r.factors.filter(function (f) { return f.status !== 'notassessed'; }).length;
    var h = head() + '<h1 class="pad">' + t('risk.sum.t') + '</h1><section class="card"><p class="bigtxt">' +
      (r.assessed < assessedTotal ? t('ui.health.partial', { m: r.assessed, total: assessedTotal }) : r.present.length ? t('risk.sum.lead', { n: r.present.length, m: r.assessed }) : t('risk.sum.none')) + '</p></section>';
    if (r.present.length) h += '<section class="card"><h3>' + t('risk.sum.act') + '</h3>' + r.present.map(function (id) {
      return '<div class="fact"><b>' + t('f.' + id) + '</b><p>' + t('a.' + id) + '</p></div>';
    }).join('') + '</section>';
    var c = r.context, notes = (c.snore ? '<li>' + t('risk.ctx.snore') + '</li>' : '') + (c.shortSleep ? '<li>' + t('risk.ctx.sleep') + '</li>' : '') + (c.family ? '<li>' + t('risk.ctx.fam') + '</li>' : '');
    if (notes) h += '<section class="card"><h3>' + t('risk.sum.ctx') + '</h3><ul class="loose">' + notes + '</ul></section>';
    h += '<section class="card">' + row('risk.sum.managed', r.managed) + row('risk.sum.absent', r.absent) + row('risk.sum.unknown', r.unknown) + row('risk.sum.na', ['airpollution']) + '</section>';
    var L = r.libra;
    h += '<details class="card"><summary>' + t('risk.sum.clin') + '</summary><p>' + (L.complete ? t('risk.libra.score', { s: L.score.toFixed(1) }) : t('risk.libra.incomplete', { a: L.answered, s: L.score.toFixed(1) })) + '</p>' +
      (r.bmi != null || r.phq2 != null ? '<p class="muted small">' + (r.bmi != null ? 'BMI ' + r.bmi : '') + (r.bmi != null && r.phq2 != null ? ' · ' : '') + (r.phq2 != null ? 'PHQ-2 ' + r.phq2 : '') + '</p>' : '') +
      '<table class="mt small">' + L.items.map(function (it) {
        return '<tr><td>' + t('l.' + it.id) + '</td><td class="num">' + (it.weight > 0 ? '+' : '−') + Math.abs(it.weight).toFixed(1) + '</td><td class="num">' +
          (it.on === null ? '<span class="chip">' + t('l.na') + '</span>' : it.on ? '<span class="chip ' + (it.weight > 0 ? 'bad' : 'ok') + '">' + t('opt.yes') + '</span>' : '<span class="chip">' + t('opt.no') + '</span>') + '</td></tr>';
      }).join('') + '</table><p class="muted small">' + t('risk.libra.note') + '</p></details>';
    return h + '<p class="note pad">' + t('risk.disclaimer') + '</p><div class="pad"><button class="btn" data-act="riskEdit">' + t('risk.edit') + '</button></div>' + backBtn();
  };

  function render() {
    NB.access.clear();
    var nav = ['home', 'history', 'settings', 'riskSum', 'eeg', 'eegResult'].indexOf(ui.screen) >= 0;
    app().innerHTML = '<div class="wrap screen-' + ui.screen + (nav ? ' has-nav' : '') + '">' + (V[ui.screen] || V.home)() + (nav ? bottomNav() : '') + '</div>';
    var host = document.getElementById('chartHost');
    if (host) NB.chart.render(host, evalNow(), ui.ind);
    NB.access.tables(app());
  }
  function go(s) {
    if (advanceTimer) clearTimeout(advanceTimer);
    advanceTimer = null; advancing = false; pendingAnswerNext = null;
    ui.screen = s; render(); window.scrollTo(0, 0);
    var title = document.getElementById('questionTitle') || app().querySelector('h1');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  }

  // ---------- session runner ----------
  function hd(k, n) { return '<div class="part">' + t('run.part', { k: k, n: n }) + '</div>'; }
  var PART = {
    memStudy: async function (sess, run, first, h) {
      await T.instr(h + '<h2>' + t('mem1.t') + '</h2><div class="demo"><span class="memory-preview" aria-hidden="true">○<br>△</span></div><p>' + t('mem1.x', { n: C.mem.targets }) + '</p>', t('btn.start'));
      await T.memStudy(run.form);
    },
    rt: async function (sess, run, first, h) {
      await T.instr(h + '<h2>' + t('rt.t') + '</h2><div class="demo"><div class="shape rtstim"></div></div><p>' + t('rt.x') + '</p>', t('run.practiceGo'));
      await T.rt({ trials: first ? C.rt.practiceFirst : C.rt.practice, practice: true });
      await T.instr('<h2>' + t('run.real.t') + '</h2><p>' + t('run.real.x') + '</p>', t('btn.start'));
      var r = await T.rt({ trials: C.rt.trials });
      sess.rt = { trials: r.trials, anticipations: r.anticipations, summary: ST.summarizeRT(r.trials, C.rt) };
    },
    gng: async function (sess, run, first, h) {
      await T.instr(h + '<h2>' + t('gng.t') + '</h2><div class="demo"><div class="shape go"></div><div class="shape nogo"></div></div><p>' + t('gng.x') + '</p>', t('run.practiceGo'));
      await T.gng({ trials: first ? C.gng.practiceFirst : C.gng.practice, nogo: first ? C.gng.practiceFirstNogo : C.gng.practiceNogo, practice: true });
      await T.instr('<h2>' + t('run.real.t') + '</h2><p>' + t('run.real.x') + '</p>', t('btn.start'));
      var r = await T.gng({ trials: C.gng.trials, nogo: C.gng.nogo });
      sess.gng = { trials: r.trials, summary: ST.summarizeGNG(r.trials, C.gng) };
    },
    sdmt: async function (sess, run, first, h) {
      await T.instr(h + '<h2>' + t('sdmt.t') + '</h2><div class="demo"><span class="symdemo">' + T.sym(5) + ' → 4</span></div><p>' + t('sdmt.x') + '</p>', t('run.practiceGo'));
      await T.sdmt({ seed: sess.seed, items: first ? C.sdmt.practiceFirst : C.sdmt.practice });
      await T.instr('<h2>' + t('run.real.t') + '</h2><p>' + t('run.real.x') + '</p>', t('btn.start'));
      var r = await T.sdmt({ seed: sess.seed, durationMs: C.sdmt.durationMs });
      sess.sdmt = { resps: r.resps, summary: ST.summarizeSDMT(r.resps, C.sdmt) };
    },
    memRecog: async function (sess, run, first, h) {
      await T.instr(h + '<h2>' + t('mem2.t') + '</h2><p>' + t('mem2.x') + '</p>', t('btn.start'));
      var r = await T.memRecog(run.form);
      sess.mem = { targets: run.form.targets, resps: r.resps, summary: ST.summarizeMem(r.resps) };
    }
  };
  async function runPart(name, sess, run, first, k, n) {
    for (;;) {
      try { await PART[name](sess, run, first, hd(k, n)); return; }
      catch (e) {
        if (!T.isAborted(e)) throw e;
        sess.interruptions = (sess.interruptions || 0) + 1;
        var c = await T.screen('<h2>' + t('run.interrupted.t') + '</h2><p>' + t('run.interrupted.x') + '</p>', [['retry', t('run.retry'), 'primary'], ['quit', t('run.quit')]]);
        if (c === 'quit') { var q = new Error('quit'); q.quit = true; q.part = name; throw q; }
      }
    }
  }
  async function runSession(condition) {
    if (ui.running) return;
    if (!ui.accessReady) { ui.pendingCondition = condition; go('accessCheck'); return; }
    var d = S.data, first = condition === 'standard' && !d.sessions.some(function (s) { return s.completed && s.condition === 'standard'; });
    var c = ui.ctx, seed = hash(d.code) + d.sessions.length * 7919 + 17;
    var sess = {
      id: 's' + NB.now().toString(36), startedAt: new Date(NB.now()).toISOString(), condition: condition, completed: false, seed: seed, app: C.version,
      context: condition === 'standard' ? { sleep: c.sleep, unwell: c.unwell === '1', mood: c.mood, medChange: c.med === '1' } : null,
      device: deviceNow()
    };
    sess.flagged = !!(sess.context && (sess.context.sleep === 'poor' || sess.context.unwell || sess.context.mood === 'low' || sess.context.medChange));
    if (C.qa) sess.qa = true;
    if (epochNow()) sess.epoch = epochNow();
    var run = { form: T.memForm(seed) }, parts = condition === 'standard' ? ['memStudy', 'rt', 'gng', 'sdmt', 'memRecog'] : ['rt', 'sdmt'];
    var lock = null; try { if (navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) {}
    ui.running = true; T.open();
    try {
      if (condition !== 'standard') await T.instr('<h2>' + t('ctl.t') + '</h2><p>' + t('ctl.x') + '</p>', t('btn.continue'));
      for (var k = 0; k < parts.length; k++) await runPart(parts[k], sess, run, first, k + 1, parts.length);
      sess.finishedAt = new Date(NB.now()).toISOString(); sess.completed = true; sess.measures = ST.measuresOf(sess);
      S.addSession(sess); ui.lastId = sess.id; ui.ctx = {}; go('result');
    } catch (err) {
      if (err && err.quit) S.addEvent({ type: 'quit', part: err.part });
      else { if (window.console) console.error(err); S.addEvent({ type: 'error', msg: String((err && err.message) || err) }); }
      go('home');
    } finally {
      T.close(); ui.running = false; ui.accessReady = false;
      var title = app().querySelector('h1');
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
      if (lock) { try { lock.release(); } catch (e) {} }
    }
  }

  // ---------- export ----------
  function exportText() { return JSON.stringify(S.exportObject(ui.expRisk, ui.expEeg), null, 1); } // risk profile and EEG results are left out unless the person ticks the boxes
  function exportName() { return 'neurobaseline-' + S.data.code + '-' + new Date(NB.now()).toISOString().slice(0, 10) + '.json'; }

  // ---------- device, backup ----------
  function deviceNow() { return { ua: navigator.userAgent, w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1, touch: navigator.maxTouchPoints || 0 }; }
  function localDay() { var d = new Date(NB.now()); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }   // the date on the person's own calendar
  function epochNow() { return S.data.epoch || 0; }   // baseline period; it goes up by one when the person moves to another device
  function saveFile(text, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function restoreFrom(el) { // replace the data on this device with a backup file, after checking it and asking
    var f = el.files && el.files[0]; if (!f) return;
    function done(ok, key, vars) { el.value = ''; ui.restoreMsg = { ok: ok, text: t(key, vars) }; render(); }
    if (f.size > 20e6) return done(false, 'set.restore.err.big');
    var r = new FileReader();
    r.onerror = function () { done(false, 'set.restore.err.file'); };
    r.onload = function () {
      var obj; try { obj = JSON.parse(String(r.result)); } catch (e) { return done(false, 'set.restore.err.file'); }
      var res = NB.backup.check(obj, { mode: C.qa ? 'qa' : 'real' });
      if (!res.ok) return done(false, 'set.restore.err.' + res.error);
      var when = res.info.exportedAt ? fmtShort(Date.parse(res.info.exportedAt)) : '–';
      if (!window.confirm(t('set.restore.q', { code: res.info.code, n: res.info.sessions, date: when, m: S.data.sessions.length }))) { el.value = ''; ui.restoreMsg = null; render(); return; }
      var before = S.data; S.data = res.data;
      if (!S.save()) { S.data = before; S.save(); return done(false, 'set.restore.err.save'); }
      S.addEvent({ type: 'restore', sessions: res.info.sessions });
      ui.lastId = null; ui.prof = {}; ui.ctx = {};
      done(true, 'set.restore.ok', { n: res.info.sessions });
    };
    r.readAsText(f);
  }

  // ---------- actions ----------
  var ACT = {
    lang: function (el) { S.setLang(el.dataset.v); I.set(el.dataset.v); go(!S.data.consentAt ? 'intro' : !S.data.profile ? 'profile' : 'home'); },
    lang2: function (el) { S.setLang(el.dataset.v); I.set(el.dataset.v); render(); },
    go: function (el) { ui.restoreMsg = null; go(el.dataset.v); },
    ind: function (el) { ui.ind = el.dataset.v; render(); },
    consent: function () { if (!ui.agree) return; S.data.consentAt = new Date(NB.now()).toISOString(); S.save(); go('profile'); },
    profile: function () {
      var p = ui.prof; if (!(p.ageBand && p.edu && p.hand)) return;
      S.data.profile = { ageBand: p.ageBand, edu: p.edu, hand: p.hand }; S.save(); go('home');
    },
    profileAnswer: function (el, event) { ui.prof[el.dataset.k] = el.dataset.v; autoAdvance(el, function () { ui.profileStep = ui.profileEditing ? 3 : ui.profileStep + 1; ui.profileEditing = false; go('profile'); }, event); },
    profileEdit: function (el) { ui.profileStep = +el.dataset.v; ui.profileEditing = true; go('profile'); },
    profileBack: function () { if (ui.profileEditing) { ui.profileStep = 3; ui.profileEditing = false; go('profile'); } else if (ui.profileStep > 0) { ui.profileStep--; go('profile'); } else go('consent'); },
    contextAnswer: function (el, event) { ui.ctx[el.dataset.k] = el.dataset.v; autoAdvance(el, function () { ui.contextStep++; go('context'); }, event); },
    answerNext: function () { if (pendingAnswerNext) { var next = pendingAnswerNext; pendingAnswerNext = null; next(); } },
    contextBack: function () { if (ui.contextStep > 0) { ui.contextStep--; go('context'); } else go('redflags'); },
    start: function () {
      var e = evalNow();
      if (!C.qa && e.lastStdAt && NB.now() - e.lastStdAt < C.schedule.minGapHours * 36e5 && !window.confirm(t('home.tooSoon'))) return;
      ui.ctx = {}; ui.contextStep = 0; ui.accessReady = false; ui.pendingCondition = 'standard';
      go(ST.deviceCheck(S.data.sessions, epochNow(), S.data.deviceKeys, deviceNow()).changed ? 'device' : 'redflags');
    },
    rfNone: function () { ui.pendingCondition = 'standard'; go('accessCheck'); },
    accessContinue: function () { ui.accessReady = true; if (ui.pendingCondition === 'nondominant') runSession('nondominant'); else go('context'); },
    accessUnable: function () { ui.accessReady = false; ui.ctx = {}; S.addEvent({ type: 'accessLimit' }); go('accessHelp'); },   // kept for the clinician
    rfSome: function () { S.addEvent({ type: 'redflag' }); go('emergency'); },
    ctx: function (el) { ui.ctx[el.dataset.k] = el.dataset.v; render(); },
    begin: function () { if (['sleep', 'unwell', 'mood', 'med'].every(function (k) { return ui.ctx[k] != null; })) runSession('standard'); },
    riskView: function () { go(S.data.risk ? 'riskSum' : 'riskIntro'); },
    riskBegin: function () { if (!ui.riskAgree) return; ui.risk = {}; ui.riskStep = 0; go('riskForm'); },
    riskEdit: function () { ui.risk = JSON.parse(JSON.stringify(S.data.risk.answers)); ui.riskStep = 0; go('riskForm'); },
    rq: function (el, event) { ui.risk[el.dataset.k] = el.dataset.v; autoAdvance(el, function () { ACT.riskNext(); }, event); },
    riskBack: function () { if (ui.riskStep > 0) { ui.riskStep--; go('riskForm'); } else go(S.data.risk ? 'riskSum' : 'home'); },
    riskNext: function () {
      if (ui.riskStep < riskQuestions().length) { ui.riskStep++; go('riskForm'); }
    },
    riskSkip: function () { var q = riskQuestions()[ui.riskStep]; if (q) { delete ui.risk[q.id]; ACT.riskNext(); } },
    riskSave: function () {
      var now = new Date(NB.now()).toISOString();
      S.data.risk = { consentAt: (S.data.risk && S.data.risk.consentAt) || now, updatedAt: now, answers: JSON.parse(JSON.stringify(ui.risk)) };
      S.save(); go('riskSum');
    },
    control: function () { ui.accessReady = false; ui.pendingCondition = 'nondominant'; go('accessCheck'); },
    download: function () {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' }));
      a.download = exportName(); document.body.appendChild(a); a.click(); a.remove();
    },
    share: function () {
      try {
        var f = new File([exportText()], exportName(), { type: 'application/json' });
        if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'NeuroBaseline' }).catch(function () {}); else ACT.download();
      } catch (e) { ACT.download(); }
    },
    copy: function (el) {
      var done = function () { el.textContent = t('set.copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(exportText()).then(done, function () {});
    },
    devSwitch: function () { // start a new baseline period on this device
      if (!window.confirm(t('dev.switch.q', { n: C.baseline.n }))) return;
      var k = ST.deviceKey(deviceNow());
      S.data.epoch = epochNow() + 1; S.data.deviceKeys = k ? [k] : [];
      S.addEvent({ type: 'rebase', reason: 'device', epoch: S.data.epoch }); go('redflags');
    },
    devSame: function () { // the person says it is the usual device (a new monitor, a system update)
      var k = ST.deviceKey(deviceNow());
      if (k) S.data.deviceKeys = (S.data.deviceKeys || []).concat([k]).slice(-20);
      S.addEvent({ type: 'deviceSame', key: k }); go('redflags');
    },
    backup: function () { saveFile(JSON.stringify(S.exportObject(true, true), null, 1), 'neurobaseline-backup-' + S.data.code + '-' + localDay() + '.json'); },
    restorePick: function () { var f = document.getElementById('restoreFile'); if (f) f.click(); },
    demo: function () { S.setMode(S.mode === 'demo' ? 'real' : 'demo'); ui.lastId = null; ui.restoreMsg = null; boot(); },
    reset: function () { if (window.confirm(t('set.reset.q'))) { S.reset(); ui.prof = {}; ui.agree = false; boot(); } }
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || el.disabled || ui.running || advancing) return;
    var f = ACT[el.dataset.act]; if (f) f(el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'agree') { ui.agree = el.checked; var b = document.getElementById('consentBtn'); if (b) b.disabled = !el.checked; }
    else if (el.dataset && el.dataset.prof) { ui.prof[el.dataset.prof] = el.value; render(); }
    else if (el.id === 'riskAgree') { ui.riskAgree = el.checked; var rb = document.getElementById('riskBtn'); if (rb) rb.disabled = !el.checked; }
    else if (el.id === 'expRisk') ui.expRisk = el.checked;
    else if (el.id === 'expEeg') ui.expEeg = el.checked;
    else if (el.id === 'eegFile' && NB.eegUi) NB.eegUi.file(el);
    else if (el.id === 'restoreFile') restoreFrom(el);
  });
  document.addEventListener('input', function (e) { // height and weight
    var el = e.target; if (!el.dataset || !el.dataset.rnum) return;
    if (el.value === '') delete ui.risk[el.dataset.rnum]; else ui.risk[el.dataset.rnum] = el.value;
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'riskNumberForm') return;
    e.preventDefault();
    var q = riskQuestions()[ui.riskStep], input = document.getElementById('riskNumber');
    if (!q || q.type !== 'num') return;
    var value = Number(input.value), valid = input.value.trim() !== '' && isFinite(value) && value >= q.min && value <= q.max;
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) { document.getElementById('numberError').textContent = t('ui.number.error', { min: q.min, max: q.max }); input.focus(); return; }
    ui.risk[q.id] = input.value; ACT.riskNext();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && !C.qa) T.abort(); });
  window.addEventListener('beforeunload', function (e) { if (ui.running) { e.preventDefault(); e.returnValue = ''; } });

  function boot() {
    S.load(); I.set(S.lang || 'en');
    if (!S.lang) go('lang');
    else if (!S.data.consentAt) go('intro');
    else if (!S.data.profile) go('profile');
    else go('home');
  }
  NB.app = { boot: boot, go: go, ui: ui, evalNow: evalNow };
  if (NB.eegUi) NB.eegUi.init({ V: V, ACT: ACT, head: head, backBtn: backBtn, go: go, ui: ui, fmtShort: fmtShort });   // optional brain-rhythm check
  boot();
})();
