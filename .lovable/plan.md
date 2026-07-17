
## Goal

Upgrade the existing prototype to match the latest AF-CDSS specification. Preserve current UI/navigation/pages. All work is additive on top of the existing API-driven architecture (`/api/cdss/analyze` → `runCDSS` → `usePatientState`).

## What already exists (no rebuild)

- Patients list page, Patient Dashboard, Alerts, Audit, Summary
- Hybrid CHA₂DS₂-VASc and HAS-BLED calculators with clinician overrides
- API layer: `src/routes/api/cdss.analyze.ts`, `src/api/cdssApi.ts`, `src/services/cdssService.ts`
- Persistence in localStorage (`cdss:inputs:<id>`, `cdss:response:<id>`)
- Accept / Override / Defer flows and audit log

## What changes

### 1. Backend engine (`src/cdss/engine.ts` + `/api/cdss/analyze`)

- **Clinic gating**: allowlist = `["Cardiology Clinic", "Family Medicine Clinic"]`. If patient's `clinic_location` not in list → return `{ executed: false, reason: "Clinic not eligible" }`, no scores, no alerts.
- **Multi-source AF detection** (`src/cdss/afDetection.ts`): scan ICD-10, ICD-11, ECG interpretations, active anticoagulant meds (with AF indication), and PMH free text. Return `{ afDetected, evidence: string[] }`.
- **AF confirmation gate**: engine only runs full rules when `clinician_inputs.afConfirmed === true`. If evidence exists but not confirmed → return evidence + `reason: "Awaiting AF confirmation"`. If explicitly rejected → `reason: "AF rejected by clinician"`.
- **PINRR calculator** (`src/cdss/pinrr.ts`): compute % of INR readings in 2.0–3.0 range from `labs.inr_history`. Alert if `<55%` and patient is on warfarin.
- **Missing-data reminders**: dedicated pass emitting reminders (not alerts) for HbA1c, INR (warfarin only), creatinine, weight.
- **DOAC rule modules** (`src/cdss/drugRules/{apixaban,edoxaban,rivaroxaban,dabigatran}.ts`): explicit dose-reduction / contraindication logic per spec (Apixaban 2-of-3, Edoxaban ≤60 kg, Rivaroxaban ClCr 15–49 caution / <15 avoid, Dabigatran age ≥60 or verapamil, avoid <30 ClCr).
- **BP rule**: use two latest readings, alert only when both >140/90 (no averaging).
- **HbA1c rule**: latest value > 7%.

### 2. API response additions (`src/routes/api/cdss.analyze.ts`)

Extend `AnalyzeResponse`:
```ts
afEvidence: string[]
afConfirmed: boolean | null   // null = awaiting
clinicEligible: boolean
```

### 3. Types & service layer

- `CdssAlert` gains new categories: `"pinrr"`, `"drug-dose"`.
- `ClinicianInputs` gains `afConfirmed?: boolean | null`.
- `runCDSS` / `CdssRunResult` pass through the new fields.

### 4. UI (minimal, additive)

- **AF Evidence card** on dashboard: lists evidence sources when found.
- **AF Confirmation modal**: shown on dashboard when evidence exists and `afConfirmed == null`. Buttons: Confirm AF / Reject AF. Selection persisted via `setField('afConfirmed', …)` and sent to the API.
- **Clinic gating banner**: when `!clinicEligible`, dashboard shows "AF-CDSS Not Applicable — {clinic}" and hides calculators.
- **Missing Data card**: new component under the alert panel listing monitoring reminders separately from clinical alerts.
- **Combined Alert Panel** already exists — inject PINRR + DOAC dose alerts through the same channel; add explicit priority ordering (critical > high > moderate > reminder).
- Patients list already exists — add an "AF Status" column derived from stored `afConfirmed`.

### 5. Audit log enhancements

Extend `AuditEntry` snapshot with:
```
cha2ds2vasc, hasbled, clcr, pinrr, clinicEligible, afConfirmed, valuesUsed
```
Written from the accept/override/defer routes using the current CDSS snapshot.

### 6. Data

Add to `src/data/patients.json` where missing: `inr_history`, extra BP readings, at least one patient in an ineligible clinic (to demo gating), and one with AF evidence only via ECG/meds (to demo multi-source detection).

## Files touched

Created:
- `src/cdss/afDetection.ts`
- `src/cdss/pinrr.ts`
- `src/cdss/drugRules/{apixaban,edoxaban,rivaroxaban,dabigatran}.ts`
- `src/components/cdss/AfEvidenceCard.tsx`
- `src/components/cdss/AfConfirmationModal.tsx`
- `src/components/cdss/MissingDataCard.tsx`
- `src/components/cdss/ClinicGateBanner.tsx`

Edited:
- `src/cdss/engine.ts` (gating, AF gate, PINRR, DOAC integration, BP-two-reading rule, HbA1c, missing-data reminders)
- `src/cdss/types.ts` (new categories, AuditEntry snapshot)
- `src/cdss/usePatientState.ts` (afConfirmed field, expose evidence/eligibility)
- `src/api/cdssApi.ts`, `src/services/cdssService.ts` (new response fields)
- `src/routes/api/cdss.analyze.ts` (return afEvidence, clinicEligible, afConfirmed)
- `src/routes/index.tsx` (mount new cards + modal + gating banner)
- `src/routes/patients.tsx` (AF status column)
- `src/routes/alerts.$alertId.{accept,override,defer}.tsx` (richer audit snapshot)
- `src/data/patients.json` (test fixtures)

## Out of scope

- No redesign of existing pages, navigation, or theming.
- No backend server outside the existing TanStack `/api/cdss/analyze` route.
- No auth or real EMR connector; UNIMED integration doc already covers the contract.

## Verification

- `bunx tsgo --noEmit` clean.
- Manual walk-through in preview:
  1. Ineligible-clinic patient → CDSS Not Applicable banner, no alerts.
  2. Multi-source AF patient → evidence card + confirmation modal → Reject stops workflow; Confirm runs full engine.
  3. Warfarin patient with poor INR history → PINRR alert.
  4. Patient missing HbA1c/weight → reminders card populated.
  5. Apixaban patient with 2-of-3 criteria → dose-reduction alert.
