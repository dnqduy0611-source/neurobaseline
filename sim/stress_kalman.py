"""NeuroBaseline – stress test for the trend test and the Kalman filter: noise that lasts for weeks.

Thresholds are set on a cohort whose session noise is independent (as a real threshold would be set in advance),
then applied to the same people with autocorrelated monthly noise: AR(1), correlation rho between consecutive
monthly sessions (spells of poor sleep, illness or low mood). SIMULATED DATA.

Usage:  python stress_kalman.py <results_dir>     writes <results_dir>/kalman_stress.md
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

import kalman as KF
import run_kalman as RK
import simulate as S

RHOS, SEEDS, Q = (0.0, 0.3, 0.5), 4, 0.004
LABEL = {'trend': 'Trend test', 'kalman': 'Kalman filter', 'both': 'Either (each at its own 5 % threshold)'}


def ar_noise(noise, rho):
    out = noise.copy()
    for s in range(4, noise.shape[1], 2):                  # monthly sessions sit on even half-month steps
        out[:, s] = rho * out[:, s - 2] + np.sqrt(1 - rho ** 2) * noise[:, s]
    return out


def main():
    out_dir = sys.argv[1]
    L = ['# Stress test: noise that lasts for weeks', '', 'SIMULATED DATA, main scenario, '
         f'{SEEDS} cohorts of {RK.R.N_TEST} people. Thresholds set with independent noise (5 % false referrals), '
         'then applied with AR(1) monthly noise of correlation rho.', '',
         '| rho | Method | False referrals in 36 months | Slow decline found within 24 months |', '|---|---|---|---|']
    for rho in RHOS:
        rows = {m: [] for m in LABEL}
        for seed in range(SEEDS):
            c, p, pm = RK.cohort('base', seed)
            stable = c['kind'] == 0
            g0 = {'trend': S.trend_statistic(c, p, pm), 'kalman': KF.kalman_trend(c, p, pm, Q)}
            thr = {m: float(np.quantile(g[stable].max(axis=1), 0.95)) for m, g in g0.items()}
            c2 = {k: v for k, v in c.items() if isinstance(k, str)}
            c2['noise'] = ar_noise(c['noise'], rho)
            g1 = {'trend': S.trend_statistic(c2, p, pm), 'kalman': KF.kalman_trend(c2, p, pm, Q)}
            g1['both'] = np.maximum(g1['trend'] / thr['trend'], g1['kalman'] / thr['kalman'])
            thr['both'] = 1.0
            for m in LABEL:
                r = S.metrics(c2, p, *S.first_alarm(g1[m], thr[m], c2['onset']))
                rows[m].append((r['false_referral'], r['slow_detected_24m']))
        for m, v in rows.items():
            v = np.array(v)
            L.append(f'| {rho} | {LABEL[m]} | {100 * v[:, 0].mean():.1f} % | {100 * v[:, 1].mean():.0f} % |')
        print('rho', rho, 'done', flush=True)
    with open(os.path.join(out_dir, 'kalman_stress.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
