"""NeuroBaseline – hierarchical (population -> individual) model.

Random-intercept model for one indicator (higher = better):

    y[i, j] = x[i] . beta  +  gamma[j]  +  u[i]  +  e[i, j]
              population      practice     person   session noise
              prediction      effect       N(0, sb^2)   N(0, sw^2)

  x[i]      age and education of person i
  gamma[j]  practice effect at session j, relative to the plateau (negative for the first sessions)
  sb        between-person SD: how much people differ once age and education are accounted for
  sw        within-person SD: how much one person varies from session to session

Learned from a reference sample (fit). Then, for a new person with n practice-adjusted sessions of mean ybar:

    baseline = w * ybar + (1 - w) * (x . beta)        w = n / (n + k),   k = sw^2 / sb^2
    a new session is expected within  baseline +/- z * sw * sqrt(1 + 1 / (n + k))

With n = 0 this is a comparison with people of the same age and education. As n grows it becomes a comparison
with the person's own history. The personal Reliable Change Index is the special case k = 0.
"""
from dataclasses import dataclass

import numpy as np


def design(age, edu):
    """Columns: intercept, age - 65, education level 1, education level 2 (level 0 is the reference)."""
    age, edu = np.asarray(age, float), np.asarray(edu)
    return np.column_stack([np.ones(len(age)), age - 65.0, edu == 1, edu == 2]).astype(float)


@dataclass
class PopulationModel:
    beta: np.ndarray        # (4, K) fixed effects for the plateau level
    gamma: np.ndarray       # (J, K) practice offsets relative to the plateau; rows from `plateau_from` on are 0
    sigma_b: np.ndarray     # (K,)
    sigma_w: np.ndarray     # (K,)
    norm_mean: np.ndarray   # (K,) unadjusted norms (session 5 of the reference sample)
    norm_sd: np.ndarray
    adj_beta: np.ndarray    # (4, K) age- and education-adjusted norms (session 5)
    adj_sd: np.ndarray
    plateau_from: int

    @property
    def k(self):
        return self.sigma_w ** 2 / self.sigma_b ** 2

    def predict(self, age, edu):
        return design(age, edu) @ self.beta

    def practice(self, j):
        """Practice offset for session numbers j (1-based array)."""
        j = np.minimum(np.asarray(j), len(self.gamma))
        return self.gamma[j - 1]

    def weight(self, n):
        return n / (n + self.k)

    def baseline(self, ybar, n, age, edu):
        w = self.weight(n)
        return w * ybar + (1 - w) * self.predict(age, edu)

    def pred_sd_factor(self, n):
        """Multiply by a within-person SD to get the SD of (new session - baseline)."""
        return np.sqrt(1 + 1 / (n + self.k))


def fit(y, age, edu, plateau_from=8):
    """Method-of-moments fit. y has shape (people, sessions, indicators); every person has every session."""
    n, n_sess, _ = y.shape
    plateau = y[:, plateau_from - 1:, :].mean(axis=1)
    gamma = (y - plateau[:, None, :]).mean(axis=0)
    gamma[plateau_from - 1:] = 0.0
    adj = y - gamma[None]
    person_mean = adj.mean(axis=1)
    sw2 = ((adj - person_mean[:, None, :]) ** 2).sum(axis=(0, 1)) / (n * (n_sess - 1))
    x = design(age, edu)
    beta, *_ = np.linalg.lstsq(x, person_mean, rcond=None)
    resid = person_mean - x @ beta
    sb2 = np.maximum(resid.var(axis=0, ddof=x.shape[1]) - sw2 / n_sess, 1e-6)   # person means still contain sw^2 / sessions of noise
    y5 = y[:, 4, :]
    adj_beta, *_ = np.linalg.lstsq(x, y5, rcond=None)
    return PopulationModel(beta=beta, gamma=gamma, sigma_b=np.sqrt(sb2), sigma_w=np.sqrt(sw2),
                           norm_mean=y5.mean(axis=0), norm_sd=y5.std(axis=0, ddof=1),
                           adj_beta=adj_beta, adj_sd=(y5 - x @ adj_beta).std(axis=0, ddof=x.shape[1]), plateau_from=plateau_from)


def blended_sigma(prior, nu0, m, s1, s2):
    """Within-person SD: population value blended with the person's own variance (m values, sum s1, sum of squares s2)."""
    var = np.maximum(s2 - s1 ** 2 / m[:, None], 0.0) / np.maximum(m[:, None] - 1, 1)
    return np.sqrt((nu0 * prior ** 2 + (m[:, None] - 1) * var) / (nu0 + m[:, None] - 1))


def cusum_step(c, z, kappa):
    """One CUSUM update: accumulate how far each session is below expectation, minus an allowance kappa."""
    return np.maximum(0.0, c + np.clip(z, -3.0, 3.0) - kappa)
