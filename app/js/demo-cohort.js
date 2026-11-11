/* NeuroBaseline – simulated cohort for the clinician view. SIMULATED DATA, fictional people.
   Each entry has the same shape as the `data` part of a file exported from the participant app.
   Runs in the browser (NB.demoCohort) and in Node (module.exports) so a test can pin the intended statuses. */
(function (root) {
  'use strict';
  var DAY = 864e5;

  function rng(seed) {                                    // deterministic noise, roughly normal
    var a = seed >>> 0;
    function u() { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    return function () { return (u() + u() + u() + u() - 2) * 1.73; };
  }
  var OK = { sleep: 'ok', unwell: false, mood: 'ok', medChange: false };

  // spec: {code, seed, profile, level: {rt, sdmt, mem}, months, lastDaysAgo, change(m) -> {rt, sdmt, mem} offsets, context(m), risk, events}
  function person(now, s) {
    var g = rng(s.seed), n = s.months, total = 13 + 30 * n, start = now - (total + (s.lastDaysAgo || 1)) * DAY, sessions = [];
    function add(day, m, ctx, off, warm) {
      var c = ctx || OK;
      sessions.push({
        id: s.code + '-' + sessions.length, startedAt: new Date(start + day * DAY).toISOString(), finishedAt: new Date(start + day * DAY + 5.5 * 60000).toISOString(),
        condition: 'standard', completed: true, simulated: true, context: c,
        flagged: !!(c.sleep === 'poor' || c.unwell || c.mood === 'low' || c.medChange),
        measures: { rt: Math.round(s.level.rt + (warm ? 22 : 0) + (off.rt || 0) + 8 * g()), sdmt: Math.round(s.level.sdmt - (warm ? 5 : 0) + (off.sdmt || 0) + 1.2 * g()),
                    mem: Math.max(-8, Math.min(8, Math.round(s.level.mem - (warm ? 1 : 0) + (off.mem || 0) + 0.45 * g()))), gng: Math.max(0, Math.round((8 + 6 * g()) / 8.33) * 8.33), gngGoRt: null, rtCv: null }
      });
    }
    var burst = [0, 3, 6, 9, 13].slice(0, s.burst || 5);
    burst.forEach(function (d, i) { add(d, 0, null, {}, i === 0); });
    for (var m = 1; m <= n; m++) add(13 + 30 * m, m, s.context ? s.context(m) : null, s.change ? s.change(m) : {}, false);
    return { schema: 1, code: s.code, simulated: true, createdAt: new Date(start).toISOString(), consentAt: new Date(start).toISOString(), profile: s.profile, sessions: sessions,
             events: (s.events || []).map(function (e) { return { type: e.type, at: new Date(now - e.daysAgo * DAY).toISOString() }; }),
             risk: s.risk ? { consentAt: new Date(start).toISOString(), updatedAt: new Date(start + 2 * DAY).toISOString(), answers: s.risk } : undefined };
  }

  var SPECS = [
    { code: 'DEMO-A04', seed: 11, profile: { ageBand: '60-69', edu: '4', hand: 'R' }, level: { rt: 322, sdmt: 56, mem: 7.4 }, months: 12,       // slow drift in a highly educated person -> trend
      change: function (m) { return { rt: 3.2 * m, sdmt: -0.55 * m, mem: -0.13 * m }; },
      risk: { height: '168', weight: '70', htn: 'yes', dm: 'no', chol: 'yes', chd: 'no', ckd: 'no', hearing: 'yes', vision: 'no', tbi: 'no', activity: 'ok', smoke: 'never', alcohol: 'none', diet: 'yes', cog: 'high', social: 'weekly', phq1: '0', phq2: '1', sleep: 'ok', snore: 'no', fam: 'yes' } },
    { code: 'DEMO-B11', seed: 23, profile: { ageBand: '70+', edu: '2', hand: 'R' }, level: { rt: 372, sdmt: 41, mem: 6.3 }, months: 11,          // earlier stage of a drift -> watch
      change: function (m) { return { rt: 2.6 * m, sdmt: -0.42 * m, mem: -0.1 * m }; } },
    { code: 'DEMO-C07', seed: 37, profile: { ageBand: '50-59', edu: '3', hand: 'L' }, level: { rt: 338, sdmt: 50, mem: 7.2 }, months: 6,         // one slow session after a bad night
      change: function (m) { return m === 6 ? { rt: 58 } : {}; }, context: function (m) { return m === 6 ? { sleep: 'poor', unwell: false, mood: 'ok', medChange: false } : null; } },
    { code: 'DEMO-D02', seed: 41, profile: { ageBand: '60-69', edu: '2', hand: 'R' }, level: { rt: 356, sdmt: 45, mem: 6.8 }, months: 14,        // stable
      risk: { height: '175', weight: '78', htn: 'yes', dm: 'no', chol: 'no', chd: 'no', ckd: 'no', hearing: 'aided', vision: 'no', tbi: 'no', activity: 'ok', smoke: 'former', alcohol: 'none', diet: 'yes', cog: 'high', social: 'weekly', phq1: '0', phq2: '0', sleep: 'ok', snore: 'no', fam: 'no' } },
    { code: 'DEMO-E09', seed: 53, profile: { ageBand: '50-59', edu: '3', hand: 'R' }, level: { rt: 330, sdmt: 52, mem: 7.3 }, months: 0, burst: 3, lastDaysAgo: 2 },   // still in the baseline phase
    { code: 'DEMO-F05', seed: 67, profile: { ageBand: '70+', edu: '1', hand: 'R' }, level: { rt: 395, sdmt: 36, mem: 5.8 }, months: 7,           // abrupt change in two domains
      change: function (m) { return m === 7 ? { rt: 110, sdmt: -15, mem: -1 } : {}; },
      risk: { height: '160', weight: '58', htn: 'no', dm: 'no', chol: 'unsure', chd: 'no', ckd: 'no', hearing: 'no', vision: 'yes', tbi: 'no', activity: 'low', smoke: 'never', alcohol: 'none', diet: 'no', cog: 'low', social: 'rare', phq1: '2', phq2: '2', sleep: 'short', snore: 'no', fam: 'unsure' } },
    { code: 'DEMO-G13', seed: 79, profile: { ageBand: '60-69', edu: '3', hand: 'R' }, level: { rt: 345, sdmt: 48, mem: 7.0 }, months: 5, lastDaysAgo: 20,   // stable, but reported red-flag symptoms
      events: [{ type: 'redflag', daysAgo: 2 }] },
    { code: 'DEMO-H06', seed: 83, profile: { ageBand: '60-69', edu: '2', hand: 'R' }, level: { rt: 362, sdmt: 44, mem: 6.6 }, months: 8, lastDaysAgo: 82 }  // stable, overdue
  ];

  function build(now) {
    var out = SPECS.map(function (s) { return person(now, s); });
    if (root.NB && root.NB.demo) out.unshift(root.NB.demo.build(now));       // "Mr Rashid" from the participant app's demo profile
    return out;
  }
  var api = { build: build, SPECS: SPECS, person: person };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.demoCohort = api; }
})(typeof window !== 'undefined' ? window : globalThis);
