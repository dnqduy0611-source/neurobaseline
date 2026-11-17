/* NeuroBaseline – the "Insights and plan" screen: one summary across session results, daily habits,
   the risk profile and the optional brain-rhythm check, and a plan of at most three steps.
   What is said is decided in js/insight.js by fixed rules; this file only turns it into words. */
(function () {
  'use strict';
  var NB = window.NB, C = NB.config, I = NB.i18n, S = NB.store, IN = NB.insight, X = null;
  function t(k, v) { return I.t(k, v); }
  function loc(x) { var s = Number(x).toFixed(1); return I.lang === 'vi' ? s.replace('.', ',') : s; }   // decimal comma in Vietnamese
  var DEPS = { stats: NB.stats, config: C, risk: NB.risk, habits: NB.habits, eeg: NB.eeg };
  function facts() { return IN.fromData(S.data, DEPS, NB.now()); }
  function names(ids, prefix) { return ids.map(function (id) { return t(prefix + id); }).join(', '); }

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
  function linkText(l) { return t('in.' + l.key, { h: l.vars.h != null ? loc(l.vars.h) : '', d: l.vars.d != null ? loc(l.vars.d) : '' }); }
  function stepTitle(p) { return p.id === 'risk' ? t('f.' + p.vars.id) : t('in.p.' + p.id + '.t'); }
  function stepBody(p) { return p.id === 'risk' ? t('a.' + p.vars.id) : p.id === 'urgent' ? t('em.body') : t('in.p.' + p.id + '.x'); }
  function whyText(p) { return t('in.' + p.why, { h: p.vars.h != null ? loc(p.vars.h) : '', n: p.vars.n, m: p.vars.m }); }
  function uses(list) { return '<span class="in-uses">' + list.map(function (id) { return '<span class="chip">' + t('in.src.' + id) + '</span>'; }).join('') + '</span>'; }
  function chip(level, id) { // a changed recording is something to mention, not something the person can act on
    return '<span class="chip ' + ({ attention: 'bad', watch: 'warn', ok: 'ok' }[level] || '') + '">' + t(id === 'eeg' && level === 'watch' ? 'in.lv.eeg' : 'in.lv.' + level) + '</span>';
  }
  function headline(out, inp) { return out.links.length ? linkText(out.links[0]) : sourceText(out.sources[0], inp); }

  // ---------- pieces ----------
  function card() { // on the home screen
    var inp = facts(), out = IN.build(inp);
    return '<section class="card insight-card"><div class="hb-head"><span class="activity-icon">' + X.icon('plan') + '</span><div><h3>' + t('in.card.t') + '</h3><p class="muted">' + headline(out, inp) + '</p></div></div>' +
      '<ol class="in-mini">' + out.plan.map(function (p) { return '<li>' + stepTitle(p) + '</li>'; }).join('') + '</ol>' +
      '<div class="hb-actions"><button class="btn" data-act="insightOpen">' + t('in.card.open') + '</button></div></section>';
  }
  function sourceAction(s, inp) {
    if (s.id === 'habits') return NB.habitsUi ? '<button class="btn" data-act="' + (inp.habits ? 'habitOpen' : 'habitStart') + '">' + t(inp.habits ? 'in.a.habits' : 'in.a.habits.start') + '</button>' : '';
    if (s.id === 'risk') return '<button class="btn" data-act="' + (inp.risk ? 'riskView' : 'go" data-v="riskIntro') + '">' + t(inp.risk ? 'in.a.risk' : 'in.a.risk.start') + '</button>';
    if (s.id === 'eeg') return NB.eegUi ? '<button class="btn" data-act="eegOpen">' + t('in.a.eeg') + '</button>' : '';
    return '';
  }
  function referral(out) {
    var h = '';
    if (out.referral === 'urgent') h = '<p class="note warnnote"><b>' + t('in.p.urgent.t') + '.</b> ' + t('em.body') + '</p>';
    else if (out.referral === 'review') h = '<p>' + t('in.ref.review') + '</p><button class="btn primary" data-act="go" data-v="settings">' + t('st.red.file') + '</button>';
    else h = '<p>' + t('in.ref.' + out.referral) + '</p>';
    return h + '<p class="muted small in-always">' + t('in.ref.always') + '</p>';
  }

  // ---------- screen ----------
  function view() {
    var inp = facts(), out = IN.build(inp);
    var basis = t('in.basis', { s: inp.tasks.sessions, h: inp.habits ? inp.habits.n28 : 0, r: inp.risk ? t('in.basis.r') : '', e: inp.eeg ? t('in.basis.e', { n: inp.eeg.n }) : '' });
    var h = X.head() + '<h1 class="pad">' + t('in.t') + '</h1><p class="muted pad hb-lead">' + t('in.lead') + '</p><p class="muted small pad in-basis">' + basis + '</p>';
    h += '<section class="card"><h3>' + t('in.sec.sources') + '</h3>' + out.sources.map(function (s) {
      return '<div class="in-row"><div class="in-row-head"><b>' + t('in.src.' + s.id) + '</b>' + chip(s.level, s.id) + '</div><p>' + sourceText(s, inp) + '</p>' + sourceAction(s, inp) + '</div>';
    }).join('') + '</section>';
    h += '<section class="card"><h3>' + t('in.sec.links') + '</h3>' + (out.links.length
      ? '<ul class="loose in-links">' + out.links.map(function (l) { return '<li>' + linkText(l) + ' ' + uses(l.uses) + '</li>'; }).join('') + '</ul>'
      : '<p class="muted">' + t('in.l.none') + '</p>') + '</section>';
    h += '<section class="card"><h3>' + t('in.sec.plan') + '</h3><ol class="in-plan">' + out.plan.map(function (p) {
      return '<li><b>' + stepTitle(p) + '</b><p>' + stepBody(p) + '</p><p class="small in-why"><span class="in-why-l">' + t('in.why') + ': </span>' + whyText(p) + ' ' + uses(p.uses) + '</p></li>';
    }).join('') + '</ol>' + (out.more ? '<p class="muted small">' + t('in.plan.more', { n: out.more }) + '</p>' : '') + '</section>';
    h += '<section class="card"><h3>' + t('in.sec.ref') + '</h3>' + referral(out) + '</section>';
    h += '<section class="card"><h3>' + t('in.sec.how') + '</h3><ul class="loose">' + [1, 2, 3, 4].map(function (i) { return '<li>' + t('in.how.' + i) + '</li>'; }).join('') + '</ul></section>';
    return h + X.backBtn();
  }

  function init(ext) {
    X = ext;
    X.V.insight = view;
    X.ACT.insightOpen = function () { X.go('insight'); };
  }
  NB.insightUi = { init: init, card: card };
})();
