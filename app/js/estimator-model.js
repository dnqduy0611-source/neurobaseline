/* NeuroBaseline - coefficients of the estimate of a lasting change. Written by sim/train_estimator.py; do not edit by hand.
   Logistic regression fitted on a SIMULATED cohort. It has not seen data from real people. */
(function (root) {
  'use strict';
  var M = {
    "version": 1,
    "trainedOn": "simulated cohort",
    "features": ["trend", "zmean", "flag", "sleep", "eeg"],
    "clip": [[0.0, 8.0], [-2.0, 6.0], [0.0, 1.0], [0.0, 2.5], [-3.0, 6.0]],
    "mean": [1.1782, 0.933, 0.1265, 0.5713, 0.3488],
    "coef": [1.3744, 0.8862, -0.7455, -0.2328, 0.5203],
    "base": -1.2165,
    "bands": [0.35, 0.65],
    "test": {"n": 121615, "auc": 0.869, "brier": 0.124, "rate": 0.31, "bands": [{"share": 0.653, "rate": 0.116, "mean_p": 0.113}, {"share": 0.14, "rate": 0.435, "mean_p": 0.493}, {"share": 0.207, "rate": 0.838, "mean_p": 0.811}]},
    "checks": [{"x": [0.4, 0.9, 1, 2.0, null], "p": 0.035602}, {"x": [0.4, 0.9, 0, 0.0, null], "p": 0.110269}, {"x": [3.8, 2.6, 0, 0.0, 2.6], "p": 0.994846}, {"x": [2.9, 2.2, 1, 2.0, 2.4], "p": 0.913426}, {"x": [3.2, 0.3, 0, null, null], "p": 0.749435}, {"x": [8.0, 6.0, 0, 0.0, 6.0], "p": 1.0}, {"x": [0.0, -2.0, 1, 2.5, -3.0], "p": 0.000254}]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  if (root.NB || typeof window !== 'undefined') { root.NB = root.NB || {}; root.NB.estimatorModel = M; }
})(typeof window !== 'undefined' ? window : globalThis);
