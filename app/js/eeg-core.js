/* NeuroBaseline – resting EEG from a headband: reading a recording file and computing the features.
   The same pipeline as eeg/features.py (tested against it in tests/eeg.test.js):
     band-pass 1-40 Hz -> 4-second epochs -> drop epochs with large or flat signal -> Hann periodogram per epoch
     -> average over kept epochs -> relative band powers, theta/alpha ratio, alpha centre of gravity.
   A headband delivers channels that are already referenced, so nothing is re-referenced here,
   except for a full clinical 10-20 recording, which gets a common average reference.
   Pure functions, no DOM. Runs in the browser (NB.eeg) and in Node (module.exports). */
(function (root) {
  'use strict';
  var SOS = (typeof module !== 'undefined' && module.exports) ? require('./eeg-sos.js') : root.NB.eegSos;

  var BANDS = { delta: [1, 4], theta: [4, 8], alpha: [8, 13], beta: [13, 30] }, TOTAL = [1, 30], COG = [6, 13];
  var EPOCH_S = 4, REJECT_UV = 200, FLAT_UV = 1, MIN_EPOCHS = 15, FMAX = 45;
  var TEN_TWENTY = ['FP1', 'FP2', 'F7', 'F3', 'FZ', 'F4', 'F8', 'T3', 'C3', 'CZ', 'C4', 'T4', 'T5', 'P3', 'PZ', 'P4', 'T6', 'O1', 'O2'];
  var KNOWN = TEN_TWENTY.concat(['TP9', 'TP10', 'AF7', 'AF8', 'AF3', 'AF4', 'T7', 'T8', 'P7', 'P8', 'FPZ', 'OZ']);
  var POSTERIOR = ['O1', 'O2', 'OZ', 'P3', 'P4', 'PZ', 'TP9', 'TP10', 'T5', 'T6', 'P7', 'P8'];

  // ---------- reading a CSV recording ----------
  function norm(name) { return String(name).trim().replace(/^"|"$/g, '').replace(/^(RAW|EEG)[_. ]/i, '').toUpperCase(); }
  function parseTime(v) {
    var n = Number(v); if (isFinite(n) && v !== '') return n;
    var t = Date.parse(String(v).replace(' ', 'T')); return isFinite(t) ? t / 1000 : NaN;
  }
  // Returns {names, data: [Float64Array per channel], fs (or null), kind, rows, skipped} or {error}.
  function parseCsv(text) {
    var lines = String(text).split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 3) return { error: 'empty' };
    var delim = [',', ';', '\t'].sort(function (a, b) { return lines[0].split(b).length - lines[0].split(a).length; })[0];
    var head = lines[0].split(delim).map(norm);
    if (head.every(function (h) { return h !== '' && isFinite(Number(h)); })) return { error: 'noheader' };
    var timeCol = -1, cols = [];
    head.forEach(function (h, i) {
      if (timeCol < 0 && /^(TIME|TIMESTAMP|TIME_S|T)$/.test(h)) timeCol = i;
      else if (KNOWN.indexOf(h) >= 0) cols.push(i);
    });
    if (!cols.length) return { error: 'nochannels' };
    var n = lines.length - 1, data = cols.map(function () { return new Float64Array(n); }), times = timeCol >= 0 ? new Float64Array(n) : null, k = 0, skipped = 0;
    for (var r = 1; r < lines.length; r++) {
      var cell = lines[r].split(delim), ok = true;
      for (var c = 0; c < cols.length; c++) {
        var v = cell[cols[c]] === undefined || cell[cols[c]].trim() === '' ? NaN : Number(cell[cols[c]]);
        if (!isFinite(v)) { ok = false; break; }
        data[c][k] = v;
      }
      if (!ok) { skipped++; continue; }                                   // marker rows and gaps
      if (times) times[k] = parseTime(cell[timeCol]);
      k++;
    }
    if (k < 100) return { error: 'empty' };
    data = data.map(function (d) { return d.subarray(0, k); });
    var fs = null;
    if (times && isFinite(times[0]) && isFinite(times[k - 1]) && times[k - 1] > times[0]) {
      var rate = (k - 1) / (times[k - 1] - times[0]);
      if (rate < 1) rate *= 1000;                                         // time column in milliseconds
      fs = nearestRate(rate);
    }
    var names = cols.map(function (i) { return head[i]; });
    return { names: names, data: data, fs: fs, kind: montageKind(names), rows: k, skipped: skipped };
  }
  function nearestRate(rate) {
    var best = null, gap = 0.01;                                            // within 1 %: 250 and 256 Hz must not be confused
    Object.keys(SOS).forEach(function (f) { var d = Math.abs(rate - f) / f; if (d < gap) { gap = d; best = Number(f); } });
    return best;
  }
  function montageKind(names) {
    var has = function (c) { return names.indexOf(c) >= 0; };
    if (has('TP9') && has('TP10')) return 'muse';
    if (has('O1') && has('O2') && has('T3') && has('T4') && names.length <= 6) return 'brainbit';
    if (TEN_TWENTY.filter(has).length >= 16) return 'clinical';
    return 'other';
  }

  // ---------- signal processing ----------
  function sosfilt(sos, x) {
    var y = Float64Array.from(x);
    for (var s = 0; s < sos.length; s++) {
      var b0 = sos[s][0], b1 = sos[s][1], b2 = sos[s][2], a1 = sos[s][4], a2 = sos[s][5], z1 = 0, z2 = 0;
      for (var i = 0; i < y.length; i++) { var xi = y[i], yi = b0 * xi + z1; z1 = b1 * xi - a1 * yi + z2; z2 = b2 * xi - a2 * yi; y[i] = yi; }
    }
    return y;
  }
  function filtfilt(sos, x, pad) {                                        // zero-phase: forward and backward, with odd padding
    var n = x.length; pad = Math.min(pad, n - 1);
    var ext = new Float64Array(n + 2 * pad), i;
    for (i = 0; i < pad; i++) { ext[i] = 2 * x[0] - x[pad - i]; ext[pad + n + i] = 2 * x[n - 1] - x[n - 2 - i]; }
    ext.set(x, pad);
    var y = sosfilt(sos, ext).reverse();
    y = sosfilt(sos, y).reverse();
    return y.subarray(pad, pad + n);
  }
  var tables = {};
  function dftTable(n, fs) {                                              // cos/sin for the 1-45 Hz bins of an n-sample epoch
    var key = n + '@' + fs; if (tables[key]) return tables[key];
    var df = fs / n, k0 = Math.round(1 / df), k1 = Math.round(FMAX / df), nb = k1 - k0 + 1;
    var cos = new Float64Array(nb * n), sin = new Float64Array(nb * n), freqs = new Float64Array(nb), win = new Float64Array(n), wsum = 0;
    for (var i = 0; i < n; i++) { win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); wsum += win[i] * win[i]; }
    for (var b = 0; b < nb; b++) {
      freqs[b] = (k0 + b) * df;
      for (i = 0; i < n; i++) { var a = 2 * Math.PI * (k0 + b) * i / n; cos[b * n + i] = Math.cos(a); sin[b * n + i] = Math.sin(a); }
    }
    return (tables[key] = { cos: cos, sin: sin, freqs: freqs, win: win, scale: 2 / (fs * wsum), nb: nb, df: df });
  }
  function bandPower(freqs, p, lo, hi, df) { var s = 0; for (var i = 0; i < freqs.length; i++) if (freqs[i] >= lo && freqs[i] < hi) s += p[i]; return s * df; }

  // rec: result of parseCsv with rec.fs set. onProgress(fraction) is optional. Returns features, quality and the mean spectrum.
  function analyse(rec, onProgress) {
    var fs = rec.fs, sos = SOS[fs];
    if (!sos) return { error: 'rate' };
    var data = rec.data, names = rec.names, nCh = data.length, i, c;
    var x = data.map(function (d) { return filtfilt(sos, d, Math.round(3 * fs)); });
    if (rec.kind === 'clinical') {                                        // common average over the 10-20 channels
      var idx = names.map(function (nm, j) { return TEN_TWENTY.indexOf(nm) >= 0 ? j : -1; }).filter(function (j) { return j >= 0; });
      for (i = 0; i < x[0].length; i++) { var m = 0; for (c = 0; c < idx.length; c++) m += x[idx[c]][i]; m /= idx.length; for (c = 0; c < idx.length; c++) x[idx[c]][i] -= m; }
      x = idx.map(function (j) { return x[j]; }); names = idx.map(function (j) { return names[j]; }); nCh = x.length;
    }
    var n = Math.round(EPOCH_S * fs), nEp = Math.floor(x[0].length / n), tb = dftTable(n, fs), nb = tb.nb;
    var post = names.map(function (nm, j) { return POSTERIOR.indexOf(nm) >= 0 ? j : -1; }).filter(function (j) { return j >= 0; });
    if (!post.length) post = names.map(function (_, j) { return j; });
    var sumAll = new Float64Array(nb), sumPost = new Float64Array(nb), kept = 0, seg = new Float64Array(n);
    for (var e = 0; e < nEp; e++) {
      var ok = true;
      for (c = 0; c < nCh && ok; c++) {
        var lo = Infinity, hi = -Infinity;
        for (i = 0; i < n; i++) { var v = x[c][e * n + i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        if (hi - lo >= REJECT_UV || hi - lo <= FLAT_UV) ok = false;
      }
      if (ok) {
        kept++;
        for (c = 0; c < nCh; c++) {
          var mean = 0; for (i = 0; i < n; i++) mean += x[c][e * n + i]; mean /= n;
          for (i = 0; i < n; i++) seg[i] = (x[c][e * n + i] - mean) * tb.win[i];
          var isPost = post.indexOf(c) >= 0;
          for (var b = 0; b < nb; b++) {
            var re = 0, im = 0, off = b * n;
            for (i = 0; i < n; i++) { re += seg[i] * tb.cos[off + i]; im += seg[i] * tb.sin[off + i]; }
            var p = (re * re + im * im) * tb.scale;
            sumAll[b] += p / nCh; if (isPost) sumPost[b] += p / post.length;
          }
        }
      }
      if (onProgress && e % 5 === 0) onProgress((e + 1) / nEp);
    }
    var out = { fs: fs, kind: rec.kind, channels: names, seconds: Math.round(x[0].length / fs), nEpochs: nEp, nKept: kept, keptFrac: nEp ? kept / nEp : 0,
                usable: kept >= MIN_EPOCHS, features: null, spectrum: null };
    if (!out.usable) return out;
    var pm = Array.prototype.map.call(sumAll, function (v) { return v / kept; }), pp = Array.prototype.map.call(sumPost, function (v) { return v / kept; });
    var f = tb.freqs, total = bandPower(f, pm, TOTAL[0], TOTAL[1], tb.df), bp = {};
    Object.keys(BANDS).forEach(function (k) { bp[k] = bandPower(f, pm, BANDS[k][0], BANDS[k][1], tb.df); });
    var num = 0, den = 0;
    for (i = 0; i < f.length; i++) if (f[i] >= COG[0] && f[i] <= COG[1]) { num += f[i] * pp[i]; den += pp[i]; }
    out.features = { rel_delta: bp.delta / total, rel_theta: bp.theta / total, rel_alpha: bp.alpha / total, rel_beta: bp.beta / total,
                     theta_alpha: bp.theta / bp.alpha, slow_ratio: (bp.delta + bp.theta) / (bp.alpha + bp.beta), apf_cog: num / den };
    var totP = bandPower(f, pp, TOTAL[0], TOTAL[1], tb.df);
    out.spectrum = { freqs: Array.prototype.slice.call(f).filter(function (v) { return v <= 30; }),                 // posterior, share of 1-30 Hz power per Hz
                     rel: pp.filter(function (_, j) { return f[j] <= 30; }).map(function (v) { return v / totP; }) };
    return out;
  }

  // ---------- following one person over time ----------
  // records: saved results, oldest first, each {id, at, kind, usable, features}. cfg: config.eeg.
  // The first cfg.baselineN usable recordings of a device type form the baseline; later ones get a z value against it.
  function evaluate(records, cfg) {
    var base = {}, out = [];
    (records || []).forEach(function (r) {
      var a = { r: r, status: 'unusable', z: {} };
      out.push(a);
      if (!r.usable || !r.features) return;
      var b = base[r.kind] = base[r.kind] || { n: 0, lt: 0, cog: 0 };
      var lt = Math.log(r.features.theta_alpha), cog = r.features.apf_cog;
      if (b.n < cfg.baselineN) { b.n++; b.lt += lt; b.cog += cog; a.status = 'baseline'; return; }
      var k = Math.sqrt(1 + 1 / b.n);
      a.z = { theta_alpha: (lt - b.lt / b.n) / (cfg.sigmaLogRatio * k), apf_cog: (b.cog / b.n - cog) / (cfg.sigmaCog * k) };   // positive = slower than usual
      a.baseline = { theta_alpha: Math.exp(b.lt / b.n), apf_cog: b.cog / b.n };
      a.status = (a.z.theta_alpha > cfg.z || a.z.apf_cog > cfg.z) ? 'changed' : 'within';
    });
    return out;
  }

  var api = { parseCsv: parseCsv, analyse: analyse, evaluate: evaluate, montageKind: montageKind, nearestRate: nearestRate, rates: Object.keys(SOS).map(Number),
              BANDS: BANDS, MIN_EPOCHS: MIN_EPOCHS, EPOCH_S: EPOCH_S };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.eeg = api; }
})(typeof window !== 'undefined' ? window : globalThis);
