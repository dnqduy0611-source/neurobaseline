"""NeuroBaseline – what does one fixed cut-off do to people with different schooling? NHANES 2011-2014.

Adults aged 60 and over took the Digit Symbol Substitution Test (DSST). The analysis asks:
  Q1  How much do DSST scores differ by education, at the same age and sex?
  Q2  With one cut-off for everyone, what share of each education group falls below it?
  Q3  Is that still so among people who report no worsening of memory or confusion?
  Q4  What does a cut-off set to flag 5 % of everyone do, and what do age-, sex- and education-adjusted norms do?

Estimates use the survey weights and the stratified, clustered design (Taylor linearisation).

Usage:  python run_analysis.py <data_dir> <results_dir>
"""
import json
import os
import sys

import numpy as np
import pandas as pd
from scipy import stats

EDU = {1: 'Less than 9th grade', 2: '9th–11th grade', 3: 'High school or GED', 4: 'Some college', 5: 'College graduate'}
AGE_BANDS = [('60–69', 60, 69), ('70–79', 70, 79), ('80+', 80, 200)]


def load(data_dir):
    frames = []
    for suffix, cycle in (('G', '2011-2012'), ('H', '2013-2014')):
        demo = pd.read_sas(os.path.join(data_dir, f'DEMO_{suffix}.xpt'), format='xport')[['SEQN', 'RIDAGEYR', 'RIAGENDR', 'DMDEDUC2', 'WTMEC2YR', 'SDMVPSU', 'SDMVSTRA']]
        cfq = pd.read_sas(os.path.join(data_dir, f'CFQ_{suffix}.xpt'), format='xport')[['SEQN', 'CFDDS']]
        mcq = pd.read_sas(os.path.join(data_dir, f'MCQ_{suffix}.xpt'), format='xport')[['SEQN', 'MCQ084']]
        d = demo.merge(cfq, on='SEQN', how='left').merge(mcq, on='SEQN', how='left')
        d['cycle'] = cycle
        frames.append(d)
    d = pd.concat(frames, ignore_index=True)
    d['w'] = d['WTMEC2YR'] / 2.0                       # two cycles combined: four-year weight
    d = d[d['w'] > 0].copy()                           # people examined in the mobile centre, the design sample for these tests
    d['edu'] = d['DMDEDUC2'].where(d['DMDEDUC2'].isin([1, 2, 3, 4, 5]))
    d['analytic'] = (d['RIDAGEYR'] >= 60) & d['CFDDS'].notna() & d['edu'].notna()
    d['no_complaint'] = d['analytic'] & (d['MCQ084'] == 2)
    return d


# ---------------------------------------------------------------- survey estimation
def design_var(z, d):
    """Variance of the sum of z over a stratified cluster design (PSUs within strata, with replacement)."""
    by = pd.DataFrame({'z': z, 'h': d['SDMVSTRA'].to_numpy(), 'c': d['SDMVPSU'].to_numpy()}).groupby(['h', 'c'])['z'].sum()
    var = 0.0
    for _, zc in by.groupby(level=0):
        n = len(zc)
        if n > 1:
            var += n / (n - 1) * ((zc - zc.mean()) ** 2).sum()
    return var


def degrees_of_freedom(d):
    return d.groupby('SDMVSTRA')['SDMVPSU'].nunique().sum() - d['SDMVSTRA'].nunique()


def svy_mean(y, mask, d, proportion=False):
    """Weighted mean of y in the domain `mask`, with a design-based 95 % interval (on the logit scale for a proportion)."""
    w, m = d['w'].to_numpy(), np.asarray(mask, bool)
    yy = np.where(m, np.nan_to_num(np.asarray(y, float)), 0.0)
    wsum = w[m].sum()
    est = (w * yy).sum() / wsum
    z = np.where(m, w * (yy - est) / wsum, 0.0)
    se = np.sqrt(design_var(z, d))
    t = stats.t.ppf(0.975, degrees_of_freedom(d))
    lo, hi = est - t * se, est + t * se
    if proportion and 0 < est < 1:
        half = t * se / (est * (1 - est))
        logit = np.log(est / (1 - est))
        lo, hi = 1 / (1 + np.exp(-(logit - half))), 1 / (1 + np.exp(-(logit + half)))
    return {'est': float(est), 'se': float(se), 'lo': float(lo), 'hi': float(hi), 'n': int(m.sum())}


def wquantile(y, w, q):
    order = np.argsort(y)
    y, w = np.asarray(y, float)[order], np.asarray(w, float)[order]
    return float(np.interp(q, (np.cumsum(w) - 0.5 * w) / w.sum(), y))


def wsd(y, w):
    m = np.average(y, weights=w)
    return float(np.sqrt(np.average((y - m) ** 2, weights=w)))


def svy_regression(y, x, mask, d):
    """Weighted least squares in the domain, with a design-based (cluster sandwich) covariance."""
    m = np.asarray(mask, bool)
    w = np.where(m, d['w'].to_numpy(), 0.0)
    xx, yy = np.where(m[:, None], x, 0.0), np.where(m, np.nan_to_num(y), 0.0)
    bread = np.linalg.inv((xx * w[:, None]).T @ xx)
    beta = bread @ ((xx * w[:, None]).T @ yy)
    resid = np.where(m, yy - xx @ beta, 0.0)
    g = pd.DataFrame(xx * (w * resid)[:, None]).assign(h=d['SDMVSTRA'].to_numpy(), c=d['SDMVPSU'].to_numpy()).groupby(['h', 'c']).sum()
    meat = np.zeros((x.shape[1], x.shape[1]))
    for _, gc in g.groupby(level=0):
        n = len(gc)
        if n > 1:
            dev = gc.to_numpy() - gc.to_numpy().mean(axis=0)
            meat += n / (n - 1) * dev.T @ dev
    cov = bread @ meat @ bread
    return beta, np.sqrt(np.diag(cov)), resid


# ---------------------------------------------------------------- analysis
def below_by_education(d, flag, domain):
    out = {}
    for e in EDU:
        out[str(e)] = svy_mean(flag, domain & (d['edu'] == e), d, proportion=True)
    out['all'] = svy_mean(flag, domain, d, proportion=True)
    return out


def main():
    data_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    d = load(data_dir).reset_index(drop=True)
    a, nc = d['analytic'].to_numpy(), d['no_complaint'].to_numpy()
    y, w = d['CFDDS'].to_numpy(), d['w'].to_numpy()
    res = {'n': {'examined_60_plus': int((d['RIDAGEYR'] >= 60).sum()), 'analytic': int(a.sum()), 'no_complaint': int(nc.sum()),
                 'complaint_known': int((a & d['MCQ084'].isin([1, 2])).sum()), 'by_education': {str(e): int((a & (d['edu'] == e)).sum()) for e in EDU}}}

    # Q1: scores by education
    res['score'] = {}
    for e in EDU:
        m = a & (d['edu'] == e).to_numpy()
        res['score'][str(e)] = {**svy_mean(y, m, d), 'sd': wsd(y[m], w[m]), **{f'q{int(100 * q)}': wquantile(y[m], w[m], q) for q in (0.05, 0.25, 0.5, 0.75, 0.95)}}
    res['score']['all'] = {**svy_mean(y, a, d), 'sd': wsd(y[a], w[a])}
    age = np.minimum(d['RIDAGEYR'].to_numpy(), 80.0)                                   # age is top-coded at 80
    x = np.column_stack([np.ones(len(d)), age - 70.0, (d['RIAGENDR'] == 2).to_numpy(float)] + [(d['edu'] == e).to_numpy(float) for e in (2, 3, 4, 5)] + [(d['cycle'] == '2013-2014').to_numpy(float)])
    beta, se, resid = svy_regression(y, x, a, d)
    names = ['intercept', 'age_per_year', 'female', 'edu2', 'edu3', 'edu4', 'edu5', 'cycle_2013']
    resid_sd = wsd(resid[a], w[a])
    res['regression'] = {'coef': {k: {'est': float(b), 'se': float(s)} for k, b, s in zip(names, beta, se)}, 'residual_sd': resid_sd,
                         'college_vs_lowest_in_residual_sd': float(beta[6] / resid_sd), 'college_vs_lowest_in_years_of_age': float(beta[6] / -beta[1])}

    # Q2-Q3: fixed cut-offs. The cut-off is always defined in the whole analytic sample.
    cuts = {'lowest_quartile': wquantile(y[a], w[a], 0.25), 'mean_minus_1_5_sd': float(np.average(y[a], weights=w[a]) - 1.5 * wsd(y[a], w[a]))}
    res['cutoffs'], res['below'] = cuts, {}
    for cname, cut in cuts.items():
        flag = (y < cut).astype(float)
        res['below'][cname] = {'all': below_by_education(d, flag, a), 'no_complaint': below_by_education(d, flag, nc)}
        for band, lo, hi in AGE_BANDS:
            res['below'][cname]['no_complaint_age_' + band] = below_by_education(d, flag, nc & ((d['RIDAGEYR'] >= lo) & (d['RIDAGEYR'] <= hi)).to_numpy())

    # Q4: a cut-off that flags 5 % of people without a memory complaint, against adjusted norms that flag 5 %
    cut5 = wquantile(y[nc], w[nc], 0.05)
    cut5_resid = wquantile(resid[nc], w[nc], 0.05)
    res['five_percent'] = {'cutoff': cut5, 'fixed': below_by_education(d, (y < cut5).astype(float), nc), 'adjusted': below_by_education(d, (resid < cut5_resid).astype(float), nc)}

    with open(os.path.join(out_dir, 'summary.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=1)

    # tables
    def ci(r, digits=1):
        return f"{100 * r['est']:.{digits}f} % ({100 * r['lo']:.{digits}f}–{100 * r['hi']:.{digits}f})"
    L = ['# NHANES 2011–2014: tables', '', f"Adults aged 60 and over with a DSST score and a known education level: n = {res['n']['analytic']}. "
         f"Of these, {res['n']['no_complaint']} reported no worsening confusion or memory loss in the past 12 months. Weighted estimates with design-based 95 % intervals.", '',
         '## DSST score by education', '', '| Education | n | Mean (95 % CI) | SD | Median | 5th–95th percentile |', '|---|---|---|---|---|---|']
    for e, name in EDU.items():
        s = res['score'][str(e)]
        L.append(f"| {name} | {s['n']} | {s['est']:.1f} ({s['lo']:.1f}–{s['hi']:.1f}) | {s['sd']:.1f} | {s['q50']:.0f} | {s['q5']:.0f}–{s['q95']:.0f} |")
    s = res['score']['all']
    L += [f"| All | {s['n']} | {s['est']:.1f} ({s['lo']:.1f}–{s['hi']:.1f}) | {s['sd']:.1f} | | |", '',
          '## Regression of DSST score on age, sex and education', '', '| Term | Points (SE) |', '|---|---|']
    label = {'age_per_year': 'Per year of age', 'female': 'Female vs male', 'edu2': '9th–11th grade vs less than 9th', 'edu3': 'High school vs less than 9th', 'edu4': 'Some college vs less than 9th',
             'edu5': 'College graduate vs less than 9th', 'cycle_2013': '2013–2014 vs 2011–2012'}
    for k, name in label.items():
        c = res['regression']['coef'][k]
        L.append(f"| {name} | {c['est']:+.2f} ({c['se']:.2f}) |")
    r = res['regression']
    L += ['', f"Residual SD {r['residual_sd']:.1f} points. College graduates score {r['coef']['edu5']['est']:.1f} points above people with less than 9th grade at the same age and sex: "
          f"{r['college_vs_lowest_in_residual_sd']:.2f} residual SDs, or the difference associated with {r['college_vs_lowest_in_years_of_age']:.0f} years of age.", '']
    for cname, title in (('lowest_quartile', 'the lowest quartile of all adults aged 60 and over'), ('mean_minus_1_5_sd', '1.5 SD below the mean of all adults aged 60 and over')):
        b = res['below'][cname]
        L += [f"## Share below a fixed cut-off: {title} (score below {res['cutoffs'][cname]:.1f})", '', '| Education | All | No reported worsening of memory | … aged 60–69 | … aged 70–79 | … aged 80+ |', '|---|---|---|---|---|---|']
        for e, name in list(EDU.items()) + [('all', 'All')]:
            L.append(f"| {name} | " + ' | '.join(ci(b[k][str(e)]) for k in ('all', 'no_complaint', 'no_complaint_age_60–69', 'no_complaint_age_70–79', 'no_complaint_age_80+')) + ' |')
        L.append('')
    f5 = res['five_percent']
    L += [f"## A cut-off that flags 5 % of people with no reported worsening of memory (score below {f5['cutoff']:.1f})", '', '| Education | One cut-off for everyone | Norms adjusted for age, sex and education |', '|---|---|---|']
    for e, name in list(EDU.items()) + [('all', 'All')]:
        L.append(f"| {name} | {ci(f5['fixed'][str(e)])} | {ci(f5['adjusted'][str(e)])} |")
    with open(os.path.join(out_dir, 'tables.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
