/* Unit tests for js/stats.js. Run:  node tests/stats.test.js  (from the app folder) */
'use strict';
var assert = require('assert');
var C = require('../js/config.js');
var ST = require('../js/stats.js');
var DAY = 864e5, T0 = Date.parse('2026-11-01T08:00:00Z');
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }
function near(a, b, eps, msg) { assert.ok(Math.abs(a - b) <= (eps || 1e-6), (msg || '') + ' expected ' + b + ' got ' + a); }
function sess(day, m, extra) {
  var s = { id: 's' + day, startedAt: new Date(T0 + day * DAY).toISOString(), condition: 'standard', completed: true, flagged: false,
            measures: Object.assign({ rt: null, sdmt: null, mem: null, gng: null }, m) };
  return Object.assign(s, extra || {});
}
function hist(extra) { // warm-up + 4 baseline sessions: rt mean 350, sdmt mean 46.5, mem mean 7.25
  return [sess(0, { rt: 372, sdmt: 41, mem: 6, gng: 17 }), sess(3, { rt: 356, sdmt: 45, mem: 7, gng: 8 }), sess(6, { rt: 347, sdmt: 47, mem: 7, gng: 8 }),
          sess(9, { rt: 352, sdmt: 46, mem: 8, gng: 17 }), sess(13, { rt: 345, sdmt: 48, mem: 7, gng: 8 })].concat(extra || []);
}

test('median, mean, sd', function () {
  assert.strictEqual(ST.median([3, 1, 2]), 2); assert.strictEqual(ST.median([4, 1, 3, 2]), 2.5); assert.strictEqual(ST.median([]), null);
  near(ST.sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.13809, 1e-4); assert.strictEqual(ST.sd([5]), null);
});
test('summarizeRT filters anticipations and lapses', function () {
  var s = ST.summarizeRT([{ rt: 300 }, { rt: 320 }, { rt: 340 }, { rt: 50 }, { rt: 1800 }, { rt: null }], C.rt);
  assert.strictEqual(s.nValid, 3); assert.strictEqual(s.median, 320); assert.strictEqual(s.anticipatory, 1); assert.strictEqual(s.lapses, 2);
  assert.strictEqual(s.usable, false); // only 3 of 6 valid, below 60 %
});
test('summarizeGNG, SDMT, memory', function () {
  var g = ST.summarizeGNG([{ nogo: false, rt: 400 }, { nogo: false, rt: null }, { nogo: true, rt: 380 }, { nogo: true, rt: null }, { nogo: false, rt: 420 }, { nogo: false, rt: 410 }], C.gng);
  assert.strictEqual(g.commissionPct, 50); assert.strictEqual(g.omissionPct, 25); assert.strictEqual(g.goRtMedian, 410);
  var d = ST.summarizeSDMT([{ ok: true, rt: 1000 }, { ok: false, rt: 1200 }, { ok: true, rt: 1100 }, { ok: true, rt: 900 }, { ok: true, rt: 1000 }], C.sdmt);
  assert.strictEqual(d.correct, 4); assert.strictEqual(d.errors, 1);
  var m = ST.summarizeMem([{ old: true, ans: 'old', rt: 1 }, { old: true, ans: 'new', rt: 1 }, { old: false, ans: 'old', rt: 1 }, { old: false, ans: 'new', rt: 1 }]);
  assert.strictEqual(m.hits, 1); assert.strictEqual(m.falseAlarms, 1); assert.strictEqual(m.score, 0);
});
test('pooledSigma: prior only, then blended', function () {
  assert.strictEqual(ST.pooledSigma(25, 6, [350]), 25);
  var v = ST.variance([356, 347, 352, 345]);
  near(ST.pooledSigma(25, 6, [356, 347, 352, 345]), Math.sqrt((6 * 625 + 3 * v) / 9), 1e-9);
  assert.ok(ST.pooledSigma(25, 6, [356, 347, 352, 345]) < 25); // a stable person gets a narrower range
});
test('S_diff = sigma * sqrt(1 + 1/n): thresholds 69 / 60 / 55 / 52 ms for sigma 25', function () {
  [[1, 69], [2, 60], [4, 55], [8, 52]].forEach(function (p) { assert.strictEqual(Math.round(1.96 * 25 * Math.sqrt(1 + 1 / p[0])), p[1]); });
});
test('roles and phases', function () {
  var e = ST.evaluate([], C, T0); assert.strictEqual(e.phase, 'new'); assert.strictEqual(e.nextDue, T0);
  e = ST.evaluate(hist().slice(0, 3), C, T0); assert.strictEqual(e.phase, 'building'); assert.strictEqual(e.done, 3); assert.strictEqual(e.total, 5);
  assert.strictEqual(e.nextDue, T0 + (6 + 2) * DAY);
  e = ST.evaluate(hist(), C, T0);
  assert.deepStrictEqual(e.sessions.map(function (a) { return a.role; }), ['familiarization', 'baseline', 'baseline', 'baseline', 'baseline']);
  assert.strictEqual(e.phase, 'monitoring'); assert.strictEqual(e.light, null); near(e.bands.rt.mean, 350); assert.strictEqual(e.nextDue, T0 + 43 * DAY);
});
test('flagged session during the burst is not used for the baseline', function () {
  var h = hist(); h[2].flagged = true;
  var e = ST.evaluate(h, C, T0); assert.strictEqual(e.sessions[2].role, 'excluded'); assert.strictEqual(e.phase, 'building'); assert.strictEqual(e.done, 4);
});
test('green follow-up', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 358, sdmt: 46, mem: 7, gng: 8 })]), C, T0);
  assert.strictEqual(e.light, 'green'); assert.strictEqual(e.nextDue, T0 + 73 * DAY);
});
test('RCI value matches the formula', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 410, sdmt: 46, mem: 7, gng: 8 })]), C, T0), x = e.last.ind.rt;
  var sig = ST.pooledSigma(25, 6, [356, 347, 352, 345]);
  near(x.rci, (410 - 350) / (sig * Math.sqrt(1.25)), 1e-9); assert.ok(x.exceeds);
});
test('yellow beyond z = 1.96, retest in 14 days; a moderate change that repeats stays yellow', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 410, sdmt: 46, mem: 7, gng: 8 })]), C, T0);   // z = 2.6: beyond 1.96, below 3.0
  assert.strictEqual(e.light, 'yellow'); assert.deepStrictEqual(e.last.reasons, ['first']); assert.strictEqual(e.nextDue, T0 + 57 * DAY);
  assert.ok(e.last.ind.rt.exceeds && !e.last.ind.rt.exceedsRed);
  e = ST.evaluate(hist([sess(43, { rt: 410, sdmt: 46, mem: 7, gng: 8 }), sess(57, { rt: 405, sdmt: 45, mem: 7, gng: 8 })]), C, T0);
  assert.strictEqual(e.light, 'yellow');
});
test('red when a large change (z > 3.0) is confirmed on the repeat session', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 430, sdmt: 46, mem: 7, gng: 8 })]), C, T0);
  assert.strictEqual(e.light, 'yellow'); assert.ok(e.last.ind.rt.exceedsRed);          // one session is never enough for red
  e = ST.evaluate(hist([sess(43, { rt: 430, sdmt: 46, mem: 7, gng: 8 }), sess(57, { rt: 428, sdmt: 45, mem: 7, gng: 8 })]), C, T0);
  assert.strictEqual(e.light, 'red'); assert.deepStrictEqual(e.last.reasons, ['confirmed']);
});
test('back to green when the repeat session is normal', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 430, sdmt: 46, mem: 7, gng: 8 }), sess(57, { rt: 352, sdmt: 46, mem: 7, gng: 8 })]), C, T0);
  assert.strictEqual(e.light, 'green');
});
test('two primary areas beyond z = 3.0 at once: red; in a context-flagged session: yellow first', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 430, sdmt: 33, mem: 7, gng: 8 })]), C, T0);
  assert.strictEqual(e.light, 'red'); assert.deepStrictEqual(e.last.reasons, ['multi']);
  e = ST.evaluate(hist([sess(43, { rt: 430, sdmt: 33, mem: 7, gng: 8 }, { flagged: true })]), C, T0);
  assert.strictEqual(e.light, 'yellow'); assert.deepStrictEqual(e.last.reasons, ['multi', 'context']);
});
function drift(months, f) { var out = []; for (var m = 1; m <= months; m++) out.push(sess(13 + 30 * m, f(m))); return out; }
test('trend test: a slow drift with no single session beyond its limit ends in red', function () {
  var e = ST.evaluate(hist(drift(14, function (m) {
    return { rt: 350 + 3 * m + (m % 2 ? 4 : -4), sdmt: 46.5 - 0.45 * m + (m % 3 - 1) * 0.8, mem: 7.25 - 0.12 * m + (m % 2 ? 0.3 : -0.3), gng: 8 };
  })), C, T0);
  var fu = e.sessions.filter(function (a) { return a.role === 'followup'; });
  var firstYellow = fu.findIndex(function (a) { return a.light === 'yellow'; }), firstRed = fu.findIndex(function (a) { return a.light === 'red'; });
  assert.ok(firstYellow >= 4 && firstRed > firstYellow, 'yellow at ' + firstYellow + ', red at ' + firstRed);
  assert.deepStrictEqual(fu[firstYellow].reasons, ['trendWatch']); assert.deepStrictEqual(fu[firstRed].reasons, ['trend']);
  assert.strictEqual(fu[firstRed].exceed.length, 0);                                    // no single-session exceedance at that point
  assert.ok(fu[firstRed].trend.stat >= C.trend.red && fu[firstRed].trend.months >= 2);
  assert.ok(fu.slice(0, firstYellow).every(function (a) { return a.light === 'green'; }));
});
test('trend test: stable sessions with ordinary noise never raise it', function () {
  var e = ST.evaluate(hist(drift(24, function (m) { return { rt: 350 + (m % 2 ? 6 : -6), sdmt: 46.5 + (m % 3 - 1), mem: 7 + (m % 2), gng: 8 }; })), C, T0);
  assert.ok(e.sessions.every(function (a) { return a.role !== 'followup' || (a.light === 'green' && a.trend.stat < 1.5); }));
});
test('trend test: one wild session is capped and does not leave a lasting alarm', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 350, sdmt: 46, mem: 7 }), sess(73, { rt: 900, sdmt: 46, mem: 7 }), sess(87, { rt: 351, sdmt: 47, mem: 7 }), sess(117, { rt: 349, sdmt: 46, mem: 7 })]), C, T0);
  assert.deepStrictEqual(e.sessions.slice(5).map(function (a) { return a.light; }), ['green', 'yellow', 'green', 'green']);
  assert.ok(e.sessions[6].trend.stat < C.trend.yellow);
});
test('trend test: context-flagged sessions are left out', function () {
  var a = ST.evaluate(hist([sess(43, { rt: 352, sdmt: 46, mem: 7 }), sess(73, { rt: 351, sdmt: 46, mem: 7 }), sess(103, { rt: 400, sdmt: 40, mem: 5 }, { flagged: true })]), C, T0);
  var b = ST.evaluate(hist([sess(43, { rt: 352, sdmt: 46, mem: 7 }), sess(73, { rt: 351, sdmt: 46, mem: 7 })]), C, T0);
  var c = ST.evaluate(hist([sess(43, { rt: 352, sdmt: 46, mem: 7 }), sess(73, { rt: 351, sdmt: 46, mem: 7 }), sess(103, { rt: 400, sdmt: 40, mem: 5 })]), C, T0);
  near(a.last.trend.stat, b.last.trend.stat, 0.05);                 // same sessions in the trend (the noise estimate differs slightly)
  assert.ok(c.last.trend.stat > a.last.trend.stat + 1.5);           // the same session, not flagged, would have moved it
});
test('trendStat matches a direct calculation of the slope statistic', function () {
  // one indicator, level 10 for four baseline sessions at t = 0, then 9, 8, 7 at months 1, 2, 3; sigma 1; tau = 0
  var h = [0, 0, 0, 0, 1, 2, 3].map(function (t, i) { return { t: t, v: { x: [10, 10, 10, 10, 9, 8, 7][i] } }; });
  var r = ST.trendStat(h, [{ id: 'x', worse: -1, primary: true }], { x: { mean: 10, sigma: 1 } }, { trend: { minAfter: 2, clip: 3 } });
  // W = 7, Sr = 6, Srr = 14, Sy = 64, Sry = 9 + 16 + 21 = 46  ->  -(46 - 6*64/7) / sqrt(14 - 36/7)
  near(r.stat, -(46 - 6 * 64 / 7) / Math.sqrt(14 - 36 / 7), 1e-12); assert.strictEqual(r.tau, 0);
  assert.strictEqual(ST.trendStat(h.slice(0, 5), [{ id: 'x', worse: -1, primary: true }], { x: { mean: 10, sigma: 1 } }, { trend: { minAfter: 2, clip: 3 } }), null);   // one session after tau is not enough
});
test('supporting indicator alone (wrong taps) never changes the light', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 350, sdmt: 46, mem: 7, gng: 60 })]), C, T0);
  assert.strictEqual(e.light, 'green'); assert.ok(e.last.ind.gng.exceeds);
});
test('improvement is not an alert', function () {
  var e = ST.evaluate(hist([sess(43, { rt: 290, sdmt: 58, mem: 8, gng: 0 })]), C, T0);
  assert.strictEqual(e.light, 'green'); assert.ok(e.last.ind.rt.better);
});
test('other-hand control run: detected, and does not touch light or schedule', function () {
  var ctl = sess(13.01, { rt: 420, sdmt: 38 }, { condition: 'nondominant' });
  var e = ST.evaluate(hist([ctl]), C, T0), a = e.sessions[e.sessions.length - 1];
  assert.strictEqual(a.role, 'control'); assert.strictEqual(a.detected, true); assert.strictEqual(e.light, null); assert.strictEqual(e.nextDue, T0 + 43 * DAY);
});
test('demo profile ends red after a context-flagged yellow', function () {
  var rows = [[0, 372, 41, 6, 17], [3, 356, 45, 7, 8], [6, 347, 47, 7, 8], [9, 352, 46, 8, 17], [13, 345, 48, 7, 8], [43, 348, 47, 7, 8], [73, 357, 46, 8, 17], [103, 344, 48, 7, 8],
    [133, 353, 45, 7, 8], [163, 361, 47, 8, 8], [193, 349, 46, 7, 17], [223, 358, 45, 7, 8], [253, 366, 44, 6, 17], [283, 410, 43, 6, 17, true], [297, 404, 37, 6, 25, true]];
  var e = ST.evaluate(rows.map(function (r) { return sess(r[0], { rt: r[1], sdmt: r[2], mem: r[3], gng: r[4] }, { flagged: !!r[5] }); }), C, T0);
  var lights = e.sessions.map(function (a) { return a.light; }).slice(5);
  assert.deepStrictEqual(lights, ['green', 'green', 'green', 'green', 'green', 'green', 'green', 'green', 'yellow', 'red']);
  assert.deepStrictEqual(e.last.reasons, ['confirmed', 'context']);
});
test('seeded shuffle is reproducible', function () {
  var a = ST.shuffle([1, 2, 3, 4, 5, 6], ST.mulberry32(7)), b = ST.shuffle([1, 2, 3, 4, 5, 6], ST.mulberry32(7));
  assert.deepStrictEqual(a, b); assert.deepStrictEqual(a.slice().sort(), [1, 2, 3, 4, 5, 6]);
});
var PHONE = { ua: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', w: 360, h: 800, dpr: 3, touch: 5 };
test('device key ignores browser version and orientation', function () {
  assert.strictEqual(ST.deviceKey(PHONE), 'android/360x800/touch');
  assert.strictEqual(ST.deviceKey(Object.assign({}, PHONE, { ua: PHONE.ua.replace('130.0', '142.0'), w: 800, h: 360 })), 'android/360x800/touch');
  assert.notStrictEqual(ST.deviceKey(Object.assign({}, PHONE, { w: 412, h: 915 })), ST.deviceKey(PHONE));
  assert.strictEqual(ST.deviceKey({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', w: 1920, h: 1080, touch: 0 }), 'windows/1080x1920/pointer');
  assert.strictEqual(ST.deviceKey(null), null); assert.strictEqual(ST.deviceKey({ ua: 'x' }), null);
});
test('device check: only a device not yet used in this baseline period counts as a change', function () {
  var tablet = { ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', w: 820, h: 1180, touch: 5 };
  var ss = hist().map(function (s) { return Object.assign(s, { device: PHONE }); });
  assert.strictEqual(ST.deviceCheck([], 0, null, PHONE).changed, false);                          // nothing recorded yet
  assert.strictEqual(ST.deviceCheck(hist(), 0, null, PHONE).changed, false);                      // old sessions without a device
  assert.strictEqual(ST.deviceCheck(ss, 0, null, PHONE).changed, false);
  assert.strictEqual(ST.deviceCheck(ss, 0, null, tablet).changed, true);
  assert.strictEqual(ST.deviceCheck(ss, 0, [ST.deviceKey(tablet)], tablet).changed, false);       // the person confirmed it
  assert.strictEqual(ST.deviceCheck(ss, 1, null, tablet).changed, false);                         // new period: the old device no longer counts
  assert.strictEqual(ST.deviceCheck(ss, 0, null, { ua: 'x' }).changed, false);                    // unknown device: no alarm
});
test('a new baseline period after a change of device', function () {
  // On the old device the person is stable. The new device adds about 60 ms to every reaction time.
  var old = hist([sess(43, { rt: 348, sdmt: 47, mem: 7, gng: 8 }), sess(73, { rt: 357, sdmt: 46, mem: 8, gng: 17 })]);
  var slow = [[103, 412], [106, 405], [109, 409], [112, 414], [142, 408]].map(function (r) { return sess(r[0], { rt: r[1], sdmt: 46, mem: 7, gng: 8 }); });
  var same = ST.evaluate(old.concat(slow), C, T0 + 150 * DAY);                                    // without a new period: every session raises a flag
  assert.ok(same.sessions.slice(7).every(function (a) { return a.light === 'yellow' || a.light === 'red'; }));
  var opened = ST.evaluate(old, C, T0 + 100 * DAY, 1);                                            // period opened, no session yet
  assert.strictEqual(opened.phase, 'new'); assert.strictEqual(opened.rebased, true); assert.strictEqual(opened.light, null);
  assert.strictEqual(opened.done, 0); assert.strictEqual(opened.total, C.baseline.n); assert.strictEqual(opened.nextDue, T0 + 100 * DAY);
  assert.ok(opened.sessions.every(function (a) { return a.role === 'previous'; }));
  slow.forEach(function (s) { s.epoch = 1; });
  var part = ST.evaluate(old.concat(slow.slice(0, 2)), C, T0 + 107 * DAY, 1);
  assert.strictEqual(part.phase, 'building'); assert.strictEqual(part.done, 2); assert.strictEqual(part.light, null);
  var e = ST.evaluate(old.concat(slow), C, T0 + 150 * DAY);                                       // the period is read from the sessions too
  assert.deepStrictEqual(e.sessions.map(function (a) { return a.role; }).slice(7), ['baseline', 'baseline', 'baseline', 'baseline', 'followup']);
  assert.strictEqual(e.epoch, 1); assert.strictEqual(e.phase, 'monitoring'); assert.strictEqual(e.light, 'green');
  near(e.bands.rt.mean, 410, 1e-9); assert.strictEqual(e.last.ind.rt.exceeds, false);
  assert.strictEqual(e.sessions.filter(function (a) { return a.role === 'previous'; }).length, 7);
});
console.log('\n' + n + ' tests passed');
