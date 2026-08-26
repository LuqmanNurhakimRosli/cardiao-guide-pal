# AF-CArE Amendment Remediation Plan

## Goal and source of truth

Implement the 26 August 2026 amendment across the existing patient-to-alert-to-action workflow while preserving the current route structure and EMR adapter architecture. The formal specification tables and acceptance criteria are authoritative. Conflicting annotations will be recorded for clinical governance rather than silently applied.

## Confirmed gaps in the current system

- The patient model lacks MRN, DOB, ethnicity, nationality, encounter metadata, clinician plans, dated observations, admissions, and research-window fields.
- The engine/UI still use CHA₂DS₂-VASc, including female-sex points and sex-specific thresholds; the amendment requires CHA₂DS₂-VA with one threshold of `>=2`.
- BP, weight, creatinine, HbA1c, and INR data are not dated. PINRR does not enforce the prior-12-month window or minimum two dated readings.
- Anticoagulant findings have no formal precedence resolution. Avoid and dose-review findings can appear together.
- Dabigatran currently uses an incorrect age `>=60` reminder; Edoxaban/Apixaban severe-renal rules and current-dose guards are incomplete.
- The review page can silently discard multiple selected actions because it navigates after the first action.
- Override reasons omit four required choices and are not server-validated.
- Action snapshots are inconsistent; defer has no snapshot, request IDs are not propagated, clinician ID is hardcoded in the UI, and the audit store is volatile memory.

## Phase 0 — Clinical rule baseline and traceability

- Convert the amendment into a versioned rule manifest covering FR-01–FR-22 and AC-01–AC-16.
- Centralize approved thresholds, medication rules, alert wording, precedence, and override reason codes so they can be reviewed without searching component code.
- Record explicit decisions: CHA₂DS₂-VA `>=2`; PINRR `<56%`; Dabigatran age bands `>=80` and `75–80`; precedence `Contraindicated → Not recommended → Dose adjustment → Caution/monitoring → Acceptable`.
- Update `PROGRESS.txt` into a phase checklist with requirement IDs, implementation status, test status, and clinical-sign-off status.

**Exit gate:** every formal rule has a stable identifier, expected input set, output text, priority, and acceptance test before changing clinical behavior.

## Phase 1 — Encounter-aware and dated clinical data model

- Extend the canonical model and Zod schemas with:
  - demographics: MRN, DOB, calculated age-at-encounter, ethnicity, nationality;
  - encounter: visit ID, clinic date, clinician ID, encounter type, appointment date, record-opened flag;
  - dated BP readings, dated weight, dated creatinine/unit, dated HbA1c, dated INR results;
  - medication dose, frequency, indication, start/stop/order/change dates;
  - doctor plan, medication plan, monitoring plan, next appointment;
  - hospital admission/discharge data.
- Calculate age from DOB and encounter date; do not trust a stale standalone age when both dates exist.
- Keep adapter mapping isolated so mock data and future UNIMED payloads map into the same canonical shape.
- Expand mock fixtures to include complete, missing, stale, and boundary-date cases.
- Return field-level missing-data provenance rather than treating an absent criterion as false.

**Exit gate:** calculations receive encounter-scoped, dated inputs; missing required values block only the affected calculation and generate a precise reminder.

## Phase 2 — Safety-critical calculation corrections

- Replace CHA₂DS₂-VASc with CHA₂DS₂-VA end to end: engine, API, hybrid calculator, labels, alert text, audit snapshots, summary, and patient risk counts. Remove sex-category scoring and trigger at `>=2` for all patients.
- Preserve automatic calculation only when all required structured fields are mapped; otherwise require explicit manual completion and record `source = manual`.
- Integrate HAS-BLED into the engine result, not only the UI. If score `>=3`, generate the required alert stating that anticoagulation is not contraindicated solely by the score.
- BP: use exactly the two most recent dated readings, never average them, show both dates, and distinguish one-reading from no-reading reminders.
- HbA1c: display value/date, trigger at `>7%`, and issue the formal missing-data reminder when absent.
- ClCr: require age, sex, weight, creatinine, unit, and required dates; convert µmol/L to mg/dL using `/88.4`; store values and source dates used.
- PINRR: use dated INR results within the 12 months before the index date, require at least two readings, calculate in-range proportion for 2.0–3.0, use `<56%`, and expose count/date range.

**Exit gate:** boundary and missing-data tests pass for every calculation, including ages 64/65/74/75, scores 1/2, HbA1c 7.0/7.1, and PINRR 55/56.

## Phase 3 — Anticoagulant rule matrix and precedence

- Split each drug into its own pure rule module and require complete trigger data before recommending a dose action.
- Implement the formal matrix:
  - Warfarin: latest INR and PINRR review;
  - Edoxaban: avoid at ClCr `<15`; dose review at 15–50 or weight `<=60`, only when current dose is 60 mg OD;
  - Rivaroxaban: avoid at ClCr `<15`; dose review at 15–49, only when current dose is 20 mg OD;
  - Dabigatran: avoid at ClCr `<30`; review 150 mg BD at ClCr 30–50, age `>=80`, age 75–80, or verapamil, with wording matching the applicable strength of recommendation;
  - Apixaban: avoid at ClCr `<15`; review 5 mg BD at ClCr 15–29; retain the 2-of-3 counter for age/weight/creatinine.
- Add a resolver that emits only the highest-priority medication finding for each drug. An avoid/not-recommended finding suppresses all reduce/review/caution findings for that drug.
- Aggregate multiple same-level reasons into one alert with complete rationale, rather than duplicate cards.
- Remove hardcoded alert-to-dose mappings from the Accept page; carry structured recommendation/order metadata from the rule result.

**Exit gate:** a clinical test matrix demonstrates exactly one highest-priority drug alert per medication and no recommendation when required inputs or current dose are unknown.

## Phase 4 — Combined Clinical Alert Panel and action workflow

- Upgrade the existing panel to the required content while retaining the current three-column page:
  - patient/encounter summary and all AF source domains;
  - CHA₂DS₂-VA source/date and HAS-BLED/date;
  - BP, HbA1c, ClCr, INR/PINRR, current anticoagulant/dose/frequency;
  - grouped alerts, monitoring prompts, and missing-data reminders;
  - doctor plan, monitoring plan, and next appointment fields;
  - Accept, Override, and Defer controls for actionable alerts.
- Keep missing-data reminders visually separate and non-actionable where an order/action is not clinically appropriate.
- Replace the current lossy multi-select behavior with a queued workflow that preserves every selection, completes required details one alert at a time, and shows progress until all chosen actions are saved.
- Accept opens medication or monitoring review as appropriate. Defer requires a follow-up plan or date.
- Expand override reasons to the complete controlled list: dose already appropriate, clinical judgement, contraindication/intolerance, renal function issue, bleeding risk, adherence issue, monitoring/titration, patient preference, temporary factor, and other. Validate codes server-side and require text for Other.

**Exit gate:** all selected alert actions survive navigation, required documentation is enforced, and the final summary reflects every saved action.

## Phase 5 — Research timeline: pre-index, index, and post-index

- Create `index_alert_date` from the first alert/nudge for the encounter and prevent accidental re-anchoring.
- Add three explicit views/sections:
  - pre-alert: prior 12 months through the day before index;
  - index encounter: the index date and its inputs/findings/actions/plans;
  - post-alert: next day through three months after index.
- Classify medication, labs, BP, ClCr calculations, admissions, appointments, plans, and CDSS events into the correct window.
- Show completeness/status for each window and support an export-ready normalized representation.

**Exit gate:** boundary-date tests place events correctly at index−12 months, index−1 day, index day, index+1 day, and index+3 months.

## Phase 6 — Durable audit, identity, and research export

- Enable Lovable Cloud for durable audit persistence and authenticated clinician identity; remove in-memory arrays and hardcoded `DR001`.
- Store immutable structured records for activation, eligibility/AF evidence, source values and dates, score calculations/source/date, triggered rules and displayed panel, clinician actions, plans, medication workflow events, and follow-up outcomes.
- Link every action to patient ID, MRN, visit ID, clinician ID, request ID, engine/rule version, index alert date, and the exact alert/input snapshot.
- Use one shared action logger so Accept, Override, and Defer capture the same complete clinical snapshot.
- Add paginated/filterable audit views and CSV export for the research dataset, with role-based authorization and no client-side role checks.
- Define retention, access, and export controls before production use.

**Exit gate:** restart-safe records can reconstruct why an alert appeared, what was shown, who acted, what changed, and which research window contains the event.

## Phase 7 — UNIMED integration readiness and release validation

- Update the UNIMED mapping contract for every new field, including timestamps, units, code systems, medication status, encounter context, and clinician identity.
- Add adapter contract tests using sanitized representative payloads; document unknown/unmapped values and fail safely.
- Add unit tests for all pure rules, integration tests for `/api/cdss/analyze`, workflow tests for Accept/Override/Defer, and responsive browser checks for dashboard, review, timeline, summary, and audit.
- Build a requirement traceability report mapping FR/AC IDs to tests and evidence screenshots.
- Require clinical governance sign-off on the rule manifest and test matrix before enabling production recommendations.

**Exit gate:** AC-01–AC-16 and FR-01–FR-22 have passing evidence or an explicitly documented external dependency.

## Technical implementation principles

- Keep React components API-driven through `runCDSS → /api/cdss/analyze`; no React-side clinical engine calls.
- Keep the EMR adapter boundary; mock, UNIMED, and FHIR implementations return the same canonical model.
- Move runtime helpers out of the server-function declaration module so server functions remain thin wrappers.
- Use structured identifiers/codes for rules, reasons, actions, and data provenance; display labels remain configurable.
- Treat every absent or stale clinical input as unknown, never as a negative criterion.
- Keep old names only at an explicit compatibility boundary during migration; the internal canonical score becomes `cha2ds2va`.

## Recommended delivery sequence

1. Phase 0 and Phase 1: specification lock and data foundations.
2. Phase 2 and Phase 3: safety-critical calculations and medication precedence.
3. Phase 4: clinician-facing panel and reliable action workflow.
4. Phase 5 and Phase 6: research windows, durable audit, identity, and export.
5. Phase 7: UNIMED contract validation and release evidence.

Each phase should be reviewed in the preview and signed off before the next clinical behavior phase is enabled.
