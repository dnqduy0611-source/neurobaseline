/* NeuroBaseline – clinician view, logic without DOM: reading exported files safely, priority, checklist prompts.
   Runs in the browser (NB.clin) and in Node (module.exports) for unit tests. */
(function (root) {
  'use strict';
  var DAY = 864e5;
  var CHECKLIST = ['acute', 'meds', 'mood', 'sleep', 'b12', 'tsh', 'bloods', 'hearing', 'vision', 'alcohol', 'vasc', 'collateral'];
  var DECISIONS = ['none', 'watch', 'repeat', 'primary', 'neuro', 'geri', 'mental', 'other'];
  var VASCULAR = ['hypertension', 'diabetes', 'ldl', 'smoking', 'obesity'];

  function num(x) { return typeof x === 'number' && isFinite(x) ? x : null; }
  function oneOf(v, list) { return list.indexOf(v) >= 0 ? v : null; }
  function isoOrNull(v) { var t = Date.parse(v); return isFinite(t) ? new Date(t).toISOString() : null; }
  function ep(v) { return typeof v === 'number' && v >= 0 && v <= 99 && v === Math.floor(v) ? v : 0; }   // baseline period (0 unless the person changed device)

  // An exported file is untrusted input. Keep only the fields the view needs, with the types it expects.
  function sanitize(file, riskGroups) {
    if (!file || typeof file !== 'object' || file.app !== 'NeuroBaseline' || !file.data || typeof file.data !== 'object') return null;
    var d = file.data;
    if (typeof d.code !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(d.code) || !Array.isArray(d.sessions)) return null;
    var sessions = d.sessions.filter(function (s) { return s && typeof s === 'object' && s.completed && isoOrNull(s.startedAt) && s.measures && typeof s.measures === 'object'; })
      .slice(0, 2000).map(function (s, i) {
        var c = s.context && typeof s.context === 'object' ? s.context : null;
        return { id: 's' + i, startedAt: isoOrNull(s.startedAt), condition: s.condition === 'nondominant' ? 'nondominant' : 'standard', completed: true, flagged: !!s.flagged, epoch: ep(s.epoch),
                 simulated: !!s.simulated, qa: !!s.qa,
                 context: c ? { sleep: oneOf(c.sleep, ['poor', 'ok', 'good']), sleepHours: oneOf(c.sleepHours, ['lt5', '5', '6', '7', '8plus']), unwell: !!c.unwell, mood: oneOf(c.mood, ['low', 'ok', 'good']), medChange: !!c.medChange } : null,
                 measures: { rt: num(s.measures.rt), sdmt: num(s.measures.sdmt), mem: num(s.measures.mem), gng: num(s.measures.gng) } };
      });
    var p = d.profile && typeof d.profile === 'object' ? d.profile : {};
    var out = {
      code: d.code, simulated: !!d.simulated, sessions: sessions, epoch: ep(d.epoch),
      access: (Array.isArray(d.events) ? d.events : []).filter(function (e) { return e && e.type === 'accessLimit' && isoOrNull(e.at); }).slice(-200)
        .map(function (e) { return isoOrNull(e.at); }),   // times the person said that seeing or tapping was difficult; not a red flag
      profile: { ageBand: oneOf(p.ageBand, ['18-29', '30-39', '40-49', '50-59', '60-69', '70+']), edu: oneOf(String(p.edu), ['1', '2', '3', '4']), hand: oneOf(p.hand, ['R', 'L']) },
      events: (Array.isArray(d.events) ? d.events : []).filter(function (e) { return e && e.type === 'redflag' && isoOrNull(e.at); }).slice(0, 200)
        .map(function (e) { return { type: 'redflag', at: isoOrNull(e.at) }; })
    };
    if (Array.isArray(d.eeg)) {
      var FEATS = ['rel_delta', 'rel_theta', 'rel_alpha', 'rel_beta', 'theta_alpha', 'slow_ratio', 'apf_cog'];
      out.eeg = d.eeg.filter(function (r) { return r && typeof r === 'object' && isoOrNull(r.at); }).slice(0, 500).map(function (r) {
        var f = r.features && typeof r.features === 'object' ? r.features : null, clean = {}, ok = !!f;
        FEATS.forEach(function (k) { clean[k] = f ? num(f[k]) : null; if (clean[k] === null) ok = false; });
        if (ok && !(clean.theta_alpha > 0 && clean.apf_cog > 0)) ok = false;
        return { at: isoOrNull(r.at), kind: oneOf(r.kind, ['muse', 'brainbit', 'clinical', 'other']) || 'other', fs: num(r.fs), seconds: num(r.seconds), nEpochs: num(r.nEpochs), nKept: num(r.nKept),
                 usable: !!r.usable && ok, simulated: !!r.simulated, features: ok ? clean : null };
      }).sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
    }
    if (d.risk && typeof d.risk === 'object' && d.risk.answers && typeof d.risk.answers === 'object') {
      var answers = {};
      (riskGroups || []).forEach(function (g) {
        g.items.forEach(function (q) {
          var v = d.risk.answers[q.id]; if (v === undefined || v === null) return;
          v = String(v);
          if (q.type === 'num') { if (/^\d{1,3}(\.\d{1,2})?$/.test(v)) answers[q.id] = v; }
          else if ((q.type === 'yn' ? ['yes', 'no', 'unsure'] : q.opts).indexOf(v) >= 0) answers[q.id] = v;
        });
      });
      out.risk = { updatedAt: isoOrNull(d.risk.updatedAt), answers: answers };
    }
    return { exportedAt: isoOrNull(file.exportedAt), data: out };
  }

  // One line per participant for the list, and the facts the detail page needs.
  function summarize(p, deps, now) {
    var d = p.data, e = deps.stats.evaluate(d.sessions, deps.config, now, d.epoch);
    var risk = d.risk ? deps.risk.evaluate(d.risk.answers, d.profile) : null;
    var flags = d.events.map(function (x) { return Date.parse(x.at); }).sort(function (a, b) { return a - b; });
    var lastFlag = flags.length ? flags[flags.length - 1] : null;
    var rv = p.review || {}, reviewedAt = rv.reviewed ? Date.parse(rv.at) : null;
    var lastAt = e.sessions.length ? Date.parse(e.sessions[e.sessions.length - 1].s.startedAt) : null;
    var urgent = lastFlag !== null && now - lastFlag <= 14 * DAY && !(reviewedAt !== null && reviewedAt >= lastFlag);
    var stale = reviewedAt !== null && ((lastAt !== null && lastAt > reviewedAt) || (lastFlag !== null && lastFlag > reviewedAt));
    var reviewed = reviewedAt !== null && !stale;
    var overdue = e.phase !== 'new' && now - e.nextDue > 14 * DAY;
    var status = urgent ? 'urgent' : e.light ? e.light : e.phase === 'monitoring' ? 'ready' : e.phase;      // urgent | red | yellow | green | ready | building | new
    var rank = urgent ? 0 : (status === 'red' && !reviewed) ? 1 : status === 'yellow' ? 2 : overdue ? 3 : status === 'red' ? 4 : status === 'green' ? 5 : 6;
    return { e: e, risk: risk, status: status, rank: rank, urgent: urgent, lastFlag: lastFlag, overdue: overdue, reviewed: reviewed, stale: stale, lastAt: lastAt,
             needsReview: urgent || (status === 'red' && !reviewed),
             accessAt: d.access && d.access.length ? Date.parse(d.access[d.access.length - 1]) : null };
  }

  // Which checklist items this participant's own answers point to. Returns {item: [[reasonKey, vars], ...]}.
  function prompts(p, sum, now) {
    var out = {}, risk = sum.risk, ctx = { poor: 0, unwell: 0, mood: 0, med: 0 };
    function add(item, key, vars) { (out[item] = out[item] || []).push([key, vars || {}]); }
    p.data.sessions.forEach(function (s) {
      if (!s.context || now - Date.parse(s.startedAt) > 90 * DAY) return;
      if (s.context.sleep === 'poor') ctx.poor++;
      if (s.context.unwell) ctx.unwell++;
      if (s.context.mood === 'low') ctx.mood++;
      if (s.context.medChange) ctx.med++;
    });
    var last = sum.e.last;
    if (ctx.unwell) add('acute', 'c.tr.unwell');
    if (last && last.light === 'red' && last.reasons.indexOf('trend') < 0) add('acute', 'c.tr.abrupt');
    if (ctx.med) add('meds', 'c.tr.med');
    if (ctx.mood) add('mood', 'c.tr.mood');
    if (ctx.poor) add('sleep', 'c.tr.poor', { n: ctx.poor });
    if (risk) {
      var has = function (id) { return risk.present.indexOf(id) >= 0; };
      if (risk.phq2 !== null && risk.phq2 >= 3) add('mood', 'c.tr.phq', { s: risk.phq2 });
      if (risk.context.snore) add('sleep', 'c.tr.snore');
      if (risk.context.shortSleep) add('sleep', 'c.tr.short');
      if (has('diabetes')) { add('b12', 'c.tr.dm'); add('bloods', 'c.tr.dmglu'); }
      if (has('hearing')) add('hearing', 'c.tr.hearing');
      if (has('vision')) add('vision', 'c.tr.vision');
    }
    if (sum.accessAt) add('vision', 'c.tr.access');
    if (risk) {
      if (has('alcohol')) add('alcohol', 'c.tr.alcohol');
      var v = VASCULAR.filter(has);
      if (v.length) add('vasc', 'c.tr.vasc', { ids: v });
    }
    return out;
  }

  var api = { CHECKLIST: CHECKLIST, DECISIONS: DECISIONS, sanitize: sanitize, summarize: summarize, prompts: prompts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.clin = api; }
})(typeof window !== 'undefined' ? window : globalThis);
