/* NeuroBaseline – estimate of a lasting change. A small machine-learning model (logistic regression) for a session that
   the status rule has already flagged: how likely is it that the person's ability has really changed, as opposed to a
   session that was off for another reason? The coefficients are in js/estimator-model.js, fitted on a SIMULATED cohort
   by sim/train_estimator.py. The model never changes the status and has not been validated on real people.
   Every input has one coefficient, so its contribution to the estimate can be shown.
   Pure functions, no DOM. Runs in the browser (NB.estimator) and in Node (module.exports). */
(function (root) {
  'use strict';
  var DAY = 864e5, MIN_SHOWN = 0.15, EEG_DAYS = 30;   // MIN_SHOWN: smallest contribution (log-odds) that is named; EEG_DAYS: how far a recording may be from the session

  function num(v) { return typeof v === 'number' && isFinite(v); }

  // The inputs for the latest follow-up session, or null when the rule has not flagged it. deps: { stats, config, habits, eeg }.
  // A value the app does not have is null; the model then uses the average, so it contributes nothing.
  function inputs(d, deps, now) {
    var e = deps.stats.evaluate(d.sessions || [], deps.config, now, d.epoch || 0), a = e.last;
    if (!a || e.phase !== 'monitoring' || (a.light !== 'yellow' && a.light !== 'red')) return null;
    var earlier = e.sessions.filter(function (s) { return s.role === 'followup'; }).slice(0, -1), before = earlier[earlier.length - 1];
    // The model was fitted with a trend that exists only once two earlier follow-up sessions count towards it (an unusual day does not).
    var counted = earlier.filter(function (s) { return !s.s.flagged; }).length;
    var zs = [];
    deps.config.indicators.forEach(function (ind) { if (ind.primary && a.ind[ind.id]) zs.push(a.ind[ind.id].rci); });
    var x = { trend: counted >= 2 && before.trend ? before.trend.stat : 0,             // the trend of the earlier sessions, before this one
              zmean: zs.length ? zs.reduce(function (s, v) { return s + v; }, 0) / zs.length : null,
              flag: a.s.flagged ? 1 : 0, sleep: null, eeg: null };
    var at = Date.parse(a.s.startedAt), HB = deps.habits;
    if (HB) {                                                                           // the answer given before the session, else that day's check-in
      var band = a.s.context ? a.s.context.sleepHours : null;
      if (!band) { var hit = HB.find(HB.clean(d.habits), HB.dayKey(at)); if (hit) band = hit.sleepH; }
      if (band && num(HB.HOURS[band])) x.sleep = Math.max(0, HB.TARGET.sleepH - HB.HOURS[band]);
    }
    if (deps.eeg && Array.isArray(d.eeg) && d.eeg.length) {                             // the latest recording compared with the personal EEG baseline
      deps.eeg.evaluate(d.eeg.filter(function (r) { return r && typeof r === 'object'; }), deps.config.eeg).forEach(function (r) {   // a damaged entry is skipped
        if ((r.status === 'within' || r.status === 'changed') && num(r.z.theta_alpha) && Math.abs(Date.parse(r.r.at) - at) <= EEG_DAYS * DAY) x.eeg = r.z.theta_alpha;
      });
    }
    return x;
  }

  // The estimate for a set of inputs. Each part is one input: its value and how far it moves the log-odds from an average flagged session.
  function estimate(model, x) {
    var logit = model.base, parts = [];
    model.features.forEach(function (id, k) {
      var known = num(x[id]), v = known ? Math.max(model.clip[k][0], Math.min(model.clip[k][1], x[id])) : model.mean[k], c = model.coef[k] * (v - model.mean[k]);
      logit += c;
      parts.push({ id: id, value: known ? v : null, known: known, contrib: c });
    });
    var p = 1 / (1 + Math.exp(-logit)), band = p < model.bands[0] ? 'temporary' : p > model.bands[1] ? 'lasting' : 'unclear';
    var named = parts.filter(function (q) { return Math.abs(q.contrib) >= MIN_SHOWN; });
    return { p: p, logit: logit, band: band, parts: parts,
             up: named.filter(function (q) { return q.contrib > 0; }).sort(function (a, b) { return b.contrib - a.contrib; }),      // towards a lasting change, strongest first
             down: named.filter(function (q) { return q.contrib < 0; }).sort(function (a, b) { return a.contrib - b.contrib; }),    // towards a temporary dip, strongest first
             missing: parts.filter(function (q) { return !q.known; }).map(function (q) { return q.id; }),
             seen: model.test.bands[{ temporary: 0, unclear: 1, lasting: 2 }[band]].rate };   // share of true changes in this band, simulated test cohorts
  }

  // deps as for inputs, plus model. Returns null when there is nothing to estimate.
  function fromData(d, deps, now) {
    var x = inputs(d, deps, now); if (!x) return null;
    var out = estimate(deps.model, x); out.x = x; return out;
  }

  var api = { inputs: inputs, estimate: estimate, fromData: fromData, MIN_SHOWN: MIN_SHOWN, EEG_DAYS: EEG_DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.estimator = api; }
})(typeof window !== 'undefined' ? window : globalThis);
