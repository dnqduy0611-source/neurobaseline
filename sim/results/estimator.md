# Estimate of a lasting change: a small model on top of the status rule

SIMULATED DATA. Logistic regression fitted on flagged sessions (yellow or red, up to each person's first red light) of 6 simulated cohorts of 10000 people and tested on 4 other cohorts. Truth: the person's ability has really changed at that session. The model has not seen data from real people.

Flagged sessions: 182093 for fitting, 121615 for testing. In the test cohorts 31 % of flagged sessions were a true change and 8 % carried a red light.

## The model

| Input | Coefficient (log-odds per unit) | Odds ratio per unit | Average in flagged sessions |
|---|---|---|---|
| `trend` | +1.374 | 3.95 | 1.18 |
| `zmean` | +0.886 | 2.43 | 0.93 |
| `flag` | -0.746 | 0.47 | 0.13 |
| `sleep` | -0.233 | 0.79 | 0.57 |
| `eeg` | +0.520 | 1.68 | 0.35 |

Log-odds of an average flagged session: -1.216. A missing input counts as the average and contributes nothing.

## How well it separates, in the simulated test cohorts

| | AUC | Brier score |
|---|---|---|
| Model, main scenario | 0.869 | 0.124 |
| Always answering the overall rate | 0.500 | 0.214 |
| Trend statistic of the rule, alone | 0.839 | |
| Light alone (red or yellow) | 0.588 | |
| Model, yellow sessions only | 0.849 | |
| Model, other assumptions (more bad days, noisier tasks, weaker EEG) | 0.840 | 0.140 |

## What the three bands mean

| Band | Share of flagged sessions | Of these, true change | Mean estimate |
|---|---|---|---|
| More likely temporary (below 0.35) | 65 % | 12 % | 11 % |
| Could be either | 14 % | 44 % | 49 % |
| More likely lasting (above 0.65) | 21 % | 84 % | 81 % |

## Calibration (five groups of equal size)

| Mean estimate | True change |
|---|---|
| 3 % | 5 % |
| 8 % | 9 % |
| 18 % | 17 % |
| 45 % | 40 % |
| 82 % | 84 % |

## Assumptions added for sleep and EEG

| Assumption | Value |
|---|---|
| `sleep_mean` | 7.0 |
| `sleep_person_sd` | 0.5 |
| `sleep_night_sd` | 0.7 |
| `p_bad_sleep` | 0.6 |
| `bad_sleep_mean` | 5.0 |
| `p_eeg` | 0.5 |
| `eeg_gain` | 1.0 |
| `eeg_drowsy` | 0.8 |
