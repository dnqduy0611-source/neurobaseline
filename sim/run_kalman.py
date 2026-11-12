"""NeuroBaseline – does a Kalman filter beat the trend test? And what does an adaptive baseline do?

Step 1 (tune): q_slope of the Kalman filter is chosen on a separate tuning cohort (seed 99), not on the
               cohorts used for the comparison.
Step 2 (compare): the same cohorts as run_simulation.py (same seeds), every method tuned to refer 5 % of
               stable people within 36 months.

Usage:  python run_kalman.py <results_dir>
Writes <results_dir>/kalman.json and <results_dir>/kalman.md. SIMULATED DATA.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

import kalman as KF
import model as M
import run_simulation as R
import simulate as S

Q_GRID = [0.002, 0.004, 0.007, 0.01, 0.015, 0.02, 0.03]      # SD of the monthly change in slope (between-person SD units)
Q_LEVEL = [0.1, 0.25, 0.5]                                     # level noise of the adaptive baseline, x within-person SD
TUNE_SEED = 99
KEYS = ['false_referral', 'slow_detected_12m', 'slow_detected_18m', 'slow_detected_24m', 'slow_median_delay',
        'step_detected_3m', 'step_detected_6m', 'false_referral_low', 'false_referral_high',
        'slow_detected_24m_low', 'slow_detected_24m_high', 'threshold']


def cohort(name, seed):
    _, test_p, ref_p = R.SCENARIOS[name]
    rng = np.random.default_rng(1000 + seed)
    ref = S.make_cohort(ref_p, R.N_REF, rng, reference=True)
    pm = M.fit(S.reference_scores(ref, ref_p), ref['age'], ref['edu'])
    return S.make_cohort(test_p, R.N_TEST, rng), test_p, pm


def tune():
    c, p, pm = cohort('base', TUNE_SEED)
    data = KF.monthly_data(c, p, pm)
    rows = {q: KF.evaluate(c, p, KF.kalman_trend(c, p, pm, q, data)) for q in Q_GRID}
    best = max(rows, key=lambda q: rows[q]['slow_detected_24m'])
    return best, {str(q): {k: rows[q][k] for k in ('slow_detected_24m', 'step_detected_6m', 'threshold')} for q in rows}


def job(args):
    name, seed, q = args
    c, p, pm = cohort(name, seed)
    data = KF.monthly_data(c, p, pm)
    g = {'trend': S.trend_statistic(c, p, pm), 'kalman': KF.kalman_trend(c, p, pm, q, data)}
    g['both'] = KF.combine(c, g['trend'], g['kalman'])
    if name == 'base':
        g['anchor'] = KF.single_session(c, p, pm, None, data)
        g['adapt_q0'] = KF.single_session(c, p, pm, 0.0, data)
        for x in Q_LEVEL:
            g[f'adapt_q{x}'] = KF.single_session(c, p, pm, x, data)
    return name, seed, {m: {k: v for k, v in KF.evaluate(c, p, gm).items() if k in KEYS} for m, gm in g.items()}


LABEL = {'trend': 'Trend test (current)', 'kalman': 'Kalman filter, local linear trend', 'both': 'Trend test or Kalman filter', 'anchor': 'Fixed burst baseline',
         'adapt_q0': 'Adaptive: running mean of all sessions', **{f'adapt_q{x}': f'Adaptive: forgets, level noise {x} x SD' for x in Q_LEVEL}}


def pct(d, k):
    return f"{100 * d[k]['mean']:.0f} %"


def write_md(res, out_dir):
    L = ['# Kalman filter and adaptive baselines vs the trend test', '', 'SIMULATED DATA. Every method is tuned so that 5 % of stable people are referred within 36 months.', '',
         f"Kalman slope noise chosen on a separate tuning cohort (seed {TUNE_SEED}): q = {res['q_slope']}.", '',
         '## Tuning cohort', '', '| q (slope change per month, SD) | Slow decline found within 24 months | Sudden drop within 6 months |', '|---|---|---|']
    for q, d in res['tuning'].items():
        L.append(f"| {q} | {100 * d['slow_detected_24m']:.0f} % | {100 * d['step_detected_6m']:.0f} % |")
    for name, sc in res['scenarios'].items():
        L += ['', f"## {R.SCENARIOS[name][0]} ({sc['seeds']} cohorts of {R.N_TEST} people)", '',
              '| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |',
              '|---|---|---|---|---|---|---|---|---|']
        for m, d in sc['methods'].items():
            dl = d['slow_median_delay']['mean']
            L.append(f"| {LABEL[m]} | {100 * d['false_referral']['mean']:.1f} % | {pct(d, 'slow_detected_12m')} | {pct(d, 'slow_detected_18m')} | "
                     f"{pct(d, 'slow_detected_24m')} ± {100 * d['slow_detected_24m']['sd']:.1f} | {'more than 24' if not np.isfinite(dl) or dl > 24 else f'{dl:.1f}'} | "
                     f"{pct(d, 'step_detected_3m')} | {pct(d, 'step_detected_6m')} | {pct(d, 'slow_detected_24m_low')} / {pct(d, 'slow_detected_24m_high')} |")
        L.append('')
        for m, d in sc['diff'].items():
            L.append(f"{LABEL[m]} minus trend test, slow decline within 24 months, paired over cohorts: {100 * d['mean']:+.1f} points (SD {100 * d['sd']:.1f}, range {100 * d['min']:+.1f} to {100 * d['max']:+.1f}).  ")
    with open(os.path.join(out_dir, 'kalman.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')


def main():
    import concurrent.futures as cf
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    q, tuning = tune()
    print('tuned q_slope =', q, flush=True)
    jobs = [(name, seed, q) for name in R.SCENARIOS for seed in range(R.SEEDS.get(name, R.DEFAULT_SEEDS))]
    runs = {name: {} for name in R.SCENARIOS}
    with cf.ProcessPoolExecutor(max_workers=max(1, min(6, (os.cpu_count() or 2) - 1))) as ex:
        for name, seed, out in ex.map(job, jobs):
            runs[name][seed] = out
            print(name, 'cohort', seed + 1, flush=True)
    res = {'q_slope': q, 'tuning': tuning, 'scenarios': {}}
    for name in R.SCENARIOS:
        rs = [runs[name][k] for k in sorted(runs[name])]
        methods = {m: {k: {'mean': float(np.mean([r[m][k] for r in rs])), 'sd': float(np.std([r[m][k] for r in rs], ddof=1))} for k in KEYS} for m in rs[0]}
        res['scenarios'][name] = {'seeds': len(rs), 'methods': methods, 'diff': {}}
        for m in ('kalman', 'both'):
            diff = np.array([r[m]['slow_detected_24m'] - r['trend']['slow_detected_24m'] for r in rs])
            res['scenarios'][name]['diff'][m] = {'mean': float(diff.mean()), 'sd': float(diff.std(ddof=1)), 'min': float(diff.min()), 'max': float(diff.max())}
    with open(os.path.join(out_dir, 'kalman.json'), 'w', encoding='utf-8') as fh:
        json.dump(res, fh, indent=1)
    write_md(res, out_dir)
    print('done')


if __name__ == '__main__':
    main()
