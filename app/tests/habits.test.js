/* Unit tests for js/habits.js. Run:  node tests/habits.test.js  (from the app folder) */
'use strict';
var assert = require('assert');
var H = require('../js/habits.js');
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }

var NOW = new Date(2026, 10, 17, 9, 0, 0).getTime();          // 17 November 2026, 09:00 local time
function day(k) { return H.addDays(H.dayKey(NOW), -k); }      // k days before NOW
function entry(k, sleepH, sleepQ, active, social) { return { day: day(k), sleepH: sleepH, sleepQ: sleepQ, active: active, social: social }; }
function run(from, to, sleepH, active, social) { var out = []; for (var k = from; k >= to; k--) out.push(entry(k, sleepH, 'ok', active, social)); return out; }

test('four questions with fixed answers', function () {
  assert.deepStrictEqual(H.QUESTIONS.map(function (q) { return q.id; }), ['sleepH', 'sleepQ', 'active', 'social']);
  H.QUESTIONS[0].opts.forEach(function (o) { assert.strictEqual(typeof H.HOURS[o], 'number'); });
});
test('day keys follow the local calendar and reject impossible dates', function () {
  assert.strictEqual(H.dayKey(NOW), '2026-11-17'); assert.strictEqual(H.addDays('2026-11-01', -1), '2026-10-31'); assert.strictEqual(H.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(H.dayMs('2026-02-30'), null); assert.strictEqual(H.dayMs('17/11/2026'), null); assert.strictEqual(H.dayKey(H.dayMs('2026-11-17')), '2026-11-17');
});
test('clean keeps known answers only, one entry per day, oldest first', function () {
  var out = H.clean([entry(1, '7', 'good', '30plus', 'yes'), { day: day(3), sleepH: '<b>9</b>', active: 'some', extra: 'x' }, null, 'text', { day: 'yesterday', sleepH: '7' },
    { day: day(5), sleepH: 'twelve' }, entry(1, '5', 'poor', 'none', 'no')]);
  assert.deepStrictEqual(out, [{ day: day(3), active: 'some' }, { day: day(1), sleepH: '5', sleepQ: 'poor', active: 'none', social: 'no' }]);
  assert.deepStrictEqual(H.clean('nothing'), []); assert.deepStrictEqual(H.clean(undefined), []);
});
test('a second check-in on the same day replaces the first', function () {
  var list = H.upsert([entry(0, '7', 'ok', 'some', 'yes')], entry(0, '6', 'poor', 'none', 'no'));
  assert.strictEqual(list.length, 1); assert.strictEqual(list[0].sleepH, '6'); assert.strictEqual(H.find(list, day(0)).social, 'no'); assert.strictEqual(H.find(list, day(1)), null);
});
test('a week counts the seven calendar days that end today', function () {
  var list = H.clean(run(9, 0, '7', '30plus', 'yes'));
  assert.strictEqual(H.windowOf(list, NOW, 7).length, 7); assert.strictEqual(H.windowOf(list, NOW, 7)[0].day, day(6)); assert.strictEqual(H.windowOf(list, NOW, 28).length, 10);
});
test('summary: mean sleep, short and poor nights, active and social days', function () {
  var s = H.summarize(H.clean([entry(0, 'lt5', 'poor', 'none', 'no'), entry(1, '5', 'poor', 'some', 'yes'), entry(2, '7', 'good', '30plus', 'yes'), entry(3, '8plus', 'ok', '30plus', 'no')]), NOW, 7);
  assert.strictEqual(s.n, 4); assert.strictEqual(s.sleepH, 6.1); assert.strictEqual(s.shortNights, 2); assert.strictEqual(s.poorNights, 2);
  assert.strictEqual(s.activeDays, 2); assert.strictEqual(s.someDays, 1); assert.strictEqual(s.socialDays, 2);
  var none = H.summarize([], NOW, 7); assert.strictEqual(none.n, 0); assert.strictEqual(none.sleepH, null);
});
test('no weekly statement with fewer than four check-ins', function () {
  var r = H.notes(H.summarize(H.clean(run(2, 0, 'lt5', 'none', 'no')), NOW, 7));
  assert.deepStrictEqual(r, { enough: false, missing: 1 });
});
test('weekly statements: short sleep, little activity, no contact', function () {
  var r = H.notes(H.summarize(H.clean(run(6, 0, '5', 'none', 'no')), NOW, 7));
  assert.deepStrictEqual(r, { enough: true, sleep: 'short', active: 'low', social: 'low' });
});
test('weekly statements: targets met; six hours is below the advice but not short', function () {
  var ok = H.notes(H.summarize(H.clean(run(6, 0, '7', '30plus', 'yes')), NOW, 7));
  assert.deepStrictEqual(ok, { enough: true, sleep: 'ok', active: 'ok', social: 'ok' });
  var mid = H.notes(H.summarize(H.clean(run(6, 3, '6', 'some', 'no').concat([entry(2, '6', 'ok', 'none', 'yes')])), NOW, 7));
  assert.deepStrictEqual(mid, { enough: true, sleep: 'below', active: 'some', social: 'ok' });
  var four = H.notes(H.summarize(H.clean(run(3, 0, '7', '30plus', 'yes')), NOW, 7));       // four check-ins, all active: the rate decides, not the count
  assert.strictEqual(four.active, 'ok');
});
test('a week is compared with the person\'s own earlier weeks', function () {
  var list = H.clean(run(40, 7, '7', 'some', 'yes').concat(run(6, 0, '5', 'none', 'no'))), c = H.compare(list, NOW);
  assert.strictEqual(c.week.sleepH, 5); assert.strictEqual(c.usual.sleepH, 7); assert.strictEqual(c.sleepDiff, -2); assert.strictEqual(c.sleep, 'less');
  var same = H.compare(H.clean(run(40, 0, '7', 'some', 'yes')), NOW);
  assert.strictEqual(same.sleepDiff, 0); assert.strictEqual(same.sleep, null);
});
test('without earlier weeks only a short week is named', function () {
  var short = H.compare(H.clean(run(6, 0, '5', 'none', 'no')), NOW);
  assert.strictEqual(short.usual, null); assert.strictEqual(short.sleepDiff, null); assert.strictEqual(short.sleep, 'short');
  var two = H.compare(H.clean(run(1, 0, 'lt5', 'none', 'no')), NOW);                       // two nights are too few to say anything
  assert.strictEqual(two.sleep, null);
  var habitual = H.compare(H.clean(run(40, 0, '5', 'none', 'no')), NOW);                   // always short: not less than usual, still short
  assert.strictEqual(habitual.sleepDiff, 0); assert.strictEqual(habitual.sleep, 'short');
});
test('streak counts consecutive days and tolerates today not being done yet', function () {
  assert.strictEqual(H.streak(H.clean(run(3, 0, '7', 'some', 'yes')), NOW), 4);
  assert.strictEqual(H.streak(H.clean(run(3, 1, '7', 'some', 'yes')), NOW), 3);
  assert.strictEqual(H.streak(H.clean(run(5, 2, '7', 'some', 'yes')), NOW), 0);
  assert.strictEqual(H.streak([], NOW), 0);
});
console.log('\n' + n + ' tests passed');
