/* NeuroBaseline – demo profile. SIMULATED DATA for a fictional person ("Mr Rashid", 58).
   Used to show ten months of history in a two-minute demo. Every session is tagged simulated:true. */
(function () {
  'use strict';
  var NB = window.NB;
  // [days after enrolment, reaction time ms, symbol matching, picture memory, wrong taps %, flagged?]
  var ROWS = [
    [0, 372, 41, 6, 17], [3, 356, 45, 7, 8], [6, 347, 47, 7, 8], [9, 352, 46, 8, 17], [13, 345, 48, 7, 8],   // warm-up + baseline burst
    [43, 348, 47, 7, 8], [73, 357, 46, 8, 17], [103, 344, 48, 7, 8], [133, 353, 45, 7, 8],                    // months 1-8: stable
    [163, 361, 47, 8, 8], [193, 349, 46, 7, 17], [223, 358, 45, 7, 8], [253, 366, 44, 6, 17],
    [283, 410, 43, 6, 17, true],                                                                              // month 9: slower, reports poor sleep
    [297, 404, 37, 6, 25, true]                                                                               // repeat after 2 weeks: still slow, symbol matching down
  ];
  function habits(nowMs) { // eight weeks of daily check-ins ending yesterday: steady at first, then three weeks of short sleep
    var seed = 20261, out = [];
    function r() { seed = (seed * 48271) % 2147483647; return seed / 2147483647; }
    function pick(p, vals) { var x = r(), acc = 0; for (var i = 0; i < p.length; i++) { acc += p[i]; if (x < acc) return vals[i]; } return vals[vals.length - 1]; }
    function key(ms) { var d = new Date(ms); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    for (var k = 56; k >= 1; k--) {
      var late = k <= 21, skip = r() < 0.1;
      var e = { day: key(nowMs - k * 864e5), simulated: true,
                sleepH: late ? pick([0.25, 0.55], ['lt5', '5', '6']) : pick([0.15, 0.65], ['6', '7', '8plus']),
                sleepQ: late ? pick([0.6], ['poor', 'ok']) : pick([0.15, 0.45], ['poor', 'ok', 'good']),
                active: late ? pick([0.6, 0.3], ['none', 'some', '30plus']) : pick([0.3, 0.4], ['none', 'some', '30plus']),
                social: r() < (late ? 0.2 : 0.45) ? 'yes' : 'no' };
      if (!skip) out.push(e);
    }
    return out;
  }
  function build(nowMs) {
    var DAY = 864e5, start = nowMs - 298 * DAY, sessions = ROWS.map(function (r, i) {
      var at = start + r[0] * DAY, poor = !!r[5];
      return {
        id: 'demo' + i, startedAt: new Date(at).toISOString(), finishedAt: new Date(at + 5.5 * 60000).toISOString(),
        condition: 'standard', completed: true, simulated: true, flagged: poor,
        context: { sleep: poor ? 'poor' : 'ok', sleepHours: poor ? '5' : '7', unwell: false, mood: 'ok', medChange: false },
        measures: { rt: r[1], sdmt: r[2], mem: r[3], gng: r[4], gngGoRt: null, rtCv: null }
      };
    });
    return { schema: 1, code: 'DEMO-RASHID', simulated: true, createdAt: new Date(start).toISOString(), consentAt: new Date(start).toISOString(),
             profile: { ageBand: '50-59', edu: '2', hand: 'R' }, sessions: sessions, events: [], habits: habits(nowMs),
             eeg: [[2, 0.31, 9.82], [10, 0.33, 9.76], [105, 0.30, 9.85], [198, 0.36, 9.70], [297, 0.56, 9.05]].map(function (r, i) {     // simulated headband summaries
               return { id: 'demoeeg' + i, at: new Date(start + r[0] * DAY).toISOString(), kind: 'muse', fs: 256, seconds: 180, nEpochs: 45, nKept: 41, usable: true, simulated: true,
                        features: { rel_delta: 0.3, rel_theta: +(0.42 * r[1] / (1 + r[1])).toFixed(3), rel_alpha: +(0.42 / (1 + r[1])).toFixed(3), rel_beta: 0.28, theta_alpha: r[1], slow_ratio: 1, apf_cog: r[2] } };
             }),
             risk: { consentAt: new Date(start).toISOString(), updatedAt: new Date(start + 2 * DAY).toISOString(), answers: {   // simulated risk profile
               height: '172', weight: '92', htn: 'yes', dm: 'yes', chol: 'yes', chd: 'no', ckd: 'no', hearing: 'no', vision: 'no', tbi: 'no', activity: 'low', smoke: 'former',
               alcohol: 'none', diet: 'no', cog: 'low', social: 'weekly', phq1: '1', phq2: '0', sleep: 'short', snore: 'yes', fam: 'unsure' } } };
  }
  NB.demo = { build: build };
})();
