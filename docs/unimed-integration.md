# Integration of CDSS for Atrial Fibrillation with UNIMED System

## 1. Purpose

This Clinical Decision Support System (CDSS) is designed as a **decision
support engine**, not a replacement for UNIMED or any other Electronic
Medical Record (EMR). It integrates with UNIMED to provide **real-time
clinical alerts and recommendations** for the management of Atrial
Fibrillation (AF), supporting clinicians by analysing patient data
automatically and surfacing only the information that requires action.

The CDSS does **not** modify the EMR record. It receives patient context,
applies clinical rules, and returns structured alerts that UNIMED can
render in its own UI.

---

## 2. System Overview

### UNIMED (EMR)
- The hospital's primary system of record.
- Source of patient demographics, diagnoses, vitals, labs, and medications.
- Used by clinicians during consultation.
- Owns the user interface presented to the doctor.

### CDSS (this system)
- An external, stateless decision engine.
- Receives patient data via HTTPS API.
- Applies AF-specific rules (CHA₂DS₂-VASc, HAS-BLED, anticoagulant dosing,
  BP control, glycaemic control, renal function).
- Returns alerts, reminders, and risk scores.

---

## 3. High-Level Architecture

```
       UNIMED (EMR)
            │
            │  Doctor opens patient record
            ▼
   ┌─────────────────────┐
   │  UNIMED CDSS Bridge │     (collects patient context)
   └─────────────────────┘
            │
            │  HTTPS POST /api/cdss/analyze
            ▼
   ┌─────────────────────┐
   │  CDSS Engine        │     (rules: AF, CHA₂DS₂-VASc, HAS-BLED,
   │  /api/cdss/analyze  │      anticoagulant dosing, BP, HbA1c, ClCr)
   └─────────────────────┘
            │
            │  JSON: { alerts, reminders, scores, meta }
            ▼
   ┌─────────────────────┐
   │  UNIMED UI          │     Popup alert OR notification panel
   └─────────────────────┘
            │
            │  Clinician action: accept / override / defer
            ▼
       Audit log (UNIMED + CDSS)
```

---

## 4. Workflow Step-by-Step

1. **Doctor opens a patient record** in UNIMED (e.g. in the Cardiology
   Clinic).
2. UNIMED **automatically triggers** the CDSS API with the relevant
   patient context.
3. The CDSS receives the payload and:
   - detects whether AF is present (ICD-10 I48, ECG, or AF-indicated
     anticoagulant);
   - calculates CHA₂DS₂-VASc and creatinine clearance (Cockcroft–Gault);
   - evaluates anticoagulant dosing rules (Apixaban, Rivaroxaban,
     Dabigatran, Edoxaban, Warfarin/INR/TTR);
   - checks BP control and HbA1c thresholds;
   - generates structured alerts and reminders.
4. The CDSS returns a JSON response.
5. UNIMED renders the alerts as a **popup** or **persistent notification
   panel**.
6. The clinician reviews and takes one of three actions:
   - **Accept** — apply the recommendation.
   - **Override** — proceed against the recommendation, with a documented
     reason.
   - **Defer** — postpone the decision (e.g. pending labs).

---

## 5. API Communication

### Endpoint

```
POST /api/cdss/analyze
Content-Type: application/json
```

### Request body

```json
{
  "patient": {
    "patient_id": "P001",
    "name": "...",
    "age": 72,
    "sex": "male",
    "clinic_location": "Cardiology Clinic",
    "diagnoses": ["I48.0"],
    "ecg_results": ["AF"],
    "medications": [{ "name": "Apixaban", "dose": "5 mg BD", "indication": "AF" }],
    "vitals": { "bp_latest": "150/95", "bp_second": "152/96", "weight": 70 },
    "labs": { "creatinine": 110, "creatinine_unit": "umol/L", "hba1c": 7.4, "inr_history": [] },
    "comorbidities": { "chf": false, "hypertension": true, "diabetes": true, "stroke": false, "vascular": false }
  },
  "clinician_inputs": {
    "hypertension": true,
    "abnormalLiver": false,
    "bleedingHistory": false,
    "alcohol": false
  }
}
```

`patient_id` may be sent instead of the full `patient` object when both
systems share a patient identifier.

### Response body

```json
{
  "ok": true,
  "executed": true,
  "hasAF": true,
  "scores": {
    "cha2ds2vasc": { "total": 4, "breakdown": { "Age 65–74": 1, "Hypertension": 1, "Diabetes": 1, "Vascular disease": 1 } },
    "clcr": 62.3
  },
  "alerts": [
    {
      "id": "stroke-prevention",
      "severity": "alert",
      "category": "stroke-risk",
      "title": "Anticoagulation indicated for stroke prevention",
      "detail": "CHA₂DS₂-VASc = 4 (threshold ≥2).",
      "rationale": ["Hypertension: +1", "Diabetes: +1", "Vascular disease: +1", "Age 65–74: +1"]
    }
  ],
  "reminders": [],
  "meta": {
    "engine_version": "1.0.0",
    "evaluated_at": "2026-05-03T10:15:00.000Z",
    "input_source": "hybrid"
  }
}
```

The API is **stateless** — each call is one encounter. CDSS does not
require persistent storage of patient data.

---

## 6. Hybrid Calculation

The CDSS supports a **hybrid** clinical workflow:

- **Auto** — when all required data exists in UNIMED, scores are
  calculated automatically.
- **Manual** — when data is missing (e.g. no recorded vascular disease),
  the clinician supplies the value through the CDSS UI or via the
  `clinician_inputs` field of the API.
- **Hybrid** — partial auto-fill plus manual completion (the most common
  real-world case).

The engine **never assumes** missing values. Missing data either blocks
the calculation or surfaces a reminder. This is a deliberate safety
choice.

---

## 7. Alert Display in UNIMED

CDSS only returns **structured alert data**. Rendering is owned by
UNIMED and can take either form:

- **Option A — Popup alert.** Appears when the patient record is opened
  if any high-severity alert is present.
- **Option B — Notification panel.** A persistent side panel listing
  current alerts and reminders, refreshed on every CDSS call.

Both are valid; the choice depends on UNIMED UX guidelines.

---

## 8. Clinician Action Flow

For every alert UNIMED presents, the clinician must record one action:

| Action   | Meaning                                       | Required fields            |
|----------|-----------------------------------------------|----------------------------|
| Accept   | Apply the recommendation                      | (optional) order details   |
| Override | Proceed against recommendation                | reason (mandatory), notes  |
| Defer    | Postpone (e.g. pending labs)                  | defer-until date           |

All actions are logged with a timestamp.

---

## 9. Audit and Logging

The CDSS records, per encounter:

- patient_id and visit_id
- triggered alert IDs and titles
- clinician action (accept / override / defer)
- override reason and free-text notes
- medication change orders, when applicable
- timestamp (ISO 8601, UTC)

UNIMED is expected to maintain its own audit trail for clinical actions
applied to the EMR. CDSS audit serves as a **decision-support evidence
trail**, useful for governance and clinical review.

---

## 10. Security and Data Considerations

- All communication occurs over **HTTPS**.
- CDSS does **not** require direct database access to UNIMED.
- Patient data is processed **per request**; the CDSS does not retain
  patient data beyond the audit log.
- Authentication between UNIMED and CDSS should use mutually trusted
  credentials (mTLS or signed bearer tokens) in production.
- All requests should be considered PHI and handled accordingly.

---

## 11. Implementation Scenarios

### Prototype mode (current)
- Patient list is served from a local mock dataset.
- CDSS API is exposed at `/api/cdss/analyze` within the same web
  application for demonstration.
- Useful for clinical validation and UI sign-off.

### Production mode
- UNIMED sends real patient context to a deployed CDSS service.
- CDSS runs as a backend microservice behind the hospital firewall.
- UNIMED renders alerts inside its own UI.
- Audit logs are forwarded to the hospital data warehouse.

---

## 12. Limitations

- Requires UNIMED (or any EMR) to expose a hook for opening a patient
  record and to support outbound HTTPS calls.
- UI integration depends on the hospital IT team.
- The CDSS does not write to the EMR; medication changes must be
  applied through UNIMED's existing order entry.
- Rules are limited to AF management at present.

---

## 13. Future Improvements

- Real-time streaming integration (e.g. HL7 FHIR Subscriptions).
- OAuth2 / mTLS authentication and per-clinician identity propagation.
- Additional clinical modules (heart failure, ACS, diabetes).
- Outcome analytics dashboard (override rates, alert fatigue,
  acceptance trends).
- SMART-on-FHIR app launch from UNIMED chart context.

---

## 14. Conclusion

The CDSS acts as an **intelligent clinical assistant** that augments
UNIMED with structured, evidence-based alerts for Atrial Fibrillation
management. Integration is achieved through a single stateless HTTPS
endpoint, keeping the EMR untouched while giving clinicians timely,
actionable decision support. The architecture is **modular, scalable,
and integration-ready** for any modern hospital EMR.

> *This system supports clinical decision-making and does not replace
> clinician judgement.*
