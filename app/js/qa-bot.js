/* NeuroBaseline – QA robot. Active ONLY with ?qa=1 in the address.
   It plays the tasks like a simulated participant so a whole session can be checked automatically.
   QA sessions are tagged qa:true and stored under a separate key, never mixed with real data.
   Add &fast=1 for a shortened protocol. NB.qa.slow (default 1) scales the robot's speed: 1.25 = 25 % slower. */
(function () {
  'use strict';
  var NB = window.NB;
  if (!NB.config.qa) return;
  var Q = NB.qa = { slow: 1, rtMean: 330, rtSd: 30, sdmtMean: NB.config.fast ? 140 : 1250, memAcc: 0.94, log: [] };
  var lastSeq = null;

  function gauss() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function down(el) { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }
  function later(ms, f) { setTimeout(f, Math.max(20, ms)); }
  function clickWhenReady(b) { if (!document.body.contains(b)) return; if (b.disabled) return later(100, function () { clickWhenReady(b); }); b.click(); }

  function check() {
    var st = document.getElementById('stage'); if (!st || st.hidden) return;
    var el = st.querySelector('[data-expect]'); if (!el) return;
    var s = el.dataset.seq; if (s === lastSeq) return; lastSeq = s;
    var x = el.dataset.expect, live = function () { return document.body.contains(el) && el.dataset.seq === s; };
    if (x === 'btn') return later(150, function () { clickWhenReady(el); });
    if (x === 'tap') return later((Q.rtMean + Q.rtSd * gauss()) * Q.slow, function () { if (live()) down(el); });
    if (x === 'go') { if (Math.random() < 0.02) return; return later((Q.rtMean + 50 + Q.rtSd * gauss()) * Q.slow, function () { if (live()) down(el); }); }
    if (x === 'nogo') { if (Math.random() < 0.1) later(Q.rtMean, function () { if (live()) down(el); }); return; }
    if (x.indexOf('sdmt:') === 0) {
      var d = +x.slice(5); if (Math.random() < 0.03) d = d % 9 + 1;
      return later(Q.sdmtMean * (1 + 0.15 * gauss()) * Q.slow, function () { var b = el.querySelector('[data-d="' + d + '"]'); if (live() && b) down(b); });
    }
    if (x.indexOf('mem:') === 0) {
      var a = x.slice(4); if (Math.random() > Q.memAcc) a = a === 'old' ? 'new' : 'old';
      return later(NB.config.fast ? 120 : 900, function () { var b = el.querySelector('[data-a="' + a + '"]'); if (live() && b) down(b); });
    }
  }
  setInterval(check, 30);
})();
