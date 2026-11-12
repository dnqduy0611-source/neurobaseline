# Stress test: noise that lasts for weeks

SIMULATED DATA, main scenario, 4 cohorts of 10000 people. Thresholds set with independent noise (5 % false referrals), then applied with AR(1) monthly noise of correlation rho.

| rho | Method | False referrals in 36 months | Slow decline found within 24 months |
|---|---|---|---|
| 0.0 | Trend test | 5.0 % | 76 % |
| 0.0 | Kalman filter | 5.0 % | 90 % |
| 0.0 | Either (each at its own 5 % threshold) | 8.1 % | 91 % |
| 0.3 | Trend test | 9.7 % | 76 % |
| 0.3 | Kalman filter | 9.7 % | 88 % |
| 0.3 | Either (each at its own 5 % threshold) | 14.6 % | 89 % |
| 0.5 | Trend test | 14.1 % | 76 % |
| 0.5 | Kalman filter | 14.6 % | 85 % |
| 0.5 | Either (each at its own 5 % threshold) | 20.2 % | 87 % |
