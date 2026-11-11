/* NeuroBaseline – clinician view (screens). Everything stays in this browser: participants' files are imported
   by hand, and review notes are stored locally. Every value from a file is sanitised (clin-core.js) and escaped. */
(function () {
  'use strict';
  var NB = window.NB, C = NB.config, ST = NB.stats, RK = NB.risk, CL = NB.clin, I = NB.i18n;
  var KEY = 'nb.clin.v1', LANG = 'nb.clin.lang', DAY = 864e5, DEPS = { stats: ST, risk: RK, config: C };
  function t(k, v) { return I.t(k, v); }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var store = (function () { try { var d = JSON.parse(get(KEY)); if (d && d.schema === 1 && d.patients) return d; } catch (e) {} return { schema: 1, patients: {} }; })();
  function save() { set(KEY, JSON.stringify(store)); }
  var ui = { msg: '', query: '', filter: 'all' };

  function fmtDate(ms) { if (ms == null || !isFinite(ms)) return t('c.none'); var d = new Date(ms); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); }
  function ago(ms, now) { if (ms == null) return t('c.none'); var n = Math.floor((now - ms) / DAY); return n <= 0 ? t('c.today') : t('c.days', { n: n }); }
  function loc(s) { return I.lang === 'vi' ? String(s).replace('.', ',') : String(s); }          // decimal comma in Vietnamese
  function fmtVal(id, v, digits) {
    if (!ST.isNum(v)) return t('c.none');
    var d = digits == null ? (id === 'rt' || id === 'gng' ? 0 : 1) : digits, s = loc(v.toFixed(d));
    return id === 'rt' ? s + ' ms' : id === 'gng' ? s + ' %' : s;
  }
  var LIM = {};
  function setLimits() { LIM = { z: loc(C.rci.z), zr: loc(C.rci.zRed.toFixed(1)), hy: loc(C.trend.yellow.toFixed(1)), hr: loc(C.trend.red.toFixed(1)) }; }
  function statusLabel(s) { return t('c.st.' + s.status, { done: s.e.done, total: s.e.total }); }
  function reasonText(a) { return a ? a.reasons.map(function (r) { return t('c.rs.' + r, LIM); }) : []; }
  function simTag(p) { return p.data.simulated ? '<span class="tag sim">' + t('c.sim') + '</span>' : ''; }
  function eduName(e) { return e ? t('edu.' + e) : t('c.none'); }

  function topbar(detail) {
    return '<header class="top"><a class="brand" href="clinician.html"><span class="brand-mark" aria-hidden="true">n·</span>NeuroBaseline <span class="workspace-label">' + t('ui.clinician') + '</span></a><div class="tag-line">' + t('c.tag') + '</div></header><div class="bar noprint">' +
      (detail ? '<button class="btn sm" data-act="back">← ' + t('c.back') + '</button><button class="btn sm" data-act="print">' + t('c.print') + '</button>'
        : '<button class="btn sm primary" data-act="import">' + t('c.import') + '</button><button class="btn sm" data-act="demo">' + t(hasDemo() ? 'c.demo.off' : 'c.demo.on') + '</button>') +
      '<span class="grow"></span>' + I.langs.map(function (l) { return '<button class="btn sm' + (I.lang === l[0] ? ' on' : '') + '" data-act="lang" data-v="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>';
  }
  function hasDemo() { return Object.keys(store.patients).some(function (k) { return store.patients[k].source === 'demo'; }); }

  // ---------- list ----------
  function viewList() {
    var now = Date.now(), rows = Object.keys(store.patients).map(function (k) { var p = store.patients[k]; return { p: p, s: CL.summarize(p, DEPS, now) }; });
    rows.sort(function (a, b) { return a.s.rank - b.s.rank || (b.s.lastAt || 0) - (a.s.lastAt || 0); });
    var h = topbar(false) + '<main class="page"><div class="page-heading"><div class="eyebrow">' + t('ui.clinician') + '</div><h1>' + t('ui.c.title') + '</h1><p class="muted">' + t('ui.c.subtitle') + '</p></div><div class="cohort-stats noprint">' + ['all', 'pending', 'repeat', 'overdue'].map(function (key) {
      var count = rows.filter(function (r) { return matchesFilter(r.s, key); }).length;
      return '<button class="stat' + (ui.filter === key ? ' selected' : '') + '" data-act="filter" data-v="' + key + '" aria-pressed="' + (ui.filter === key) + '"><span>' + t('ui.c.' + key) + '</span><b>' + count + '</b></button>';
    }).join('') + '</div><p class="muted data-caption">' + t('c.intro') + '</p>' + (ui.msg ? '<p class="note" role="status">' + esc(ui.msg) + '</p>' : '');
    if (!rows.length) return h + '<p class="empty">' + t('c.empty') + '</p></main>';
    h += '<div class="list-tools noprint"><label><span class="sr-only">' + t('ui.c.searchlabel') + '</span><input type="search" id="participantSearch" placeholder="' + t('ui.c.search') + '" value="' + esc(ui.query) + '"></label><span id="listCount" role="status" aria-live="polite" aria-atomic="true"></span></div><div class="scroll list-surface"><table class="list"><thead><tr><th>' + t('c.col.code') + '</th><th>' + t('c.col.status') + '</th><th>' + t('c.col.why') + '</th><th>' + t('c.col.last') + '</th><th>' +
      t('c.col.risk') + '</th><th>' + t('c.col.review') + '</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var p = r.p, s = r.s, why = s.urgent ? [fmtDate(s.lastFlag)] : reasonText(s.e.last && s.e.light && s.e.light !== 'green' ? s.e.last : null);
      h += '<tr class="row" data-act="open" data-v="' + esc(p.code) + '" data-pending="' + (s.needsReview ? '1' : '0') + '" data-repeat="' + (s.status === 'yellow' ? '1' : '0') + '" data-overdue="' + (s.overdue ? '1' : '0') + '"><td><a data-act="open" data-v="' + esc(p.code) + '" href="#' + encodeURIComponent(p.code) + '" aria-label="' + esc(t('ui.c.open', { code: p.code })) + '">' + esc(p.code) + '</a> ' + simTag(p) + '<div class="muted small">' + esc(p.data.profile.ageBand || '') + ' · ' + eduName(p.data.profile.edu) + '</div></td>' +
        '<td><span class="st ' + s.status + '"><i></i>' + statusLabel(s) + '</span></td><td class="small">' + why.map(esc).join('; ') + '</td>' +
        '<td class="nowrap">' + fmtDate(s.lastAt) + '<div class="muted small">' + ago(s.lastAt, now) + (s.overdue ? ' · <span class="tag warn">' + t('c.tag.overdue') + '</span>' : '') + '</div></td>' +
        '<td>' + (s.risk ? s.risk.present.length : '<span class="muted small">' + t('c.notshared') + '</span>') + '</td>' +
        '<td>' + (s.needsReview ? '<span class="tag need">' + t('c.tag.pending') + '</span>' : s.reviewed ? '<span class="tag ok">' + t('c.tag.reviewed') + '</span>' : '') + (s.stale ? ' <span class="tag warn">' + t('c.tag.stale') + '</span>' : '') + '</td></tr>';
    });
    return h + '</tbody></table><p class="empty" id="noMatches" hidden>' + t('ui.c.noresults') + '</p></div><p class="muted small limits">' + t('c.limits') + '</p></main>';
  }
  function matchesFilter(s, key) { return key === 'all' || (key === 'pending' && s.needsReview) || (key === 'repeat' && s.status === 'yellow') || (key === 'overdue' && s.overdue); }
  function filterList() {
    var rows = document.querySelectorAll('table.list .row'), count = 0;
    rows.forEach(function (row) {
      var visible = row.dataset.v.toLowerCase().indexOf(ui.query.trim().toLowerCase()) >= 0 && (ui.filter === 'all' || row.dataset[ui.filter] === '1');
      row.hidden = !visible; if (visible) count++;
    });
    if ($('listCount')) $('listCount').textContent = t('ui.c.count', { n: count });
    if ($('noMatches')) $('noMatches').hidden = count !== 0;
    if ($('listCount')) NB.access.announce(t('ui.c.count', { n: count }));
  }

  // ---------- detail ----------
  var sectionKeys = ['status', 'ind', 'trend', 'charts', 'risk', 'eeg', 'check', 'review', 'log'];
  function sec(title, body, cls) {
    var key = sectionKeys.filter(function (k) { return t('c.sec.' + k) === title; })[0];
    return '<section' + (key ? ' id="clinical-' + key + '"' : '') + ' class="card ' + (cls || '') + '"><h2>' + title + '</h2>' + body + '</section>';
  }
  function viewDetail(p) {
    var now = Date.now(), s = CL.summarize(p, DEPS, now), e = s.e, d = p.data, last = e.last, inds = C.indicators;
    var h = topbar(true) + '<main class="page detail"><h1>' + esc(p.code) + ' ' + simTag(p) + '</h1>' + (d.simulated ? '<p class="muted small">' + t('c.sim.note') + '</p>' : '');
    h += '<nav class="section-nav noprint" aria-label="' + t('ui.c.nav') + '">' + sectionKeys.map(function (key) { return '<a href="#clinical-' + key + '" data-act="section" data-v="clinical-' + key + '">' + t('c.sec.' + key) + '</a>'; }).join('') + '</nav>';
    if (s.lastFlag !== null) h += '<section class="card urgent' + (s.urgent ? '' : ' past') + '"><h2>' + t('c.urgent.t', { date: fmtDate(s.lastFlag) }) + '</h2><p>' + t('c.urgent.x') + '</p></section>';

    // status + profile
    var st = '<p class="statusline"><span class="st ' + (s.status === 'urgent' ? (e.light || 'none') : s.status) + '"><i></i>' + t('c.st.' + (e.light || (e.phase === 'monitoring' ? 'ready' : e.phase)), { done: e.done, total: e.total }) + '</span></p>';
    if (last && e.light && e.light !== 'green') st += '<ul>' + reasonText(last).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (e.light === 'red') st += '<p class="note">' + t('c.rv.pending') + '</p>';
    if (s.accessAt) st += '<p class="note">' + t('c.access', { date: fmtDate(s.accessAt) }) + '</p>';
    st += '<p class="muted small">' + t('c.next') + ': ' + fmtDate(e.nextDue) + (s.overdue ? ' · <span class="tag warn">' + t('c.tag.overdue') + '</span>' : '') + '</p>';
    var first = e.sessions.length ? Date.parse(e.sessions[0].s.startedAt) : null;
    var prof = '<table class="kv"><tr><td>' + t('c.age') + '</td><td>' + esc(d.profile.ageBand || t('c.none')) + '</td></tr><tr><td>' + t('c.edu') + '</td><td>' + eduName(d.profile.edu) + '</td></tr><tr><td>' +
      t('c.hand') + '</td><td>' + (d.profile.hand ? t('hand.' + d.profile.hand) : t('c.none')) + '</td></tr><tr><td>' + t('c.enrolled') + '</td><td>' + fmtDate(first) + '</td></tr><tr><td>' + t('c.sessions') +
      '</td><td>' + e.sessions.length + '</td></tr><tr><td>' + t('c.exported') + '</td><td>' + fmtDate(p.exportedAt ? Date.parse(p.exportedAt) : null) + '</td></tr></table>';
    h += '<div class="two">' + sec(t('c.sec.status'), st) + sec(t('c.sec.profile'), prof) + '</div>';

    // indicators vs baseline
    var lastStd = e.sessions.filter(function (a) { return a.role !== 'control' && a.role !== 'previous'; }).pop();
    if (e.rebased) h += '<p class="muted">' + t('c.rebased', { n: e.sessions.filter(function (a) { return a.role === 'previous'; }).length }) + '</p>';
    var tb = '<div class="scroll"><table class="data"><thead><tr><th>' + t('c.ind.h') + '</th><th>' + t('c.ind.base', { n: C.baseline.n }) + '</th><th>' + t('c.ind.sw') + '</th><th>' + t('c.ind.last') + '</th><th>' +
      t('c.ind.rci') + '</th><th>' + t('c.ind.lim', LIM) + '</th><th>' + t('c.ind.limr', LIM) + '</th></tr></thead><tbody>';
    inds.forEach(function (ind) {
      var b = e.bands[ind.id], x = last ? last.ind[ind.id] : null, v = lastStd ? lastStd.s.measures[ind.id] : null;
      tb += '<tr><td>' + t('ind.' + ind.id) + (ind.primary ? '' : ' *') + '</td><td class="num">' + (b ? fmtVal(ind.id, b.mean, 1) : t('c.none')) + '</td><td class="num">' + (b ? fmtVal(ind.id, b.sigma, 1) : t('c.none')) +
        '</td><td class="num">' + fmtVal(ind.id, v) + '</td><td class="num ' + (x && x.exceedsRed ? 'bad' : x && x.exceeds ? 'warn' : '') + '">' + (x ? (x.rci >= 0 ? '+' : '−') + loc(Math.abs(x.rci).toFixed(2)) : t('c.none')) +
        '</td><td class="num">' + (b ? fmtVal(ind.id, b.limit, 1) : t('c.none')) + '</td><td class="num">' + (b ? fmtVal(ind.id, b.mean + ind.worse * C.rci.zRed * b.sDiff, 1) : t('c.none')) + '</td></tr>';
    });
    h += sec(t('c.sec.ind'), tb + '</tbody></table></div><p class="muted small">' + t('c.ind.note') + '</p>');

    // trend test
    var tr = last && last.trend ? '<p>' + t('c.trend.stat', { s: '<b class="' + (last.trend.stat >= C.trend.red ? 'bad' : last.trend.stat >= C.trend.yellow ? 'warn' : '') + '">' + loc(last.trend.stat.toFixed(2)) + '</b>', hy: LIM.hy, hr: LIM.hr }) + '</p>' +
      (last.trend.stat >= 1 ? '<p>' + t('c.trend.since', { n: last.trend.months }) + '</p>' : '') +
      '<p>' + t('c.trend.part', { parts: Object.keys(last.trend.parts).map(function (id) { return t('ind.' + id) + ' ' + (last.trend.parts[id] >= 0 ? '+' : '−') + loc(Math.abs(last.trend.parts[id]).toFixed(2)); }).join('; ') }) + '</p>'
      : '<p class="muted">' + t('c.trend.none') + '</p>';
    h += sec(t('c.sec.trend'), tr + '<p class="muted small">' + t('c.trend.note') + '</p>');

    // charts
    h += sec(t('c.sec.charts'), '<div class="charts">' + inds.map(function (ind) { return '<figure><figcaption>' + t('ind.' + ind.id) + ' <span class="muted small">' + t('ind.' + ind.id + '.d') + '</span></figcaption><div data-chart="' + ind.id + '"></div></figure>'; }).join('') + '</div>');

    // risk context
    var rk;
    if (!s.risk) rk = '<p class="muted">' + t('c.risk.none') + '</p>';
    else {
      var names = function (ids) { return ids.length ? ids.map(function (id) { return t('f.' + id); }).join(', ') : t('c.none'); }, L = s.risk.libra, c = s.risk.context;
      rk = '<table class="kv"><tr><td>' + t('c.risk.present') + '</td><td>' + names(s.risk.present) + '</td></tr><tr><td>' + t('c.risk.managed') + '</td><td>' + names(s.risk.managed) + '</td></tr><tr><td>' +
        t('c.risk.unknown') + '</td><td>' + names(s.risk.unknown) + '</td></tr></table><p>' + (L.complete ? t('c.risk.libra', { s: loc(L.score.toFixed(1)) }) : t('c.risk.libra.inc', { a: L.answered, s: loc(L.score.toFixed(1)) })) +
        (s.risk.bmi != null ? ' BMI ' + loc(s.risk.bmi) + '.' : '') + (s.risk.phq2 != null ? ' PHQ-2 ' + s.risk.phq2 + '.' : '') + '</p>' +
        ((c.family || c.snore || c.shortSleep) ? '<ul>' + (c.family ? '<li>' + t('c.risk.fam') + '</li>' : '') + (c.snore ? '<li>' + t('c.risk.snore') + '</li>' : '') + (c.shortSleep ? '<li>' + t('c.risk.short') + '</li>' : '') + '</ul>' : '');
    }
    h += sec(t('c.sec.risk'), rk);

    // resting EEG, if shared
    var eg;
    if (!d.eeg || !d.eeg.length) eg = '<p class="muted">' + t('c.eeg.none') + '</p>';
    else {
      eg = '<div class="scroll"><table class="data"><thead><tr><th>' + t('c.eeg.date') + '</th><th>' + t('c.eeg.dev') + '</th><th>' + t('c.eeg.kept') + '</th><th>' + t('c.eeg.ratio') + '</th><th>' + t('c.eeg.cog') + '</th><th>' + t('c.eeg.z') + '</th><th>' + t('c.eeg.status') + '</th></tr></thead><tbody>';
      NB.eeg.evaluate(d.eeg, C.eeg).slice().reverse().forEach(function (a) {
        var r = a.r, f = r.features, z = a.z && ST.isNum(a.z.theta_alpha) ? (a.z.theta_alpha >= 0 ? '+' : '−') + loc(Math.abs(a.z.theta_alpha).toFixed(2)) + '; ' + (a.z.apf_cog >= 0 ? '+' : '−') + loc(Math.abs(a.z.apf_cog).toFixed(2)) : t('c.none');
        eg += '<tr><td class="nowrap">' + fmtDate(Date.parse(r.at)) + '</td><td>' + t('eeg.kind.' + r.kind) + '</td><td class="num">' + (ST.isNum(r.nKept) && ST.isNum(r.nEpochs) ? r.nKept + '/' + r.nEpochs : t('c.none')) + '</td><td class="num">' +
          (f ? loc(f.theta_alpha.toFixed(2)) : t('c.none')) + '</td><td class="num">' + (f ? loc(f.apf_cog.toFixed(2)) + ' Hz' : t('c.none')) + '</td><td class="num ' + (a.status === 'changed' ? 'warn' : '') + '">' + z + '</td><td>' + t('c.eeg.s.' + a.status) + '</td></tr>';
      });
      eg += '</tbody></table></div><p class="muted small">' + t('c.eeg.note') + '</p>';
    }
    h += sec(t('c.sec.eeg'), eg);

    // checklist
    var pr = CL.prompts(p, s, now), ck = p.checklist || {};
    var order = CL.CHECKLIST.slice().sort(function (a, b) { return (pr[b] ? 1 : 0) - (pr[a] ? 1 : 0); });
    var cl = '<p class="muted small">' + t('c.check.lead') + '</p><ul class="check">' + order.map(function (id) {
      var why = (pr[id] || []).map(function (x) { var v = x[1]; if (v.ids) v = { names: v.ids.map(function (i) { return t('f.' + i); }).join(', ') }; return t(x[0], v); });
      return '<li class="' + (pr[id] ? 'prompted' : '') + '"><label><input type="checkbox" data-ck="' + id + '"' + (ck[id] ? ' checked' : '') + '> <span>' + t('c.ck.' + id) + '</span></label>' +
        (why.length ? '<div class="small why"><span class="tag need">' + t('c.prompted') + '</span> ' + esc(why.join('; ')) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
    h += sec(t('c.sec.check'), cl);

    // review
    var rv = p.review || {};
    h += sec(t('c.sec.review'), '<label class="chk"><input type="checkbox" id="rvDone"' + (rv.reviewed ? ' checked' : '') + '> <span>' + t('c.rv.reviewed') + '</span></label>' +
      '<label class="fld">' + t('c.rv.decision') + '<select id="rvDecision">' + CL.DECISIONS.map(function (k) { return '<option value="' + k + '"' + ((rv.decision || 'none') === k ? ' selected' : '') + '>' + t('c.rv.d.' + k) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">' + t('c.rv.note') + '<textarea id="rvNote" rows="3" maxlength="2000">' + esc(rv.note || '') + '</textarea></label>' +
      '<button class="btn sm primary noprint" data-act="saveReview">' + t('c.rv.save') + '</button>' + (rv.at ? ' <span class="muted small">' + t('c.rv.saved', { date: fmtDate(Date.parse(rv.at)) }) + '</span>' : '') +
      (s.stale ? ' <span class="tag warn">' + t('c.tag.stale') + '</span>' : ''), 'review');

    // session log
    var lg = '<div class="scroll"><table class="data"><thead><tr><th>' + t('c.log.date') + '</th><th>' + t('c.log.role') + '</th>' + inds.map(function (i) { return '<th>' + t('ind.' + i.id) + '</th>'; }).join('') +
      '<th>' + t('c.log.ctx') + '</th><th>' + t('c.log.light') + '</th></tr></thead><tbody>';
    e.sessions.slice().reverse().slice(0, 40).forEach(function (a) {
      var c = a.s.context || {}, tags = [c.sleep === 'poor' ? t('c.ctx.sleep') : '', c.unwell ? t('c.ctx.unwell') : '', c.mood === 'low' ? t('c.ctx.mood') : '', c.medChange ? t('c.ctx.med') : ''].filter(Boolean);
      lg += '<tr><td class="nowrap">' + fmtDate(Date.parse(a.s.startedAt)) + '</td><td>' + t('c.role.' + a.role) + '</td>' + inds.map(function (i) {
        var x = a.ind[i.id]; return '<td class="num ' + (x && x.exceedsRed && i.primary ? 'bad' : x && x.exceeds && i.primary ? 'warn' : '') + '">' + fmtVal(i.id, a.s.measures[i.id]) + '</td>';
      }).join('') + '<td class="small">' + esc(tags.join(', ')) + '</td><td>' + (a.light ? '<span class="st ' + a.light + '"><i aria-hidden="true"></i>' + t('c.st.' + a.light) + '</span>' : '') + '</td></tr>';
    });
    h += sec(t('c.sec.log'), lg + '</tbody></table></div>');
    return h + '<p class="muted small">' + t('c.limits') + '</p><p class="noprint"><button class="btn sm danger" data-act="remove">' + t('c.remove') + '</button></p></main>';
  }

  function current() { var code = decodeURIComponent(location.hash.slice(1)); return store.patients.hasOwnProperty(code) ? store.patients[code] : null; }
  function render() {
    NB.access.clear();
    setLimits();
    var p = current();
    $('app').innerHTML = p ? viewDetail(p) : viewList();
    NB.access.tables($('app'), p ? p.code : '');
    if (!p) filterList();
    if (p) {
      var e = ST.evaluate(p.data.sessions, C, Date.now());
      document.querySelectorAll('[data-chart]').forEach(function (el) { NB.chart.render(el, e, el.dataset.chart); });
    }
    document.title = (p ? p.code + ' — ' : '') + 'NeuroBaseline';
    var heading = $('app').querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }

  // ---------- data in ----------
  function addPatient(clean, source) {
    var old = store.patients[clean.data.code];
    store.patients[clean.data.code] = { code: clean.data.code, source: source, importedAt: new Date().toISOString(), exportedAt: clean.exportedAt, data: clean.data,
                                        review: old && old.source === source ? old.review : undefined, checklist: old && old.source === source ? old.checklist : undefined };
  }
  function importFiles(files) {
    var list = Array.prototype.slice.call(files), ok = 0, bad = 0, left = list.length;
    if (!left) return;
    function done() {
      if (--left) return;
      save(); ui.msg = (ok ? t('c.imp.ok', { n: ok }) : '') + (ok && bad ? ' ' : '') + (bad ? t('c.imp.bad', { n: bad }) : ''); render(); NB.access.announce(ui.msg);
    }
    list.forEach(function (f) {
      if (f.size > 5e6) { bad++; return done(); }
      var r = new FileReader();
      r.onload = function () {
        var clean = null; try { clean = CL.sanitize(JSON.parse(r.result), RK.GROUPS); } catch (e) { clean = null; }
        if (clean) { addPatient(clean, 'file'); ok++; } else bad++;
        done();
      };
      r.onerror = function () { bad++; done(); };
      r.readAsText(f);
    });
  }
  function toggleDemo() {
    if (hasDemo()) Object.keys(store.patients).forEach(function (k) { if (store.patients[k].source === 'demo') delete store.patients[k]; });
    else NB.demoCohort.build(Date.now()).forEach(function (d) {
      var clean = CL.sanitize({ app: 'NeuroBaseline', exportedAt: new Date().toISOString(), data: d }, RK.GROUPS);
      if (clean && !(store.patients[clean.data.code] && store.patients[clean.data.code].source === 'file')) addPatient(clean, 'demo');
    });
    save(); ui.msg = ''; render();
  }

  // ---------- events ----------
  var ACT = {
    filter: function (el) { ui.filter = el.dataset.v; render(); var selected = document.querySelector('.stat.selected'); if (selected) selected.focus(); },
    section: function (el) { var target = $(el.dataset.v); if (target) { var heading = target.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); } },
    open: function (el) { location.hash = encodeURIComponent(el.dataset.v); },
    back: function () { location.hash = ''; },
    print: function () { window.print(); },
    import: function () { $('file').click(); },
    demo: toggleDemo,
    lang: function (el) { I.set(el.dataset.v); set(LANG, I.lang); render(); },
    saveReview: function () {
      var p = current(); if (!p) return;
      var dec = $('rvDecision').value;
      p.review = { reviewed: $('rvDone').checked, at: new Date().toISOString(), decision: CL.DECISIONS.indexOf(dec) >= 0 ? dec : 'none', note: String($('rvNote').value || '').slice(0, 2000) };
      save(); render(); NB.access.announce(t('ui.c.saved'));
    },
    remove: function () { var p = current(); if (p && window.confirm(t('c.remove.q'))) { delete store.patients[p.code]; save(); location.hash = ''; render(); } }
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null; if (!el) return;
    if (el.dataset.act === 'section' || (el.dataset.act === 'open' && el.tagName === 'A')) e.preventDefault();
    var f = ACT[el.dataset.act]; if (f) f(el);
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'participantSearch') { ui.query = e.target.value; filterList(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('row')) ACT.open(e.target); });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'file') { importFiles(el.files); el.value = ''; }
    else if (el.dataset && el.dataset.ck) { var p = current(); if (!p) return; p.checklist = p.checklist || {}; p.checklist[el.dataset.ck] = el.checked; save(); }
  });
  window.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });

  I.set(get(LANG) || get(C.keys.lang) || 'en');
  NB.clinView = { render: render, store: store };
  render();
})();
