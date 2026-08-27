# Integration of CDSS for Atrial Fibrillation with UNIMED System (2026.08.26 Specification)

## 1. Purpose

This Clinical Decision Support System (CDSS) is designed as a **decision
support engine**, not a replacement for UNIMED or any other Electronic
Medical Record (EMR). It integrates with UNIMED to provide **real-time
clinical alerts and recommendations** for the management of Atrial
Fibrillation (AF), supporting clinicians by analysing patient data
automatically and surfacing only the highest-priority clinical findings that require action.

The CDSS does **not** modify the EMR record. It receives patient context,
applies clinical rules (CHA₂DS₂-VA, HAS-BLED, Cockcroft–Gault CrCl, anticoagulant dosing precedence, BP, HbA1c, PINRR), and returns structured alerts that UNIMED can render in its own UI.

---

## 2. System Overview

### UNIMED (EMR)
- The hospital's primary system of record.
- Source of patient demographics (MRN, DOB, age, sex), diagnoses, vitals, dated labs, medications, and clinician plans.
- Used by clinicians during consultation (Point-of-Care).
- Owns the user interface presented to the doctor.

### CDSS (this system)
- An external decision engine operating at ultra-low latency.
- Receives patient data via HTTPS API (`POST /api/cdss/analyze`).
- Applies AF-specific rules:
  - **CHA₂DS₂-VA** (Threshold ≥2 for all patients, sex points removed).
  - **HAS-BLED** (Informational alert if score ≥3).
  - **Cockcroft–Gault CrCl** (using age-at-encounter, weight, and serum creatinine / 88.4).
  - **Anticoagulant Precedence Matrix** (Warfarin/PINRR <56%, Apixaban, Edoxaban, Rivaroxaban, Dabigatran).
  - **Blood Pressure Control** (2 most recent dated readings without averaging).
  - **Glycaemic Control** (HbA1c alert at >7.0%).
  - **Missing Data Prompts** (actionable order prompts for creatinine, HbA1c, BP).
- Returns structured alerts, reminders, and risk scores in a unified response envelope.

---

## 3. High-Level Architecture

```
       UNIMED (EMR)
            │
            │  Doctor opens patient record (Point-of-Care)
            ▼
   ┌─────────────────────┐
   │  UNIMED CDSS Bridge │     (collects encounter & dated context)
   └─────────────────────┘
            │
            │  HTTPS POST /api/cdss/analyze
            ▼
   ┌─────────────────────┐
   │  CDSS Engine        │     (CHA₂DS₂-VA, HAS-BLED, Precedence Matrix,
   │  /api/cdss/analyze  │      Dose Guards, CrCl, PINRR <56%, BP, HbA1c)
   └─────────────────────┘
            │
            │  JSON Envelope: { success, alerts, scores, recommendations, audit, meta }
            ▼
   ┌─────────────────────┐
   │  UNIMED UI          │     Combined Clinical Alert Panel / Nudge
   └─────────────────────┘
            │
            │  Clinician action: accept / override (10 codes) / defer
            ▼
       Audit log (UNIMED + CDSS Durable Store)
```

---

## 4. API Communication

### Endpoint

```
POST /api/cdss/analyze
Content-Type: application/json
Authorization: Bearer <token> (optional/configured)
```

### Request body

```json
{
  "patient": {
    "patient_id": "P001",
    "mrn": "MRN-100234",
    "name": "Patient Alpha",
    "dob": "1948-04-12",
    "age": 78,
    "sex": "female",
    "clinic_location": "Cardiology Clinic",
    "encounter": {
      "visit_id": "VIS-2026-001",
      "clinic_date": "2026-08-26",
      "clinician_id": "DR-CAR-01",
      "encounter_type": "Outpatient Clinic"
    },
    "diagnoses": ["I48.0", "E11.9", "I10"],
    "ecg_results": ["AF"],
    "medications": [
      { "name": "Apixaban", "dose": "5 mg BD", "indication": "AF", "start_date": "2025-11-10" }
    ],
    "vitals": {
      "bp_latest": "150/95",
      "bp_second": "148/92",
      "weight": 55,
      "bp_readings": [
        { "value": "150/95", "date": "2026-08-26" },
        { "value": "148/92", "date": "2026-08-26" }
      ]
    },
    "labs": {
      "creatinine_record": { "value": 140, "unit": "umol/L", "date": "2026-08-20" },
      "hba1c_record": { "value": 8.2, "date": "2026-08-20" },
      "inr_results": []
    },
    "comorbidities": {
      "chf": false,
      "hypertension": true,
      "diabetes": true,
      "stroke": false,
      "vascular": true
    },
    "clinician_plan": {
      "doctor_plan": "Review renal function and adjust DOAC dosing.",
      "next_appointment_date": "2026-11-26"
    }
  },
  "clinician_inputs": {
    "hypertension": true,
    "afConfirmed": true
  }
}
```

### Response body

```json
{
  "success": true,
  "scores": {
    "cha2ds2va": {
      "total": 4,
      "breakdown": {
        "Age 65–74": 0,
        "Age ≥75": 2,
        "Hypertension": 1,
        "Diabetes": 1,
        "Vascular disease": 1
      },
      "source": "auto",
      "calculated_at": "2026-08-26T10:15:00.000Z"
    },
    "hasbled": {
      "total": 2,
      "breakdown": {
        "Hypertension": 1,
        "Elderly >65": 1
      }
    },
    "clcr": 26.4
  },
  "alerts": [
    {
      "id": "stroke-prevention",
      "severity": "alert",
      "category": "stroke-risk",
      "group": "Stroke Prevention",
      "title": "Anticoagulation indicated for stroke prevention",
      "detail": "CHA₂DS₂-VA = 4 (threshold ≥2). Oral anticoagulation is recommended to reduce stroke risk.",
      "rationale": ["Hypertension: +1", "Age ≥75: +2", "Diabetes: +1", "Vascular disease: +1"]
    },
    {
      "id": "apixaban-reduce",
      "severity": "alert",
      "category": "drug-dose",
      "group": "Drug Safety",
      "title": "Reduce Apixaban dose to 2.5 mg BD",
      "detail": "2 of 3 dose-reduction criteria met (Age 78 ≥ 80 years; Weight 55 kg ≤ 60 kg; Serum Creatinine 140 µmol/L ≥ 133 µmol/L).",
      "rationale": ["Weight 55 kg ≤ 60 kg", "Serum Creatinine 140 µmol/L ≥ 133 µmol/L"],
      "recommendation": "Reduce Apixaban from 5 mg BD to 2.5 mg BD.",
      "action": {
        "kind": "medication",
        "medication": "Apixaban",
        "current_dose": "5 mg BD",
        "suggested_dose": "2.5 mg BD"
      }
    }
  ],
  "reminders": [],
  "recommendations": [
    {
      "alert_id": "apixaban-reduce",
      "group": "Drug Safety",
      "recommendation": "Reduce Apixaban from 5 mg BD to 2.5 mg BD."
    }
  ],
  "audit": {
    "request_id": "req_1724732100_abc",
    "engine_version": "2026.08.26",
    "patient_id": "P001",
    "input_source": "auto",
    "evaluated_at": "2026-08-26T10:15:00.000Z"
  },
  "meta": {
    "engine_version": "2026.08.26",
    "request_id": "req_1724732100_abc",
    "execution_time_ms": 4,
    "timestamp": "2026-08-26T10:15:00.000Z"
  }
}
```

---

## 5. Controlled Override Reason Codes

When a clinician overrides an alert, UNIMED submits one of the 10 controlled codes:

| Code | Label | Requires Free Text |
|:---|:---|:---|
| `dose_appropriate` | Dose already appropriate | No |
| `clinical_judgement` | Clinical judgement | No |
| `contraindication_intolerance` | Contraindication / intolerance | No |
| `renal_function` | Renal function issue | No |
| `bleeding_risk` | Bleeding risk | No |
| `adherence` | Adherence issue | No |
| `monitoring_titration` | Monitoring / titration | No |
| `patient_preference` | Patient preference | No |
| `temporary_factor` | Temporary factor | No |
| `other` | Other | **Yes (Mandatory)** |

---

## 6. Research Windows Definition

For clinical research, events are normalized into three research windows relative to the `index_alert_date` (Clinic Encounter Date):

1. **Pre-alert window**: `index_date - 12 months` to `index_date - 1 day`.
2. **Index encounter window**: `index_date` (point-of-care consultation & CDSS actions).
3. **Post-alert window**: `index_date + 1 day` to `index_date + 3 months`.

---

## 7. Security and Performance

- **Low latency**: Evaluation completes in under 10 ms.
- **Fail-safe**: Unknown or missing clinical values generate non-blocking order prompts rather than assumption errors.
- **Stateless & HIPAA/GDPR Compliant**: Processing occurs per encounter; persistent research snapshots can be exported as CSV/JSON.
