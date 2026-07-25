# Track A — Next-Period Prediction and Cycle Statistics

**Literature review for a privacy-first, single-user, local-only menstrual cycle tracking app.**

Compiled 2026-07-22. Every numeric claim below is tagged with a source that was actually retrieved
during this review (URL given). Where a source could not be retrieved in full text, this is stated
explicitly. Nothing in this document is recalled from memory without a retrieved citation, and where
a recommendation is my own engineering synthesis rather than a published result, it is labelled
**[SYNTHESIS — not from literature]**.

---

## Source list (all retrieved)

| # | Citation | URL retrieved |
|---|---|---|
| S1 | Bull JR et al. "Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles." *npj Digital Medicine* 2 (2019). doi:10.1038/s41746-019-0152-7 | https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244/ |
| S2 | Li K, Urteaga I, Wiggins CH, Druet A, Shea A, Vitzthum VJ, Elhadad N. "Characterizing physiological and symptomatic variation in menstrual cycles using self-tracked mobile-health data." *npj Digital Medicine* 3 (2020). doi:10.1038/s41746-020-0269-8 | https://pmc.ncbi.nlm.nih.gov/articles/PMC7250828/ , https://pubmed.ncbi.nlm.nih.gov/32509976/ |
| S3 | Li K, Urteaga I, Shea A, Vitzthum VJ, Wiggins CH, Elhadad N. "A predictive model for next cycle start date that accounts for adherence in menstrual self-tracking." *JAMIA* 2022;29(1):3–11. | https://pmc.ncbi.nlm.nih.gov/articles/PMC8714275/ , https://academic.oup.com/jamia/article/29/1/3/6371799 |
| S4 | Symul L, Wac K, Hillard P, et al. "Assessment of menstrual health status and evolution through mobile apps for fertility awareness." *npj Digital Medicine* 2 (2019). doi:10.1038/s41746-019-0139-4 | https://pmc.ncbi.nlm.nih.gov/articles/PMC6635432/ |
| S5 | Li H, Gibson EA, Jukic AMZ, Baird DD, Wilcox AJ, Curry CL, Fischer-Colbrie T, Onnela J-P, Williams MA, Hauser R, Coull BA, Mahalingaiah S. "Menstrual cycle length variation by demographic characteristics from the Apple Women's Health Study." *npj Digital Medicine* 2023;6(1):100. doi:10.1038/s41746-023-00848-1 | https://pmc.ncbi.nlm.nih.gov/articles/PMC10226714/ |
| S6 | Cunningham AC, et al. "Chronicling menstrual cycle patterns across the reproductive lifespan with real-world data." *Scientific Reports* 2024;14:10172. | https://pmc.ncbi.nlm.nih.gov/articles/PMC11068910/ |
| S7 | Munro MG, et al. "The FIGO Ovulatory Disorders Classification System." *Human Reproduction* 2022;37(10):2446–2464. (restates FIGO AUB System 1 normal limits from the 2018 revision) | https://pmc.ncbi.nlm.nih.gov/articles/PMC9527465/ |
| S8 | Fehring RJ, Schneider M, Raviele K. "Variability in the phases of the menstrual cycle." *JOGNN* 2006;35:376–384. (abstract retrieved) | https://pubmed.ncbi.nlm.nih.gov/16700687/ |
| S9 | Henry S, Shirin S, Goshtasebi A, Prior JC. "Prospective 1-year assessment of within-woman variability of follicular and luteal phase lengths in healthy women prescreened to have normal menstrual cycle and luteal phase lengths." *Human Reproduction* 2024;39(11):2565–2574. doi:10.1093/humrep/deae215 | https://academic.oup.com/humrep/article/39/11/2565/7775370 |
| S10 | Creinin MD, Keverline S, Meyn LA. "How regular is regular? An analysis of menstrual cycle regularity." *Contraception* 2004;70(4):289–292. (abstract retrieved) | https://pubmed.ncbi.nlm.nih.gov/15451332/ |
| S11 | Wang Y, Park J, Zhang CY, Jukic AMZ, Baird DD, Coull BA, Hauser R, Mahalingaiah S, Zhang S, Curry CL. "Performance of algorithms using wrist temperature for retrospective ovulation day estimate and next menses start day prediction: a prospective cohort study." *Human Reproduction* 2025;40(3):469–478. doi:10.1093/humrep/deaf005 | https://academic.oup.com/humrep/article/40/3/469/7989515 |
| S12 | Fukaya K, Kawamori A, Osada Y, Kitazawa M, Ishiguro M. "The forecasting of menstruation based on a state-space modeling of basal body temperature time series." *Statistics in Medicine* 2017;36(21):3361–3379. | https://pmc.ncbi.nlm.nih.gov/articles/PMC5575519/ |
| S13 | Worsfold L, Marriott L, Johnson S, Harper JC. "Period tracker applications: What menstrual cycle information are they giving women?" *Women's Health (Lond)* 2021. | https://pmc.ncbi.nlm.nih.gov/articles/PMC8504278/ |
| S14 | Huang X, Elliott MR, Harlow SD. "Modeling Menstrual Cycle Length and Variability at the Approach of Menopause Using Hierarchical Change Point Models." *JRSS-C (Applied Statistics)* 2013/2014;63(3):445–466. | https://pmc.ncbi.nlm.nih.gov/articles/PMC3979630/ |
| S15 | Duttweiler L, Asokan G, Wang Z, Mahalingaiah S, Onnela J-P, Hauser R, Williams MA, et al. "SkipTrack: A Bayesian Hierarchical Model for Self-tracked Menstrual Cycle Length and Regularity in Large Mobile Health Cohorts." arXiv:2508.05845 (2025). | https://arxiv.org/abs/2508.05845 , https://arxiv.org/html/2508.05845 |
| S16 | Naveed A, Whooten R. "Time to cycle regularity and health risks." *Curr Opin Endocrinol Diabetes Obes* 2024;31(6):210–215. | https://pmc.ncbi.nlm.nih.gov/articles/PMC12459127/ |
| S17 | Jukic AMZ, Weinberg CR, Wilcox AJ, et al. "Accuracy of Reporting of Menstrual Cycle Length." *American Journal of Epidemiology* 2007;167(1):25–33. | https://pmc.ncbi.nlm.nih.gov/articles/PMC3693484/ |
| S18 | Apple Women's Health Study public explainer, "Menstrual cycle length and variability: a visual explanation, Part 3" (Harvard T.H. Chan School of Public Health). | https://awhs-updates.hsph.harvard.edu/cycle-length-variability/part-3/ |
| S19 | "Implications of cycle length immediately after discontinuation of combined oral contraceptives on use of the Standard Days Method." (abstract retrieved; PMID 20650457) | https://pubmed.ncbi.nlm.nih.gov/20650457/ |
| S20 | Bull et al. 2019 secondary summary, The ObG Project (used only to corroborate S1 figures). | https://www.obgproject.com/2019/09/13/what-percentage-of-women-actually-have-a-28-day-cycle/ |

Sources I attempted and **could not retrieve** are listed in the final section.

---

## 1. Empirical distribution of cycle length, and the realistic accuracy ceiling

**CONFIDENCE: Strong** (five independent large cohorts + one prospective cohort for the accuracy ceiling).

### 1.1 Central tendency and spread

| Cohort | N | Mean | Median / IQR | Notes |
|---|---|---|---|---|
| Natural Cycles (S1) | 612,613 ovulatory cycles, 124,648 users | **29.3 d (SD 5.2)** | — | 65% of cycles 25–30 d; 19% 31–35 d; 8% 21–24 d; <1% 15–20 d |
| Apple Women's Health Study (S5) | 165,668 cycles, 12,608 participants | **28.7 d (SD 6.1)** | **median 28, IQR 26–30**; 5th–95th pct **22–38 d** | cycles <10 d or >90 d excluded |
| Clue (S2), non-highly-variable users | 349,606 users (92.3%) | 29.45 d (SD 4.98) | median 29 | ages 21–33 |
| Clue (S2), highly variable users | 29,088 users (7.68%) | 37.04 d (SD 13.71) | median 34 | median cycle-length-difference > 9 d |
| Flo (S6) | 19,266,573 users aged 18–55 | 28.54 d (18–25 y) → 27.15 d (46–50 y) | — | cycles <10 d excluded |
| Kindara + Sympto (S4) | 2,732,424 cycles, 212,967 users | — | mode "27 to 28 days" | distribution "asymmetrical … with a heavy tail on longer cycles" |

Key distributional facts:

- **Only 13% of cycles are exactly 28 days** (S1). Roughly **14% of cycles fall outside 21–35 days**, and about **35% fall outside 25–30 days** (S1). The 28-day textbook cycle is a minority case.
- The distribution is **right-skewed with a heavy long tail** (S4). Any Gaussian assumption is an approximation that fails on the right tail — which is exactly where unlogged cycles hide (see §5).
- Menses/period length: **4.0 ± 1.5 days** (S1); median 4 days in Clue (S2); mean 5.2 ± 1.0 days in a prospective diary cohort (S10).

### 1.2 Cycle-to-cycle variation within a person

This is the number that matters for prediction, and it is much larger than most users expect.

| Metric | Value | Source |
|---|---|---|
| Mean per-woman SD of cycle length | **2.6 ± 2.5 days** | S1 (Natural Cycles; note this cohort is fertility-aware and self-selected, so it is a floor) |
| Per-woman SD of cycle length, by age | 4.14 d (18–25); 3.95 (26–30); 3.80 (31–35); **3.72 (36–40, minimum)**; 3.92 (41–45); 4.72 (46–50); **6.52 (51–55)** | S6 (Flo, ~19M users) |
| Within-person SD (model residual SD) | 5.33 d (<20 y); **3.79 d (35–39 y, minimum)**; 5.42 d (45–49); 11.19 d (>50) | S5 (AWHS) |
| **% of women whose longest−shortest cycle range is ≥ 7 days** | **46%** | S10 (130 women, 786 prospectively recorded cycles, all self-described as "regular") |
| **% of women whose range is ≥ 14 days** | **20%** | S10 |
| % of women with "intracycle variability of greater than 7 days" | **42.5%** | S8 (141 women, 1,060 cycles, electronic fertility monitor) |
| % of users with **median** cycle-length-difference ≥ 9 days | **7.68%** (Clue, ages 21–33) | S2 |
| % of participants with median cycle-length-difference ≥ 9 days | **~23 out of 100** (AWHS, broader age range) | S18 |
| % classed irregular (longest−shortest > 7 d, twice in 12 months) | 20% (18–25); 16% (26–30); 14% (31–35); 13.8% (36–40); 18% (41–45); 28.3% (46–50); 44.7% (51–55) | S6 |

**Important nuance the app must respect:** the "> 7 days" and "> 9 days" figures answer *different questions* and differ by ~5×. "Range ≥ 7 days over ~6–12 cycles" (46%, S10) is a **max−min** statistic that grows with the number of cycles observed and is destroyed by one outlier. "Median cycle-length-difference ≥ 9 days" (7.68% in S2, ~23% in S18) is a **robust successive-difference** statistic. The Clue/AWHS discrepancy (7.68% vs 23%) is explained by cohort age range — Clue was restricted to ages 21–33 (S2), AWHS spans a wider adult range (S5, S18) — plus Clue's aggressive engagement filtering.

**Practical answer to "what fraction have cycle-to-cycle variation > 7 / > 9 days":**
- By the FIGO-style max−min-over-12-months definition: **~40–46% exceed 7 days** (S8, S10); ~20% exceed 14 days (S10). This threshold is *not* a rare-event threshold.
- By the robust median-successive-difference definition: **~8% (young adults, S2) to ~23% (broad adult cohort, S18) exceed 9 days.**

### 1.3 The realistic ceiling on prediction accuracy (MAE in days)

**This is the single most important number for setting product expectations.**

| Method | Population | Error | Source |
|---|---|---|---|
| **Calendar method (cycle history only)** | Prospective cohort, 260 participants, 889 cycles, 12 months | **MAE = 1.90 days** | S11 |
| Wrist-temperature algorithm ("Algorithm 3"), all signals | same cohort | **MAE = 1.70 d (95% CI 1.57–1.84)**; ME = −0.06 d (95% CI −0.28, 0.18); **88.4% within ±3 days** | S11 |
| Same algorithm, restricted to strong (≥0.2 °C) temperature signal | 688 cycles / 196 participants | MAE = 1.65 d (1.52–1.79); 89.4% within ±3 d | S11 |
| Same algorithm, typical-length cycles (23–35 d) | — | MAE = 1.49 d (1.36–1.63); 91.2% within ±3 d | S11 |
| Same algorithm, atypical-length cycles | — | MAE = 1.97 d; 85.4% within ±3 d | S11 |
| Mean-of-prior-cycles baseline, day 0 of cycle | 186,106 Clue users, 2,047,166 cycles | **RMSE = 7.50 days** | S3 |
| Median-of-prior-cycles baseline, day 0 | same | RMSE = 7.49 d | S3 |
| LSTM, day 0 | same | RMSE = 7.40 d | S3 |
| Hierarchical Bayesian skip-aware model, day 0 | same | **RMSE = 7.38 d** | S3 |
| Same model, users with median CLD = 0 (perfectly consistent) | subset | **median absolute error 1.5 d**, but **RMSE 6.15 d** for the same group | S3 |
| BBT state-space model vs calendar | 20 subjects, 44–91 cycles each | median MAE **reduction of only 0.361 days** vs calendar (range of max reductions 0.056–1.368 d) | S12 |

**Interpretation — three hard conclusions:**

1. **The ceiling for a calendar-only app on a well-behaved cohort is MAE ≈ 1.9 days** (S11). Adding wrist temperature buys **0.2 days** (1.90 → 1.70, p < 0.001, S11). Adding daily BBT buys **~0.36 days** (S12). *Sensor data is not where the wins are.*
2. **On a real, unfiltered app population, RMSE is ~7.4 days at cycle start** (S3), and this barely differs between a simple mean, a simple median, an LSTM, and a hierarchical Bayesian model (7.50 / 7.49 / 7.40 / 7.38). The spread between the best and worst of those is **0.12 days of RMSE**. Model sophistication is nearly irrelevant for the point estimate.
3. The gap between "median absolute error 1.5 d" and "RMSE 6.15 d" *for the same perfectly-consistent users* (S3) proves the error distribution is **dominated by rare large outliers**, not by everyday noise. Those outliers are overwhelmingly unlogged cycles (§5). **Robustness and outlier handling — not model class — is where accuracy comes from.**

---

## 2. Follicular vs luteal variability, and the direction of ovulation inference

**CONFIDENCE: Strong.**

### 2.1 Phase lengths

| Quantity | Value | Source |
|---|---|---|
| Follicular phase, mean | **16.9 days (SD 5.3; 95% CI 10–30)** | S1 |
| Luteal phase, mean | **12.4 days (SD 2.4; 95% CI 7–17)** | S1 |
| Follicular, median | 16 days | S4 |
| Luteal, median | 12 days (Kindara) / 13 days (Sympto) | S4 |
| Luteal, median and range (prospective, prescreened-normal cohort) | **median 11.0 d, range 3.0–16.0 d** | S9 |
| % of cycles with luteal phase ≤ 10 days | **~20%** | S4 |
| % of cycles with luteal phase < 10 days (prescreened-normal cohort) | **26.1%**; and **55% of women had >1 short luteal phase** | S9 |
| % of cycles where ovulation fell on day 14–15 | **only ~24%** | S4 |
| Range containing 90% of ovulations | **cycle days 10–24** | S4 |

Phase length by cycle-length band (S1):

| Cycle length | Share of cycles | Follicular | Luteal |
|---|---|---|---|
| 15–20 d | <1% | 10.4 ± 2.4 | 8.0 ± 2.4 |
| 21–24 d | 8% | 12.4 ± 2.2 | 11.0 ± 2.2 |
| 25–30 d | 65% | 15.2 ± 2.5 | 12.4 ± 2.2 |
| 31–35 d | 19% | 19.5 ± 2.7 | 12.9 ± 2.3 |

Note that as the cycle lengthens from 21–24 d to 31–35 d (a +9 day shift in the band midpoint), the follicular phase grows by **7.1 days** while the luteal phase grows by **1.9 days**.

### 2.2 Variance decomposition

- S1 states directly: *"Cycle length differences were found to be predominantly caused by follicular phase length differences (i.e., differences in ovulation day)."* Follicular SD is 5.3 d vs luteal SD 2.4 d (S1) — a variance ratio of ~4.9:1 in the cross-sectional (between-cycle, between-person) sense.
- S8 concludes: *"The follicular phase contributes most to this variability."*
- S9 (53 women, 676 ovulatory cycles, 1 year, prospective) reports **median within-woman variances for cycle, follicular, and luteal lengths of 3.1, 5.2, and 3.0** and **between-women variances of 10.3, 11.2, and 4.3**. The within-woman follicular variance (5.2) exceeds the within-woman luteal variance (3.0) by ~1.7×; between women the ratio is ~2.6×. S9 also reports a **median within-woman follicular:luteal length ratio of 1.7 (range 1.2–2.6)**.
  - *Caveat:* S9 labels these quantities "days" though they are variances; the follicular within-woman variance (5.2) also exceeds the whole-cycle variance (3.1), which is only possible if follicular and luteal deviations are negatively correlated within a woman. Reported as published; flagged as a reading uncertainty.
- S9's headline conclusion (echoed in its press coverage): **luteal phase length is NOT fixed at 13–14 days.**
- Luteal phase length is **stable across age** while follicular length declines 0.19 d/year from 25 to 45 (S1).

### 2.3 What this implies for the app's ovulation logic

**Backwards from the predicted next period is strictly better than forwards from the last period start.** Reasons, all evidenced:

1. The luteal phase is the lower-variance component (SD 2.4 d vs 5.3 d, S1; within-woman variance 3.0 vs 5.2, S9). Anchoring the ovulation estimate to the *end* of the cycle borrows the smaller error term.
2. Counting forward from the last period start inherits the **full follicular variance**, which is where nearly all cycle-length variation lives (S1, S8).
3. However — this only holds *conditional on the next period date being known*. At prediction time it is not; you only have a predicted date with its own uncertainty. So the honest formulation is:
   `ovulation_day ≈ predicted_next_period_start − L̄_luteal`, with the ovulation uncertainty being the **convolution** of the next-period prediction uncertainty and the luteal-length uncertainty. It is not free.
4. **Never hard-code a 14-day luteal phase.** Only ~24% of ovulations occur on day 14–15 (S4); 20–26% of cycles have luteal phases under 10 days (S4, S9); the observed luteal range is 3–16 days (S9) and 7–17 days at 95% CI (S1). S13 found that period-tracker apps that assume a textbook 28-day cycle with day-14 ovulation produced ovulation predictions that were **2–9 days early in 67% of cases**, with only **8% (3 of 36) exactly correct**.
5. Recommended constant if a point luteal length is needed: **12.5 days** (midpoint of S1's 12.4 and S4's 12–13), with an SD of **2.4 days** (S1). Prefer a per-user estimate if confirmed ovulation data (LH tests, BBT shift) ever exists.

---

## 3. Which estimator of "typical cycle length" for a small-N single user

**CONFIDENCE: Moderate.** There is a direct published head-to-head of mean vs median vs neural nets vs a hierarchical Bayesian model (S3), but *no* published head-to-head of trimmed means or exponentially-weighted averages for this task, and no published study that stratifies estimator performance by N = 3…12. The recommendation below is anchored in S3 but its specific constants are synthesis.

### 3.1 What the literature actually shows

From S3 (186,106 users, 2,047,166 cycles, trained on each user's first 10 cycles, predicting the 11th), RMSE in days at **day 0** of the cycle:

| Estimator | RMSE (d0) | RMSE (d30) | RMSE (d40) |
|---|---|---|---|
| Mean of prior cycles | 7.50 | 8.99 | **21.92** |
| Median of prior cycles | 7.49 | 9.35 | 23.39 |
| CNN | 8.03 | 9.55 | 24.51 |
| RNN | 7.76 | 9.07 | 22.95 |
| LSTM | 7.40 | 8.98 | 22.68 |
| Hierarchical Bayesian, skips ignored (s=0) | 7.56 | 8.59 | 14.78 |
| **Hierarchical Bayesian, skip-aware (s≥0)** | **7.38** | **8.58** | **11.77** |

**Conclusions from this table:**

- At the moment you make the prediction (day 0), **mean ≈ median ≈ LSTM ≈ hierarchical Bayes**, all within 0.12 days of RMSE. Choosing among simple location estimators is *not* where accuracy comes from.
- The huge divergence appears **late in the cycle** (day 40: 21.92 vs 11.77 — a **46% RMSE reduction**), and it comes entirely from **modelling skipped logs**, not from a better average.
- The mean very slightly beats the median at day 0 (7.50 vs 7.49 — effectively tied) but the median degrades *worse* than the mean at long horizons in this table. Neither dominates.

Additional evidence relevant to the estimator choice:

- **Do not weight recent cycles heavily.** S2 found that *"cycle and period length statistics are stationary over the app usage timeline across the variability spectrum"* — i.e. within a user's tracking history there is no systematic drift to chase. The genuine physiological drift is **−0.18 days per year of age** (S1), which over 12 cycles (~1 year) is **~0.18 days** — far below the ~4-day noise floor.
- **A population prior is worth having.** S3 and S15 both use hierarchical shrinkage toward a population level; S15 shows that *not* propagating uncertainty properly (fixing skips a priori) causes coverage to collapse from 0.945 to 0.000 in simulation. Shrinkage's payoff is mainly in **uncertainty quantification** and at **very small N**, not in point accuracy at N ≥ 8.
- **Robustness matters more than the estimator family.** S3's finding that perfectly-consistent users have median absolute error 1.5 d but RMSE 6.15 d means the loss is outlier-driven. S2's own data-cleaning rule is itself a robust-statistics rule: exclude cycles where *"the corresponding CLD exceeds the user's median CLD by at least 10 days"*, plus cycles > 90 days, plus users with only two tracked cycles.

### 3.2 Recommendation

**Use a skip-corrected, mildly recency-weighted, outlier-winsorised mean, shrunk toward an age-appropriate population prior.** Concretely:

```
WINDOW      = last 12 completed cycles (after skip correction, §5)
DECAY ρ     = 0.90   (weight of a cycle = ρ^(cycles_ago), half-life ≈ 6.6 cycles)
PRIOR MEAN  μ0 = age-band population mean (see table below), default 29.0 days
PRIOR TAU   τ0 = 4.5 days   (between-person SD of an individual's mean cycle length)
```

`μ0` by age band, from S6 (Flo, 19M users) with S1/S5 as cross-checks:

| Age band | μ0 (days) |
|---|---|
| < 26 | 28.5 |
| 26–30 | 28.3 |
| 31–35 | 28.0 |
| 36–40 | 27.7 |
| 41–45 | 27.4 |
| 46–50 | 27.2 |
| ≥ 51 | 28.0 |
| unknown age | 29.0 |

`τ0 = 4.5` is derived: AWHS total SD of cycle length is 6.1 d and within-person SD is ~3.8–4.0 d (S5), so between-person SD ≈ √(6.1² − 4.0²) ≈ 4.6. Rounded to 4.5. **[SYNTHESIS — the arithmetic is mine; the inputs are S5.]**

**Why not each alternative:**

| Candidate | Verdict |
|---|---|
| Mean of last N | Fine (RMSE 7.50, S3) but breaks on a single doubled cycle: one unlogged cycle in a 6-cycle window shifts the mean by ~L/6 ≈ **+4.8 days** (arithmetic, not a citation). Only acceptable *after* skip correction. |
| Median of last N | Equally accurate (RMSE 7.49, S3) and far more robust, but discards information and is jumpy at N = 3–6 (it can only take a handful of discrete values). Good as a **fallback and as a cross-check**. |
| Trimmed / winsorised mean | No published head-to-head for this task **[Weak/Unverified]**. Theoretically the right compromise given S3's outlier-dominated loss. Recommended below in winsorised form. |
| Exponentially-weighted | No published head-to-head **[Weak/Unverified]**. S2's stationarity finding argues *against* aggressive decay. Use gentle decay (ρ = 0.90) only to adapt to genuine life-stage transitions (§7). |
| Bayesian shrinkage to a population prior | Best-supported *structure* (S3, S15). Point-accuracy gain at day 0 is only 0.12 d RMSE over the mean (S3), but it is the only approach that yields a principled prediction interval and behaves correctly at N = 1–3. **Recommended.** |

**How many cycles to use: 12.** Rationale: FIGO's regularity definition is explicitly a **12-month** window (S7); S6 uses a 12-month window for its irregularity definition; S3 trains on 10 cycles; and S2's stationarity finding means older data is not harmful, merely low-value. Twelve cycles ≈ one year ≈ the point where the age-drift term (0.18 d/yr, S1) becomes non-negligible.

---

## 4. Constructing the prediction interval

**CONFIDENCE: Weak/Unverified for the specific construction; Moderate for the inputs.**

**What the literature does and does not give you:**

- S3 (JAMIA) **does not report calibration or interval coverage at all** — only RMSE, MAE and median absolute error. Verified by direct inspection of the paper text.
- S12 derives a genuine **predictive distribution** over the day of next menstruation onset via sequential Bayesian filtering, but reports only MAE reduction, not coverage.
- S15 (SkipTrack) reports **coverage** — but in *simulation*, for regression coefficients, not for individual next-cycle prediction. Its headline result is that fixing skips a priori collapses nominal-95% coverage to 0.000 at n = 5000, versus 0.945 for the proper model.
- **I found no published study that constructs or validates a next-period prediction interval for an individual user with 3–12 cycles of history.** This is a genuine gap in the literature. Everything below is synthesis.

### 4.1 Target coverage

**Recommend an 80% central interval (10th–90th percentile).** **[SYNTHESIS]**

Justification from retrieved numbers rather than taste:
- A well-tracking user achieves MAE ≈ 1.90 d with a calendar method (S11). If errors were normal, that implies SD ≈ 1.90 × 1.2533 ≈ **2.38 d**, so an 80% interval is ≈ ±3.0 days (6 days wide) and a 95% interval is ≈ ±4.7 days (9.4 days wide).
- For a typical app user with per-person SD ~3.8–4.1 days (S5, S6), an 80% interval is ≈ ±5.1 days (**10 days wide**) and a 95% interval ≈ ±8 days (**16 days wide**).
- A 16-day window is not a useful product. An 80% interval is the widest band that stays actionable while still being honest, and its miss rate (1 in 5) is easy to explain to a user.

### 4.2 Recommended construction (normal–normal conjugate predictive interval)

Given skip-corrected, winsorised cycle lengths `L_1 … L_n` (most recent first) with weights `w_i = ρ^(i-1)`, `ρ = 0.90`:

```
n_eff = (Σ w_i)² / Σ w_i²                       # Kish effective sample size
m     = Σ w_i L_i / Σ w_i                        # weighted mean

# --- within-person scale, shrunk toward a population value ---
σ0    = 3.5 days        # prior within-person SD  (S5: 3.79 at 35-39; S6: 3.72-4.14 across 18-45; S1: 2.6)
ν0    = 3               # prior pseudo-observations
SS    = Σ w_i (L_i - m)² / (Σ w_i / n_eff)       # weighted sum of squares, rescaled to n_eff
σ̂²    = (ν0·σ0² + SS) / (ν0 + n_eff - 1)
σ̂     = sqrt(σ̂²)

# --- location, shrunk toward the age-band population mean ---
τ0    = 4.5 days ; μ0 = age-band prior (table in §3.2)
prec  = 1/τ0² + n_eff/σ̂²
μ_post = (μ0/τ0² + n_eff·m/σ̂²) / prec
τ_post = sqrt(1/prec)

# --- predictive spread and interval ---
s_pred = sqrt(τ_post² + σ̂²)
df     = ν0 + n_eff - 1
half   = t_{0.90, df} · s_pred                   # 80% central interval
predicted_length   = round(μ_post)
predicted_date     = last_period_start + round(μ_post)
interval_low_date  = last_period_start + round(μ_post - half)
interval_high_date = last_period_start + round(μ_post + half)
```

**Worked behaviour of this formula** (computed, not cited — verify in unit tests). These rows use `ρ = 1`
(no decay) so that `n_eff = n`; with `ρ = 0.90` and `n = 12`, `n_eff ≈ 10.6`, which widens the window by
roughly 3–5%.

| n | user SD | μ_post (m = 29) | σ̂ | 80% half-width | window width |
|---|---|---|---|---|---|
| 1 (L = 30) | — | 29.6 | 3.50 | ±7.3 d | 15 d |
| 6 | 1.5 d | 29.0 | 2.45 | ±3.7 d | 7 d |
| 6 | 6.0 d | 29.0 | 5.21 | ±7.8 d | 16 d |
| 12 | 1.0 d | 29.0 | 1.85 | ±2.6 d | 5 d |
| 12 | 7.0 d | 29.0 | 6.41 | ±8.9 d | 18 d |

The n = 12 / SD = 1.0 case (±2.6 d) lands close to the empirical calendar-method ceiling implied by S11 (±3.0 d for MAE 1.90), which is a reassuring external sanity check.

### 4.3 Edge cases

| N | Behaviour |
|---|---|
| **N = 0** (no completed cycle) | **Do not predict a date.** Show no forecast; ask for the last period start date. If a start date exists but no completed cycle, you may show a purely population-based band: `μ0 ± 1.28 × 6.1 = μ0 ± 7.8 days` (using AWHS total SD 6.1, S5) and label it explicitly *"based on population averages, not your data."* |
| **N = 1** | Use the formula. Shrinkage does most of the work: `μ_post ≈ (μ0/τ0² + L1/σ0²)/(1/τ0² + 1/σ0²)`. Window ≈ 15 days. Label the confidence as low. |
| **N = 2** | Use the formula. `SS` is computable but near-degenerate; the `ν0 = 3` prior keeps `σ̂` sane. Note S2 explicitly **excluded users with only two tracked cycles** from its analysis — two cycles is genuinely uninformative about variability. |
| **N = 3–5** | Use the formula. Also require `σ̂ ≥ 2.0 days` as a floor so the app never shows a suspiciously tight window off three lucky cycles. **[SYNTHESIS]** |
| **N ≥ 8** | An alternative is the empirical `[Q10, Q90]` of the user's own cycle lengths. **Not recommended as primary:** with n = 8–12 the empirical 10th/90th percentiles are estimated from ~1 observation each and are extremely unstable. Use it only as a displayed *secondary* fact ("your last 12 cycles ranged from 26 to 33 days"). |
| **Perimenopausal / post-partum / post-HC** | Inflate `σ̂` (see §7) and consider suppressing the interval entirely during known transitions. |

### 4.4 Self-calibration (strongly recommended)

Because no published coverage figures exist for this setting, **the app should measure its own coverage locally** and adjust. **[SYNTHESIS]**

```
Over the last K ≥ 10 resolved predictions, compute
  cover = fraction of actual start dates that fell inside the displayed window.
If cover < 0.70 for two consecutive evaluations:  multiply `half` by 1.15 (cap at 2.0× cumulative).
If cover > 0.92 for two consecutive evaluations:  multiply `half` by 0.90 (floor at 0.7× cumulative).
```
This is a local, private, per-device recalibration and requires no server or population data.

---

## 5. Detecting skipped / missed logging

**CONFIDENCE: Strong for the problem and its magnitude; Moderate for the specific detection rule.**

### 5.1 What published methods do

| Approach | Rule | Source |
|---|---|---|
| Hard cutoffs | Exclude cycles **< 10 days or > 90 days** as "unlikely for a natural menstrual cycle" | S5 (AWHS), also used in S15's AWHS preprocessing |
| Hard cutoff (low end only) | Exclude cycles **< 10 days** | S6 (Flo) |
| Personalised outlier rule | Exclude a cycle when **its cycle-length-difference (CLD) exceeds that user's median CLD by ≥ 10 days**; plus exclude cycles > 90 days; plus exclude users with only 2 cycles. This removed a large share (reported as ~49%) of the raw cycle data. | S2 (Clue) |
| Generative latent-skip model | Observed cycle length is modelled as **the sum of `s+1` true cycle lengths**, with a per-user skip probability `π_i` and per-user typical length `λ_i` drawn from population hyperparameters `{κ, γ, α, β}`; `s` is inferred, not assumed | S3 |
| Latent multiplicity model | `y_ij ~ LogNormal(μ_ij + log(c_ij), τ_i)` where `c_ij ∈ {1..K}` is the number of true cycles inside observation `ij`, with `c_ij ~ Categorical(π)` and `π ~ Dirichlet_K(1,…,1)` | S15 |

S15's central methodological warning: methods that **"specify cycle skips a priori"** (i.e. decide "this 62-day gap is definitely two cycles" and then treat the split values as observed) suffer **estimation bias and overconfidence** — in their simulation, effects were attenuated toward zero and nominal-95% coverage fell to **0.000** at n = 5000, versus **0.945** for the uncertainty-propagating model. **Do not silently split and then treat the halves as ordinary data.**

### 5.2 Magnitude of the error if you don't handle it

- **Prediction:** at day 40 of an ongoing cycle, RMSE is **21.92 days** for a mean-of-prior-cycles baseline versus **11.77 days** for the skip-aware model — a **46% reduction** (S3). Even the same hierarchical model with skipping disabled (`s=0`) scores 14.78 d at day 40 (S3), so ~3 days of the gain is attributable specifically to modelling skips.
- **Statistics:** in Clue, the "consistently highly variable" group has mean cycle length **37.04 d but median 34 d** with SD 13.71 (S2) — a signature of contamination by merged cycles, not of a physiology with a 37-day mean.
- **Arithmetic (not a citation):** take `n` cycles of which `n−1` equal `L` and one is a merged `2L`. The mean becomes `L(n+1)/n`, i.e. inflated by `L/n`; and the sample SD becomes exactly `L/√n`. For `n = 6, L = 29`: the mean is inflated by **+4.8 days** and the SD goes from **0 to 11.8 days**. A single missed log can therefore manufacture an "extremely irregular" verdict out of a perfectly regular user. This is why a max−min "variability" display (§6) is uniquely fragile.

### 5.3 Recommended detection rule

**[SYNTHESIS — built from S3/S15's model structure and S2/S5's cutoffs, but the specific constants are mine.]**

For an observed gap `G` between consecutive logged period starts, with the user's current estimate `L̂` (§3) and scale `σ̂` (§4):

```
# 0. Hard bounds (S5, S6)
if G < 10:  treat as continuation of the same period, not a new cycle. Merge.
if G > 90:  do NOT split. Mark as `gap_unknown`; exclude from all statistics
            and from prediction inputs. (matches S5/S15 preprocessing)

# 1. Never split anything that could be a normal long cycle
if G < 45:  accept as a single cycle.        # FIGO upper normal is 38 d (S7);
                                             # S1 observed 26% of cycles in 31-50 d.
                                             # 45 keeps a wide safety margin.

# 2. Score candidate multiplicities
K_max = floor(G / 19)                        # implied cycle must be >= 19 days
for k in 1 .. K_max:
    z_k = (G - k*L̂) / (sqrt(k) * max(σ̂, 2.5))
k*  = argmin_k |z_k|

# 3. Flag only when the evidence is decisive
skip_suspected = (k* >= 2)
             AND (|z_1|  > 3.0)              # k=1 is a poor fit
             AND (|z_k*| < 1.5)              # some k>=2 is a good fit
             AND (G/k*  >= 19)               # implied length is physiologically plausible
             AND (G/k*  <= 45)
```

**How it should affect statistics and predictions:**

1. **Never mutate the user's data.** Store `skip_suspected` and `k*` as derived annotations on the interval.
2. **Exclude, don't impute, by default.** Drop the flagged gap from the inputs to `m`, `σ̂` and every displayed statistic. This mirrors S2 and S5, which both *excluded* rather than split. It also avoids S15's over-confidence failure mode, because an excluded observation contributes no false certainty.
3. **Optionally, offer the split to the user.** A one-tap "Did you miss logging a period around <date>?" prompt converts an inference into ground truth. This is the highest-value UI affordance in this whole document: it turns the app's single largest error source into a user-answerable question.
4. **If the user confirms**, insert an `inferred` period start at `last_start + round(G/k*)` and mark the resulting cycles with reduced weight (e.g. `w × 0.5`) so they do not tighten `σ̂` as if they were observed. **[SYNTHESIS, motivated by S15.]**
5. **Suppress skip detection for known-variable contexts** — perimenopause (§7), first 6 cycles post-partum, first 3 cycles post-hormonal-contraception — where genuinely long cycles are common and a split would be wrong.
6. Also apply a **recall-error caveat**: users systematically **overestimate** their cycle length by ~0.7 days (95% CI 0.3–1.0) when reporting retrospectively, with Spearman correlation between reported and observed length of only **0.45** (S17). Manually back-entered dates deserve less weight than prospectively logged ones.

---

## 6. What "cycle variability" to display, and the regular/irregular thresholds

**CONFIDENCE: Strong for the clinical thresholds; Moderate for the choice of display metric.**

### 6.1 The candidate metrics, and what uses each

| Metric | Definition | Used by | Property |
|---|---|---|---|
| **FIGO range** | longest − shortest cycle over 12 months | S7 (FIGO AUB System 1) | Clinical standard; **maximally fragile** to one unlogged cycle; grows mechanically with the number of cycles observed |
| Flo irregularity | longest − shortest > 7 days, **at least twice** in a 12-month period | S6 | The "twice" requirement adds a little robustness |
| **Median CLD** | median of `|L_i − L_{i-1}|` over consecutive cycles | S2, S18 | Robust to a single outlier; the digital-cohort standard |
| Per-person SD | SD of the user's cycle lengths | S1, S6 | Familiar but not robust; not clinically anchored |
| Model residual SD | SD of residuals from a mixed model | S5 | Best statistically; not computable meaningfully at N = 3–12 on-device |

### 6.2 Clinical thresholds (FIGO AUB System 1, via S7)

- **Normal frequency of menses, ages 18–45: 24–38 days.** Below 24 = "frequent"; above 38 = "infrequent". Derived from the 5th–95th percentiles of large population studies.
- **Regularity — age-stratified shortest-to-longest variation over 12 months:**
  - ages **18–25** and **42–45**: **≤ 9 days**
  - ages **26–41**: **≤ 7 days**
  - Direct quote from S7: *"for those aged either 18–25 or 42–45 years, the difference between the shortest and longest cycle should be 9 days or less, while for those aged 26–41 years, it is 7 days or less."*

For adolescents specifically, the widely-cited normal window is **21–45 days** (S16 characterises atypical cycle length as *"<21 days, >45 days"*; ACOG Committee Opinion 651's "90% of cycles 21–45 days" figure could not be retrieved in full text — see final section).

### 6.3 Critical caveat before you ship an "irregular" badge

The FIGO ≤7-day threshold is **not** a rare-event threshold in the general population:

- **46% of women** who describe themselves as having regular cycles have a prospectively-measured range **≥ 7 days** (S10).
- **42.5% of women** show intracycle variability **> 7 days** (S8).
- Only **20%** exceed a 14-day range (S10).

So a naive "your cycles are irregular" message would fire for roughly **four users in ten**, most of whom are entirely healthy. **[SYNTHESIS of S8 + S10.]**

### 6.4 Recommendation

Display **two things**, and never use the word "abnormal":

1. **Headline (descriptive, no judgment):** *"Over your last 12 cycles, your cycle length ranged from 26 to 33 days."* This is the FIGO measurement, presented as a fact rather than a verdict, computed **only after skip correction (§5)** and only when N ≥ 6.
2. **Regularity classification (robust, internal):** use **median CLD**, with these bands:
   - median CLD ≤ 3 days → "very consistent"
   - 4–8 days → "typical variation"
   - ≥ 9 days → "high variation" — matching the S2/S18 threshold, which flags 7.68% of ages 21–33 (S2) and ~23% of a broad adult cohort (S18).
3. **Clinical flag (separate from "variability"), using FIGO frequency limits (S7):** surface a gentle "worth mentioning to a clinician" note only when, over 12 months: any cycle < 24 d or > 38 d recurs, **or** the FIGO range exceeds the age-stratified cutoff (9 d for 18–25 and 42–45; 7 d for 26–41) **and** median CLD ≥ 9 d. Requiring both a fragile and a robust criterion to agree avoids firing on a single logging lapse. **[SYNTHESIS.]**

Do **not** display raw SD as the primary variability number — it is neither clinically anchored (unlike the FIGO range) nor robust (unlike median CLD), and at N = 3–6 it is a very noisy estimate.

---

## 7. Age and life-stage effects a single-user app can act on

**CONFIDENCE: Strong for age and perimenopause; Moderate for adolescence and post-contraception; Weak/Unverified for postpartum.**

### 7.1 Age (Strong)

| Effect | Value | Source |
|---|---|---|
| Cycle length decline, ages 25–45 | **−0.18 days/year** (95% CI 0.17–0.18, R² = 0.99) | S1 |
| Follicular phase decline, ages 25–45 | −0.19 d/yr (95% CI 0.19–0.20) | S1 |
| Luteal phase across age | **stable** | S1 |
| Mean cycle length by band | 28.54 d (18–25) → 27.15 d (46–50) → 28.00 d, SD 3.70 (51–55) | S6 |
| Variability minimum | **ages 35–39** (residual SD 3.79 d, S5) / **36–40** (SD 3.72 d, S6) | S5, S6 |
| Variability vs the 35–39 minimum | **+46%** under 20; **+45%** at 45–49; **+200%** above 50 | S5 |
| Irregular-cycle prevalence | 20% (18–25) → 13.8% (36–40) → 28.3% (46–50) → **44.7% (51–55)** | S6 |

**App action:** set the population prior `μ0` from the age table in §3.2, and scale the prior within-person SD `σ0` by age: ×1.4 for under-20, ×1.0 for 26–44, ×1.4 for 45–49, ×2.0 for 50+. **[SYNTHESIS from S5's +46%/+45%/+200% figures.]**

### 7.2 Perimenopause (Strong)

From S14 (TREMIN cohort, 617 women, 95,246 menstrual segments, hierarchical change-point model):

- **Variability begins increasing at age 42.84 years** (95% CI 42.49–43.17).
- **Mean cycle length changes course at age 46.23 years** (95% CI 45.91–46.55).
- The variability change point precedes the mean change point by **3.39 years** (95% CI 3.07–3.74).
- Before the variability change point, mean length declines ~**1% per year**; after the mean change point it increases ~**15% per year**.
- After the variability change point, variability increases **~81% per year**.

**App action:** from age ~43, widen intervals progressively and **disable aggressive skip detection** — genuinely long cycles become common and splitting them would be wrong. From ~46, expect the mean to start rising, so the `ρ = 0.90` recency decay is doing real work here (this is the one life stage where recency weighting earns its keep).

### 7.3 Adolescence (Moderate)

- **56–76% of individuals achieve regular cycles within 2 years post-menarche** (AWHS, reported in S16). Mean time to regularity rose from **1.27 to 1.40 years** across birth cohorts 1950–2005 (S16).
- **By the third year post-menarche, ~60–80% of cycles fall in 21–34 days** (S16).
- **Half of cycles are anovulatory in the first two post-menarcheal years** (S16).
- **Cycle length exceeded 40 days in 38.3% of girls at the first cycle, falling to 7.9% by the 19th cycle**; and **52% achieved three successive cycles within 20–40 days by the seventh cycle** (Gruber & Modan-Moses, "Menstrual Cycle in Adolescents: Updating the Normal Pattern", *JCEM* 2021;106(1):e372, https://academic.oup.com/jcem/article/106/1/e372/5952706 — **retrieved only at search-snippet level, full text not obtained; treat as Moderate**).

**App action:** if the user reports gynaecological age < 3 years, widen intervals substantially, suppress "irregular" language entirely, and use 21–45 days rather than 24–38 as the plausibility window.

### 7.4 Post-hormonal-contraception (Moderate)

- **47.2% of 2,845 women had a first post-combined-oral-contraceptive cycle of 26–32 days; 40.5% had a second cycle in that range** — and the paper concluded that a first in-range cycle **did not reliably predict** a second in-range cycle (S19).
- Natural Cycles' own (non-peer-reviewed) research library reports first cycles of ~31 days (pill/hormonal IUD/ring), ~32 days (mini pill), ~32.5 days (implant), with median ovulation day stabilising to cycle day 17 by the second cycle. **This is company marketing content, not peer-reviewed — treat as Weak.** (https://www.naturalcycles.com/research-library/how-soon-does-ovulation-return-after-stopping-hormonal-birth-control)

**App action:** if the user flags "recently stopped hormonal contraception", down-weight the first 3 cycles and do not compute a variability verdict until 6 post-HC cycles exist.

### 7.5 Postpartum / breastfeeding (Weak — could not verify)

I could **not** retrieve peer-reviewed numeric estimates of first-postpartum-cycle length or its variability. The relevant study appears to be Bouchard T, Schneider M, Fehring R, "Efficacy of a new postpartum transition protocol for avoiding pregnancy", *J Am Board Fam Med* 2013;26:35–44 (198 postpartum women, prospective 12-month cohort), which secondary sources describe as finding that the first postpartum cycle shows later ovulation and greater length than subsequent cycles — but **both the JABFM full text and the Marquette repository copy returned HTTP 403** and I could not verify any number. **Do not ship postpartum-specific constants based on this document.**

**App action:** if the user flags "postpartum", suppress predictions until 3 completed cycles are logged, and show an explanatory message rather than a wide window.

---

## 8. Measuring and displaying prediction performance

**CONFIDENCE: Strong for the metrics the literature uses; Synthesis for the display recommendation.**

### 8.1 Metrics used in the literature

| Metric | Used by | Example values |
|---|---|---|
| **MAE** (mean absolute error, days) | S11, S3 | 1.70 d (95% CI 1.57–1.84) for a wrist-temperature algorithm; 1.90 d for the calendar method (S11) |
| **ME** (mean *signed* error, days) — a bias check | S11 | −0.06 d (95% CI −0.28, 0.18); reported precisely to demonstrate the algorithm is unbiased |
| **Median absolute error** | S3 | 1.5 d for users with median CLD = 0 |
| **RMSE** | S3 | 7.38–7.50 d at day 0; 11.77–21.92 d at day 40 |
| **PAE3** — proportion of absolute errors ≤ 3 days | S11 | 88.4% (algorithm) vs 84% (calendar), p < 0.001 |
| **Interval coverage** | S15 (simulation only) | 0.945 (correct model) vs 0.000 (skips fixed a priori) |

Note the **MAE / RMSE gap** in S3 (median absolute error 1.5 d but RMSE 6.15 d for the *same* users) — always report a robust metric alongside a squared one, or the outliers will hide.

### 8.2 Recommendation for this app

**[SYNTHESIS, but every metric named is one used in S3/S11/S15.]**

Show the user three things, in plain language, after each resolved cycle and as a rolling summary:

1. **Signed error for the last cycle** — *"Your period came 2 days earlier than predicted."* Signed, not absolute, because it is the intuitive form and it lets the user see systematic bias themselves. Corresponds to **ME** (S11).
2. **Rolling typical miss over the last 6–12 predictions** — *"Over the last 8 cycles, predictions have been off by about 2 days on average."* Use **median absolute error** for the headline (robust, and directly comparable to S3's 1.5 d and S11's 1.65–1.90 d) and compute MAE internally.
3. **Window hit rate** — *"Your period started inside the predicted window 7 of the last 9 times."* This is empirical **coverage** and it is the only number that validates the interval (§4.4). Compare against the 80% target.

Internally track, but do not display: RMSE (to detect outlier-driven blowups), PAE3 (≤3 days is S11's chosen operational threshold and a good product KPI), and per-metric trends that trigger the recalibration loop in §4.4.

**Do not display a single "accuracy %" figure.** S13 shows how misleading app-reported accuracy claims can be: across 10 apps, ovulation predictions were **2–9 days early in 67% of cases** and exactly correct in only **8%** — yet those apps present themselves as accurate. An honest, locally-computed hit rate is the differentiator for a privacy-first app.

---

## RECOMMENDED ALGORITHM FOR THIS APP

Everything below is implementable without further research. Constants that come from a citation are
marked with the source; constants that are engineering choices are marked `[choice]` and should be
treated as tunable defaults.

### Constants

```python
# --- population priors ---
MU0_BY_AGE = {                 # S6 (Flo, 19M users), cross-checked S1/S5
    (0, 26):  28.5,
    (26, 31): 28.3,
    (31, 36): 28.0,
    (36, 41): 27.7,
    (41, 46): 27.4,
    (46, 51): 27.2,
    (51, 200):28.0,
}
MU0_DEFAULT   = 29.0           # S1 mean 29.3; S2 29.45; S5 28.7; S6 28.5  -> 29.0
TAU0          = 4.5            # between-person SD of individual mean; derived from S5
SIGMA0        = 3.5            # prior within-person SD; S5 3.79 @35-39, S6 3.72-4.14, S1 2.6
NU0           = 3              # prior pseudo-observations                   [choice]

# --- age/life-stage scaling of SIGMA0 --- (from S5: +46% <20, +45% 45-49, +200% >50)
def sigma0_scale(age, flags):
    s = 1.0
    if age is not None:
        if age < 20:      s *= 1.45
        elif age >= 50:   s *= 2.0
        elif age >= 45:   s *= 1.45
        elif age >= 43:   s *= 1.25          # S14: variability change point 42.84 y
    if flags.gyn_age_years is not None and flags.gyn_age_years < 3: s *= 1.6   # S16
    if flags.cycles_since_stopping_hc is not None and flags.cycles_since_stopping_hc < 4: s *= 1.4  # S19
    if flags.postpartum_cycles is not None and flags.postpartum_cycles < 4:    s *= 1.6  # UNVERIFIED
    return s

# --- estimator ---
WINDOW        = 12             # cycles; matches FIGO's 12-month window (S7) and S6
RHO           = 0.90           # recency decay, half-life ~6.6 cycles        [choice]
                               # kept gentle because S2 found cycle stats are stationary
SIGMA_FLOOR   = 2.0            # days; never claim tighter than this          [choice]

# --- validity / skip detection ---
MIN_CYCLE     = 10             # S5, S6: cycles <10 d excluded
MAX_CYCLE     = 90             # S5, S15: cycles >90 d excluded, never split
NO_SPLIT_BELOW= 45             # never split a gap under 45 d (FIGO upper normal 38 d, S7)
MIN_IMPLIED   = 19             # implied split cycle must be >=19 d           [choice]
MAX_IMPLIED   = 45             #                          and <=45 d          [choice]
Z1_MIN        = 3.0            # k=1 must fit badly                          [choice]
ZK_MAX        = 1.5            # some k>=2 must fit well                     [choice]

# --- interval ---
TARGET_COVERAGE = 0.80         # 80% central interval                        [choice, justified in 4.1]
LUTEAL_MEAN     = 12.5         # S1 (12.4) + S4 (12-13)
LUTEAL_SD       = 2.4          # S1
```

### Pipeline

```
STEP 1 — build raw gaps
  starts = sorted period start dates
  gaps   = [starts[i+1] - starts[i] for i in ...]

STEP 2 — validity + skip annotation   (§5)
  for each gap G (most recent first):
      if G < MIN_CYCLE:      merge into previous period; drop
      elif G > MAX_CYCLE:    status = GAP_UNKNOWN            # excluded, never split
      elif G < NO_SPLIT_BELOW: status = OK
      else:
          K = floor(G / MIN_IMPLIED)
          z = { k: (G - k*L_hat) / (sqrt(k) * max(sigma_hat, 2.5)) for k in 1..K }
          k_star = argmin_k |z[k]|
          if k_star >= 2 and |z[1]| > Z1_MIN and |z[k_star]| < ZK_MAX \
             and MIN_IMPLIED <= G/k_star <= MAX_IMPLIED \
             and not (perimenopausal or postpartum or recent_hc_stop):
                status = SKIP_SUSPECTED (k = k_star)          # excluded; offer user prompt
          else:
                status = OK
  usable = gaps with status == OK, most recent WINDOW of them
  (if the user confirms a skip, insert inferred starts and set weight *= 0.5)

STEP 3 — location and scale   (§3, §4)
  n = len(usable)
  if n == 0: -> see EDGE CASES
  w_i     = RHO ** i                       # i = 0 for most recent
  W1      = sum(w); W2 = sum(w^2)
  n_eff   = W1*W1 / W2
  m       = sum(w_i * L_i) / W1
  SS      = (sum(w_i * (L_i - m)^2) / W1) * n_eff     # weighted SS scaled to n_eff
  s0      = SIGMA0 * sigma0_scale(age, flags)
  sigma2  = (NU0 * s0^2 + SS) / (NU0 + n_eff - 1)
  sigma   = max(sqrt(sigma2), SIGMA_FLOOR)

  mu0     = MU0_BY_AGE[age] if age known else MU0_DEFAULT
  prec    = 1/TAU0^2 + n_eff/sigma^2
  mu_post = (mu0/TAU0^2 + n_eff*m/sigma^2) / prec
  tau_post= sqrt(1/prec)

STEP 4 — point prediction and interval   (§4)
  s_pred = sqrt(tau_post^2 + sigma^2)
  df     = NU0 + n_eff - 1
  half   = t_quantile(0.90, df) * s_pred * calibration_factor   # see STEP 7
  predicted_start   = last_start + round(mu_post)
  window            = [last_start + round(mu_post - half),
                       last_start + round(mu_post + half)]

STEP 5 — ovulation estimate (backwards)   (§2)
  ovulation_est = predicted_start - LUTEAL_MEAN
  ovulation_sd  = sqrt(s_pred^2 + LUTEAL_SD^2)
  # NEVER assume a fixed 14-day luteal phase (S4: only ~24% ovulate on day 14-15)
  # present as a range, width = 2 * 1.28 * ovulation_sd for an 80% band

STEP 6 — displayed statistics   (§6)
  typical_length   = round(mu_post)
  range_12mo       = (min(usable), max(usable))          # FIGO measure, S7 — after skip correction
  median_CLD       = median(|L_i - L_{i+1}|) over usable # S2, S18
  regularity_band  = "very consistent" if median_CLD <= 3
                     else "typical variation" if median_CLD <= 8
                     else "high variation"               # >= 9 d threshold: S2, S18
  clinical_note    = TRUE only if (over 12 months)
                       (recurring cycle < 24 d or > 38 d)                     # S7
                       OR ( (range_12mo span > (9 if age in [18,25]+[42,45] else 7))   # S7
                            AND median_CLD >= 9 )                             # S2/S18
                     and n >= 6

STEP 7 — self-calibration   (§4.4)
  over the last K >= 10 resolved predictions:
      cover = fraction of actual starts inside the displayed window
      if cover < 0.70 twice in a row: calibration_factor *= 1.15   (cap 2.0)
      if cover > 0.92 twice in a row: calibration_factor *= 0.90   (floor 0.7)

STEP 8 — performance display   (§8)
  last_signed_error = actual_start - predicted_start          # ME (S11)
  rolling_median_abs_error over last 6-12 resolved            # S3, S11
  window_hit_rate = cover                                     # empirical coverage
```

### Edge cases by N

| N (usable cycles) | Behaviour |
|---|---|
| **0** | No date prediction. Prompt for the last period start. If a start exists, optionally show `mu0 ± 8 days` (80% band using AWHS total SD 6.1, S5), labelled **"population estimate — not based on your data."** No variability display. |
| **1** | Run the pipeline. `SS = 0`, so `sigma = s0`. Window ≈ 15 days wide. Label "low confidence — one cycle recorded". No variability display, no clinical note. |
| **2** | Run the pipeline. Note S2 excluded 2-cycle users from analysis entirely — display a "still learning" state rather than a variability verdict. |
| **3–5** | Run the pipeline. `SIGMA_FLOOR = 2.0` prevents a spuriously tight window. Show typical length + window; show range but **not** the regularity band or clinical note. |
| **6–11** | Full display: typical length, window, range, regularity band. Clinical note enabled. Start self-calibration once ≥ 10 predictions have resolved. |
| **12** | Steady state. Window drops the 13th-oldest cycle. Expect a window of ~5–7 days for a consistent user and ~16–18 days for a highly variable one. |
| **any N, with a SKIP_SUSPECTED gap** | Exclude it, surface the "did you miss logging a period?" prompt, and if that drops N below 3, degrade to the N = 1–2 presentation rather than silently keeping a corrupted estimate. |

### What NOT to do (each backed by a source)

- Do **not** assume a 28-day cycle — only 13% of cycles are 28 days (S1).
- Do **not** assume a 14-day luteal phase — only ~24% of ovulations fall on day 14–15 (S4), and 20–26% of cycles have luteal phases under 10 days (S4, S9).
- Do **not** compute the mean over raw gaps without skip handling — day-40 RMSE 21.92 vs 11.77 (S3).
- Do **not** silently split a long gap and treat the halves as observed — this is exactly the failure mode S15 demonstrates (coverage 0.000 vs 0.945).
- Do **not** show a max−min "variability" number without skip correction — a single missed log roughly doubles it (arithmetic).
- Do **not** call a 7-day range "irregular" without heavy caveats — 42.5–46% of healthy women exceed it (S8, S10).
- Do **not** invest in sensors before robustness — wrist temperature buys 0.20 days of MAE over the calendar method (S11), BBT buys ~0.36 days (S12), while skip handling buys ~10 days of RMSE at long horizons (S3).

---

## WHAT I COULD NOT VERIFY

Items I searched for and could **not** confirm from a retrieved source. Do not treat any of these as established.

1. **ACOG Committee Opinion No. 651 full text.** The commonly cited figure "90% of adolescent cycles range from 21 to 45 days" appeared repeatedly in search results and secondary outlets, but `acog.org` returned **HTTP 402** and the LWW *Obstetrics & Gynecology* full text failed to load. The closest I verified is S16 (Naveed & Whooten 2024), a fetched peer-reviewed review, which characterises atypical adolescent cycle length as *"<21 days, >45 days"*. **The 21–45 day range is supported; the "90%" figure is not directly verified.**

2. **FIGO 2018 revision primary text** (Munro et al., *Int J Gynecol Obstet* 2018;143:393–408). Wiley returned **HTTP 403**. All FIGO System 1 numbers in this document (24–38 days; ≤7/≤9 day regularity by age) come from S7, the 2022 FIGO Ovulatory Disorders paper, which restates them. The 2022 FIGO AUB update was not separately retrieved.

3. **Bull et al. 2019 percentage of women with cycle-to-cycle variation > 7 or > 9 days.** Not reported in the paper. S1 reports only the mean per-woman SD (2.6 ± 2.5 days) and a BMI contrast (+0.4 days / +14% for BMI > 35). The >7-day and >14-day fractions in §1.2 come from S10 and S8, which are **different, much smaller cohorts** (130 and 141 women) with prospective diaries — better measured but less representative than an app cohort.

4. **Fehring et al. 2006 follicular and luteal phase means/SDs.** Only the abstract was retrievable (S8, via PubMed); the Marquette e-Publications full-text PDF returned **HTTP 403** twice, as did ScienceDirect and JOGNN. Verified from the abstract: cycle length 28.9 d (SD 3.4), 95% of cycles 22–36 d, intracycle variability > 7 days in 42.5% of women, follicular phase contributes most to variability. **Per-phase means and SDs from this study are unverified.**

5. **Grieger & Norman 2020** (*JMIR* 2020;22(6):e17109, Flo cohort). Both the JMIR HTML and PDF, and the ScienceDirect mirror, returned 403 or unparseable binary. **No numbers from this study are used.** Its role is covered by S6 (Cunningham 2024, also Flo, much larger).

6. **Li et al. 2020's exact engagement-filtering yield.** The PMC fetch reported that the exclusion procedure "removed approximately 49% of initial cycle data". I could not independently re-verify this specific percentage against the paper's own wording. The exclusion *rules* themselves (CLD exceeding the user's median CLD by ≥10 days; cycles > 90 days; users with only two cycles) are reported consistently and are used above; **treat the 49% figure as Moderate.**

7. **Postpartum cycle length and variability numbers.** JABFM (Bouchard/Schneider/Fehring 2013) and the Marquette repository copy both returned **HTTP 403**. No numeric postpartum constants are recommended in this document.

8. **Any published prediction-interval construction or coverage evaluation for an individual user with 3–12 cycles.** I searched specifically for this and found nothing. S3 explicitly reports no calibration or coverage. S15 reports coverage only for simulated regression coefficients. **The interval formula in §4 is my synthesis; its inputs are cited but the construction itself is unvalidated and must be self-calibrated on-device (§4.4).**

9. **Head-to-head comparison of trimmed means or exponentially-weighted averages against plain mean/median for cycle prediction.** No such study found. S3 compares mean, median, CNN, RNN, LSTM, and a hierarchical Bayesian model only. The `RHO = 0.90` decay and the winsorisation are engineering choices justified indirectly by S2's stationarity finding and S3's outlier-dominated loss.

10. **Fukaya 2017 absolute prediction error.** S12 reports only the *reduction* in MAE relative to a calendar baseline (median 0.361 d, mean 0.461 d, max-reduction range 0.056–1.368 d), not the absolute MAE of either method. The absolute calendar-method MAE of 1.90 days used in §1.3 comes from S11, a different (prospective, 260-participant) study.

11. **Gruber & Modan-Moses 2021 (JCEM) adolescent figures.** Retrieved only at search-snippet level; the Oxford Academic full text was not fetched. The figures (52% reaching three successive 20–40 day cycles by cycle 7; cycles > 40 days in 38.3% at cycle 1 falling to 7.9% by cycle 19) are cited as **Moderate**.

12. **Natural Cycles post-hormonal-contraception cycle lengths** (31 / 32 / 32.5 days by contraceptive type; median ovulation stabilising to CD17 by cycle 2). This comes from the company's own research-library web page, not a peer-reviewed publication. **Weak — do not use as a constant.**
