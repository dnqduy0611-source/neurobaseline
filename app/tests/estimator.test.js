/* Unit tests for js/estimator.js and the model file it reads. Run:  node tests/estimator.test.js  (from the app folder) */
'use strict';
var assert = require('assert');
var C = require('../js/config.js');
var ST = require('../js/stats.js');
var HB = require('../js/habits.js');
var EEG = require('../js/eeg-core.js');
var DC = require('../js/demo-cohort.js');
var E = require('../js/estimator.js');
var M = require('../js/estimator-model.js');
var DEPS = { stats: ST, config: C, habits: HB, eeg: EEG, model: M }, DAY = 864e5, NOW = new Date(2026, 10, 17, 9, 0, 0).getTime();
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }
function person(code) { return JSON.parse(JSON.stringify(DC.build(NOW).filter(function (x) { return x.code === code; })[0])); }
function average(extra) { var x = {}; M.features.forEach(function (id, k) { x[id] = M.mean[k]; }); return Object.assign(x, extra || {}); }
function p(extra) { return E.estimate(M, average(extra)).p; }
function ids(list) { return list.map(function (q) { return q.id; }); }

test('the app gives the same probabilities as the training script', function () {
  assert.ok(M.checks.length >= 5);
  M.checks.forEach(function (c) {
    var x = {}; M.features.forEach(function (id, k) { x[id] = c.x[k]; });
    assert.ok(Math.abs(E.estimate(M, x).p - c.p) < 1e-6, JSON.stringify(c));
  });
});
test('an input the app does not have counts as the average and contributes nothing', function () {
  var none = E.estimate(M, { trend: null, zmean: null, flag: null, sleep: null, eeg: null });
  assert.ok(Math.abs(none.logit - M.base) < 1e-12); assert.deepStrictEqual(none.missing, M.features); assert.deepStrictEqual(none.up.concat(none.down), []);
  var some = E.estimate(M, average({ sleep: null, eeg: undefined }));
  assert.ok(Math.abs(some.p - p()) < 1e-12); assert.deepStrictEqual(some.missing, ['sleep', 'eeg']);
  assert.strictEqual(some.parts.filter(function (q) { return q.id === 'sleep'; })[0].value, null);
});
test('each input moves the estimate the way its explanation says', function () {
  assert.ok(p({ trend: 3 }) > p({ trend: 1 }));             // earlier sessions already drifting: towards lasting
  assert.ok(p({ zmean: 2.5 }) > p({ zmean: 0.5 }));         // all measures moved together: towards lasting
  assert.ok(p({ flag: 1 }) < p({ flag: 0 }));               // an unusual day was reported: towards temporary
  assert.ok(p({ sleep: 2 }) < p({ sleep: 0 }));             // a short night before the session: towards temporary
  assert.ok(p({ eeg: 2.5 }) > p({ eeg: 0 }));               // the EEG is slower as well: towards lasting
});
test('inputs are kept inside the range seen in training', function () {
  assert.strictEqual(p({ trend: 50 }), p({ trend: 8 })); assert.strictEqual(p({ zmean: -9 }), p({ zmean: -2 }));
  assert.strictEqual(p({ sleep: 6 }), p({ sleep: 2.5 })); assert.strictEqual(p({ eeg: 40 }), p({ eeg: 6 }));
});
test('three bands, each with the share of true changes seen in the simulated test cohorts', function () {
  var low = E.estimate(M, average({ trend: 0, flag: 1 })), mid = E.estimate(M, average({ trend: 2.1 })), high = E.estimate(M, average({ trend: 4 }));
  assert.ok(low.p < M.bands[0]); assert.strictEqual(low.band, 'temporary'); assert.strictEqual(low.seen, M.test.bands[0].rate);
  assert.ok(mid.p >= M.bands[0] && mid.p <= M.bands[1]); assert.strictEqual(mid.band, 'unclear'); assert.strictEqual(mid.seen, M.test.bands[1].rate);
  assert.ok(high.p > M.bands[1]); assert.strictEqual(high.band, 'lasting'); assert.strictEqual(high.seen, M.test.bands[2].rate);
  assert.ok(M.test.bands[0].rate < M.test.bands[1].rate && M.test.bands[1].rate < M.test.bands[2].rate);
});
test('only inputs that matter are named, strongest first', function () {
  var out = E.estimate(M, { trend: 4, zmean: 2, flag: 1, sleep: 2, eeg: null });
  assert.deepStrictEqual(ids(out.up), ['trend', 'zmean']); assert.deepStrictEqual(ids(out.down), ['flag', 'sleep']);
  var quiet = E.estimate(M, average({ flag: 0 }));                                  // not reporting an unusual day says little
  assert.deepStrictEqual(ids(quiet.up.concat(quiet.down)), []);
  out.up.concat(out.down).forEach(function (q) { assert.ok(Math.abs(q.contrib) >= E.MIN_SHOWN); });
});
test('nothing is estimated unless the rule has flagged the latest session', function () {
  ['DEMO-D02', 'DEMO-E09', 'DEMO-H06'].forEach(function (code) { assert.strictEqual(E.fromData(person(code), DEPS, NOW), null, code); });
  assert.strictEqual(E.fromData({ sessions: [] }, DEPS, NOW), null);
});
test('the inputs are read from the flagged session and the session before it', function () {
  var d = person('DEMO-C07'), e = ST.evaluate(d.sessions, C, NOW, 0), fus = e.sessions.filter(function (s) { return s.role === 'followup'; }), last = e.last;
  var x = E.inputs(d, DEPS, NOW);
  assert.strictEqual(e.light, 'yellow'); assert.strictEqual(x.flag, 1);
  assert.strictEqual(x.trend, fus[fus.length - 2].trend.stat);                       // the trend before this session, not at it
  var z = ['rt', 'sdmt', 'mem'].map(function (id) { return last.ind[id].rci; });
  assert.ok(Math.abs(x.zmean - (z[0] + z[1] + z[2]) / 3) < 1e-12);                   // the supporting indicator is left out
  assert.strictEqual(x.sleep, null); assert.strictEqual(x.eeg, null);
  var out = E.fromData(d, DEPS, NOW);
  assert.strictEqual(out.band, 'temporary'); assert.ok(ids(out.down).indexOf('flag') >= 0); assert.deepStrictEqual(out.missing, ['sleep', 'eeg']);
  // As in training, there is no earlier trend until two earlier follow-up sessions count towards it; an unusual day does not count.
  var a = person('DEMO-A04'), fa = ST.evaluate(a.sessions, C, NOW, 0).sessions, k = fa.map(function (q) { return q.role; }).indexOf('followup');
  var worse = function (s) { s = JSON.parse(JSON.stringify(s)); s.measures.rt += 200; s.measures.sdmt -= 30; s.measures.mem -= 8; return s; };
  var early = a.sessions.slice(0, k).concat([worse(a.sessions[k]), worse(a.sessions[k + 1])]);
  var ev = ST.evaluate(early, C, NOW, 0).sessions.filter(function (q) { return q.role === 'followup'; });
  assert.strictEqual(ev.length, 2); assert.ok(ev[0].trend && ev[0].trend.stat > 0);       // the app's rule has a value after one follow-up session
  assert.strictEqual(E.inputs({ sessions: early }, DEPS, NOW).trend, 0);                  // the model does not use it yet
  var third = early.concat([worse(a.sessions[k + 2])]), flaggedDay = JSON.parse(JSON.stringify(third)); flaggedDay[k + 1].flagged = true;
  assert.ok(E.inputs({ sessions: third }, DEPS, NOW).trend > 0);                          // two earlier follow-up sessions: used
  assert.strictEqual(E.inputs({ sessions: flaggedDay }, DEPS, NOW).trend, 0);             // one of the two was an unusual day: not yet
});
test('sleep comes from the answer before the session, else from that day\'s check-in', function () {
  var d = person('DEMO-C07'), s = d.sessions[d.sessions.length - 1], day = HB.dayKey(Date.parse(s.startedAt));
  d.habits = [{ day: day, sleepH: 'lt5' }, { day: HB.addDays(day, -1), sleepH: '8plus' }];
  assert.strictEqual(E.inputs(d, DEPS, NOW).sleep, 2.5);                             // 7 - 4.5 hours
  s.context.sleepHours = '5';
  assert.strictEqual(E.inputs(d, DEPS, NOW).sleep, 2);                               // the session's own answer comes first
  s.context.sleepHours = '8plus';
  assert.strictEqual(E.inputs(d, DEPS, NOW).sleep, 0);
});
test('an EEG recording is used only when it is close to the session and has a baseline', function () {
  var d = person('DEMO-C07'), at = Date.parse(d.sessions[d.sessions.length - 1].startedAt);
  function rec(daysBefore, ratio) { return { id: 'r' + daysBefore, at: new Date(at - daysBefore * DAY).toISOString(), kind: 'muse', usable: true, features: { theta_alpha: ratio, apf_cog: 9.8 } }; }
  d.eeg = [rec(200, 0.30), rec(190, 0.30)];
  assert.strictEqual(E.inputs(d, DEPS, NOW).eeg, null);                              // baseline recordings only
  d.eeg.push(rec(60, 0.50));
  assert.strictEqual(E.inputs(d, DEPS, NOW).eeg, null);                              // too far from the session
  d.eeg.push(rec(3, 0.45));
  var z = Math.log(0.45 / 0.30) / (C.eeg.sigmaLogRatio * Math.sqrt(1.5));
  assert.ok(Math.abs(E.inputs(d, DEPS, NOW).eeg - z) < 1e-9);
  assert.ok(E.fromData(d, DEPS, NOW).p > E.fromData(person('DEMO-C07'), DEPS, NOW).p);   // a slower EEG raises the estimate
  d.eeg.push(null, 7, { at: 'x' });
  assert.ok(Math.abs(E.inputs(d, DEPS, NOW).eeg - z) < 1e-9);                         // damaged entries are skipped, not fatal
});
console.log('\n' + n + ' tests passed');
