"""NeuroBaseline – figures for the NHANES analysis. Reads results/summary.json.

Usage:  python make_figures.py <results_dir>
"""
import json
import os
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

EDU = {'1': 'Less than 9th grade', '2': '9th–11th grade', '3': 'High school or GED', '4': 'Some college', '5': 'College graduate'}
INK, INK2, MUTED, GRID, SURF, BLUE, ORANGE = '#0b0b0b', '#52514e', '#898781', '#e1e0d9', '#fcfcfb', '#2a78d6', '#eb6834'
AGE_COL = {'60–69': '#86b6ef', '70–79': '#2a78d6', '80+': '#104281'}                 # ordinal: one hue, light to dark

plt.rcParams.update({
    'figure.facecolor': SURF, 'axes.facecolor': SURF, 'savefig.facecolor': SURF, 'font.size': 10, 'axes.edgecolor': MUTED, 'axes.linewidth': 0.8,
    'axes.labelcolor': INK2, 'xtick.color': MUTED, 'ytick.color': MUTED, 'xtick.labelcolor': INK2, 'ytick.labelcolor': INK2, 'text.color': INK,
    'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6, 'axes.axisbelow': True,
    'axes.titlesize': 11, 'axes.titleweight': 'bold', 'axes.titlelocation': 'left', 'legend.frameon': False,
})
ORDER = ['5', '4', '3', '2', '1']                                                    # drawn bottom to top: least schooling at the top


def save(fig, out_dir, name):
    fig.text(0.995, -0.04, 'NHANES 2011–2014, adults aged 60 and over', ha='right', va='top', color=MUTED, fontsize=8)
    fig.savefig(os.path.join(out_dir, name), dpi=160, bbox_inches='tight')
    plt.close(fig)


def yaxis(ax):
    ax.set_yticks(range(len(ORDER)), [EDU[e] for e in ORDER])
    ax.set_ylim(-0.6, len(ORDER) - 0.4)
    ax.grid(axis='y', visible=False)


def fig_scores(res, out_dir):
    fig, ax = plt.subplots(figsize=(9, 3.6))
    for y, e in enumerate(ORDER):
        s = res['score'][e]
        ax.hlines(y, s['q5'], s['q95'], color=BLUE, lw=1.5)
        ax.hlines(y, s['q25'], s['q75'], color=BLUE, lw=7, alpha=0.45)
        ax.scatter([s['q50']], [y], s=70, color=BLUE, edgecolor=SURF, linewidth=1.2, zorder=3)
        ax.text(s['q95'] + 1.5, y, f"median {s['q50']:.0f}", va='center', color=INK, fontsize=9)
    for cut, label in ((res['five_percent']['cutoff'], 'flags 5 % with no\nmemory complaint'), (res['cutoffs']['lowest_quartile'], 'lowest quartile\nof everyone')):
        ax.axvline(cut, color=INK2, lw=1, ls=(0, (4, 3)))
        ax.text(cut, len(ORDER) - 0.35, label, ha='center', va='bottom', color=INK2, fontsize=8.5)
    yaxis(ax)
    ax.set_xlim(0, 100)
    ax.set_xlabel('Digit Symbol Substitution Test score (thick bar: middle half; thin line: 5th to 95th percentile)')
    fig.suptitle('The same test, very different scores by schooling', x=0.01, y=1.08, ha='left', fontsize=12, fontweight='bold')
    save(fig, out_dir, 'fig1_scores.png')


def fig_five(res, out_dir):
    f5 = res['five_percent']
    fig, ax = plt.subplots(figsize=(9, 3.6))
    for y, e in enumerate(ORDER):
        for key, col, dy in (('fixed', BLUE, 0.14), ('adjusted', ORANGE, -0.14)):
            r = f5[key][e]
            ax.hlines(y + dy, 100 * r['lo'], 100 * r['hi'], color=col, lw=2)
            ax.scatter([100 * r['est']], [y + dy], s=64, color=col, edgecolor=SURF, linewidth=1.2, zorder=3, label={'fixed': 'One cut-off for everyone', 'adjusted': 'Norms adjusted for age, sex and education'}[key] if y == 0 else None)
            ax.text(100 * r['hi'] + 0.8, y + dy, f"{100 * r['est']:.1f} %", va='center', color=INK, fontsize=9)
    ax.axvline(5, color=MUTED, lw=1, ls=(0, (4, 3)))
    ax.text(5.4, len(ORDER) - 0.45, 'overall 5 %', color=MUTED, fontsize=8.5, va='top')
    yaxis(ax)
    ax.set_xlim(0, 55)
    ax.set_xlabel('Share flagged, among people who report no worsening of memory (%)')
    ax.legend(loc='lower right', fontsize=9)
    fig.suptitle('A cut-off that flags 5 % overall flags 40 % of the least schooled' if f5['fixed']['1']['est'] > 0.35 else 'Share flagged by education', x=0.01, y=1.0, ha='left', fontsize=12, fontweight='bold')
    save(fig, out_dir, 'fig2_five_percent.png')


def fig_age(res, out_dir):
    b = res['below']['lowest_quartile']
    fig, ax = plt.subplots(figsize=(9, 3.6))
    for y, e in enumerate(ORDER):
        vals = {band: 100 * b['no_complaint_age_' + band][e]['est'] for band in AGE_COL}
        ax.hlines(y, min(vals.values()), max(vals.values()), color=GRID, lw=3, zorder=1)
        for band, col in AGE_COL.items():
            ax.scatter([vals[band]], [y], s=80, color=col, edgecolor=SURF, linewidth=1.2, zorder=3, label='Aged ' + band if y == 0 else None)
    yaxis(ax)
    ax.set_xlim(0, 100)
    ax.set_xlabel(f"Share scoring below {res['cutoffs']['lowest_quartile']:.0f}, among people who report no worsening of memory (%)")
    ax.legend(loc='lower right', fontsize=9, handletextpad=0.3)
    fig.suptitle('At every age, schooling decides who falls below the usual "low performance" cut-off', x=0.01, y=1.0, ha='left', fontsize=12, fontweight='bold')
    save(fig, out_dir, 'fig3_by_age.png')


def main():
    out_dir = sys.argv[1]
    with open(os.path.join(out_dir, 'summary.json'), encoding='utf-8') as f:
        res = json.load(f)
    fig_scores(res, out_dir)
    fig_five(res, out_dir)
    fig_age(res, out_dir)
    print('figures written to', out_dir)


if __name__ == '__main__':
    main()
