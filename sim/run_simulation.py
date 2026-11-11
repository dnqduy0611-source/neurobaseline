"""NeuroBaseline – simulation study: which way of raising a referral finds decline earlier and more fairly?

Every method is tuned to the same false-referral rate (5 % of stable people referred during the follow-up),
so differences in detection are not an artefact of one method simply being more trigger-happy.

Usage:  python run_simulation.py <results_dir>
"""
import dataclasses
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

import model as M
import simulate as S

N_REF, N_TEST, TARGET = 2000, 10000, 0.05
BASE = S.Params()


def tup(t, f):
    return tuple(f * v for v in t)


def same(**kw):
    p = dataclasses.replace(BASE, **kw)
    return p, p


# name: (label, parameters of the people being followed, parameters of the reference sample the model learns from)
SCENARIOS = {
    'base': ('Main scenario', BASE, BASE),
    'slower': ('Slower decline (0.25 SD per year)', dataclasses.replace(BASE, slow_rate=0.25), BASE),
    'faster': ('Faster decline (1.0 SD per year)', dataclasses.replace(BASE, slow_rate=1.0), BASE),
    'noisier': ('Less reliable tests (0.55 / 0.70 / 0.45)', *same(reliability=(0.55, 0.70, 0.45))),
    'bad_days': ('More bad days (20 % of sessions)', *same(p_bad=0.20)),
    'no_practice': ('No practice effect', *same(practice_gain=(0.0, 0.0, 0.0))),
    'other_population': ('Norms learned in another population',
                         dataclasses.replace(BASE, pop_shift=-0.6, edu_effect=tup(BASE.edu_effect, 1.5), practice_gain=tup(BASE.practice_gain, 0.7)), BASE),
}
SEEDS = {'base': 8}
DEFAULT_SEEDS = 4
EDU = ('low', 'mid', 'high')
KEYS = ['false_referral', 'slow_detected_12m', 'slow_detected_18m', 'slow_detected_24m', 'step_detected_3m', 'step_detected_6m', 'slow_median_delay'] + \
       ['false_referral_' + e for e in EDU] + ['slow_detected_24m_' + e for e in EDU]


def one_run(test_p, ref_p, seed):
    rng = np.random.default_rng(1000 + seed)
    ref = S.make_cohort(ref_p, N_REF, rng, reference=True)
    pm = M.fit(S.reference_scores(ref, ref_p), ref['age'], ref['edu'])
    c = S.make_cohort(test_p, N_TEST, rng)
    out = {}
    for method in S.METHODS:
        thr = S.calibrate(c, test_p, pm, method, TARGET)
        out[method] = {'matched': {**S.metrics(c, test_p, *S.run_method(c, test_p, pm, method, thr)), 'threshold': thr},
                       'default': {**S.metrics(c, test_p, *S.run_method(c, test_p, pm, method, S.DEFAULT_THRESHOLD[method])), 'threshold': S.DEFAULT_THRESHOLD[method]}}
    return out, pm, c


def aggregate(runs):
    agg = {}
    for method in S.METHODS:
        agg[method] = {}
        for mode in ('matched', 'default'):
            d = {k: [r[method][mode][k] for r in runs] for k in KEYS + ['threshold']}
            agg[method][mode] = {k: {'mean': float(np.mean(v)), 'sd': float(np.std(v, ddof=1)) if len(v) > 1 else 0.0} for k, v in d.items()}
            agg[method][mode]['slow_detection_curve'] = np.mean([r[method][mode]['slow_detection_curve'] for r in runs], axis=0).tolist()
    return agg


def tradeoff_curves(c, p, pm, n_points=16):
    """Slow decline found within 24 months against false referrals, as each method's threshold is varied."""
    out = {}
    for method in S.METHODS:
        lo, hi = S.THRESHOLD_RANGE[method]
        grid = np.linspace(1.0, 6.0, n_points) if method == 'trend' else np.geomspace(lo, hi, n_points)
        pts = []
        for thr in grid:
            r = S.metrics(c, p, *S.run_method(c, p, pm, method, thr))
            pts.append([float(thr), r['false_referral'], r['slow_detected_24m']])
        out[method] = pts
    return out


def example_person(c, p, pm, thr_trend):
    """Monthly trace of one slow decliner, for the explanatory figure."""
    i = int(np.where((c['kind'] == 1) & (c['edu'] == 2) & (c['onset'] < 6))[0][0])
    sub = {k: v[i:i + 1] for k, v in c.items() if isinstance(v, np.ndarray)}
    vals = S.burst(sub, p) - pm.gamma[:5][None]
    base = pm.baseline(vals.mean(axis=1), 5, sub['age'], sub['edu'])[0]
    sd = (M.blended_sigma(pm.sigma_w, S.NU0, np.array([5]), vals.sum(axis=1), (vals ** 2).sum(axis=1)) * pm.pred_sd_factor(5))[0]
    k, n_sess, months, ys = 1, 5, [], []                               # symbol matching
    for mth in range(1, p.months + 1):
        s = 2 * mth
        if sub['missing'][0, s]:
            continue
        y = (S.score(sub, p, np.array([n_sess + 1]), float(mth), sub['noise'][:, s], sub['bad'][:, s]) - pm.practice(np.array([n_sess + 1])))[0, k]
        n_sess += 1
        months.append(mth); ys.append(float(y))
    g = S.trend_statistic(sub, p, pm)[0]
    return {'indicator': S.INDICATORS[k], 'onset': float(sub['onset'][0]), 'baseline': float(base[k]), 'sd': float(sd[k]), 'burst': vals[0, :, k].tolist(),
            'months': months, 'scores': ys, 'trend_months': list(range(1, p.months + 1)), 'trend': [None if not np.isfinite(v) else float(v) for v in g],
            'trend_threshold': float(thr_trend), 'fixed_cutoff': float(pm.norm_mean[k] - 1.5 * pm.norm_sd[k])}


def pct(d, k, digits=0):
    return f"{100 * d[k]['mean']:.{digits}f} %"


def tables(res, out_dir):
    months = res['config']['base_params']['months']
    L = ['# Simulation tables', '', 'All values are means over independent simulated cohorts. SIMULATED DATA.', '']
    for mode, title in (('matched', f'every method tuned to refer 5 % of stable people within {months} months'), ('default', 'each method at a customary threshold (cut-off 1.5 SD, z = 1.96, CUSUM h = 4, trend test 3.0)')):
        for name, sc in res['scenarios'].items():
            if mode == 'default' and name != 'base':
                continue
            L += [f"## {sc['label']} — {title}", '', f"{sc['seeds']} cohorts of {N_TEST} people.", '',
                  f'| Method | False referrals in {months} months | Slow decline found within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop found within 3 months | 6 months |', '|---|---|---|---|---|---|---|---|']
            for m in S.METHODS:
                d = sc['methods'][m][mode]
                delay = d['slow_median_delay']['mean']
                L.append(f"| {S.METHOD_LABEL[m]} | {pct(d, 'false_referral', 1)} | {pct(d, 'slow_detected_12m')} | {pct(d, 'slow_detected_18m')} | {pct(d, 'slow_detected_24m')} ± {100 * d['slow_detected_24m']['sd']:.1f} | "
                         f"{'more than 24' if not np.isfinite(delay) or delay > 24 else f'{delay:.1f}'} | {pct(d, 'step_detected_3m')} | {pct(d, 'step_detected_6m')} |")
            L += ['', '| Method | False referrals: low education | middle | high | Slow decline found within 24 months: low education | middle | high |', '|---|---|---|---|---|---|---|']
            for m in S.METHODS:
                d = sc['methods'][m][mode]
                L.append(f"| {S.METHOD_LABEL[m]} | " + ' | '.join(pct(d, 'false_referral_' + e, 1) for e in EDU) + ' | ' + ' | '.join(pct(d, 'slow_detected_24m_' + e) for e in EDU) + ' |')
            L.append('')
    f = res['fit']
    L += ['## What the model learned from the reference sample (main scenario, first cohort)', '', '| Quantity | Speed | Symbol matching | Memory |', '|---|---|---|---|']
    for label, key in (('Between-person SD, true', 'true_sigma_b'), ('Between-person SD, learned', 'sigma_b'), ('Within-person SD, true (average person, incl. bad days)', 'true_sigma_w'), ('Within-person SD, learned', 'sigma_w'),
                       ('k = within² / between²', 'k'), ('Weight of own data after 1 session', 'w1'), ('after 5 sessions', 'w5'), ('Age slope per year, true', 'true_age'), ('Age slope per year, learned', 'age'),
                       ('High vs low education, true', 'true_edu'), ('High vs low education, learned', 'edu'), ('Practice: session 1 relative to plateau, learned', 'gamma1')):
        L.append(f"| {label} | " + ' | '.join(f'{v:.2f}' for v in f[key]) + ' |')
    with open(os.path.join(out_dir, 'tables.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')


def job(args):
    """One cohort. Runs in a worker process."""
    name, seed = args
    _, test_p, ref_p = SCENARIOS[name]
    out, pm, c = one_run(test_p, ref_p, seed)
    extra = None
    if name == 'base' and seed == 0:
        true_w = BASE.sigma_w * np.sqrt(np.exp(2 * BASE.noise_sd_log ** 2)) * np.sqrt(1 + BASE.p_bad * (1 - BASE.p_bad) * BASE.bad_shift ** 2)
        extra = {'curves': tradeoff_curves(c, test_p, pm), 'example': example_person(c, test_p, pm, out['trend']['matched']['threshold']),
                 'fit': {'sigma_b': pm.sigma_b.tolist(), 'true_sigma_b': [1.0] * 3, 'sigma_w': pm.sigma_w.tolist(), 'true_sigma_w': true_w.tolist(), 'k': pm.k.tolist(),
                         'w1': pm.weight(1).tolist(), 'w5': pm.weight(5).tolist(), 'age': pm.beta[1].tolist(), 'true_age': [BASE.age_slope] * 3,
                         'edu': pm.beta[3].tolist(), 'true_edu': list(BASE.edu_effect), 'gamma1': pm.gamma[0].tolist(), 'gamma': pm.gamma[:8].tolist()}}
    return name, seed, out, extra


def main():
    import concurrent.futures as cf
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    res = {'config': {'n_reference': N_REF, 'n_test': N_TEST, 'target_false_referral': TARGET, 'nu0': S.NU0, 'kappa': S.KAPPA, 'default_thresholds': S.DEFAULT_THRESHOLD,
                      'base_params': dataclasses.asdict(BASE)}, 'scenarios': {}}
    jobs = [(name, seed) for name in SCENARIOS for seed in range(SEEDS.get(name, DEFAULT_SEEDS))]
    runs = {name: {} for name in SCENARIOS}
    with cf.ProcessPoolExecutor(max_workers=max(1, min(6, (os.cpu_count() or 2) - 1))) as ex:
        for name, seed, out, extra in ex.map(job, jobs):
            runs[name][seed] = out
            if extra:
                res.update(extra)
            print(name, 'cohort', seed + 1, flush=True)
    for name, (label, _, _) in SCENARIOS.items():
        ordered = [runs[name][k] for k in sorted(runs[name])]
        res['scenarios'][name] = {'label': label, 'seeds': len(ordered), 'methods': aggregate(ordered)}
    with open(os.path.join(out_dir, 'summary.json'), 'w', encoding='utf-8') as fh:
        json.dump(res, fh, indent=1)
    tables(res, out_dir)
    print('done')


if __name__ == '__main__':
    main()
