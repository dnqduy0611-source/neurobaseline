/* NeuroBaseline – storage. Everything stays in this browser (localStorage).
   Nothing is sent anywhere; the participant exports a file and chooses whom to send it to. */
(function () {
  'use strict';
  var NB = window.NB, C = NB.config, K = C.keys;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function genCode() { // anonymous participant code, no personal information in it
    var abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '', buf = new Uint8Array(5);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 5; i++) out += abc[buf[i] % abc.length];
    return 'NB-' + out;
  }

  var S = {
    mode: 'real', data: null, lang: null, okWrite: true,
    key: function () { return C.qa ? K.qa : (S.mode === 'demo' ? K.demo : K.real); },
    blank: function () {
      return { schema: 1, code: genCode(), createdAt: new Date(NB.now()).toISOString(), consentAt: null, profile: null, sessions: [], events: [] };
    },
    load: function () {
      S.lang = get(K.lang);
      if (C.demoParam && !C.qa && !S.demoApplied) { S.demoApplied = true; del(K.demo); set(K.mode, 'demo'); }
      S.mode = (!C.qa && get(K.mode) === 'demo') ? 'demo' : 'real';
      var d = null; try { var raw = get(S.key()); d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
      if (!d || d.schema !== 1) d = S.mode === 'demo' ? NB.demo.build(NB.now()) : S.blank();
      S.data = d; S.save();
    },
    save: function () { S.okWrite = set(S.key(), JSON.stringify(S.data)); return S.okWrite; },
    setLang: function (l) { S.lang = l; set(K.lang, l); },
    setMode: function (m) { // entering demo always rebuilds the simulated profile so its dates are relative to today
      del(K.demo); set(K.mode, m === 'demo' ? 'demo' : 'real'); S.load();
    },
    addSession: function (s) { S.data.sessions.push(s); return S.save(); },
    addEvent: function (e) { e.at = new Date(NB.now()).toISOString(); S.data.events.push(e); S.save(); },
    reset: function () { del(S.key()); S.load(); },
    exportObject: function (includeRisk, includeEeg) {
      var d = JSON.parse(JSON.stringify(S.data)); if (!includeRisk) delete d.risk; if (!includeEeg) delete d.eeg;   // health answers leave the device only by explicit choice
      return { app: 'NeuroBaseline', version: C.version, exportedAt: new Date(NB.now()).toISOString(), mode: C.qa ? 'qa' : S.mode, full: !!(includeRisk && includeEeg),
               config: { rt: C.rt, gng: C.gng, sdmt: C.sdmt, mem: C.mem, baseline: C.baseline, rci: C.rci, indicators: C.indicators },
               data: d };
    }
  };
  NB.store = S;
})();
