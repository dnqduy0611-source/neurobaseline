/* NeuroBaseline – Tier 2a: risk context (optional, separately consented).
   Two published frameworks, nothing home-made:
   1. The 14 potentially modifiable risk factors of the 2024 Lancet Commission
      (Livingston et al., Lancet 2024;404:572-628). Shown as a profile: present / managed / absent / not answered.
   2. The LIBRA index, 12 factors with published weights (Deckers et al., Int J Geriatr Psychiatry 2015;30:234-46;
      weights as tabulated in O'Donnell et al., Pilot Feasibility Stud 2015;1:40). Range -5.9 to +12.7.
   Self-report with single questions is a PROXY for the instruments used in those studies (see README, Limitations).
   Pure functions, no DOM. Runs in the browser (NB.risk) and in Node (module.exports). */
(function (root) {
  'use strict';

  // Question groups. Any question may be left blank. 'yn' answers: yes / no / unsure.
  var GROUPS = [
    { id: 'body', items: [
      { id: 'height', type: 'num', min: 120, max: 220 }, { id: 'weight', type: 'num', min: 30, max: 250 },
      { id: 'htn', type: 'yn' }, { id: 'dm', type: 'yn' }, { id: 'chol', type: 'yn' }, { id: 'chd', type: 'yn' }, { id: 'ckd', type: 'yn' } ] },
    { id: 'senses', items: [
      { id: 'hearing', opts: ['no', 'aided', 'yes'] }, { id: 'vision', opts: ['no', 'yes'] }, { id: 'tbi', type: 'yn' } ] },
    { id: 'life', items: [
      { id: 'activity', opts: ['ok', 'low'] }, { id: 'smoke', opts: ['never', 'former', 'current'] },
      { id: 'alcohol', opts: ['none', 'mod', 'high'] }, { id: 'diet', opts: ['yes', 'no'] },
      { id: 'cog', opts: ['high', 'low'] }, { id: 'social', opts: ['weekly', 'monthly', 'rare'] } ] },
    { id: 'mood', items: [
      { id: 'phq1', opts: ['0', '1', '2', '3'], scale: true }, { id: 'phq2', opts: ['0', '1', '2', '3'], scale: true },   // PHQ-2
      { id: 'sleep', opts: ['short', 'ok', 'long'] }, { id: 'snore', type: 'yn' } ] },
    { id: 'family', items: [ { id: 'fam', type: 'yn' } ] }
  ];

  // Lancet 2024 factors, by life stage. 'airpollution' is not asked (it depends on where a person lives).
  var LANCET = [
    ['education', 'early'], ['hearing', 'mid'], ['ldl', 'mid'], ['depression', 'mid'], ['tbi', 'mid'], ['inactivity', 'mid'], ['diabetes', 'mid'],
    ['smoking', 'mid'], ['hypertension', 'mid'], ['obesity', 'mid'], ['alcohol', 'mid'], ['isolation', 'late'], ['airpollution', 'late'], ['vision', 'late']
  ];
  // LIBRA weights (published). Negative = protective.
  var LIBRA = [
    ['alcoholMod', -1.0], ['chd', 1.0], ['inactivity', 1.1], ['ckd', 1.1], ['diabetes', 1.3], ['cholesterol', 1.4],
    ['smoking', 1.5], ['obesity', 1.6], ['hypertension', 1.6], ['diet', -1.7], ['depression', 2.1], ['cogActivity', -3.2]
  ];
  var LIBRA_MIN = -5.9, LIBRA_MAX = 12.7, PHQ2_CUT = 3, BMI_OBESE = 30;

  function has(v) { return v !== undefined && v !== null && v !== ''; }
  function yn(v) { return v === 'yes' ? true : v === 'no' ? false : null; }          // 'unsure' and blank -> unknown
  function st(b) { return b === null ? 'unknown' : (b ? 'present' : 'absent'); }
  function pick(v, map) { return has(v) && map.hasOwnProperty(v) ? map[v] : null; }

  function bmiOf(a) {
    var h = parseFloat(a.height), w = parseFloat(a.weight);
    if (!(h >= 120 && h <= 220 && w >= 30 && w <= 250)) return null;
    return Math.round(w / Math.pow(h / 100, 2) * 10) / 10;
  }
  function phq2Of(a) { return has(a.phq1) && has(a.phq2) ? (+a.phq1) + (+a.phq2) : null; }

  function evaluate(answers, profile) {
    var a = answers || {}, bmi = bmiOf(a), phq = phq2Of(a);
    var obese = bmi === null ? null : bmi >= BMI_OBESE, depr = phq === null ? null : phq >= PHQ2_CUT;
    var inactive = pick(a.activity, { low: true, ok: false }), smoker = pick(a.smoke, { current: true, former: false, never: false });

    var S = {
      education: profile && has(profile.edu) ? st(String(profile.edu) === '1') : 'unknown',      // no secondary education
      hearing: has(a.hearing) ? (a.hearing === 'yes' ? 'present' : a.hearing === 'aided' ? 'managed' : 'absent') : 'unknown',
      ldl: st(yn(a.chol)), depression: st(depr), tbi: st(yn(a.tbi)), inactivity: st(inactive), diabetes: st(yn(a.dm)),
      smoking: st(smoker), hypertension: st(yn(a.htn)), obesity: st(obese),
      alcohol: st(pick(a.alcohol, { high: true, mod: false, none: false })),                      // high = more than 21 UK units a week
      isolation: st(pick(a.social, { rare: true, monthly: true, weekly: false })),               // ASSUMPTION: less than weekly contact
      airpollution: 'notassessed',
      vision: st(pick(a.vision, { yes: true, no: false }))
    };
    var factors = LANCET.map(function (f) { return { id: f[0], stage: f[1], status: S[f[0]] }; });
    function ids(s) { return factors.filter(function (f) { return f.status === s; }).map(function (f) { return f.id; }); }

    var L = {
      alcoholMod: pick(a.alcohol, { mod: true, none: false, high: false }), chd: yn(a.chd), inactivity: inactive, ckd: yn(a.ckd), diabetes: yn(a.dm),
      cholesterol: yn(a.chol), smoking: smoker, obesity: obese, hypertension: yn(a.htn), diet: pick(a.diet, { yes: true, no: false }),
      depression: depr, cogActivity: pick(a.cog, { high: true, low: false })
    };
    var score = 0, answered = 0, items = LIBRA.map(function (x) {
      var on = L[x[0]]; if (on !== null) answered++; if (on) score += x[1];
      return { id: x[0], weight: x[1], on: on };
    });
    return {
      factors: factors, present: ids('present'), managed: ids('managed'), absent: ids('absent'), unknown: ids('unknown'),
      assessed: factors.filter(function (f) { return f.status !== 'unknown' && f.status !== 'notassessed'; }).length,
      bmi: bmi, phq2: phq,
      libra: { score: Math.round(score * 10) / 10, answered: answered, total: LIBRA.length, complete: answered === LIBRA.length, items: items, min: LIBRA_MIN, max: LIBRA_MAX },
      context: { shortSleep: a.sleep === 'short', snore: a.snore === 'yes', family: a.fam === 'yes' }
    };
  }

  var api = { GROUPS: GROUPS, LANCET: LANCET, LIBRA: LIBRA, evaluate: evaluate, bmiOf: bmiOf, phq2Of: phq2Of };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.risk = api; }
})(typeof window !== 'undefined' ? window : globalThis);
