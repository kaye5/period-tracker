# Track C — Additional Data Worth Collecting & Health-Awareness Thresholds

Research for a privacy-first, single-user, local-only menstrual cycle tracking app.

**Compiled:** 2026-07-22
**Scope:** (a) what data beyond period dates is evidence-backed; (b) exact clinical thresholds for
non-diagnostic health-awareness messages; (c) the regulatory line between wellness app and medical device.

**Confidence markers used throughout:**

- **CONFIDENCE: Strong** — I fetched the primary source (guideline text, peer-reviewed full text) and the
  number/quote is taken verbatim from it.
- **CONFIDENCE: Moderate** — I retrieved a reliable secondary source (abstract, indexed summary, reputable
  law-firm alert quoting the primary), but not the full primary text.
- **CONFIDENCE: Weak-Unverified** — I could not retrieve a citable primary or good secondary source. Treat as
  a hypothesis, do not ship a claim on it.

> **Non-negotiable framing rule for this whole document:** every number below is an *awareness* threshold for
> deciding when to surface an educational message. None of it is a diagnostic rule, and the app must never
> present it as one. See Part 3 (Regulatory).

---

## PART 1 — ADDITIONAL DATA WORTH COLLECTING

### 1.1 Baseline: how bad is calendar-only, really?

Before adding signals, the honest baseline. Two large app-data studies:

**Bull JR et al. (2019), "Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles",
*npj Digital Medicine*** — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244/>

- 612,613 ovulatory cycles from 124,648 users (Natural Cycles data, i.e. BBT+LH confirmed).
- Mean cycle length **29.3 ± 5.2 days**; only **13%** of cycles (81,605) were exactly 28 days.
- **91.4%** of cycles fell in 21–35 days.
- Mean follicular phase **16.9 days**; mean luteal phase **12.4 ± 2.4 days**; **18%** of cycles had a luteal
  phase shorter than 11 days.
- Mean per-woman cycle-length variation **2.6 ± 2.5 days**.
- Verbatim: *"It is a common belief that ovulation occurs on day 14 of the cycle, but our analysis has shown
  that for the majority of women in the real-world that this is not the case."*

**Symul L, Wac K, Hillard P, Salathé M (2019), "Assessment of menstrual health status and evolution through
mobile apps for fertility awareness", *npj Digital Medicine*** — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6635432/>

- 200,000 users, >2.7M cycles, >30M days of observations (Sympto + Kindara).
- **Only 24% of ovulations occurred on cycle days 14 to 15**; **90% of ovulations occurred between day 10 and
  day 24**.
- Median follicular phase 16 days (not 14). Median luteal phase 12–13 days; **~20% of cycles had a luteal
  phase ≤10 days**.
- Mean BBT shift mid-follicular → mid-luteal: **~0.36 °C / 0.7 °F**.
- Engagement datum relevant to burden: **>40% of cycles were tracked every single day when seeking pregnancy**;
  intercourse was logged in 65–75% of standard cycles.

**CONFIDENCE: Strong.**

**Implication for this app:** a calendar-only model can predict *next menses* reasonably (variation ≈2.6 days
for most users) but **cannot** locate ovulation. Anything the app says about the fertile window from dates
alone is a wide prior, not a measurement. This is the single strongest argument for optional extra signals —
and for honest uncertainty display.

---

### 1.2 Basal body temperature (BBT)

**The central finding: BBT is a retrospective confirmation signal, not a prospective predictor.**

**Su HW, Yi YC, Wei TY, Chang TC, Cheng CM (2017), "Detection of ovulation, a review of currently available
methods", *Bioengineering & Translational Medicine*** — <https://pmc.ncbi.nlm.nih.gov/articles/PMC5689497/>

- Verbatim: *"time of ovulation determined by BBT coincided with the LH surge ± 1 day in only 17 of 77 cycles
  (22.1%)"*.
- BBT *"rises 0.5–1.0 °F and plateaus throughout the luteal phase"* — i.e. the shift is detectable only
  **after** the fact, and only after ~3 days of sustained elevation under standard rules.
- **CONFIDENCE: Strong.**

**Effectiveness of BBT-only fertility awareness methods** (a proxy for how well BBT alone brackets the fertile
window in real use):

**Peragallo Urrutia R, Polis CB, Jensen ET, Greene ME, Kennedy E, Stanford JB (2018), "Effectiveness of
Fertility Awareness–Based Methods for Pregnancy Prevention: A Systematic Review", *Obstetrics & Gynecology*
132(3):591–604** — full text PDF retrieved from
<https://www.sensiplan.nl/wp-content/uploads/2025/02/Effectiveness-of-Fertility-Awareness%E2%80%93Based-Methods-for-Pregnancy-Prevention_A-Systematic-Review.pdf>

- Verbatim from abstract: *"9.0–9.8 for basal body temperature methods"* (first-year typical-use pregnancy
  rates/probabilities per 100 woman-years, among moderate-quality studies).
- **CONFIDENCE: Strong.**

**Where BBT is genuinely useful in this app:**

1. Retrospective ovulation-day estimate → lets you learn the user's *actual* luteal phase length, which is the
   most stable part of the cycle and therefore the best lever for improving next-menses prediction.
2. Detecting short luteal phases (~18–20% of cycles per Bull/Symul) — as an *observation to note*, never as a
   diagnosis of luteal phase deficiency.

**Where BBT is not useful:** telling the user "you will ovulate tomorrow." Do not build that.

**User burden: HIGH.** Requires waking-time measurement before rising, same time daily, and is confounded by
alcohol, illness, poor sleep, shift work.

---

### 1.3 Wearable-derived temperature (the strongest new evidence, 2024–2025)

**Oura ring — Thigpen N, Patel S, Zhang X (2025), "Oura Ring as a Tool for Ovulation Detection: Validation
Analysis", *J Med Internet Res* 27:e60667** — <https://pmc.ncbi.nlm.nih.gov/articles/PMC11829181/>

| Metric | Oura physiology algorithm | Calendar method |
|---|---|---|
| Ovulations detected | **96.4%** (1113 / 1155) | — |
| Mean absolute error | **1.26 days** | 3.44 days |
| Within ±1 day | **68%** | 32.2% |
| Within ±2 days | **87.9%** | 50.7% |
| Within ±3 days | **95%** | 66.5% |
| Irregular cycles, within ±2 days | **82%** | 32.5% |
| Regular cycles detection / MAE | 97.5% / 1.23 d | — |
| Irregular cycles (>7 d variation) detection / MAE | 94.0% / — | — / 6.63 d |

- N = 1,155 ovulatory cycles from 964 members, ages 18–52.
- **Reference standard = self-reported positive LH test (OPK), not ultrasound.** This inflates apparent
  accuracy relative to a follicular-rupture reference.
- Stated limitations, verbatim: the *"dataset consisted solely of ovulatory cycles"*; LH data subject to
  *"human error and subjective reporting biases"*.
- **CONFIDENCE: Strong** (for the numbers as reported); **Moderate** for generalisation, because of the LH
  reference standard and the vendor-authored analysis.

**Apple Watch wrist temperature — Wang Y, Park J, Zhang CY, et al. (2025), "Performance of algorithms using
wrist temperature for retrospective ovulation day estimate and next menses start day prediction: a prospective
cohort study", *Human Reproduction* 40(3):469–478** —
<https://academic.oup.com/humrep/article-abstract/40/3/469/7989515>

- N = 260 participants, 889 cycles (Apple Women's Health Study). Reference: *"One day after a logged positive
  LH test was defined as the day of ovulation"*.
- Completed cycles, wrist-temperature signal ≥0.2 °C: **MAE 1.22 days; 89.0% within ±2 days; sensitivity 80.8%**.
- Ongoing (in-progress) cycles: **MAE 1.59 days; 80.0% within ±2 days; sensitivity 80.5%**.
- Next-menses prediction: **MAE 1.65 days; 89.4% within ±3 days**.
- **CONFIDENCE: Strong** (abstract retrieved directly).

**Oura ring, independent academic cohort — Gombert-Labedens M, Alzueta E, Perez-Amparan E, et al. (2024),
"Using wearable skin temperature data to advance tracking and characterization of the menstrual cycle in a
real-world setting", *Journal of Biological Rhythms* 39(4):331–350** —
<https://pmc.ncbi.nlm.nih.gov/articles/PMC11294004/>

- 120 individuals (18–52 y) wore an Oura Gen 2 ring; 116 had analysable temperature data.
- *"LH kit and temperature oscillation detection showed agreement in 82% of cases"* (N=111).
- Luteal temperature elevation quoted as 0.3–0.7 °C.
- **CONFIDENCE: Strong.**

**Multi-sensor bracelet — Goodale BM, Shilaih M, Falco L, et al. (2019), "Wearable Sensors Reveal
Menses-Driven Changes in Physiology and Enable Prediction of the Fertile Window", *J Med Internet Res*
21(4):e13404** — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6495289/>

- 1,194 cycles across 193 participants.
- Significant cycle-phase variation (p<.001) in **wrist skin temperature** (follicular 33.87 °C → late luteal
  34.32 °C), **heart rate** (follicular 56.56 bpm → late luteal 60.47 bpm), and **respiratory rate**. HRV and
  skin perfusion only *"trended toward significance"* after Bonferroni correction.
- *"The algorithm accurately detected the 6-day fertile window in 90% of cycles (95% CI 0.89 to 0.92)"*,
  specificity 0.93, sensitivity 0.81.
- **CONFIDENCE: Strong.**

**Net read on wearables:** distal/wrist temperature is now the best-evidenced *low-burden* ovulation signal,
with roughly **1.2–1.6 day mean error and ~80–89% of cycles within ±2 days** for retrospective estimation
across two independent 2024–2025 datasets. It is decisively better than calendar (3.4 day MAE), and the gap is
largest precisely for the users who need it most (irregular cycles: 82% vs 32.5% within ±2 days).

**But** for a local-only app, the constraint is *ingestion*, not algorithms: on iOS this means HealthKit
(`HKQuantityTypeIdentifier.appleSleepingWristTemperature`, resting HR, HRV, respiratory rate); on Android,
Health Connect. Both can be read locally with no server. **This is the single highest-value addition per unit
of user burden**, because the burden is a one-time permission grant.

---

### 1.4 Urinary LH tests (OPKs)

**Su et al. 2017** (URL above):

- Verbatim: *"sensitivity, specificity, and accuracy of the urinary LH test to detect ovulation reached 1.00,
  0.25, and 0.97, respectively"* — note the **specificity of 0.25**: a positive LH test is a poor rule-in for
  ovulation actually occurring.
- *"mean time interval after a positive urinary LH test to follicular rupture detected by sonography was
  reported to be 20 ± 3 hr"*.
- *"The onset of the LH surge precedes ovulation by 35–44 hr, and the peak serum level of LH precedes ovulation
  by 10–12 hr"*.
- **CONFIDENCE: Strong.**

**Leiva RA, Bouchard TP, Abdullah SH, Ecochard R (2017), "Urinary Luteinizing Hormone Tests: Which
Concentration Threshold Best Predicts Ovulation?", *Frontiers in Public Health* 5:320** —
<https://pmc.ncbi.nlm.nih.gov/articles/PMC5712333/>

- Best thresholds 25–30 mIU/mL, with **PPV 50–60%, NPV 98%, LR+ 20–30, LR− 0.5**.
- At cycle day 11, 25 mIU/mL threshold: **sensitivity 0.54 (0.29–0.77), specificity 0.97 (0.95–0.99)**.
- *"The best scenario to predict ovulation at random was within 24 h after the first single positive test."*
- **31%** of cycles showed a positive LH test followed by three consecutive negatives while ovulation had not
  yet occurred — i.e. LH alone poorly identifies the *end* of the fertile window.
- Combining peak-type cervical mucus with a positive LH test raised specificity to **97–99%**, versus mucus
  alone 77–95% and LH alone 91%.
- **CONFIDENCE: Strong** for the threshold/PPV numbers; **Moderate** for the combined-specificity figure (taken
  from the article's own reported comparison as surfaced in retrieval, not re-derived).

**PCOS false positives.** Chronically elevated baseline LH and multiple small surges in PCOS are widely stated
to produce repeated positive OPKs. I could **not** retrieve a peer-reviewed quantification of the
false-positive *rate* in a PCOS population. One retrieved figure — ~13.9% of LH surges follow a plateau
pattern that can read as multiple positives — was surfaced only via search snippet and I did not verify it in
the source. **CONFIDENCE: Weak-Unverified.** → The app must not tell PCOS users anything quantitative about
OPK reliability; at most, offer a neutral note that LH tests can read positive more than once in some people
and that patterns are best interpreted with a clinician.

**User burden: HIGH** (consumable cost, daily testing over a window, result interpretation). **Value: high for
conception-seeking users only.**

---

### 1.5 Cervical mucus (Billings / Creighton / TwoDay)

**Su et al. 2017** (URL above):

- Extended to −1 to +2 days around ovulation, mucus observation sensitivities were **96.9% (vulva)** and
  **89.6% (vagina)**.
- Mucus peak correlated to **±1 day of ultrasonography-detected ovulation in 160/215 cycles (74.4%)**.
- **CONFIDENCE: Strong.**

**Effectiveness (Peragallo Urrutia 2018, verbatim from abstract).** First-year **typical-use** pregnancy rates
or probabilities per 100 woman-years, among moderate-quality studies:

| Method | Typical use | Perfect use |
|---|---|---|
| Standard Days Method (calendar) | **11.2–14.1** | **4.8** |
| TwoDay Method (mucus) | **13.7** | **3.5** |
| Billings Ovulation Method | **10.5–33.6** | **1.1–3.4** |
| Marquette Mucus-only | **4–18.5** | **2.7** |
| Basal body temperature methods | **9.0–9.8** | — |
| Single-check symptothermal | **13.2** | — |
| Thyma double-check symptothermal | **11.2–33.0** | — |
| Sensiplan (symptothermal) | **1.8** | **0.4** |
| Persona (urinary hormone monitor) | **25.6** | **12.1** |
| Marquette Monitor-only | **2–6.8** | **0** |
| Marquette Monitor + Mucus | **6–7** | — |

Authors' conclusion, verbatim: *"Studies on the effectiveness of each fertility awareness–based method are few
and of low to moderate quality."* Of 53 included studies they ranked **0 high quality, 21 moderate, 32 low**.
Creighton Model studies were excluded from standard typical-use estimates because pregnancies from intercourse
on known-fertile days were reclassified as *"achieving-related"* and removed — an accounting choice that makes
published Creighton effectiveness non-comparable. **CONFIDENCE: Strong.**

**User burden: HIGH** (multiple daily self-observations, training required, subjective grading).

---

### 1.6 Calendar-only rhythm / Standard Days — the honest ceiling

This is the number that constrains what a calendar-based app may imply.

- **Peragallo Urrutia 2018:** Standard Days Method first-year typical-use pregnancy probabilities of
  **11.2 (95% CI 7.6–14.9), 12.9 (95% CI 8.5–15.3), and 14.1 (95% CI 11.8–16.4)** per 100 woman-years;
  perfect-use **4.8 (95% CI 2.3–7.1)**. Classic "rhythm" studies were **all rated low quality**.
  **CONFIDENCE: Strong.**
- **Guttmacher Institute, "Contraceptive Effectiveness in the United States"** —
  <https://www.guttmacher.org/fact-sheet/contraceptive-effectiveness-united-states> — verbatim:
  *"typical-use failure rates ranging from 2% to 34% and perfect-use failure rates ranging from less than 1% to
  5%, based on moderate-quality studies."* Sources cited: Hatcher *Contraceptive Technology* 21st ed. (2018),
  Sundaram et al. (2017), Peragallo Urrutia et al. (2018). **CONFIDENCE: Strong.**
- **App-based FAM benchmark:** Berglund Scherwitzl R et al. (2017), "Perfect-use and typical-use Pearl Index of
  a contraceptive mobile app", *Contraception* — 22,785 users, 18,548 woman-years; **typical-use Pearl Index
  6.9 (95% CI 6.5–7.2)**, **perfect-use 1.0 (0.5–1.5)**, 13-cycle typical-use failure **8.3% (7.8–8.9)**.
  <https://www.contraceptionjournal.org/article/S0010-7824(17)30429-8/fulltext> — **CONFIDENCE: Moderate**
  (abstract-level retrieval). Note this app used BBT + LH input plus an FDA-cleared algorithm; it is **not** a
  benchmark a calendar-only app may borrow.
- **The often-quoted "CDC 2–23%" figure: I could NOT verify it.** cdc.gov blocked every retrieval attempt from
  this environment. Use the Guttmacher **2–34% typical use** range instead, which is sourced to the same
  underlying literature and which I did retrieve. **CONFIDENCE (for the CDC number): Weak-Unverified.**

**Design consequence (hard rule):** a calendar-only app must never present the fertile window as a
contraceptive tool. In the EU this is not merely a marketing question — see §3.2, MDR Rule 15: *"Software used
for contraception will be classified as class IIb."* A contraception claim converts a class I / non-device
tracker into a class IIb medical device requiring a notified body.

---

### 1.7 Other candidate data types

| Signal | What the evidence actually shows | Confidence |
|---|---|---|
| **Resting heart rate** | Rises follicular→luteal. Goodale 2019: 56.56 bpm (follicular) → 60.47 bpm (late luteal), p<.001. A secondary synthesis put the mean shift at ~2.73 bpm. | Strong (Goodale); Moderate (2.73 bpm figure — search-surfaced only) |
| **HRV** | Directionally lower in luteal phase, but in Goodale 2019 HRV *"only trended toward significance"* after Bonferroni correction. A living systematic review exists (Sports Med, 2025) but I did not retrieve its numbers. | Moderate/Weak — do **not** build phase inference on HRV alone |
| **Respiratory rate** | Significant phase variation, p<.001 (Goodale 2019); elevated in late luteal. | Strong (as an associated signal), weak as a standalone predictor |
| **Sleep** | FDA explicitly names *"sleep management, such as to track sleep trends"* as a general-wellness claim, so it is regulatorily safe. Cycle-phase association exists in wearable datasets but I did not retrieve a quantified prediction gain. | Moderate for association; Weak-Unverified for prediction gain |
| **Weight / BMI** | Bull 2019: women with BMI >35 had **0.4 days (14%) higher** cycle-length variation than normal BMI. Multiple cohorts associate BMI change with irregularity (e.g. BMC Women's Health 2026, npj Women's Health 2025) — retrieved as citations, numbers not verified. | Moderate |
| **Stress** | Associated with irregularity in survey cohorts; no retrieved study shows it improves *prediction*. Regulatorily safe to log (FDA: *"relaxation or stress management"*). | Weak-Unverified for prediction |
| **Exercise** | Same as stress. FDA-safe claim category (*"physical fitness"*). No retrieved prediction benefit. | Weak-Unverified for prediction |
| **Hormonal contraception / medication log** | Not a predictor — a **suppression key**. ACOG: *"Hormonal birth control methods can cause changes in bleeding, including breakthrough bleeding"*; *"The copper intrauterine device (IUD) can cause heavier menstrual bleeding, especially during the first year of use"*; *"blood thinners and aspirin can cause heavy menstrual bleeding."* Without this field, the health-awareness rules will fire wrongly and repeatedly. | **Strong — and mandatory** |
| **Pregnancy / postpartum / breastfeeding state** | Same: a suppression key. OWH excludes pregnancy and breastfeeding from its 3-months-no-period rule. NHS lists breastfeeding and hormonal contraception among normal causes of missed periods. | **Strong — and mandatory** |
| **Cervical position** | Part of some symptothermal systems, but I found **no** retrievable sensitivity/specificity or incremental-value data. | Weak-Unverified — do not ship |
| **Sexual activity** | Logged in 65–75% of cycles by FAM-app users (Symul 2019) — high engagement. Value is contextual (conception timing), not predictive. Highest privacy sensitivity in the whole dataset. | Moderate for engagement; Weak for prediction |
| **Daily symptom ratings (mood/pain/physical)** | DSM-5 PMDD requires **prospective daily ratings across ≥2 consecutive symptomatic cycles** — an app is the natural instrument, and this is a genuinely differentiating feature. Retrieved via secondary sources only. | Moderate |
| **Flow volume / product-count logging** | Directly required to implement the heavy-bleeding awareness rules in Part 2 (soaks, clot size, product count, double protection, night changes). Without it, the safety rules cannot fire at all. | **Strong — and mandatory if you ship any HMB message** |
| **Pain severity + "did it stop you doing normal activities?"** | Directly required for the dysmenorrhea rule; the guidelines' own criterion is functional interference, not a pain score (ACOG, OWH, NHS — see Part 2). | **Strong** |

---

## PART 2 — HEALTH-AWARENESS THRESHOLDS (PRIMARY SOURCES)

### 2.1 Cycle frequency (short / long cycles)

**FIGO System 1** — Jain V, Chodankar RR, Maybin JA, Critchley HOD (2023), "Contemporary evaluation of women
and girls with abnormal uterine bleeding: FIGO Systems 1 and 2", *Int J Gynaecol Obstet* —
<https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/>

- Frequency: **normal 24–38 days; frequent <24 days; infrequent >38 days**.
- Regularity (shortest-to-longest cycle variation, by age): **18–25 y ≤9 days; 26–41 y ≤7 days; 42–45 y ≤9 days**.
- **CONFIDENCE: Strong.**

**Office on Women's Health (womenshealth.gov), "Period problems"** —
<https://womenshealth.gov/menstrual-cycle/period-problems>

- Verbatim: *"Your menstrual cycle is shorter or longer than average. This means that the time from the first
  day of your last period up to the start of your next period is less than 24 days or more than 38 days."*
- Verbatim (see-your-doctor list): *"Your period happens more often than every 24 days or less often than every
  38 days"*; *"You get irregular periods after having normal cycles"*.
- **CONFIDENCE: Strong.**

**ACOG, "Abnormal Uterine Bleeding" FAQ** —
<https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding>

- Verbatim: *"The normal length of the menstrual cycle is typically between 21 and 35 days."*
- Abnormal includes: *"Menstrual cycles that are longer than 35 days or shorter than 21 days"* and
  *"'Irregular' periods in which cycle length varies by more than 7 to 9 days"*.
- **CONFIDENCE: Strong.**

**ACOG Committee Opinion No. 651, "Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital
Sign" (Dec 2015)** —
<https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign>

Box 1, verbatim: *"Menarche (median age): 12.43 years. Mean cycle interval: 32.2 days in first gynecologic
year. Menstrual cycle interval: Typically 21–45 days. Menstrual flow length: 7 days or less. Menstrual product
use: Three to six pads or tampons per day."*

Also verbatim: *"90% of cycles will be within the range of 21–45 days, although short cycles of less than 20
days and long cycles of more than 45 days may occur. By the third year after menarche, 60–80% of menstrual
cycles are 21–34 days long, as is typical of adults."*
**CONFIDENCE: Strong.**

#### ⚠️ Where the guidelines disagree, and what to do

| Bound | FIGO / OWH | ACOG patient FAQ | ACOG adolescent (CO 651) |
|---|---|---|---|
| Short cycle | <24 days | <21 days | <21 days (within 3 y of menarche) |
| Long cycle | >38 days | >35 days | >45 days (within 3 y of menarche) |
| Irregularity | >7–9 days variation, age-banded | >7 to 9 days variation | expected |

**Recommendation — use a two-tier rule, not one number.**

1. **Adults (≥3 gynecologic years post-menarche, age <45):** use **FIGO 24–38 days** as the primary normality
   band. Rationale: it is the current internationally harmonised FIGO System 1 definition, it is what the US
   federal consumer source (OWH) now publishes, and its age-banded regularity criterion is directly
   implementable. Fire only an **informational** message inside the disagreement zone (21–23 or 36–38 days) and
   escalate to **discuss-with-clinician** only outside the union (<21 or >38), *and* only when the pattern
   persists (≥3 of the last 6 logged cycles).
2. **Adolescents within 3 gynecologic years of menarche:** override to **21–45 days** per ACOG CO 651, and
   suppress the short/long-cycle rule entirely below the 21/45 bounds unless persistent.
3. **Age ≥45 or user-declared perimenopause:** suppress frequency rules; see §2.8.

This design means the app is never louder than the most conservative guideline, and never silent where all
guidelines agree.

---

### 2.2 Prolonged menses (duration of bleeding)

| Source | Threshold | Quote / URL |
|---|---|---|
| FIGO System 1 (Jain 2023) | Normal *"up to eight consecutive days"*; **prolonged >8 days** | <https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/> |
| OWH | *"Your period lasts longer than eight days."* | <https://womenshealth.gov/menstrual-cycle/period-problems> |
| ACOG (HMB FAQ) | *"Bleeding that lasts more than 7 days."* | <https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding> |
| ACOG (AUB FAQ) | *"Bleeding that lasts more than 7 days"* | <https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding> |
| ACOG CO 651 (adolescents) | *"Menstrual flow length: 7 days or less"* | CO 651 Box 1 |
| NHS | *"have periods lasting more than 7 days"* | <https://www.nhs.uk/conditions/heavy-periods/> |

**Disagreement: 7 vs 8 days.** **Recommendation:** treat **>7 days** as *informational* and **>8 days** as
*discuss-with-clinician*. This satisfies ACOG/NHS at the lower bound without over-escalating on the FIGO
definition. **CONFIDENCE: Strong.**

---

### 2.3 Heavy menstrual bleeding — self-report criteria

**ACOG, "Heavy Menstrual Bleeding" FAQ** — <https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding>
Verbatim, *"Any of the following can be a sign of heavy menstrual bleeding:"*

- *"Bleeding that lasts more than 7 days."*
- *"Bleeding that soaks through one or more tampons or pads every hour for several hours in a row."*
- *"Needing to wear more than one pad at a time to control menstrual flow."*
- *"Needing to change pads or tampons during the night."*
- *"Menstrual flow with blood clots that are as big as a quarter or larger."*

Also verbatim: *"Heavy menstrual bleeding is not normal."* and *"Blood loss from heavy periods also can lead to
a condition called iron-deficiency anemia. Severe anemia can cause shortness of breath and increase the risk of
heart problems."*
**CONFIDENCE: Strong.**

**OWH** — <https://womenshealth.gov/menstrual-cycle/period-problems> — verbatim: *"You bleed through one or
more pads or tampons every one to two hours."*; *"You pass menstrual blood clots larger than the size of
quarters."* **CONFIDENCE: Strong.**

**NHS, "Heavy periods"** — <https://www.nhs.uk/conditions/heavy-periods/> — verbatim, you may have heavy
periods if you:

- *"need to change your pad or tampon every 1 to 2 hours, or empty your menstrual cup more often than is recommended"*
- *"need to use 2 types of period product together"*
- *"have periods lasting more than 7 days"*
- *"pass blood clots larger than about 2.5cm (the size of a 10p coin)"*
- *"bleed through to your clothes or bedding"*
- *"avoid daily activities, like exercise, or take time off work because of your periods"*
- *"feel tired or short of breath a lot"*

See-a-GP wording, verbatim: *"heavy periods are affecting your life; you've had heavy periods for some time;
you have severe pain during your periods; you bleed between periods or after sex; you have heavy periods and
other symptoms, such as pain when peeing, pooing or having sex"*. **CONFIDENCE: Strong.**

**ACOG CO 651 (adolescents), verbatim:** *"Menstrual flow requiring changes of menstrual products every 1–2
hours is considered excessive, particularly when associated with flow that lasts more than 7 days at a time."*
Also: *"experts typically report that the mean blood loss per menstrual period is 30 mL per cycle and that
chronic loss of more than 80 mL is associated with anemia, this has limited clinical use because most females
are unable to measure their blood loss."* **CONFIDENCE: Strong.**
→ **Do not build an 80 mL estimator.** The guideline itself says the volumetric criterion has limited clinical
use for self-report.

**NICE NG88, "Heavy menstrual bleeding: assessment and management"** —
<https://www.nice.org.uk/guidance/ng88> (Context section, PDF retrieved from
<https://www.nice.org.uk/guidance/ng88/resources/heavy-menstrual-bleeding-assessment-and-management-pdf-1837701412549>)
Verbatim: *"Heavy menstrual bleeding (HMB) is defined as excessive menstrual blood loss which interferes with a
woman's physical, social, emotional and/or material quality of life."* Recommendation 1.1.1, verbatim:
*"Recognise that heavy menstrual bleeding (HMB) has a major impact on a woman's quality of life, and ensure
that any intervention aims to improve this rather than focusing on blood loss."*
**CONFIDENCE: Strong.**

**⚠️ Threshold disagreement, ACOG vs OWH/NHS:** ACOG says *"every hour for several hours in a row"*; OWH and
NHS say *"every one to two hours"*. **Recommendation:** use **every 1–2 hours for ≥2 consecutive hours** as
the *discuss-with-clinician* trigger (matches OWH/NHS, the more sensitive pair, and matches ACOG CO 651's
adolescent criterion), and reserve **every hour for ≥2 consecutive hours + systemic symptoms** for the urgent
rule (§2.7). Clot size: use **"larger than a quarter / about 2.5 cm"** and localise the coin reference.

---

### 2.4 Intermenstrual and postcoital bleeding

- **FIGO System 1 (Jain 2023):** *"The presence of any bleeding between cyclically regular menses is considered
  abnormal."* **CONFIDENCE: Strong.**
- **ACOG AUB FAQ:** abnormal includes *"Bleeding or spotting between periods"* and *"Bleeding or spotting after
  sex"*. **CONFIDENCE: Strong.**
- **OWH:** see-your-doctor for *"Bleeding after sex, more often than once"* and *"Spotting or bleeding anytime
  in the menstrual cycle other than during your period"*. **CONFIDENCE: Strong.**
  → Note OWH's *"more often than once"* qualifier for postcoital bleeding: a single episode is not a trigger.
- **NHS:** see a GP if *"you bleed between periods or after sex"*. **CONFIDENCE: Strong.**
- **NICE NG88 Rec 1.2.1** flags *"persistent intermenstrual bleeding"* as a history item that *"might suggest
  uterine cavity abnormality, histological abnormality, adenomyosis or fibroids"*; Rec 1.3.2: *"If cancer is
  suspected, see the NICE guideline on suspected cancer: recognition and referral."* **CONFIDENCE: Strong.**

**Recommendation:** require **≥2 episodes across ≥2 cycles** (or 1 episode if postmenopausal — see §2.8) before
firing, and **hard-suppress** for the first 3–6 months of a new hormonal method (ACOG: hormonal methods *"can
cause changes in bleeding, including breakthrough bleeding"*).

---

### 2.5 Amenorrhea

| Source | Threshold | Verbatim |
|---|---|---|
| **ACOG, Amenorrhea FAQ** <br><https://www.acog.org/womens-health/faqs/amenorrhea-absence-of-periods> | Primary: no first period by 15. Secondary: **≥3 months** | *"Primary amenorrhea—This is when a girl does not get her first period by age 15."* / *"Secondary amenorrhea—This is when a woman who already menstruates does not get her period for 3 months or more."* |
| **ACOG AUB FAQ** | **3 to 6 months** | *"Not having a period for 3 to 6 months"* (listed as abnormal) |
| **ACOG CO 651** | **>3 months / 90 days** | *"it is statistically uncommon for girls and adolescents to remain amenorrheic for more than 3 months or 90 days (the 95th percentile for cycle length). Girls and adolescents with more than 3 months between periods should be evaluated."* |
| **OWH** | **3 months in a row** | *"You have gone three months without a period and are not pregnant or breastfeeding"*; *"Haven't had your first period by age 15"*; *"You have not started your period within three years after breast growth began, or if breasts haven't started to grow by age 13."* |
| **NHS, Missed or late periods** <br><https://www.nhs.uk/conditions/stopped-or-missed-periods/> | **3 in a row** | *"you've missed your period 3 times in a row"*; *"your periods have not started by the time you're 15"* |

**Convergence is strong at 90 days / 3 cycles.** Use **90 days since last period start** (calendar-based, works
for users with previously-irregular cycles who have no meaningful "cycle count"), with the ACOG CO 651
justification that 90 days is the 95th percentile of cycle length.

**Distinction the app must implement:**
- *Previously regular* → 90 days OR 3 missed expected periods, whichever comes first.
- *Previously irregular / insufficient history* → 90 days only. Do not count "missed cycles" you cannot define.

**Mandatory suppressions:** pregnancy, breastfeeding/postpartum, known menopause, and hormonal methods that
intentionally suppress bleeding (continuous COC, LNG-IUS, implant, injectable). Firing an amenorrhea alert at
an implant user is the classic false-positive that destroys trust.
**CONFIDENCE: Strong.**

---

### 2.6 Severe dysmenorrhea interfering with daily activity

The guidelines' criterion is **functional interference**, not a pain score.

- **ACOG, "Dysmenorrhea: Painful Periods" FAQ** —
  <https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods> — verbatim: *"More than half of women
  who menstruate have some pain for 1 to 2 days each month. Usually, the pain is mild. But for some women, the
  pain is so severe that it keeps them from doing their normal activities for several days a month."* And:
  *"Yes, if you have painful periods you and your obstetrician-gynecologist (ob-gyn) should talk about your
  symptoms and your menstrual cycle."* **CONFIDENCE: Strong.**
- **OWH** — verbatim: *"Talk to your doctor or nurse if over-the-counter pain medicine, such as ibuprofen or
  naproxen, does not help or if the pain interferes with daily activities like work or school"*; also
  *"Your pain happens at times other than just before your period or during your period."* **CONFIDENCE: Strong.**
- **NHS, "Period pain"** — <https://www.nhs.uk/conditions/period-pain/> — **Urgent advice**, verbatim: *"Ask
  for an urgent GP appointment or get help from NHS 111 if: your pelvic pain or period pain is severe or worse
  than usual, and painkillers have not helped"*. Non-urgent: *"your period pain is stopping you doing your
  usual daily activities"*; *"you have pain during sex, or when peeing or pooing"*. **CONFIDENCE: Strong.**

**Note the NHS assigns an *urgent* level** to severe/worse-than-usual pain unrelieved by painkillers — the only
non-bleeding urgent trigger I found in a national guideline. Implement it.

---

### 2.7 Red-flag combination: heavy bleeding + systemic symptoms

**ACOG, "Abnormal Uterine Bleeding" FAQ** —
<https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding> — this is the exact guideline text:

> *"Sudden, unusual episodes of abnormal bleeding also can occur. This is called acute abnormal uterine
> bleeding. If you are changing pads or tampons every hour for more than 2 hours in a row, and you also have
> chest pain, have shortness of breath, and are lightheaded or dizzy, seek emergency medical care right away."*

**Urgency level assigned by the guideline: emergency medical care, right away.**
**CONFIDENCE: Strong.**

Two implementation notes:

1. ACOG's sentence uses **"and"** between all the systemic symptoms. Requiring *all* of chest pain + shortness
   of breath + lightheadedness would make the rule nearly un-fireable. **Recommendation: fire on the bleeding
   criterion plus ANY ONE systemic symptom**, and quote ACOG's sentence in full so the user sees the source
   text and the app is not silently redefining the guideline. This is a deliberate, documented deviation
   toward safety.
2. ACOG's supporting rationale is elsewhere on the HMB page: *"Severe anemia can cause shortness of breath and
   increase the risk of heart problems."* NHS's heavy-periods list similarly includes *"feel tired or short of
   breath a lot"* as a heavy-bleeding sign.

**This rule must be user-symptom-triggered (explicit checkboxes), never algorithmically inferred from flow
logs alone.** See §3.3 for why that also matters regulatorily.

---

### 2.8 Postmenopausal bleeding and perimenopause

**Postmenopausal bleeding — any amount, any once, needs review.**

- **ACOG, "ACOG Publishes Updated Guidance on Evaluation of Postmenopausal Bleeding" (Apr 16, 2026)** —
  <https://www.acog.org/news/news-releases/2026/04/acog-publishes-updated-guidance-evaluation-postmenopausal-bleeding>
  Verbatim: *"Approximately 90% of patients diagnosed with endometrial cancer have postmenopausal bleeding,
  which is defined as bleeding presumed to be from the uterus 12 or more months after the final menstrual
  period."* This Clinical Practice Update *"revises a previous recommendation that supported transvaginal
  ultrasonography without endometrial biopsy during initial evaluation"* and now recommends **TVUS + endometrial
  tissue sampling** in most patients, citing that *"5–12% of cancers may not be diagnosed on initial
  presentation"* with ultrasound alone. It is a focused update of **Committee Opinion 734**.
  **CONFIDENCE: Strong.**
- **NHS, "Postmenopausal bleeding"** — <https://www.nhs.uk/conditions/post-menopausal-bleeding/> — verbatim:
  *"Menopause is usually diagnosed in women over 45 who have not had a period for more than a year. Any
  bleeding from the vagina after this time needs to be checked by a GP."* See a GP *"even if: it's only
  happened once; there's only a small amount of blood, spotting, or pink or brown discharge; you do not have
  any other symptoms; you're not sure if it's blood"*. And: *"You should not have to wait more than 2 weeks to
  see a specialist."* **CONFIDENCE: Strong.**
- **ACOG AUB FAQ** lists *"Bleeding after menopause"* as abnormal. **OWH** lists *"Bleeding after menopause"*.

**This is the highest-value single rule in the whole app**, because the base rate of serious pathology is high
and the threshold is trivially computable (≥365 days since last bleed, then any bleed).

**Perimenopause.**

- **ACOG AUB FAQ**, verbatim: *"During perimenopause (around age 50), the number of days between periods may
  change. It is common to skip periods or for bleeding to get lighter or heavier at this time. Although these
  changes may be expected, you should talk with your obstetrician–gynecologist (ob-gyn) about any abnormal
  uterine bleeding."* **CONFIDENCE: Strong.**
- **FIGO regularity band widens to ≤9 days variation at ages 42–45** (Jain 2023). **CONFIDENCE: Strong.**
- **STRAW+10 (Harlow SD et al. 2012, "Executive summary of the Stages of Reproductive Aging Workshop +10")** —
  early menopausal transition = persistent **≥7-day difference** in length of consecutive cycles; late
  menopausal transition = an interval of **≥60 days of amenorrhea**.
  <https://www.fertstert.org/article/S0015-0282(12)00187-2/fulltext> — **CONFIDENCE: Moderate** (staging
  criteria retrieved via search summary of the executive summary; I did not fetch the staging table itself).
- **NHS** lists perimenopause (*"usually between the ages of 45 and 55"*) as a normal cause of missed periods.

**Recommendation:** from age ≥45, or when the user self-declares perimenopause, **suppress** the cycle-length
and irregularity rules and swap in a single, softer perimenopause message; **keep** the heavy-bleeding,
prolonged-bleeding, intermenstrual-bleeding and postmenopausal-bleeding rules fully active. Rationale: ACOG
explicitly says the *variability* is expected but the *abnormal bleeding* still warrants a conversation.

---

### 2.9 Things the guidelines require that a PRD typically misses

I was not given the source PRD, so this is a checklist of guideline-recommended items that period-tracker PRDs
commonly omit. Each is backed by a quote above.

1. **Primary amenorrhea by age.** No first period by **15**; no period within **3 years of breast development**;
   **no breast development by 13** (OWH; ACOG CO 651: *"Lack of breast development by age 13 years also should
   be evaluated"*). Requires an optional age/menarche field.
2. **Gynecologic age, not chronological age**, as the switch for the adolescent 21–45 band (ACOG CO 651: *"By
   the third year after menarche, 60–80% of menstrual cycles are 21–34 days long"*).
3. **Postmenopausal bleeding rule** — often absent from trackers aimed at reproductive-age users.
4. **Postcoital bleeding** as a distinct item from intermenstrual bleeding (OWH, ACOG, NHS all list it
   separately), with OWH's *"more often than once"* qualifier.
5. **Hormonal-method and IUD suppression windows**, and anticoagulant/aspirin context (ACOG AUB FAQ).
6. **Postpartum / breastfeeding suppression** (OWH and NHS both exempt these).
7. **Iron-deficiency-anemia awareness** as the *reason* heavy bleeding matters (ACOG HMB FAQ) — this is what
   makes the message actionable rather than alarming.
8. **Bleeding-disorder history cue**: ACOG AUB FAQ, verbatim — *"You may have a bleeding disorder if you have
   had heavy periods since you first started menstruating."* A tracker uniquely knows "since menarche."
9. **A data-coverage guard.** No guideline says this, but every rule below is invalid on sparse data. Require a
   minimum logging history before any statistical rule fires (see §6).
10. **NHS's urgent pain rule** (§2.6) — almost always omitted in favour of a non-urgent "talk to your doctor."
11. **Menstrual-cycle-as-vital-sign framing** (ACOG CO 651) — a legitimate, guideline-backed way to describe
    the product's purpose that stays on the wellness side.
12. **Localisation of the clot metaphor** — "quarter" (US) vs "2.5 cm / 10p coin" (UK). Ship the measurement,
    not just the coin.

---

## PART 3 — REGULATORY LINE: WELLNESS APP vs MEDICAL DEVICE

### 3.1 United States — FDA

**Statutory basis.** Section 3060(a) of the 21st Century Cures Act amended FD&C Act §520. Verbatim from the FDA
guidance: *"Section 520(o)(1)(B) of the FD&C Act, states that software that is intended 'for maintaining or
encouraging a healthy lifestyle and is unrelated to the diagnosis, cure, mitigation, prevention, or treatment of
a disease or condition' is not a device under section 201(h) of the FD&C Act."*

**Source used:** *General Wellness: Policy for Low Risk Devices*, FDA/CDRH, **document issued September 27,
2019**. I could not retrieve the document from fda.gov (all fda.gov and web.archive.org retrievals failed from
this environment — see §7). The verbatim text below is from Innolitics' published transcript of the official
FDA PDF: <https://innolitics.com/articles/fda-guidance-general-wellness-policy-for-low-risk-devices/>.
**CONFIDENCE: Strong for the 2019 text** (a self-described verbatim transcript, internally consistent with the
Federal Register notice for the 2016 final guidance,
<https://www.federalregister.gov/documents/2016/07/29/2016-17902/general-wellness-policy-for-low-risk-devices-guidance-for-industry-and-food-and-drug-administration>).

**The two factors, verbatim:**

> *"CDRH defines general wellness products as products that meet the following two factors: (1) are intended for
> only general wellness use, as defined in this guidance, and (2) present a low risk to the safety of users and
> other persons."*

**The definition of a general wellness product, verbatim:**

> *"A general wellness product, for the purposes of this guidance, has (1) an intended use that relates to
> maintaining or encouraging a general state of health or a healthy activity, or (2) an intended use that
> relates the role of healthy lifestyle with helping to reduce the risk or impact of certain chronic diseases
> or conditions and where it is well understood and accepted that healthy lifestyle choices may play an
> important role in health outcomes for the disease or condition."*
>
> *"If the product's intended uses are not limited to the above general wellness intended uses, this guidance
> does not apply."*

**Category 1, verbatim:** claims *"about sustaining or offering general improvement to functions associated
with a general state of health that do not make any reference to diseases or conditions"* — the enumerated
list is *"weight management, physical fitness, including products intended for recreational use, relaxation or
stress management, mental acuity, self-esteem …, sleep management, or sexual function."*

**Category 2, verbatim:** claims that *"promote, track, and/or encourage choice(s), which, as part of a healthy
lifestyle, may help to reduce the risk of certain chronic diseases or conditions"* or *"may help living well
with certain chronic diseases or conditions"* — and only *"where it is well understood that healthy lifestyle
choices may reduce the risk or impact of a chronic disease or medical condition."*

**Examples FDA gives of claims that are NOT general wellness, verbatim:** *"A claim that a product will treat
or diagnose obesity"*; *"A claim that a product will treat an eating disorder, such as anorexia"*; *"A claim
that a product helps treat an anxiety disorder"*; *"A claim that a computer game will diagnose or treat
autism"*.

**Low-risk screen, verbatim:** *"If the answer to any of the following questions is YES, the product is not low
risk and is not covered by this guidance. 1) Is the product invasive? 2) Is the product implanted? 3) Does the
product involve an intervention or technology that may pose a risk to the safety of users and other persons if
specific regulatory controls are not applied…"* — a local-only software tracker answers NO to all three.

**Also verbatim, and worth quoting in your own docs:** *"A product's inclusion under the general wellness policy
in this guidance does not establish that it has been shown to be safe and/or effective for its intended use."*

#### The January 6, 2026 revision

FDA issued a **revised final** *General Wellness: Policy for Low Risk Devices* on **January 6, 2026**,
superseding the September 2019 version. I could **not** retrieve the primary document. From Covington &
Burling's alert (fetched: <https://www.cov.com/en/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products>),
which quotes the guidance:

- The two-factor framework is retained.
- Products lose general-wellness status if they include values that *"mimic those used clinically,"* if such
  values are not validated; claim clinical equivalence or medical-grade performance; include alerts guiding
  specific clinical actions; reference diseases, conditions, or diagnostic thresholds; or measure physiologic
  values *"for medical purposes such as screening, diagnosis, monitoring, alerting or management."*
- **Critically for this app:** the guidance permits *"a notification informing a user that evaluation by a
  healthcare professional may be helpful when outputs fall outside ranges appropriate for general wellness
  use"* — but only while avoiding describing outputs as *"abnormal, pathological, or diagnostic."*

**CONFIDENCE: Moderate** (law-firm alert quoting the guidance; primary not retrieved).

That last bullet is the exact permission this app's health-awareness feature needs, and the exact constraint on
its wording. **Design directly to it.**

The companion *Clinical Decision Support Software* guidance was also reissued January 6, 2026 (superseding Sept
28, 2022). Its four §520(o)(1)(E) criteria are framed around software supporting **health care professionals**;
a consumer-facing tracker with no HCP in the loop is governed by the general wellness policy and the device
definition, not by the CDS carve-out. **CONFIDENCE: Moderate.**

### 3.2 European Union — MDR

**MDCG 2019-11, "Guidance on Qualification and Classification of Software in Regulation (EU) 2017/745 – MDR and
Regulation (EU) 2017/746 – IVDR"**, October 2019; **Rev.1 June 2025**. Both PDFs retrieved and text-extracted:
<https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf> (Oct 2019) and
<https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf>
(Rev.1). **CONFIDENCE: Strong.**

**Qualification, verbatim:** *"Software must have a medical purpose on its own to be qualified as a medical
device software (MDSW). It should be noted that the intended purpose as described by the manufacturer of the
software is relevant for the qualification and classification of any device."*

And: *"Software intended for non-medical purposes … does not qualify as a medical device software."*
Decision step 3 excludes software that performs no action beyond *"storage, archival, communication, simple
search, lossless compression."* → A pure log-and-display tracker is out of scope. A tracker that computes
predictions and health messages is doing more than storage, so qualification turns entirely on **intended
purpose as you state it**.

**Rule 11, verbatim (Annex VIII):**

> *"Software intended to provide information which is used to take decisions with diagnosis or therapeutic
> purposes is classified as class IIa, except if such decisions have an impact that may cause: death or an
> irreversible deterioration of a person's state of health, in which case it is in class III; or a serious
> deterioration of a person's state of health or a surgical intervention, in which case it is classified as
> class IIb.*
> *Software intended to monitor physiological processes is classified as class IIa, except if it is intended for
> monitoring of vital physiological parameters, where the nature of variations of those parameters is such that
> it could result in immediate danger to the patient, in which case it is classified as class IIb.*
> *All other software is classified as class I."*

MDCG splits this into sub-rules 11a (diagnostic/therapeutic decisions), 11b (monitoring physiological
processes), 11c (*"all other uses"* → class I).

**The directly on-point worked example, verbatim from MDCG 2019-11 Annex IV (present in both Oct 2019 and
Rev.1):**

> *"MDSW app intended to support conception by calculating the user's fertility status based on a validated
> statistical algorithm. The user inputs health data including basal body temperature (BBT) and menstruation
> days to track and predict ovulation. The fertility status of the current day is reflected by one of three
> indicator lights: red (fertile), green (infertile) or yellow (learning phase/cycle fluctuation). This MDSW
> app should be classified as class I per Rule 11c."*

**And the trap, verbatim (Rule 15):** *"Rule 15 applies to devices used for contraception or prevention of the
transmission of sexually transmitted diseases. Software used for contraception will be classified as class
IIb."*

**Practical EU conclusion:** a fertility-status tracker positioned **to support conception** lands at class I
(self-certifiable). The same software positioned **for contraception** lands at class IIb (notified body,
clinical evaluation, ISO 13485). And note sub-rule 11b: *"Vital physiological processes and parameters include,
for example, respiration, heart rate, cerebral functions, blood gases, blood pressure and body temperature."*
If you position wearable temperature/HR ingestion as *"monitoring"* rather than as lifestyle logging, you argue
yourself into Rule 11b and class IIa. **Frame ingested wearable data as user-provided lifestyle context, not
as physiological monitoring.**

### 3.3 Phrasing rules that keep this app on the wellness / non-device side

Derived directly from the quoted FDA and MDCG text above.

**NEVER say (each one pulls you across the line):**

| Forbidden | Why |
|---|---|
| "abnormal", "pathological", "irregular bleeding" as a verdict | FDA 2026: outputs must not be described as *"abnormal, pathological, or diagnostic"* |
| "This may indicate PCOS / endometriosis / a thyroid problem / anemia" | Disease reference → outside general wellness category 1; MDSW medical purpose in EU |
| "You are ovulating today" / "You are not fertile today" (as fact) | Asserted physiological state; also the EU red/green light pattern (still class I, but it *is* MDSW) |
| "Use this to avoid pregnancy" / "safe days" | MDR Rule 15 → class IIb; FDA device claim |
| "Medical-grade", "clinically accurate", "as accurate as a lab test" | FDA 2026: clinical-equivalence claims disqualify |
| "Your cycle is 41 days, which exceeds the normal threshold of 38" presented as a finding | Diagnostic threshold reference (FDA 2026) |
| "Screening", "monitoring", "diagnosis", "assessment", "alert" as product vocabulary | FDA 2026: measuring physiologic values *"for medical purposes such as screening, diagnosis, monitoring, alerting or management"* disqualifies |
| Any automatic "risk score" for a named condition | Diagnostic output |

**SAFE patterns (all four map to quoted FDA/MDCG language):**

1. **Reflect the user's own data back, then hand off.**
   *"Your last 4 logged cycles were 41, 44, 39 and 47 days. Cycle length is something clinicians often ask
   about — it may be worth mentioning at your next appointment."*
   → Reports the user's own input; no threshold framing; matches FDA 2026's permitted *"notification informing
   a user that evaluation by a healthcare professional may be helpful."*
2. **Attribute the threshold to its source rather than applying it.**
   *"ACOG describes bleeding that soaks through a pad or tampon every hour for several hours in a row as heavy
   menstrual bleeding, and suggests talking to an ob-gyn about it."*
   → The app quotes an educational reference; it is not the app declaring a finding.
3. **Frame the purpose as awareness, not detection.**
   Product description: *"helps you notice and record patterns in your own cycle"* — not *"detects cycle
   abnormalities."* Compare FDA's approved analogues: *"help log, track, or trend exercise activity"*,
   *"track sleep trends"*.
4. **Show uncertainty as a first-class UI element.** Predicted-period ranges, not points. This is both honest
   and protective: a point prediction implies a measurement claim.

**The urgent rule (§2.7) is the one genuine exception**, and it needs a deliberate design decision. FDA 2026's
guardrail explicitly disqualifies *"alerts guiding specific clinical actions."* Mitigations, in order of
preference:

- Make it **user-initiated**: a static "When to seek urgent care" reference screen, reachable from the symptom
  logger, not an automatic push.
- If it must be triggered, trigger it on **explicit symptom checkboxes the user just ticked**, never on
  inferred flow data, and render it as an **attributed quotation** of ACOG's sentence with a link, not as the
  app's own assessment.
- Never suppress it for regulatory tidiness. Getting sued for a missed haemorrhage is worse than a guidance
  argument. Document the deviation.

---

## 4. RECOMMENDED DATA MODEL ADDITIONS

Ranked by (evidence strength × inverse user burden × value to a private, local-only, single-user app).

| # | Data type | Evidence strength | User burden | Value to this app | Verdict |
|---|---|---|---|---|---|
| 1 | **Flow volume + product count/type, per day** (incl. clot size, double protection, night changes, leak-through) | **Strong** — ACOG HMB FAQ, OWH, NHS, ACOG CO 651 all define HMB in exactly these terms | Low (tap during logging) | Without it, **zero** of the heavy-bleeding safety rules can fire | **MVP — required** |
| 2 | **Context/state flags: pregnancy, postpartum/breastfeeding, hormonal method + start date, IUD type, anticoagulants, known menopause, perimenopause self-ID** | **Strong** — every guideline conditions its thresholds on these | Very low (set once, edit rarely) | Suppression keys; prevents the false positives that destroy trust | **MVP — required** |
| 3 | **Bleeding-episode typing: period vs spotting vs intermenstrual vs postcoital** | **Strong** — FIGO, ACOG, OWH, NHS all treat these as distinct | Low (one extra tap) | Enables IMB/PCB/PMB rules; also cleans cycle-length computation | **MVP — required** |
| 4 | **Pain severity + functional interference ("did it stop you doing normal things?") + painkiller-didn't-help flag** | **Strong** — ACOG, OWH, NHS all key on function, and NHS assigns *urgent* to painkiller-refractory severe pain | Low | Only route to the dysmenorrhea rules; high perceived user value | **MVP** |
| 5 | **Age / date of menarche (optional)** | **Strong** — ACOG CO 651 gynecologic-age band; primary-amenorrhea-by-15 rule; FIGO age-banded regularity | Very low (one field, skippable) | Switches the entire threshold set; without it you must use adult thresholds on teens | **MVP (optional field, graceful default)** |
| 6 | **Wearable temperature via HealthKit / Health Connect** (sleeping wrist temp or ring distal temp) | **Strong** — Apple/Hum Reprod 2025 (MAE 1.22 d, 89.0% within ±2 d); Oura/JMIR 2025 (96.4% detected, MAE 1.26 d); Gombert-Labedens 2024 (82% agreement with LH) | **Very low** — one permission grant, then passive | Best accuracy-per-burden ratio available; biggest win for irregular-cycle users (82% vs 32.5% within ±2 d) | **MVP if platform APIs are in scope; otherwise first post-MVP** |
| 7 | **Resting HR / respiratory rate via the same health store** | Strong for association (Goodale 2019, p<.001); weak standalone | Zero marginal (same permission) | Supporting features for phase inference; cheap once #6 exists | **Later — bundle with #6** |
| 8 | **Daily symptom ratings (mood, physical, energy)** | Moderate — DSM-5 PMDD requires prospective daily ratings across ≥2 cycles | Medium (daily, but users already want this) | Strong differentiator; enables a genuinely useful cycle-phase symptom chart | **MVP-lite (small fixed set), expand later** |
| 9 | **Manual BBT** | **Strong** but negative: retrospective only; 22.1% agreement with LH ±1 d (Su 2017); BBT-only FAM typical use 9.0–9.8/100 wy | **High** (waking measurement, strict protocol) | Real value for luteal-length learning; only for motivated users | **Later — advanced/opt-in** |
| 10 | **Urinary LH results** | **Strong** — Su 2017 (specificity 0.25!), Leiva 2017 (PPV 50–60%) | High (cost + daily testing) | Only for conception-seeking users; a good *reference* signal for calibrating other predictions | **Later — advanced/opt-in** |
| 11 | **Cervical mucus (TwoDay-style: any secretions today/yesterday)** | **Strong** — Su 2017 sensitivity 96.9% vulva / 89.6% vagina; TwoDay typical use 13.7, perfect use 3.5 | High (multiple daily observations, training) | Best mucus/LH combination raises specificity to 97–99%; but training burden is real | **Later — advanced/opt-in** |
| 12 | **Weight / BMI** | Moderate — Bull 2019: BMI>35 → +0.4 d (14%) more cycle variation | Low-medium (recurring entry, emotionally loaded) | Modest explanatory value; privacy- and body-image-sensitive | **Later, off by default** |
| 13 | **Sexual activity** | Moderate for engagement (logged in 65–75% of cycles, Symul 2019); weak for prediction | Low | Contextual only. **Highest privacy risk field in the schema** — encrypt-at-rest and exclude from any export by default | **Later, off by default** |
| 14 | **Sleep / stress / exercise** | Weak-Unverified for prediction; FDA-safe as wellness claims | Zero if imported, medium if manual | Nice context charts; do not let them drive predictions | **Later, import-only** |
| 15 | **Cervical position** | **Weak-Unverified** — no retrievable accuracy or incremental-value data | High + intrusive | None demonstrated | **Do not ship** |
| 16 | **Blood-volume estimation in mL** | Guideline explicitly deprecates it: ACOG CO 651 — *"this has limited clinical use because most females are unable to measure their blood loss"* | High | Negative — implies false precision | **Do not ship** |

**Recommended MVP set:** rows 1–5 (+ row 6 if a platform health store is already in scope), plus a small fixed
symptom set from row 8.
**Recommended "later" set:** rows 6/7 (if deferred), 8 expansion, 9, 10, 11, then 12–14 as off-by-default
optionals.
**Never:** rows 15, 16, and any contraception positioning.

---

## 5. HEALTH-AWARENESS RULE TABLE

Machine-implementable. All messages are written to the §3.3 safe patterns: user's-own-data framing,
source-attributed thresholds, no "abnormal", no condition names, no directive clinical action except the one
documented urgent rule.

**Global preconditions (apply to every rule unless stated):**

- `G1` **Coverage guard:** rule does not fire unless the underlying data exists — see §6.
- `G2` **Pregnancy/postpartum:** if `state.pregnant == true` or `days_since_delivery < 180` or
  `state.breastfeeding == true` → suppress ALL of CYC-*, AMEN-*, DUR-*, IMB-*.
- `G3` **Hormonal method:** if a hormonal method (COC/POP/patch/ring/injectable/implant/LNG-IUS) started
  `< 180 days` ago → suppress CYC-*, DUR-*, IMB-*, AMEN-*. If a bleeding-suppressing method is *ongoing* →
  suppress AMEN-* permanently while active.
- `G4` **Copper IUD:** if copper IUD inserted `< 365 days` ago → downgrade HMB-* severity to informational and
  append the ACOG context line.
- `G5` **Perimenopause / age ≥45 or self-declared:** suppress CYC-01/02/03; substitute PERI-01. HMB-*, DUR-*,
  IMB-*, PMB-* remain active.
- `G6` **Postmenopause:** if `days_since_last_bleed ≥ 365` and (age ≥45 or self-declared menopause) → suppress
  ALL cycle rules; only PMB-01 is active.
- `G7` **Adolescent:** if `gynecologic_age < 3 years` → use the 21–45 day band and CO 651 wording; suppress
  CYC-01/02 inside 21–45.
- `G8` **Snooze/dismiss:** any rule dismissed by the user does not re-fire for 90 days (or until the underlying
  condition changes state), except URG-01 which always fires.
- `G9` **Rate limit:** at most one non-urgent message per app-open, and at most two per cycle.

| Rule ID | Trigger condition (exact) | Severity | User-facing message text | Source | Suppressions |
|---|---|---|---|---|---|
| **CYC-01** | Median cycle length over the last 6 logged cycles **< 21 days**, in ≥3 of the last 6 | discuss-with-clinician | "Your recent cycles have been averaging {n} days — shorter than the 24–38 day range that the Office on Women's Health describes as typical. Cycle length is something clinicians like to know about; it may be worth mentioning at your next visit." | OWH *"less than 24 days or more than 38 days"* <https://womenshealth.gov/menstrual-cycle/period-problems>; ACOG *"shorter than 21 days"* | G1–G3, G5–G8 |
| **CYC-01i** | Median cycle length **21–23 days** in ≥3 of last 6 | informational | "Your recent cycles have averaged {n} days. Guidelines differ a little here — ACOG describes 21–35 days as typical, while FIGO and the Office on Women's Health use 24–38. Worth noting if it's a change for you." | ACOG AUB FAQ + FIGO/OWH (disagreement zone) | G1–G3, G5–G8 |
| **CYC-02** | Median cycle length **> 38 days** in ≥3 of last 6 | discuss-with-clinician | "Your recent cycles have been averaging {n} days — longer than the 24–38 day range the Office on Women's Health describes as typical. It may be worth mentioning at your next appointment." | OWH; ACOG *"longer than 35 days"* | G1–G3, G5–G8 |
| **CYC-02i** | Median cycle length **36–38 days** in ≥3 of last 6 | informational | as CYC-01i, inverted | ACOG vs FIGO/OWH | G1–G3, G5–G8 |
| **CYC-03** | Shortest-to-longest spread over last 6 cycles **> 9 days** (age 18–25 or 42–45) or **> 7 days** (age 26–41) | informational | "Across your last 6 logged cycles the shortest was {a} days and the longest {b}. FIGO describes a typical spread as up to {k} days at your age. Cycle variation is common — worth a mention if it's new." | FIGO System 1 regularity bands, Jain 2023 <https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/> | G1–G3, G5–G8 |
| **CYC-04** | Adolescent (`gyn_age < 3y`) and median cycle **< 21** or **> 45** days | informational | "Cycles often take a few years to settle into a pattern. ACOG describes 21–45 days as the usual range in the first few years after periods start; yours have averaged {n}. If that's the case for you, it's a good thing to bring up at a check-up." | ACOG CO 651 Box 1: *"Menstrual cycle interval: Typically 21–45 days"* | G1–G3, G8 |
| **DUR-01i** | Bleeding days in a single episode **> 7** | informational | "This period lasted {n} days. ACOG and the NHS describe periods lasting more than 7 days as worth mentioning to a clinician." | ACOG HMB FAQ *"Bleeding that lasts more than 7 days"*; NHS *"periods lasting more than 7 days"* | G1–G4, G8 |
| **DUR-02** | Bleeding days **> 8** in ≥2 of the last 3 episodes | discuss-with-clinician | "Your last {k} periods lasted more than 8 days. FIGO describes menstrual bleeding of more than 8 days as prolonged, and the Office on Women's Health suggests talking to a clinician about it." | FIGO *"up to eight consecutive days"*; OWH *"Your period lasts longer than eight days."* | G1–G4, G8 |
| **HMB-01** | User logs product change **every 1–2 hours for ≥2 consecutive hours** on any day | discuss-with-clinician | "You logged changing protection every 1–2 hours for {n} hours. The Office on Women's Health and the NHS both describe that as heavy menstrual bleeding, and suggest talking to a clinician — heavy periods can lead to iron-deficiency anemia." | OWH *"every one to two hours"*; NHS *"every 1 to 2 hours"*; ACOG on anemia | G1, G4 (→informational), G8 |
| **HMB-02** | User logs clots **≥ quarter / 2.5 cm** on ≥1 day in ≥2 of last 3 periods | discuss-with-clinician | "You've logged clots about the size of a quarter (2.5 cm) or larger in {k} of your recent periods. ACOG lists that as a sign of heavy menstrual bleeding worth discussing with an ob-gyn." | ACOG *"blood clots that are as big as a quarter or larger"*; NHS *"larger than about 2.5cm"* | G1, G4, G8 |
| **HMB-03** | User logs **double protection** OR **night-time changes** OR **leak-through to clothes/bedding** in ≥2 of last 3 periods | informational | "You've logged {needing two products at once / changing overnight / leaking through} in {k} recent periods. ACOG and the NHS both list these among the signs of heavy periods." | ACOG *"Needing to wear more than one pad at a time"*, *"Needing to change pads or tampons during the night"*; NHS *"use 2 types of period product together"*, *"bleed through to your clothes or bedding"* | G1, G4, G8 |
| **HMB-04** | HMB-0x has fired in **≥3 consecutive cycles** AND user has logged tiredness/breathlessness | discuss-with-clinician | "You've logged heavy bleeding for several cycles along with feeling tired or short of breath. ACOG notes that blood loss from heavy periods can lead to iron-deficiency anemia — this is worth raising with a clinician." | ACOG HMB FAQ; NHS *"feel tired or short of breath a lot"* | G1, G8 |
| **HMB-05** | Every logged period since menarche flagged heavy (≥5 periods, ≥80% flagged), user's gyn age ≥1 y | informational | "You've logged heavy periods since your periods began. ACOG notes that's a pattern worth mentioning to a clinician." | ACOG AUB FAQ: *"You may have a bleeding disorder if you have had heavy periods since you first started menstruating."* | G1, G3, G8 |
| **URG-01** | **Bleeding**: product change **≥1/hour for >2 consecutive hours** **AND** user ticks **≥1** of {chest pain, shortness of breath, lightheaded/dizzy, feeling faint} | **seek-urgent-care** | "ACOG advises: *'If you are changing pads or tampons every hour for more than 2 hours in a row, and you also have chest pain, have shortness of breath, and are lightheaded or dizzy, seek emergency medical care right away.'* Based on what you've just logged, please consider seeking emergency care now. [Read ACOG's guidance]" | ACOG AUB FAQ, verbatim <https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding> | **None.** Fires regardless of G2–G9. Requires explicit user symptom entry — never inferred. |
| **URG-02** | User logs pain as **severe or worse than usual** AND ticks **"painkillers did not help"** | **seek-urgent-care** (UK) / discuss-with-clinician (US default) | "The NHS advises asking for an urgent GP appointment or contacting NHS 111 if pelvic or period pain is severe or worse than usual and painkillers have not helped." | NHS Period pain, Urgent advice box <https://www.nhs.uk/conditions/period-pain/> | G8 does not apply; locale-gated wording |
| **DYS-01** | User logs pain interfering with normal activities on **≥2 days** in **≥2 of the last 3** periods | discuss-with-clinician | "You've logged period pain that stopped you doing normal activities in {k} recent cycles. Both ACOG and the Office on Women's Health suggest talking to a clinician when pain interferes with daily life or when over-the-counter pain relief isn't enough." | ACOG dysmenorrhea FAQ; OWH *"if the pain interferes with daily activities like work or school"*; NHS *"stopping you doing your usual daily activities"* | G1, G8 |
| **DYS-02** | Pain logged **outside** the window (period days − 3 … last period day) in ≥2 of last 3 cycles | informational | "You've been logging pelvic pain at times outside your period. The Office on Women's Health lists that as something to mention to a clinician." | OWH *"Your pain happens at times other than just before your period or during your period."* | G1, G8 |
| **IMB-01** | Bleeding/spotting typed **intermenstrual** on ≥2 separate occasions across ≥2 cycles, while cycles are otherwise regular | discuss-with-clinician | "You've logged bleeding between periods {n} times. FIGO and ACOG both describe bleeding between otherwise regular periods as worth having checked." | FIGO *"any bleeding between cyclically regular menses is considered abnormal"*; ACOG *"Bleeding or spotting between periods"*; OWH | G1–G4 (esp. G3: new hormonal method), G8 |
| **PCB-01** | Bleeding typed **postcoital** on **≥2** occasions | discuss-with-clinician | "You've logged bleeding after sex more than once. The Office on Women's Health and the NHS both suggest getting that checked." | OWH *"Bleeding after sex, more often than once"*; NHS *"you bleed between periods or after sex"* | G1, G8 |
| **AMEN-01** | `days_since_last_period_start ≥ 90` (previously regular OR irregular) | discuss-with-clinician | "It's been {n} days since your last logged period. ACOG and the Office on Women's Health both suggest checking in with a clinician after about three months without a period, when pregnancy and breastfeeding aren't the reason." | ACOG *"does not get her period for 3 months or more"*; OWH *"three months in a row"*; NHS *"missed your period 3 times in a row"*; ACOG CO 651 *"more than 3 months or 90 days (the 95th percentile for cycle length)"* | **G2, G3 mandatory**; G6; G8 |
| **AMEN-02** | Age **≥15** and no menarche recorded, user has indicated they have not yet started periods | discuss-with-clinician | "ACOG suggests an evaluation for anyone who hasn't had a first period by age 15, or within 3 years of breast development starting." | ACOG CO 651: *"An evaluation for primary amenorrhea should be considered for any adolescent who has not reached menarche by age 15 years or has not done so within 3 years of thelarche."*; OWH | G8 |
| **PMB-01** | `days_since_last_bleed ≥ 365` (age ≥45 or self-declared menopause) **AND** any new bleeding/spotting logged | discuss-with-clinician **(prompt / do not wait)** | "You've logged bleeding after 12 months without a period. The NHS advises that any bleeding after this point should be checked by a GP — even if it happened only once, is only spotting, or comes with no other symptoms. ACOG's 2026 guidance also recommends prompt evaluation." | NHS <https://www.nhs.uk/conditions/post-menopausal-bleeding/>; ACOG Apr 2026 update <https://www.acog.org/news/news-releases/2026/04/acog-publishes-updated-guidance-evaluation-postmenopausal-bleeding> | **None except G1.** Overrides G5. Never snoozed by G8. |
| **PERI-01** | Age ≥45 or self-declared perimenopause, AND cycle spread over last 6 cycles > 9 days OR any gap ≥60 days | informational | "Your cycles have been more variable lately. ACOG notes that around perimenopause the number of days between periods often changes, and skipped periods are common. ACOG still suggests talking with an ob-gyn about any bleeding that seems unusual for you." | ACOG AUB FAQ perimenopause paragraph; STRAW+10 (≥7 d variability; ≥60 d amenorrhea) | G1, G2, G8 |
| **CTX-01** | Any CYC-*/DUR-*/HMB-*/IMB-* would fire while a hormonal method or copper IUD started <180/<365 days ago | informational (replaces the suppressed rule, max once) | "Bleeding patterns often change in the first months on a new method — ACOG notes hormonal methods can cause breakthrough bleeding, and that a copper IUD can make periods heavier, especially in the first year. Keep logging; if it doesn't settle or it's bothering you, mention it at your next appointment." | ACOG AUB FAQ | G8 |

**Copy rules for implementers:**
- Every message contains the user's **own numbers**, then an **attributed** external statement, then a soft
  handoff. Never the app's own verdict.
- The words **abnormal, disorder, condition, diagnosis, screening, detect, risk of {disease}** must not appear
  in any user-facing string. Add a CI lint for this on the string catalogue.
- Every message needs a persistent, one-tap **"Why am I seeing this?"** that shows the source, the exact
  threshold, and a "don't show me this again" control.
- Ship a global disclaimer that this app does not provide medical advice and is not contraception — and note
  that a content analysis of period apps found *"few (40%) disclosed that they should not replace professional
  medical advice"* and *"None of the apps included a caveat that their predictions may be inaccurate"*
  (<https://pubmed.ncbi.nlm.nih.gov/41562199/>, retrieved via search summary — **CONFIDENCE: Moderate**).
  Being in the minority that does this is a differentiator, not a cost.

---

## 6. DATA-COVERAGE GUARDS (`G1`, expanded)

No guideline specifies these; they are engineering requirements that follow from the statistics in §1.1.

| Rule family | Minimum data before firing |
|---|---|
| CYC-01/02/03 (cycle length & regularity) | ≥6 complete cycles logged, no gap >45 days unexplained by a suppression flag, ≥90% of expected bleed-days logged |
| CYC-01i/02i (disagreement zone) | Same as above; additionally require ≥4 of 6 cycles inside the zone |
| DUR-* | ≥3 complete bleeding episodes with per-day logging (start and end both explicitly logged, not inferred) |
| HMB-01/02/03 | Per-day product/flow logging present for ≥80% of days in the episode |
| HMB-04/05 | ≥3 (resp. ≥5) qualifying episodes |
| IMB-01 / PCB-01 | Bleeding-type field populated (not inferred from date gaps) |
| AMEN-01 | ≥1 prior period start recorded; app installed ≥90 days OR user supplied a prior LMP |
| PMB-01 | Age or menopause flag set; ≥1 prior bleed date |
| PERI-01 | ≥6 cycles OR explicit self-declaration |

Also: **cycle length must be computed as first-bleed-day to first-bleed-day**, per ACOG's definition — *"The
menstrual cycle is counted from the first day of bleeding of one menstrual period to the first day of bleeding
of the next period"*
(<https://www.acog.org/womens-health/faqs/amenorrhea-absence-of-periods>). Spotting-only days must not open a
new cycle. Getting this wrong silently corrupts every rule above.

---

## 7. WHAT I COULD NOT VERIFY

Listed so nothing here gets mistaken for a checked fact.

1. **FDA *General Wellness: Policy for Low Risk Devices*, January 6, 2026 — primary text not retrieved.**
   `fda.gov` returned "Not found" / 404 for every path attempted (`/media/90652/download`, the guidance-search
   page, the town-hall pages) from both the fetch tool and direct HTTP; `hhs.gov`'s mirror returned 403;
   `web.archive.org` rate-limited (HTTP 429) on every retry and is blocked for the fetch tool. **The quoted
   2026 language in §3.1 comes from Covington & Burling's alert quoting the guidance, not from FDA.**
   → Action: someone with network access to fda.gov must re-verify the 2026 wording before any of §3.3 is
   treated as a compliance position. The **2019** text quoted in §3.1 is from a self-described verbatim
   transcript (Innolitics) and is internally consistent with the 2016 Federal Register notice, but it is also
   not the FDA-hosted PDF and is now superseded.
2. **The widely-quoted CDC "2–23% typical-use failure" figure for fertility-awareness methods.** `cdc.gov`
   blocked every retrieval (403 / Access Denied) and no Wayback snapshot was available for the current
   contraceptive-effectiveness page. I substituted Guttmacher's **2–34%** range, which I did retrieve and which
   cites the same underlying literature (Hatcher 2018; Sundaram 2017; Peragallo Urrutia 2018). Do not publish
   the "2–23%" number without checking the CDC page directly.
3. **ACOG pages were blocked to the fetch tool (HTTP 402) and were retrieved by direct HTTP instead.** The
   quotes are verbatim from the retrieved page bodies, but they came through a plain HTTP client rather than
   the normal fetch path. Spot-check them in a browser before shipping user-facing copy that quotes ACOG.
4. **PCOS and LH-test false positives.** No peer-reviewed quantification of the false-positive rate in a PCOS
   population was retrievable. The "13.9% of surges follow a plateau pattern" figure appeared only in a search
   snippet and was not verified in source. **Do not ship any PCOS-specific OPK guidance.**
5. **STRAW+10 staging criteria** (≥7-day cycle-length difference; ≥60 days amenorrhea) came from a search
   summary of the executive summary, not from the staging table itself. **CONFIDENCE: Moderate.** Verify
   against <https://www.fertstert.org/article/S0015-0282(12)00187-2/fulltext> before implementing PERI-01's
   60-day threshold.
6. **DSM-5 PMDD's "≥2 consecutive symptomatic cycles of prospective daily ratings"** — retrieved from secondary
   summaries only. Verify against DSM-5-TR before building a PMDD-adjacent feature (and note: a PMDD *screening*
   feature would very likely be a device claim under both FDA and MDR — see §3.3).
7. **The "2.73 bpm" follicular→luteal resting-HR shift** and the **"4.65 ms" HRV shift** came from a search
   summary aggregating wearable studies, not from a paper I fetched. Goodale 2019's numbers (56.56 → 60.47 bpm)
   are verified; those two are not.
8. **Natural Cycles Berglund Scherwitzl 2017 and the 2021 US-cohort Pearl Indices** were retrieved at
   abstract/summary level, not full text. **CONFIDENCE: Moderate.**
9. **Leiva 2017's combined mucus+LH specificity (97–99% vs 77–95% vs 91%)** was reported in the retrieval of the
   article but I did not see the underlying table. **CONFIDENCE: Moderate.**
10. **NICE NG88 has no numeric HMB threshold.** This is a finding, not a gap: NICE deliberately defines HMB
    functionally (*"excessive menstrual blood loss which interferes with a woman's physical, social, emotional
    and/or material quality of life"*) and Rec 1.1.1 instructs clinicians to focus on quality of life *"rather
    than focusing on blood loss."* If you want a UK-aligned HMB rule, it must be quality-of-life-based, not
    product-count-based.
11. **WHO** publishes no consumer-facing numeric menstrual-normality thresholds that I could locate; FIGO is the
    international standard-setter here. No WHO citation appears in this document for that reason.
12. **The source PRD was not provided to me**, so §2.9 is a general checklist of guideline-recommended items,
    not a gap analysis against your actual document. Re-run it against the real PRD.

---

## 8. SOURCE LIST (all retrieved)

**Clinical guidelines / official**
- ACOG, Heavy Menstrual Bleeding FAQ — <https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding>
- ACOG, Abnormal Uterine Bleeding FAQ — <https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding>
- ACOG, Amenorrhea: Absence of Periods FAQ — <https://www.acog.org/womens-health/faqs/amenorrhea-absence-of-periods>
- ACOG, Dysmenorrhea: Painful Periods FAQ — <https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods>
- ACOG Committee Opinion No. 651 (Dec 2015), Menstruation in Girls and Adolescents — <https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign>
- ACOG news release (Apr 16, 2026), Updated Guidance on Evaluation of Postmenopausal Bleeding — <https://www.acog.org/news/news-releases/2026/04/acog-publishes-updated-guidance-evaluation-postmenopausal-bleeding>
- Jain V et al. (2023), FIGO Systems 1 and 2, *Int J Gynaecol Obstet* — <https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/>
- Office on Women's Health, Period problems — <https://womenshealth.gov/menstrual-cycle/period-problems>
- NHS, Heavy periods — <https://www.nhs.uk/conditions/heavy-periods/>
- NHS, Missed or late periods — <https://www.nhs.uk/conditions/stopped-or-missed-periods/>
- NHS, Period pain — <https://www.nhs.uk/conditions/period-pain/>
- NHS, Postmenopausal bleeding — <https://www.nhs.uk/conditions/post-menopausal-bleeding/>
- NICE NG88, Heavy menstrual bleeding — <https://www.nice.org.uk/guidance/ng88> (PDF: <https://www.nice.org.uk/guidance/ng88/resources/heavy-menstrual-bleeding-assessment-and-management-pdf-1837701412549>)

**Evidence — ovulation detection & wearables**
- Su HW et al. (2017), *Bioeng Transl Med* — <https://pmc.ncbi.nlm.nih.gov/articles/PMC5689497/>
- Thigpen N, Patel S, Zhang X (2025), *JMIR* 27:e60667 — <https://pmc.ncbi.nlm.nih.gov/articles/PMC11829181/>
- Wang Y et al. (2025), *Hum Reprod* 40(3):469–478 — <https://academic.oup.com/humrep/article-abstract/40/3/469/7989515>
- Gombert-Labedens M et al. (2024), *J Biol Rhythms* 39(4):331–350 — <https://pmc.ncbi.nlm.nih.gov/articles/PMC11294004/>
- Goodale BM et al. (2019), *JMIR* 21(4):e13404 — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6495289/>
- Leiva RA et al. (2017), *Front Public Health* 5:320 — <https://pmc.ncbi.nlm.nih.gov/articles/PMC5712333/>
- Symul L et al. (2019), *npj Digit Med* — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6635432/>
- Bull JR et al. (2019), *npj Digit Med* — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244/>

**Evidence — method effectiveness**
- Peragallo Urrutia R et al. (2018), *Obstet Gynecol* 132(3):591–604 — PDF: <https://www.sensiplan.nl/wp-content/uploads/2025/02/Effectiveness-of-Fertility-Awareness%E2%80%93Based-Methods-for-Pregnancy-Prevention_A-Systematic-Review.pdf>
- Guttmacher Institute, Contraceptive Effectiveness in the United States — <https://www.guttmacher.org/fact-sheet/contraceptive-effectiveness-united-states>
- Berglund Scherwitzl R et al. (2017), *Contraception* — <https://www.contraceptionjournal.org/article/S0010-7824(17)30429-8/fulltext>

**Regulatory**
- FDA, General Wellness: Policy for Low Risk Devices (issued Sept 27, 2019) — verbatim transcript: <https://innolitics.com/articles/fda-guidance-general-wellness-policy-for-low-risk-devices/>
- Federal Register notice, 2016 final guidance availability — <https://www.federalregister.gov/documents/2016/07/29/2016-17902/general-wellness-policy-for-low-risk-devices-guidance-for-industry-and-food-and-drug-administration>
- Covington & Burling (Jan 2026), FDA Issues Revised Guidance on General Wellness Products — <https://www.cov.com/en/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products>
- MDCG 2019-11 (Oct 2019) — <https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf>
- MDCG 2019-11 Rev.1 (June 2025) — <https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf>
