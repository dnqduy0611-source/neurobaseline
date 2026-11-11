"""Export short headband-style recordings from ds004504 for the app, with the values the app must reproduce.

For one typical participant per group, the clinical recording is re-referenced and resampled to look like what a
consumer headband delivers, and the first three minutes are written as CSV:
  - BrainBit-style: T3, T4, O1, O2 against Fpz, 250 Hz, plain layout with a time column in seconds
  - Muse-style:     TP9, AF7, AF8, TP10 against Fpz, 256 Hz, Mind Monitor-style layout (TimeStamp, RAW_TP9, ...)
The Python pipeline is then run on exactly those signals and its results are saved, so that a JavaScript test can
check that the in-app processing gives the same numbers.

Source data: OpenNeuro ds004504 (CC0), Miltiadous et al. 2023. The CSV files are derived from it.

Usage:  python export_samples.py <dataset_dir> <results_dir> <app_dir>
"""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd
from scipy import signal

import features as F

SECONDS = 180
GROUP_NAME = {'CN': 'healthy control', 'AD': "Alzheimer's disease", 'FTD': 'frontotemporal dementia'}


def headband(data, labels, kind):
    """Derivations a headband would deliver (microvolts), and their names."""
    w, _, _ = F.montage(labels, 'brainbit4' if kind == 'brainbit' else 'muse4')
    x = w @ data
    if kind == 'brainbit':
        return x, ['T3', 'T4', 'O1', 'O2']
    return x[[2, 0, 1, 3]], ['TP9', 'AF7', 'AF8', 'TP10']          # Mind Monitor order


def analyse(x, fs, names):
    """The pipeline of features.py on signals that are already referenced. Posterior channels carry the alpha frequency."""
    filt = F.bandpass(x, fs)
    n = int(round(F.EPOCH_S * fs))
    n_ep = filt.shape[1] // n
    ep = filt[:, :n_ep * n].reshape(filt.shape[0], n_ep, n).transpose(1, 0, 2)
    p2p = ep.max(axis=-1) - ep.min(axis=-1)
    freqs, psd = signal.periodogram(ep, fs=fs, window='hann', detrend='constant', axis=-1)
    keep = freqs <= F.FMAX
    post = [i for i, c in enumerate(names) if c in ('O1', 'O2', 'TP9', 'TP10')]
    f = F.features_for(freqs[keep], psd[..., keep], p2p, post)
    return {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in f.items() if k != 'apf_peak'}


def main():
    dataset_dir, results_dir, app_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    df = pd.read_csv(os.path.join(results_dir, 'features.csv'))
    d = df[(df['source'] == 'raw') & (df['variant'] == 'first3min') & (df['set'] == 'brainbit4')].dropna(subset=['theta_alpha'])
    out_dir = os.path.join(app_dir, 'samples')
    os.makedirs(out_dir, exist_ok=True)
    expected, index = {}, []
    for group in ('CN', 'AD', 'FTD'):
        g = d[d['group'] == group]
        sub = g.iloc[(np.log(g['theta_alpha']) - np.log(g['theta_alpha']).median()).abs().argsort().iloc[0]]['sub']     # the most typical person of the group
        data, sfreq, labels = F.load_set(os.path.join(dataset_dir, sub, 'eeg', sub + '_task-eyesclosed_eeg.set'))
        for kind, fs, up, down in (('brainbit', 250, 1, 2), ('muse', 256, 64, 125)):
            x, names = headband(data, labels, kind)
            x = signal.resample_poly(x, up, down, axis=1)[:, :SECONDS * fs]
            x = np.round(x, 2)
            name = f'{kind}-{group.lower()}.csv'
            t = np.arange(x.shape[1]) / fs
            if kind == 'brainbit':
                table = pd.DataFrame(x.T, columns=names)
                table.insert(0, 'time_s', np.round(t, 4))
            else:
                start = datetime.datetime(2026, 11, 1, 9, 0, 0)
                table = pd.DataFrame(x.T, columns=['RAW_' + c for c in names])
                table.insert(0, 'TimeStamp', [(start + datetime.timedelta(seconds=float(s))).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] for s in t])
            table.to_csv(os.path.join(out_dir, name), index=False)
            expected[name] = {'fs': fs, 'channels': names, 'kind': kind, 'features': analyse(x, fs, names)}
            index.append({'file': name, 'kind': kind, 'fs': fs, 'group': group, 'label': GROUP_NAME[group], 'source': f'ds004504 {sub}'})
            print(name, sub, {k: (round(v, 3) if isinstance(v, float) else v) for k, v in expected[name]['features'].items()})
    with open(os.path.join(app_dir, 'tests', 'eeg-expected.json'), 'w', encoding='utf-8') as f:
        json.dump(expected, f, indent=1)
    with open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'note': 'Derived from OpenNeuro ds004504 (CC0), Miltiadous et al. 2023. Clinical EEG re-referenced to Fpz and resampled to imitate a consumer headband; first 3 minutes.',
                   'samples': index}, f, indent=1)
    # band-pass coefficients for the sampling rates the app accepts (same design as features.bandpass)
    sos = {str(fs): signal.butter(4, [1.0, 40.0], btype='band', fs=fs, output='sos').tolist() for fs in (128, 200, 250, 256, 500, 512)}
    with open(os.path.join(app_dir, 'tests', 'eeg-sos.json'), 'w', encoding='utf-8') as f:
        json.dump(sos, f)
    print('done')


if __name__ == '__main__':
    main()
