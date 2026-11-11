/* Unit tests for js/risk.js. Run:  node tests/risk.test.js  (from the app folder) */
'use strict';
var assert = require('assert');
var R = require('../js/risk.js');
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }
function statusOf(e, id) { return e.factors.filter(function (f) { return f.id === id; })[0].status; }

test('14 Lancet factors and 12 LIBRA items', function () {
  assert.strictEqual(R.LANCET.length, 14); assert.strictEqual(R.LIBRA.length, 12);
});
test('published LIBRA range: all risks = 12.7, all protective = -5.9', function () {
  var pos = 0, neg = 0; R.LIBRA.forEach(function (x) { if (x[1] > 0) pos += x[1]; else neg += x[1]; });
  assert.strictEqual(Math.round(pos * 10) / 10, 12.7); assert.strictEqual(Math.round(neg * 10) / 10, -5.9);
});
test('no answers: everything unknown, LIBRA incomplete', function () {
  var e = R.evaluate({}, null);
  assert.strictEqual(e.present.length, 0); assert.strictEqual(e.unknown.length, 13); assert.strictEqual(e.assessed, 0);
  assert.strictEqual(statusOf(e, 'airpollution'), 'notassessed'); assert.strictEqual(e.libra.complete, false); assert.strictEqual(e.libra.answered, 0);
  assert.strictEqual(e.bmi, null); assert.strictEqual(e.phq2, null);
});
test('worst case reaches LIBRA 12.7 and 13 present factors', function () {
  var e = R.evaluate({ height: 170, weight: 100, htn: 'yes', dm: 'yes', chol: 'yes', chd: 'yes', ckd: 'yes', hearing: 'yes', vision: 'yes', tbi: 'yes',
    activity: 'low', smoke: 'current', alcohol: 'high', diet: 'no', cog: 'low', social: 'rare', phq1: '2', phq2: '2' }, { edu: '1' });
  assert.strictEqual(e.libra.score, 12.7); assert.strictEqual(e.libra.complete, true); assert.strictEqual(e.present.length, 13); assert.strictEqual(e.assessed, 13);
});
test('best case reaches LIBRA -5.9 and no present factor', function () {
  var e = R.evaluate({ height: 170, weight: 65, htn: 'no', dm: 'no', chol: 'no', chd: 'no', ckd: 'no', hearing: 'no', vision: 'no', tbi: 'no',
    activity: 'ok', smoke: 'never', alcohol: 'mod', diet: 'yes', cog: 'high', social: 'weekly', phq1: '0', phq2: '0' }, { edu: '3' });
  assert.strictEqual(e.libra.score, -5.9); assert.strictEqual(e.present.length, 0); assert.strictEqual(e.absent.length, 13);
});
test('abstainers get no protective alcohol credit and no alcohol risk', function () {
  var e = R.evaluate({ alcohol: 'none' }, null);
  assert.strictEqual(e.libra.score, 0); assert.strictEqual(statusOf(e, 'alcohol'), 'absent');
});
test('BMI: 92 kg, 172 cm = 31.1 -> obese; out-of-range input ignored', function () {
  assert.strictEqual(R.bmiOf({ height: 172, weight: 92 }), 31.1); assert.strictEqual(statusOf(R.evaluate({ height: 172, weight: 92 }), 'obesity'), 'present');
  assert.strictEqual(R.bmiOf({ height: 17, weight: 92 }), null); assert.strictEqual(statusOf(R.evaluate({ height: 172, weight: 80 }), 'obesity'), 'absent');
});
test('PHQ-2: 3 or more is a positive screen; needs both items', function () {
  assert.strictEqual(statusOf(R.evaluate({ phq1: '1', phq2: '2' }), 'depression'), 'present');
  assert.strictEqual(statusOf(R.evaluate({ phq1: '1', phq2: '1' }), 'depression'), 'absent');
  assert.strictEqual(statusOf(R.evaluate({ phq1: '3' }), 'depression'), 'unknown');
});
test('hearing aids count as managed; "unsure" counts as unknown; former smoker is not a smoker', function () {
  var e = R.evaluate({ hearing: 'aided', htn: 'unsure', smoke: 'former' }, null);
  assert.deepStrictEqual(e.managed, ['hearing']); assert.strictEqual(statusOf(e, 'hypertension'), 'unknown'); assert.strictEqual(statusOf(e, 'smoking'), 'absent');
});
test('context notes: short sleep, snoring, family history never enter a score', function () {
  var e = R.evaluate({ sleep: 'short', snore: 'yes', fam: 'yes' }, null);
  assert.deepStrictEqual(e.context, { shortSleep: true, snore: true, family: true }); assert.strictEqual(e.libra.score, 0); assert.strictEqual(e.present.length, 0);
});
test('demo profile: 5 present factors, LIBRA 7.0', function () {
  var e = R.evaluate({ height: 172, weight: 92, htn: 'yes', dm: 'yes', chol: 'yes', chd: 'no', ckd: 'no', hearing: 'no', vision: 'no', tbi: 'no', activity: 'low',
    smoke: 'former', alcohol: 'none', diet: 'no', cog: 'low', social: 'weekly', phq1: '1', phq2: '0', sleep: 'short', snore: 'yes', fam: 'unsure' }, { edu: '2' });
  assert.deepStrictEqual(e.present, ['ldl', 'inactivity', 'diabetes', 'hypertension', 'obesity']); assert.strictEqual(e.libra.score, 7); assert.strictEqual(e.libra.complete, true);
});
console.log('\n' + n + ' tests passed');
