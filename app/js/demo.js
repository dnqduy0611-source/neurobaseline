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
  function build(nowMs) {
    var DAY = 864e5, start = nowMs - 298 * DAY, sessions = ROWS.map(function (r, i) {
      var at = start + r[0] * DAY, poor = !!r[5];
      return {
        id: 'demo' + i, startedAt: new Date(at).toISOString(), finishedAt: new Date(at + 5.5 * 60000).toISOString(),
        condition: 'standard', completed: true, simulated: true, flagged: poor,
        context: { sleep: poor ? 'poor' : 'ok', unwell: false, mood: 'ok', medChange: false },
        measures: { rt: r[1], sdmt: r[2], mem: r[3], gng: r[4], gngGoRt: null, rtCv: null }
      };
    });
    return { schema: 1, code: 'DEMO-RASHID', simulated: true, createdAt: new Date(start).toISOString(), consentAt: new Date(start).toISOString(),
             profile: { ageBand: '50-59', edu: '2', hand: 'R' }, sessions: sessions, events: [],
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
