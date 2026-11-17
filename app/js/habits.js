/* NeuroBaseline – daily habits check-in (optional): sleep, physical activity, social contact.
   Self-report with single questions, one entry per calendar day. The answers are shown next to the session
   results and compared with the person's own earlier weeks. They never change the status.
   Pure functions, no DOM. Runs in the browser (NB.habits) and in Node (module.exports). */
(function (root) {
  'use strict';
  var DAY = 864e5;

  var QUESTIONS = [
    { id: 'sleepH', opts: ['lt5', '5', '6', '7', '8plus'] },   // last night; the same answers as the question asked before a session
    { id: 'sleepQ', opts: ['poor', 'ok', 'good'] },
    { id: 'active', opts: ['none', 'some', '30plus'] },        // yesterday: activity that makes a person breathe faster, such as brisk walking
    { id: 'social', opts: ['no', 'yes'] }                      // yesterday: time with, or a conversation with, family, friends or a group
  ];
  // Hours used for an average. ASSUMPTION: 'lt5' counts as 4.5 h and '8plus' as 8 h.
  var HOURS = { lt5: 4.5, '5': 5, '6': 6, '7': 7, '8plus': 8 };
  // sleepH: adults are advised to sleep 7 hours or more (Watson et al., Sleep 2015;38:843-4).
  // activeRate: 30 minutes on five days of seven, about the 150 minutes a week of the WHO 2020 guidelines.
  // minDays: fewer check-ins than this in a week and no summary is given.
  var TARGET = { sleepH: 7, shortH: 6, activeRate: 5 / 7, minDays: 4, usualDays: 7, lessH: 1 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }   // the date on the person's own calendar
  function dayMs(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key)); if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d.getTime() : null;
  }
  function addDays(key, n) { var d = new Date(dayMs(key)); d.setDate(d.getDate() + n); return dayKey(d.getTime()); }

  // A list from storage or from a file is untrusted. Keep known answers only, one entry per day, oldest first.
  function clean(list) {
    if (!Array.isArray(list)) return [];
    var byDay = {};
    list.forEach(function (x) {
      if (!x || typeof x !== 'object' || dayMs(x.day) === null) return;
      var e = { day: String(x.day) }, any = false;
      QUESTIONS.forEach(function (q) { var v = x[q.id] == null ? null : String(x[q.id]); if (q.opts.indexOf(v) >= 0) { e[q.id] = v; any = true; } });
      if (!any) return;
      if (x.simulated) e.simulated = true;
      byDay[e.day] = e;
    });
    return Object.keys(byDay).sort().slice(-800).map(function (k) { return byDay[k]; });
  }
  function upsert(list, entry) { return clean(clean(list).concat([entry])); }
  function find(list, key) { var hit = null; list.forEach(function (x) { if (x.day === key) hit = x; }); return hit; }

  // The `days` calendar days that end on the day of endMs.
  function windowOf(list, endMs, days) {
    var last = dayKey(endMs), first = addDays(last, -(days - 1));
    return list.filter(function (x) { return x.day >= first && x.day <= last; });
  }
  function summarize(list, endMs, days) {
    var w = windowOf(list, endMs, days), s = { days: days, n: w.length, nSleep: 0, sleepH: null, shortNights: 0, poorNights: 0, nActive: 0, activeDays: 0, someDays: 0, nSocial: 0, socialDays: 0 }, sum = 0;
    w.forEach(function (x) {
      if (x.sleepH) { s.nSleep++; sum += HOURS[x.sleepH]; if (HOURS[x.sleepH] < TARGET.shortH) s.shortNights++; }
      if (x.sleepQ === 'poor') s.poorNights++;
      if (x.active) { s.nActive++; if (x.active === '30plus') s.activeDays++; else if (x.active === 'some') s.someDays++; }
      if (x.social) { s.nSocial++; if (x.social === 'yes') s.socialDays++; }
    });
    if (s.nSleep) s.sleepH = Math.round(sum / s.nSleep * 10) / 10;
    return s;
  }

  // Plain statements about one week. Nothing is said until there are enough check-ins.
  function notes(s) {
    if (s.n < TARGET.minDays) return { enough: false, missing: TARGET.minDays - s.n };
    return {
      enough: true,
      sleep: !s.nSleep ? null : s.sleepH < TARGET.shortH ? 'short' : s.sleepH < TARGET.sleepH ? 'below' : 'ok',
      active: !s.nActive ? null : s.activeDays / s.nActive >= TARGET.activeRate ? 'ok' : (s.activeDays + s.someDays) ? 'some' : 'low',
      social: !s.nSocial ? null : s.socialDays ? 'ok' : 'low'
    };
  }

  // The week that ends on the day of endMs, next to the person's own earlier weeks (the 56 days before it).
  function compare(list, endMs) {
    var week = summarize(list, endMs, 7), before = dayMs(addDays(dayKey(endMs), -7)), usual = summarize(list, before, 56);
    var hasUsual = usual.nSleep >= TARGET.usualDays, diff = week.nSleep && hasUsual ? Math.round((week.sleepH - usual.sleepH) * 10) / 10 : null;
    var sleep = null;
    if (week.nSleep >= 3) {
      if (diff !== null && diff <= -TARGET.lessH) sleep = 'less';              // clearly less than this person's usual
      else if (week.sleepH < TARGET.shortH) sleep = 'short';                   // short, with no earlier weeks to compare with
    }
    return { week: week, usual: hasUsual ? usual : null, sleepDiff: diff, sleep: sleep };
  }

  function streak(list, nowMs) { // check-ins on consecutive days, ending today or yesterday
    var key = dayKey(nowMs), n = 0;
    if (!find(list, key)) key = addDays(key, -1);
    while (find(list, key)) { n++; key = addDays(key, -1); }
    return n;
  }

  var api = { QUESTIONS: QUESTIONS, HOURS: HOURS, TARGET: TARGET, DAY: DAY, dayKey: dayKey, dayMs: dayMs, addDays: addDays, clean: clean, upsert: upsert, find: find,
              windowOf: windowOf, summarize: summarize, notes: notes, compare: compare, streak: streak };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.habits = api; }
})(typeof window !== 'undefined' ? window : globalThis);
