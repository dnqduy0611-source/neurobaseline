# EEG analysis (Tier 2b groundwork)

Python scripts that test, on public data, the two claims the EEG headband layer of NeuroBaseline rests on:

1. simple resting-state spectral features separate people with dementia from healthy controls;
2. most of that separation survives when only the channels of a consumer headband are used.

Results and their interpretation are in [`REPORT.md`](REPORT.md). All numbers there are copied from `results/tables.md` and `results/summary.json`, which the scripts write.

## Data

OpenNeuro **ds004504** v1.0.9, licence CC0. Miltiadous et al. (2023), *Data* 8(6):95, doi:10.3390/data8060095.
88 people recorded at rest with eyes closed on a 19-channel clinical EEG (500 Hz): 36 with Alzheimer's disease, 23 with frontotemporal dementia, 29 healthy controls. Both the raw recordings and the authors' cleaned derivatives are used. The data are not in this repository.

## Run

```bash
python download_data.py ../data/ds004504 all
```

```bash
python run_analysis.py ../data/ds004504 results --recompute
```

```bash
python make_figures.py results
```

```bash
python export_samples.py ../data/ds004504 results ../app
```

The last command writes the six sample recordings used by the app (`app/samples/`) and the values the app's EEG tests must reproduce (`app/tests/eeg-expected.json`).

Requires Python 3 with numpy, scipy, pandas, scikit-learn and matplotlib. The download is 5.8 GB (2.8 GB for `raw` only).

## Pipeline (`features.py`)

The same steps a headband app could run on a phone. No ICA and no manual cleaning.

1. Band-pass 1–40 Hz (4th-order Butterworth, zero phase).
2. Re-reference for the device being emulated (see below).
3. Cut into 4-second epochs (0.25 Hz resolution).
4. Drop an epoch if any derivation exceeds 200 µV peak to peak, or is flat (under 1 µV).
5. Hann-windowed periodogram per epoch, averaged over the kept epochs.
6. Features: relative power in delta (1–4 Hz), theta (4–8), alpha (8–13) and beta (13–30); theta/alpha ratio; alpha centre of gravity (6–13 Hz, posterior derivations); alpha peak above a fitted 1/f background.

A recording needs at least 15 clean epochs (60 s) to be used.

### Emulated devices

The dataset is referenced to the ear electrodes, and every channel carries the same large slow signal from that reference (inter-channel correlation about 0.9). A difference between two scalp electrodes is free of it, so each device is emulated with the reference it really uses.

| Set | Derivations | Reference |
|---|---|---|
| Clinical EEG, 19 channels | all 19 | common average |
| BrainBit-like, 4 channels | T3, T4, O1, O2 | Fpz, approximated by the mean of Fp1 and Fp2 |
| Muse-like, 4 channels | AF7 ≈ mean(Fp1, F7), AF8 ≈ mean(Fp2, F8), TP9 ≈ T5, TP10 ≈ T6 | Fpz, approximated by the mean of Fp1 and Fp2 |

Both manufacturers state an Fpz reference for these devices. The sets are approximations of electrode position only. Real headbands use dry electrodes and are noisier.

## Analyses (`run_analysis.py`)

| Question | Method |
|---|---|
| Do single features separate the groups? | AUC with a stratified bootstrap 95 % interval (2000 resamples), Mann–Whitney test, Cohen's d. The expected direction of each feature was fixed in advance. |
| How much is kept with headband channels? | The same, per emulated device. |
| Does a small ML model help? | Logistic regression (and a random forest as a check) on 6 features, one row per person, **leave-one-subject-out**: every person is scored by a model trained only on other people. Label-permutation test (200 permutations) for the main comparison. |
| Is one short recording precise enough? | Split-half reliability inside a recording (odd vs even clean epochs, ICC(2,1)); first 3 minutes vs the full recording. |
| Does simple cleaning distort the picture? | Per-person agreement between the raw recordings and the authors' ICA-cleaned derivatives. |

The two primary features (theta/alpha ratio and alpha centre of gravity), the frequency windows, the rejection limit and the model were chosen before any result was computed. One change was made after inspecting the signal and before any group comparison: the reference scheme above replaced a naive channel selection, because of the common reference signal.
