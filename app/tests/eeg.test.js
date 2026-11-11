/* Unit tests for js/eeg-core.js. Run:  node tests/eeg.test.js  (from the app folder)
   The sample recordings and the expected values come from eeg/export_samples.py (Python pipeline on the same signals). */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var C = require('../js/config.js');
var E = require('../js/eeg-core.js');
var EXPECTED = JSON.parse(fs.readFileSync(path.join(__dirname, 'eeg-expected.json'), 'utf8'));
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }
function sample(name) { return fs.readFileSync(path.join(__dirname, '..', 'samples', name), 'utf8'); }

test('reads a plain headband file: channels, sampling rate from the time column, device type', function () {
  var r = E.parseCsv(sample('brainbit-cn.csv'));
  assert.deepStrictEqual(r.names, ['T3', 'T4', 'O1', 'O2']); assert.strictEqual(r.fs, 250); assert.strictEqual(r.kind, 'brainbit'); assert.strictEqual(r.rows, 45000);
});
test('reads a Mind Monitor-style file: RAW_ prefix, date-time stamps', function () {
  var r = E.parseCsv(sample('muse-cn.csv'));
  assert.deepStrictEqual(r.names, ['TP9', 'AF7', 'AF8', 'TP10']); assert.strictEqual(r.fs, 256); assert.strictEqual(r.kind, 'muse');
});
test('in-app processing reproduces the Python pipeline on all six sample recordings', function () {
  Object.keys(EXPECTED).forEach(function (name) {
    var want = EXPECTED[name].features, got = E.analyse(E.parseCsv(sample(name)));
    assert.ok(got.usable, name);
    assert.strictEqual(got.nEpochs, want.n_epochs, name + ' epochs');
    assert.ok(Math.abs(got.nKept - want.n_kept) <= 1, name + ' kept ' + got.nKept + ' vs ' + want.n_kept);
    ['rel_delta', 'rel_theta', 'rel_alpha', 'rel_beta'].forEach(function (k) { assert.ok(Math.abs(got.features[k] - want[k]) < 0.01, name + ' ' + k + ' ' + got.features[k] + ' vs ' + want[k]); });
    assert.ok(Math.abs(got.features.theta_alpha / want.theta_alpha - 1) < 0.03, name + ' theta/alpha ' + got.features.theta_alpha + ' vs ' + want.theta_alpha);
    assert.ok(Math.abs(got.features.apf_cog - want.apf_cog) < 0.03, name + ' alpha cog ' + got.features.apf_cog + ' vs ' + want.apf_cog);
  });
});
test('the healthy sample has a lower theta/alpha ratio and a faster alpha rhythm than the Alzheimer sample', function () {
  var cn = E.analyse(E.parseCsv(sample('brainbit-cn.csv'))).features, ad = E.analyse(E.parseCsv(sample('brainbit-ad.csv'))).features;
  assert.ok(cn.theta_alpha < ad.theta_alpha / 3 && cn.apf_cog > ad.apf_cog + 1);
});
test('marker rows and gaps are skipped; unknown columns are ignored', function () {
  var rows = ['TimeStamp,RAW_TP9,RAW_AF7,RAW_AF8,RAW_TP10,Battery,Elements'];
  for (var i = 0; i < 600; i++) rows.push((i / 256).toFixed(5) + ',' + (i % 7) + ',1,2,' + (i % 5) + ',80,' + (i === 300 ? '/muse/blink' : ''));
  rows.splice(200, 0, '0.78,,,,,80,/muse/elements/blink');
  var r = E.parseCsv(rows.join('\n'));
  assert.deepStrictEqual(r.names, ['TP9', 'AF7', 'AF8', 'TP10']); assert.strictEqual(r.rows, 600); assert.strictEqual(r.skipped, 1); assert.strictEqual(r.fs, 256);
});
test('files that are not recordings are refused with a reason', function () {
  assert.strictEqual(E.parseCsv('').error, 'empty');
  assert.strictEqual(E.parseCsv('1,2,3\n4,5,6\n7,8,9').error, 'noheader');
  assert.strictEqual(E.parseCsv('name,age,city\na,1,x\nb,2,y').error, 'nochannels');
  var noTime = E.parseCsv('O1,O2\n' + Array.from({ length: 200 }, function (_, i) { return i + ',' + (i * 2); }).join('\n'));
  assert.strictEqual(noTime.fs, null); assert.strictEqual(noTime.kind, 'other');                     // the app then asks for the sampling rate
  assert.strictEqual(E.analyse({ fs: 300, data: noTime.data, names: noTime.names, kind: 'other' }).error, 'rate');
});
test('a recording with too little clean signal is marked unusable', function () {
  var r = E.parseCsv(sample('brainbit-cn.csv'));
  var short = { names: r.names, fs: r.fs, kind: r.kind, data: r.data.map(function (d) { return d.subarray(0, 250 * 30); }) };   // 30 s
  var a = E.analyse(short); assert.strictEqual(a.usable, false); assert.strictEqual(a.features, null);
  var noisy = { names: r.names, fs: r.fs, kind: r.kind, data: r.data.map(function (d) { return d.map(function (v, i) { return v + (i % 500 < 3 ? 900 : 0); }); }) };
  assert.strictEqual(E.analyse(noisy).usable, false);
});
test('following one person: first recordings form the baseline, later ones are compared with it', function () {
  function rec(ratio, cog, extra) { return Object.assign({ kind: 'muse', usable: true, features: { theta_alpha: ratio, apf_cog: cog } }, extra || {}); }
  var ev = E.evaluate([rec(0.30, 9.8), rec(0.32, 9.9), rec(0.31, 9.85), rec(0.60, 9.1), rec(0.20, 10.2), rec(0.3, 9.8, { usable: false, features: null }), rec(0.9, 8.5, { kind: 'brainbit' })], C.eeg);
  assert.deepStrictEqual(ev.map(function (a) { return a.status; }), ['baseline', 'baseline', 'within', 'changed', 'within', 'unusable', 'baseline']);
  var z = ev[3].z, k = Math.sqrt(1.5);
  assert.ok(Math.abs(z.theta_alpha - (Math.log(0.60) - (Math.log(0.30) + Math.log(0.32)) / 2) / (C.eeg.sigmaLogRatio * k)) < 1e-9);
  assert.ok(Math.abs(z.apf_cog - (9.85 - 9.1) / (C.eeg.sigmaCog * k)) < 1e-9);
  assert.ok(ev[4].z.theta_alpha < 0);                                                                // a faster rhythm is never "changed"
});
console.log('\n' + n + ' tests passed');
