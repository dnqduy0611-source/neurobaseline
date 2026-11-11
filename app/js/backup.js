/* NeuroBaseline – checking a backup file before it replaces the data on this device.
   A file is untrusted input: its structure is checked and every string loses its angle brackets,
   so that no text from a file can become markup. Runs in the browser (NB.backup) and in Node for unit tests. */
(function (root) {
  'use strict';
  var AGE = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+'], MEASURES = ['rt', 'sdmt', 'mem', 'gng'];
  var SKIP = { '__proto__': true, 'constructor': true, 'prototype': true };

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function isDate(v) { return typeof v === 'string' && isFinite(Date.parse(v)); }
  function isEpoch(v) { return typeof v === 'number' && v >= 0 && v <= 99 && v === Math.floor(v); }

  function clean(v, depth) { // plain copy of a JSON value
    if (depth > 12) return null;
    if (typeof v === 'string') return v.replace(/[<>]/g, '').slice(0, 2000);
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean' || v === null) return v;
    if (Array.isArray(v)) return v.map(function (x) { return clean(x, depth + 1); });
    if (isObj(v)) {
      var o = {};
      Object.keys(v).forEach(function (k) { if (!SKIP[k]) o[k.replace(/[<>]/g, '')] = clean(v[k], depth + 1); });
      return o;
    }
    return null;
  }

  // file: the parsed JSON. opts.mode: 'real' (default) or 'qa'; a demo or QA file is never restored over real data.
  // Returns { ok: true, data, info } or { ok: false, error: 'file' | 'mode' | 'content' }.
  function check(file, opts) {
    function bad(e) { return { ok: false, error: e }; }
    if (!isObj(file) || file.app !== 'NeuroBaseline' || !isObj(file.data)) return bad('file');
    if (file.mode !== ((opts && opts.mode) || 'real')) return bad('mode');
    var d = clean(file.data, 0);
    if (d.schema !== 1) return bad('file');
    if (typeof d.code !== 'string' || !/^NB-[A-Z0-9]{5}$/.test(d.code)) return bad('content');
    if (!Array.isArray(d.sessions) || d.sessions.length > 5000) return bad('content');
    var ids = Object.create(null);
    var sessionsOk = d.sessions.every(function (s) {
      if (!isObj(s) || typeof s.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(s.id) || ids[s.id]) return false;
      ids[s.id] = true;
      if (!isDate(s.startedAt) || (s.condition !== 'standard' && s.condition !== 'nondominant') || s.completed !== true || !isObj(s.measures)) return false;
      if (s.epoch != null && !isEpoch(s.epoch)) return false;
      return MEASURES.every(function (k) { var v = s.measures[k]; return v === null || v === undefined || typeof v === 'number'; });
    });
    if (!sessionsOk) return bad('content');
    if (d.profile != null) {
      var p = d.profile;
      if (!isObj(p) || AGE.indexOf(p.ageBand) < 0 || ['1', '2', '3', '4'].indexOf(String(p.edu)) < 0 || (p.hand !== 'R' && p.hand !== 'L')) return bad('content');
      d.profile = { ageBand: p.ageBand, edu: String(p.edu), hand: p.hand };
    } else d.profile = null;
    if (d.consentAt != null && !isDate(d.consentAt)) return bad('content');
    if (d.consentAt == null) d.consentAt = null;
    if (!isDate(d.createdAt)) d.createdAt = d.sessions.length ? d.sessions[0].startedAt : new Date(0).toISOString();
    if (!Array.isArray(d.events)) d.events = [];
    d.events = d.events.filter(function (e) { return isObj(e) && typeof e.type === 'string'; }).slice(-2000);
    if (d.risk != null && !(isObj(d.risk) && isObj(d.risk.answers))) return bad('content');
    if (d.risk == null) delete d.risk;
    if (d.eeg != null && !Array.isArray(d.eeg)) return bad('content');
    if (d.eeg == null) delete d.eeg;
    if (d.epoch != null && !isEpoch(d.epoch)) return bad('content');
    if (d.deviceKeys != null) d.deviceKeys = Array.isArray(d.deviceKeys) ? d.deviceKeys.filter(function (k) { return typeof k === 'string' && k.length <= 60; }).slice(0, 20) : [];
    return { ok: true, data: d, info: { code: d.code, sessions: d.sessions.length, exportedAt: isDate(file.exportedAt) ? file.exportedAt : null } };
  }

  var api = { check: check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.backup = api; }
})(typeof window !== 'undefined' ? window : globalThis);
