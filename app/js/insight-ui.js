/* NeuroBaseline – the "Insights and plan" screen: one summary across session results, daily habits,
   the risk profile and the optional brain-rhythm check, and a plan of at most three steps.
   What is said is decided in js/insight.js by fixed rules; this file only turns it into words.
   For a flagged session the screen also shows the estimate of js/estimator.js (a small model) with the inputs behind it.
   Layout: the short answer is always visible; the reasons and the longer advice open on request.
   Safety text (when to see a doctor, emergency signs) is never folded away. */
(function () {
  'use strict';
  var NB = window.NB, C = NB.config, I = NB.i18n, S = NB.store, IN = NB.insight, X = null;
  function t(k, v) { return I.t(k, v); }
  function loc(x) { var s = Number(x).toFixed(1); return I.lang === 'vi' ? s.replace('.', ',') : s; }   // decimal comma in Vietnamese
  var DEPS = { stats: NB.stats, config: C, risk: NB.risk, habits: NB.habits, eeg: NB.eeg };
  var SRC_ICON = { tasks: 'sdmt', habits: 'habits', risk: 'health', eeg: 'eeg' };
  var STEP_ICON = { urgent: 'alert', doctor: 'medical', repeat: 'repeat', sleep: 'moon', move: 'walk', social: 'people', checkin: 'habits', profile: 'shield', keep: 'history', risk: 'health' };
  var LINK_ICON = { 'l.sleep.less': 'moon', 'l.sleep.short': 'moon', 'l.sleepHabit': 'moon', 'l.context': 'habits', 'l.eeg': 'eeg', 'l.active': 'walk', 'l.social': 'people', 'l.protect': 'shield', 'l.nohabits': 'habits' };
  function facts() { return IN.fromData(S.data, DEPS, NB.now()); }
  function names(ids, prefix) { return ids.map(function (id) { return t(prefix + id); }).join(', '); }
  function tile(name) { return '<span class="activity-icon">' + X.icon(name) + '</span>'; }
  function more(label, body) { // text that opens on request
    return '<details class="in-more"><summary><span>' + label + '</span>' + X.icon('chev') + '</summary><div class="in-more-body">' + body + '</div></details>';
  }

  // ---------- rules to words ----------
  function sourceText(s, inp) {
    var v = s.vars, w = inp.habits ? inp.habits.week : null;
    if (s.key === 't.yellow' || s.key === 't.red') return t('in.' + s.key, { names: names(v.ids, 'ind.') });
    if (s.key === 'r.present') return t('in.r.present', { n: v.ids.length, names: names(v.ids, 'f.') });
    if (s.key === 'h.low') return t('in.h.low', { list: v.ids.map(function (id) {
      return id === 'sleep' ? t('in.h.i.sleep', { h: loc(w.sleepH) }) : id === 'active' ? t('in.h.i.active', { n: w.activeDays, m: w.nActive }) : t('in.h.i.social', { n: w.socialDays, m: w.nSocial });
    }).join('; ') });
    return t('in.' + s.key, v);
  }
  function linkShort(l) { return t('in.' + l.key + '.s'); }
  function linkDetail(l) { return t('in.' + l.key + '.d', { h: l.vars.h != null ? loc(l.vars.h) : '', d: l.vars.d != null ? loc(l.vars.d) : '' }); }
  function stepTitle(p) { return p.id === 'risk' ? t('f.' + p.vars.id) : t('in.p.' + p.id + '.t'); }
  function stepShort(p) { return p.id === 'urgent' ? t('em.body') : t('in.p.' + p.id + '.s'); }           // urgent care is always shown in full
  function stepBody(p) { return p.id === 'risk' ? t('a.' + p.vars.id) : p.id === 'urgent' ? '' : t('in.p.' + p.id + '.x'); }
  function whyText(p) { return t('in.' + p.why, { h: p.vars.h != null ? loc(p.vars.h) : '', n: p.vars.n, m: p.vars.m }); }
  function uses(list) { return '<span class="in-uses">' + list.map(function (id) { return '<span class="chip">' + t('in.src.' + id) + '</span>'; }).join('') + '</span>'; }
  function chip(level, id) { // a changed recording is something to mention, not something the person can act on
    return '<span class="chip ' + ({ attention: 'bad', watch: 'warn', ok: 'ok' }[level] || '') + '">' + t(id === 'eeg' && level === 'watch' ? 'in.lv.eeg' : 'in.lv.' + level) + '</span>';
  }

  // ---------- the model's estimate for a flagged session ----------
  function estimate() {
    return NB.estimator && NB.estimatorModel ? NB.estimator.fromData(S.data, { stats: NB.stats, config: C, habits: NB.habits, eeg: NB.eeg, model: NB.estimatorModel }, NB.now()) : null;
  }
  function factor(q) { // one input, in a few words; hours of sleep are shown as slept, not as short of 7
    var h = q.id === 'sleep' && q.value != null ? 7 - q.value : null;
    return '<li>' + t('in.est.f.' + q.id + '.' + (q.contrib > 0 ? 'up' : 'down'), { h: h === null ? '' : h % 1 ? loc(h) : String(h) }) + '</li>';
  }
  function side(list, dir) {
    return list.length ? '<div><h4>' + X.icon(dir) + t('in.est.' + dir) + '</h4><ul>' + list.map(factor).join('') + '</ul></div>' : '';
  }
  function estimateCard(es) {
    if (!es) return '';
    var miss = es.missing.filter(function (id) { return id === 'sleep' || id === 'eeg'; }), r = Math.round(es.seen * 10), ten = '';
    for (var i = 0; i < 10; i++) ten += '<i' + (i < r ? ' class="on"' : '') + '></i>';
    return '<section class="card in-est"><div class="in-row-head"><h3>' + t('in.sec.est') + '</h3><span class="chip good">' + t('in.src.model') + '</span></div>' +
      '<div class="in-scale" role="img" aria-label="' + t('in.est.b.' + es.band) + '">' + ['temporary', 'unclear', 'lasting'].map(function (b) {
        return '<span' + (b === es.band ? ' class="on"' : '') + '>' + t('in.est.s.' + b) + '</span>'; }).join('') + '</div>' +
      '<p class="in-est-band">' + t('in.est.b.' + es.band) + '</p>' +
      '<div class="in-ten" role="img" aria-label="' + t('in.est.ten', { r: r }) + '">' + ten + '</div><p>' + t('in.est.x', { r: r }) + '</p>' +
      (es.up.length || es.down.length ? '<div class="in-fx">' + side(es.up, 'up') + side(es.down, 'down') + '</div>' : '') +
      '<p class="note">' + t('in.est.keep') + '</p>' +
      more(t('in.est.more'), '<p>' + t('in.est.x2') + '</p>' + (es.x.sleep > 0 ? '<p>' + t('in.est.sleepTip') + '</p>' : '') +
        (miss.length ? '<p>' + t('in.est.missing', { list: miss.map(function (id) { return t('in.est.m.' + id); }).join(', ') }) + '</p>' : '') +
        '<p class="muted small">' + t('in.est.note') + '</p>') + '</section>';
  }

  // ---------- how the plan is going ----------
  function tracked(out, inp) { return IN.track(out.plan, inp, NB.habits, NB.now()); }
  function week(pr) { // the last seven days, today last; a tick is a day the goal was reached
    var H = NB.habits, today = H.dayKey(NB.now()), h = '<ol class="in-week" aria-label="' + t('in.pr.dots') + '">';
    pr.days.slice(7).forEach(function (s, i) {
      var name = new Date(H.dayMs(H.addDays(today, i - 6))).toLocaleDateString(I.lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: I.lang === 'vi' ? 'narrow' : 'short' })   // T2 … CN, so a label never wraps;
      h += '<li class="' + s + (i === 6 ? ' today' : '') + '"><span>' + name + '</span><i aria-hidden="true">' + (s === 'met' ? '✓' : s === 'miss' ? '·' : '') + '</i><span class="sr-only">' + t('in.pr.lg.' + s) + '</span></li>';
    });
    return h + '</ol>';
  }
  function count(p, pr) { // the one line under the week
    if (pr.kind === 'due') return t(pr.ready ? 'in.pr.ready' : 'in.pr.due', { date: X.fmtShort(pr.at) });
    return pr.logged ? t('in.pr.c.' + p.id, { n: pr.met, m: pr.logged }) : t('in.pr.none');
  }
  function progText(p, pr) { // the full count, shown with the reasons
    if (!pr || pr.kind !== 'days' || !pr.logged) return '';
    return t('in.pr.' + p.id, { n: pr.met, m: pr.logged, h: pr.h != null ? loc(pr.h) : '' }) +
      (pr.prevLogged ? ' ' + t(p.id === 'sleep' ? 'in.pr.prev.sleep' : 'in.pr.prev', { n: pr.prevMet, m: pr.prevLogged, h: pr.prevH != null ? loc(pr.prevH) : '' }) : '');
  }
  function progress(p, pr) {
    if (!pr) return '';
    return '<div class="in-prog">' + (pr.kind === 'days' ? week(pr) : '') + '<p class="in-count">' + count(p, pr) +
      (pr.dir ? ' <span class="chip ' + ({ up: 'ok', down: 'warn' }[pr.dir] || '') + '">' + t('in.pr.' + pr.dir) + '</span>' : '') + '</p></div>';
  }
  function key(cls, mark, k) { return '<span class="lg"><i class="in-k ' + cls + '" aria-hidden="true">' + mark + '</i>' + t(k) + '</span>'; }
  function planFoot(prs) { // shown when at least one step is counted from the daily check-ins
    var days = prs.filter(function (pr) { return pr && pr.kind === 'days'; });
    if (!days.length) return '';
    return '<div class="in-foot"><div class="legend in-lg">' + key('met', '✓', 'in.pr.lg.met') + key('miss', '·', 'in.pr.lg.miss') + key('none', '', 'in.pr.lg.none') + '</div><p class="muted small">' + t('in.plan.track') + '</p>' +
      (NB.habitsUi && !days[0].today ? '<div class="hb-actions"><button class="btn primary" data-act="habitStart">' + t('in.a.habits.start') + '</button></div>' : '') + '</div>';
  }
  function stepAction(p) {
    if (p.id === 'doctor') return '<button class="btn primary" data-act="go" data-v="settings">' + t('st.red.file') + '</button>';
    if (p.id === 'profile') return '<button class="btn primary" data-act="go" data-v="riskIntro">' + t('in.a.risk.start') + '</button>';
    return '';
  }
  function step(p, i, pr, es) {
    var src = p.id === 'sleep' && es && es.x.sleep > 0 ? p.uses.concat(['model']) : p.uses, body = stepBody(p), full = progText(p, pr);
    return '<li class="' + (p.id === 'urgent' ? 'urgent' : '') + '">' + tile(STEP_ICON[p.id] || 'plan') + '<div><span class="in-step-n">' + t('in.step', { n: i + 1 }) + '</span><h4>' + stepTitle(p) + '</h4><p>' + stepShort(p) + '</p>' +
      progress(p, pr) + stepAction(p) +
      more(t('in.more.why'), '<p><b>' + t('in.why') + ':</b> ' + whyText(p) + '</p><p>' + uses(src) + '</p>' + (body ? '<p><b>' + t('in.how') + ':</b> ' + body + '</p>' : '') + (full ? '<p class="muted small">' + full + '</p>' : '')) +
      '</div></li>';
  }

  function headline(out, inp) { return out.links.length ? linkShort(out.links[0]) : sourceText(out.sources[0], inp); }

  // ---------- pieces ----------
  function card() { // on the home screen
    var inp = facts(), out = IN.build(inp), prs = tracked(out, inp), es = estimate();
    return '<section class="card insight-card"><div class="hb-head"><span class="activity-icon">' + X.icon('plan') + '</span><div><h3>' + t('in.card.t') + '</h3><p class="muted">' + headline(out, inp) + '</p></div></div>' +
      (es ? '<p class="small in-est-mini"><span class="chip good">' + t('in.src.model') + '</span> ' + t('in.est.b.' + es.band) + '</p>' : '') +
      '<ol class="in-mini">' + out.plan.map(function (p, i) {
        var pr = prs[i];
        return '<li>' + stepTitle(p) + (pr && pr.kind === 'days' && pr.logged ? ' <span>· ' + t('in.mini.pr', { n: pr.met, m: pr.logged }) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<div class="hb-actions"><button class="btn" data-act="insightOpen">' + t('in.card.open') + '</button></div></section>';
  }
  function sourceAction(s, inp) {
    if (s.id === 'habits') return NB.habitsUi ? '<button class="btn" data-act="' + (inp.habits ? 'habitOpen' : 'habitStart') + '">' + t(inp.habits ? 'in.a.habits' : 'in.a.habits.start') + '</button>' : '';
    if (s.id === 'risk') return '<button class="btn" data-act="' + (inp.risk ? 'riskView' : 'go" data-v="riskIntro') + '">' + t(inp.risk ? 'in.a.risk' : 'in.a.risk.start') + '</button>';
    if (s.id === 'eeg') return NB.eegUi ? '<button class="btn" data-act="eegOpen">' + t('in.a.eeg') + '</button>' : '';
    return '';
  }
  function emergency() { // always in full
    return '<div class="in-em"><h4>' + X.icon('alert') + t('in.ref.em.t') + '</h4><ul>' + [1, 2, 3, 4].map(function (i) { return '<li>' + t('in.ref.em.' + i) + '</li>'; }).join('') + '</ul><p>' + t('in.ref.em.x') + '</p></div>';
  }
  function referral(out) {
    var h = '';
    if (out.referral === 'urgent') h = '<p class="note warnnote"><b>' + t('in.p.urgent.t') + '.</b> ' + t('em.body') + '</p>';
    else if (out.referral === 'review') h = '<p>' + t('in.ref.review') + '</p><button class="btn" data-act="go" data-v="settings">' + t('st.red.file') + '</button>';
    else h = '<p>' + t('in.ref.' + out.referral) + '</p>';
    return h + emergency();
  }

  // ---------- screen ----------
  function view() {
    var inp = facts(), out = IN.build(inp), prs = tracked(out, inp), es = estimate();
    var basis = t('in.basis', { s: inp.tasks.sessions, h: inp.habits ? inp.habits.n28 : 0, r: inp.risk ? t('in.basis.r') : '', e: inp.eeg ? t('in.basis.e', { n: inp.eeg.n }) : '' });
    var h = X.head() + '<h1 class="pad">' + t('in.t') + '</h1><p class="muted pad hb-lead">' + t('in.lead') + '</p>';
    h += '<section class="card"><h3>' + t('in.sec.links') + '</h3>' + (out.links.length
      ? out.links.map(function (l) {
        return '<div class="in-find">' + tile(LINK_ICON[l.key] || 'plan') + '<div><p class="in-find-t">' + linkShort(l) + '</p>' + more(t('in.more'), '<p>' + linkDetail(l) + '</p><p>' + uses(l.uses) + '</p>') + '</div></div>';
      }).join('')
      : '<p class="muted">' + t('in.l.none') + '</p>') + '</section>';
    h += '<section class="card"><h3>' + t('in.sec.plan') + '</h3><ol class="in-plan">' + out.plan.map(function (p, i) { return step(p, i, prs[i], es); }).join('') + '</ol>' +
      planFoot(prs) + (out.more ? '<p class="muted small in-plan-more">' + t('in.plan.more', { n: out.more }) + '</p>' : '') + '</section>';
    h += estimateCard(es);
    h += '<section class="card"><h3>' + t('in.sec.ref') + '</h3>' + referral(out) + '</section>';
    h += '<section class="card"><h3>' + t('in.sec.sources') + '</h3>' + out.sources.map(function (s) {
      return '<details class="in-src"><summary>' + tile(SRC_ICON[s.id]) + '<span class="in-src-h"><b>' + t('in.src.' + s.id) + '</b>' + chip(s.level, s.id) + '</span>' + X.icon('chev') + '</summary>' +
        '<div class="in-src-body"><p>' + sourceText(s, inp) + '</p>' + sourceAction(s, inp) + '</div></details>';
    }).join('') + '</section>';
    h += '<details class="card in-how"><summary><span>' + t('in.sec.how') + '</span>' + X.icon('chev') + '</summary><p class="muted small">' + basis + '</p><ul class="loose">' +
      [1, 2, 3, 4].map(function (i) { return '<li>' + t('in.how.' + i) + '</li>'; }).join('') + '</ul></details>';
    return h + X.backBtn();
  }

  function init(ext) {
    X = ext;
    X.V.insight = view;
    X.ACT.insightOpen = function () { X.go('insight'); };
  }
  NB.insightUi = { init: init, card: card };
})();
