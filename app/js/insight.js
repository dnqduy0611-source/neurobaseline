/* NeuroBaseline – one summary across the sources: session results, daily habits, risk profile, optional EEG.
   Fixed rules decide what is said and in which order; no model writes text and nothing here changes the status.
   Every line names the sources it rests on, so the screen can show why it is there.
   Pure functions, no DOM. Runs in the browser (NB.insight) and in Node (module.exports). */
(function (root) {
  'use strict';
  var DAY = 864e5, MAX_PLAN = 3, MAX_LINKS = 3;
  // Risk factors that get their own step in the plan, most actionable first. Activity and contact have steps of their own.
  var RISK_ORDER = ['hypertension', 'diabetes', 'hearing', 'depression', 'smoking', 'ldl', 'alcohol', 'obesity', 'vision'];

  function has(list, x) { return !!list && list.indexOf(x) >= 0; }

  // Reduce a participant's data to the facts the rules use. deps: { stats, config, risk, habits, eeg }.
  function fromData(d, deps, now) {
    var e = deps.stats.evaluate(d.sessions || [], deps.config, now, d.epoch || 0), a = e.last, flagged = !!(e.light && a && a.light !== 'green');
    var tasks = { phase: e.phase, light: e.light || null, done: e.done, total: e.total, sessions: e.sessions.length,
                  exceed: flagged ? a.exceed.slice() : [], trend: flagged && (has(a.reasons, 'trend') || has(a.reasons, 'trendWatch')), context: flagged && has(a.reasons, 'context'),
                  lastAt: a ? Date.parse(a.s.startedAt) : null, nextDue: e.nextDue };
    var list = deps.habits.clean(d.habits), habits = null;
    if (list.length) {
      var week = deps.habits.summarize(list, now, 7);
      habits = { n28: deps.habits.summarize(list, now, 28).n, week: week, notes: deps.habits.notes(week), before: tasks.lastAt !== null ? deps.habits.compare(list, tasks.lastAt) : null };
    }
    var risk = null;
    if (d.risk && d.risk.answers) { var r = deps.risk.evaluate(d.risk.answers, d.profile); risk = { present: r.present.slice(), shortSleep: !!r.context.shortSleep }; }
    var eeg = null;
    if (deps.eeg && Array.isArray(d.eeg) && d.eeg.length) { var ev = deps.eeg.evaluate(d.eeg, deps.config.eeg); eeg = { n: ev.length, status: ev[ev.length - 1].status }; }
    var redflag = (d.events || []).some(function (x) { return x && x.type === 'redflag' && now - Date.parse(x.at) <= 14 * DAY; });
    return { tasks: tasks, habits: habits, risk: risk, eeg: eeg, redflag: redflag, checkins: list };
  }

  // The rules. Returns { sources, links, plan, more, referral, missing }.
  function build(inp) {
    var T = inp.tasks, H = inp.habits, R = inp.risk, E = inp.eeg;
    var flagged = T.light === 'yellow' || T.light === 'red', notes = H && H.notes.enough ? H.notes : null, week = H ? H.week : null;
    var sources = [], links = [], plan = [], missing = [];
    function src(id, level, key, vars) { sources.push({ id: id, level: level, key: key, vars: vars || {} }); }
    function link(key, uses, vars) { links.push({ key: key, uses: uses, vars: vars || {} }); }
    function step(id, uses, why, vars) { plan.push({ id: id, uses: uses, why: why, vars: vars || {} }); }

    // ---- 1. each source on its own ----
    if (T.phase !== 'monitoring') src('tasks', 'info', T.phase === 'new' ? 't.new' : 't.building', { done: T.done, total: T.total });
    else if (!T.light) src('tasks', 'info', 't.ready');
    else if (T.light === 'green') src('tasks', 'ok', 't.green');
    else src('tasks', T.light === 'red' ? 'attention' : 'watch', 't.' + T.light + (T.exceed.length ? '' : 'Trend'), { ids: T.exceed });

    var low = [];                                                      // habits below the usual advice this week
    if (!H) { src('habits', 'none', 'h.none'); missing.push('habits'); }
    else if (!notes) src('habits', 'info', 'h.more', { n: H.notes.missing });
    else {
      if (notes.sleep === 'short' || notes.sleep === 'below') low.push('sleep');
      if (notes.active === 'low' || notes.active === 'some') low.push('active');
      if (notes.social === 'low') low.push('social');
      src('habits', low.length ? 'watch' : 'ok', low.length ? 'h.low' : 'h.ok', { ids: low });
    }

    if (!R) { src('risk', 'none', 'r.none'); missing.push('risk'); }
    else if (!R.present.length) src('risk', 'ok', 'r.clear');
    else src('risk', 'watch', 'r.present', { ids: R.present });

    if (!E) src('eeg', 'none', 'e.none');                              // optional: its absence is not counted as missing
    else src('eeg', E.status === 'changed' ? 'watch' : E.status === 'within' ? 'ok' : 'info', 'e.' + E.status);

    // ---- 2. what the sources say together ----
    var sleepBefore = flagged && H && H.before && H.before.sleep ? H.before : null;
    if (sleepBefore) link('l.sleep.' + sleepBefore.sleep, ['tasks', 'habits'], { h: sleepBefore.week.sleepH, d: sleepBefore.sleepDiff === null ? null : -sleepBefore.sleepDiff });
    else if (flagged && T.context) link('l.context', ['tasks']);
    if (T.light === 'red' && E && E.status === 'changed') link('l.eeg', ['tasks', 'eeg']);
    var bothActive = !!(R && has(R.present, 'inactivity') && has(low, 'active'));
    var bothSocial = !!(R && has(R.present, 'isolation') && has(low, 'social'));
    var bothSleep = !!(R && R.shortSleep && has(low, 'sleep'));
    if (bothActive) link('l.active', ['risk', 'habits']);
    if (bothSocial) link('l.social', ['risk', 'habits']);
    if (bothSleep && !sleepBefore) link('l.sleepHabit', ['risk', 'habits']);
    if (flagged && !H) link('l.nohabits', ['tasks']);
    if (T.light === 'green' && (low.length || (R && R.present.length))) link('l.protect', ['tasks'].concat(low.length ? ['habits'] : [], R && R.present.length ? ['risk'] : []));
    links = links.slice(0, MAX_LINKS);

    // ---- 3. the plan, most pressing first ----
    if (inp.redflag) step('urgent', ['tasks'], 'w.urgent');
    if (T.light === 'red') step('doctor', ['tasks'], 'w.red');
    else if (T.light === 'yellow') step('repeat', ['tasks'], 'w.yellow');
    if (sleepBefore) step('sleep', ['tasks', 'habits'], 'w.sleepLink', { h: sleepBefore.week.sleepH });
    else if (has(low, 'sleep')) step('sleep', bothSleep ? ['risk', 'habits'] : ['habits'], bothSleep ? 'w.both' : 'w.sleepWeek', { h: week.sleepH });
    if (has(low, 'active')) step('move', bothActive ? ['risk', 'habits'] : ['habits'], bothActive ? 'w.both' : 'w.activeWeek', { n: week.activeDays, m: week.nActive });
    else if (R && has(R.present, 'inactivity')) step('move', ['risk'], 'w.risk');
    if (has(low, 'social')) step('social', bothSocial ? ['risk', 'habits'] : ['habits'], bothSocial ? 'w.both' : 'w.socialWeek', { n: week.socialDays, m: week.nSocial });
    else if (R && has(R.present, 'isolation')) step('social', ['risk'], 'w.risk');
    if (R) RISK_ORDER.forEach(function (id) { if (has(R.present, id)) step('risk', ['risk'], 'w.risk', { id: id }); });
    if (!H || !notes) step('checkin', ['habits'], 'w.checkin');
    if (!R) step('profile', ['risk'], 'w.profile');
    if (!plan.length || (plan.length < MAX_PLAN && !flagged && !inp.redflag)) step('keep', ['tasks'], 'w.keep');

    return { sources: sources, links: links, plan: plan.slice(0, MAX_PLAN), planAll: plan, more: Math.max(0, plan.length - MAX_PLAN),
             referral: inp.redflag ? 'urgent' : T.light === 'red' ? 'review' : T.light === 'yellow' ? 'repeat' : 'none', missing: missing };
  }

  // How each step of the plan is going, read from data the app already has. Nothing extra is stored or asked.
  // A habit step is counted from the daily check-ins: the last 7 days next to the 7 days before, and one mark
  // per day for 14 days. A day counts when the check-in for that day reaches the goal of the step.
  var GOAL = {
    sleep: function (x, hb) { return x.sleepH ? hb.HOURS[x.sleepH] >= hb.TARGET.sleepH : null; },   // 7 hours or more
    move: function (x) { return x.active ? x.active === '30plus' : null; },                         // 30 minutes or more
    social: function (x) { return x.social ? x.social === 'yes' : null; }
  };
  function track(plan, inp, hb, now) {
    var list = inp.checkins || [], today = hb.dayKey(now);
    return plan.map(function (p) {
      if (p.id === 'repeat' || p.id === 'keep') return inp.tasks.nextDue == null ? null : { kind: 'due', at: inp.tasks.nextDue, ready: now >= inp.tasks.nextDue };
      if (!GOAL[p.id] && p.id !== 'checkin') return null;                                           // no measure in the app for this step
      var days = [], cur = { met: 0, logged: 0 }, prev = { met: 0, logged: 0 };
      for (var k = 13; k >= 0; k--) {
        var x = hb.find(list, hb.addDays(today, -k)), w = k < 7 ? cur : prev, v;
        if (p.id === 'checkin') v = x ? true : k === 0 ? null : false;                              // today can still be done
        else v = x ? GOAL[p.id](x, hb) : null;
        if (p.id === 'checkin') { w.logged++; if (v) w.met++; }
        else if (v !== null) { w.logged++; if (v) w.met++; }
        days.push(v === null ? 'none' : v ? 'met' : 'miss');
      }
      var a = cur.met * prev.logged, b = prev.met * cur.logged, enough = cur.logged >= 3 && prev.logged >= 3;   // compared as shares of the days logged
      var out = { kind: 'days', days: days, met: cur.met, logged: cur.logged, prevMet: prev.met, prevLogged: prev.logged,
                  dir: !enough ? null : a > b ? 'up' : a < b ? 'down' : 'same', today: !!hb.find(list, today) };
      if (p.id === 'sleep') { out.h = hb.summarize(list, now, 7).sleepH; out.prevH = hb.summarize(list, hb.dayMs(hb.addDays(today, -7)), 7).sleepH; }
      return out;
    });
  }

  var api = { build: build, fromData: fromData, track: track, RISK_ORDER: RISK_ORDER, MAX_PLAN: MAX_PLAN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.insight = api; }
})(typeof window !== 'undefined' ? window : globalThis);
