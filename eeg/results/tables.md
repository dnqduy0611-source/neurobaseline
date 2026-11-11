## Data: raw recordings, simple cleaning

### Signal quality

| Channel set | Usable subjects | Median share of epochs kept | Lowest |
|---|---|---|---|
| Clinical EEG, 19 channels | 88 of 88 | 96% | 51% |
| BrainBit-like, 4 channels | 88 of 88 | 96% | 61% |
| Muse-like, 4 channels | 88 of 88 | 96% | 74% |

### AD vs CN: AUC (95 % bootstrap interval)

| Channel set | θ/α ratio | Alpha centre of gravity | ML model (LOSO) | Sens. | Spec. |
|---|---|---|---|---|---|
| Clinical EEG, 19 channels | 0.87 (0.78–0.95) | 0.80 (0.68–0.90) | 0.84 (0.73–0.93) | 72% | 79% |
| BrainBit-like, 4 channels | 0.88 (0.78–0.96) | 0.80 (0.68–0.91) | 0.84 (0.73–0.92) | 72% | 76% |
| Muse-like, 4 channels | 0.87 (0.78–0.95) | 0.82 (0.70–0.92) | 0.83 (0.72–0.92) | 72% | 69% |

### FTD vs CN: AUC (95 % bootstrap interval)

| Channel set | θ/α ratio | Alpha centre of gravity | ML model (LOSO) | Sens. | Spec. |
|---|---|---|---|---|---|
| Clinical EEG, 19 channels | 0.82 (0.70–0.92) | 0.62 (0.46–0.77) | 0.79 (0.65–0.90) | 57% | 83% |
| BrainBit-like, 4 channels | 0.83 (0.70–0.94) | 0.67 (0.50–0.81) | 0.82 (0.69–0.93) | 65% | 79% |
| Muse-like, 4 channels | 0.83 (0.70–0.93) | 0.65 (0.51–0.80) | 0.78 (0.64–0.90) | 52% | 83% |

### dementia vs CN: AUC (95 % bootstrap interval)

| Channel set | θ/α ratio | Alpha centre of gravity | ML model (LOSO) | Sens. | Spec. |
|---|---|---|---|---|---|
| Clinical EEG, 19 channels | 0.85 (0.76–0.93) | 0.73 (0.61–0.83) | 0.83 (0.74–0.90) | 83% | 55% |
| BrainBit-like, 4 channels | 0.86 (0.78–0.93) | 0.75 (0.65–0.85) | 0.84 (0.75–0.92) | 86% | 66% |
| Muse-like, 4 channels | 0.85 (0.77–0.92) | 0.75 (0.65–0.84) | 0.82 (0.73–0.90) | 88% | 52% |

### Precision of one recording

| Channel set | Feature | Split-half ICC | SD of half-to-half difference | Between-person SD | 3 min vs full: ICC | 3 min vs full: median abs. difference |
|---|---|---|---|---|---|---|
| Clinical EEG, 19 channels | Alpha centre of gravity (Hz) | 0.997 | 0.060 | 0.834 | 0.975 | 0.100 |
| Clinical EEG, 19 channels | log θ/α | 0.997 | 0.089 | 1.191 | 0.963 | 0.156 |
| BrainBit-like, 4 channels | Alpha centre of gravity (Hz) | 0.995 | 0.078 | 0.815 | 0.967 | 0.111 |
| BrainBit-like, 4 channels | log θ/α | 0.995 | 0.131 | 1.280 | 0.944 | 0.202 |
| Muse-like, 4 channels | Alpha centre of gravity (Hz) | 0.997 | 0.066 | 0.815 | 0.970 | 0.093 |
| Muse-like, 4 channels | log θ/α | 0.996 | 0.117 | 1.271 | 0.948 | 0.190 |

### Relation to MMSE (Spearman ρ)

| Channel set | Feature | All subjects | Patients only |
|---|---|---|---|
| Clinical EEG, 19 channels | θ/α ratio | -0.54 (p = 4.92e-08, n = 88) | -0.21 (p = 0.111, n = 59) |
| Clinical EEG, 19 channels | Alpha centre of gravity | +0.39 (p = 0.000182, n = 88) | +0.19 (p = 0.161, n = 59) |
| BrainBit-like, 4 channels | θ/α ratio | -0.55 (p = 3.86e-08, n = 88) | -0.19 (p = 0.142, n = 59) |
| BrainBit-like, 4 channels | Alpha centre of gravity | +0.42 (p = 3.75e-05, n = 88) | +0.21 (p = 0.119, n = 59) |
| Muse-like, 4 channels | θ/α ratio | -0.56 (p = 1.57e-08, n = 88) | -0.24 (p = 0.0638, n = 59) |
| Muse-like, 4 channels | Alpha centre of gravity | +0.43 (p = 3.42e-05, n = 88) | +0.19 (p = 0.14, n = 59) |

## Data: authors’ ICA-cleaned derivatives

### Signal quality

| Channel set | Usable subjects | Median share of epochs kept | Lowest |
|---|---|---|---|
| Clinical EEG, 19 channels | 88 of 88 | 99% | 32% |
| BrainBit-like, 4 channels | 88 of 88 | 100% | 55% |
| Muse-like, 4 channels | 88 of 88 | 100% | 65% |

### AD vs CN: AUC (95 % bootstrap interval)

| Channel set | θ/α ratio | Alpha centre of gravity | ML model (LOSO) | Sens. | Spec. |
|---|---|---|---|---|---|
| Clinical EEG, 19 channels | 0.88 (0.79–0.96) | 0.80 (0.68–0.90) | 0.86 (0.75–0.94) | 78% | 79% |
| BrainBit-like, 4 channels | 0.89 (0.79–0.96) | 0.80 (0.68–0.90) | 0.86 (0.76–0.95) | 72% | 79% |
| Muse-like, 4 channels | 0.88 (0.80–0.96) | 0.81 (0.69–0.91) | 0.85 (0.75–0.94) | 72% | 79% |

### FTD vs CN: AUC (95 % bootstrap interval)

| Channel set | θ/α ratio | Alpha centre of gravity | ML model (LOSO) | Sens. | Spec. |
|---|---|---|---|---|---|
| Clinical EEG, 19 channels | 0.83 (0.71–0.93) | 0.60 (0.44–0.75) | 0.78 (0.63–0.90) | 57% | 76% |
| BrainBit-like, 4 channels | 0.85 (0.73–0.95) | 0.61 (0.45–0.76) | 0.80 (0.66–0.91) | 70% | 83% |
| Muse-like, 4 channels | 0.84 (0.71–0.94) | 0.60 (0.43–0.75) | 0.77 (0.63–0.89) | 57% | 79% |

### dementia vs CN: AUC (95 % bootstrap interval)

| Channel set | θ/α ratio | Alpha centre of gravity | ML model (LOSO) | Sens. | Spec. |
|---|---|---|---|---|---|
| Clinical EEG, 19 channels | 0.86 (0.79–0.93) | 0.72 (0.61–0.82) | 0.84 (0.75–0.91) | 81% | 62% |
| BrainBit-like, 4 channels | 0.87 (0.79–0.94) | 0.73 (0.62–0.83) | 0.85 (0.76–0.92) | 83% | 62% |
| Muse-like, 4 channels | 0.87 (0.79–0.93) | 0.73 (0.62–0.82) | 0.83 (0.75–0.91) | 86% | 62% |

### Precision of one recording

| Channel set | Feature | Split-half ICC | SD of half-to-half difference | Between-person SD | 3 min vs full: ICC | 3 min vs full: median abs. difference |
|---|---|---|---|---|---|---|
| Clinical EEG, 19 channels | Alpha centre of gravity (Hz) | 0.997 | 0.067 | 0.836 | 0.977 | 0.082 |
| Clinical EEG, 19 channels | log θ/α | 0.997 | 0.087 | 1.192 | 0.972 | 0.139 |
| BrainBit-like, 4 channels | Alpha centre of gravity (Hz) | 0.996 | 0.071 | 0.802 | 0.969 | 0.098 |
| BrainBit-like, 4 channels | log θ/α | 0.998 | 0.089 | 1.283 | 0.970 | 0.163 |
| Muse-like, 4 channels | Alpha centre of gravity (Hz) | 0.998 | 0.050 | 0.808 | 0.980 | 0.080 |
| Muse-like, 4 channels | log θ/α | 0.998 | 0.088 | 1.278 | 0.973 | 0.165 |

### Relation to MMSE (Spearman ρ)

| Channel set | Feature | All subjects | Patients only |
|---|---|---|---|
| Clinical EEG, 19 channels | θ/α ratio | -0.55 (p = 2.85e-08, n = 88) | -0.20 (p = 0.139, n = 59) |
| Clinical EEG, 19 channels | Alpha centre of gravity | +0.38 (p = 0.000286, n = 88) | +0.17 (p = 0.198, n = 59) |
| BrainBit-like, 4 channels | θ/α ratio | -0.56 (p = 1.23e-08, n = 88) | -0.20 (p = 0.129, n = 59) |
| BrainBit-like, 4 channels | Alpha centre of gravity | +0.37 (p = 0.00036, n = 88) | +0.15 (p = 0.25, n = 59) |
| Muse-like, 4 channels | θ/α ratio | -0.57 (p = 7.03e-09, n = 88) | -0.23 (p = 0.0839, n = 59) |
| Muse-like, 4 channels | Alpha centre of gravity | +0.38 (p = 0.000244, n = 88) | +0.16 (p = 0.229, n = 59) |

## Simple cleaning vs ICA-cleaned data, same person

| Channel set | Feature | Pearson r | ICC | Median abs. difference |
|---|---|---|---|---|
| Clinical EEG, 19 channels | Alpha centre of gravity (Hz) | 0.996 | 0.996 | 0.017 |
| Clinical EEG, 19 channels | log θ/α | 0.992 | 0.987 | 0.098 |
| BrainBit-like, 4 channels | Alpha centre of gravity (Hz) | 0.972 | 0.968 | 0.053 |
| BrainBit-like, 4 channels | log θ/α | 0.970 | 0.948 | 0.227 |
| Muse-like, 4 channels | Alpha centre of gravity (Hz) | 0.976 | 0.971 | 0.059 |
| Muse-like, 4 channels | log θ/α | 0.973 | 0.951 | 0.222 |
