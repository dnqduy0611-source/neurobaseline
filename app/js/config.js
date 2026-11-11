/* NeuroBaseline – configuration.
   Every number that is an ASSUMPTION (not yet measured) is marked. They are to be
   replaced by values from the pilot (ICC, within-person SD) and from the literature. */
(function (root) {
  'use strict';
  var NB = root.NB = root.NB || {};
  var q = (root.location && root.location.search) || '';
  var qa = /[?&]qa=1/.test(q), fast = /[?&]fast=1/.test(q);

  var C = {
    version: '0.1.0',
    qa: qa, fast: fast, demoParam: /[?&]demo=1/.test(q),   // index.html?demo=1 opens the simulated demo profile directly
    keys: { real: 'nb.v1', demo: 'nb.demo.v1', qa: 'nb.qa.v1', lang: 'nb.lang', mode: 'nb.mode' },

    // --- Test parameters ---
    rt:   { trials: 20, practice: 3, practiceFirst: 5, foreMin: 1000, foreMax: 3000, timeout: 2000, minValid: 100, maxValid: 1500, minValidShare: 0.6 },
    gng:  { trials: 48, nogo: 12, practice: 6, practiceNogo: 2, practiceFirst: 10, practiceFirstNogo: 3, stimMs: 500, windowMs: 900, itiMin: 600, itiMax: 1000, minValid: 100 },
    sdmt: { durationMs: 90000, practice: 4, practiceFirst: 6, minAttempted: 5 },
    mem:  { targets: 8, studyMs: 2000, gapMs: 400 },

    // --- Schedule: measurement burst first, then monthly ---
    schedule: { burstGapDays: 2, minGapHours: 12, monthlyDays: 30, retestDays: 14 },

    // --- Personal baseline and reliable change ---
    baseline: { n: 4 },            // sessions 2-5 (session 1 is familiarisation)
    rci: { z: 1.96, zRed: 3.0, nu0: 6 },   // z: yellow (repeat in 2 weeks); zRed: needed for red; nu0 = weight of the prior within-person SD
    // Trend test over all sessions (sim/REPORT.md). In the simulation, zRed 3.0 with trend 3.0 / 3.5 refers about 6 % of stable
    // people over three years. These limits are ASSUMPTIONS until checked on real data.
    trend: { yellow: 3.0, red: 3.5, minAfter: 2, clip: 3 },
    // Resting EEG from a headband (optional). The first baselineN usable recordings form the personal EEG baseline.
    // sigmaLogRatio and sigmaCog are the assumed day-to-day SD of log(theta/alpha) and of the alpha centre of gravity (Hz).
    // ASSUMPTIONS: no repeated-day headband data exist yet. Within one recording the SDs were about 0.1 and 0.07 Hz (eeg/REPORT.md).
    eeg: { baselineN: 2, z: 1.96, sigmaLogRatio: 0.20, sigmaCog: 0.20 },

    // worse: +1 means a higher value is worse, -1 means a lower value is worse.
    // sigmaW = prior within-person SD between sessions. ASSUMPTIONS until the pilot.
    indicators: [
      { id: 'rt',   worse: +1, primary: true,  sigmaW: 25,  unit: 'ms' },
      { id: 'sdmt', worse: -1, primary: true,  sigmaW: 4,   unit: '' },
      { id: 'mem',  worse: -1, primary: true,  sigmaW: 1.2, unit: '' },
      { id: 'gng',  worse: +1, primary: false, sigmaW: 8,   unit: '%' }   // supporting only (weaker evidence)
    ]
  };

  if (fast) { // shortened protocol, QA only
    C.rt.trials = 6; C.rt.practice = 1; C.rt.practiceFirst = 1; C.rt.foreMin = 250; C.rt.foreMax = 500;
    C.gng.trials = 12; C.gng.nogo = 3; C.gng.practice = 3; C.gng.practiceNogo = 1; C.gng.practiceFirst = 3; C.gng.practiceFirstNogo = 1; C.gng.itiMin = 200; C.gng.itiMax = 300;
    C.sdmt.durationMs = 6000; C.sdmt.practice = 2; C.sdmt.practiceFirst = 2;
    C.mem.studyMs = 250; C.mem.gapMs = 80;
  }

  NB.config = C;
  NB.clockOffsetMs = 0;                                   // QA: shift the clock to simulate later days
  NB.now = function () { return Date.now() + (NB.clockOffsetMs || 0); };
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
