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
// ---- how the plan is going ----
function entries(spec) { // 14 days ending today, oldest first; null = no check-in that day
  var today = HB.dayKey(NOW), out = [];
  spec.forEach(function (x, i) { if (x) out.push(Object.assign({ day: HB.addDays(today, i - 13) }, x)); });
  return out;
}
function facts(list, nextDue) { return { tasks: tasks('green', { nextDue: nextDue === undefined ? null : nextDue }), checkins: HB.clean(list) }; }
var LO = { sleepH: '5', active: 'none', social: 'no' }, HI = { sleepH: '7', active: '30plus', social: 'yes' };

test('a habit step is counted from the check-ins: the last 7 days next to the 7 days before', function () {
  var pr = IN.track([{ id: 'sleep' }, { id: 'move' }, { id: 'social' }], facts(entries([LO, LO, LO, LO, LO, LO, LO, LO, HI, null, HI, LO, HI, LO])), HB, NOW);
  assert.deepStrictEqual([pr[0].met, pr[0].logged, pr[0].prevMet, pr[0].prevLogged, pr[0].dir, pr[0].today], [3, 6, 0, 7, 'up', true]);
  assert.deepStrictEqual(pr[0].days, ['miss', 'miss', 'miss', 'miss', 'miss', 'miss', 'miss', 'miss', 'met', 'none', 'met', 'miss', 'met', 'miss']);
  assert.strictEqual(pr[0].h, 6); assert.strictEqual(pr[0].prevH, 5);
  assert.deepStrictEqual([pr[1].met, pr[1].logged, pr[1].dir], [3, 6, 'up']); assert.deepStrictEqual([pr[2].met, pr[2].logged, pr[2].dir], [3, 6, 'up']);
  assert.strictEqual(pr[1].h, undefined);
});
test('a day without a check-in is not counted against the person, and a thin week is not compared', function () {
  var thin = IN.track([{ id: 'sleep' }], facts(entries([HI, HI, HI, HI, HI, HI, HI, null, null, null, null, null, LO, null])), HB, NOW)[0];
  assert.deepStrictEqual([thin.met, thin.logged, thin.prevMet, thin.prevLogged, thin.dir, thin.today], [0, 1, 7, 7, null, false]); assert.strictEqual(thin.days[13], 'none');
  var down = IN.track([{ id: 'move' }], facts(entries([HI, HI, HI, HI, HI, HI, HI, LO, LO, LO, HI, null, null, null])), HB, NOW)[0];
  assert.deepStrictEqual([down.met, down.logged, down.dir], [1, 4, 'down']);
  var same = IN.track([{ id: 'social' }], facts(entries([HI, LO, null, null, HI, LO, null, LO, HI, LO, HI, LO, HI, null])), HB, NOW)[0];
  assert.deepStrictEqual([same.met, same.logged, same.prevMet, same.prevLogged, same.dir], [3, 6, 2, 4, 'same']);
  var none = IN.track([{ id: 'sleep' }], facts([]), HB, NOW)[0];
  assert.deepStrictEqual([none.logged, none.prevLogged, none.dir, none.h], [0, 0, null, null]);
});
test('the check-in step counts the days with a check-in and leaves today open', function () {
  var pr = IN.track([{ id: 'checkin' }], facts(entries([null, null, null, null, null, null, null, LO, null, LO, LO, null, LO, null])), HB, NOW)[0];
  assert.deepStrictEqual([pr.met, pr.logged, pr.prevMet, pr.prevLogged, pr.dir, pr.today], [4, 7, 0, 7, 'up', false]);
  assert.strictEqual(pr.days[8], 'miss'); assert.strictEqual(pr.days[13], 'none');
});
test('session steps show when the next session opens; steps with no measure in the app are not tracked', function () {
  var plan = [{ id: 'doctor' }, { id: 'repeat' }, { id: 'keep' }, { id: 'risk', vars: { id: 'hypertension' } }, { id: 'urgent' }, { id: 'profile' }];
  assert.deepStrictEqual(IN.track(plan, facts([], NOW + 3 * DAY), HB, NOW), [null, { kind: 'due', at: NOW + 3 * DAY, ready: false }, { kind: 'due', at: NOW + 3 * DAY, ready: false }, null, null, null]);
  assert.strictEqual(IN.track(plan, facts([], NOW - DAY), HB, NOW)[1].ready, true);
  assert.strictEqual(IN.track(plan, facts([]), HB, NOW)[1], null);
});
test('fromData hands on the check-ins and the next session date, and the whole plan is kept', function () {
  var d = JSON.parse(JSON.stringify(DC.build(NOW).filter(function (x) { return x.code === 'DEMO-F05'; })[0]));
  d.habits = []; for (var k = 20; k >= 0; k--) d.habits.push({ day: HB.addDays(HB.dayKey(NOW), -k), sleepH: k < 7 ? '7' : '5', sleepQ: 'ok', active: 'none', social: 'no' });
  var inp = IN.fromData(d, DEPS, NOW), out = IN.build(inp), pr = IN.track(out.plan, inp, HB, NOW);
  assert.strictEqual(inp.checkins.length, 21); assert.strictEqual(typeof inp.tasks.nextDue, 'number');
  assert.ok(out.planAll.length >= out.plan.length); assert.deepStrictEqual(out.planAll.slice(0, 3), out.plan);
  assert.strictEqual(out.plan[0].id, 'doctor'); assert.strictEqual(pr[0], null);
  var mv = pr[ids(out.plan).indexOf('move')];
  assert.deepStrictEqual([mv.kind, mv.met, mv.logged, mv.prevMet, mv.prevLogged, mv.dir], ['days', 0, 7, 0, 7, 'same']);
});
console.log('\n' + n + ' tests passed');
