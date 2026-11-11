"""NeuroBaseline – figures for the EEG analysis. Reads results/features.csv, spectra.npz and summary.json.

Usage:  python make_figures.py <results_dir>
Colour follows the group everywhere: controls blue, Alzheimer's orange, frontotemporal dementia aqua
(validated for colour-vision deficiency; groups are also named on the axis or next to the line).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import features as F

COL = {'CN': '#2a78d6', 'AD': '#eb6834', 'FTD': '#1baf7a'}
NAME = {'CN': 'Healthy controls', 'AD': "Alzheimer's disease", 'FTD': 'Frontotemporal dementia'}
ORDER = ['CN', 'AD', 'FTD']
INK, INK2, MUTED, GRID, SURF = '#0b0b0b', '#52514e', '#898781', '#e1e0d9', '#fcfcfb'

plt.rcParams.update({
    'figure.facecolor': SURF, 'axes.facecolor': SURF, 'savefig.facecolor': SURF, 'font.size': 10, 'axes.edgecolor': MUTED, 'axes.linewidth': 0.8,
    'axes.labelcolor': INK2, 'xtick.color': MUTED, 'ytick.color': MUTED, 'xtick.labelcolor': INK2, 'ytick.labelcolor': INK2, 'text.color': INK,
    'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6, 'axes.axisbelow': True,
    'axes.titlesize': 11, 'axes.titleweight': 'bold', 'axes.titlelocation': 'left', 'legend.frameon': False,
})


def save(fig, out_dir, name):
    fig.savefig(os.path.join(out_dir, name), dpi=160, bbox_inches='tight')
    plt.close(fig)


def fig_spectra(df, spec, out_dir, source='raw'):
    freqs = spec['freqs']
    grp = df.drop_duplicates('sub').set_index('sub')['group']
    fig, axes = plt.subplots(1, len(F.SETS), figsize=(11, 3.6), sharey=True)
    for ax, s in zip(axes, F.SETS):
        for g in ORDER:
            rows = [spec[k] for k in spec.files if k.startswith(source + '|' + s + '|') and grp[k.split('|')[2]] == g]
            m = np.mean(rows, axis=0)
            keep = (freqs >= 1) & (freqs <= 30)
            ax.plot(freqs[keep], m[keep], color=COL[g], lw=2, label=f'{NAME[g]} (n = {len(rows)})')
        for x in (4, 8, 13):
            ax.axvline(x, color=GRID, lw=0.8, zorder=0)
        top = ax.get_ylim()[1]
        for x, t in ((6, 'theta'), (10.5, 'alpha')):
            ax.text(x, top * 0.97, t, ha='center', va='top', color=MUTED, fontsize=9)
        ax.set_title(F.SET_LABEL[s])
        ax.set_xlabel('Frequency (Hz)')
        ax.set_xlim(1, 30)
        ax.grid(axis='x', visible=False)
    axes[0].set_ylabel('Share of 1–30 Hz power per Hz')
    axes[-1].legend(loc='upper right', fontsize=9, bbox_to_anchor=(1.0, 0.9))
    fig.suptitle("Posterior spectrum, group average: patients have a smaller alpha peak; in Alzheimer's disease it is also slower, with more theta", x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, 'fig1_spectra.png')


def fig_groups(df, out_dir, source='raw'):
    d = df[(df['source'] == source) & (df['variant'] == 'all')]
    rng = np.random.default_rng(1)
    feats = [('theta_alpha', 'Theta / alpha power ratio (log scale)', True), ('apf_cog', 'Alpha centre of gravity (Hz)', False)]
    fig, axes = plt.subplots(len(feats), len(F.SETS), figsize=(11, 6.6), sharey='row')
    for i, (feat, ylab, logy) in enumerate(feats):
        for j, s in enumerate(F.SETS):
            ax = axes[i, j]
            for k, g in enumerate(ORDER):
                v = d[(d['set'] == s) & (d['group'] == g)][feat].dropna().to_numpy()
                ax.scatter(k + rng.uniform(-0.2, 0.2, len(v)), v, s=34, color=COL[g], edgecolor=SURF, linewidth=0.8, alpha=0.9, zorder=3)
                ax.hlines(np.median(v), k - 0.32, k + 0.32, color=INK, lw=2, zorder=4)
            if logy:
                ax.set_yscale('log')
            ax.set_xticks(range(3), [f'{g}' for g in ORDER])
            ax.set_xlim(-0.6, 2.6)
            ax.grid(axis='x', visible=False)
            if i == 0:
                ax.set_title(F.SET_LABEL[s])
            if j == 0:
                ax.set_ylabel(ylab)
    fig.suptitle('Each dot is one person; the bar is the group median', x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.text(0.01, 0.005, "CN = healthy controls, AD = Alzheimer's disease, FTD = frontotemporal dementia", color=INK2, fontsize=9)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    save(fig, out_dir, 'fig2_groups.png')


def fig_auc(res, out_dir, source='raw', task='AD_vs_CN'):
    panels = [('single', 'theta_alpha', 'Theta / alpha ratio alone'), ('single', 'apf_cog', 'Alpha centre of gravity alone'), ('ml', 'logreg', 'ML model, 6 features\n(tested on unseen people)')]
    fig, axes = plt.subplots(1, 3, figsize=(11, 2.9), sharey=True, sharex=True)
    sets = F.SETS[::-1]
    for ax, (kind, key, title) in zip(axes, panels):
        for y, s in enumerate(sets):
            r = res[kind][f'{source}|{s}|{task}|{key}']
            ax.hlines(y, r['auc_lo'], r['auc_hi'], color=COL['CN'], lw=2)
            ax.scatter([r['auc']], [y], s=70, color=COL['CN'], edgecolor=SURF, linewidth=1.2, zorder=3)
            ax.text(1.03, y, f"{r['auc']:.2f}", va='center', ha='left', color=INK, fontsize=10, transform=ax.get_yaxis_transform())
        ax.axvline(0.5, color=MUTED, lw=1, ls=(0, (4, 3)))
        ax.text(0.505, len(sets) - 0.42, 'chance', color=MUTED, fontsize=8.5, va='bottom')
        ax.set_title(title)
        ax.set_xlim(0.4, 1.0)
        ax.set_ylim(-0.6, len(sets) - 0.1)
        ax.set_yticks(range(len(sets)), [F.SET_LABEL[s] for s in sets])
        ax.set_xlabel('AUC with 95 % interval')
        ax.grid(axis='y', visible=False)
    r0 = res['ml'][f'{source}|full19|{task}|logreg']
    fig.suptitle(f"Alzheimer's disease (n = {r0['n_pos']}) vs healthy controls (n = {r0['n_neg']}): separation with 19 channels and with headband-like channels",
                 x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, 'fig3_auc.png')


def fig_precision(df, res, out_dir, source='raw'):
    d = df[(df['source'] == source)]
    fig, axes = plt.subplots(1, len(F.SETS), figsize=(11, 3.9), sharex=True, sharey=True)
    for ax, s in zip(axes, F.SETS):
        w = d[d['set'] == s].pivot(index='sub', columns='variant', values='apf_cog')[['halfA', 'halfB']].dropna()
        g = d.drop_duplicates('sub').set_index('sub')['group'].reindex(w.index)
        for grp in ORDER:
            m = (g == grp).to_numpy()
            ax.scatter(w['halfA'][m], w['halfB'][m], s=34, color=COL[grp], edgecolor=SURF, linewidth=0.8, label=NAME[grp], zorder=3)
        lo, hi = 7.0, 11.4
        ax.plot([lo, hi], [lo, hi], color=MUTED, lw=1, ls=(0, (4, 3)), zorder=1)
        r = res['reliability'][f'{source}|{s}|apf_cog']
        ax.text(0.04, 0.95, f"ICC = {r['split_half_icc']:.3f}\nSD of difference = {r['split_half_sd_diff']:.2f} Hz", transform=ax.transAxes, va='top', color=INK, fontsize=9.5)
        ax.set_title(F.SET_LABEL[s])
        ax.set_xlabel('Odd-numbered epochs (Hz)')
        ax.set_xlim(lo, hi); ax.set_ylim(lo, hi); ax.set_aspect('equal')
    axes[0].set_ylabel('Even-numbered epochs (Hz)')
    axes[-1].legend(loc='lower right', fontsize=8.5)
    fig.suptitle('Alpha centre of gravity measured twice inside one recording (two halves of the clean epochs)', x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    save(fig, out_dir, 'fig4_precision.png')


def fig_mmse(df, res, out_dir, source='raw'):
    d = df[(df['source'] == source) & (df['variant'] == 'all')]
    rng = np.random.default_rng(2)
    fig, axes = plt.subplots(1, len(F.SETS), figsize=(11, 3.7), sharex=True, sharey=True)
    for ax, s in zip(axes, F.SETS):
        t = d[d['set'] == s].dropna(subset=['theta_alpha'])
        for grp in ORDER:
            m = t['group'] == grp
            ax.scatter(t['mmse'][m] + rng.uniform(-0.25, 0.25, m.sum()), t['theta_alpha'][m], s=34, color=COL[grp], edgecolor=SURF, linewidth=0.8, label=NAME[grp], zorder=3)
        r = res['mmse'][f'{source}|{s}|theta_alpha']
        ax.text(0.96, 0.95, f"Spearman ρ = {r['rho_all']:+.2f} (all, n = {r['n_all']})\nρ = {r['rho_patients']:+.2f} (patients only)", transform=ax.transAxes, va='top', ha='right', color=INK, fontsize=9.5)
        ax.set_yscale('log')
        ax.set_title(F.SET_LABEL[s])
        ax.set_xlabel('MMSE score (30 = best)')
    axes[0].set_ylabel('Theta / alpha power ratio (log scale)')
    axes[0].legend(loc='lower left', fontsize=8.5)
    fig.suptitle('Slowing tracks the cognitive score across everyone, but only weakly among patients', x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, 'fig5_mmse.png')


def main():
    out_dir = sys.argv[1]
    df = pd.read_csv(os.path.join(out_dir, 'features.csv'))
    spec = np.load(os.path.join(out_dir, 'spectra.npz'))
    with open(os.path.join(out_dir, 'summary.json'), encoding='utf-8') as f:
        res = json.load(f)
    fig_spectra(df, spec, out_dir)
    fig_groups(df, out_dir)
    fig_auc(res, out_dir)
    fig_precision(df, res, out_dir)
    fig_mmse(df, res, out_dir)
    print('figures written to', out_dir)


if __name__ == '__main__':
    main()
