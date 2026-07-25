/**
 * Health-awareness copy catalogue (SPEC.md R9, §3.3 of
 * docs/research/03-additional-data-and-safety.md). Every message in the §5 rule table is
 * transcribed here **verbatim**, bundled with its source name, source URL and the exact
 * quoted threshold, so the UI's "Why am I seeing this?" panel can show all three plus a
 * "don't show me this again" control (dismissible).
 *
 * Copy rules followed throughout (03-additional-data-and-safety.md §5, "Copy rules for
 * implementers"):
 *   - the user's own numbers, then an attributed external statement, then a soft handoff —
 *     never the app's own verdict;
 *   - no "abnormal", "disorder", "condition", "diagnosis", "screening", "detect", "risk of
 *     {disease}" in any user-facing string (enforced by lib/copy/lint.test.ts);
 *   - URG-01 renders as an ATTRIBUTED QUOTATION of ACOG's sentence, not the app's own
 *     assessment (03-additional-data-and-safety.md §3.3).
 *
 * Message templates may contain the literal tokens {n}, {k}, {a}, {b}, {reasons} — the
 * engine (lib/engine/health.ts) fills these in with the user's own recorded numbers.
 * Keeping the *raw* template (tokens un-filled) as the exported string, rather than a
 * function, is a deliberate choice: it lets lib/copy/lint.test.ts scan every message
 * directly for banned words without having to guess a function's call signature.
 */

// ============================================================================
// Rule identifiers
// ============================================================================

/** All 24 rule IDs from 03-additional-data-and-safety.md §5, verbatim. */
export type HealthRuleId =
  | "CYC-01"
  | "CYC-01i"
  | "CYC-02"
  | "CYC-02i"
  | "CYC-03"
  | "CYC-04"
  | "DUR-01i"
  | "DUR-02"
  | "HMB-01"
  | "HMB-02"
  | "HMB-03"
  | "HMB-04"
  | "HMB-05"
  | "URG-01"
  | "URG-02"
  | "DYS-01"
  | "DYS-02"
  | "IMB-01"
  | "PCB-01"
  | "AMEN-01"
  | "AMEN-02"
  | "PMB-01"
  | "PERI-01"
  | "CTX-01";

export type HealthSeverity = "informational" | "discuss_with_clinician" | "seek_urgent_care";

export interface HealthCopyEntry {
  /** The severity this rule normally carries. URG-02's *actual* severity is
   * locale-gated (seek_urgent_care in en-GB, discuss_with_clinician otherwise) — the
   * engine, not this catalogue, makes that call; this is the en-US default. */
  severity: HealthSeverity;
  /** Verbatim from the §5 table's "User-facing message text" column. May contain
   * {n}/{k}/{a}/{b}/{reasons} tokens the engine fills in. */
  messageTemplate: string;
  sourceName: string;
  sourceUrl: string;
  /** The exact quoted threshold from the guideline, for the "Why am I seeing this?"
   * panel (§5: "shows the source, the exact threshold"). */
  sourceThreshold: string;
  /** false only for URG-01 and PMB-01 (SPEC.md §5 agent D brief, deliberate deviation
   * (b)) — both ignore the snooze guard G8 and must not be dismissible. URG-02 is also
   * not dismissible: G8 "does not apply" to it either (§5 table), so a "don't show me
   * this again" control that silently did nothing would be misleading. [choice] */
  dismissible: boolean;
}

// ============================================================================
// HMB-03's multi-choice phrase fragment ("{needing two products at once / changing
// overnight / leaking through}" in the table) — kept as separate literal strings so the
// lint can scan each fragment directly instead of a pre-joined, engine-built sentence.
// ============================================================================

export const HMB_03_REASON_PHRASES = {
  doubleProtection: "needing two products at once",
  nightChange: "changing overnight",
  leakThrough: "leaking through",
} as const;

// ============================================================================
// The 24-row rule table, transcribed verbatim from 03-additional-data-and-safety.md §5.
// ============================================================================

export const HEALTH_COPY: Record<HealthRuleId, HealthCopyEntry> = {
  "CYC-01": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "Your recent cycles have been averaging {n} days — shorter than the 24–38 day range that the Office on Women's Health describes as typical. Cycle length is something clinicians like to know about; it may be worth mentioning at your next visit.",
    sourceName: "Office on Women's Health — Period problems",
    sourceUrl: "https://womenshealth.gov/menstrual-cycle/period-problems",
    sourceThreshold:
      'OWH: "less than 24 days or more than 38 days" is shorter/longer than average; ACOG describes cycles "shorter than 21 days" as outside its typical 21–35 day range.',
    dismissible: true,
  },
  "CYC-01i": {
    severity: "informational",
    messageTemplate:
      "Your recent cycles have averaged {n} days. Guidelines differ a little here — ACOG describes 21–35 days as typical, while FIGO and the Office on Women's Health use 24–38. Worth noting if it's a change for you.",
    sourceName: "ACOG AUB FAQ; FIGO System 1; OWH",
    sourceUrl: "https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding",
    sourceThreshold:
      'ACOG: "The normal length of the menstrual cycle is typically between 21 and 35 days." FIGO/OWH: 24–38 days.',
    dismissible: true,
  },
  "CYC-02": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "Your recent cycles have been averaging {n} days — longer than the 24–38 day range the Office on Women's Health describes as typical. It may be worth mentioning at your next appointment.",
    sourceName: "Office on Women's Health — Period problems",
    sourceUrl: "https://womenshealth.gov/menstrual-cycle/period-problems",
    sourceThreshold:
      'OWH: "less than 24 days or more than 38 days"; ACOG: cycles "longer than 35 days".',
    dismissible: true,
  },
  "CYC-02i": {
    severity: "informational",
    messageTemplate:
      "Your recent cycles have averaged {n} days. Guidelines differ a little here — ACOG describes 21–35 days as typical, while FIGO and the Office on Women's Health use 24–38. Worth noting if it's a change for you.",
    sourceName: "ACOG AUB FAQ; FIGO System 1; OWH",
    sourceUrl: "https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding",
    sourceThreshold:
      'ACOG: "The normal length of the menstrual cycle is typically between 21 and 35 days." FIGO/OWH: 24–38 days.',
    dismissible: true,
  },
  "CYC-03": {
    severity: "informational",
    messageTemplate:
      "Across your last 6 logged cycles the shortest was {a} days and the longest {b}. FIGO describes a typical spread as up to {k} days at your age. Cycle variation is common — worth a mention if it's new.",
    sourceName: "FIGO System 1 (Jain et al. 2023)",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10952771/",
    sourceThreshold:
      "FIGO regularity bands: shortest-to-longest cycle variation of up to 9 days at ages 18–25 or 42–45, up to 7 days at ages 26–41.",
    dismissible: true,
  },
  "CYC-04": {
    severity: "informational",
    messageTemplate:
      "Cycles often take a few years to settle into a pattern. ACOG describes 21–45 days as the usual range in the first few years after periods start; yours have averaged {n}. If that's the case for you, it's a good thing to bring up at a check-up.",
    sourceName: "ACOG Committee Opinion No. 651",
    sourceUrl:
      "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign",
    sourceThreshold: 'ACOG CO 651 Box 1: "Menstrual cycle interval: Typically 21–45 days."',
    dismissible: true,
  },
  "DUR-01i": {
    severity: "informational",
    messageTemplate:
      "This period lasted {n} days. ACOG and the NHS describe periods lasting more than 7 days as worth mentioning to a clinician.",
    sourceName: "ACOG — Heavy menstrual bleeding FAQ; NHS — Heavy periods",
    sourceUrl: "https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding",
    sourceThreshold:
      'ACOG: "Bleeding that lasts more than 7 days." NHS: "periods lasting more than 7 days."',
    dismissible: true,
  },
  "DUR-02": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "Your last {k} periods lasted more than 8 days. FIGO describes menstrual bleeding of more than 8 days as prolonged, and the Office on Women's Health suggests talking to a clinician about it.",
    sourceName: "FIGO System 1; Office on Women's Health",
    sourceUrl: "https://womenshealth.gov/menstrual-cycle/period-problems",
    sourceThreshold:
      'FIGO: menstrual bleeding of "up to eight consecutive days" is normal. OWH: "Your period lasts longer than eight days."',
    dismissible: true,
  },
  "HMB-01": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "You logged changing protection every 1–2 hours for {n} hours. The Office on Women's Health and the NHS both describe that as heavy menstrual bleeding, and suggest talking to a clinician — heavy periods can lead to iron-deficiency anemia.",
    sourceName: "Office on Women's Health — Period problems; NHS — Heavy periods",
    sourceUrl: "https://womenshealth.gov/menstrual-cycle/period-problems",
    sourceThreshold:
      'OWH: "You bleed through one or more pads or tampons every one to two hours." NHS: "need to change your pad or tampon every 1 to 2 hours."',
    dismissible: true,
  },
  "HMB-02": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "You've logged clots about the size of a quarter (2.5 cm) or larger in {k} of your recent periods. ACOG lists that as a sign of heavy menstrual bleeding worth discussing with an ob-gyn.",
    sourceName: "ACOG — Heavy menstrual bleeding FAQ; NHS — Heavy periods",
    sourceUrl: "https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding",
    sourceThreshold:
      'ACOG: "Menstrual flow with blood clots that are as big as a quarter or larger." NHS: clots "larger than about 2.5cm (the size of a 10p coin)."',
    dismissible: true,
  },
  "HMB-03": {
    severity: "informational",
    messageTemplate:
      "You've logged {reasons} in {k} recent periods. ACOG and the NHS both list these among the signs of heavy periods.",
    sourceName: "ACOG — Heavy menstrual bleeding FAQ; NHS — Heavy periods",
    sourceUrl: "https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding",
    sourceThreshold:
      'ACOG: "Needing to wear more than one pad at a time to control menstrual flow"; "Needing to change pads or tampons during the night." NHS: "need to use 2 types of period product together"; "bleed through to your clothes or bedding."',
    dismissible: true,
  },
  "HMB-04": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "You've logged heavy bleeding for several cycles along with feeling tired or short of breath. ACOG notes that blood loss from heavy periods can lead to iron-deficiency anemia — this is worth raising with a clinician.",
    sourceName: "ACOG — Heavy menstrual bleeding FAQ; NHS — Heavy periods",
    sourceUrl: "https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding",
    sourceThreshold:
      'ACOG: "Blood loss from heavy periods also can lead to a condition called iron-deficiency anemia. Severe anemia can cause shortness of breath." NHS: "feel tired or short of breath a lot."',
    dismissible: true,
  },
  "HMB-05": {
    severity: "informational",
    messageTemplate:
      "You've logged heavy periods since your periods began. ACOG notes that's a pattern worth mentioning to a clinician.",
    sourceName: "ACOG AUB FAQ",
    sourceUrl: "https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding",
    // Attributed quotation naming its source (ACOG) — allowlisted in lib/copy/lint.test.ts
    // for the word "disorder", which appears only inside this direct quotation.
    sourceThreshold:
      'ACOG: "You may have a bleeding disorder if you have had heavy periods since you first started menstruating."',
    dismissible: true,
  },
  "URG-01": {
    severity: "seek_urgent_care",
    messageTemplate:
      "ACOG advises: ‘If you are changing pads or tampons every hour for more than 2 hours in a row, and you also have chest pain, have shortness of breath, and are lightheaded or dizzy, seek emergency medical care right away.’ Based on what you've just logged, please consider seeking emergency care now. Read ACOG's guidance for the full context.",
    sourceName: "ACOG AUB FAQ",
    sourceUrl: "https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding",
    sourceThreshold:
      'ACOG, verbatim: "If you are changing pads or tampons every hour for more than 2 hours in a row, and you also have chest pain, have shortness of breath, and are lightheaded or dizzy, seek emergency medical care right away." This app fires on the bleeding criterion plus any ONE of those symptoms rather than requiring all three at once — a documented, deliberate deviation toward safety, since ACOG’s literal wording would make the rule almost never fire.',
    dismissible: false,
  },
  "URG-02": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "The NHS advises asking for an urgent GP appointment or contacting NHS 111 if pelvic or period pain is severe or worse than usual and painkillers have not helped.",
    sourceName: "NHS — Period pain",
    sourceUrl: "https://www.nhs.uk/conditions/period-pain/",
    sourceThreshold:
      'NHS, Urgent advice box: "Ask for an urgent GP appointment or get help from NHS 111 if: your pelvic pain or period pain is severe or worse than usual, and painkillers have not helped."',
    dismissible: false,
  },
  "DYS-01": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "You've logged period pain that stopped you doing normal activities in {k} recent cycles. Both ACOG and the Office on Women's Health suggest talking to a clinician when pain interferes with daily life or when over-the-counter pain relief isn't enough.",
    sourceName: "ACOG — Dysmenorrhea FAQ; Office on Women's Health",
    sourceUrl: "https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods",
    sourceThreshold:
      'ACOG: pain "so severe that it keeps them from doing their normal activities for several days a month." OWH: "if the pain interferes with daily activities like work or school."',
    dismissible: true,
  },
  "DYS-02": {
    severity: "informational",
    messageTemplate:
      "You've been logging pelvic pain at times outside your period. The Office on Women's Health lists that as something to mention to a clinician.",
    sourceName: "Office on Women's Health",
    sourceUrl: "https://womenshealth.gov/menstrual-cycle/period-problems",
    sourceThreshold:
      'OWH: "Your pain happens at times other than just before your period or during your period."',
    dismissible: true,
  },
  "IMB-01": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "You've logged bleeding between periods {n} times. FIGO and ACOG both describe bleeding between otherwise regular periods as worth having checked.",
    sourceName: "ACOG AUB FAQ; Office on Women's Health",
    sourceUrl: "https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding",
    sourceThreshold:
      'ACOG: "Bleeding or spotting between periods." OWH: "Spotting or bleeding anytime in the menstrual cycle other than during your period."',
    dismissible: true,
  },
  "PCB-01": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "You've logged bleeding after sex more than once. The Office on Women's Health and the NHS both suggest getting that checked.",
    sourceName: "Office on Women's Health; NHS",
    sourceUrl: "https://womenshealth.gov/menstrual-cycle/period-problems",
    sourceThreshold:
      'OWH: "Bleeding after sex, more often than once." NHS: "you bleed between periods or after sex."',
    dismissible: true,
  },
  "AMEN-01": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "It's been {n} days since your last logged period. ACOG and the Office on Women's Health both suggest checking in with a clinician after about three months without a period, when pregnancy and breastfeeding aren't the reason.",
    sourceName: "ACOG — Amenorrhea FAQ; Office on Women's Health",
    sourceUrl: "https://www.acog.org/womens-health/faqs/amenorrhea-absence-of-periods",
    sourceThreshold:
      'ACOG: "does not get her period for 3 months or more." ACOG CO 651: "more than 3 months or 90 days (the 95th percentile for cycle length)." OWH: "three months in a row."',
    dismissible: true,
  },
  "AMEN-02": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "ACOG suggests an evaluation for anyone who hasn't had a first period by age 15, or within 3 years of breast development starting.",
    sourceName: "ACOG Committee Opinion No. 651",
    sourceUrl:
      "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign",
    sourceThreshold:
      'ACOG CO 651: evaluation for primary amenorrhea "should be considered for any adolescent who has not reached menarche by age 15 years or has not done so within 3 years of thelarche."',
    dismissible: true,
  },
  "PMB-01": {
    severity: "discuss_with_clinician",
    messageTemplate:
      "You've logged bleeding after 12 months without a period. The NHS advises that any bleeding after this point should be checked by a GP — even if it happened only once, is only spotting, or comes with no other symptoms. ACOG's 2026 guidance also recommends prompt evaluation.",
    sourceName: "NHS — Postmenopausal bleeding; ACOG (April 2026 guidance update)",
    sourceUrl: "https://www.nhs.uk/conditions/post-menopausal-bleeding/",
    sourceThreshold:
      'NHS: see a GP "even if: it’s only happened once; there’s only a small amount of blood, spotting, or pink or brown discharge; you do not have any other symptoms." ACOG (Apr 2026): bleeding "presumed to be from the uterus 12 or more months after the final menstrual period" warrants prompt evaluation.',
    dismissible: false,
  },
  "PERI-01": {
    severity: "informational",
    messageTemplate:
      "Your cycles have been more variable lately. ACOG notes that around perimenopause the number of days between periods often changes, and skipped periods are common. ACOG still suggests talking with an ob-gyn about any bleeding that seems unusual for you.",
    sourceName: "ACOG AUB FAQ; STRAW+10",
    sourceUrl: "https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding",
    sourceThreshold:
      'ACOG: "it is common to skip periods or for bleeding to get lighter or heavier" around perimenopause. STRAW+10: a persistent 7-day-or-more difference in the length of consecutive cycles, or a gap of 60 days or more without a period, mark the menopausal transition.',
    dismissible: true,
  },
  "CTX-01": {
    severity: "informational",
    messageTemplate:
      "Bleeding patterns often change in the first months on a new method — ACOG notes hormonal methods can cause breakthrough bleeding, and that a copper IUD can make periods heavier, especially in the first year. Keep logging; if it doesn't settle or it's bothering you, mention it at your next appointment.",
    sourceName: "ACOG AUB FAQ",
    sourceUrl: "https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding",
    sourceThreshold:
      'ACOG: "Hormonal birth control methods can cause changes in bleeding, including breakthrough bleeding." "The copper intrauterine device (IUD) can cause heavier menstrual bleeding, especially during the first year of use."',
    dismissible: true,
  },
};
