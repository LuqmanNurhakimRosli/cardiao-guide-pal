
# AF-CDSS Production-Readiness Refactor

Goal: keep the current UI and workflow untouched; harden the backend, modularize the engine, prepare for UNIMED integration, and improve alerts / missing-data / audit fidelity. Progress tracked in a plain-text file.

## Guardrails
- No UI redesign, no page removals, no flow changes.
- Existing routes (`/patients`, `/`, `/alerts*`, `/summary`, `/audit`) stay.
- Frontend keeps calling `runCDSS` → `POST /api/cdss/analyze`. No React-side clinical calculation in production path (draft preview via API stays debounced).
- localStorage stays for the prototype but gated behind a config flag so it can be turned off for production.

## 1. Backend hardening — `src/routes/api/cdss.analyze.ts`
- Add Zod schemas for request + response (`src/cdss/schemas.ts`).
- Return unified envelope: `{ success, alerts, scores, recommendations, audit, meta:{engine_version, request_id, execution_time_ms, timestamp} }`. Keep legacy top-level fields for backward compatibility with current UI (`hasAF`, `executed`, `reason`, `afEvidence`, `afConfirmed`, `patient`).
- Bearer token check (optional in dev, required when `CDSS_API_TOKEN` is set). Config read via `process.env` inside handler.
- Reject unknown fields, size-limit body, return typed error shape `{ success:false, error:{code,message,details?} }`.

## 2. Modularize the engine — split `src/cdss/engine.ts`
Create `src/cdss/rules/`:
- `clinicGating.ts`
- `afDetection.ts` (re-export existing)
- `cha2ds2vasc.ts`
- `hasBled.ts`
- `cockcroftGault.ts`
- `pinrr.ts` (re-export existing)
- `bloodPressure.ts`
- `hba1c.ts`
- `drugs/warfarin.ts`, `apixaban.ts`, `rivaroxaban.ts`, `dabigatran.ts`, `edoxaban.ts`
- `missingData.ts` — richer reminders with `reason`, `clinical_impact`, `action_required`, `manual_entry_allowed`.
- `alertBuilder.ts` — groups alerts by category (Stroke Prevention, Bleeding Risk, Drug Safety, BP, HbA1c, Renal, Missing Data) and attaches `guideline` + `supporting_values`.

`engine.ts` becomes a thin orchestrator that composes rule modules; keeps the current `evaluate()` signature so callers don't break.

## 3. EMR Adapter layer — `src/server/emr/`
- `types.ts` — `EmrAdapter` interface (`getPatient(id)`, `listPatients()`).
- `mockAdapter.ts` — wraps `src/data/patients.json` (current behaviour).
- `unimedAdapter.ts` — stub with TODOs + shape mapping notes.
- `fhirAdapter.ts` — stub.
- `index.ts` — factory selects adapter via `process.env.CDSS_EMR_ADAPTER` (default: `mock`).
- Analyze route + `listPatientsWithAlerts` go through the factory. No route imports `patients.json` directly.

## 4. Alerts & audit enrichment
- Extend `CdssAlert` with optional `guideline`, `recommendation`, `supporting_values`, `group`.
- Audit snapshot (`src/cdss/server.functions.ts` `logAction`) gains `request_id`, `engine_version`, `alert_evidence`, `recommendation`, `visit_id` (encounter timestamp). Keep existing fields.
- Missing-data reminders carry the richer metadata described above; `MissingDataCard` reads new optional fields without visual redesign (progressive enhancement — falls back if absent).

## 5. Frontend wiring (minimal)
- `src/cdss/config.ts` — `{ persistDrafts: !import.meta.env.PROD, apiBaseUrl }`. `usePatientState` honours the flag.
- `usePatientState`:
  - Keep 300ms debounce for draft recompute (UX unchanged), but abort in-flight requests on patient switch (AbortController).
  - "Save & Recalculate" remains the only path that writes inputs; unchanged UX.
  - Prevent duplicate submissions with an in-flight guard.
- No component-level calculations added; existing hybrid calculators keep their live preview via the API (already the case).

## 6. Progress tracker
- Create `PROGRESS.txt` at repo root with a checklist mirroring these sections; update as items land.

## 7. Out of scope this pass
- Real UNIMED endpoints, JWT issuance, rate-limiter middleware, HTTPS enforcement (documented as follow-ups in `docs/unimed-integration.md` and `PROGRESS.txt`; adapter + bearer scaffolding prepares for them).
- Any visual/layout changes.

## Technical notes
- Response envelope is additive: existing `AnalyzeResponse` fields remain so `src/api/cdssApi.ts` and `cdssService.ts` need no breaking edits — just extend the type.
- Rule modules export pure functions taking `Patient` (+ optional context) and returning `{ alerts, reminders, scores }` fragments merged by orchestrator.
- Keep `evaluate()` re-export from `src/cdss/engine.ts` so `cdss.analyze.ts` and any tests keep working during the refactor.
- Zod is already an available pattern in the codebase guidance; add via `bun add zod` if not present.

## Rollout order
1. `PROGRESS.txt` + `config.ts` + Zod install.
2. Split rules into `src/cdss/rules/` behind existing `evaluate()`.
3. EMR adapter + route swap.
4. Response envelope + bearer + validation.
5. Alert/audit enrichment.
6. `usePatientState` abort + in-flight guard + persistDrafts flag.
