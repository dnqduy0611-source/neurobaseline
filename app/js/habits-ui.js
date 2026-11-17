/* NeuroBaseline – screens for the daily habits check-in (sleep, movement, contact with others).
   Four questions once a day. The answers are kept on the device, shown next to the session results
   and compared with the person's own earlier weeks. They never change the status. */
(function () {
  'use strict';
  var NB = window.NB, I = NB.i18n, S = NB.store, H = NB.habits, X = null;
  function t(k, v) { return I.t(k, v); }
  function loc(x) { var s = Number(x).toFixed(1); return I.lang === 'vi' ? s.replace('.', ',') : s; }   // decimal comma in Vietnamese
  function hours(x) { return t('hb.h', { h: loc(x) }); }
  var st = { step: 0, ans: {}, saved: false };
  function list() { return H.clean(S.data.habits); }
  function today() { return H.dayKey(NB.now()); }
  function locale() { return I.lang === 'vi' ? 'vi-VN' : 'en-GB'; }

  function questions() {
    function opts(id, prefix) { return H.QUESTIONS.filter(function (q) { return q.id === id; })[0].opts.map(function (o) { return [o, t(prefix + o)]; }); }
    return [
      { id: 'sleepH', title: 'ctx.sleepH', opts: opts('sleepH', 'ctx.sleepH.') },
      { id: 'sleepQ', title: 'hb.q.sleepQ', opts: opts('sleepQ', 'ctx.sleep.') },
      { id: 'active', title: 'hb.q.active', hint: 'hb.q.active.h', opts: opts('active', 'hb.active.') },
      { id: 'social', title: 'hb.q.social', hint: 'hb.q.social.h', compact: true, opts: [['yes', t('btn.yes')], ['no', t('btn.no')]] }
    ];
  }

  // ---------- pieces ----------
  function weekStrip(all) { // the last seven days, today last
    var key = today(), h = '<ol class="hb-week" aria-label="' + t('hb.week') + '">';
    for (var i = 6; i >= 0; i--) {
      var k = H.addDays(key, -i), on = !!H.find(all, k), name = new Date(H.dayMs(k)).toLocaleDateString(locale(), { weekday: 'short' });
      h += '<li class="' + (on ? 'on' : 'off') + (i === 0 ? ' today' : '') + '"><span>' + X.esc(name) + '</span><i aria-hidden="true">' + (on ? '✓' : '') + '</i><span class="sr-only">' + t(on ? 'hb.day.on' : 'hb.day.off') + '</span></li>';
    }
    return h + '</ol>';
  }
  function statTiles(s) {
    function tile(k, value) { return '<div class="stat-tile"><span>' + t(k) + '</span><b>' + value + '</b><small>' + t('hb.stat.week') + '</small></div>'; }
    return '<div class="hb-stats">' + tile('hb.stat.sleep', s.nSleep ? hours(s.sleepH) : '–') + tile('hb.stat.active', s.nActive ? t('hb.of', { n: s.activeDays, m: s.nActive }) : '–') +
      tile('hb.stat.social', s.nSocial ? t('hb.of', { n: s.socialDays, m: s.nSocial }) : '–') + '</div>';
  }
  function actions(all, withOpen) {
    var done = !!H.find(all, today());
    return '<div class="hb-actions"><button class="btn' + (done ? '' : ' primary') + '" data-act="habitStart">' + t(done ? 'hb.card.redo' : 'hb.card.do') + '</button>' +
      (withOpen ? '<button class="btn" data-act="habitOpen">' + t('hb.card.open') + '</button>' : '') + '</div>';
  }
  function card() { // on the home screen
    var all = list();
    return '<section class="card habit-card"><div class="hb-head"><span class="activity-icon">' + X.icon('habits') + '</span><div><h3>' + t('hb.card.t') + '</h3><p class="muted">' + t('hb.card.x') + '</p></div></div>' +
      weekStrip(all) + (all.length ? statTiles(H.summarize(all, NB.now(), 7)) : '') + actions(all, true) + '</section>';
  }
  function weekNotes(s) {
    var n = H.notes(s);
    if (!n.enough) return '<p class="muted">' + t('hb.sum.more', { n: n.missing }) + '</p>';
    var h = '<ul class="loose hb-notes">';
    if (n.sleep) h += '<li class="' + n.sleep + '">' + t('hb.n.sleep.' + n.sleep, { h: loc(s.sleepH) }) + '</li>';
    if (n.active) h += '<li class="' + n.active + '">' + t('hb.n.active.' + n.active, { n: s.activeDays, m: s.nActive }) + '</li>';
    if (n.social) h += '<li class="' + n.social + '">' + t('hb.n.social.' + n.social, { n: s.socialDays, m: s.nSocial }) + '</li>';
    return h + '</ul>';
  }
  function chart(all) { // 28 days: sleep as bars, movement and contact as marks
    var now = NB.now(), last = today(), DAYS = 28, W = 340, HT = 176, L = 58, R = 8, TOP = 10, BASE = 108, LO = 3, HI = 9, cw = (W - L - R) / DAYS;
    var s = H.summarize(all, now, DAYS);
    if (!s.n) return '<p class="muted">' + t('hb.chart.none') + '</p>';
    function Y(h) { return BASE - (Math.max(LO, Math.min(HI, h)) - LO) * (BASE - TOP) / (HI - LO); }
    var g = '';
    [5, 7, 9].forEach(function (v) {
      g += '<line class="' + (v === H.TARGET.sleepH ? 'hb-target' : 'hb-grid') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="hb-ax" x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + t('hb.h', { h: v }) + '</text>';
    });
    g += '<line class="hb-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + BASE + '" y2="' + BASE + '"/>';
    g += '<text class="hb-ax" x="' + (L - 6) + '" y="134" text-anchor="end">' + t('hb.row.active') + '</text><text class="hb-ax" x="' + (L - 6) + '" y="152" text-anchor="end">' + t('hb.row.social') + '</text>';
    for (var i = 0; i < DAYS; i++) {
      var e = H.find(all, H.addDays(last, i - (DAYS - 1))), x = L + i * cw, cx = (x + cw / 2).toFixed(1);
      if (!e) continue;
      if (e.sleepH) { var hh = H.HOURS[e.sleepH]; g += '<rect class="hb-bar ' + (hh >= H.TARGET.sleepH ? 'ok' : hh >= H.TARGET.shortH ? 'mid' : 'low') + '" x="' + (x + 1.5).toFixed(1) + '" y="' + Y(hh).toFixed(1) + '" width="' + (cw - 3).toFixed(1) + '" height="' + (BASE - Y(hh)).toFixed(1) + '" rx="2"/>'; }
      if (e.active) g += e.active === '30plus' ? '<circle class="hb-act" cx="' + cx + '" cy="130" r="3.6"/>' : e.active === 'some' ? '<circle class="hb-act half" cx="' + cx + '" cy="130" r="2.9"/>' : '<circle class="hb-none" cx="' + cx + '" cy="130" r="1.3"/>';
      if (e.social) g += e.social === 'yes' ? '<circle class="hb-soc" cx="' + cx + '" cy="148" r="3.6"/>' : '<circle class="hb-none" cx="' + cx + '" cy="148" r="1.3"/>';
    }
    function lab(offset, anchor, x) { var d = new Date(H.dayMs(H.addDays(last, offset))); return '<text class="hb-ax" x="' + x + '" y="' + (HT - 6) + '" text-anchor="' + anchor + '">' + d.getDate() + '/' + (d.getMonth() + 1) + '</text>'; }
    g += lab(-(DAYS - 1), 'start', L) + lab(0, 'end', W - R);
    var label = X.esc(t('hb.chart.label', { n: s.n, h: s.nSleep ? loc(s.sleepH) : '–', a: s.activeDays, s: s.socialDays }));
    function lg(cls, k) { return '<span class="lg"><i class="' + cls + '"></i>' + t(k) + '</span>'; }
    return '<svg viewBox="0 0 ' + W + ' ' + HT + '" class="chart hb-chart" role="img" aria-label="' + label + '"><title>' + label + '</title>' + g + '</svg>' +
      '<div class="legend hb-legend">' + lg('hb-k ok', 'hb.lg.ok') + lg('hb-k mid', 'hb.lg.mid') + lg('hb-k low', 'hb.lg.low') + lg('hb-k target', 'hb.lg.target') + lg('hb-k act', 'hb.lg.a30') + lg('hb-k act half', 'hb.lg.asome') + lg('hb-k soc', 'hb.lg.soc') + '</div>';
  }
  function sessionsShown() { return X.evalNow().sessions.filter(function (a) { return a.role !== 'previous' && a.role !== 'control'; }); }
  function pairText(a, all) { // one sentence when sleep before a session outside the usual range was short for this person
    if (!a || !a.light || a.light === 'green') return '';
    var c = H.compare(all, Date.parse(a.s.startedAt));
    if (!c.sleep) return '';
    return t('hb.pair.' + c.sleep, { h: loc(c.week.sleepH), d: c.sleepDiff === null ? '' : loc(-c.sleepDiff), u: c.usual ? loc(c.usual.sleepH) : '' }) + t('hb.pair.' + a.light);
  }
  function statusNote(a) { var text = pairText(a, list()); return text ? '<p class="small hb-pair">' + text + '</p>' : ''; }   // under the reasons on the status card
  function around(all) {
    var rows = sessionsShown().slice(-4).reverse();
    if (!rows.length) return '<p class="muted">' + t('hb.ar.none') + '</p>';
    var h = '<div class="hb-scroll"><table class="ht hb-table"><tr><th>' + t('hb.ar.date') + '</th><th>' + t('hb.ar.res') + '</th><th>' + t('hb.ar.sleep') + '</th><th>' + t('hb.ar.active') + '</th><th>' + t('hb.ar.social') + '</th></tr>';
    rows.forEach(function (a) {
      var w = H.summarize(all, Date.parse(a.s.startedAt), 7);
      h += '<tr><td>' + X.fmtShort(Date.parse(a.s.startedAt)) + '</td><td><span class="chip ' + (a.light === 'green' ? 'ok' : a.light === 'red' ? 'bad' : '') + '">' + t(a.light ? 'hist.l.' + a.light : 'role.' + a.role) + '</span></td><td class="num">' +
        (w.nSleep ? hours(w.sleepH) : '–') + '</td><td class="num">' + (w.nActive ? w.activeDays + '/' + w.nActive : '–') + '</td><td class="num">' + (w.nSocial ? w.socialDays + '/' + w.nSocial : '–') + '</td></tr>';
    });
    var e = X.evalNow(), note = pairText(e.light ? e.last : null, all);
    return h + '</table></div>' + (note ? '<p class="note hb-pair">' + note + '</p>' : '');
  }

  // ---------- screens ----------
  function viewHabits() {
    var all = list(), saved = st.saved, n = H.streak(all, NB.now());
    st.saved = false;
    return X.head() + '<h1 class="pad">' + t('hb.t') + '</h1><p class="muted pad hb-lead">' + t('hb.lead') + '</p>' +
      (saved ? '<p class="note pad" role="status">' + t('hb.saved') + '</p>' : '') +
      '<section class="card"><h3>' + t('hb.sum.t') + (n > 1 ? ' <span class="chip">' + t('hb.streak', { n: n }) + '</span>' : '') + '</h3>' + weekStrip(all) + weekNotes(H.summarize(all, NB.now(), 7)) + actions(all, false) + '</section>' +
      '<section class="card"><h3>' + t('hb.chart.t') + '</h3>' + chart(all) + '</section>' +
      '<section class="card"><h3>' + t('hb.ar.t') + '</h3><p class="muted small">' + t('hb.ar.x') + '</p>' + around(all) + '</section>' +
      '<section class="card"><h3>' + t('hb.about.t') + '</h3><ul class="loose">' + [1, 2, 3, 4].map(function (i) { return '<li>' + t('hb.about.' + i) + '</li>'; }).join('') + '</ul></section>' + X.backBtn();
  }
  function viewForm() {
    var qs = questions(), q = qs[st.step];
    if (!q) return viewHabits();
    return X.flow('hb.flow.t', 'hb.flow.x', st.step, qs.length, '<h1 id="questionTitle" tabindex="-1">' + t(q.title) + '</h1>' + (q.hint ? '<p class="question-hint">' + t(q.hint) + '</p>' : '') +
      X.choices(q, st.ans[q.id], 'habitAnswer') + '<p class="auto-hint">' + t('ui.answerHint') + '</p>', X.flowBack('habitBack', st.step));
  }
  function save() {
    var e = { day: today() };
    H.QUESTIONS.forEach(function (q) { if (st.ans[q.id] != null) e[q.id] = st.ans[q.id]; });
    if (S.mode === 'demo') e.simulated = true;
    S.data.habits = H.upsert(S.data.habits, e); S.save();
    st.saved = true; st.step = 0; X.go('habits');
  }

  function init(ext) {
    X = ext;
    X.V.habits = viewHabits; X.V.habitForm = viewForm;
    X.ACT.habitOpen = function () { st.saved = false; X.go('habits'); };
    X.ACT.habitStart = function () {
      var e = H.find(list(), today()); st.ans = {}; st.step = 0; st.saved = false;
      if (e) H.QUESTIONS.forEach(function (q) { if (e[q.id]) st.ans[q.id] = e[q.id]; });
      X.go('habitForm');
    };
    X.ACT.habitAnswer = function (el, event) {
      st.ans[el.dataset.k] = el.dataset.v;
      X.autoAdvance(el, function () { st.step++; if (st.step >= H.QUESTIONS.length) save(); else X.go('habitForm'); }, event);
    };
    X.ACT.habitBack = function () { if (st.step > 0) { st.step--; X.go('habitForm'); } else X.go('home'); };
  }
  NB.habitsUi = { init: init, card: card, statusNote: statusNote, state: st };
})();
