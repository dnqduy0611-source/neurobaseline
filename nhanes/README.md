# NHANES analysis: fixed cut-offs and schooling

Real-data check of one claim behind NeuroBaseline: that a single cut-off on a cognitive score treats people with different schooling very differently. Results and their limits are in [`REPORT.md`](REPORT.md).

## Data

US National Health and Nutrition Examination Survey (NHANES), cycles 2011–2012 and 2013–2014, from the Centers for Disease Control and Prevention, National Center for Health Statistics. Public-use files, in the public domain. The data are not in this repository.

| File | Used for |
|---|---|
| `DEMO_G`, `DEMO_H` | Age, sex, education (`DMDEDUC2`), examination weights and design variables |
| `CFQ_G`, `CFQ_H` | Digit Symbol Substitution Test score (`CFDDS`), adults aged 60 and over |
| `MCQ_G`, `MCQ_H` | Self-reported worsening confusion or memory loss in the past 12 months (`MCQ084`) |

## Run

```bash
python download_data.py ../data/nhanes
```

```bash
python run_analysis.py ../data/nhanes results
```

```bash
python make_figures.py results
```

Requires Python 3 with NumPy, SciPy, pandas and Matplotlib. The download is 22.5 MB.

## Method

- **Sample.** People examined in the mobile centre, aged 60 and over, with a DSST score and a known education level (n = 3011). A subgroup reports no worsening confusion or memory loss (n = 2569).
- **Weights and design.** Two-year examination weights divided by two for the combined four years. Variances by Taylor linearisation over strata and primary sampling units, with the subgroup treated as a domain of the full design. Proportions carry logit-scale 95 % intervals.
- **Scores by education.** Weighted means, SDs and percentiles for the five education levels.
- **Adjusted difference.** Weighted regression of the score on age (top-coded at 80), sex, education and cycle, with a design-based sandwich covariance.
- **Fixed cut-offs.** Defined once in the whole analytic sample: the lowest quartile, and 1.5 SD below the mean. The share below each is reported by education, in everyone, in people with no memory complaint, and within three age bands.
- **A 5 % flagging rate.** The cut-off below which 5 % of people with no memory complaint fall, compared with flagging the lowest 5 % of residuals from the regression (norms adjusted for age, sex and education).
