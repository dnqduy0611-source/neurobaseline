/* Unit tests for js/insight.js. Run:  node tests/insight.test.js  (from the app folder) */
'use strict';
var assert = require('assert');
var C = require('../js/config.js');
var ST = require('../js/stats.js');
var RK = require('../js/risk.js');
var HB = require('../js/habits.js');
var EEG = require('../js/eeg-core.js');
var DC = require('../js/demo-cohort.js');
var IN = require('../js/insight.js');
var DEPS = { stats: ST, config: C, risk: RK, habits: HB, eeg: EEG }, DAY = 864e5, NOW = new Date(2026, 10, 17, 9, 0, 0).getTime();
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }
function keys(list) { return list.map(function (x) { return x.key; }); }
function ids(list) { return list.map(function (x) { return x.id; }); }
function source(out, id) { return out.sources.filter(function (s) { return s.id === id; })[0]; }

// facts as fromData would give them
function tasks(light, extra) { return Object.assign({ phase: 'monitoring', light: light, done: 4, total: 4, sessions: 9, exceed: light === 'yellow' || light === 'red' ? ['rt'] : [], trend: false, context: false, lastAt: NOW - DAY }, extra || {}); }
function week(sleepH, activeDays, socialDays) {
  var s = { days: 7, n: 7, nSleep: 7, sleepH: sleepH, shortNights: sleepH < 6 ? 7 : 0, poorNights: 0, nActive: 7, activeDays: activeDays, someDays: 0, nSocial: 7, socialDays: socialDays };
  return { n28: 20, week: s, notes: HB.notes(s), before: null };
}
function before(kind, h, diff) { return { sleep: kind, week: { sleepH: h, nSleep: 6 }, usual: diff === null ? null : { sleepH: h - diff }, sleepDiff: diff }; }

test('nothing but sessions: the plan asks for what is missing and keeps the routine', function () {
  var out = IN.build({ tasks: tasks('green'), habits: null, risk: null, eeg: null, redflag: false });
  assert.deepStrictEqual(out.sources.map(function (s) { return s.id + ':' + s.level; }), ['tasks:ok', 'habits:none', 'risk:none', 'eeg:none']);
  assert.deepStrictEqual(out.missing, ['habits', 'risk']); assert.deepStrictEqual(out.links, []);
  assert.deepStrictEqual(ids(out.plan), ['checkin', 'profile', 'keep']); assert.strictEqual(out.referral, 'none');
});
test('baseline phase is reported as in progress, never as a result', function () {
  var out = IN.build({ tasks: tasks(null, { phase: 'building', done: 2, total: 5, lastAt: null }), habits: null, risk: null, eeg: null, redflag: false });
  assert.strictEqual(source(out, 'tasks').key, 't.building'); assert.strictEqual(source(out, 'tasks').level, 'info'); assert.strictEqual(out.referral, 'none');
  assert.strictEqual(IN.build({ tasks: tasks(null, { phase: 'new', lastAt: null }), habits: null, risk: null, eeg: null, redflag: false }).sources[0].key, 't.new');
});
test('a confirmed change after a week of less sleep: doctor first, then sleep', function () {
  var h = week(5.2, 0, 3); h.before = before('less', 5.1, -1.4);
  var out = IN.build({ tasks: tasks('red'), habits: h, risk: null, eeg: null, redflag: false });
  assert.strictEqual(out.links[0].key, 'l.sleep.less'); assert.deepStrictEqual(out.links[0].uses, ['tasks', 'habits']); assert.deepStrictEqual(out.links[0].vars, { h: 5.1, d: 1.4 });
  assert.deepStrictEqual(ids(out.plan), ['doctor', 'sleep', 'move']); assert.strictEqual(out.plan[1].why, 'w.sleepLink'); assert.strictEqual(out.referral, 'review');
});
test('one result outside the range: repeat, not referral', function () {
  var out = IN.build({ tasks: tasks('yellow', { context: true }), habits: week(7.4, 6, 4), risk: { present: [], shortSleep: false }, eeg: null, redflag: false });
  assert.strictEqual(out.referral, 'repeat'); assert.deepStrictEqual(keys(out.links), ['l.context']); assert.strictEqual(out.plan[0].id, 'repeat');
  assert.strictEqual(source(out, 'habits').key, 'h.ok'); assert.strictEqual(source(out, 'risk').key, 'r.clear');
});
test('a slow drift is named as a trend when no single measure is outside its limit', function () {
  var out = IN.build({ tasks: tasks('red', { exceed: [], trend: true }), habits: null, risk: null, eeg: null, redflag: false });
  assert.strictEqual(source(out, 'tasks').key, 't.redTrend'); assert.deepStrictEqual(keys(out.links), ['l.nohabits']);
});
test('risk profile and daily check-ins that agree are linked and lead the plan', function () {
  var out = IN.build({ tasks: tasks('green'), habits: week(7.2, 1, 0), risk: { present: ['hypertension', 'inactivity', 'isolation'], shortSleep: false }, eeg: null, redflag: false });
  assert.deepStrictEqual(keys(out.links), ['l.active', 'l.social', 'l.protect']);
  assert.deepStrictEqual(ids(out.plan), ['move', 'social', 'risk']); assert.strictEqual(out.plan[0].why, 'w.both'); assert.deepStrictEqual(out.plan[2].vars, { id: 'hypertension' });
  assert.strictEqual(out.more, 0);
});
test('a habit named only in the risk profile still gets its step, with that reason', function () {
  var out = IN.build({ tasks: tasks('green'), habits: null, risk: { present: ['inactivity', 'diabetes', 'hearing', 'smoking'], shortSleep: false }, eeg: null, redflag: false });
  assert.deepStrictEqual(ids(out.plan), ['move', 'risk', 'risk']); assert.strictEqual(out.plan[0].why, 'w.risk'); assert.deepStrictEqual(out.plan[1].vars, { id: 'diabetes' });
  assert.strictEqual(out.more, 2);                                     // smoking and the daily check-in wait their turn
});
test('too few check-ins: no statement about the week, a step to check in', function () {
  var h = week(4.5, 0, 0); h.week.n = 2; h.notes = HB.notes(h.week);
  var out = IN.build({ tasks: tasks('green'), habits: h, risk: { present: [], shortSleep: false }, eeg: null, redflag: false });
  assert.strictEqual(source(out, 'habits').key, 'h.more'); assert.deepStrictEqual(ids(out.plan), ['checkin', 'keep']); assert.deepStrictEqual(out.links, []);
});
test('EEG is optional and only joins a confirmed change', function () {
  var red = IN.build({ tasks: tasks('red'), habits: null, risk: null, eeg: { n: 5, status: 'changed' }, redflag: false });
  assert.deepStrictEqual(keys(red.links), ['l.eeg', 'l.nohabits']); assert.strictEqual(source(red, 'eeg').level, 'watch');
  var green = IN.build({ tasks: tasks('green'), habits: null, risk: null, eeg: { n: 5, status: 'changed' }, redflag: false });
  assert.deepStrictEqual(green.links, []); assert.strictEqual(green.missing.indexOf('eeg'), -1);
});
test('red-flag symptoms come before everything else', function () {
  var out = IN.build({ tasks: tasks('green'), habits: week(7.5, 6, 5), risk: { present: [], shortSleep: false }, eeg: null, redflag: true });
  assert.strictEqual(out.referral, 'urgent'); assert.strictEqual(out.plan[0].id, 'urgent'); assert.strictEqual(out.plan.length, 1);
});
test('never more than three steps and three links', function () {
  var h = week(5, 0, 0); h.before = before('short', 5, null);
  var out = IN.build({ tasks: tasks('red'), habits: h, risk: { present: RK.LANCET.map(function (f) { return f[0]; }), shortSleep: true }, eeg: { n: 4, status: 'changed' }, redflag: true });
  assert.strictEqual(out.plan.length, 3); assert.strictEqual(out.links.length, 3); assert.ok(out.more > 0);
  assert.deepStrictEqual(ids(out.plan), ['urgent', 'doctor', 'sleep']);
});
test('fromData reads a stored profile: stable person with a risk profile', function () {
  var d = DC.build(NOW).filter(function (x) { return x.code === 'DEMO-D02'; })[0], inp = IN.fromData(d, DEPS, NOW), out = IN.build(inp);
  assert.strictEqual(inp.tasks.light, 'green'); assert.strictEqual(inp.habits, null); assert.deepStrictEqual(inp.risk.present, ['hypertension']); assert.strictEqual(inp.eeg, null);
  assert.deepStrictEqual(keys(out.links), ['l.protect']); assert.deepStrictEqual(ids(out.plan), ['risk', 'checkin', 'keep']); assert.strictEqual(out.referral, 'none');
});
test('fromData reads a stored profile: confirmed change, reported red flag, added habits', function () {
  var d = JSON.parse(JSON.stringify(DC.build(NOW).filter(function (x) { return x.code === 'DEMO-F05'; })[0])), lastAt = Date.parse(d.sessions[d.sessions.length - 1].startedAt);
  d.habits = []; for (var k = 45; k >= 0; k--) d.habits.push({ day: HB.addDays(HB.dayKey(lastAt), -k), sleepH: k < 7 ? '5' : '7', sleepQ: 'ok', active: 'none', social: 'no' });
  d.events = [{ type: 'redflag', at: new Date(NOW - 20 * DAY).toISOString() }];                       // too long ago to count
  var inp = IN.fromData(d, DEPS, NOW), out = IN.build(inp);
  assert.strictEqual(inp.tasks.light, 'red'); assert.strictEqual(inp.redflag, false); assert.strictEqual(inp.habits.before.sleep, 'less'); assert.strictEqual(inp.habits.before.sleepDiff, -2);
  assert.strictEqual(out.links[0].key, 'l.sleep.less'); assert.deepStrictEqual(ids(out.plan), ['doctor', 'sleep', 'move']); assert.strictEqual(out.plan[2].why, 'w.both');
  d.events = [{ type: 'redflag', at: new Date(NOW - 2 * DAY).toISOString() }];
  assert.strictEqual(IN.build(IN.fromData(d, DEPS, NOW)).referral, 'urgent');
});
console.log('\n' + n + ' tests passed');
