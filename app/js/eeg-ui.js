/* NeuroBaseline – screens for the optional brain-rhythm check (resting EEG from a headband).
   A person's own recording is analysed in the browser and only the resulting numbers are kept; the signal is never stored.
   Sample recordings and the simulated headband are for demonstration and are never saved. */
(function () {
  'use strict';
  var NB = window.NB, C = NB.config, I = NB.i18n, S = NB.store, E = NB.eeg, X = null;
  function t(k, v) { return I.t(k, v); }
  function loc(x, d) { var s = Number(x).toFixed(d); return I.lang === 'vi' ? s.replace('.', ',') : s; }
  var SAMPLES = [                                                    // derived from OpenNeuro ds004504 (CC0); see samples/index.json
    { file: 'brainbit-cn.csv', group: 'CN', source: 'OpenNeuro ds004504, sub-057' },
    { file: 'brainbit-ad.csv', group: 'AD', source: 'OpenNeuro ds004504, sub-018' },
    { file: 'brainbit-ftd.csv', group: 'FTD', source: 'OpenNeuro ds004504, sub-078' }
  ];
  var LIVE = { file: 'muse-cn.csv', group: 'CN', source: 'OpenNeuro ds004504, sub-057' }, SPEED = 30;
  var st = { phase: 'idle', res: null, src: null, msg: '', pending: null, live: null };
  function records() { return S.data.eeg || []; }
  function evalAll() { return E.evaluate(records(), C.eeg); }

  function card() {
    var r = records();
    return '<section class="card"><h3>' + t('eeg.card.t') + '</h3><p class="muted">' + (r.length ? t('eeg.card.done', { n: r.length, date: X.fmtShort(Date.parse(r[r.length - 1].at)) }) : t('eeg.card.none')) +
      '</p><button class="btn" data-act="eegOpen">' + t('eeg.card.open') + '</button></section>';
  }
  function chip(status) { return '<span class="chip ' + (status === 'within' ? 'ok' : status === 'changed' ? 'bad' : '') + '">' + t('eeg.s.' + status) + '</span>'; }

  // ---------- main screen ----------
  function viewEeg() {
    var h = X.head() + '<h1 class="pad">' + t('eeg.t') + '</h1>';
    if (st.phase === 'busy' || st.phase === 'reading') return h + '<section class="card"><p class="bigtxt">' + t(st.phase === 'busy' ? 'eeg.busy' : 'eeg.reading') + '</p></section>';
    if (st.phase === 'rate') {
      return h + '<section class="card"><h3>' + t('eeg.rate.t') + '</h3><p class="muted">' + t('eeg.rate.x') + '</p><div class="opts">' + E.rates.map(function (f) {
        return '<button data-act="eegRate" data-v="' + f + '">' + f + ' Hz</button>'; }).join('') + '</div><button class="btn link" data-act="eegCancel">' + t('btn.back') + '</button></section>';
    }
    h += '<section class="card"><p>' + t('eeg.lead') + '</p><h3>' + t('eeg.how.t') + '</h3><ol class="loose"><li>' + t('eeg.how.1') + '</li><li>' + t('eeg.how.2') + '</li><li>' + t('eeg.how.3') + '</li></ol>' +
      (st.msg ? '<p class="note warnnote">' + st.msg + '</p>' : '') + '<input type="file" id="eegFile" accept=".csv,text/csv,text/plain" hidden><button class="btn big primary" data-act="eegPick">' + t('eeg.pick') + '</button>' +
      '<p class="muted small">' + t('eeg.note') + '</p></section>';
    h += '<section class="card"><h3>' + t('eeg.try.t') + '</h3><p class="muted">' + t('eeg.try.x') + '</p>' + SAMPLES.map(function (s, i) {
      return '<button class="btn" data-act="eegSample" data-v="' + i + '">' + t('eeg.sample.' + s.group) + '</button>'; }).join('') +
      '<button class="btn" data-act="eegLive">' + t('eeg.live') + '</button><p class="muted small">' + t('eeg.live.x') + '</p></section>';
    var ev = evalAll();
    h += '<section class="card scroll"><h3>' + t('eeg.hist.t') + '</h3>' + (ev.length ? '<table class="ht">' + ev.slice().reverse().map(function (a) {
      var f = a.r.features;
      return '<tr><td>' + X.fmtShort(Date.parse(a.r.at)) + '</td><td>' + t('eeg.kind.' + a.r.kind) + '</td><td class="num">' + (f ? loc(f.theta_alpha, 2) : '–') + '</td><td class="num">' + (f ? loc(f.apf_cog, 1) + ' Hz' : '–') +
        '</td><td>' + chip(a.status) + '</td></tr>'; }).join('') + '</table>' : '<p class="muted">' + t('eeg.hist.none') + '</p>') + '</section>';
    return h + X.backBtn();
  }

  // ---------- result ----------
  function spectrum(sp) {
    var W = 340, H = 170, L = 12, R = 10, T = 22, B = 30, f = sp.freqs, p = sp.rel, top = Math.max.apply(null, p) * 1.1;
    function x(v) { return L + (v - 1) * (W - L - R) / 29; }
    function y(v) { return T + (top - v) * (H - T - B) / top; }
    var s = '<rect x="' + x(4) + '" y="' + T + '" width="' + (x(8) - x(4)) + '" height="' + (H - T - B) + '" fill="#fef3c7"/><rect x="' + x(8) + '" y="' + T + '" width="' + (x(13) - x(8)) + '" height="' + (H - T - B) + '" fill="#e0f2fe"/>';
    s += '<text x="' + (x(4) + x(8)) / 2 + '" y="15" font-size="11" fill="#6b7280" text-anchor="middle">' + t('eeg.plot.theta') + '</text><text x="' + (x(8) + x(13)) / 2 + '" y="15" font-size="11" fill="#6b7280" text-anchor="middle">' + t('eeg.plot.alpha') + '</text>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="#9ca3af"/>';
    [5, 10, 15, 20, 25, 30].forEach(function (v) { s += '<text x="' + x(v) + '" y="' + (H - B + 14) + '" font-size="11" fill="#6b7280" text-anchor="middle">' + v + '</text>'; });
    s += '<text x="' + (W - R) + '" y="' + (H - 3) + '" font-size="11" fill="#6b7280" text-anchor="end">' + t('eeg.plot.x') + '</text>';
    s += '<polyline fill="none" stroke="#1d4ed8" stroke-width="2" points="' + f.map(function (v, i) { return x(v).toFixed(1) + ',' + y(p[i]).toFixed(1); }).join(' ') + '"/>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + t('eeg.plot.label') + '">' + s + '</svg>';
  }
  function viewResult() {
    var r = st.res, src = st.src; if (!r) return viewEeg();
    var h = X.head() + '<h1 class="pad">' + t(src.sample ? 'eeg.res.sample' : 'eeg.res.t') + '</h1>';
    if (src.sample) h += '<p class="muted small pad">' + t('eeg.src', { label: t('eeg.sample.' + src.group), source: src.source }) + '</p>';
    h += '<section class="card"><p>' + t(r.usable ? 'eeg.q.good' : 'eeg.q.bad', { kept: r.nKept, n: r.nEpochs }) + '</p>';
    if (r.usable) {
      if (src.sample) h += '<p>' + t('eeg.st.sample') + '</p>';
      else { var ev = evalAll(), a = ev[ev.length - 1], done = ev.filter(function (z) { return z.status === 'baseline' && z.r.kind === a.r.kind; }).length;
             h += '<p class="bigtxt">' + t('eeg.st.' + a.status, { done: done, total: C.eeg.baselineN }) + '</p>'; }
    }
    h += '</section>';
    if (r.usable) {
      var f = r.features;
      h += '<details class="card"><summary>' + t('ui.eeg.details') + '</summary><p class="muted small">' + t('ui.eeg.details.h') + '</p>' + spectrum(r.spectrum) + '<table class="mt"><tr><td>' + t('eeg.det.cog') + '</td><td class="num">' + t('eeg.det.hz', { v: loc(f.apf_cog, 1) }) + '</td></tr><tr><td>' +
        t('eeg.det.ratio') + '</td><td class="num">' + loc(f.theta_alpha, 2) + '</td></tr></table><p class="q">' + t('eeg.det.shares') + '</p><table class="mt">' + ['delta', 'theta', 'alpha', 'beta'].map(function (b) {
          return '<tr><td>' + t('eeg.band.' + b) + '</td><td class="num">' + Math.round(100 * f['rel_' + b]) + ' %</td></tr>'; }).join('') + '</table></details>';
    }
    return h + '<p class="note pad">' + t('eeg.note') + '</p><div class="pad"><button class="btn" data-act="eegOpen">' + t('eeg.again') + '</button></div>' + X.backBtn();
  }

  // ---------- simulated headband ----------
  function viewLive() {
    var rec = st.live.rec;
    return X.head() + '<h1 class="pad">' + t('eeg.live.t') + '</h1><p class="muted small pad">' + t('eeg.src', { label: t('eeg.sample.' + LIVE.group), source: LIVE.source }) + '</p><section class="card"><div id="eegTrace"></div>' +
      '<table class="mt">' + rec.names.map(function (nm, i) { return '<tr><td>' + nm + '</td><td>' + t('eeg.live.sig') + ': <span id="eegQ' + i + '" class="chip">…</span></td></tr>'; }).join('') + '</table>' +
      '<div class="sdbar"><i id="eegBar" style="width:0%"></i></div><p id="eegLeft" class="muted"></p><button class="btn link" data-act="eegCancel">' + t('btn.back') + '</button></section>';
  }
  function tickLive() {
    var L = st.live; if (!L || X.ui.screen !== 'eegLive') { stopLive(); return; }
    var rec = L.rec, fs = rec.fs, n = rec.data[0].length;
    L.pos = Math.min(n, L.pos + Math.round(fs * SPEED * 0.1));
    rec.names.forEach(function (_, c) {                                   // signal check on the last second
      var a = Math.max(0, L.pos - fs), lo = Infinity, hi = -Infinity;
      for (var i = a; i < L.pos; i++) { var v = rec.data[c][i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      var ok = hi - lo > 2 && hi - lo < 400, el = document.getElementById('eegQ' + c);
      if (el) { el.textContent = t(ok ? 'eeg.live.ok' : 'eeg.live.poor'); el.className = 'chip ' + (ok ? 'ok' : 'bad'); }
    });
    var ch = rec.data[rec.data.length - 1], a0 = Math.max(0, L.pos - 4 * fs), step = Math.max(1, Math.floor((L.pos - a0) / 200)), pts = [], mn = Infinity, mx = -Infinity, j;
    for (j = a0; j < L.pos; j += step) { if (ch[j] < mn) mn = ch[j]; if (ch[j] > mx) mx = ch[j]; }
    for (j = a0; j < L.pos; j += step) pts.push(((j - a0) / (4 * fs) * 340).toFixed(1) + ',' + (60 - (ch[j] - mn) / (mx - mn || 1) * 50).toFixed(1));
    var tr = document.getElementById('eegTrace');
    if (tr) tr.innerHTML = '<svg viewBox="0 0 340 66" class="chart"><polyline fill="none" stroke="#1d4ed8" stroke-width="1.5" points="' + pts.join(' ') + '"/></svg>';
    var bar = document.getElementById('eegBar'), left = document.getElementById('eegLeft');
    if (bar) bar.style.width = (100 * L.pos / n).toFixed(1) + '%';
    if (left) left.textContent = t('eeg.live.left', { s: Math.round((n - L.pos) / fs) });
    if (L.pos >= n) { stopLive(); process(rec, { sample: true, group: LIVE.group, source: LIVE.source }); }
  }
  function stopLive() { if (st.live && st.live.timer) clearInterval(st.live.timer); st.live = null; }

  // ---------- processing ----------
  function fail(key) { st.phase = 'idle'; st.msg = t('eeg.err.' + key); X.go('eeg'); }
  function process(rec, src) {
    st.phase = 'busy'; X.go('eeg');
    setTimeout(function () {                                              // let the "analysing" message appear first
      var res = E.analyse(rec);
      if (res.error) return fail(res.error);
      st.res = res; st.src = src; st.phase = 'idle'; st.msg = '';
      if (!src.sample && res.usable) {
        var f = {}; Object.keys(res.features).forEach(function (k) { f[k] = Math.round(res.features[k] * 1e4) / 1e4; });
        S.data.eeg = records().concat([{ id: 'e' + NB.now().toString(36), at: new Date(NB.now()).toISOString(), kind: res.kind, fs: res.fs, seconds: res.seconds, nEpochs: res.nEpochs, nKept: res.nKept, usable: true, features: f }]);
        S.save();
      }
      X.go('eegResult');
    }, 60);
  }
  function handleText(text, src) {
    var rec = E.parseCsv(text);
    if (rec.error) return fail(rec.error);
    if (!rec.fs) { st.pending = { rec: rec, src: src }; st.phase = 'rate'; return X.go('eeg'); }
    process(rec, src);
  }
  function file(input) {
    var f = input.files && input.files[0]; input.value = '';
    if (!f) return;
    if (f.size > 60e6) return fail('big');
    st.phase = 'reading'; X.go('eeg');
    var r = new FileReader();
    r.onload = function () { handleText(String(r.result), { sample: false }); };
    r.onerror = function () { fail('empty'); };
    r.readAsText(f);
  }
  function loadSample(meta, then) {
    st.phase = 'reading'; st.msg = ''; X.go('eeg');
    fetch('samples/' + meta.file).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('http')); }).then(then).catch(function () { fail('load'); });
  }

  function init(ext) {
    X = ext;
    X.V.eeg = viewEeg; X.V.eegResult = viewResult; X.V.eegLive = viewLive;
    X.ACT.eegOpen = function () { stopLive(); st.phase = 'idle'; st.msg = ''; X.go('eeg'); };
    X.ACT.eegCancel = function () { stopLive(); st.pending = null; st.phase = 'idle'; X.go('eeg'); };
    X.ACT.eegPick = function () { document.getElementById('eegFile').click(); };
    X.ACT.eegRate = function (el) { var p = st.pending; if (!p) return; p.rec.fs = Number(el.dataset.v); st.pending = null; process(p.rec, p.src); };
    X.ACT.eegSample = function (el) { var m = SAMPLES[Number(el.dataset.v)]; loadSample(m, function (text) { handleText(text, { sample: true, group: m.group, source: m.source }); }); };
    X.ACT.eegLive = function () {
      loadSample(LIVE, function (text) {
        var rec = E.parseCsv(text); if (rec.error || !rec.fs) return fail('load');
        st.phase = 'idle'; st.live = { rec: rec, pos: 0, timer: null }; X.go('eegLive'); st.live.timer = setInterval(tickLive, 100);
      });
    };
  }
  NB.eegUi = { init: init, card: card, file: file, state: st };
})();
