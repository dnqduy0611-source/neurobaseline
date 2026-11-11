"""NeuroBaseline – EEG analysis on OpenNeuro ds004504 (Alzheimer's, frontotemporal dementia, healthy controls).

Questions:
  Q1  Do simple spectral features separate patients from controls?                    (single-feature AUC)
  Q2  How much of that is kept with only the channels a consumer headband has?        (19 channels vs subsets)
  Q3  Does a small classical ML model help, tested on people it has never seen?       (leave-one-subject-out)
  Q4  Is a 3-minute recording precise enough to follow one person over time?          (split-half, 3 min vs full)
  Q5  Does our simple cleaning give the same picture as the authors' ICA-cleaned data? (raw vs derivatives)

Usage:  python run_analysis.py <dataset_dir> <results_dir> [--recompute]
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import LeaveOneOut
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import features as F

GROUPS = {'A': 'AD', 'F': 'FTD', 'C': 'CN'}
SOURCES = ['raw', 'derivatives']
# Expected direction in dementia, fixed in advance: +1 = higher in patients, -1 = lower in patients.
DIRECTION = {'theta_alpha': +1, 'apf_cog': -1, 'rel_theta': +1, 'rel_alpha': -1, 'slow_ratio': +1, 'rel_delta': +1, 'rel_beta': -1}
PRIMARY = ['theta_alpha', 'apf_cog']
ML_FEATURES = ['rel_delta', 'rel_theta', 'rel_alpha', 'rel_beta', 'log_theta_alpha', 'apf_cog']
TASKS = {'AD_vs_CN': (['AD'], ['CN']), 'FTD_vs_CN': (['FTD'], ['CN']), 'dementia_vs_CN': (['AD', 'FTD'], ['CN'])}
RNG_SEED = 20261120


# ---------------------------------------------------------------- stage 1: features
def compute(dataset_dir, out_dir):
    part = pd.read_csv(os.path.join(dataset_dir, 'participants.tsv'), sep='\t')
    rows, spectra, freqs_out = [], {}, None
    for source in SOURCES:
        base = dataset_dir if source == 'raw' else os.path.join(dataset_dir, 'derivatives')
        for _, p in part.iterrows():
            sub = p['participant_id']
            path = os.path.join(base, sub, 'eeg', sub + '_task-eyesclosed_eeg.set')
            if not os.path.exists(path):
                continue
            data, sfreq, labels = F.load_set(path)
            filtered = F.bandpass(data, sfreq)
            n_ep = int(data.shape[1] // round(F.EPOCH_S * sfreq))
            first3 = np.arange(n_ep) < int(180 / F.EPOCH_S)
            meta = {'source': source, 'sub': sub, 'group': GROUPS[p['Group']], 'age': p['Age'], 'sex': p['Gender'], 'mmse': p['MMSE'],
                    'minutes': round(n_ep * F.EPOCH_S / 60, 2)}
            for sname in F.SETS:
                freqs, psd, p2p, post = F.set_spectra(filtered, sfreq, labels, sname)
                freqs_out = freqs
                ok = F.good_epochs(p2p)
                order = np.cumsum(ok) - 1                      # running index among kept epochs
                variants = {'all': None, 'first3min': first3, 'halfA': ok & (order % 2 == 0), 'halfB': ok & (order % 2 == 1)}
                for vname, sel in variants.items():
                    f = F.features_for(freqs, psd, p2p, post, select=sel, min_epochs=F.MIN_EPOCHS if vname in ('all', 'first3min') else 8)
                    rows.append({**meta, 'set': sname, 'variant': vname, **f})
                rel = F.relative_spectrum(freqs, psd, p2p, post)   # posterior spectrum, for the group-average figure
                if rel is not None:
                    spectra[source + '|' + sname + '|' + sub] = rel
            print(source, sub, meta['group'], 'epochs', n_ep, flush=True)
    df = pd.DataFrame(rows)
    df['kept_frac'] = df['n_kept'] / df['n_epochs'].clip(lower=1)
    df['log_theta_alpha'] = np.log(df['theta_alpha'])
    df.to_csv(os.path.join(out_dir, 'features.csv'), index=False)
    np.savez_compressed(os.path.join(out_dir, 'spectra.npz'), freqs=freqs_out, **spectra)
    return df


# ---------------------------------------------------------------- statistics helpers
def auc_ci(y, score, rng, n_boot=2000):
    """AUC with a stratified bootstrap 95 % interval."""
    y, score = np.asarray(y), np.asarray(score, float)
    auc = roc_auc_score(y, score)
    i1, i0 = np.where(y == 1)[0], np.where(y == 0)[0]
    boots = np.empty(n_boot)
    for b in range(n_boot):
        idx = np.r_[rng.choice(i1, len(i1)), rng.choice(i0, len(i0))]
        boots[b] = roc_auc_score(y[idx], score[idx])
    lo, hi = np.percentile(boots, [2.5, 97.5])
    return float(auc), float(lo), float(hi)


def cohen_d(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    s = np.sqrt(((len(a) - 1) * a.var(ddof=1) + (len(b) - 1) * b.var(ddof=1)) / (len(a) + len(b) - 2))
    return float((a.mean() - b.mean()) / s)


def icc21(a, b):
    """ICC(2,1), absolute agreement, two measurements per person."""
    x = np.c_[a, b]
    n, k = x.shape
    grand = x.mean()
    msr = k * ((x.mean(1) - grand) ** 2).sum() / (n - 1)
    msc = n * ((x.mean(0) - grand) ** 2).sum() / (k - 1)
    sse = ((x - x.mean(1, keepdims=True) - x.mean(0, keepdims=True) + grand) ** 2).sum()
    mse = sse / ((n - 1) * (k - 1))
    return float((msr - mse) / (msr + (k - 1) * mse + k * (msc - mse) / n))


def loso_scores(model_fn, X, y):
    """Leave-one-subject-out: each person is scored by a model trained on everyone else."""
    out = np.empty(len(y))
    for tr, te in LeaveOneOut().split(X):
        m = model_fn().fit(X[tr], y[tr])
        out[te] = m.predict_proba(X[te])[:, 1]
    return out


def lr_model():
    return make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=2000))


def rf_model():
    return RandomForestClassifier(n_estimators=200, min_samples_leaf=2, random_state=0, n_jobs=-1)


def classify_report(y, prob, rng):
    auc, lo, hi = auc_ci(y, prob, rng)
    pred = (prob >= 0.5).astype(int)
    sens = float((pred[y == 1] == 1).mean())
    spec = float((pred[y == 0] == 0).mean())
    return {'auc': auc, 'auc_lo': lo, 'auc_hi': hi, 'sensitivity': sens, 'specificity': spec, 'balanced_accuracy': (sens + spec) / 2, 'n_pos': int((y == 1).sum()), 'n_neg': int((y == 0).sum())}


# ---------------------------------------------------------------- stage 2: analysis
def analyse(df, out_dir, n_perm=200):
    rng = np.random.default_rng(RNG_SEED)
    res = {'config': {'epoch_s': F.EPOCH_S, 'reject_uv': F.REJECT_UV, 'min_epochs': F.MIN_EPOCHS, 'apf_window_hz': F.APF_WIN, 'sets': F.SETS, 'ml_features': ML_FEATURES,
                      'bootstrap': 2000, 'permutations': n_perm, 'seed': RNG_SEED},
           'quality': {}, 'single': {}, 'ml': {}, 'reliability': {}, 'mmse': {}, 'agreement': {}}
    allv = df[df['variant'] == 'all']

    for source in df['source'].unique():
        for sname in F.SETS:
            d = allv[(allv['source'] == source) & (allv['set'] == sname)]
            usable = d.dropna(subset=['theta_alpha'])
            key = source + '|' + sname
            res['quality'][key] = {'n_subjects': int(len(d)), 'n_usable': int(len(usable)), 'median_kept_frac': float(d['kept_frac'].median()),
                                   'min_kept_frac': float(d['kept_frac'].min()), 'usable_by_group': usable['group'].value_counts().to_dict()}
            # Q1/Q2: one feature at a time
            for task, (pos, neg) in TASKS.items():
                t = usable[usable['group'].isin(pos + neg)]
                y = t['group'].isin(pos).astype(int).to_numpy()
                for feat, sign in DIRECTION.items():
                    v = t[feat].to_numpy()
                    auc, lo, hi = auc_ci(y, sign * v, rng)
                    u = stats.mannwhitneyu(v[y == 1], v[y == 0], alternative='two-sided')
                    res['single'][key + '|' + task + '|' + feat] = {
                        'auc': auc, 'auc_lo': lo, 'auc_hi': hi, 'p_mannwhitney': float(u.pvalue), 'cohen_d': cohen_d(v[y == 1], v[y == 0]),
                        'median_pos': float(np.median(v[y == 1])), 'median_neg': float(np.median(v[y == 0])), 'n_pos': int((y == 1).sum()), 'n_neg': int((y == 0).sum())}
                # Q3: classical ML, leave-one-subject-out
                X = t[ML_FEATURES].to_numpy()
                prob = loso_scores(lr_model, X, y)
                r = classify_report(y, prob, rng)
                if source == 'raw' and task == 'AD_vs_CN' and n_perm:
                    null = np.array([roc_auc_score(yp, loso_scores(lr_model, X, yp)) for yp in (rng.permutation(y) for _ in range(n_perm))])
                    r['p_permutation'] = float((1 + (null >= r['auc']).sum()) / (1 + n_perm))
                res['ml'][key + '|' + task + '|logreg'] = r
                if task == 'AD_vs_CN':
                    res['ml'][key + '|' + task + '|forest'] = classify_report(y, loso_scores(rf_model, X, y), rng)
            # MMSE relation (patients and controls together, and patients only)
            for feat in PRIMARY:
                rho, p = stats.spearmanr(usable[feat], usable['mmse'])
                pat = usable[usable['group'] != 'CN']
                rho2, p2 = stats.spearmanr(pat[feat], pat['mmse'])
                res['mmse'][key + '|' + feat] = {'rho_all': float(rho), 'p_all': float(p), 'rho_patients': float(rho2), 'p_patients': float(p2), 'n_all': int(len(usable)), 'n_patients': int(len(pat))}
            # Q4: precision of a single recording
            w = df[(df['source'] == source) & (df['set'] == sname)].pivot(index='sub', columns='variant', values=['apf_cog', 'log_theta_alpha'])
            for feat in ['apf_cog', 'log_theta_alpha']:
                ab = w[feat][['halfA', 'halfB']].dropna()
                f3 = w[feat][['first3min', 'all']].dropna()
                diff = (ab['halfA'] - ab['halfB']).to_numpy()
                res['reliability'][key + '|' + feat] = {
                    'split_half_icc': icc21(ab['halfA'].to_numpy(), ab['halfB'].to_numpy()), 'split_half_sd_diff': float(diff.std(ddof=1)), 'n_split': int(len(ab)),
                    'between_person_sd': float(w[feat]['all'].dropna().std(ddof=1)),
                    'first3_vs_full_icc': icc21(f3['first3min'].to_numpy(), f3['all'].to_numpy()), 'first3_vs_full_mad': float((f3['first3min'] - f3['all']).abs().median()), 'n_first3': int(len(f3))}

    # Q5: simple cleaning vs the authors' ICA-cleaned data, per person
    if set(SOURCES) <= set(df['source'].unique()):
        for sname in F.SETS:
            for feat in ['apf_cog', 'log_theta_alpha']:
                w = allv[allv['set'] == sname].pivot(index='sub', columns='source', values=feat).dropna()
                r, _ = stats.pearsonr(w['raw'], w['derivatives'])
                res['agreement'][sname + '|' + feat] = {'pearson_r': float(r), 'icc': icc21(w['raw'].to_numpy(), w['derivatives'].to_numpy()),
                                                        'median_abs_diff': float((w['raw'] - w['derivatives']).abs().median()), 'n': int(len(w))}
    with open(os.path.join(out_dir, 'summary.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=1)
    return res


# ---------------------------------------------------------------- stage 3: tables (markdown, numbers straight from the results)
def fmt_auc(r):
    return f"{r['auc']:.2f} ({r['auc_lo']:.2f}–{r['auc_hi']:.2f})"


def tables(res, out_dir):
    L = []
    for source in SOURCES:
        if source + '|full19' not in res['quality']:
            continue
        L += [f'## Data: {"raw recordings, simple cleaning" if source == "raw" else "authors’ ICA-cleaned derivatives"}', '']
        L += ['### Signal quality', '', '| Channel set | Usable subjects | Median share of epochs kept | Lowest |', '|---|---|---|---|']
        for s in F.SETS:
            q = res['quality'][source + '|' + s]
            L.append(f"| {F.SET_LABEL[s]} | {q['n_usable']} of {q['n_subjects']} | {q['median_kept_frac']:.0%} | {q['min_kept_frac']:.0%} |")
        for task in TASKS:
            L += ['', f'### {task.replace("_", " ")}: AUC (95 % bootstrap interval)', '', '| Channel set | θ/α ratio | Alpha centre of gravity | ML model (LOSO) | Sens. | Spec. |', '|---|---|---|---|---|---|']
            for s in F.SETS:
                k = source + '|' + s + '|' + task
                m = res['ml'][k + '|logreg']
                L.append(f"| {F.SET_LABEL[s]} | {fmt_auc(res['single'][k + '|theta_alpha'])} | {fmt_auc(res['single'][k + '|apf_cog'])} | {fmt_auc(m)} | {m['sensitivity']:.0%} | {m['specificity']:.0%} |")
        L += ['', '### Precision of one recording', '', '| Channel set | Feature | Split-half ICC | SD of half-to-half difference | Between-person SD | 3 min vs full: ICC | 3 min vs full: median abs. difference |', '|---|---|---|---|---|---|---|']
        for s in F.SETS:
            for feat, name in [('apf_cog', 'Alpha centre of gravity (Hz)'), ('log_theta_alpha', 'log θ/α')]:
                r = res['reliability'][source + '|' + s + '|' + feat]
                L.append(f"| {F.SET_LABEL[s]} | {name} | {r['split_half_icc']:.3f} | {r['split_half_sd_diff']:.3f} | {r['between_person_sd']:.3f} | {r['first3_vs_full_icc']:.3f} | {r['first3_vs_full_mad']:.3f} |")
        L += ['', '### Relation to MMSE (Spearman ρ)', '', '| Channel set | Feature | All subjects | Patients only |', '|---|---|---|---|']
        for s in F.SETS:
            for feat, name in [('theta_alpha', 'θ/α ratio'), ('apf_cog', 'Alpha centre of gravity')]:
                r = res['mmse'][source + '|' + s + '|' + feat]
                L.append(f"| {F.SET_LABEL[s]} | {name} | {r['rho_all']:+.2f} (p = {r['p_all']:.3g}, n = {r['n_all']}) | {r['rho_patients']:+.2f} (p = {r['p_patients']:.3g}, n = {r['n_patients']}) |")
        L.append('')
    if res['agreement']:
        L += ['## Simple cleaning vs ICA-cleaned data, same person', '', '| Channel set | Feature | Pearson r | ICC | Median abs. difference |', '|---|---|---|---|---|']
        for s in F.SETS:
            for feat, name in [('apf_cog', 'Alpha centre of gravity (Hz)'), ('log_theta_alpha', 'log θ/α')]:
                r = res['agreement'][s + '|' + feat]
                L.append(f"| {F.SET_LABEL[s]} | {name} | {r['pearson_r']:.3f} | {r['icc']:.3f} | {r['median_abs_diff']:.3f} |")
    with open(os.path.join(out_dir, 'tables.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')


def main():
    dataset_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    cache = os.path.join(out_dir, 'features.csv')
    df = pd.read_csv(cache) if os.path.exists(cache) and '--recompute' not in sys.argv else compute(dataset_dir, out_dir)
    res = analyse(df, out_dir, n_perm=0 if '--no-perm' in sys.argv else 200)
    tables(res, out_dir)
    print('done:', len(df['sub'].unique()), 'subjects,', list(df['source'].unique()))


if __name__ == '__main__':
    main()
