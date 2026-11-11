"""NeuroBaseline – figures for the simulation study. Reads results/summary.json. SIMULATED DATA.

Usage:  python make_figures.py <results_dir>
Colour follows the method. Line charts never show more than three methods at once (two facets),
because more line colours than that cannot all be told apart reliably; the full comparison is in the dot plots and tables.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import numpy as np

import simulate as S

COL = {'fixed': '#2a78d6', 'adjusted': '#eb6834', 'rci': '#1baf7a', 'hier': '#eda100', 'trend': '#6250d6'}
EDU_COL = {'low': '#86b6ef', 'mid': '#2a78d6', 'high': '#104281'}                 # ordinal: one hue, light to dark
EDU_NAME = {'low': 'Low education', 'mid': 'Middle', 'high': 'High'}
SHORT = {'fixed': 'Fixed cut-off', 'adjusted': 'Adjusted cut-off', 'rci': 'Personal baseline (RCI)', 'hier': 'Hierarchical model',
         'cusum': 'Hierarchical + CUSUM', 'trend': 'Hierarchical + trend test'}
FACETS = ((['fixed', 'adjusted', 'rci'], 'Cut-offs against a personal baseline'), (['rci', 'hier', 'trend'], 'Three ways of using the personal baseline'))
INK, INK2, MUTED, GRID, SURF, BLUE = '#0b0b0b', '#52514e', '#898781', '#e1e0d9', '#fcfcfb', '#2a78d6'

plt.rcParams.update({
    'figure.facecolor': SURF, 'axes.facecolor': SURF, 'savefig.facecolor': SURF, 'font.size': 10, 'axes.edgecolor': MUTED, 'axes.linewidth': 0.8,
    'axes.labelcolor': INK2, 'xtick.color': MUTED, 'ytick.color': MUTED, 'xtick.labelcolor': INK2, 'ytick.labelcolor': INK2, 'text.color': INK,
    'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6, 'axes.axisbelow': True,
    'axes.titlesize': 11, 'axes.titleweight': 'bold', 'axes.titlelocation': 'left', 'legend.frameon': False,
})


def save(fig, out_dir, name):
    fig.text(0.995, 0.005, 'Simulated data', ha='right', va='bottom', color=MUTED, fontsize=8)
    fig.savefig(os.path.join(out_dir, name), dpi=160, bbox_inches='tight')
    plt.close(fig)


def fig_example(res, out_dir):
    e = res['example']
    lim, last = 1.96 * e['sd'], e['trend_months'][-1]
    fig, (a, b) = plt.subplots(2, 1, figsize=(9.5, 6), sharex=True, gridspec_kw={'height_ratios': [3, 2]})
    a.axhspan(e['baseline'] - lim, e['baseline'] + lim, color='#dbe9fb', zorder=0)
    a.axhline(e['baseline'], color=BLUE, lw=1, ls=(0, (4, 3)))
    a.axhline(e['fixed_cutoff'], color=MUTED, lw=1.2)
    a.scatter(np.linspace(-0.9, -0.1, 5), e['burst'], s=30, color=MUTED, edgecolor=SURF, linewidth=0.8, zorder=3)
    a.plot(e['months'], e['scores'], color=BLUE, lw=2, marker='o', ms=5.5, mec=SURF, mew=0.8, zorder=3)
    a.axvline(e['onset'], color=INK2, lw=1, ls=(0, (2, 2)))
    a.text(e['onset'] + 0.3, a.get_ylim()[1], 'decline starts', va='top', color=INK2, fontsize=9)
    for y, label in ((e['baseline'], 'own baseline'), (e['baseline'] - lim, 'own limit'), (e['fixed_cutoff'], 'fixed cut-off')):
        a.text(last + 0.5, y, label, va='center', color=INK2, fontsize=9)
    a.set_ylabel('Symbol-matching score\n(practice-adjusted, SD units)')
    a.set_title('One simulated person with high education and a slow decline')
    tm = [m for m, v in zip(e['trend_months'], e['trend']) if v is not None]
    tv = [v for v in e['trend'] if v is not None]
    b.plot(tm, tv, color=COL['trend'], lw=2, marker='o', ms=5, mec=SURF, mew=0.8)
    b.axhline(e['trend_threshold'], color=INK2, lw=1.2)
    b.text(last + 0.5, e['trend_threshold'], 'referral\nthreshold', va='center', color=INK2, fontsize=9)
    b.axvline(e['onset'], color=INK2, lw=1, ls=(0, (2, 2)))
    cross = [m for m, v in zip(tm, tv) if v > e['trend_threshold']]
    if cross:
        b.annotate(f'crossed at month {cross[0]}', (cross[0], e['trend_threshold']), xytext=(cross[0] - 12, e['trend_threshold'] - 0.75), color=INK, fontsize=9,
                   arrowprops={'arrowstyle': '-', 'color': MUTED, 'lw': 0.8})
    b.set_ylabel('Trend test statistic\n(all three indicators)')
    b.set_xlabel('Months since enrolment')
    b.set_xlim(-1.5, last + 0.3)
    b.set_xticks(range(0, last + 1, 6))
    fig.tight_layout()
    save(fig, out_dir, 'fig1_example.png')


def dot_panels(res, out_dir, panels, title, name):
    sc = res['scenarios']['base']['methods']
    order = S.METHODS[::-1]
    fig, axes = plt.subplots(1, len(panels), figsize=(12, 3.5), sharey=True)
    for ax, (key, ptitle, is_pct, xmax) in zip(axes, panels):
        for y, m in enumerate(order):
            d = sc[m]['matched'][key]
            v, sd = (100 * d['mean'], 100 * d['sd']) if is_pct else (d['mean'], d['sd'])
            late = not is_pct and (not np.isfinite(v) or v > xmax)
            if not late:
                ax.hlines(y, v - sd, v + sd, color=BLUE, lw=2)
            ax.scatter([xmax * 1.0 if late else v], [y], s=70, color=SURF if late else BLUE, edgecolor=BLUE, linewidth=1.5, zorder=3, clip_on=False)
            ax.text(1.05, y, (f'> {xmax:.0f}' if late else (f'{v:.0f} %' if is_pct else f'{v:.1f}')), va='center', ha='left', color=INK, transform=ax.get_yaxis_transform())
        ax.set_title(ptitle)
        ax.set_yticks(range(len(order)), [SHORT[m] for m in order])
        ax.set_ylim(-0.6, len(order) - 0.4)
        ax.set_xlim(0, xmax)
        ax.grid(axis='y', visible=False)
    fig.suptitle(title, x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, name)


def fig_fairness(res, out_dir):
    sc = res['scenarios']['base']['methods']
    order = S.METHODS[::-1]
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.7), sharey=True)
    for ax, (prefix, title, xmax) in zip(axes, [('false_referral_', 'Stable people wrongly referred', None), ('slow_detected_24m_', 'Slow decline found within 24 months', 100)]):
        for y, m in enumerate(order):
            vals = {e: 100 * sc[m]['matched'][prefix + e]['mean'] for e in EDU_COL}
            ax.hlines(y, min(vals.values()), max(vals.values()), color=GRID, lw=3, zorder=1)
            for e in EDU_COL:
                ax.scatter([vals[e]], [y], s=80, color=EDU_COL[e], edgecolor=SURF, linewidth=1.2, zorder=3, label=EDU_NAME[e] if y == 0 else None)
        if xmax is None:
            ax.axvline(5, color=MUTED, lw=1, ls=(0, (4, 3)))
            ax.text(5.2, len(order) - 0.45, 'overall 5 %', color=MUTED, fontsize=8.5, va='top')
            ax.set_xlim(0, None)
        else:
            ax.set_xlim(0, xmax)
        ax.set_title(title)
        ax.set_xlabel('% of people')
        ax.set_yticks(range(len(order)), [SHORT[m] for m in order])
        ax.set_ylim(-0.6, len(order) - 0.4)
        ax.grid(axis='y', visible=False)
    axes[1].legend(loc='upper right', fontsize=9, handletextpad=0.3)
    fig.suptitle('By education level, with every method tuned to the same overall false-referral rate', x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, 'fig3_fairness.png')


def fig_tradeoff(res, out_dir):
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.1), sharex=True, sharey=True)
    for ax, (methods, title) in zip(axes, FACETS):
        for m in methods:
            pts = np.array(res['curves'][m])
            pts = pts[np.argsort(pts[:, 1])]
            pts = pts[pts[:, 1] <= 0.42]
            ax.plot(100 * pts[:, 1], 100 * pts[:, 2], color=COL[m], lw=2, marker='o', ms=5, mec=SURF, mew=0.8, label=SHORT[m])
        ax.axvline(5, color=MUTED, lw=1, ls=(0, (4, 3)))
        ax.set_title(title)
        ax.set_xlabel('Stable people wrongly referred during follow-up (%)')
        ax.set_xlim(0, 40); ax.set_ylim(0, 100)
        ax.legend(loc='lower right', fontsize=9)
    axes[0].set_ylabel('Slow decline found within 24 months (%)')
    axes[0].text(5.5, 98, 'operating point\nused in the report', color=MUTED, fontsize=8.5, va='top')
    fig.suptitle('Detection against false referrals as each method is made stricter or looser', x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, 'fig4_tradeoff.png')


def fig_time(res, out_dir):
    sc = res['scenarios']['base']['methods']
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.1), sharex=True, sharey=True)
    for ax, (methods, title) in zip(axes, FACETS):
        ends = []
        for m in methods:
            curve = 100 * np.array(sc[m]['matched']['slow_detection_curve'])
            ax.plot(range(len(curve)), curve, color=COL[m], lw=2, label=SHORT[m])
            ends.append(curve[-1])
        ypos = []
        for v in sorted(ends):                                           # keep end labels at least 6 points apart
            ypos.append(v if not ypos else max(v, ypos[-1] + 6))
        for v, y in zip(sorted(ends), ypos):
            ax.text(24.4, y, f'{v:.0f} %', va='center', color=INK, fontsize=9)
        ax.set_title(title)
        ax.set_xlabel('Months since the decline really started')
        ax.set_xlim(0, 24); ax.set_ylim(0, 100)
        ax.set_xticks(range(0, 25, 6))
        ax.legend(loc='upper left', fontsize=9)
    axes[0].set_ylabel('Slow decliners referred so far (%)')
    fig.suptitle('How long it takes to find a slow decline, at a 5 % false-referral rate', x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, 'fig5_time.png')


def fig_scenarios(res, out_dir):
    names = list(res['scenarios'])
    mat = np.array([[100 * res['scenarios'][n]['methods'][m]['matched']['slow_detected_24m']['mean'] for m in S.METHODS] for n in names])
    cmap = LinearSegmentedColormap.from_list('blue', ['#eef4fd', '#86b6ef', '#2a78d6', '#104281'])
    fig, ax = plt.subplots(figsize=(10.5, 4.3))
    ax.imshow(mat, cmap=cmap, vmin=0, vmax=100, aspect='auto')
    for i in range(mat.shape[0]):
        for j in range(mat.shape[1]):
            ax.text(j, i, f'{mat[i, j]:.0f} %', ha='center', va='center', color='#ffffff' if mat[i, j] > 55 else INK, fontsize=10)
    ax.set_xticks(range(len(S.METHODS)), [SHORT[m].replace(' (RCI)', '\n(RCI)').replace(' + ', '\n+ ').replace('Adjusted cut-off', 'Adjusted\ncut-off').replace('Hierarchical model', 'Hierarchical\nmodel') for m in S.METHODS])
    ax.set_yticks(range(len(names)), [res['scenarios'][n]['label'] for n in names])
    ax.xaxis.tick_top()
    ax.grid(False)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_xticks(np.arange(-0.5, len(S.METHODS)), minor=True)
    ax.set_yticks(np.arange(-0.5, len(names)), minor=True)
    ax.grid(which='minor', color=SURF, linewidth=2)
    ax.tick_params(which='both', length=0)
    fig.suptitle('Slow decline found within 24 months, at a 5 % false-referral rate, when the assumptions change', x=0.01, ha='left', fontsize=12, fontweight='bold')
    fig.tight_layout()
    save(fig, out_dir, 'fig6_scenarios.png')


def main():
    out_dir = sys.argv[1]
    with open(os.path.join(out_dir, 'summary.json'), encoding='utf-8') as f:
        res = json.load(f)
    months = res['config']['base_params']['months']
    fig_example(res, out_dir)
    dot_panels(res, out_dir, [('slow_detected_24m', 'Slow decline found\nwithin 24 months', True, 100), ('slow_median_delay', 'Median delay for\nslow decline (months)', False, 24),
                              ('step_detected_6m', 'Sudden drop found\nwithin 6 months', True, 100)],
               f'Every method tuned to the same false-referral rate (5 % of stable people in {months} months)', 'fig2_detection.png')
    fig_fairness(res, out_dir)
    fig_tradeoff(res, out_dir)
    fig_time(res, out_dir)
    fig_scenarios(res, out_dir)
    for old in ('fig5_scenarios.png',):
        if os.path.exists(os.path.join(out_dir, old)):
            os.remove(os.path.join(out_dir, old))
    print('figures written to', out_dir)


if __name__ == '__main__':
    main()
