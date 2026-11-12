"""Tests for the hierarchical model and the simulator. Run:  python test_model.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

import kalman as KF
import model as M
import simulate as S

n_tests = 0


def test(name, f):
    global n_tests
    f()
    n_tests += 1
    print('ok  ' + name)


def close(a, b, tol):
    assert np.all(np.abs(np.asarray(a) - np.asarray(b)) <= tol), f'expected {b}, got {a}'


P = S.Params()
RNG = np.random.default_rng(1)
REF = S.make_cohort(P, 6000, RNG, reference=True)
PM = M.fit(S.reference_scores(REF, P), REF['age'], REF['edu'])


def t_fit_variances():
    # true within-person SD averaged over people: sigma_w * sqrt(E[exp(2 * N(0, 0.25))]), plus bad days
    close(PM.sigma_b, [1, 1, 1], 0.08)
    true_w = P.sigma_w * np.sqrt(np.exp(2 * P.noise_sd_log ** 2)) * np.sqrt(1 + P.p_bad * (1 - P.p_bad) * P.bad_shift ** 2)
    close(PM.sigma_w / true_w, [1, 1, 1], 0.08)


def t_fit_fixed_effects():
    close(PM.beta[1], [P.age_slope] * 3, 0.006)                           # age slope
    close(PM.beta[2], 0.5 * np.array(P.edu_effect), 0.10)                  # middle vs low education
    close(PM.beta[3], 1.0 * np.array(P.edu_effect), 0.10)                  # high vs low education


def t_fit_practice():
    true = np.array(P.practice_gain) * np.exp(P.practice_sd ** 2 / 2) * (1 - np.exp(-np.arange(7)[:, None] / P.practice_tau)) \
        - np.array(P.practice_gain) * np.exp(P.practice_sd ** 2 / 2)
    close(PM.gamma[:7], true, 0.05)
    assert np.all(PM.gamma[7:] == 0) and np.all(PM.gamma[0] < 0)


def t_weights():
    close(PM.weight(0), [0, 0, 0], 0)
    assert np.all(np.diff([PM.weight(n)[0] for n in (1, 2, 5, 20)]) > 0) and np.all(PM.weight(1000) > 0.99)
    age, edu = np.array([70.0]), np.array([2])
    close(PM.baseline(np.array([[9.0, 9.0, 9.0]]), 0, age, edu), PM.predict(age, edu), 1e-12)   # no sessions: population prediction
    b = PM.baseline(np.array([[9.0, 9.0, 9.0]]), 5, age, edu)
    assert np.all(b < 9.0) and np.all(b > PM.predict(age, edu))                                 # in between, pulled toward the person


def t_rci_is_special_case():
    pm0 = M.PopulationModel(PM.beta, PM.gamma, np.full(3, 1e9), PM.sigma_w, PM.norm_mean, PM.norm_sd, PM.adj_beta, PM.adj_sd, PM.plateau_from)
    close(pm0.pred_sd_factor(4), np.sqrt(1 + 1 / 4), 1e-9)                # k -> 0 gives the RCI formula
    close(pm0.weight(4), [1, 1, 1], 1e-9)
    close(PM.pred_sd_factor(0), np.sqrt(1 + 1 / PM.k), 1e-12)             # day 1: sqrt(sw^2 + sb^2) / sw


def t_blended_sigma():
    m = np.array([1, 5])
    vals = np.array([[0.0], [2.0]])
    s = M.blended_sigma(np.array([1.0]), 6.0, m, vals * m[:, None], (vals ** 2) * m[:, None])   # zero personal variance
    close(s[0], [1.0], 1e-12)                                             # one value: prior only
    close(s[1], [np.sqrt(6 / 10)], 1e-12)


def t_cusum():
    c = np.zeros(1)
    for z in (0.2, -1.0, 0.4):
        c = M.cusum_step(c, np.array([z]), 0.5)
    close(c, [0.0], 0)                                                    # ordinary sessions never accumulate
    for z in (1.5, 1.5, 1.5):
        c = M.cusum_step(c, np.array([z]), 0.5)
    close(c, [3.0], 1e-12)                                                # a sustained shift does
    close(M.cusum_step(np.zeros(1), np.array([50.0]), 0.5), [2.5], 1e-12)  # one wild session is capped


def t_simulation_sanity():
    rng = np.random.default_rng(2)
    c = S.make_cohort(P, 3000, rng)
    assert abs((c['kind'] == 1).mean() - P.p_slow) < 0.03
    prev = None
    for thr in (1.0, 1.96, 3.0):                                          # a stricter threshold refers fewer people
        first, post = S.run_method(c, P, PM, 'hier', thr)
        r = S.metrics(c, P, first, post)
        if prev:
            assert r['false_referral'] <= prev['false_referral'] and r['slow_detected_24m'] <= prev['slow_detected_24m']
        prev = r
    stable = S.make_cohort(P, 2000, rng, reference=True)
    f, _ = S.run_method(stable, P, PM, 'cusum', 1e9)
    assert np.all(np.isinf(f))                                            # an unreachable threshold refers nobody


def t_trend():
    rng = np.random.default_rng(5)
    c = S.make_cohort(P, 3000, rng)
    gmax = S.trend_statistic(c, P, PM).max(axis=1)
    assert np.median(gmax[c['kind'] == 1]) > np.median(gmax[c['kind'] == 0]) + 1.0       # decliners score clearly higher
    # a wrong baseline must not look like a decline: raise every stable person's first five sessions by one noise SD
    ref = S.make_cohort(P, 3000, rng, reference=True)
    shifted = dict(ref)
    shifted['noise_b'] = ref['noise_b'] + 1.0
    limit = np.quantile(S.trend_statistic(ref, P, PM).max(axis=1), 0.95)
    trend_alarms = (S.trend_statistic(shifted, P, PM).max(axis=1) > limit).mean()
    h = S.calibrate(ref, P, PM, 'cusum', 0.05)
    cusum_alarms = np.isfinite(S.run_method(shifted, P, PM, 'cusum', h)[0]).mean()
    assert trend_alarms < 0.7 * cusum_alarms, (trend_alarms, cusum_alarms)               # both are affected, CUSUM much more


def t_calibration():
    c = S.make_cohort(P, 4000, np.random.default_rng(3))
    for method in S.METHODS:
        thr = S.calibrate(c, P, PM, method, target=0.05)
        first, _ = S.run_method(c, P, PM, method, thr)
        fpr = (first[c['kind'] == 0] <= 2 * P.months).mean()
        assert abs(fpr - 0.05) < 0.012, (method, fpr)


def t_kalman_burst_is_hierarchical_baseline():
    # with no time step the filter's level after the 5 burst sessions must equal the shrunken baseline
    c = S.make_cohort(P, 500, np.random.default_rng(5))
    vals, base, sig, _, _ = KF.monthly_data(c, P, PM)
    n = len(c['age'])
    ml = np.broadcast_to(PM.predict(c['age'], c['edu']), (n, S.K)).copy()
    p11 = np.broadcast_to(PM.sigma_b ** 2, (n, S.K)).copy()
    zero = np.zeros((n, S.K))
    for j in range(5):
        ml, _, p11, _, _ = KF._update(ml, zero, p11, zero, zero, vals[:, j], sig ** 2, np.ones(n, bool))
    w = 5 / (5 + sig ** 2 / PM.sigma_b ** 2)
    close(ml, w * vals.mean(axis=1) + (1 - w) * PM.predict(c['age'], c['edu']), 1e-9)


def t_kalman_and_adaptive_baseline():
    c = S.make_cohort(P, 6000, np.random.default_rng(6))
    data = KF.monthly_data(c, P, PM)
    kal = KF.evaluate(c, P, KF.kalman_trend(c, P, PM, 0.004, data))
    anchor = KF.evaluate(c, P, KF.single_session(c, P, PM, None, data))
    adapt = KF.evaluate(c, P, KF.single_session(c, P, PM, 0.25, data))
    assert abs(kal['false_referral'] - 0.05) < 0.01, kal['false_referral']
    assert kal['slow_detected_24m'] > 0.7, kal['slow_detected_24m']                       # finds slow decline
    assert adapt['slow_detected_24m'] < 0.5 * anchor['slow_detected_24m'], (adapt, anchor)  # an adaptive baseline absorbs it


test('fit recovers between- and within-person SD', t_fit_variances)
test('fit recovers age and education effects', t_fit_fixed_effects)
test('fit recovers the practice curve', t_fit_practice)
test('shrinkage weight: 0 with no sessions, rising toward 1', t_weights)
test('personal RCI is the special case k = 0', t_rci_is_special_case)
test('blended within-person SD', t_blended_sigma)
test('CUSUM ignores ordinary sessions, accumulates a sustained shift, caps one wild session', t_cusum)
test('simulation: stricter threshold means fewer referrals', t_simulation_sanity)
test('trend test separates decliners and tolerates a wrong baseline better than CUSUM', t_trend)
test('calibration reaches a 5 % false-referral rate for every method', t_calibration)
test('Kalman level after the burst equals the hierarchical baseline', t_kalman_burst_is_hierarchical_baseline)
test('Kalman finds slow decline; an adaptive baseline absorbs it', t_kalman_and_adaptive_baseline)
print(f'\n{n_tests} tests passed')
