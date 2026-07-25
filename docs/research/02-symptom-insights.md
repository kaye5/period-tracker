# Track B — Turning Self-Tracked Symptom Logs into Statistically Honest Personal Insights

**Scope:** single user, local-only, 3–24 cycles of self-tracked data. No population model, no cloud, no cohort.
**Date of research:** 2026-07-22.
**Author's note on evidence handling:** every substantive claim below carries an inline citation to a source I actually retrieved during this research session. Sources I could only see at *search-snippet* level (not full text) are marked `[snippet-only]`. Sources whose full text I retrieved are unmarked. Anything I could not verify is listed in the final section rather than smoothed over.

---

## 0. Source inventory (what was actually retrieved)

| # | Source | Retrieved? |
|---|---|---|
| S1 | Li K, Urteaga I, Wiggins CH, Druet A, Shea A, Vitzthum VJ, Elhadad N. "Characterizing physiological and symptomatic variation in menstrual cycles using self-tracked mobile-health data." *npj Digital Medicine* 3:79 (2020). https://pmc.ncbi.nlm.nih.gov/articles/PMC7250828/ | Full text |
| S2 | Symul L, Wac K, Hillard P, et al. "Assessment of menstrual health status and evolution through mobile apps for fertility awareness." *npj Digital Medicine* 2:64 (2019). https://pmc.ncbi.nlm.nih.gov/articles/PMC6635432/ | Full text |
| S3 | Schmalenberger KM, et al. "How to study the menstrual cycle: Practical tools and recommendations." *Psychoneuroendocrinology* 123:104895 (2021). https://pmc.ncbi.nlm.nih.gov/articles/PMC8363181/ | Full text |
| S4 | Alvergne A, Vlajic Wheeler M, Högqvist Tabor V. "Do sexually transmitted infections exacerbate negative premenstrual symptoms? Insights from digital health." *Evolution, Medicine & Public Health* (2018). https://pmc.ncbi.nlm.nih.gov/articles/PMC6070031/ | Full text |
| S5 | Kiesner J, Eisenlohr-Moul T, Vidotto G. "Affective Risk Associated With Menstrual Cycle Symptom Change." *Frontiers in Global Women's Health* (2022). https://www.frontiersin.org/journals/global-womens-health/articles/10.3389/fgwh.2022.896924/full | Full text |
| S6 | Ainsworth AJ, Peven K, Bamford R, Zhaunova L, Salimgaraev R, Prentice C, Wickham A, Croft J, Ponzo S, Babayev S. "Global Menstrual Cycle Symptomatology as Reported by Users of a Menstrual Tracking Mobile Application." medRxiv 2022.10.20.22280407 (v2, 2023-07-06). https://api.biorxiv.org/details/medrxiv/10.1101/2022.10.20.22280407 | Abstract + metadata via API (full text blocked 403) |
| S7 | Pierson E, Althoff T, Thomas D, Hillard P, Leskovec J. "Daily, weekly, seasonal and menstrual cycles in women's mood, behaviour and vital signs." *Nature Human Behaviour* 5:716–725 (2021). https://pubmed.ncbi.nlm.nih.gov/33526880/ + https://med.stanford.edu/news/insights/2021/02/menstrual-cycle-more-powerful-than-daily-weekly-and-seasonal-cycles-in-command-of-mood-vital-signs.html | Abstract + institutional press summary |
| S8 | Hofmeister S, Bodden S. "Premenstrual Syndrome and Premenstrual Dysphoric Disorder." *American Family Physician* 94(3) (2016). https://www.aafp.org/pubs/afp/issues/2016/0801/p236.html | Full text |
| S9 | "Making Strides to Simplify Diagnosis of Premenstrual Dysphoric Disorder" (editorial on C-PASS). *Am J Psychiatry* (2017). https://pmc.ncbi.nlm.nih.gov/articles/PMC5291290/ | Full text |
| S10 | Takeda T, et al. "Reliability and validity of the Japanese version of the DRSP (J-DRSP) and short form." (2021). https://pmc.ncbi.nlm.nih.gov/articles/PMC7977312/ | Full text (contains the 24 DRSP items) |
| S11 | Teherán AA, Piñeros LG, Pulido F, Mejía Guatibonza MC. "WaLIDD score, a new tool to diagnose dysmenorrhea and predict medical leave in university students." *Int J Womens Health* 10:35–45 (2018). https://pmc.ncbi.nlm.nih.gov/articles/PMC5775738/ | Full text |
| S12 | "Pictorial methods to assess heavy menstrual bleeding in research and clinical practice: a systematic literature review." *BMC Womens Health* (2020). https://pmc.ncbi.nlm.nih.gov/articles/PMC7011238/ | Full text |
| S13 | "Quantifying menorrhagia and overview of nonsurgical management of heavy menstrual bleeding." *Hematology ASH Educ Program* (2024). https://pmc.ncbi.nlm.nih.gov/articles/PMC11665629/ | Full text |
| S14 | ACOG Committee Opinion 785 screening tool, as reproduced in *AFP*: "Heavy Menstrual Bleeding in Adolescents: ACOG Management Recommendations" (2020). https://www.aafp.org/pubs/afp/issues/2020/0515/p633.html | Full text |
| S15 | "Linguistic Validation of a British-English Version of the SAMANTA Questionnaire and HMB-VAS Tool." *Womens Health Rep* (2024). https://pmc.ncbi.nlm.nih.gov/articles/PMC11693961/ | Full text |
| S16 | Worsfold L, Marriott L, Johnson S, Harper JC. "Period tracker applications: What menstrual cycle information are they giving women?" *Women's Health (Lond)* (2021). https://pmc.ncbi.nlm.nih.gov/articles/PMC8504278/ | Full text |
| S17 | Adnan T, et al. "The real-world applications of the symptom tracking functionality available to menstrual health tracking apps." *Curr Opin Endocrinol Diabetes Obes* (2021). https://pmc.ncbi.nlm.nih.gov/articles/PMC8631160/ | Full text |
| S18 | Zhou W, Karaturhan P, Weilenmann A, Zhu J. "'It became a self-fulfilling prophecy': How Lived Experiences are Entangled with AI Predictions in Menstrual Cycle Tracking Apps." DIS '26. https://arxiv.org/pdf/2605.13261 | Full PDF (summarised) |
| S19 | Haines T, Beare R, Srikanth V. "Re-examining the issue of false positives in the era of big data and high-frequency health measurement technologies." *Innovation in Aging* (2024). https://pmc.ncbi.nlm.nih.gov/articles/PMC11690885/ | Abstract only |
| S20 | Li K, et al. "A predictive model for next cycle start date that accounts for adherence in menstrual self-tracking." *JAMIA* 29(1):3–11 (2022). https://academic.oup.com/jamia/article/29/1/3/6371799 | Full text |
| S21 | Henry, Shirin, Goshtasebi, Prior. "Prospective 1-year assessment of within-woman variability of follicular and luteal phase lengths…" *Human Reproduction* 39(11):2565 (2024). https://academic.oup.com/humrep/article/39/11/2565/7775370 | Full text |
| S22 | "Premenstrual syndrome, a common but underrated entity: review of the clinical literature." https://pmc.ncbi.nlm.nih.gov/articles/PMC8187976/ | Full text |
| S23 | Gigerenzer G. "What are natural frequencies?" *BMJ* (2011). http://library.mpib-berlin.mpg.de/ft/gg/gg_what_2011.pdf (also https://pure.mpg.de/rest/items/item_2099208_9/component/file_3562683/content) | `[snippet-only]` |
| S24 | Romans S, Clarkson R, Einstein G, Petrovic M, Stewart D. "Mood and the menstrual cycle: a review of prospective data studies." *Women's Health Issues* 22(6) (2012). https://pubmed.ncbi.nlm.nih.gov/23036262/ | `[snippet-only]` |
| S25 | Kiesner J. "One woman's low is another woman's high: Paradoxical effects of the menstrual cycle." *Psychoneuroendocrinology* 36:68–76 (2011). https://pubmed.ncbi.nlm.nih.gov/21232872/ (via S5 replication) | `[snippet-only]` — but the key proportions are independently confirmed in S5 (full text) |
| S26 | Warner PE, et al. "Menorrhagia I: measured blood loss, clinical features, and outcome in women with heavy periods." *Am J Obstet Gynecol* 190(5):1216–23 (2004). https://pubmed.ncbi.nlm.nih.gov/15167823/ | `[snippet-only]` |
| S27 | Bull JR, et al. "Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles." *npj Digital Medicine* 2:83 (2019). https://www.nature.com/articles/s41746-019-0152-7 | `[snippet-only]` (nature.com paywall redirect) |
| S28 | "Numerical rating scale for dysmenorrhea-related pain: a clinimetric study." *Gynecological Endocrinology* 38(8) (2022). https://pubmed.ncbi.nlm.nih.gov/35850576/ | `[snippet-only]` |
| S29 | Nagpal A, Schmalenberger KM, … Eisenlohr-Moul TA. "How to study the menstrual cycle as a continuous variable: PACTS with the menstrualcycleR package." *Psychoneuroendocrinology* 181:107584 (2025). https://github.com/eisenlohrmoullab/menstrualcycleR | `[snippet-only]` — README/paper body not retrievable |
| S30 | Symul L, et al. "Labeling self-tracked menstrual health records with hidden semi-Markov models." (2021). https://pubmed.ncbi.nlm.nih.gov/34495854/ | `[snippet-only]` (medRxiv 403) |

---

## 1. CYCLE-DAY ALIGNMENT

**CONFIDENCE: Strong**

### 1.1 The answer: backward, from the NEXT period onset — for anything premenstrual/luteal

For detecting a **recurring premenstrual pattern**, symptoms must be aligned **backward from the next period onset** (day −1 = the day before bleeding starts, −2, −3, …). Forward alignment from the current period start (day 1, 2, 3…) is correct only for **menstrual** and **early-follicular** phenomena.

The methodological literature says this explicitly:

> "If the observation date falls on both the forward- and backward-count timelines, the backward-count value is preferred." — Schmalenberger et al. 2021, *Psychoneuroendocrinology* (S3)

and, decisively for our purpose:

> "the precise determination of the mid-luteal phase *cannot* be achieved by the forward-count method alone" — S3

Symul et al. (2019) state the physiological reason for their own analysis choice verbatim:

> "As cycle durations vary by several days … and given that the duration of the luteal phase (after ovulation) has been shown to vary less than the follicular phase (before ovulation), ovulation-related observations (BBT, mucus, cervix, vaginal sensation) are shown **from the end of each cycle**." — Symul et al. 2019, *npj Digital Medicine* (S2)

### 1.2 Why follicular variability matters — with numbers

Cycle-length variability is concentrated in the follicular (pre-ovulatory) phase. Two independent datasets:

- Symul et al. 2019 (S2): median follicular phase **16 days**; median luteal phase **12 days** (Kindara) / **13 days** (Sympto). They note the follicular distribution "is asymmetrical" with a longer tail, and the luteal distribution "presents … a smaller standard deviation."
- Bull et al. 2019 (S27) `[snippet-only]`: 612,613 ovulatory cycles from 124,648 users; mean cycle length 29.3 d; **mean follicular phase 16.9 d (95% CI 10–30)** vs **mean luteal phase 12.4 d (95% CI 7–17)** — a ~20-day follicular spread against a ~10-day luteal spread.

The practical consequence: **forward day 20 is not a fixed physiological location.** In a 26-day cycle it is 6 days before menses; in a 34-day cycle it is 14 days before menses. Bin symptoms by forward day and you smear the premenstrual window across several bins in proportion to the user's own cycle-length variability — which for a small-N user is exactly the noise you cannot afford. Backward day −5 is always 5 days before bleeding, regardless of cycle length.

**Important caveat — do not over-claim luteal fixity.** Henry et al. 2024, *Human Reproduction* (S21), with 676 ovulatory cycles from 53 prospectively-screened women, found **within-woman** variability: median follicular-phase variability 5.2 days (range 0.5–43.5) vs median luteal-phase variability 3.0 days (range 0.7–7.9), follicular significantly greater (P < 0.001). Their conclusion "counter[s] the oft-quoted idea that the LP is stable 13–14 days long." So: luteal < follicular in variability (which is all our argument needs), but luteal is **not** fixed, and any window built around an *inferred* ovulation day (e.g. "next period minus 14") inherits ~3 days of within-person error.

### 1.3 How the literature actually did it

- **Alvergne et al. 2018** (S4), analysing Clue app data (N = 865), defined the late luteal phase as **"3, 4, or 5 days before menses onset"** — i.e. explicitly backward-aligned — and compared it against the early luteal phase, using mixed logistic regression with temporal autocorrelation.
- **C-PASS / DRSP** (S9, S10) use a backward-aligned premenstrual week and a forward-aligned postmenstrual reference week (see §2).
- **Li et al. 2020** (S1) — the paper this brief was asked to examine most closely — **did not align symptoms to cycle day at all.** They state they measure "the per-user proportion of cycles where a symptom has been tracked … ignoring at which phase or day of the cycle the symptom occurred," and flag phase-resolved analysis as future work. **This is the single most important correction to the brief's premise: Li et al. 2020 is a source on tracking-artifact handling and cycle-length variability, not on symptom timing.** Their symptom findings are cycle-level prevalence contrasts between high- and low-variability users, not timing findings.
- **PACTS / `menstrualcycleR`** (Nagpal et al. 2025, S29) `[snippet-only]` is the current state of the art: a continuous cycle-time variable anchored to **both** menses and ovulation, reported to improve alignment "especially in the variable follicular phase." I could not retrieve the exact scaling formula (see §"What I could not verify"). For an app without BBT/LH input, ovulation anchoring is not available anyway.

### 1.4 Concrete binning recommendation for a small-N user

Every window is defined on a **completed** cycle (next period start known). Backward windows take precedence over forward windows on any day both could claim (S3's rule).

| Window key | Definition | Anchor | Use |
|---|---|---|---|
| `MENSTRUAL` | forward day **+1 … +4** | this period start | Menstrual symptoms (cramps, flow) |
| `FOLLICULAR_REF` | forward day **+4 … +10**, excluding days with logged bleeding | this period start | **Reference / "clearance" window.** Matches the C-PASS postmenstrual week and the DRSP follicular window (S9, S10) |
| `PERIOVULATORY` | backward day **−17 … −12** | **next** period start | Mid-cycle. **Lowest confidence** — inherits ~3 d luteal error (S21). Off by default |
| `MID_LUTEAL` | backward day **−11 … −8** | **next** period start | Optional |
| `PREMENSTRUAL` | backward day **−7 … −1** | **next** period start | **Primary detection window.** Matches DSM-5 "final week before menses" (S8), C-PASS premenstrual week (S9), DRSP luteal window CD−6…CD0 (S10), and S3's "premenstrual week, days −7 to −1" |
| `PREMENSTRUAL_ACOG` | backward day **−5 … −1** | **next** period start | Secondary/narrow. Matches ACOG's "five days prior to the onset of menses" (S8, S22) |
| `PERIMENSTRUAL` | backward **−3** through forward **+2** | both | Matches S3's perimenstrual definition (days −3 to +2). Useful for cramps |

**Guards:**
- If cycle length < 21 days, drop `PERIOVULATORY` and `MID_LUTEAL` (windows collide). Keep `PREMENSTRUAL` and `MENSTRUAL`.
- If cycle length > 45 days, flag the cycle as anovulatory-suspect; keep `PREMENSTRUAL` (still valid — it is anchored to the bleed) but drop mid-cycle windows.
- Never compute a backward window on the in-progress cycle. This means **the current cycle can never contribute to a premenstrual insight** — a real UX consequence: insights update at period onset, not continuously.

---

## 2. MINIMUM DATA THRESHOLDS

**CONFIDENCE: Strong** (for the clinical standards) / **Moderate** (for the app-specific translation)

### 2.1 What the clinical standards require

| Standard | Cycles required | Window | Symptom rule |
|---|---|---|---|
| **DSM-5 / DSM-5-TR PMDD** | "Criterion A should be confirmed by **prospective daily ratings during at least two symptomatic cycles**" (S8) | "final week before menses"; improve within days of onset; minimal/absent post-menses | ≥5 symptoms, ≥1 of which is affective (lability, irritability, depressed mood, anxiety) (S8) |
| **ACOG PMS** | Symptoms "reported five days prior to the onset of menses in the **three prior menstrual cycles**", relieved within 4 days of onset, no recurrence until at least cycle day 13; "occur reproducibly during **two cycles of prospective recording**" (S8, S22) | 5 days before menses | ≥1 of 6 affective (anger, depression, anxiety, confusion, irritability, social withdrawal) **and** ≥1 of 4 somatic (bloating, headache, breast tenderness, extremity swelling) (S22) |
| **ISPMD core PMD** | "prospectively rated for **at least two cycles**" (S22) | luteal, absent after menses and before ovulation | — |
| **C-PASS** (Eisenlohr-Moul et al. 2017) | **≥2 symptomatic cycles** of daily DRSP (S9) | Premenstrual week (S9 states "the premenstrual week including day 1 of menstruation"; other descriptions give days −7 to −1) vs postmenstrual **days 4–10** | Per symptom: **≥30% percent-change** premenstrual vs postmenstrual; premenstrual max **≥4** ("moderate") on a 1–6 scale; **≥2 days** at ≥4 in the premenstrual week; postmenstrual max **≤3** (clearance). C-PASS showed **94.5% agreement with expert clinical diagnosis** in n=267 (S9) |
| **DRSP instrument** | daily, 24 items, 1–6 scale (1 = "not at all", 6 = "extreme"); scoring windows luteal **CD−6 to CD0** (CD0 = day before menstruation started) and follicular **CD4 to CD10** (S10) | — | — |

Two things to notice. First: **every clinical standard is backward-anchored on the premenstrual side and forward-anchored on the reference side** — exactly the hybrid scheme recommended in §1.4. Second: **every clinical standard demands prospective daily rating**, because retrospective reports are unreliable — S8 states that "patients greatly overestimate the cyclical nature of symptoms, when in fact they are erratic or simply exacerbated during their luteal phase."

### 2.2 What the within-person methods literature requires

Schmalenberger et al. 2021 (S3):
> "three repeated measures of the outcome across one cycle could be considered the minimal acceptable standard for estimating within-person effects"

> "three or more observations across two cycles allows for greater confidence in reliability of between-person differences"

> multilevel modelling requires "at least three observations per person to estimate random effects of the cycle"

That is a floor for *estimating* an effect, not for *asserting a recurring pattern to a user*. For assertion, the binding constraint is statistical (§3.2), and it is stricter.

### 2.3 What the tracking-data literature enforces

- **Li et al. 2020** (S1): excluded cycles > 90 days; **removed users who had tracked only 2 cycles** (i.e. ≥3 cycles required); flagged "atypically long" cycles where the cycle-length difference "exceeds the user's median CLD by at least 10 days"; validated the exclusion by confirming "no evidence of bleeding-related events during this interval" in **89.18%** of excluded cycles.
- **Li et al. 2022, JAMIA** (S20): excluded users who "have only tracked 2 cycles" and removed cycles "for which the user has not provided period data within 90 days." Their core insight is that a skipped period log makes two cycles (e.g. 27 + 35) appear as one 62-day cycle — so adherence artifacts masquerade as physiology.
- **Symul et al. 2019** (S2): required "observation gaps were no longer than 15 days within a given cycle"; typical users "report their observations for over 16 days per cycle" (~55% of a 29-day cycle), rising to "up to 40% of cycles being tracked every single day when seeking pregnancy."

### 2.4 Concrete thresholds the app should enforce

**Before showing ANY symptom-pattern insight:**

```
GATE_A  ≥ 3 completed cycles in the record            (Li et al. 2020/2022 floor: >2 cycles)
GATE_B  ≥ 5 QUALIFYING completed cycles for a claim   (see §3.2 — statistical necessity)
GATE_C  a cycle QUALIFIES for a (symptom, window) test iff ALL of:
          - cycle is complete (next period onset recorded)
          - 21 ≤ cycle length ≤ 45 days
          - cycle length ≤ user's median + 10 days     (Li et al. 2020 anomaly rule)
          - ≥ 5 of the 7 PREMENSTRUAL days have an explicit log entry   (≥71% coverage)
          - ≥ 4 of the 7 FOLLICULAR_REF days have an explicit log entry (≥57% coverage)
          - ≥ 50% of all days in the cycle have an explicit log entry
GATE_D  the symptom must have ≥ 3 total logged occurrences across the record
        AND occur in ≥ 2 distinct cycles
        (below this, no test is run — this is a pre-filter, not an outcome-dependent filter)
```

**Tiering of what may be displayed:**

| Qualifying cycles | What the app may say |
|---|---|
| 0–2 | Nothing. "Keep logging — we need at least 3 complete cycles before we can look for patterns." |
| 3–4 | **Descriptive counts only**, explicitly labelled as insufficient: "You logged cramps in the week before your period in 3 of your last 3 cycles. That is too few cycles to tell whether this is a repeating pattern." Never call it a pattern. |
| 5–7 | Pattern claims allowed, but only for a **pre-declared primary panel of ≤ 3 symptoms** (multiplicity constraint, §3.4) |
| 8–11 | Pattern claims for a panel of ≤ 8 symptoms |
| ≥ 12 | Full default symptom list (≤ 12 symptoms), one primary window |

The 3-cycle floor deliberately matches ACOG's "three prior menstrual cycles" (S8) and Li et al.'s inclusion rule (S1); the 5-cycle floor for an actual *claim* is derived arithmetically in §3.2.

---

## 3. A CONCRETE, DEFENSIBLE INSIGHT RULE

**CONFIDENCE: Moderate** — the clinical windows and thresholds are cited; the specific test choice and the exact arithmetic are my derivation, presented transparently so it can be checked.

### 3.1 The unit of replication is the CYCLE, not the day

This is the load-bearing design decision. Days within a cycle are strongly autocorrelated (a symptom on day −3 predicts a symptom on day −2). A day-level test with 7 premenstrual days × 6 cycles = 42 "observations" looks powerful and is fraudulent — the effective sample size is 6. Alvergne et al. 2018 (S4) handled this in a population study with "mixed logistic regression with temporal autocorrelation accounting for repeated measures within individuals across cycles." For N=3–12 cycles in a local-only app, the honest and far simpler answer is: **collapse each cycle to one number, then test across cycles.**

### 3.2 The primary rule: a paired, direction-agnostic exact sign test on cycles

For symptom `S` and window `W` (default `PREMENSTRUAL` = backward −7…−1), with reference window `R` (= `FOLLICULAR_REF`, forward +4…+10 excluding bleeding days — the C-PASS/DRSP comparator, S9/S10):

For each qualifying cycle `c`:
```
p_W(c) = (# logged days in W where S present) / (# logged days in W)
p_R(c) = (# logged days in R where S present) / (# logged days in R)
d(c)   = p_W(c) - p_R(c)

if d(c) >=  0.20  ->  class(c) = "W-leaning"
if d(c) <= -0.20  ->  class(c) = "R-leaning"
else              ->  class(c) = "tie"       (excluded from the test)
```
The ±0.20 dead-band is an **effect-size floor**: on a 7-day window, 0.20 ≈ 1.4 days' difference, so a single stray log cannot flip a cycle. It plays the same role as C-PASS's "≥30% percent change" requirement (S9) — the point that a direction must be *big enough*, not merely present.

Let `n` = number of non-tie cycles, `k` = number of `W`-leaning cycles.
Under the null hypothesis "S has no systematic timing relative to the period," `W`-leaning and `R`-leaning are equally likely, so:

```
p_one_sided = Pr(Binomial(n, 0.5) >= k)      # test both directions; report whichever fires
```

**Exact values (verified arithmetic, p = 0.5):**

| k / n | one-sided p | Verdict at α = 0.05 |
|---|---|---|
| 3 / 3 | 0.1250 | **impossible to reach significance** |
| 4 / 4 | 0.0625 | **impossible** |
| 5 / 5 | 0.03125 | ✔ significant |
| 6 / 6 | 0.01563 | ✔ |
| 6 / 7 | 0.0625 | ✘ |
| 7 / 7 | 0.00781 | ✔ |
| 7 / 8 | 0.03516 | ✔ |
| 8 / 9 | 0.01953 | ✔ |
| 8 / 10 | 0.05469 | ✘ (just misses) |
| 9 / 10 | 0.01074 | ✔ |
| 9 / 12 | 0.07300 | ✘ |
| 10 / 12 | 0.01929 | ✔ |

**This yields the single cleanest design fact in this document: with fewer than 5 non-tie cycles, no premenstrual pattern can reach conventional significance under any assumption-free test.** Hence GATE_B ≥ 5. Any app that claims a "pattern" from 3 cycles is claiming something the data cannot support, regardless of how the number is dressed up.

### 3.3 Why not the alternatives

| Candidate rule | Why it is not the primary |
|---|---|
| **Raw count only** ("4 of your last 5 cycles") | No base-rate control. If a user logs fatigue on 60% of *all* days, it appears in the premenstrual window in ~100% of cycles and means nothing. Raw counts are the right *display*, not the right *gate*. |
| **Within-user rate ratio** (rate in W ÷ rate outside W) | Good effect-size measure, keep it as a secondary display number. But it is unstable when the outside-rate is near zero (division blow-up), and it has no natural significance threshold at N=5. Use it as a **floor**, not a test: require RR ≥ 2.0. |
| **Day-level binomial against the user's own base rate** | Tempting and much more "powerful" — but the power is fake, because it assumes day-level independence (§3.1). Will manufacture false positives. |
| **Fisher exact / χ² on a 2×2 day table** | Same independence violation. |
| **Mixed logistic regression with autocorrelation** (as in S4) | Statistically correct, but needs far more cycles than 3–12 to estimate random effects reliably, and is not explainable to a user. S3's own floor of "three observations per person to estimate random effects" is about feasibility, not adequacy. |
| **Sign test on cycles (chosen)** | Assumption-free, exact, the null p = 0.5 is not estimated from the data, the unit of replication is honest, and the output maps directly onto the "k of your last n cycles" display. |

### 3.4 The multiple-comparisons trap, and how to escape it

The trap is real and quantified. Haines, Beare & Srikanth 2024, *Innovation in Aging* (S19) showed by Monte Carlo that with high-frequency health data "an analyst with enough data can spuriously manufacture a significant finding for one in four to five studies," reaching a **cumulative Type I error rate of 26.8%** purely through flexible slicing around measurement points. Scanning ~30 symptoms × ~4 windows = **120 tests** at α = 0.05 has an expected ~6 false "patterns" per user, per refresh.

Worse: **you cannot correct your way out of it at N = 5–12.** Benjamini–Hochberg at FDR q = 0.10 requires the most significant test to satisfy `p ≤ q/m`. Combined with the exact p-values in §3.2:

| m (tests run) | required p for the best test | minimum cycles needed |
|---|---|---|
| 120 | 0.00083 | 11 consecutive same-direction cycles (0.5^11 = 0.00049) |
| 12 | 0.00833 | 7 / 7 (p = 0.00781) |
| 8 | 0.0125 | 7 / 7 |
| 6 | 0.01667 | 6 / 6 (p = 0.01563) |
| 3 | 0.0333 | 5 / 5 (p = 0.03125) |
| 1 | 0.10 | 4 / 4 (p = 0.0625) |

**So the only way a 5-cycle user ever sees a legitimate insight is if the app runs at most ~3 tests.** Multiplicity control is therefore not a post-hoc statistical step — it is a **product constraint on the size of the default symptom list**. This is the direct link to §5.

**The five-part escape:**

1. **Shrink `m` by design, before looking at outcomes.** One primary window (`PREMENSTRUAL`) only. A default symptom list of ≤ 12 items. Symptoms below GATE_D (≥3 occurrences, ≥2 cycles) are not tested — this is an outcome-independent filter, so it does not bias the FDR.
2. **Scale `m` to the data.** Test-budget tiers by qualifying-cycle count (§2.4): 3 tests at N=5–7, 8 at N=8–11, 12 at N≥12.
3. **Benjamini–Hochberg at q = 0.10** over the tests actually run. FDR at 0.10 rather than 0.05 is appropriate for exploratory personal analytics where a flagged pattern prompts further observation, not treatment.
4. **Effect-size floor as a second gate:** rate ratio ≥ 2.0 AND absolute rate difference ≥ 0.20. A pattern must be both unlikely by chance *and* big enough to matter. (Direct analogue of C-PASS's ≥30% percent-change requirement, S9.)
5. **Hold-out replication:** re-check the pattern on the single most recent qualifying cycle. If it did not hold there, the app must say so in the same card ("this didn't hold in your last cycle"), not hide it.

### 3.5 Display: natural frequencies, not p-values

Gigerenzer (S23) `[snippet-only]`: natural frequencies ("31 out of 100") are understood where conditional probabilities are not — "Even 10 year olds can determine the positive predictive value when given natural frequencies … but are helpless when given conditional probabilities." Combined with S18's finding that apps "present predictions in ways that obscure uncertainty," the display rule is: **the p-value gates the insight; the count is what the user sees.**

**Exact wording template (primary):**

```
{SYMPTOM_LABEL} showed up more often before your period.

You logged {SYMPTOM_LABEL} in the 7 days before your period started
in {k} of your last {n} complete cycles, and in {j} of {n} in the
week after your period ended.

Based on {n} cycles with enough days logged.
This is a summary of what you recorded — not a diagnosis, and not a cause.
```

**Secondary line (optional, expandable "show the numbers"):**

```
Days logged with {SYMPTOM_LABEL}:
  Week before period:      {a} of {A} days ({pct_a}%)
  Week after period ended: {b} of {B} days ({pct_b}%)
```

**Required negative/uncertainty variants:**

```
[insufficient data]
  Not enough yet. We need at least 5 complete cycles with most days
  logged before we can tell a repeating pattern from coincidence.
  You have {n}.

[did not replicate]
  This didn't hold in your most recent cycle.

[reverse direction]
  {SYMPTOM_LABEL} showed up more often after your period than before it,
  in {k} of your last {n} cycles.

[no pattern]
  We looked at {m} things you track and didn't find a repeating pattern
  tied to your cycle. That's a normal result.
```

The last one matters: an app that only ever surfaces positives *is* the multiple-comparisons problem made visible.

---

## 4. MISSING DATA

**CONFIDENCE: Moderate** — the bias directions are well-established and the app-adherence literature supports the concern; the exact coverage number is my recommendation, anchored to Symul's observed adherence.

### 4.1 The two choices and their biases

| Treatment | Bias introduced |
|---|---|
| **Unlogged = "symptom absent"** (imputing 0) | Deflates every rate, but deflates it *most* where logging is sparsest. If a user logs more diligently in the premenstrual week (plausible — people log when something is happening), the premenstrual rate is *relatively* inflated and the app **manufactures premenstrual patterns**. This is precisely the engagement artifact Li et al. warn about: "self-tracked data … reflect not only physiological behaviors, but also the engagement dynamics of app users" (S1). Symmetrically, if the user logs *less* premenstrually because they feel awful, the true pattern is erased. |
| **Unlogged = "unknown"** (drop from denominator) | Unbiased under Missing-At-Random. But logging is often symptom-*driven* (MNAR): a user opens the app because they have cramps. That inflates the observed rate in **every** window; the *comparison between windows* survives only if the logging-propensity difference between windows is small — which is exactly what a coverage threshold enforces. |

**Recommendation: treat unlogged days as UNKNOWN, never as absent — and pair this with a design fix that shrinks the unknown set.**

### 4.2 The design fix that actually solves it

The statistical problem is created by the UI. Provide a **one-tap "nothing to report today"** affordance (a single button that writes an explicit all-negative record). This converts *unknown* into a *true negative*, which is the only clean way to distinguish "no symptom" from "no log." Every day a user taps it is a day that legitimately enters the denominator. Without it, the app is permanently guessing.

Do **not** auto-fill unlogged days at midnight. That re-introduces the imputation bias with extra steps.

### 4.3 What the adherence literature supports

- **Symul et al. 2019** (S2): fertility-awareness users — a highly motivated population — logged "over 16 days per cycle," rising to "up to 40% of cycles being tracked every single day when seeking pregnancy," and the study's own inclusion rule was that "observation gaps were no longer than 15 days within a given cycle." A general period-tracking user should be assumed to log *less* than this.
- **Li et al. 2022, JAMIA** (S20): models adherence explicitly, with a per-user probability π that a *whole cycle's* period is skipped, producing artificially inflated cycle lengths (a 27-day and a 35-day cycle appearing as one 62-day cycle). Note their honest limitation: "The authors do not report aggregate statistics on what percentage of users or days go untracked."
- **Li et al. 2020** (S1): validated their cycle-exclusion procedure by checking for absence of bleeding events, finding **89.18%** of excluded cycles had "no evidence of bleeding-related events during this interval" — i.e. their exclusions were catching real tracking gaps rather than real long cycles.

I could **not** find a study that quantifies *within-cycle* logging drop-off by cycle day (e.g. "logging falls x% in the follicular phase"). This is listed in §"What I could not verify."

### 4.4 Concrete coverage thresholds

```
WINDOW-LEVEL (binding — this is what the inference depends on):
  PREMENSTRUAL window (7 days):    ≥ 5 of 7 days explicitly logged   (≥ 71%)
  FOLLICULAR_REF window (7 days):  ≥ 4 of 7 days explicitly logged   (≥ 57%)

CYCLE-LEVEL (secondary sanity check):
  ≥ 50% of cycle days explicitly logged
  no single gap > 10 consecutive unlogged days
    (tighter than Symul's ≤15-day rule, because a 15-day gap can swallow
     an entire premenstrual window in a short cycle)

BALANCE CHECK (prevents comparing a well-covered window to a sparse one):
  | coverage(W) - coverage(R) | ≤ 0.30
  Otherwise the cycle does not qualify for that comparison.

ROBUSTNESS GATE (cheap and decisive):
  Compute the insight TWICE:
    (a) unknown = excluded from denominator
    (b) unknown = symptom absent
  Show the insight only if it passes the full rule under BOTH.
  If it passes only under (a), it is an artifact of where the user logged.
```

The robustness gate is the single highest-value item in this section: it costs one extra pass over local data and it kills the entire class of engagement-artifact false positives that S1 warns about.

---

## 5. WHICH SYMPTOMS ARE WORTH TRACKING

**CONFIDENCE: Moderate** — population-level timing is well-supported; per-person detectability is inferred from the heterogeneity literature.

### 5.1 The two facts that structure the answer

**Fact 1 — at population level, the menstrual cycle is the dominant rhythm for mood and vital signs, but not for sleep and exercise.** Pierson et al. 2021, *Nature Human Behaviour* (S7), 241 million observations from 3.3 million users across 109 countries, 15 dimensions: "the menstrual cycle had the greatest magnitude for most of the measured dimensions"; "**Mood, vital signs and sexual behaviour vary most substantially over the course of the menstrual cycle, while sleep and exercise behaviour remain more constant.**" The Stanford summary of the same work (S7) adds that sleep and productivity were "more heavily influenced by the weekly cycle," and that body temperature, weight and resting heart rate "dipped at the onset of a period."

**Fact 2 — at individual level, the *direction* of mood cyclicity is not universal, and must never be assumed.** Kiesner, Eisenlohr-Moul & Vidotto 2022, *Frontiers in Global Women's Health* (S5), group-based trajectory modelling over two full cycles of daily reports in two samples:

| Trajectory group | Sample 1 (n=213) | Sample 2 (n=163) |
|---|---|---|
| PMS1 (strong perimenstrual increase) | 24% | 25% |
| PMS2 (weaker perimenstrual increase) | 37% | 33% |
| **Mid-cycle** (increase mid-cycle, *low* premenstrually) | **13%** | **16%** |
| **Non-cyclic** | **26%** | **26%** |

So ~61% show the textbook premenstrual pattern, ~13–16% show the **inverted** pattern, and ~26% show **none**. Corroborating this from the other side, Romans et al. 2012 (S24) `[snippet-only]` systematically reviewed prospective daily-mood studies and found that of 47 English-language studies, **18 (38.3%) found no association of mood with any menstrual cycle phase**, concluding there is no clear evidence that mood deteriorates cyclically premenstrually as a general rule.

**Product consequence:** a per-user detector is exactly the right tool (it can find the 61%, the 13%, and correctly report "none" for the 26%) — but only if it is **direction-agnostic** and willing to output "no pattern." An app that says "your luteal phase makes you irritable" is wrong for roughly 4 in 10 users.

### 5.2 Population timing evidence

Ainsworth et al. (S6), Flo app, **437,577 users / 896,051 cycles** (v2): somatic symptoms logged in **88.3% of cycles**; "negative physical and mood symptoms peak during the late luteal and bleeding phases, while positive mood and discharge dominate the fertile window"; symptom correlations include energetic↔happy r = 0.62 and fatigue↔bloating r = 0.62. (v1 of the same preprint reported 224,676 users / 498,126 cycles and 85.3%.)

Alvergne et al. 2018 (S4) demonstrated that individual symptoms *are* detectable in a backward-aligned late-luteal window from app data, finding headache in the late luteal phase at **OR = 2.36, 95% CI [1.19, 4.69]** in STI-positive non-contraceptive users, with sensitive emotions elevated across the luteal phase and dropping post-treatment (OR = 0.36, 95% CI [0.14, 0.88]).

ACOG's own symptom list (S22) is the clinical shortlist: 6 affective (anger, depression, anxiety, confusion, irritability, social withdrawal) + 4 somatic (bloating, headache, breast tenderness, extremity swelling). The DRSP's 24 items (S10) extend this: depressed/sad; hopeless; worthless/guilty; anxious/tense; mood swings; sensitive to rejection; angry/irritable; conflicts with people; less interest in usual activities; difficulty concentrating; lethargic/fatigued; increased appetite/overate; cravings for specific foods; slept more; trouble sleeping; overwhelmed; out of control; breast tenderness; breast swelling/bloated/weight gain; headache; joint or muscle pain; plus 3 functional-impairment items (productivity; hobbies/social; relationships).

### 5.3 The ranking (this is the default symptom list)

**TIER A — default ON. Best signal-to-noise; timing well-established and physiologically anchored to the bleed.**

| Rank | Symptom | Evidence |
|---|---|---|
| 1 | **Menstrual / pelvic cramps** | Anchored to menses itself; perimenstrual peak. In ACOG-adjacent somatic domain, DRSP item 21, and among the highest-prevalence app-logged symptoms (S6, S1's "Pain" category: cramps, tender breasts, headache, ovulation pain) |
| 2 | **Breast tenderness / swelling** | ACOG somatic criterion (S22); DRSP items 18–19 (S10); one of the tracking categories most associated with cycle-variability differences in Li et al. (S1) |
| 3 | **Bloating / abdominal swelling** | ACOG somatic criterion (S22); DRSP item 19; somatic + GI symptoms peak in late luteal and bleeding days (S6) |
| 4 | **Headache** | ACOG somatic criterion (S22); DRSP item 20; independently detectable in a backward-aligned late-luteal window in app data, OR 2.36 (S4) |
| 5 | **Fatigue / low energy** | DRSP item 11; fatigue↔bloating r = 0.62 in 896k cycles (S6); late-luteal/bleeding peak (S6) |
| 6 | **Food cravings / appetite change** | DRSP items 12–13 (S10); among the >60%-prevalence premenstrual symptoms in survey literature |
| 7 | **GI change (constipation / loose stools)** | Gastrointestinal symptoms explicitly among the categories peaking in "late luteal and bleeding days" (S6) |
| 8 | **Acne / skin** | Logged as a distinct app category (S1 "Skin"); acne logging frequency varies systematically with age in 896k cycles (S6) |

**TIER B — default ON, but direction must be discovered per-user, never assumed.**

| Rank | Symptom | Caveat |
|---|---|---|
| 9 | **Irritability / anger** | DRSP items 7–8; ACOG affective. But only ~61% show a premenstrual rise; 13–16% show the inverted mid-cycle pattern; 26% show none (S5) |
| 10 | **Low mood / sadness** | DRSP item 1; ACOG affective. Same heterogeneity; 38.3% of prospective studies found no phase association at all (S24) |
| 11 | **Anxiety / tension** | DRSP item 4; ACOG affective. Same caveat |
| 12 | **Emotional sensitivity** | DRSP item 6; specifically modelled and detected in the luteal phase in app data (S4) |

**TIER C — default OFF (opt-in). Real but confounded by non-cycle rhythms or requiring instruments.**

| Symptom | Why demoted |
|---|---|
| Sleep quality / duration | "sleep and exercise behaviour remain more constant" over the menstrual cycle and are "more heavily influenced by the weekly cycle" (S7). Any per-user cycle test here will mostly detect weekday structure unless day-of-week is controlled |
| Exercise / activity | Same (S7); also strongly behaviourally driven |
| Productivity / focus | Same weekly-cycle dominance (S7) |
| Libido / sexual activity | Does vary substantially over the cycle (S7) but is partner- and opportunity-dependent; interpreting a per-user pattern as physiological is unsafe |
| Weight, resting heart rate, body temperature | Do vary (they "dipped at the onset of a period," S7) but self-report without an instrument is unreliable; needs wearable input, out of scope for local-only self-report |

**TIER D — do not offer as an insight target at all.**

| Item | Why |
|---|---|
| "Ovulation pain" / mittelschmerz | Requires an ovulation anchor. Without BBT/LH, ovulation is inferred as "next period − ~13 d," and within-woman luteal variability is a median 3.0 days (S21). The window is wider than the symptom |
| Anything framed as "hormonal imbalance," "cortisol," "estrogen dominance" | Not measured, not measurable from a symptom log (see §8) |
| Cycle-syncing prescriptions (diet/workout by phase), seed cycling | Flagged as non-scientific content propagated by period apps in critical commentary (University of Sydney / *The Conversation*, https://theconversation.com/can-i-trust-my-period-tracking-app-heres-what-it-can-tell-you-and-what-to-watch-out-for-238422) |

**Hard product constraint from §3.4: the default list must be ≤ 12 items, and only the top 3 are tested at N = 5–7 cycles.** Adnan et al. 2021 (S17) found apps offering "at least 10 symptoms," with Ovia and WomanLog providing "more than 100 symptoms" — a 100-symptom list is statistically indefensible for insight generation. S17 also found that "most simply record the presence or absence of a symptom" and documented wild vocabulary inconsistency across apps (multiple terms for bleeding, for breast sensations, and for libido), recommending "standardized terminology" and "clinical-grade pain assessment including onset, location, intensity, and duration."

---

## 6. PAIN & FUNCTIONAL IMPACT

**CONFIDENCE: Strong** (on the instruments) / **Moderate** (on the recommended adaptation, which is an adaptation and not a validated instrument)

### 6.1 The validated options

**NRS 0–10 for dysmenorrhoea** — clinimetrically validated (S28) `[snippet-only]`: AUC 0.902 (95% CI 0.873–0.931) for criterion validity; cut-off of **3** with sensitivity 83% / specificity 86%; moderate negative correlation with SF-36 bodily pain (r = −0.46, p < 0.001); test–retest ICC = **0.90**, SEM = 0.97, **smallest detectable change = 2.76 points** in 105 women. A separate endometriosis study (https://pubmed.ncbi.nlm.nih.gov/33066973/) `[snippet-only]` set clinically meaningful change at a reduction of **4 points** for dysmenorrhoea NRS and 2 points for non-menstrual pelvic pain.

**Verbal Rating Scale** — a comparison study reported "agreement and significant discriminatory capability between VRS and NRS hence these two pain measurement tools can be used interchangeably in the assessment of dysmenorrhea" `[snippet-only]`.

**WaLIDD score** (Teherán et al. 2018, *Int J Womens Health* 10:35–45, S12/S11) — full item set retrieved:

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Wa** — Working ability affected | None | Almost never | Almost always | Always |
| **L** — Location (number of pain sites) | None | 1 site | 2–3 sites | 4 sites |
| **I** — Intensity (Wong-Baker) | Does not hurt | Hurts a little bit | Hurts a little more / even more | Hurts a whole lot / worst |
| **DD** — Days of pain | 0 days | 1–2 days | 3–4 days | ≥5 days |

Total **0–12**. Severity bands: 0 = no dysmenorrhoea; 1–4 mild; 5–7 moderate; 8–12 severe. Diagnostic cut-off **>6** (AUC 0.82); medical-leave prediction cut-off **>9** (AUC 0.97; sensitivity 100%, specificity 92.9%, PPV 78%, NPV 100%). Validated in **585 university students**, Cronbach's α = **0.723**. Arabic-language validation exists (https://pubmed.ncbi.nlm.nih.gov/39359901/) `[snippet-only]`.

### 6.2 Recommended lightweight scheme

Daily logging must be a 2-tap operation or adherence collapses (§4). So: **collect a coarse daily VRS + a coarse daily functional item, and derive a WaLIDD-shaped per-cycle roll-up.**

**Daily item 1 — pain intensity (shown only when the user taps "pain"):**
```
How bad is the pain right now?
  ( ) None                                          -> 0   [NRS 0]
  ( ) Mild — I notice it, it doesn't stop me        -> 1   [NRS 1-3]
  ( ) Moderate — distracting; I'd take a painkiller -> 2   [NRS 4-6]
  ( ) Severe — hard to do normal things             -> 3   [NRS 7-10]
```

**Daily item 2 — functional impact (one tap):**
```
Did pain change what you did today?
  ( ) No
  ( ) I cut back on some things
  ( ) I missed work, school, or plans
```

**Optional item 3 — location (multi-select, shown once per cycle or on first painful day). Exactly 4 sites, to preserve WaLIDD's L scoring:**
```
Where does it hurt?  [ ] Lower abdomen  [ ] Lower back
                     [ ] Thighs/legs    [ ] Pelvis/vulvar
```

**Per-cycle roll-up (derived, never asked):**
```
Wa = 0 if no impact days; 1 if 1 impact day; 2 if 2-3; 3 if >=4 impact days
     OR 3 if any "missed work/school/plans" day
L  = 0/1/2/3 from count of distinct sites (0 / 1 / 2-3 / 4)
I  = max daily intensity band across the cycle (0-3)
DD = 0 if 0 pain days; 1 if 1-2; 2 if 3-4; 3 if >=5 pain days
WaLIDD_derived = Wa + L + I + DD          # range 0-12
```

Display band names ("mild / moderate / severe") but **do not** display "you have dysmenorrhoea." Trigger the "worth mentioning to a clinician" prompt at **WaLIDD_derived ≥ 8** in ≥2 of the last 3 cycles (severe band, comfortably above the >6 diagnostic cut-off, and requiring recurrence).

**Honesty caveats to encode in the code comments and, in plain language, in the UI:**
- WaLIDD was validated as a **recall questionnaire in 585 university students** (S11). Deriving it from daily logs is an *adaptation*; its published AUCs do not transfer unchanged.
- The NRS **smallest detectable change is 2.76 points** (S28). On the 4-band scale above, that is roughly one full band. The app must never call a one-band shift "improvement" — use "about the same" for anything under a full band.

---

## 7. FLOW / BLEEDING QUANTIFICATION

**CONFIDENCE: Strong**

### 7.1 What the evidence says about PBAC

The Pictorial Blood Loss Assessment Chart (Higham 1990) scores towels at **1 / 5 / 20** points and tampons at **1 / 5 / 10** points by degree of soiling, with a cut-off of **≥100** giving sensitivity 86% / specificity 89% in the original validation (S12). But the systematic review (S12) found across studies sensitivity **58–99%**, specificity **7.5–89%**, and cut-offs ranging **50–185**, with "widespread inconsistency of chart design, scoring systems, diagnostic cut-off limits." Janssen's modified chart needed **>185** (62% sens / 95.5% spec); the modern SAP-c pictogram (Magnay 2014) achieved 82% / 92% with a diagnostic odds ratio of 52.4. The review's conclusion is explicit:

> "PBACs are best suited to the controlled and specific environment of clinical studies" and "the current lack of standardization precludes widespread use of the PBAC in primary care." (S12)

The ASH 2024 review (S13) reports the same picture (PBAC sensitivity 58–99%, specificity 7.5–89%).

**Therefore: do not make PBAC the primary consumer flow measure.** Reproducing a specific validated chart also has a real dependency on product form factor (superabsorbent vs conventional towels) and does not generalise to cups, discs or period underwear. Offer it, at most, as an opt-in "detailed bleeding diary" for users preparing for a clinic visit, and label it as such.

### 7.2 What actually identifies clinically heavy bleeding

**FIGO 2018 defines heavy menstrual bleeding as a symptom, not a volume:** "excessive menstrual blood loss, which interferes with a woman's physical, social, emotional and/or material quality of life" (Munro et al. 2018, *Int J Gynecol Obstet*, https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666) `[snippet-only]`; the same QoL-anchored wording is reproduced in the ACOG-derived summary (S14) and the ASH review (S13). This matters: the app should never assert a *volume* claim.

**The reality check on volume claims:** Warner et al. 2004 (S26) `[snippet-only]` surveyed 952 menstrual-complaint referrals; among 226 women with measured blood loss who believed their periods were heavy, **only 34% (95% CI 28–40%) actually had ≥80 mL**. Self-perceived heaviness is a poor volume estimator, which is a strong argument for the app to report the user's own data and prompt a clinical conversation rather than to adjudicate.

**Best single discriminators of measured ≥80 mL (Warner 2004, S26)** `[snippet-only]`: low ferritin, **clots > 1 inch in diameter**, and **changing protection more often than hourly**. Their combined logistic model correctly classified 76% (n = 161; sensitivity 60%, specificity 86%).

**ACOG Committee Opinion 785 screening tool** (S14, via *AFP* 2020), 8 questions, **sensitivity 89% for identifying an underlying bleeding disorder**:
1. Duration of period: <7 days / **≥7 days** / don't know
2. Frequency of flooding-or-gushing sensation: never/rarely/sometimes / **all or most of the time** / don't know
3. Bleeding through a tampon or pad within **2 hours**: never/rarely/sometimes / **all or most** / don't know
4. History of anaemia treatment: no / **yes** / don't know
5. Family history of a bleeding disorder: no / **yes** / don't know
6. Tooth extraction or dental surgery (6a: bleeding problems after)
7. Other surgery (7a: bleeding problems after)
8. Pregnancy history (8a: bleeding problems after delivery/miscarriage)

Screening is warranted if **any** of: (i) menses ≥7 days **with** flooding or bleeding through protection in ≤2 hours in most periods; (ii) history of anaemia treatment; (iii) family history of a diagnosed bleeding disorder; (iv) excessive bleeding after tooth extraction, delivery, miscarriage or surgery. S13 additionally notes the combination of PBAC >185 plus ≥1 positive screening question raises sensitivity to 95%.

**SAMANTA questionnaire** (S15) — 6 binary Yes/No items; items 1 and 3 score **3 points**, items 2, 4, 5, 6 score **1 point** each; total **0–10**; **cut-off ≥3**; original validation sensitivity **86.7%**, specificity **89.5%**. The six items address: (1) bleeding lasting more than 7 days, (2) three or more heavy-bleeding days, (3) periods being particularly inconvenient because of heaviness, (4) night-time staining of clothes or bedding, (5) worry about staining seating in public/private settings, (6) avoiding activities because of needing frequent pad/tampon changes. The companion **HMB-VAS** uses two 0–100 visual analogue scales (intensity and interference), combined as `10.9 × VAS-Int + 2.5 × VAS-Imp` with a cut-off of **700**.

### 7.3 Recommended scheme

**Daily (one tap, on bleeding days):**
```
Flow today:
  ( ) Spotting   ( ) Light   ( ) Medium   ( ) Heavy
```
Plus two optional one-tap flags, shown only when "Heavy" is selected:
```
[ ] Passed a clot bigger than about 1 inch (a 10p coin / a quarter)
[ ] Soaked through a pad or tampon in 2 hours or less
```
(Clot-size and 2-hour thresholds taken directly from Warner 2004 (S26) and ACOG CO 785 item 3 (S14).)

**Per-cycle derived, no extra questions:**
```
bleed_days        = count of days with flow >= Spotting
heavy_days        = count of days with flow == Heavy
any_large_clot    = OR over days
any_soak_2h       = OR over days
```

**Four best screening questions (ask once, then re-confirm every ~6 months — not daily):**
```
Q1  Do your periods usually last 7 days or more?                  [ACOG CO785 item 1 / SAMANTA item 1]
Q2  Do you ever soak through a pad or tampon in 2 hours or less?  [ACOG CO785 item 3 / Warner "changing >hourly"]
Q3  Do you pass clots bigger than about 1 inch across?            [Warner 2004 strongest predictor]
Q4  Do your periods stop you doing things you'd normally do?      [FIGO QoL anchor / SAMANTA item 6]
    ( ) Never  ( ) Sometimes  ( ) Most periods
```
Two optional history items with high yield and near-zero cost, drawn from ACOG CO 785 (S14): *"Have you ever been treated for anaemia or low iron?"* and *"Does anyone in your family have a bleeding disorder?"*

**Trigger rule (informational only, never diagnostic):**
```
if  (bleed_days >= 7  AND  (any_soak_2h OR any_large_clot))
     in >= 2 of the last 3 cycles
 OR (Q1 == yes AND (Q2 == yes OR Q3 == yes))
 OR  Q_anaemia == yes
 OR  Q_family_bleeding_disorder == yes
then show:
  "Some of what you've logged matches the questions clinicians use when
   deciding whether heavy bleeding is worth investigating. It doesn't mean
   anything is wrong. If you want to bring it up, here's a summary you can
   show them: [export]."
```
Note the ACOG tool was validated in **adolescents** (S14) and its 89% figure is for detecting an underlying bleeding disorder, not for "heaviness" per se. State this in the copy, don't quietly generalise it.

---

## 8. LANGUAGE

**CONFIDENCE: Moderate** — the critique literature is clear and retrieved; the specific templates are my synthesis.

### 8.1 What the published critique says

- **Predictions become self-fulfilling.** Zhou, Karaturhan, Weilenmann & Zhu, DIS '26 (S18): users treat algorithmic outputs "as authoritative despite their probabilistic nature"; predictions "become entangled with lived experience — users' awareness of forecasts influences their perception and reporting of symptoms, creating circular reinforcement patterns"; and apps "present predictions in ways that obscure uncertainty and limitations, presenting speculative outputs with unwarranted confidence." Their recommendation is explicit: "clearer communication strategies that explicitly convey prediction uncertainty … avoid presenting probabilistic estimates as definitive facts."
- **Apps routinely assert things they cannot know.** Worsfold, Marriott, Johnson & Harper 2021 (S16), reviewing 10 apps: many rely on the textbook 28-day/day-14 model; ovulation-day predictions were "exactly correct" in only **3 of 36 (8%)** with 67% predicted 2–9 days too early; predicted fertile windows ranged from **6 to 16 days** across apps "with no scientific basis for variation"; 54% of fertility apps use calendar dates only. Their recommendation: apps should "stop giving women inaccurate predictions."
- **Pseudoscientific framings are common in this app category.** Cycle syncing, seed cycling and astrology are named as non-scientific beliefs endorsed by some period apps (University of Sydney / *The Conversation*, https://theconversation.com/can-i-trust-my-period-tracking-app-heres-what-it-can-tell-you-and-what-to-watch-out-for-238422). The same commentary notes that when an app's prediction is wrong, "users may doubt their own body rather than the app's accuracy."
- **Frequency framing beats probability framing.** Gigerenzer (S23) `[snippet-only]`: natural frequencies "facilitate insight"; people — including 10-year-olds — reason correctly with "31 out of 100" and are "helpless when given conditional probabilities."
- **Discovering patterns in dense personal health data is easy and usually wrong.** Haines, Beare & Srikanth 2024 (S19): cumulative Type I error of **26.8%** through flexible analysis of high-frequency health data.
- **Prospective daily rating exists precisely because people misremember cyclicity.** S8: "patients greatly overestimate the cyclical nature of symptoms, when in fact they are erratic or simply exacerbated during their luteal phase."

### 8.2 Safe phrasing templates

| # | Template | Why it's safe |
|---|---|---|
| L1 | "In **{k} of your last {n}** complete cycles, you logged **{symptom}** in the 7 days before your period started." | Natural frequency (S23); descriptive; scoped to what was logged |
| L2 | "You logged **{symptom}** on **{a} of {A}** days in the week before your period, and **{b} of {B}** days in the week after it ended." | Shows the comparator and both denominators; no inference |
| L3 | "Based on **{n}** cycles where you logged most days." | States the evidence base and its dependence on logging |
| L4 | "This is a summary of what you recorded. It isn't a diagnosis, and it doesn't tell us why." | Explicit non-causal, non-diagnostic disclaimer |
| L5 | "Not enough data yet — we need at least 5 complete cycles with most days logged before we can tell a repeating pattern from coincidence." | Honest about the actual statistical floor (§3.2) |
| L6 | "This didn't hold in your most recent cycle." | Reports disconfirmation as prominently as confirmation |
| L7 | "We looked at {m} things you track and didn't find a repeating pattern tied to your cycle. That's a normal result." | Counters the "insights always find something" false-positive machine |
| L8 | "**{symptom}** showed up more often **after** your period than before it, in {k} of your last {n} cycles." | Direction-agnostic — required by the 13–16% inverted-pattern group (S5) |
| L9 | "Timing here is estimated from your past cycles, so it can be off by a few days." | Communicates uncertainty (S18); grounded in real luteal variability (S21) |
| L10 | "Some of what you've logged matches questions clinicians ask about heavy bleeding. It doesn't mean anything is wrong." | Flags without diagnosing (§7.3) |
| L11 | "Your cycles have ranged from {min} to {max} days over {n} cycles." | Descriptive range instead of a false point prediction (counters S16's critique) |
| L12 | "How often you log affects what we can see here." | Names the missingness dependency (§4) |

### 8.3 Unsafe phrasings and why

| Unsafe | Why it's unsafe |
|---|---|
| "Your hormones are causing your low mood." | Hormones are not measured by this app. Causal claim from unmeasured variables |
| "Hormonal imbalance detected." | Not a defined clinical entity as used in consumer apps; named as an over-claim pattern in period-app critique (*The Conversation*) |
| "You have PMS." / "You may have PMDD." | Diagnosis. ACOG and DSM-5-TR both require clinician assessment plus prospective criteria and exclusion of other explanations (S8, S22). An app cannot exclude other explanations |
| "**{symptom} is linked to** your luteal phase." | "Linked to" reads as causal. State co-occurrence in time, not linkage |
| "You'll feel low tomorrow." | Prediction as fact — the exact mechanism S18 documents as producing self-fulfilling prophecies |
| "Significant pattern detected (p < 0.05)." | Statistical jargon signalling rigor the N cannot support; and comprehension is worse than natural frequencies (S23) |
| "83% of the time you get cramps before your period." | A percentage over n = 6 cycles implies a precision that doesn't exist. Say "5 of your last 6 cycles" |
| "Your fertile window is Oct 12–17." | Point-precision fertility claims are the specific failure S16 documents (8% ovulation-day accuracy; fertile windows varying 6–16 days between apps) |
| "Your body is preparing for…" / "Your luteal phase means you should…" | Anthropomorphic causal narration; leads directly into cycle-syncing prescriptions |
| "Eat more seeds / do low-intensity workouts in your luteal phase." | Cycle syncing and seed cycling are named as non-scientific app content (*The Conversation*) |
| "Your cycle is irregular." | A judgement, not an observation, and it depends on a normal range the app hasn't justified. Say L11 instead |
| "Trend: your mood is getting worse." | Trend claims over <12 cycles are unsupportable and emotionally consequential |
| "We noticed you didn't log — did your symptoms improve?" | Interprets missingness as data. Directly contradicts §4 |

### 8.4 Three structural rules for the insight UI

1. **Every insight card shows its denominator.** No card exists without "based on {n} cycles."
2. **Disconfirmation is displayed at the same visual weight as confirmation.** L6 and L7 are first-class cards, not footnotes.
3. **No insight is ever phrased as a prediction of the future.** Past tense only. This is the direct mitigation for S18's self-fulfilling-prophecy finding.

---

## RECOMMENDED INSIGHT ENGINE FOR THIS APP

Implementable as specified. All computation is local, O(days), no external dependencies beyond an exact binomial CDF (which is a 20-line function).

### E.1 Constants

```python
# ---- Windows. Backward windows are anchored on the NEXT period start.
# Rule: if a day is claimable by both a forward and a backward window,
#       the BACKWARD assignment wins.  (Schmalenberger et al. 2021)
W_PREMENSTRUAL      = ("backward", -7, -1)   # DSM-5 / C-PASS / DRSP luteal
W_PREMENSTRUAL_ACOG = ("backward", -5, -1)   # ACOG 5-day window (secondary)
W_MID_LUTEAL        = ("backward", -11, -8)  # optional
W_PERIOVULATORY     = ("backward", -17, -12) # optional, OFF by default
W_MENSTRUAL         = ("forward",   1,  4)
W_FOLLICULAR_REF    = ("forward",   4, 10)   # C-PASS postmenstrual week;
                                             # exclude days with logged bleeding

PRIMARY_WINDOW   = W_PREMENSTRUAL
REFERENCE_WINDOW = W_FOLLICULAR_REF

# ---- Cycle qualification
MIN_CYCLES_TO_SHOW_ANYTHING   = 3     # Li et al. 2020/2022: >2 cycles
MIN_QUALIFYING_CYCLES_TO_CLAIM = 5    # arithmetic: 5/5 is the first p < 0.05
CYCLE_LEN_MIN, CYCLE_LEN_MAX   = 21, 45
CYCLE_LEN_ANOMALY_DELTA        = 10   # Li et al. 2020: > user median + 10 d
MAX_CONSECUTIVE_UNLOGGED_DAYS  = 10

COVERAGE_MIN_PRIMARY   = 5/7          # >= 5 of 7 premenstrual days logged
COVERAGE_MIN_REFERENCE = 4/7          # >= 4 of 7 reference days logged
COVERAGE_MIN_CYCLE     = 0.50
COVERAGE_BALANCE_MAX   = 0.30         # |cov(W) - cov(R)| <= 0.30

# ---- Symptom eligibility (outcome-INDEPENDENT pre-filter)
MIN_TOTAL_OCCURRENCES = 3
MIN_DISTINCT_CYCLES   = 2

# ---- Effect size floors (analogue of C-PASS's >= 30% percent change)
DEADBAND          = 0.20   # per-cycle |p_W - p_R| below this = "tie"
MIN_RATE_RATIO    = 2.0
MIN_RATE_DIFF     = 0.20

# ---- Multiplicity
FDR_Q = 0.10
def test_budget(n_qualifying_cycles):
    if n_qualifying_cycles >= 12: return 12
    if n_qualifying_cycles >= 8:  return 8
    if n_qualifying_cycles >= 5:  return 3
    return 0

ALPHA_UNCORRECTED = 0.05
MAX_INSIGHTS_SHOWN = 3
```

### E.2 Default symptom panel (ordered — the budget takes the first k)

```python
SYMPTOM_PANEL = [
  # TIER A
  "cramps", "breast_tenderness", "bloating", "headache",
  "fatigue", "cravings", "gi_change", "acne",
  # TIER B (direction discovered, never assumed)
  "irritability", "low_mood", "anxiety", "emotional_sensitivity",
]
# TIER C (sleep, exercise, focus, libido, weight, temp, HR) -> opt-in, excluded
#         from the panel because weekday rhythm dominates (Pierson et al. 2021)
# TIER D (ovulation pain, any "hormone" framing) -> never an insight target
```

### E.3 Core algorithm

```python
def build_insights(cycles, logs, panel=SYMPTOM_PANEL):
    completed = [c for c in cycles if c.next_period_start is not None]
    if len(completed) < MIN_CYCLES_TO_SHOW_ANYTHING:
        return [Card.NOT_ENOUGH_DATA(len(completed))]

    median_len = median(c.length for c in completed)

    qualifying = [c for c in completed if cycle_qualifies(c, logs, median_len)]
    nq = len(qualifying)
    if nq < MIN_QUALIFYING_CYCLES_TO_CLAIM:
        return [Card.DESCRIPTIVE_ONLY(qualifying, logs)]   # counts, no claims

    budget  = test_budget(nq)
    tested  = [s for s in panel if symptom_eligible(s, qualifying, logs)][:budget]
    if not tested:
        return [Card.NO_PATTERN(m=0)]

    results = []
    for s in tested:
        r_unknown = evaluate(s, qualifying, logs, missing="unknown")
        r_absent  = evaluate(s, qualifying, logs, missing="absent")
        # ROBUSTNESS GATE: must survive both missing-data treatments
        if r_unknown.passes_effect_floor and r_absent.passes_effect_floor \
           and r_unknown.direction == r_absent.direction:
            r_unknown.p = max(r_unknown.p, r_absent.p)   # conservative
            results.append(r_unknown)

    # Benjamini-Hochberg over the tests ACTUALLY RUN
    survivors = benjamini_hochberg([r for r in results], q=FDR_Q, m=len(tested))

    if not survivors:
        return [Card.NO_PATTERN(m=len(tested))]

    survivors.sort(key=lambda r: r.p)
    return [render(r, nq) for r in survivors[:MAX_INSIGHTS_SHOWN]]


def cycle_qualifies(c, logs, median_len):
    if not (CYCLE_LEN_MIN <= c.length <= CYCLE_LEN_MAX):            return False
    if c.length > median_len + CYCLE_LEN_ANOMALY_DELTA:             return False
    if max_gap_unlogged(c, logs) > MAX_CONSECUTIVE_UNLOGGED_DAYS:   return False
    if coverage(c, logs) < COVERAGE_MIN_CYCLE:                      return False
    cw = coverage_window(c, logs, PRIMARY_WINDOW)
    cr = coverage_window(c, logs, REFERENCE_WINDOW)
    if cw < COVERAGE_MIN_PRIMARY:                                   return False
    if cr < COVERAGE_MIN_REFERENCE:                                 return False
    if abs(cw - cr) > COVERAGE_BALANCE_MAX:                         return False
    return True


def symptom_eligible(s, cycles, logs):
    occ = total_occurrences(s, cycles, logs)
    cyc = distinct_cycles_with(s, cycles, logs)
    return occ >= MIN_TOTAL_OCCURRENCES and cyc >= MIN_DISTINCT_CYCLES


def evaluate(s, cycles, logs, missing):
    """Paired, direction-agnostic exact sign test. Unit = cycle."""
    classes, a, A, b, B = [], 0, 0, 0, 0
    for c in cycles:
        dW, nW = days_with(s, c, PRIMARY_WINDOW,   logs, missing)
        dR, nR = days_with(s, c, REFERENCE_WINDOW, logs, missing)
        if nW == 0 or nR == 0:
            continue
        a += dW; A += nW; b += dR; B += nR
        d = dW/nW - dR/nR
        classes.append("W" if d >=  DEADBAND else
                       "R" if d <= -DEADBAND else "tie")

    kW = classes.count("W"); kR = classes.count("R")
    n  = kW + kR
    if n == 0:
        return Result(passes_effect_floor=False)

    k, direction = (kW, "premenstrual") if kW >= kR else (kR, "postmenstrual")
    p = binom_sf(k - 1, n, 0.5)        # Pr(X >= k), exact, one-sided

    rate_W, rate_R = a/A, b/B
    hi, lo = (rate_W, rate_R) if direction == "premenstrual" else (rate_R, rate_W)
    rr   = hi / lo if lo > 0 else float("inf")
    diff = hi - lo

    return Result(
        symptom=s, direction=direction, k=k, n=n, p=p,
        a=a, A=A, b=b, B=B, rate_ratio=rr, rate_diff=diff,
        replicated_last_cycle=(classes and classes[-1] == ("W" if direction ==
                               "premenstrual" else "R")),
        passes_effect_floor=(p <= ALPHA_UNCORRECTED
                             and rr   >= MIN_RATE_RATIO
                             and diff >= MIN_RATE_DIFF),
    )


def benjamini_hochberg(results, q, m):
    """m = number of tests RUN, not number that passed the effect floor."""
    ranked = sorted(results, key=lambda r: r.p)
    survivors, kmax = [], 0
    for i, r in enumerate(ranked, start=1):
        if r.p <= (i / m) * q:
            kmax = i
    return ranked[:kmax]
```

### E.4 Display strings (exact)

```python
PRIMARY_PREMENSTRUAL = (
  "{Symptom} showed up more often before your period.\n\n"
  "You logged {symptom} in the 7 days before your period started in "
  "{k} of your last {n} complete cycles, and in {kR} of {n} in the week "
  "after your period ended.\n\n"
  "Based on {nq} cycles with enough days logged.\n"
  "This is a summary of what you recorded — not a diagnosis, and not a cause."
)

PRIMARY_POSTMENSTRUAL = (
  "{Symptom} showed up more often after your period than before it.\n\n"
  "You logged {symptom} in {k} of your last {n} complete cycles in the week "
  "after your period ended, and in {kW} of {n} in the week before it started.\n\n"
  "Based on {nq} cycles with enough days logged.\n"
  "This is a summary of what you recorded — not a diagnosis, and not a cause."
)

DETAIL_EXPANDER = (
  "Days you logged {symptom}:\n"
  "  Week before period:      {a} of {A} days\n"
  "  Week after period ended: {b} of {B} days"
)

DID_NOT_REPLICATE = "This didn't hold in your most recent cycle."

NOT_ENOUGH_DATA = (
  "Not enough yet. We need at least 5 complete cycles with most days logged "
  "before we can tell a repeating pattern from coincidence. You have {n}."
)

DESCRIPTIVE_ONLY = (
  "You logged {symptom} in the week before your period in {k} of your last "
  "{n} cycles. That's too few cycles to tell whether this repeats."
)

NO_PATTERN = (
  "We looked at {m} things you track and didn't find a repeating pattern "
  "tied to your cycle. That's a normal result."
)

LOGGING_CAVEAT = "How often you log affects what we can see here."
```

### E.5 Non-negotiable invariants (encode as tests)

```
INV-1  No card without a stated denominator ("based on {n} cycles").
INV-2  No card in the future tense. No prediction of how the user will feel.
INV-3  No card containing: "hormone", "imbalance", "PMS", "PMDD", "diagnos*",
       "causes", "because of your", "linked to", "significant", "p =".
       Enforce with a lint test over the string table.
INV-4  Backward-anchored windows never computed on the in-progress cycle.
INV-5  Every claim survives BOTH missing-data treatments (E.3 robustness gate).
INV-6  m in the BH correction equals the number of tests RUN, and the test
       budget is fixed by cycle count BEFORE any test is evaluated.
INV-7  Direction is discovered, never assumed. PRIMARY_POSTMENSTRUAL must be
       reachable (13-16% of users show the inverted pattern; Kiesner 2022).
INV-8  NO_PATTERN is a real, shippable card and must be reachable.
INV-9  Pain: never call a change of less than one full intensity band an
       improvement (NRS smallest detectable change = 2.76 points).
INV-10 Bleeding: never assert "heavy" as a fact; only "matches the questions
       clinicians ask", with an export.
```

---

## WHAT I COULD NOT VERIFY

Listed honestly. None of these are load-bearing for the recommendations above, but each is a real gap.

1. **Li et al. 2020 symptom odds ratios.** I retrieved the paper's full text but the specific odds ratios I extracted (tender breasts ≈ 1.715, headaches ≈ 1.663, spotting ≈ 1.729, heavy periods ≈ 1.734) came back with ambiguous directionality from the retrieval layer, and I could not confidently reconstruct which contrast each refers to (high- vs low-variability users; "consistently tracks" vs "rarely tracks" extreme). **I have therefore not used these numbers to support any recommendation.** The methodological quotes from the same paper (exclusion rules, the explicit statement that phase/day is ignored, median cycle length 29 d, CLD > 9 d threshold separating 7.68% of users) were retrieved as direct quotes and are reliable.

2. **Eisenlohr-Moul et al. 2017 C-PASS primary paper.** psychiatryonline.org returned 403, and the C-PASS worksheet PDF (med.unc.edu) was not text-extractable. All C-PASS parameters here come from the *Am J Psychiatry* editorial (S9, full text) and from search snippets. **There is an unresolved discrepancy:** S9 describes the premenstrual window as "the premenstrual week including day 1 of menstruation," whereas snippet-level sources describe it as days −7 to −1. I have used −7 to −1 (consistent with S3 and S10) and flag the discrepancy.

3. **PACTS / `menstrualcycleR` exact specification.** I could not retrieve the paper body, the README, or the vignette. The existence, citation (Nagpal et al., *Psychoneuroendocrinology* 181:107584, 2025) and general claim (continuous cycle time anchored to both menses and ovulation; improves alignment especially in the variable follicular phase) are search-snippet level. **The exact scaling formula and variable ranges are unverified.** For an app with no ovulation biomarker this is moot, but if BBT/LH input is ever added, this is the first thing to look up properly.

4. **Symul et al. 2021 hidden semi-Markov paper.** medRxiv returned 403 on every URL form. I have only search-level detail (98% accuracy on simulated data with no missing data, 90% with realistic missingness; explicit modelling of "variable- and state-dependent missingness"). **No quantitative missingness statistics from this paper are used above.**

5. **Ainsworth et al. full text.** Retrieved only the abstract and metadata via the bioRxiv/medRxiv API; medRxiv HTML and PDF were both 403. So I have the headline findings (437,577 users / 896,051 cycles; somatic in 88.3% of cycles; negative physical and mood peaking in late luteal and bleeding; positive mood and discharge in the fertile window; r = 0.62 correlations) but **not** the per-symptom, per-cycle-day breakdown, and **not** their exact cycle-day alignment method. The symptom ranking in §5.3 leans on this paper only at the category level.

6. **Pierson et al. 2021 per-dimension effect sizes.** nature.com is behind an IdP redirect. I have the abstract (241 M observations, 3.3 M users, 109 countries, 15 dimensions) and the Stanford institutional summary, but **no numeric amplitudes** for individual dimensions and **no numeric comparison** of menstrual vs weekly amplitude. The Tier C demotion of sleep/exercise/productivity rests on the qualitative statements in the abstract and press summary, not on retrieved effect sizes.

7. **ACOG primary sources.** acog.org returned HTTP 402 on both the HMB FAQ and Committee Opinion 785. The ACOG screening tool in §7.2 is reproduced from *AFP* 2020 (S14), and the ACOG PMS criteria in §2.1 from *AFP* 2016 (S8) and PMC8187976 (S22). I did not read the ACOG originals.

8. **Origin of the "30% change rule."** I verified the rule is used in C-PASS (S9) and appears in PMDD research protocols, and that Steiner & MacDougall authored the PSST (2003). I could **not** verify that the 30% threshold originates with Steiner, nor find a primary source attributing it to "Steiner criteria." Treat "Steiner criteria" as an unverified attribution. A snippet-level source also mentions a competing "≥50% follicular-to-luteal increase" criterion — I could not adjudicate between these.

9. **Warner et al. 2004 and Bull et al. 2019** are snippet-only (AJOG and nature.com both inaccessible). The Warner figures (34% of self-reported-heavy women actually ≥80 mL; predictors low ferritin / clots >1 inch / changing protection >hourly; model sens 60%, spec 86%) and the Bull phase-length figures (follicular 16.9 d [10–30], luteal 12.4 d [7–17]) should be re-confirmed against the originals before being quoted in user-facing copy. The core claim they support — follicular varies more than luteal — is independently confirmed by S2 (full text) and S21 (full text).

10. **Within-cycle logging drop-off.** I could not find a study quantifying how logging adherence varies *by cycle day* within a cycle (e.g. whether users log less in the mid-follicular phase). Symul et al. (S2) explicitly did not report differential logging between phases. This is the biggest genuine evidence gap for §4, and it is exactly the bias the robustness gate in E.3 is designed to defend against without needing that literature.

11. **Haines et al. 2024 (S19)** — I retrieved only the abstract; it appears to be a conference abstract in an *Innovation in Aging* supplement rather than a full methods paper. The 26.8% cumulative Type I error figure is quoted from that abstract. Its concrete recommendations (if any) are unread.

12. **NRS clinimetric statistics and the endometriosis MCID** (S28 and PMID 33066973) are snippet-only. The AUC 0.902, cut-off 3, ICC 0.90 and SDC 2.76 figures should be confirmed against the *Gynecological Endocrinology* original before appearing in any clinician-facing export.

13. **DSM-5-TR verbatim criteria.** I did not access the DSM-5-TR itself (proprietary). The criteria in §2.1 are as reported by *AFP* 2016 (S8) and the 2023 *Frontiers in Global Women's Health* review. The full canonical 11-item PMDD symptom list was not retrieved in verbatim form.
