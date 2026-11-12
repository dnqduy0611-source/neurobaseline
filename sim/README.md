# Hierarchical model and simulation study

Two things live here:

1. **`model.py`** – the population-to-individual model that NeuroBaseline uses to judge a session. It is learned from a reference sample and then personalised.
2. **A simulation study** that asks which way of raising a referral finds cognitive decline earlier and more fairly, when every method is held to the same false-referral rate.

Results are in [`REPORT.md`](REPORT.md). Every number there is copied from `results/tables.md` or `results/summary.json`.

> **All data here are simulated.** The simulation shows that the logic does what it should *if the assumptions hold*. It is not evidence of clinical effectiveness.

## Run

```bash
python test_model.py
```

```bash
python run_simulation.py results
```

```bash
python make_figures.py results
```

Requires Python 3 with numpy and matplotlib. The full study takes several minutes on a multi-core machine.

## The model (`model.py`)

For one indicator, oriented so that higher is better:

```
score[person, session] = population prediction (age, education)
                       + practice effect (session number)
                       + person's own level        ~ N(0, sb²)
                       + session noise             ~ N(0, sw²)
```

**Learning.** `fit()` estimates, from a reference sample of people followed for a year, the age and education effects, the practice curve, the between-person SD `sb` and the within-person SD `sw` (method of moments for a random-intercept model).

**Personalising.** For a new person with `n` practice-adjusted sessions of mean `ybar`:

```
baseline = w × ybar + (1 − w) × population prediction        w = n / (n + k),   k = sw² / sb²
expected range of the next session = baseline ± z × sw × √(1 + 1/(n + k))
```

- With `n = 0` this is a comparison with people of the same age and education.
- As `n` grows it becomes a comparison with the person's own history.
- The personal Reliable Change Index used in the app today is the special case `k = 0`.
- `sw` is itself personalised: the population value is blended with the person's own variability.

**Trend test** (`simulate.trend_statistic`). Single sessions are noisy, so a slow decline is easier to see in the whole history than in any one session. For a candidate starting month τ, each indicator is modelled as

```
score = level + slope × max(0, month − τ)
```

- Level and slope are estimated **together** from all sessions so far, so an error in the baseline is not mistaken for a decline.
- The population prediction enters as a prior on the level, worth `k` sessions. This is where the hierarchical model comes in.
- The statistic is −slope / SE(slope), summed over the three indicators and divided by √3, then maximised over τ.
- A single wild session is capped at 3 SD, and sessions reported as a bad day are left out.

A referral is raised when the statistic passes a threshold.

## The six methods compared

| Method | A session counts against the person when… | Referral when… |
|---|---|---|
| Fixed cut-off | the score is more than *c* SD below the mean of the reference sample | confirmed on the repeat session, or two indicators at once |
| Age/education-adjusted cut-off | the same, against norms adjusted for age and education | same |
| Personal baseline (RCI) | the score is more than *z* SDs of change below the mean of the person's sessions 2–5 | same |
| Hierarchical model | the practice-adjusted score is more than *z* below the shrunken baseline from sessions 1–5 | same |
| Hierarchical model + CUSUM | – | the running sum of (residual − 0.5) passes *h* |
| Hierarchical model + trend test | – | the trend statistic passes *h* |

The first four use exactly the rule the app uses today for its yellow and red lights. A yellow light brings the next session forward to two weeks. The trend test uses the plain monthly schedule.

## The simulated people (`simulate.py`)

Three indicators (speed, symbol matching, memory), in units of the between-person SD. Main-scenario assumptions:

| Assumption | Value |
|---|---|
| Age | 50–80, uniform; −0.03 SD per year |
| Education | low 30 %, middle 40 %, high 30 %; gap between adjacent levels 0.2 / 0.5 / 0.4 SD |
| Test–retest reliability | 0.70 / 0.85 / 0.60, with person-to-person differences in noise |
| Practice effect | total gain 0.3 / 0.5 / 0.3 SD, most of it in the first three sessions, differing between people |
| Bad days | 8 % of sessions, one within-person SD lower; reported by the person half of the time |
| Skipped sessions | 10 % |
| Stable people | 80 % |
| Slow decline | 15 %; starts between month 3 and 12; 0.5 SD per year on memory, 0.4 on symbol matching, 0.25 on speed |
| Sudden drop | 5 %; 1.0 / 0.8 / 0.5 SD |
| Follow-up | 5 burst sessions, then monthly for 36 months |

These values are assumptions chosen to be plausible, not measurements. `run_simulation.py` repeats the study with six of them changed.

## Design of the study (`run_simulation.py`)

1. Draw a reference sample of 2000 stable people and fit the model to it. The cut-off norms come from the same sample.
2. Draw a separate cohort of 10 000 people to follow.
3. For each method, find the threshold at which **5 % of stable people are referred during the 36 months**. The same random numbers are used for every method.
4. At that threshold, measure: slow decline found within 12, 18 and 24 months of its true onset, the median delay, sudden drops found within 3 and 6 months, and false referrals and detection by education level.
5. Repeat on 8 independent cohorts for the main scenario and 4 for each sensitivity scenario; report the mean.

Results at customary thresholds (cut-off 1.5 SD, z = 1.96, CUSUM h = 4, trend test 3.0) are also reported for the main scenario.

## The rule built into the app (`run_app_rule.py`)

`simulate.run_app_rule` reproduces the app's light logic exactly: personal baseline from sessions 2–5, no population norms and no practice correction, yellow beyond z = 1.96, red beyond z = 3.0 on two sessions in a row or on two indicators at once, and the trend test with limits 3.0 and 3.5. `run_app_rule.py` compares it with the app's earlier rule on 8 cohorts and writes `results/app_rule.md`.

```bash
python run_app_rule.py results
```

## Kalman filter and adaptive baselines (`kalman.py`, `run_kalman.py`, `stress_kalman.py`)

A local-linear-trend Kalman filter (level and slope per indicator, slope noise chosen on a separate tuning cohort) and single-session rules against baselines that keep adapting, compared with the trend test on the same cohorts. `stress_kalman.py` applies thresholds set under independent noise to noise that is correlated from month to month. Results: `REPORT.md` section 8. Each script takes well under a minute.

```bash
python run_kalman.py results
```

```bash
python stress_kalman.py results
```

## Tests (`test_model.py`)

Twelve checks (the last two cover `kalman.py`): the fit recovers the parameters that generated the data; the shrinkage weight behaves at its limits; the RCI is the `k = 0` case; the CUSUM ignores ordinary sessions and caps a single wild one; the trend test separates decliners and is less misled by a wrong baseline than the CUSUM; stricter thresholds refer fewer people; calibration reaches the 5 % target for every method.
