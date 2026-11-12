"""NeuroBaseline – state-space (Kalman filter) methods, compared with the trend test.

Everything here is SIMULATED and uses the cohorts of simulate.py. Same schedule as the trend test:
5 burst sessions at month 0, then one session a month; skipped sessions and reported bad days are left out,
and one wild session is clipped at +/- 3 within-person SD.

Two families, each per indicator and independent across indicators:

1. Local linear trend ("kalman")
       level[t] = level[t-1] + slope[t-1]          (no noise on the level)
       slope[t] = slope[t-1] + N(0, q_slope^2)     (the slope may start to change at any time)
       y[t]     = level[t]   + N(0, sw^2)
   Prior before the burst: level ~ N(population prediction, sb^2), slope ~ N(0, q_slope^2).
   After the 5 burst sessions the level estimate is exactly the hierarchical baseline.
   Alarm statistic: posterior z of the slope, -E[slope] / SD[slope], summed over indicators / sqrt(3).

2. Single-session rules, to show what an adaptive baseline does
       "anchor"      : each session compared with the burst baseline only (never updated)
       "adapt_q{x}"  : local level model, level[t] = level[t-1] + N(0, (x * sw)^2);
                       each session compared with the filter's prediction (the innovation).
                       x = 0 is a running mean of all sessions so far; x > 0 forgets older sessions.
   Statistic: one session's z, summed over indicators / sqrt(3).

All statistics are G[person, month]; an alarm is the first month with G > threshold,
the threshold being set so that 5 % of stable people are referred within the follow-up.
"""
import numpy as np

import model as M
import simulate as S


def monthly_data(c, p, pm):
    """Burst values, burst baseline and SD, and the monthly series (clipped) with an 'observed' mask."""
    n, months = len(c['age']), p.months
    vals = S.burst(c, p) - pm.gamma[:5][None]
    base = pm.baseline(vals.mean(axis=1), 5, c['age'], c['edu'])
    sig = M.blended_sigma(pm.sigma_w, S.NU0, np.full(n, 5), vals.sum(axis=1), (vals ** 2).sum(axis=1))
    y, obs, n_sess = np.zeros((n, months, S.K)), np.zeros((n, months), bool), np.full(n, 5)
    for mth in range(1, months + 1):
        s = 2 * mth
        attended = ~c['missing'][:, s]
        raw = S.score(c, p, n_sess + 1, float(mth), c['noise'][:, s], c['bad'][:, s]) - pm.practice(n_sess + 1)
        y[:, mth - 1] = np.clip(raw, base - 3 * sig, base + 3 * sig)
        obs[:, mth - 1] = attended & ~c['flag'][:, s]
        n_sess[attended] += 1
    return vals, base, sig, y, obs


def _update(ml, ms, p11, p12, p22, yv, r, mask):
    """Kalman update with observation y = level + noise (variance r), only where mask is true."""
    s = p11 + r
    k1, k2 = p11 / s, p12 / s
    innov = yv - ml
    m = mask[:, None]
    return (np.where(m, ml + k1 * innov, ml), np.where(m, ms + k2 * innov, ms),
            np.where(m, p11 - k1 * p11, p11), np.where(m, p12 - k1 * p12, p12), np.where(m, p22 - k2 * p12, p22))


def kalman_trend(c, p, pm, q_slope, data=None):
    """Local linear trend filter. Returns G[person, month] (slope z) and the filtered level and slope of the last month."""
    vals, base, sig, y, obs = data or monthly_data(c, p, pm)
    n, months = len(c['age']), p.months
    r = sig ** 2
    ml = np.broadcast_to(pm.predict(c['age'], c['edu']), (n, S.K)).copy()
    ms = np.zeros((n, S.K))
    p11 = np.broadcast_to(pm.sigma_b ** 2, (n, S.K)).copy()
    p12 = np.zeros((n, S.K))
    p22 = np.full((n, S.K), q_slope ** 2)
    allm = np.ones(n, bool)
    for j in range(5):                                                   # burst: same time, no prediction step
        ml, ms, p11, p12, p22 = _update(ml, ms, p11, p12, p22, vals[:, j], r, allm)
    g = np.full((n, months), -np.inf)
    seen = np.zeros(n, int)
    for t in range(months):
        ml = ml + ms                                                     # predict one month ahead
        p11, p12, p22 = p11 + 2 * p12 + p22, p12 + p22, p22 + q_slope ** 2
        ml, ms, p11, p12, p22 = _update(ml, ms, p11, p12, p22, y[:, t], r, obs[:, t])
        seen += obs[:, t]
        z = (-ms / np.sqrt(p22)).sum(axis=1) / np.sqrt(S.K)
        g[:, t] = np.where(seen >= 2, z, -np.inf)
    return g


def single_session(c, p, pm, q_level=None, data=None):
    """q_level None: compare with the fixed burst baseline. Otherwise a local level filter with level noise q_level * sw."""
    vals, base, sig, y, obs = data or monthly_data(c, p, pm)
    n, months = len(c['age']), p.months
    r = sig ** 2
    g = np.full((n, months), -np.inf)
    if q_level is None:
        sd = sig * pm.pred_sd_factor(5)
        for t in range(months):
            g[:, t] = np.where(obs[:, t], ((base - y[:, t]) / sd).sum(axis=1) / np.sqrt(S.K), -np.inf)
        return g
    ml = base.copy()
    pv = r / (5 + pm.k)                                                  # uncertainty of the burst baseline
    q2 = (q_level * sig) ** 2
    for t in range(months):
        pv = pv + q2
        z = (ml - y[:, t]) / np.sqrt(pv + r)
        g[:, t] = np.where(obs[:, t], z.sum(axis=1) / np.sqrt(S.K), -np.inf)
        kk = pv / (pv + r)
        m = obs[:, t][:, None]
        ml = np.where(m, ml + kk * (y[:, t] - ml), ml)
        pv = np.where(m, (1 - kk) * pv, pv)
    return g


def combine(c, g1, g2, target=0.05):
    """Alarm when either statistic is high: each is divided by its own 5 % threshold, then the larger is taken."""
    stable = c['kind'] == 0
    t1, t2 = (float(np.quantile(g[stable].max(axis=1), 1 - target)) for g in (g1, g2))
    return np.maximum(g1 / t1, g2 / t2)


def evaluate(c, p, g, target=0.05):
    """Threshold at which `target` of stable people are referred, and the outcome measures at that threshold."""
    stable = c['kind'] == 0
    thr = float(np.quantile(g[stable].max(axis=1), 1 - target))
    return {**S.metrics(c, p, *S.first_alarm(g, thr, c['onset'])), 'threshold': thr}
