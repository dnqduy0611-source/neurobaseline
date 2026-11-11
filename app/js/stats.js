/* NeuroBaseline – statistics: test summaries, personal baseline, Reliable Change Index, status light.
   Pure functions, no DOM. Runs in the browser (NB.stats) and in Node (module.exports) for unit tests. */
(function (root) {
  'use strict';

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function mean(a) { if (!a.length) return null; var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function median(a) {
    if (!a.length) return null;
    var b = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  function variance(a) { // sample variance
    if (a.length < 2) return null;
    var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return s / (a.length - 1);
  }
  function sd(a) { var v = variance(a); return v == null ? null : Math.sqrt(v); }
  function round(x, d) { if (!isNum(x)) return null; var p = Math.pow(10, d || 0); return Math.round(x * p) / p; }

  // ---------- Per-test summaries ----------
  function summarizeRT(trials, cfg) {
    var valid = [], lapses = 0, antic = 0;
    trials.forEach(function (t) {
      if (!isNum(t.rt)) { lapses++; return; }
      if (t.rt < cfg.minValid) { antic++; return; }
      if (t.rt > cfg.maxValid) { lapses++; return; }
      valid.push(t.rt);
    });
    var ok = trials.length > 0 && valid.length / trials.length >= cfg.minValidShare;
    var m = mean(valid), s = sd(valid);
    return {
      n: trials.length, nValid: valid.length, lapses: lapses, anticipatory: antic, usable: ok,
      median: round(median(valid), 1), mean: round(m, 1), sd: round(s, 1),
      cv: (isNum(m) && isNum(s) && m > 0) ? round(s / m, 3) : null
    };
  }
  function summarizeGNG(trials, cfg) {
    var go = trials.filter(function (t) { return !t.nogo; }), nogo = trials.filter(function (t) { return t.nogo; });
    var goRts = go.filter(function (t) { return isNum(t.rt) && t.rt >= cfg.minValid; }).map(function (t) { return t.rt; });
    var fa = nogo.filter(function (t) { return isNum(t.rt); }).length;
    var miss = go.filter(function (t) { return !isNum(t.rt); }).length;
    return {
      nGo: go.length, nNogo: nogo.length, commissions: fa, omissions: miss,
      commissionPct: nogo.length ? round(100 * fa / nogo.length, 1) : null,
      omissionPct: go.length ? round(100 * miss / go.length, 1) : null,
      goRtMedian: round(median(goRts), 1), usable: nogo.length > 0 && go.length > 0 && miss / go.length <= 0.5
    };
  }
  function summarizeSDMT(resps, cfg) {
    var correct = resps.filter(function (r) { return r.ok; }).length;
    return {
      attempted: resps.length, correct: correct, errors: resps.length - correct,
      medianRt: round(median(resps.map(function (r) { return r.rt; })), 1),
      usable: resps.length >= cfg.minAttempted
    };
  }
  function summarizeMem(resps) {
    var old = resps.filter(function (r) { return r.old; }), nw = resps.filter(function (r) { return !r.old; });
    var hits = old.filter(function (r) { return r.ans === 'old'; }).length;
    var fa = nw.filter(function (r) { return r.ans === 'old'; }).length;
    return {
      nOld: old.length, nNew: nw.length, hits: hits, falseAlarms: fa, score: hits - fa,
      medianRt: round(median(resps.map(function (r) { return r.rt; })), 1), usable: resps.length > 0
    };
  }
  // One number per indicator for a session (null when the test is missing or unusable).
  function measuresOf(session) {
    var m = { rt: null, sdmt: null, mem: null, gng: null, gngGoRt: null, rtCv: null };
    if (session.rt && session.rt.summary.usable) { m.rt = session.rt.summary.median; m.rtCv = session.rt.summary.cv; }
    if (session.sdmt && session.sdmt.summary.usable) m.sdmt = session.sdmt.summary.correct;
    if (session.mem && session.mem.summary.usable) m.mem = session.mem.summary.score;
    if (session.gng && session.gng.summary.usable) { m.gng = session.gng.summary.commissionPct; m.gngGoRt = session.gng.summary.goRtMedian; }
    return m;
  }

  // ---------- Within-person SD: prior blended with the person's own data ----------
  // sigma^2 = (nu0 * prior^2 + (n-1) * s^2) / (nu0 + n - 1)
  // With few sessions the population prior dominates; with many, the person's own variability does.
  function pooledSigma(prior, nu0, values) {
    var v = variance(values);
    if (v == null) return prior;
    var n = values.length;
    return Math.sqrt((nu0 * prior * prior + (n - 1) * v) / (nu0 + n - 1));
  }

  // ---------- Trend test over the whole history ----------
  // For a candidate starting time tau, each primary indicator is modelled as  level + slope * max(0, t - tau).
  // Level and slope are estimated together from every session, so an error in the baseline is not read as a decline.
  //   t_k = worse * (Sry - Sr*Sy/W) / (sigma * sqrt(Srr - Sr^2/W)),   r = max(0, t - tau), sums over sessions
  // The statistic is the sum of t_k over the indicators / sqrt(number of indicators), maximised over tau.
  // hist: [{t: months, v: {id: value}}], oldest first.  bands: per indicator {mean, sigma}.
  function trendStat(hist, inds, bands, cfg) {
    var best = null, minAfter = cfg.trend.minAfter, clip = cfg.trend.clip;
    var taus = hist.map(function (h) { return h.t; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    taus.forEach(function (tau) {
      var sum = 0, used = 0, parts = {};
      inds.forEach(function (ind) {
        var b = bands[ind.id]; if (!ind.primary || !b) return;
        var W = 0, Sr = 0, Srr = 0, Sy = 0, Sry = 0, after = 0;
        hist.forEach(function (h) {
          var v = h.v[ind.id]; if (!isNum(v)) return;
          v = Math.max(b.mean - clip * b.sigma, Math.min(b.mean + clip * b.sigma, v));   // one wild session cannot dominate
          var r = Math.max(0, h.t - tau);
          W++; Sr += r; Srr += r * r; Sy += v; Sry += r * v; if (r > 0) after++;
        });
        var den = W ? Srr - Sr * Sr / W : 0;
        if (after < minAfter || den <= 1e-9) return;
        parts[ind.id] = ind.worse * (Sry - Sr * Sy / W) / (b.sigma * Math.sqrt(den));
        sum += parts[ind.id]; used++;
      });
      if (!used) return;
      var stat = sum / Math.sqrt(used);
      if (!best || stat > best.stat) best = { stat: stat, tau: tau, parts: parts, used: used };
    });
    return best;
  }

  // ---------- Evaluate a whole history ----------
  // Roles: familiarization (1st standard session) -> baseline (next n unflagged) -> followup.
  // A session may carry an epoch number (0 if absent). The highest epoch is the current baseline period: it starts when the person
  // moves to another device. Sessions of earlier epochs get the role 'previous' and take no part in the comparison.
  // RCI = worse * (x - baselineMean) / S_diff,  S_diff = sigma_w * sqrt(1 + 1/n).
  // Light for a follow-up session (z = cfg.rci.z, zRed = cfg.rci.zRed, trend limits in cfg.trend):
  //   red    : the same primary indicator beyond zRed on two sessions in a row, or two primary indicators beyond zRed
  //            at once (not in a context-flagged session), or the trend statistic >= trend.red
  //   yellow : otherwise, any primary indicator beyond z, or the trend statistic >= trend.yellow  -> repeat in 2 weeks
  //   green  : otherwise
  // Thresholds were chosen in the simulation study (sim/REPORT.md) for about 5 % false referrals over three years.
  function evaluate(sessionsIn, cfg, nowMs, epochIn) {
    var inds = cfg.indicators, z = cfg.rci.z, zRed = cfg.rci.zRed, N = cfg.baseline.n, DAY = 864e5, MONTH = 30.4375 * DAY;
    var ss = (sessionsIn || []).filter(function (s) { return s && s.completed; }).slice()
      .sort(function (a, b) { return Date.parse(a.startedAt) - Date.parse(b.startedAt); });

    var ep = 0; ss.forEach(function (s) { if (s.epoch > ep) ep = s.epoch; });
    if (isNum(epochIn) && epochIn > ep) ep = epochIn;       // a new period was opened and has no session yet
    var out = [], base = [], fam = ep > 0;                   // no warm-up session after a change of device
    ss.forEach(function (s) {
      var a = { s: s, role: null, ind: {}, light: null, reasons: [], exceed: [] };
      if ((s.epoch || 0) < ep) a.role = 'previous';
      else if (s.condition !== 'standard') a.role = 'control';
      else if (!fam) { a.role = 'familiarization'; fam = true; }
      else if (base.length < N) { if (s.flagged) a.role = 'excluded'; else { a.role = 'baseline'; base.push(s); } }
      else a.role = 'followup';
      out.push(a);
    });
    var ready = base.length >= N;

    var bmean = {}, stable = {};
    inds.forEach(function (ind) {
      var vals = base.map(function (s) { return s.measures[ind.id]; }).filter(isNum);
      stable[ind.id] = vals.slice();
      bmean[ind.id] = vals.length ? { n: vals.length, mean: mean(vals) } : null;
    });
    function band(ind) {
      var b = bmean[ind.id]; if (!b || b.n < 2) return null;
      var sig = pooledSigma(ind.sigmaW, cfg.rci.nu0, stable[ind.id]);
      var sdiff = sig * Math.sqrt(1 + 1 / b.n);
      return { mean: b.mean, n: b.n, sigma: sig, sDiff: sdiff, lo: b.mean - z * sdiff, hi: b.mean + z * sdiff,
               limit: ind.worse > 0 ? b.mean + z * sdiff : b.mean - z * sdiff };
    }
    var t0 = base.length ? Date.parse(base[0].startedAt) : 0;
    function months(s) { return (Date.parse(s.startedAt) - t0) / MONTH; }
    var hist = base.map(function (s) { return { t: months(s), v: s.measures }; });     // sessions the trend test may use

    var prevRed = [];
    out.forEach(function (a) {
      if (a.role !== 'followup' && a.role !== 'control') return;
      var beyondRed = [], cur = {};
      inds.forEach(function (ind) {
        var v = a.s.measures[ind.id], b = band(ind);
        cur[ind.id] = b;
        if (!isNum(v) || !b) return;
        var rci = ind.worse * (v - b.mean) / b.sDiff;
        a.ind[ind.id] = { value: v, rci: rci, exceeds: rci > z, exceedsRed: rci > zRed, better: rci < -z, band: b };
        if (rci > z && ind.primary) a.exceed.push(ind.id);
        if (rci > zRed && ind.primary) beyondRed.push(ind.id);
      });
      if (a.role === 'control') {
        a.detected = Object.keys(a.ind).some(function (k) { return a.ind[k].exceeds; });
        return;
      }
      if (!a.s.flagged) hist.push({ t: months(a.s), v: a.s.measures });               // an unusual day is left out of the trend
      var tr = trendStat(hist, inds, cur, cfg);
      if (tr) a.trend = { stat: tr.stat, sinceMs: t0 + tr.tau * MONTH, months: Math.max(1, Math.round(months(a.s) - tr.tau)), parts: tr.parts };
      var persisted = beyondRed.filter(function (id) { return prevRed.indexOf(id) >= 0; });
      var multi = beyondRed.length >= 2, trendRed = !!tr && tr.stat >= cfg.trend.red, trendYellow = !!tr && tr.stat >= cfg.trend.yellow;
      if (persisted.length || (multi && !a.s.flagged) || trendRed) {
        a.light = 'red';
        if (persisted.length) a.reasons.push('confirmed');
        if (multi && !a.s.flagged) a.reasons.push('multi');
        if (trendRed) a.reasons.push('trend');
      } else if (a.exceed.length || trendYellow) {
        a.light = 'yellow';
        if (multi) a.reasons.push('multi'); else if (a.exceed.length) a.reasons.push('first');
        if (trendYellow) a.reasons.push('trendWatch');
      } else a.light = 'green';
      if (a.s.flagged && a.light !== 'green') a.reasons.push('context');
      prevRed = beyondRed;
      if (a.light === 'green' && !a.s.flagged) {
        inds.forEach(function (ind) { var v = a.s.measures[ind.id]; if (isNum(v)) stable[ind.id].push(v); });
      }
    });

    var bands = {}; inds.forEach(function (ind) { bands[ind.id] = band(ind); });
    var std = out.filter(function (a) { return a.role !== 'control' && a.role !== 'previous'; });
    var fus = out.filter(function (a) { return a.role === 'followup'; });
    var lastStd = std[std.length - 1], lastFu = fus[fus.length - 1];
    var phase = !std.length ? 'new' : (!ready ? 'building' : 'monitoring');
    var sch = cfg.schedule, nextDue;
    if (!lastStd) nextDue = nowMs;
    else if (phase === 'building') nextDue = Date.parse(lastStd.s.startedAt) + sch.burstGapDays * DAY;
    else if (lastFu && lastFu.light === 'yellow') nextDue = Date.parse(lastFu.s.startedAt) + sch.retestDays * DAY;
    else nextDue = Date.parse(lastStd.s.startedAt) + sch.monthlyDays * DAY;

    return {
      sessions: out, bands: bands, phase: phase, ready: ready,
      done: ep ? base.length : (fam ? 1 : 0) + base.length, total: ep ? N : 1 + N, epoch: ep, rebased: ep > 0,
      light: phase === 'monitoring' && lastFu ? lastFu.light : null, last: lastFu || null,
      lastStdAt: lastStd ? Date.parse(lastStd.s.startedAt) : null, nextDue: nextDue
    };
  }

  // ---------- Device ----------
  // Reaction times depend on the screen and the touch hardware, so a personal baseline belongs to one device.
  // The key leaves out the browser version and the orientation. Two devices with the same system and screen size share a key.
  function deviceKey(dev) {
    if (!dev || typeof dev !== 'object') return null;
    var ua = String(dev.ua || ''), w = Math.round(+dev.w || 0), h = Math.round(+dev.h || 0);
    if (!w || !h) return null;
    var fam = /iPhone|iPod/.test(ua) ? 'iphone' : /iPad/.test(ua) ? 'ipad' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' :
      /Macintosh|Mac OS X/.test(ua) ? 'mac' : /Linux|CrOS/.test(ua) ? 'linux' : 'other';
    return fam + '/' + Math.min(w, h) + 'x' + Math.max(w, h) + '/' + (dev.touch > 0 ? 'touch' : 'pointer');
  }
  // changed: this device differs from every device used so far in the current baseline period (and from those the person confirmed).
  function deviceCheck(sessions, epoch, accepted, dev) {
    var key = deviceKey(dev), known = {};
    (accepted || []).forEach(function (k) { if (typeof k === 'string') known[k] = true; });
    (sessions || []).forEach(function (s) {
      if (!s || !s.completed || s.condition !== 'standard' || (s.epoch || 0) !== (epoch || 0)) return;
      var k = deviceKey(s.device); if (k) known[k] = true;
    });
    var list = Object.keys(known);
    return { key: key, known: list, changed: !!key && list.length > 0 && !known[key] };
  }

  // Deterministic random numbers (alternate test forms per session, simulated demo data).
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    var a = arr.slice(), r = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  var api = {
    isNum: isNum, mean: mean, median: median, variance: variance, sd: sd, round: round,
    summarizeRT: summarizeRT, summarizeGNG: summarizeGNG, summarizeSDMT: summarizeSDMT, summarizeMem: summarizeMem,
    measuresOf: measuresOf, pooledSigma: pooledSigma, trendStat: trendStat, evaluate: evaluate, deviceKey: deviceKey, deviceCheck: deviceCheck,
    mulberry32: mulberry32, shuffle: shuffle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.stats = api; }
})(typeof window !== 'undefined' ? window : globalThis);
