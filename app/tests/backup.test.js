/* Unit tests for js/backup.js. Run:  node tests/backup.test.js  (from the app folder) */
'use strict';
var assert = require('assert');
var C = require('../js/config.js');
var ST = require('../js/stats.js');
var BK = require('../js/backup.js');
var DAY = 864e5, T0 = Date.parse('2026-11-01T08:00:00Z');
var n = 0;
function test(name, f) { f(); n++; console.log('ok  ' + name); }
function sess(day, rt, extra) {
  return Object.assign({ id: 's' + day, startedAt: new Date(T0 + day * DAY).toISOString(), condition: 'standard', completed: true, flagged: false,
                         measures: { rt: rt, sdmt: 46, mem: 7, gng: 8 } }, extra || {});
}
function file(patch, mode) {
  var d = { schema: 1, code: 'NB-AB2CD', createdAt: new Date(T0).toISOString(), consentAt: new Date(T0).toISOString(), profile: { ageBand: '60-69', edu: '2', hand: 'R' },
            sessions: [sess(0, 372), sess(3, 356), sess(6, 347), sess(9, 352), sess(13, 345), sess(43, 420), sess(57, 425)], events: [] };
  return { app: 'NeuroBaseline', version: '0.1.0', exportedAt: new Date(T0 + 60 * DAY).toISOString(), mode: mode || 'real', data: Object.assign(d, patch || {}) };
}

test('a valid backup is accepted and evaluates like the original', function () {
  var f = file(), r = BK.check(JSON.parse(JSON.stringify(f)));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.info.sessions, 7); assert.strictEqual(r.info.code, 'NB-AB2CD');
  var a = ST.evaluate(f.data.sessions, C, T0 + 60 * DAY), b = ST.evaluate(r.data.sessions, C, T0 + 60 * DAY);
  assert.deepStrictEqual(b.sessions.map(function (x) { return x.light; }), a.sessions.map(function (x) { return x.light; }));
  assert.strictEqual(b.light, 'red');
});
test('files from elsewhere are refused', function () {
  assert.strictEqual(BK.check(null).error, 'file');
  assert.strictEqual(BK.check({ app: 'Other', data: {} }).error, 'file');
  assert.strictEqual(BK.check(file({ schema: 2 })).error, 'file');
  assert.strictEqual(BK.check([1, 2]).error, 'file');
});
test('demo and QA files are not restored over real data', function () {
  assert.strictEqual(BK.check(file(null, 'demo')).error, 'mode');
  assert.strictEqual(BK.check(file(null, 'qa')).error, 'mode');
  assert.strictEqual(BK.check(file(null, 'qa'), { mode: 'qa' }).ok, true);
});
test('broken content is refused', function () {
  assert.strictEqual(BK.check(file({ code: 'NB-<b>x' })).error, 'content');
  assert.strictEqual(BK.check(file({ code: 'DEMO-RASHID' })).error, 'content');
  assert.strictEqual(BK.check(file({ sessions: 'none' })).error, 'content');
  assert.strictEqual(BK.check(file({ sessions: [sess(0, 350), sess(0, 351)] })).error, 'content');                      // duplicate id
  assert.strictEqual(BK.check(file({ sessions: [sess(0, 350, { measures: null })] })).error, 'content');
  assert.strictEqual(BK.check(file({ sessions: [sess(0, 350, { startedAt: 'yesterday' })] })).error, 'content');
  assert.strictEqual(BK.check(file({ sessions: [sess(0, 350, { measures: { rt: '350' } })] })).error, 'content');
  assert.strictEqual(BK.check(file({ sessions: [sess(0, 350, { epoch: -1 })] })).error, 'content');
  assert.strictEqual(BK.check(file({ profile: { ageBand: '200', edu: '2', hand: 'R' } })).error, 'content');
  assert.strictEqual(BK.check(file({ risk: { answers: 'x' } })).error, 'content');
  assert.strictEqual(BK.check(file({ eeg: {} })).error, 'content');
});
test('text from a file cannot become markup', function () {
  var r = BK.check(file({ events: [{ type: 'error', msg: '<img src=x onerror=alert(1)>', at: new Date(T0).toISOString() }], risk: { answers: { htn: '<script>' } } }));
  assert.strictEqual(r.ok, true);
  assert.ok(JSON.stringify(r.data).indexOf('<') < 0 && JSON.stringify(r.data).indexOf('>') < 0);
  assert.strictEqual(r.data.events[0].msg, 'img src=x onerror=alert(1)');
});
test('missing optional parts get safe defaults', function () {
  var f = file({ profile: undefined, events: undefined, consentAt: undefined, epoch: 1, deviceKeys: ['android/360x800/touch', 7] });
  var r = BK.check(JSON.parse(JSON.stringify(f)));
  assert.strictEqual(r.ok, true); assert.strictEqual(r.data.profile, null); assert.deepStrictEqual(r.data.events, []); assert.strictEqual(r.data.consentAt, null);
  assert.strictEqual(r.data.epoch, 1); assert.deepStrictEqual(r.data.deviceKeys, ['android/360x800/touch']);
  assert.ok(!('risk' in r.data) && !('eeg' in r.data));
});
console.log('\n' + n + ' tests passed');
