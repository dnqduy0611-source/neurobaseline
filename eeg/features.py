"""NeuroBaseline – EEG spectral features (Tier 2b prototype).

One deliberately simple pipeline, the same one a headband app could run on a phone:
  band-pass 1-40 Hz -> re-reference -> 4-second epochs -> drop epochs with large or flat signal
  -> Hann periodogram per epoch -> average over the kept epochs -> band powers, theta/alpha ratio, alpha frequency.
No ICA, no manual cleaning.

Referencing matters. The dataset is recorded against the ear electrodes (A1/A2), and every channel carries the same
large slow signal from that reference (inter-channel correlation about 0.9). Any difference between two scalp
electrodes is free of it, so each "device" below is emulated with the reference that device really uses:
  - clinical EEG: common average of the 19 channels;
  - headbands: a forehead reference (Fpz, approximated by the mean of Fp1 and Fp2).
"""
import numpy as np
import scipy.io as sio
from scipy import signal

BANDS = {'delta': (1.0, 4.0), 'theta': (4.0, 8.0), 'alpha': (8.0, 13.0), 'beta': (13.0, 30.0)}
TOTAL = (1.0, 30.0)
APF_WIN = (6.0, 13.0)      # alpha centre of gravity window; fixed before looking at any result
PEAK_WIN = (5.0, 14.0)     # search window for a spectral peak above the 1/f background
EPOCH_S = 4.0              # 0.25 Hz frequency resolution
REJECT_UV = 200.0          # peak-to-peak limit after filtering (the usual +/-100 microvolt criterion)
FLAT_UV = 1.0              # below this the electrode is disconnected
MIN_EPOCHS = 15            # at least 60 s of clean signal
FMAX = 45.0

SETS = ['full19', 'brainbit4', 'muse4']
SET_LABEL = {'full19': 'Clinical EEG, 19 channels', 'brainbit4': 'BrainBit-like, 4 channels', 'muse4': 'Muse-like, 4 channels'}
POSTERIOR19 = ['O1', 'O2', 'P3', 'P4', 'Pz']


def montage(labels, set_name):
    """Return (W, names, posterior_index): W maps the 19 recorded channels to the set's derivations.

    The headband sets are the nearest 10-20 positions to each device's published layout. They are APPROXIMATIONS:
    real headbands use dry electrodes. Both manufacturers state an Fpz reference.
    """
    n = len(labels)

    def e(name):
        v = np.zeros(n)
        v[labels.index(name)] = 1.0
        return v

    fpz = 0.5 * (e('Fp1') + e('Fp2'))
    if set_name == 'full19':
        w = np.eye(n) - 1.0 / n                                    # common average reference
        return w, list(labels), [labels.index(c) for c in POSTERIOR19]
    if set_name == 'brainbit4':                                    # BrainBit: T3, T4, O1, O2
        names = ['T3', 'T4', 'O1', 'O2']
        return np.array([e(c) - fpz for c in names]), names, [2, 3]
    if set_name == 'muse4':                                        # Muse: AF7, AF8, TP9, TP10 (reference Fpz)
        af7, af8 = 0.5 * (e('Fp1') + e('F7')), 0.5 * (e('Fp2') + e('F8'))   # AF7/AF8 lie between Fp and F7/F8
        return np.array([af7 - fpz, af8 - fpz, e('T5') - fpz, e('T6') - fpz]), ['AF7~', 'AF8~', 'TP9~T5', 'TP10~T6'], [2, 3]
    raise ValueError(set_name)


def load_set(path):
    """Read an EEGLAB .set file (MATLAB v5). Returns data in microvolts [channels, samples], sampling rate, labels."""
    m = sio.loadmat(path, squeeze_me=True, struct_as_record=False)
    eeg = m['EEG'] if 'EEG' in m else None
    get = (lambda k: getattr(eeg, k)) if eeg is not None else (lambda k: m[k])
    data = np.asarray(get('data'), dtype=float)
    labels = [str(c.labels) for c in np.atleast_1d(get('chanlocs'))]
    return data, float(get('srate')), labels


def bandpass(data, sfreq):
    sos = signal.butter(4, [1.0, 40.0], btype='band', fs=sfreq, output='sos')
    return signal.sosfiltfilt(sos, data, axis=1)


def set_spectra(filtered, sfreq, labels, set_name):
    """Re-reference for one device and return (freqs, psd[epoch, derivation, freq], peak_to_peak[epoch, derivation], posterior_index)."""
    w, _, post = montage(labels, set_name)
    x = w @ filtered
    n = int(round(EPOCH_S * sfreq))
    n_ep = x.shape[1] // n
    ep = x[:, :n_ep * n].reshape(x.shape[0], n_ep, n).transpose(1, 0, 2)
    p2p = ep.max(axis=-1) - ep.min(axis=-1)
    freqs, psd = signal.periodogram(ep, fs=sfreq, window='hann', detrend='constant', axis=-1)
    keep = freqs <= FMAX
    return freqs[keep], psd[..., keep], p2p, post


def band_power(freqs, p, lo, hi):
    mask = (freqs >= lo) & (freqs < hi)
    return float(p[mask].sum() * (freqs[1] - freqs[0]))


def alpha_cog(freqs, p):
    """Centre of gravity of the spectrum inside APF_WIN (Hz)."""
    mask = (freqs >= APF_WIN[0]) & (freqs <= APF_WIN[1])
    return float((freqs[mask] * p[mask]).sum() / p[mask].sum())


def alpha_peak(freqs, p):
    """Frequency of the largest peak above a fitted 1/f background inside PEAK_WIN, or NaN if there is none."""
    fit = ((freqs >= 2.0) & (freqs <= 4.5)) | ((freqs >= 15.0) & (freqs <= 35.0))
    slope, icpt = np.polyfit(np.log10(freqs[fit]), np.log10(p[fit]), 1)
    win = np.where((freqs >= PEAK_WIN[0]) & (freqs <= PEAK_WIN[1]))[0]
    resid = np.log10(p[win]) - (icpt + slope * np.log10(freqs[win]))
    resid = np.convolve(resid, np.ones(3) / 3.0, mode='same')        # light smoothing, 0.75 Hz
    k = int(np.argmax(resid))
    if k in (0, len(win) - 1) or resid[k] < 0.1:                     # at the edge, or less than ~26 % above background
        return float('nan')
    return float(freqs[win][k])


def good_epochs(p2p):
    return np.all((p2p < REJECT_UV) & (p2p > FLAT_UV), axis=1)


FEATURES = ['rel_delta', 'rel_theta', 'rel_alpha', 'rel_beta', 'theta_alpha', 'slow_ratio', 'apf_cog', 'apf_peak']


def features_for(freqs, psd, p2p, post, select=None, min_epochs=MIN_EPOCHS):
    """Features for one device. `select` is an optional boolean mask over epochs (e.g. the first 3 minutes)."""
    ok = good_epochs(p2p)
    out = {'n_epochs': int(len(ok) if select is None else select.sum())}
    if select is not None:
        ok = ok & select
    out['n_kept'] = int(ok.sum())
    if out['n_kept'] < min_epochs:
        out.update({k: float('nan') for k in FEATURES})
        return out
    pm = psd[ok].mean(axis=(0, 1))                                   # mean spectrum over kept epochs and all derivations
    pp = psd[ok][:, post].mean(axis=(0, 1))                          # alpha is read from the posterior derivations
    total = band_power(freqs, pm, *TOTAL)
    bp = {b: band_power(freqs, pm, *r) for b, r in BANDS.items()}
    out.update({
        'rel_delta': bp['delta'] / total, 'rel_theta': bp['theta'] / total, 'rel_alpha': bp['alpha'] / total, 'rel_beta': bp['beta'] / total,
        'theta_alpha': bp['theta'] / bp['alpha'], 'slow_ratio': (bp['delta'] + bp['theta']) / (bp['alpha'] + bp['beta']),
        'apf_cog': alpha_cog(freqs, pp), 'apf_peak': alpha_peak(freqs, pp),
    })
    return out


def relative_spectrum(freqs, psd, p2p, post):
    """Mean posterior spectrum divided by its 1-30 Hz power (for group-average plots). None if too few clean epochs."""
    ok = good_epochs(p2p)
    if ok.sum() < MIN_EPOCHS:
        return None
    pp = psd[ok][:, post].mean(axis=(0, 1))
    return pp / band_power(freqs, pp, *TOTAL)
