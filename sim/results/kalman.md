# Kalman filter and adaptive baselines vs the trend test

SIMULATED DATA. Every method is tuned so that 5 % of stable people are referred within 36 months.

Kalman slope noise chosen on a separate tuning cohort (seed 99): q = 0.004.

## Tuning cohort

| q (slope change per month, SD) | Slow decline found within 24 months | Sudden drop within 6 months |
|---|---|---|
| 0.002 | 89 % | 1 % |
| 0.004 | 91 % | 10 % |
| 0.007 | 88 % | 26 % |
| 0.01 | 82 % | 42 % |
| 0.015 | 68 % | 56 % |
| 0.02 | 52 % | 62 % |
| 0.03 | 32 % | 65 % |

## Main scenario (8 cohorts of 10000 people)

| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |
|---|---|---|---|---|---|---|---|---|
| Trend test (current) | 5.0 % | 9 % | 34 % | 76 % ± 1.6 | 20.2 | 33 % | 65 % | 75 % / 75 % |
| Kalman filter, local linear trend | 5.0 % | 4 % | 50 % | 90 % ± 1.0 | 18.0 | 0 % | 10 % | 90 % / 90 % |
| Trend test or Kalman filter | 5.0 % | 6 % | 44 % | 88 % ± 0.8 | 18.7 | 23 % | 53 % | 88 % / 87 % |
| Fixed burst baseline | 5.0 % | 5 % | 13 % | 29 % ± 1.1 | more than 24 | 18 % | 30 % | 29 % / 29 % |
| Adaptive: running mean of all sessions | 5.0 % | 4 % | 9 % | 15 % ± 1.0 | more than 24 | 14 % | 19 % | 15 % / 16 % |
| Adaptive: forgets, level noise 0.1 x SD | 5.0 % | 4 % | 6 % | 8 % ± 0.7 | more than 24 | 13 % | 17 % | 8 % / 9 % |
| Adaptive: forgets, level noise 0.25 x SD | 5.0 % | 3 % | 4 % | 5 % ± 0.5 | more than 24 | 10 % | 11 % | 4 % / 5 % |
| Adaptive: forgets, level noise 0.5 x SD | 5.0 % | 2 % | 3 % | 4 % ± 0.5 | more than 24 | 8 % | 8 % | 4 % / 4 % |

Kalman filter, local linear trend minus trend test, slow decline within 24 months, paired over cohorts: +14.8 points (SD 1.5, range +12.6 to +16.9).  
Trend test or Kalman filter minus trend test, slow decline within 24 months, paired over cohorts: +12.0 points (SD 1.3, range +10.0 to +14.4).  

## Slower decline (0.25 SD per year) (4 cohorts of 10000 people)

| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |
|---|---|---|---|---|---|---|---|---|
| Trend test (current) | 5.0 % | 4 % | 9 % | 19 % ± 1.8 | more than 24 | 33 % | 65 % | 19 % / 19 % |
| Kalman filter, local linear trend | 5.0 % | 1 % | 11 % | 39 % ± 2.0 | more than 24 | 0 % | 10 % | 38 % / 39 % |
| Trend test or Kalman filter | 5.0 % | 2 % | 10 % | 33 % ± 2.7 | more than 24 | 23 % | 53 % | 33 % / 33 % |

Kalman filter, local linear trend minus trend test, slow decline within 24 months, paired over cohorts: +19.1 points (SD 0.8, range +17.9 to +19.6).  
Trend test or Kalman filter minus trend test, slow decline within 24 months, paired over cohorts: +13.5 points (SD 1.2, range +12.4 to +15.2).  

## Faster decline (1.0 SD per year) (4 cohorts of 10000 people)

| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |
|---|---|---|---|---|---|---|---|---|
| Trend test (current) | 5.0 % | 45 % | 95 % | 100 % ± 0.2 | 12.4 | 33 % | 65 % | 100 % / 100 % |
| Kalman filter, local linear trend | 5.0 % | 33 % | 96 % | 100 % ± 0.1 | 13.1 | 0 % | 10 % | 100 % / 100 % |
| Trend test or Kalman filter | 5.0 % | 39 % | 95 % | 100 % ± 0.1 | 12.8 | 23 % | 53 % | 100 % / 100 % |

Kalman filter, local linear trend minus trend test, slow decline within 24 months, paired over cohorts: +0.1 points (SD 0.2, range -0.1 to +0.3).  
Trend test or Kalman filter minus trend test, slow decline within 24 months, paired over cohorts: +0.1 points (SD 0.1, range +0.0 to +0.3).  

## Less reliable tests (0.55 / 0.70 / 0.45) (4 cohorts of 10000 people)

| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |
|---|---|---|---|---|---|---|---|---|
| Trend test (current) | 5.0 % | 5 % | 16 % | 38 % ± 2.7 | more than 24 | 11 % | 28 % | 38 % / 39 % |
| Kalman filter, local linear trend | 5.0 % | 0 % | 18 % | 65 % ± 2.1 | 22.1 | 0 % | 0 % | 65 % / 63 % |
| Trend test or Kalman filter | 5.0 % | 3 % | 17 % | 59 % ± 2.8 | 22.8 | 7 % | 19 % | 59 % / 57 % |

Kalman filter, local linear trend minus trend test, slow decline within 24 months, paired over cohorts: +26.1 points (SD 1.5, range +25.0 to +28.1).  
Trend test or Kalman filter minus trend test, slow decline within 24 months, paired over cohorts: +20.0 points (SD 2.2, range +17.0 to +22.2).  

## More bad days (20 % of sessions) (4 cohorts of 10000 people)

| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |
|---|---|---|---|---|---|---|---|---|
| Trend test (current) | 5.0 % | 7 % | 25 % | 63 % ± 1.4 | 22.0 | 23 % | 50 % | 62 % / 62 % |
| Kalman filter, local linear trend | 5.0 % | 3 % | 39 % | 85 % ± 1.5 | 19.1 | 0 % | 6 % | 84 % / 84 % |
| Trend test or Kalman filter | 5.0 % | 4 % | 34 % | 81 % ± 1.5 | 19.7 | 15 % | 38 % | 80 % / 79 % |

Kalman filter, local linear trend minus trend test, slow decline within 24 months, paired over cohorts: +21.6 points (SD 1.4, range +20.6 to +23.6).  
Trend test or Kalman filter minus trend test, slow decline within 24 months, paired over cohorts: +17.7 points (SD 1.1, range +16.6 to +19.3).  

## No practice effect (4 cohorts of 10000 people)

| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |
|---|---|---|---|---|---|---|---|---|
| Trend test (current) | 5.0 % | 9 % | 35 % | 76 % ± 2.5 | 20.1 | 33 % | 66 % | 76 % / 75 % |
| Kalman filter, local linear trend | 5.0 % | 4 % | 50 % | 90 % ± 1.2 | 18.1 | 0 % | 10 % | 90 % / 90 % |
| Trend test or Kalman filter | 5.0 % | 6 % | 44 % | 88 % ± 0.8 | 18.6 | 23 % | 53 % | 88 % / 87 % |

Kalman filter, local linear trend minus trend test, slow decline within 24 months, paired over cohorts: +13.8 points (SD 1.7, range +12.6 to +16.4).  
Trend test or Kalman filter minus trend test, slow decline within 24 months, paired over cohorts: +11.5 points (SD 1.9, range +10.4 to +14.2).  

## Norms learned in another population (4 cohorts of 10000 people)

| Method | False referrals | Slow decline within 12 months | 18 months | 24 months | Median delay (months) | Sudden drop within 3 months | 6 months | Slow within 24 months: low / high education |
|---|---|---|---|---|---|---|---|---|
| Trend test (current) | 5.0 % | 10 % | 38 % | 78 % ± 2.1 | 19.7 | 35 % | 68 % | 79 % / 75 % |
| Kalman filter, local linear trend | 5.0 % | 4 % | 49 % | 90 % ± 1.2 | 18.1 | 0 % | 9 % | 90 % / 90 % |
| Trend test or Kalman filter | 5.0 % | 7 % | 45 % | 88 % ± 0.9 | 18.6 | 25 % | 58 % | 88 % / 87 % |

Kalman filter, local linear trend minus trend test, slow decline within 24 months, paired over cohorts: +12.4 points (SD 1.3, range +11.1 to +14.3).  
Trend test or Kalman filter minus trend test, slow decline within 24 months, paired over cohorts: +10.0 points (SD 1.5, range +8.9 to +12.0).  
