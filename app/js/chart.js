/* NeuroBaseline – small SVG trend chart: the person's points, baseline mean and usual range. */
(function () {
  'use strict';
  var NB = window.NB, ST = NB.stats;
  var COL = { fam: '#9ca3af', base: '#16a34a', fu: '#2563eb', out: '#dc2626', ctl: '#7c3aed' };

  function ticks(lo, hi) {
    var span = hi - lo || 1, raw = span / 3, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p, out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  }
  function render(host, ev, indId) {
    var pts = ev.sessions.filter(function (a) { return a.role !== 'previous' && ST.isNum(a.s.measures[indId]); });   // an earlier device is not comparable
    if (!pts.length) { host.innerHTML = ''; return; }
    var W = 340, H = 190, L = 40, R = 12, T = 12, B = 26, band = ev.bands[indId];
    var vals = pts.map(function (a) { return a.s.measures[indId]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (band) { lo = Math.min(lo, band.lo); hi = Math.max(hi, band.hi); }
    var pad = (hi - lo || 1) * 0.1; lo -= pad; hi += pad;
    function X(i) { return pts.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (pts.length - 1); }
    function Y(v) { return T + (hi - v) * (H - T - B) / (hi - lo); }
    var s = '';
    if (band) {
      s += '<rect x="' + L + '" y="' + Y(band.hi) + '" width="' + (W - L - R) + '" height="' + (Y(band.lo) - Y(band.hi)) + '" fill="#dcfce7"/>';
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(band.mean) + '" y2="' + Y(band.mean) + '" stroke="#16a34a" stroke-dasharray="5 4"/>';
    }
    ticks(lo, hi).forEach(function (v) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#eef0f3"/>';
      s += '<text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" font-size="11" fill="#6b7280" text-anchor="end">' + v + '</text>';
    });
    s += '<line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#9ca3af"/>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="#9ca3af"/>';
    var line = [];
    pts.forEach(function (a, i) { if (a.role !== 'control') line.push(X(i).toFixed(1) + ',' + Y(a.s.measures[indId]).toFixed(1)); });
    if (line.length > 1) s += '<polyline fill="none" stroke="#93c5fd" stroke-width="1.5" points="' + line.join(' ') + '"/>';
    pts.forEach(function (a, i) {
      var x = X(i), y = Y(a.s.measures[indId]), info = a.ind[indId];
      if (a.role === 'control') {
        s += '<polygon points="' + x + ',' + (y - 7) + ' ' + (x + 7) + ',' + y + ' ' + x + ',' + (y + 7) + ' ' + (x - 7) + ',' + y + '" fill="' + COL.ctl + '"/>'; return;
      }
      var c = a.role === 'familiarization' ? COL.fam : a.role === 'baseline' ? COL.base : a.role === 'excluded' ? COL.fam : (info && info.exceeds ? COL.out : COL.fu);
      var hollow = a.s.flagged || a.role === 'excluded';
      s += '<circle cx="' + x + '" cy="' + y + '" r="5" fill="' + (hollow ? '#fff' : c) + '" stroke="' + c + '" stroke-width="2"/>';
    });
    function lab(i) {
      var d = new Date(Date.parse(pts[i].s.startedAt));
      return '<text x="' + X(i) + '" y="' + (H - 8) + '" font-size="11" fill="#6b7280" text-anchor="' + (i === 0 ? 'start' : 'end') + '">' + d.getDate() + '/' + (d.getMonth() + 1) + '</text>';
    }
    s += lab(0); if (pts.length > 1) s += lab(pts.length - 1);
    function esc(value) { return String(value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var last = pts[pts.length - 1], label = NB.i18n.t('ui.chart.label', { name: NB.i18n.t('ind.' + indId), n: pts.length, value: last.s.measures[indId], date: new Date(last.s.startedAt).toLocaleDateString(NB.i18n.lang === 'vi' ? 'vi-VN' : 'en-GB') });
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title>' + s + '</svg>';
  }
  NB.chart = { render: render, COL: COL };
})();
