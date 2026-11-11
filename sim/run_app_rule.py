"""NeuroBaseline – the rule exactly as built into the app, checked in the simulation. SIMULATED DATA.

Compares the app's earlier rule (red on any repeated change beyond z = 1.96) with the rule it uses now
(yellow beyond z = 1.96; red beyond z = 3.0 on two sessions in a row, two indicators at once, or trend >= 3.5).
Neither uses population norms or a practice correction, because the app has neither yet.

Usage:  python run_app_rule.py <results_dir>
"""
import concurrent.futures as cf
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

import model as M
import simulate as S

P = S.Params()
RULES = {
    'Earlier rule: single sessions only, red beyond z = 1.96': dict(z_yellow=1.96, z_red=1.96, h_yellow=99.0, h_red=99.0),
    'Current rule: red beyond z = 3.0, plus trend test (3.0 / 3.5)': dict(z_yellow=1.96, z_red=3.0, h_yellow=3.0, h_red=3.5),
}
KEYS = ['false_referral', 'slow_detected_12m', 'slow_detected_18m', 'slow_detected_24m', 'step_detected_3m', 'step_detected_6m', 'false_referral_low', 'false_referral_mid', 'false_referral_high']


def job(seed):
    rng = np.random.default_rng(1000 + seed)
    ref = S.make_cohort(P, 2000, rng, reference=True)
    pm = M.fit(S.reference_scores(ref, P), ref['age'], ref['edu'])
    c = S.make_cohort(P, 10000, rng)
    out = {}
    for name, kw in RULES.items():
        first, post, _ = S.run_app_rule(c, P, pm, **kw)
        r = S.metrics(c, P, first, post)
        out[name] = [r[k] for k in KEYS]
    return out


def main():
    out_dir = sys.argv[1]
    with cf.ProcessPoolExecutor(max_workers=4) as ex:
        runs = list(ex.map(job, range(8)))
    L = ['# The rule built into the app, in the simulation', '', 'Main scenario, 8 cohorts of 10000 people, 36 months. SIMULATED DATA. Means; ± is the SD across cohorts.', '',
         '| Rule | Stable people referred in 36 months | Slow decline found within 12 months | 18 months | 24 months | Sudden drop within 3 months | 6 months | False referrals: low education | middle | high |',
         '|---|---|---|---|---|---|---|---|---|---|']
    for name in RULES:
        a = np.array([r[name] for r in runs]) * 100
        m, sd = a.mean(axis=0), a.std(axis=0, ddof=1)
        L.append(f'| {name} | {m[0]:.1f} % ± {sd[0]:.1f} | {m[1]:.0f} % | {m[2]:.0f} % | {m[3]:.0f} % ± {sd[3]:.1f} | {m[4]:.0f} % | {m[5]:.0f} % | {m[6]:.1f} % | {m[7]:.1f} % | {m[8]:.1f} % |')
    with open(os.path.join(out_dir, 'app_rule.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
