"""NeuroBaseline – simulated cohort and five ways of raising a referral.

Everything here is SIMULATED. The generating parameters are assumptions (see Params); the report varies them.
Scores are in units of the between-person SD and oriented so that higher is better.
Indicators: reaction speed, symbol matching, picture memory.

Timeline of one person: 5 burst sessions at month 0, then one session a month for `months` months.
A yellow light brings the next session forward to 2 weeks. Time advances in half-month steps.
The trend test uses the plain monthly schedule (no extra sessions).
"""
from dataclasses import dataclass

import numpy as np

import model as M

K = 3
INDICATORS = ['speed', 'symbol', 'memory']
METHODS = ['fixed', 'adjusted', 'rci', 'hier', 'cusum', 'trend']
METHOD_LABEL = {
    'fixed': 'Fixed cut-off', 'adjusted': 'Age/education-adjusted cut-off', 'rci': 'Personal baseline (RCI)',
    'hier': 'Hierarchical model', 'cusum': 'Hierarchical model + CUSUM', 'trend': 'Hierarchical model + trend test'}
DEFAULT_THRESHOLD = {'fixed': 1.5, 'adjusted': 1.5, 'rci': 1.96, 'hier': 1.96, 'cusum': 4.0, 'trend': 3.0}
THRESHOLD_RANGE = {'fixed': (0.3, 4.0), 'adjusted': (0.3, 4.0), 'rci': (0.5, 4.5), 'hier': (0.5, 4.5), 'cusum': (0.5, 30.0), 'trend': (0.0, 8.0)}
NU0, KAPPA = 6.0, 0.5


@dataclass(frozen=True)
class Params:
    reliability: tuple = (0.70, 0.85, 0.60)   # test-retest reliability of each indicator
    trait_corr: float = 0.4                   # correlation between a person's levels on the three indicators
    age_slope: float = -0.03                  # per year of age
    edu_probs: tuple = (0.3, 0.4, 0.3)        # low / middle / high education
    edu_effect: tuple = (0.4, 1.0, 0.8)       # score gap between adjacent education levels is 0.5 x this
    pop_shift: float = 0.0                    # whole-population offset (used for the "other population" scenario)
    practice_gain: tuple = (0.3, 0.5, 0.3)    # total gain from repeating the task
    practice_tau: float = 1.5                 # sessions needed for ~63 % of the gain
    practice_sd: float = 0.3                  # person-to-person spread of the gain (log scale)
    noise_sd_log: float = 0.25                # person-to-person spread of session noise (log scale)
    p_slow: float = 0.15                      # share with a slow decline
    p_step: float = 0.05                      # share with a sudden drop
    slow_rate: float = 0.5                    # decline per year on the most affected indicator
    step_size: float = 1.0
    loading: tuple = (0.5, 0.8, 1.0)          # how strongly each indicator is affected
    onset_min: float = 3.0                    # decline starts between these months
    onset_max: float = 12.0
    p_bad: float = 0.08                       # chance that a session falls on a bad day
    bad_shift: float = 1.0                    # drop on a bad day, in within-person SDs
    p_flag: float = 0.5                       # chance the person reports the bad day
    p_missing: float = 0.10                   # chance a due session is skipped
    months: int = 36

    @property
    def sigma_w(self):
        r = np.array(self.reliability)
        return np.sqrt((1 - r) / r)


def make_cohort(p, n, rng, reference=False):
    """Draw n people. A reference cohort contains only stable people (used to learn the population model)."""
    steps = 2 * p.months
    age = rng.uniform(50, 80, n)
    edu = rng.choice(3, n, p=p.edu_probs)
    corr = np.full((K, K), p.trait_corr) + (1 - p.trait_corr) * np.eye(K)
    u = rng.standard_normal((n, K)) @ np.linalg.cholesky(corr).T
    mu = p.pop_shift + p.age_slope * (age - 65)[:, None] + (edu - 1)[:, None] * 0.5 * np.array(p.edu_effect) + u
    kind = np.zeros(n, int) if reference else rng.choice(3, n, p=[1 - p.p_slow - p.p_step, p.p_slow, p.p_step])
    bad_b, bad = rng.random((n, 5)) < p.p_bad, rng.random((n, steps + 1)) < p.p_bad
    return {
        'age': age, 'edu': edu, 'mu': mu, 'kind': kind, 'onset': rng.uniform(p.onset_min, p.onset_max, n),
        'sig': p.sigma_w * np.exp(rng.normal(0, p.noise_sd_log, (n, 1))),
        'gain': np.array(p.practice_gain) * np.exp(rng.normal(0, p.practice_sd, (n, 1))),
        'noise_b': rng.standard_normal((n, 5, K)), 'noise': rng.standard_normal((n, steps + 1, K)),
        'bad_b': bad_b, 'bad': bad, 'flag': bad & (rng.random((n, steps + 1)) < p.p_flag),
        'missing': rng.random((n, steps + 1)) < p.p_missing,
    }


def score(c, p, j, t, noise, bad):
    """Observed scores at session number j (array) and time t in months."""
    practice = c['gain'] * (1 - np.exp(-(j - 1) / p.practice_tau))[:, None]
    since = np.maximum(0.0, t - c['onset'])
    drop = np.where(c['kind'] == 1, p.slow_rate * since / 12, np.where((c['kind'] == 2) & (t >= c['onset']), p.step_size, 0.0))
    return c['mu'] + practice - drop[:, None] * np.array(p.loading) - bad[:, None] * p.bad_shift * c['sig'] + c['sig'] * noise


def burst(c, p):
    n = len(c['age'])
    return np.stack([score(c, p, np.full(n, j + 1), 0.0, c['noise_b'][:, j], c['bad_b'][:, j]) for j in range(5)], axis=1)


def reference_scores(c, p, monthly=12):
    """Complete data of a reference cohort: 5 burst sessions and `monthly` monthly sessions."""
    n = len(c['age'])
    later = [score(c, p, np.full(n, 6 + m), m + 1.0, c['noise'][:, 2 * (m + 1)], c['bad'][:, 2 * (m + 1)]) for m in range(monthly)]
    return np.concatenate([burst(c, p), np.stack(later, axis=1)], axis=1)


def trend_statistic(c, p, pm):
    """Trend test. For each person and month, how strongly do all sessions so far point to a decline?

    For a candidate starting month tau, every indicator is modelled as  level + slope * max(0, month - tau).
    Level and slope are estimated together, so an error in the baseline is not mistaken for a decline.
    The population prediction enters as a prior on the level, worth k sessions (the hierarchical part).
    T = -slope / SE(slope), summed over the three indicators / sqrt(3), maximised over tau.
    Returns G[person, month].
    """
    n, months = len(c['age']), p.months
    vals = burst(c, p) - pm.gamma[:5][None]
    base = pm.baseline(vals.mean(axis=1), 5, c['age'], c['edu'])
    sig = M.blended_sigma(pm.sigma_w, NU0, np.full(n, 5), vals.sum(axis=1), (vals ** 2).sum(axis=1))
    y, obs, n_sess = np.zeros((n, months, K)), np.zeros((n, months), bool), np.full(n, 5)
    for mth in range(1, months + 1):
        s = 2 * mth
        attended = ~c['missing'][:, s]
        raw = score(c, p, n_sess + 1, float(mth), c['noise'][:, s], c['bad'][:, s]) - pm.practice(n_sess + 1)
        y[:, mth - 1] = np.clip(raw, base - 3 * sig, base + 3 * sig)           # one wild session cannot dominate
        obs[:, mth - 1] = attended & ~c['flag'][:, s]                          # reported bad days are left out
        n_sess[attended] += 1
    w = obs[:, :, None].astype(float)
    t = np.arange(1, months + 1, dtype=float)
    wsum = 5 + pm.k + np.cumsum(w, axis=1)                                     # burst sessions + prior + monthly sessions
    sy = (vals.sum(axis=1) + pm.k * pm.predict(c['age'], c['edu']))[:, None, :] + np.cumsum(w * y, axis=1)
    g = np.full((n, months), -np.inf)
    for tau in range(0, months - 1):
        r = np.maximum(0.0, t - tau)[None, :, None]
        sr, srr, sry = np.cumsum(w * r, axis=1), np.cumsum(w * r ** 2, axis=1), np.cumsum(w * y * r, axis=1)
        den = srr - sr ** 2 / wsum
        tk = -(sry - sr * sy / wsum) / (sig[:, None, :] * np.sqrt(np.maximum(den, 1e-12)))
        enough = np.cumsum(obs & (t > tau)[None, :], axis=1) >= 2              # at least two sessions after tau
        g = np.maximum(g, np.where(enough, tk.sum(axis=2) / np.sqrt(K), -np.inf))
    return g


def first_alarm(g, thr, onset_months):
    """Half-month step of the first month with g > thr, overall and at or after the onset of decline."""
    months = g.shape[1]
    over = g > thr
    first = np.where(over.any(axis=1), 2.0 * (over.argmax(axis=1) + 1), np.inf)
    post = over & (np.arange(1, months + 1)[None, :] >= onset_months[:, None])
    return first, np.where(post.any(axis=1), 2.0 * (post.argmax(axis=1) + 1), np.inf)


def run_method(c, p, pm, method, thr):
    """Follow every person with one method. Returns (first red step, first red step at or after decline onset)."""
    if method == 'trend':
        key = ('trend', id(pm))
        if key not in c:
            c[key] = trend_statistic(c, p, pm)
        return first_alarm(c[key], thr, c['onset'])
    n, steps = len(c['age']), 2 * p.months
    yb = burst(c, p)
    x = M.design(c['age'], c['edu'])
    personal = method in ('rci', 'hier', 'cusum')
    if method == 'rci':
        vals = yb[:, 1:]                                             # sessions 2-5, raw
        base, factor = vals.mean(axis=1), np.sqrt(1 + 1 / 4)
    elif personal:
        vals = yb - pm.gamma[:5][None]                               # sessions 1-5, practice-adjusted
        base, factor = pm.baseline(vals.mean(axis=1), 5, c['age'], c['edu']), pm.pred_sd_factor(5)
    if personal:
        m, s1, s2 = np.full(n, vals.shape[1]), vals.sum(axis=1), (vals ** 2).sum(axis=1)
    n_sess, next_due = np.full(n, 5), np.full(n, 2)
    prev, cus = np.zeros((n, K), bool), np.zeros((n, K))
    first, first_post, onset_step = np.full(n, np.inf), np.full(n, np.inf), c['onset'] * 2
    for s in range(2, steps + 1):
        due = next_due == s
        skipped = due & c['missing'][:, s]
        next_due[skipped] = s + 2
        due &= ~skipped
        if not due.any():
            continue
        y, flag = score(c, p, n_sess + 1, s / 2, c['noise'][:, s], c['bad'][:, s]), c['flag'][:, s]
        if method == 'fixed':
            z = (pm.norm_mean - y) / pm.norm_sd
        elif method == 'adjusted':
            z = (x @ pm.adj_beta - y) / pm.adj_sd
        else:
            v = y if method == 'rci' else y - pm.practice(n_sess + 1)
            z = (base - v) / (M.blended_sigma(pm.sigma_w, NU0, m, s1, s2) * factor)
        if method == 'cusum':
            upd = due & ~flag
            cus[upd] = M.cusum_step(cus[upd], z[upd], KAPPA)
            red = due & (cus > thr).any(axis=1)
            yellow = due & ~red & (cus > thr / 2).any(axis=1)
        else:
            ex = (z > thr) & due[:, None]
            count = ex.sum(axis=1)
            red = due & ((ex & prev).any(axis=1) | ((count >= 2) & ~flag))    # confirmed on repeat, or two areas at once
            yellow = due & ~red & (count >= 1)
            prev[due] = ex[due]
        first = np.where(red & np.isinf(first), s, first)
        first_post = np.where(red & np.isinf(first_post) & (s >= onset_step), s, first_post)
        if personal:
            g = due & ~red & ~yellow & ~flag                          # stable sessions refine the person's own noise level
            m[g] += 1
            s1[g] += v[g]
            s2[g] += v[g] ** 2
        n_sess[due] += 1
        next_due[due] = s + np.where(yellow[due], 1, 2)
    return first, first_post


def metrics(c, p, first, first_post):
    """Outcome measures. Delays are in months after the true onset of decline."""
    steps = 2 * p.months
    stable, slow, step = c['kind'] == 0, c['kind'] == 1, c['kind'] == 2
    delay = (first_post - c['onset'] * 2) / 2
    out = {
        'false_referral': float((first[stable] <= steps).mean()),
        'slow_detected_12m': float((delay[slow] <= 12).mean()), 'slow_detected_18m': float((delay[slow] <= 18).mean()),
        'slow_detected_24m': float((delay[slow] <= 24).mean()),
        'step_detected_3m': float((delay[step] <= 3).mean()), 'step_detected_6m': float((delay[step] <= 6).mean()),
        'slow_median_delay': float(np.median(delay[slow])),
        'slow_detection_curve': [float((delay[slow] <= mth).mean()) for mth in range(0, 25)],
    }
    for e, name in enumerate(['low', 'mid', 'high']):
        g = c['edu'] == e
        out['false_referral_' + name] = float((first[stable & g] <= steps).mean())
        out['slow_detected_24m_' + name] = float((delay[slow & g] <= 24).mean())
    return out


def calibrate(c, p, pm, method, target=0.05, iters=12):
    """Find the threshold at which `target` of stable people are referred within the follow-up (bisection)."""
    lo, hi = THRESHOLD_RANGE[method]
    stable = c['kind'] == 0
    if method == 'trend':                                              # no retests, so the threshold is simply a quantile
        run_method(c, p, pm, 'trend', 0.0)
        return float(np.quantile(c[('trend', id(pm))][stable].max(axis=1), 1 - target))
    for _ in range(iters):
        mid = (lo + hi) / 2
        first, _ = run_method(c, p, pm, method, mid)
        if (first[stable] <= 2 * p.months).mean() > target:
            lo = mid                                                  # too many referrals: be stricter
        else:
            hi = mid
    return (lo + hi) / 2


def run_app_rule(c, p, pm, z_yellow=1.96, z_red=2.5, h_yellow=3.0, h_red=3.5):
    """The rule exactly as the app applies it. No population norms and no practice correction (the app has neither yet).

    Baseline = mean of sessions 2-5. Each follow-up session gets
      z      per indicator, against the personal baseline (Reliable Change Index);
      trend  the trend statistic over all unflagged sessions from session 2 on, level and slope estimated together.
    Red    : the same indicator beyond z_red on two sessions in a row, or two indicators beyond z_red at once
             (not on a reported bad day), or trend >= h_red.
    Yellow : otherwise, any indicator beyond z_yellow, or trend >= h_yellow. Yellow brings the next session forward.
    Returns (first red step, first red step at or after onset, share of first reds raised by the trend test).
    """
    n, steps = len(c['age']), 2 * p.months
    vals = burst(c, p)[:, 1:]
    base, factor = vals.mean(axis=1), np.sqrt(1 + 1 / 4)
    m, s1, s2 = np.full(n, 4), vals.sum(axis=1), (vals ** 2).sum(axis=1)
    tau = np.arange(steps) / 2.0                                       # candidate starting months
    w, sy = np.full(n, 4.0), vals.sum(axis=1)
    sr, srr, cnt, sry = np.zeros((steps, n)), np.zeros((steps, n)), np.zeros((steps, n)), np.zeros((steps, n, K))
    n_sess, next_due, prev = np.full(n, 5), np.full(n, 2), np.zeros((n, K), bool)
    first, first_post, by_trend, onset_step = np.full(n, np.inf), np.full(n, np.inf), np.zeros(n, bool), c['onset'] * 2
    for s in range(2, steps + 1):
        due = next_due == s
        skipped = due & c['missing'][:, s]
        next_due[skipped] = s + 2
        due &= ~skipped
        if not due.any():
            continue
        y, flag = score(c, p, n_sess + 1, s / 2, c['noise'][:, s], c['bad'][:, s]), c['flag'][:, s]
        sig = M.blended_sigma(pm.sigma_w, NU0, m, s1, s2)
        z = (base - y) / (sig * factor)
        upd = due & ~flag
        r = np.maximum(0.0, s / 2 - tau)
        yc = np.clip(y, base - 3 * sig, base + 3 * sig)[upd]
        sr[:, upd] += r[:, None]
        srr[:, upd] += (r ** 2)[:, None]
        cnt[:, upd] += (r > 0)[:, None]
        sry[:, upd] += r[:, None, None] * yc[None]
        w[upd] += 1
        sy[upd] += yc
        den = srr[:, due] - sr[:, due] ** 2 / w[due][None]
        num = sry[:, due] - sr[:, due][:, :, None] * sy[due][None] / w[due][None, :, None]
        comb = (-num / (sig[due][None] * np.sqrt(np.maximum(den, 1e-12))[:, :, None])).sum(axis=2) / np.sqrt(K)
        g = np.full(n, -np.inf)
        g[due] = np.where((cnt[:, due] >= 2) & (den > 1e-9), comb, -np.inf).max(axis=0)
        ex_y, ex_r = (z > z_yellow) & due[:, None], (z > z_red) & due[:, None]
        trend_red = due & (g >= h_red)
        red = due & ((ex_r & prev).any(axis=1) | ((ex_r.sum(axis=1) >= 2) & ~flag) | trend_red)
        yellow = due & ~red & (ex_y.any(axis=1) | (g >= h_yellow))
        prev[due] = ex_r[due]
        new = red & np.isinf(first)
        by_trend[new] = trend_red[new]
        first = np.where(new, s, first)
        first_post = np.where(red & np.isinf(first_post) & (s >= onset_step), s, first_post)
        stable = due & ~red & ~yellow & ~flag
        m[stable] += 1
        s1[stable] += y[stable]
        s2[stable] += y[stable] ** 2
        n_sess[due] += 1
        next_due[due] = s + np.where(yellow[due], 1, 2)
    return first, first_post, by_trend
