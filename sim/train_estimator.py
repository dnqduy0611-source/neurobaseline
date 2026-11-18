"""NeuroBaseline – a small model that estimates whether a flagged change is a lasting one. SIMULATED DATA.

The app's status rule decides the light. This model adds one number for a session that the rule has already
flagged (yellow or red): the probability that the person's ability has really changed, as opposed to a session
that was off for another reason (noise, a bad day). It reads the task results together with what the app knows
about sleep, an unusual day and, when there is one, the resting EEG.

The model is a logistic regression, so every input has one coefficient and its contribution can be shown.
It is trained and tested on the simulated cohort of simulate.py. It has not seen data from real people.

Inputs, all computed the same way in the app (app/js/estimator.js):
  trend  trend statistic of the person's earlier sessions, taken at the session before this one (0 to 8; 0 when there is none)
  zmean  Reliable Change Index of this session, averaged over the three indicators (-2 to 6)
  flag   1 when the person reported an unusual day for this session
  sleep  hours short of 7 in the night before the session, from the answer the app asks for (bands)
  eeg    z of the theta/alpha ratio against the personal EEG baseline; the average when there is no recording

The trend is taken before the session on purpose. The rule leaves a reported unusual day out of the trend, so the
trend at the session itself means something different on such a day; the earlier value means the same on every day.

Each person contributes the flagged sessions up to and including the first red light.
Sleep and EEG are not part of simulate.py. They are added here under the assumptions in `Extra`.

Usage:  python train_estimator.py <results_dir> [<file to write the model to, default ../app/js/estimator-model.js>]
"""
import concurrent.futures as cf
import json
import os
import sys
from dataclasses import dataclass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

import model as M
import simulate as S

FEATURES = ['trend', 'zmean', 'flag', 'sleep', 'eeg']
CLIP = {'trend': (0.0, 8.0), 'zmean': (-2.0, 6.0), 'flag': (0.0, 1.0), 'sleep': (0.0, 2.5), 'eeg': (-3.0, 6.0)}
RULE = dict(z_yellow=1.96, z_red=3.0, h_yellow=3.0, h_red=3.5)          # the limits in app/js/config.js
BANDS = (0.35, 0.65)                                                     # below: more likely temporary; above: more likely lasting
SLEEP_BANDS = [(4.75, 4.5), (5.5, 5.0), (6.5, 6.0), (7.5, 7.0), (np.inf, 8.0)]   # answer bands of the app and the hours they count as
N_PEOPLE, TRAIN_SEEDS, TEST_SEEDS = 10000, range(0, 6), range(6, 10)


@dataclass(frozen=True)
class Extra:
    """ASSUMPTIONS about sleep and EEG. None of these has been measured."""
    sleep_mean: float = 7.0          # a person's usual night, hours
    sleep_person_sd: float = 0.5     # spread of the usual night between people
    sleep_night_sd: float = 0.7      # night-to-night spread
    p_bad_sleep: float = 0.6         # share of bad days that follow a short night
    bad_sleep_mean: float = 5.0      # hours slept in such a night
    p_eeg: float = 0.5               # share of people who use a headband
    eeg_gain: float = 1.0            # shift of the EEG z per between-person SD of true cognitive drop
    eeg_drowsy: float = 0.8          # shift of the EEG z after a short night (drowsiness slows the EEG)


def sigmoid(v):
    return 1.0 / (1.0 + np.exp(-v))


def fit_logistic(x, y, l2=1.0, iters=40):
    """Logistic regression by Newton's method with a small ridge penalty (not on the intercept). Returns (intercept, coefficients)."""
    xb = np.c_[np.ones(len(x)), x]
    w, pen = np.zeros(xb.shape[1]), np.r_[0.0, np.full(x.shape[1], l2)]
    for _ in range(iters):
        p = sigmoid(xb @ w)
        step = np.linalg.solve(xb.T @ (xb * (p * (1 - p))[:, None]) + np.diag(pen), xb.T @ (y - p) - pen * w)
        w += step
        if np.abs(step).max() < 1e-10:
            break
    return float(w[0]), w[1:]


def auc(score, y):
    """Area under the ROC curve (probability that a positive case scores higher than a negative one; ties count half)."""
    order = np.argsort(score, kind='mergesort')
    s, rank = score[order], np.empty(len(score))
    start = np.r_[0, np.flatnonzero(s[1:] != s[:-1]) + 1, len(s)]
    for a, b in zip(start[:-1], start[1:]):
        rank[order[a:b]] = (a + b + 1) / 2.0
    pos = y > 0.5
    n1, n0 = pos.sum(), (~pos).sum()
    return float((rank[pos].sum() - n1 * (n1 + 1) / 2.0) / (n1 * n0))


def sleep_and_eeg(c, p, e, rng):
    """Draw, for every person and half-month step, the sleep deficit the app would record, the EEG z, and the truth."""
    n, steps = len(c['age']), 2 * p.months
    short = c['bad'] & (rng.random((n, steps + 1)) < e.p_bad_sleep)
    usual = rng.normal(e.sleep_mean, e.sleep_person_sd, (n, 1)) + rng.normal(0, e.sleep_night_sd, (n, steps + 1))
    hours = np.where(short, rng.normal(e.bad_sleep_mean, e.sleep_night_sd, (n, steps + 1)), usual)
    counted = np.select([hours < lim for lim, _ in SLEEP_BANDS], [h for _, h in SLEEP_BANDS])
    t = np.arange(steps + 1)[None, :] / 2.0
    since = np.maximum(0.0, t - c['onset'][:, None])
    kind = c['kind'][:, None]
    drop = np.where(kind == 1, p.slow_rate * since / 12, np.where((kind == 2) & (t >= c['onset'][:, None]), p.step_size, 0.0))
    z = e.eeg_gain * drop + e.eeg_drowsy * short + rng.standard_normal((n, steps + 1))
    z[rng.random(n) >= e.p_eeg] = np.nan                                  # no headband
    return np.maximum(0.0, 7.0 - counted), z, drop > 0


def flagged_sessions(p, e, seed, n_people=N_PEOPLE):
    """Follow one simulated cohort with the app's rule.

    Returns, for every flagged session up to a person's first red light: the inputs, the truth (ability really changed),
    and two things to compare the model with: the light (red or not) and the trend statistic the rule itself used.
    """
    rng = np.random.default_rng(4000 + seed)
    ref = S.make_cohort(p, 2000, rng, reference=True)
    pm = M.fit(S.reference_scores(ref, p), ref['age'], ref['edu'])
    c = S.make_cohort(p, n_people, rng)
    deficit, eeg, changed = sleep_and_eeg(c, p, e, rng)
    rows, truth, light, rule_trend = [], [], [], []
    done, earlier = np.zeros(n_people, bool), np.zeros(n_people)         # earlier: the trend statistic at the person's session before

    def on_session(s, due, z, g, flag, red, yellow, confirmed):
        g = np.where(np.isfinite(g), g, 0.0)
        i = np.flatnonzero((red | yellow) & ~done)
        if len(i):
            rows.append(np.c_[earlier[i], z[i].mean(axis=1), flag[i], deficit[i, s], eeg[i, s]])
            truth.append(changed[i, s])
            light.append(red[i])
            rule_trend.append(g[i])
        done[red] = True
        earlier[due] = g[due]

    S.run_app_rule(c, p, pm, on_session=on_session, **RULE)
    x = np.concatenate(rows)
    for k, name in enumerate(FEATURES):
        x[:, k] = np.clip(x[:, k], *CLIP[name])                           # NaN (no EEG) stays NaN
    return x, np.concatenate(truth).astype(float), np.concatenate(light), np.concatenate(rule_trend)


def job(args):
    return flagged_sessions(*args)


def gather(p, e, seeds):
    with cf.ProcessPoolExecutor(max_workers=4) as ex:
        parts = list(ex.map(job, [(p, e, s) for s in seeds]))
    return [np.concatenate([part[k] for part in parts]) for k in range(4)]


def predict(model, x):
    """Probability for rows of inputs; a missing input (NaN) counts as the average, so it contributes nothing."""
    mean, coef = np.array(model['mean']), np.array(model['coef'])
    return sigmoid(model['base'] + (np.where(np.isnan(x), mean, x) - mean) @ coef)


def train(x, y):
    mean = np.nanmean(x, axis=0)
    b0, coef = fit_logistic(np.where(np.isnan(x), mean, x), y)
    mean, coef = np.round(mean, 4), np.round(coef, 4)
    return {'mean': mean.tolist(), 'coef': coef.tolist(), 'base': round(float(b0 + mean @ coef), 4)}   # base: log-odds of an average flagged session


def describe(model, x, y, red, rule_trend):
    p = predict(model, x)
    lo, hi = BANDS
    band = np.where(p < lo, 0, np.where(p > hi, 2, 1))
    out = {'n': int(len(y)), 'rate': float(y.mean()), 'red_share': float(red.mean()), 'auc': auc(p, y), 'brier': float(((p - y) ** 2).mean()),
           'brier_rate': float(((y.mean() - y) ** 2).mean()),               # the Brier score of always answering the overall rate
           'auc_trend': auc(rule_trend, y), 'auc_light': auc(red.astype(float), y), 'auc_yellow': auc(p[~red], y[~red]),
           'bands': [{'share': float((band == b).mean()), 'rate': float(y[band == b].mean()), 'mean_p': float(p[band == b].mean())} for b in range(3)]}
    edges = np.quantile(p, np.linspace(0, 1, 6))
    groups = [(p >= a) & ((p <= b) if k == 4 else (p < b)) for k, (a, b) in enumerate(zip(edges[:-1], edges[1:]))]
    out['calibration'] = [{'mean_p': float(p[m].mean()), 'rate': float(y[m].mean())} for m in groups if m.any()]
    return out


def checks(model):
    """A few inputs with the probability they must give, so the app's copy of the arithmetic can be tested."""
    rows = [[0.4, 0.9, 1, 2.0, np.nan], [0.4, 0.9, 0, 0.0, np.nan], [3.8, 2.6, 0, 0.0, 2.6],
            [2.9, 2.2, 1, 2.0, 2.4], [3.2, 0.3, 0, np.nan, np.nan], [8.0, 6.0, 0, 0.0, 6.0], [0.0, -2.0, 1, 2.5, -3.0]]
    p = predict(model, np.array(rows, float))
    return [{'x': [None if np.isnan(v) else v for v in r], 'p': round(float(q), 6)} for r, q in zip(rows, p)]


def pct(v, d=0):
    return f'{100 * v:.{d}f} %'


def report(model, res, e):
    main, other = res['main'], res['other']
    L = ['# Estimate of a lasting change: a small model on top of the status rule', '',
         'SIMULATED DATA. Logistic regression fitted on flagged sessions (yellow or red, up to each person\'s first red light) of 6 simulated cohorts of 10000 people '
         'and tested on 4 other cohorts. Truth: the person\'s ability has really changed at that session. The model has not seen data from real people.', '',
         f'Flagged sessions: {res["train_n"]} for fitting, {main["n"]} for testing. In the test cohorts {pct(main["rate"])} of flagged sessions were a true change '
         f'and {pct(main["red_share"])} carried a red light.', '',
         '## The model', '',
         '| Input | Coefficient (log-odds per unit) | Odds ratio per unit | Average in flagged sessions |', '|---|---|---|---|']
    for name, c, m in zip(FEATURES, model['coef'], model['mean']):
        L.append(f'| `{name}` | {c:+.3f} | {np.exp(c):.2f} | {m:.2f} |')
    L += ['', f'Log-odds of an average flagged session: {model["base"]:+.3f}. A missing input counts as the average and contributes nothing.', '',
          '## How well it separates, in the simulated test cohorts', '',
          '| | AUC | Brier score |', '|---|---|---|',
          f'| Model, main scenario | {main["auc"]:.3f} | {main["brier"]:.3f} |',
          f'| Always answering the overall rate | 0.500 | {main["brier_rate"]:.3f} |',
          f'| Trend statistic of the rule, alone | {main["auc_trend"]:.3f} | |',
          f'| Light alone (red or yellow) | {main["auc_light"]:.3f} | |',
          f'| Model, yellow sessions only | {main["auc_yellow"]:.3f} | |',
          f'| Model, other assumptions (more bad days, noisier tasks, weaker EEG) | {other["auc"]:.3f} | {other["brier"]:.3f} |', '',
          '## What the three bands mean', '',
          '| Band | Share of flagged sessions | Of these, true change | Mean estimate |', '|---|---|---|---|']
    for name, b in zip([f'More likely temporary (below {BANDS[0]:.2f})', 'Could be either', f'More likely lasting (above {BANDS[1]:.2f})'], main['bands']):
        L.append(f'| {name} | {pct(b["share"])} | {pct(b["rate"])} | {pct(b["mean_p"])} |')
    L += ['', '## Calibration (five groups of equal size)', '', '| Mean estimate | True change |', '|---|---|']
    L += [f'| {pct(c["mean_p"])} | {pct(c["rate"])} |' for c in main['calibration']]
    L += ['', '## Assumptions added for sleep and EEG', '', '| Assumption | Value |', '|---|---|']
    L += [f'| `{k}` | {v} |' for k, v in e.__dict__.items()]
    return '\n'.join(L) + '\n'


def write_js(path, model, res):
    main = res['main']
    data = {'version': 1, 'trainedOn': 'simulated cohort', 'features': FEATURES, 'clip': [list(CLIP[f]) for f in FEATURES],
            'mean': model['mean'], 'coef': model['coef'], 'base': model['base'], 'bands': list(BANDS),
            'test': {'n': main['n'], 'auc': round(main['auc'], 3), 'brier': round(main['brier'], 3), 'rate': round(main['rate'], 3),
                     'bands': [{k: round(v, 3) for k, v in b.items()} for b in main['bands']]},
            'checks': checks(model)}
    body = '{\n' + ',\n'.join('    ' + json.dumps(k) + ': ' + json.dumps(v) for k, v in data.items()) + '\n  }'   # one key per line
    text = ('/* NeuroBaseline - coefficients of the estimate of a lasting change. Written by sim/train_estimator.py; do not edit by hand.\n'
            '   Logistic regression fitted on a SIMULATED cohort. It has not seen data from real people. */\n'
            '(function (root) {\n  \'use strict\';\n  var M = ' + body + ';\n'
            '  if (typeof module !== \'undefined\' && module.exports) module.exports = M;\n'
            '  if (root.NB || typeof window !== \'undefined\') { root.NB = root.NB || {}; root.NB.estimatorModel = M; }\n'
            '})(typeof window !== \'undefined\' ? window : globalThis);\n')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def main():
    out_dir = sys.argv[1]
    js = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'js', 'estimator-model.js')
    p, e = S.Params(), Extra()
    x, y, _, _ = gather(p, e, TRAIN_SEEDS)
    model = train(x, y)
    res = {'train_n': int(len(y)), 'main': describe(model, *gather(p, e, TEST_SEEDS))}
    harder = S.Params(p_bad=0.15, reliability=(0.60, 0.75, 0.50))
    res['other'] = describe(model, *gather(harder, Extra(eeg_gain=0.5, p_bad_sleep=0.4), TEST_SEEDS))
    with open(os.path.join(out_dir, 'estimator.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'model': model, 'features': FEATURES, 'results': res, 'assumptions': e.__dict__}, f, indent=1)
    text = report(model, res, e)
    with open(os.path.join(out_dir, 'estimator.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    write_js(js, model, res)
    print(text)


if __name__ == '__main__':
    main()
