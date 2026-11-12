/* Unit tests for js/clin-core.js and the simulated cohort. Run:  node tests/clin.test.js  (from the app folder) */
'use strict';
var assert = require('assert');
var C = require('../js/config.js');
var ST = require('../js/stats.js');
var RK = require('../js/risk.js');
var CL = require('../js/clin-core.js');
var DC = require('../js/demo-cohort.js');
var DEPS = { stats: ST, risk: RK, config: C }, DAY = 864e5, NOW = Date.parse('2026-11-13T09:00:00Z');
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }
function wrap(d) { return { app: 'NeuroBaseline', exportedAt: new Date(NOW).toISOString(), data: d }; }
function patient(d, extra) { var c = CL.sanitize(wrap(d), RK.GROUPS); return Object.assign({ code: c.data.code, data: c.data }, extra || {}); }
var COHORT = {}; DC.build(NOW).forEach(function (d) { COHORT[d.code] = d; });

test('sanitize rejects anything that is not a NeuroBaseline export', function () {
  assert.strictEqual(CL.sanitize(null), null); assert.strictEqual(CL.sanitize({ app: 'Other', data: {} }), null);
  assert.strictEqual(CL.sanitize(wrap({ code: '<img src=x onerror=alert(1)>', sessions: [] })), null);          // unsafe code
  assert.strictEqual(CL.sanitize(wrap({ code: 'NB-OK', sessions: 'nope' })), null);
});
test('sanitize keeps only expected fields and types', function () {
  var c = CL.sanitize(wrap({ code: 'NB-ABC12', profile: { ageBand: '<b>', edu: 3, hand: 'R', extra: 'x' }, events: [{ type: 'redflag', at: 'not a date' }, { type: 'quit', at: new Date(NOW).toISOString() }],
    sessions: [{ completed: true, startedAt: new Date(NOW).toISOString(), measures: { rt: '350', sdmt: 46, mem: NaN, gng: 8 }, context: { sleep: '<script>', sleepHours: '12', unwell: 1 }, note: '<script>' },
               { completed: false, startedAt: new Date(NOW).toISOString(), measures: {} }, { completed: true, startedAt: 'bad', measures: {} }],
    risk: { answers: { htn: 'yes', dm: '<x>', height: '172', weight: 'abc', unknown: 'yes' } } }), RK.GROUPS);
  assert.strictEqual(c.data.sessions.length, 1);
  assert.deepStrictEqual(c.data.sessions[0].measures, { rt: null, sdmt: 46, mem: null, gng: 8 });
  assert.deepStrictEqual(c.data.sessions[0].context, { sleep: null, sleepHours: null, unwell: true, mood: null, medChange: false });
  assert.strictEqual(c.data.sessions[0].note, undefined);
  assert.deepStrictEqual(c.data.profile, { ageBand: null, edu: '3', hand: 'R' });
  assert.strictEqual(c.data.events.length, 0);
  assert.deepStrictEqual(c.data.risk.answers, { height: '172', htn: 'yes' });
});
test('simulated cohort shows every status the view must handle', function () {
  var want = { 'DEMO-A04': ['red', 'trend'], 'DEMO-B11': ['yellow', 'trendWatch'], 'DEMO-C07': ['yellow', 'first'], 'DEMO-D02': ['green'], 'DEMO-E09': ['building'],
               'DEMO-F05': ['red', 'multi'], 'DEMO-G13': ['urgent'], 'DEMO-H06': ['green'] };
  Object.keys(want).forEach(function (code) {
    var s = CL.summarize(patient(COHORT[code]), DEPS, NOW);
    assert.strictEqual(s.status, want[code][0], code + ' status ' + s.status);
    if (want[code][1]) assert.ok(s.e.last.reasons.indexOf(want[code][1]) >= 0, code + ' reasons ' + s.e.last.reasons);
  });
  assert.strictEqual(CL.summarize(patient(COHORT['DEMO-H06']), DEPS, NOW).overdue, true);
  assert.strictEqual(CL.summarize(patient(COHORT['DEMO-D02']), DEPS, NOW).overdue, false);
});
test('priority order: red flag, unreviewed red, yellow, overdue, reviewed red, green, baseline phase', function () {
  var rank = function (code, extra) { return CL.summarize(patient(COHORT[code], extra), DEPS, NOW).rank; };
  var reviewed = { review: { reviewed: true, at: new Date(NOW).toISOString() } };
  assert.deepStrictEqual([rank('DEMO-G13'), rank('DEMO-A04'), rank('DEMO-B11'), rank('DEMO-H06'), rank('DEMO-A04', reviewed), rank('DEMO-D02'), rank('DEMO-E09')], [0, 1, 2, 3, 4, 5, 6]);
});
test('review: clears the need for review, until new data or a new red flag arrives', function () {
  var old = { review: { reviewed: true, at: new Date(NOW - 400 * DAY).toISOString() } }, fresh = { review: { reviewed: true, at: new Date(NOW).toISOString() } };
  var a = CL.summarize(patient(COHORT['DEMO-A04'], fresh), DEPS, NOW); assert.ok(a.reviewed && !a.needsReview && !a.stale);
  var b = CL.summarize(patient(COHORT['DEMO-A04'], old), DEPS, NOW); assert.ok(!b.reviewed && b.needsReview && b.stale);
  var g = CL.summarize(patient(COHORT['DEMO-G13'], fresh), DEPS, NOW); assert.ok(!g.urgent && g.status === 'green');
  assert.ok(CL.summarize(patient(COHORT['DEMO-G13'], old), DEPS, NOW).urgent);
  assert.ok(CL.summarize(patient(COHORT['DEMO-A04']), DEPS, NOW).needsReview && !CL.summarize(patient(COHORT['DEMO-D02']), DEPS, NOW).needsReview);
});
test('checklist prompts follow the participant’s own answers', function () {
  function keys(code) { var p = patient(COHORT[code]); var pr = CL.prompts(p, CL.summarize(p, DEPS, NOW), NOW); var o = {}; Object.keys(pr).forEach(function (k) { o[k] = pr[k].map(function (x) { return x[0]; }); }); return o; }
  var f = keys('DEMO-F05');                                                   // abrupt change, PHQ-2 = 4, short sleep, vision, no vascular answers present
  assert.deepStrictEqual(f.acute, ['c.tr.abrupt']); assert.deepStrictEqual(f.mood, ['c.tr.phq']); assert.deepStrictEqual(f.sleep, ['c.tr.short']); assert.deepStrictEqual(f.vision, ['c.tr.vision']);
  assert.strictEqual(f.b12, undefined);
  var a = keys('DEMO-A04');                                                   // slow trend: not "abrupt"; hearing, hypertension and cholesterol reported
  assert.strictEqual(a.acute, undefined); assert.deepStrictEqual(a.hearing, ['c.tr.hearing']); assert.deepStrictEqual(a.vasc, ['c.tr.vasc']);
  var c = keys('DEMO-C07');                                                   // poor sleep reported at the last session, no risk profile shared
  assert.deepStrictEqual(c.sleep, ['c.tr.poor']); assert.deepStrictEqual(Object.keys(c), ['sleep']);
  assert.deepStrictEqual(keys('DEMO-D02'), { vasc: ['c.tr.vasc'] });           // hearing is aided, so no hearing prompt
});
test('diabetes prompts B12 (metformin) and glucose', function () {
  var d = JSON.parse(JSON.stringify(COHORT['DEMO-D02'])); d.risk.answers.dm = 'yes';
  var p = patient(d), pr = CL.prompts(p, CL.summarize(p, DEPS, NOW), NOW);
  assert.strictEqual(pr.b12[0][0], 'c.tr.dm'); assert.strictEqual(pr.bloods[0][0], 'c.tr.dmglu'); assert.deepStrictEqual(pr.vasc[0][1].ids, ['hypertension', 'diabetes']);
});
test('EEG results in a file are sanitised: bad values make a record unusable, extra fields are dropped', function () {
  var f = { rel_delta: 0.3, rel_theta: 0.1, rel_alpha: 0.4, rel_beta: 0.2, theta_alpha: 0.25, slow_ratio: 0.7, apf_cog: 9.9 };
  var c = CL.sanitize(wrap({ code: 'NB-EEG01', sessions: [], eeg: [
    { at: new Date(NOW).toISOString(), kind: 'muse', fs: 256, seconds: 180, nEpochs: 45, nKept: 41, usable: true, features: f, raw: [1, 2, 3], note: '<script>' },
    { at: new Date(NOW - DAY).toISOString(), kind: '<b>', usable: true, features: Object.assign({}, f, { theta_alpha: 'high' }) },
    { at: 'not a date', kind: 'muse', usable: true, features: f }, 'nonsense'] }), RK.GROUPS);
  assert.strictEqual(c.data.eeg.length, 2);
  assert.deepStrictEqual(c.data.eeg.map(function (r) { return [r.kind, r.usable]; }), [['other', false], ['muse', true]]);      // oldest first
  assert.strictEqual(c.data.eeg[1].raw, undefined); assert.strictEqual(c.data.eeg[1].note, undefined); assert.strictEqual(c.data.eeg[0].features, null);
  assert.strictEqual(CL.sanitize(wrap({ code: 'NB-EEG02', sessions: [] }), RK.GROUPS).data.eeg, undefined);
});
test('the baseline period survives the reading of an exported file', function () {
  function s(day, rt, ep) { return { startedAt: new Date(NOW - (200 - day) * DAY).toISOString(), condition: 'standard', completed: true, flagged: false, epoch: ep,
                                     measures: { rt: rt, sdmt: 46, mem: 7, gng: 8 } }; }
  var sessions = [s(0, 372), s(3, 356), s(6, 347), s(9, 352), s(13, 345), s(43, 348), s(103, 412, 1), s(106, 405, 1), s(109, 409, 1), s(112, 414, 1), s(142, 408, 1)];
  var p = CL.sanitize(wrap({ code: 'NB-TEST1', sessions: sessions, epoch: 1, events: [] }), RK.GROUPS);
  assert.strictEqual(p.data.epoch, 1); assert.strictEqual(p.data.sessions[6].epoch, 1); assert.strictEqual(p.data.sessions[0].epoch, 0);
  var sum = CL.summarize(p, DEPS, NOW);
  assert.strictEqual(sum.e.rebased, true); assert.strictEqual(sum.status, 'green');
  var bad = CL.sanitize(wrap({ code: 'NB-TEST1', sessions: [s(0, 372, 'x')], epoch: 1e9, events: [] }), RK.GROUPS);
  assert.strictEqual(bad.data.epoch, 0); assert.strictEqual(bad.data.sessions[0].epoch, 0);
});
test('reported difficulty seeing or tapping reaches the clinician without counting as a red flag', function () {
  function s(day) { return { startedAt: new Date(NOW - (60 - day) * DAY).toISOString(), condition: 'standard', completed: true, flagged: false, measures: { rt: 350, sdmt: 46, mem: 7, gng: 8 } }; }
  var at = new Date(NOW - 2 * DAY).toISOString();
  var p = CL.sanitize(wrap({ code: 'NB-TEST2', sessions: [s(0), s(3), s(6), s(9), s(13), s(43)], events: [{ type: 'accessLimit', at: at }, { type: 'accessLimit', at: 'never' }, { type: 'quit', at: at }] }), RK.GROUPS);
  assert.deepStrictEqual(p.data.access, [at]); assert.deepStrictEqual(p.data.events, []);
  var sum = CL.summarize(p, DEPS, NOW);
  assert.strictEqual(sum.urgent, false); assert.strictEqual(sum.accessAt, Date.parse(at));
  assert.deepStrictEqual(CL.prompts(p, sum, NOW).vision, [['c.tr.access', {}]]);
  var none = CL.sanitize(wrap({ code: 'NB-TEST2', sessions: [s(0)], events: [] }), RK.GROUPS);
  assert.strictEqual(CL.summarize(none, DEPS, NOW).accessAt, null);
});
console.log('\n' + n + ' tests passed');
