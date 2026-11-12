# NeuroBaseline

**Protecting brain health earlier by comparing each person with themselves.**
Research prototype for the Future Health Digital Innovation Challenge, Challenge 08 (*Protecting Brain Health Earlier*).

> NeuroBaseline is a screening and monitoring tool. It is **not a diagnosis** and **not a medical device**.

**Try it:** https://dnqduy0611-source.github.io/neurobaseline/ (example profile, participant app, clinician view).

**Start here:** [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md) is the technical documentation for the challenge, with the assumptions, dependencies and limitations. This README is the developer's guide to the app.

## What is in this repository

| Path | What it is |
|---|---|
| `index.html` | Landing page of the hosted prototype: links to the example profile, the participant app, the clinician view and the documents. |
| `docs/TECHNICAL_DOCUMENTATION.md` | Technical documentation: solution, methods, evidence, responsible AI, data sources, assumptions, dependencies, limitations, path to pilot. |
| `app/` | The Tier 1 web app: four short cognitive tasks on a phone, a personal baseline, a Reliable Change Index and a status light. No build step, no server, no dependencies. |
| `app/tests/stats.test.js` | Unit tests for the statistics, the device check and baseline periods (26 tests). |
| `app/tests/risk.test.js` | Unit tests for the risk profile (11 tests). |
| `app/clinician.html` | The clinician view: priority list, per-participant summary, checklist of reversible contributors, review record. |
| `app/tests/clin.test.js` | Unit tests for the clinician view logic and the simulated cohort (10 tests). |
| `app/tests/backup.test.js` | Unit tests for the check a backup file passes before it is restored (6 tests). |
| `app/tests/eeg.test.js` | Unit tests for the in-app EEG processing, checked against the Python pipeline (8 tests). |
| `app/samples/` | Six short headband-style EEG recordings derived from OpenNeuro ds004504 (CC0), 12 MB. |
| `eeg/` | Python analysis of public EEG data (OpenNeuro ds004504): do simple spectral features separate dementia from healthy controls, and do headband-position channels keep that? See [`eeg/REPORT.md`](eeg/REPORT.md). |
| `sim/` | The hierarchical (population → individual) model, a trend test, a simulation study comparing six ways of raising a referral at the same false-referral rate, and a comparison with a Kalman filter and with baselines that keep adapting. Simulated data. See [`sim/REPORT.md`](sim/REPORT.md). |
| `nhanes/` | Real-data check on NHANES 2011–2014: how a single cut-off on a symbol–digit test treats people with different schooling. See [`nhanes/REPORT.md`](nhanes/REPORT.md). |

## Run it

The app is static files. Serve the `app/` folder with any web server and open `index.html` on a phone or a desktop browser.

```bash
cd app
python -m http.server 8080
```

Then open `http://localhost:8080/`.

Run the unit tests:

```bash
cd app
node tests/stats.test.js
node tests/risk.test.js
node tests/clin.test.js
node tests/eeg.test.js
node tests/backup.test.js
```

## How a session works (about 5 minutes)

1. **Safety check.** Four red-flag questions (sudden one-sided weakness, speech trouble, new severe headache, acute confusion). Any "yes" stops the session and tells the person to get urgent care.
2. **Today's context.** Sleep, illness, mood, medicine change. A session done on an unusual day is flagged.
3. **Five parts:**

| Part | Task | Main measure |
|---|---|---|
| 1 | Picture memory, study phase: 8 pictures | – |
| 2 | Simple reaction time: 20 trials, random 1–3 s foreperiod | median RT (ms) |
| 3 | Go/NoGo: 48 trials, 25 % NoGo | commission errors (%) |
| 4 | Symbol–digit matching: 90 s | number correct |
| 5 | Picture memory, delayed recognition: 16 pictures (8 old, 8 new from the same categories) | hits − false alarms |

The symbol key and the picture set change every session (seeded alternate forms). Tasks use shapes, colours, symbols and pictures, not words, to reduce the effect of language and education.

## Schedule: measurement burst, then monthly

- Sessions 1–5 are done in the first two weeks, 2–3 days apart.
- Session 1 is a warm-up (practice effects are largest there) and is never scored.
- Sessions 2–5 form the **personal baseline** (n = 4). A session flagged for context is not used and is replaced by the next one.
- After that: one session a month. After a yellow light: repeat in 14 days.

## Statistics

For every indicator and every follow-up session:

```
RCI    = worse × (x − baseline_mean) / S_diff
S_diff = σ_w × √(1 + 1/n)          n = number of baseline sessions
limit  = baseline_mean ± 1.96 × S_diff
```

`σ_w` is the within-person standard deviation between sessions. It starts from a prior and moves toward the person's own variability as stable sessions accumulate:

```
σ_w² = (ν0 × prior² + (m − 1) × s²) / (ν0 + m − 1)     ν0 = 6, m = stable sessions, s² = their variance
```

**Trend test.** A slow decline is easier to see in the whole history than in one noisy session. For a candidate starting time τ, each primary indicator is modelled as `level + slope × max(0, t − τ)`, with level and slope estimated together from all sessions, so that an error in the baseline is not read as a decline:

```
t_k   = worse × (Σ r·y − Σr·Σy / W) / (σ_w × √(Σ r² − (Σr)² / W))        r = max(0, t − τ), W = number of sessions
trend = max over τ of  Σ_k t_k / √(number of indicators)
```

Scores are capped at 3 σ_w from the baseline, and sessions flagged for context are left out.

Status light for a follow-up session:

| Light | Rule |
|---|---|
| Green | No primary indicator beyond z = 1.96, and trend below 3.0. |
| Yellow | Any primary indicator beyond z = 1.96, **or** trend at 3.0 or more. Repeat in 14 days. |
| Red | The same primary indicator beyond z = 3.0 on two sessions in a row, **or** two primary indicators beyond z = 3.0 in one session (not on a flagged day), **or** trend at 3.5 or more. Clinical review advised. |

The limits (z = 3.0 for red, trend 3.0 and 3.5) were chosen in the simulation study so that few stable people are referred (5.8 % over three years in the simulation); see [`sim/REPORT.md`](sim/REPORT.md). They are assumptions until checked on real data.

Primary indicators: reaction time, symbol matching, picture memory. Go/NoGo commission errors are shown but never change the light on their own, because the evidence for Go/NoGo in early decline is weaker. Improvement never raises an alert. Every yellow or red light lists the reason in plain words: the indicator, the value, the person's usual level and the limit, or the areas that carry the trend.

## Tier 2a: risk profile (optional)

A separate, separately consented questionnaire of about 3 minutes (five short steps, any question may be left blank). It uses two published frameworks and no home-made formula.

**1. The 14 potentially modifiable risk factors of the 2024 Lancet Commission** (Livingston et al., *Lancet* 2024;404:572–628). Each factor is shown as present, managed, absent or not answered. Every present factor comes with one plain-language action taken from the Commission's recommendations, to be discussed with a doctor.

| Factor | How the app decides it is present |
|---|---|
| Less education | Profile: primary school or less |
| Hearing loss | Trouble hearing without hearing aids (with aids: "managed") |
| High LDL cholesterol | Told by a doctor |
| Depression | PHQ-2 score of 3 or more (a screen, not a diagnosis) |
| Traumatic brain injury | Head injury with loss of consciousness or hospital care |
| Physical inactivity | Less than 2.5 hours of moderate activity a week |
| Diabetes, hypertension | Told by a doctor |
| Smoking | Current smoker |
| Obesity | BMI of 30 or more, from height and weight |
| Excessive alcohol | More than 12 drinks a week (the Commission's >21 UK units) |
| Social isolation | Contact with family or friends less than weekly |
| Untreated vision loss | Trouble seeing even with glasses |
| Air pollution | Not asked (depends on where the person lives) |

**2. The LIBRA index** (Deckers et al., *Int J Geriatr Psychiatry* 2015;30:234–46), twelve factors with published weights, range −5.9 to +12.7. It is shown in a collapsed "For clinicians" section with every item, its weight and the answer. If an item is unanswered the score is labelled incomplete.

Also recorded as context, never scored: usual sleep duration, loud snoring or breathing pauses, and a first-degree relative with dementia. The Commission states that the evidence on sleep is not yet clear enough for a recommendation.

Where it is used: a card on the home screen, a full summary screen, and one line next to any yellow or red light ("Your risk profile lists *n* factors you can act on"). The risk profile is **left out of the exported file** unless the person ticks a box.

## Tier 2b: brain-rhythm check (optional)

A resting EEG recording from a consumer headband, read from a file. Nothing here needs a device to try: three sample recordings and a simulated headband stream are included.

- **Input.** A CSV file saved by the headband's own software: a plain layout (time column plus one column per channel) or a Mind Monitor-style layout (`TimeStamp`, `RAW_TP9`, …). Sampling rates 128, 200, 250, 256, 500 and 512 Hz. If the file has no usable time column the app asks for the rate.
- **Processing** (`js/eeg-core.js`), the same as `eeg/features.py`: band-pass 1–40 Hz, 4-second epochs, epochs beyond 200 µV rejected, Hann periodogram, relative band powers, theta/alpha ratio, alpha centre of gravity. A recording needs 60 seconds of clean signal.
- **Kept.** Only the resulting numbers. The signal is never stored.
- **Over time.** The first two usable recordings of a device type form a personal EEG baseline. Later recordings get a z value for log(theta/alpha) and for the alpha centre of gravity, with an assumed day-to-day SD of 0.20 each.
- **What the participant sees.** Recording quality, a plain-language statement ("within your usual range" or "slower than your usual range"), the spectrum, and the numbers. EEG never changes the status light.
- **Samples.** `samples/` holds six three-minute recordings derived from OpenNeuro ds004504 (CC0): three participants, re-referenced to Fpz and resampled to imitate a BrainBit-type and a Muse-type headband. They are for demonstration and tests and are never saved to a participant's record.
- **Checked against Python.** `tests/eeg.test.js` requires the in-app results to match the Python pipeline on all six recordings.

The app does not connect to a headband over Bluetooth. That was left out on purpose: no device was available to test it.

## Clinician view (`app/clinician.html`)

A separate page for the clinician who reviews results. It has no server: the participant exports a file from their app and chooses to send it, and the clinician imports it. Imported files and review notes stay in the clinician's browser.

**List.** Participants are ordered by what needs attention first:

1. red-flag symptoms reported in the last 14 days and not yet reviewed;
2. referral threshold reached (red), not yet reviewed;
3. repeat session requested (yellow);
4. overdue by more than 14 days;
5. red, already reviewed;
6. within personal range (green);
7. still in the baseline phase.

Each row shows the status, its basis in technical terms (for example "RCI beyond 3.0 on two consecutive sessions" or "trend statistic ≥ 3.5"), the last session, the number of risk factors shared, and the review state.

**Detail.** One page per participant, printable as a summary:

- status and its basis; red-flag reports with their date;
- every indicator against the personal baseline: baseline mean, within-person SD, latest value, RCI, and the two limits;
- the trend statistic, its best-fitting onset and the contribution of each indicator;
- trajectories for the four indicators and the session log with reported context (poor sleep, illness, low mood, medicine change);
- the self-reported risk context, if the participant shared it;
- **potentially reversible contributors to consider**: twelve prompts (acute illness and delirium, medication review, depression, sleep, B12 and folate, thyroid function, routine bloods, hearing, vision, alcohol, vascular risk, collateral history). Items are marked "prompted" when the participant's own answers point to them, with the reason shown. For example, reported diabetes prompts B12 (metformin) and glucose; reported snoring prompts sleep-disordered breathing;
- **clinician review**: a "reviewed" tick, a decision (continue monitoring, repeat sooner, primary-care assessment, referral to neurology, geriatric medicine or mental health, other) and a note. New sessions or a new red-flag report after the review mark it as out of date.

The system never states a diagnosis. A red status says that a threshold was reached and that a qualified clinician decides what happens next.

**Safety of imported files.** A file is untrusted input. `clin-core.js` keeps only the expected fields with the expected types, rejects anything else, and every value is escaped before display.

**Simulated cohort.** "Load simulated cohort" adds nine fictional participants that cover every status. They are labelled as simulated on the list and on each page.

**Languages.** English and Vietnamese. Unlike the participant app, this page uses the technical vocabulary.

## Timing

- Stimulus onset is stamped inside `requestAnimationFrame`, just before the frame is painted.
- Responses use `pointerdown` (not `click`) and the event's own high-resolution timestamp.
- A constant device delay (touch sampling, display latency) remains. It largely cancels when a person is compared with themselves **on the same device**.
- If the page is hidden during a task, that part is aborted and must be repeated.

## Data and privacy

- All data stays in the browser (`localStorage`). Nothing is uploaded.
- The profile holds an age group, an education level and the writing hand. No name, no health record.
- The participant is identified by a random code (`NB-XXXXX`).
- Settings → *Your data* exports one JSON file (trial-level data included). The participant decides whom to send it to.
- Settings → *Delete all my data* removes everything from the device.

## Pilot tools

- **Other-hand check** (Settings → Pilot tools). Reaction time and symbol matching with the non-writing hand. This is a harmless *positive control*: a change we know is there, which the system should detect against the baseline. It never affects the light or the schedule.
- **Demo profile** (Settings → Demo profile). Ten months of **simulated** history for a fictional person, labelled as simulated on every screen and stored separately from real data.
- **QA robot.** `index.html?qa=1` plays the tasks automatically; add `&fast=1` for a shortened protocol. QA sessions are stored under a separate key.

## Assumptions

- The prior `σ_w` values (25 ms, 4 items, 1.2 points, 8 percentage points) are **assumptions**. They will be replaced by values measured in the pilot.
- The 1.96 limit treats session scores as roughly normal and independent.
- The basic RCI is used; practice effects after session 5 are not yet corrected.
- Risk profile: "social isolation" is defined as contact less than weekly, and "excessive alcohol" as more than 12 drinks a week. The first is an operational assumption; the second follows the Commission's >21 UK units.

## Dependencies

None at run time. A modern mobile browser (Pointer Events, `localStorage`). Node.js only for the unit tests.

## Limitations

- No clinical validation. The tasks are adapted from published paradigms but this implementation has not been validated against standard neuropsychological tests.
- No population norms yet: on day 1 the app cannot compare a person with people of the same age and education. The hierarchical model that does this is implemented and tested in `sim/`, but it is not wired into the app, because real norms for these tasks do not exist yet.
- The trend test and the red-light limits come from a simulation, not from real follow-up data. Real people have spells of poor sleep or illness lasting weeks, which a trend test can mistake for decline.
- The app's trend test has no practice correction and no population prior (the hierarchical model in `sim/` has both), because norms for these tasks do not exist yet.
- Picture memory is likely to be near ceiling in healthy adults, which limits its reliability.
- Reaction times depend on the device. Changing phone invalidates the baseline.
- The demo profile is simulated data.
- Risk profile: every factor is a single self-report question. These are proxies for the instruments used in the source studies (for example MEDAS for diet, a cognitive reserve questionnaire for cognitive activity, medical records for diagnoses). PHQ-2 replaces a depression diagnosis.
- LIBRA has no agreed cut-offs, so the app shows the score without a risk category. It counts low-to-moderate alcohol use as protective, which the 2024 Lancet Commission does not; the app never advises anyone to drink.
- The risk profile does not yet change the testing schedule, and genetic results are not collected.
- The Vietnamese PHQ-2 wording must be checked against the official validated translation.
- The EEG check reads recording files and has never been used with a real headband. The Mind Monitor-style layout follows the format's description and is untested with a real export. The day-to-day SDs behind the EEG z values are assumptions.
- The evidence for the EEG features (`eeg/`) is cross-sectional, uses clinical electrodes, and compares people with established dementia to healthy controls.
- The clinician view has no server and no accounts: files are passed by hand, and review notes live in one browser. A red light in the participant app is shown at once; it is not held until a clinician has reviewed it.
- The checklist of reversible contributors is a prompt list written from general clinical practice. It has not been reviewed against a specific local guideline.
- Interface languages: English and Vietnamese. Arabic is planned and must be reviewed by a native speaker.
