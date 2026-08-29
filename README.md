# 🫀 AF Care Companion (CDSS)

### Clinical Decision Support System for Atrial Fibrillation & Anticoagulation

AF Care Companion is an evidence-based Clinical Decision Support System (CDSS) designed for cardiology and outpatient INR clinics. It implements the latest clinical guidelines (ESC 2024 / ESC 2020 Atrial Fibrillation Guidelines, HAS-BLED bleeding risk stratification, and Cockcroft-Gault Creatinine Clearance calculations) to assist healthcare professionals in stroke prevention, DOAC dosing, bleeding risk management, and patient re-evaluation.

---

## 🚀 Key Features

- **Automated & Hybrid Risk Stratification**:
  - **CHA₂DS₂-VA Score**: Sex-neutral stroke risk calculation (Score ≥ 2 triggers anticoagulation recommendations).
  - **HAS-BLED Score**: Bleeding risk stratification with informational alerts (Score ≥ 3 flags high bleeding risk).
  - **Cockcroft-Gault CrCl**: Renal function-based DOAC dose adjustment and contraindication safety checks.
- **DOAC & Warfarin Safety Engine**:
  - Automatic dose adjustment rules for Apixaban (2-of-3 criteria: age ≥ 80, weight ≤ 60kg, creatinine ≥ 133 μmol/L).
  - Dabigatran age-band checks (Age ≥ 80 -> 110mg BD recommended; Age 75-79 -> 110mg BD considered).
  - Rivaroxaban renal dose alerts (CrCl 15-49 mL/min -> 15mg OD; CrCl < 15 mL/min -> Avoid).
  - Warfarin Time in Therapeutic Range (PINRR) lookback calculator (12-month window).
- **Sequential Alert Decision Processing**:
  - Accept, Defer (with review-by date), or Override (with mandatory structured reason codes).
- **Audit Trail & Governance**:
  - Full traceability with engine version, rule IDs, clinical snapshot, and CSV export.
- **Longitudinal Research Timeline**:
  - 3-Window cohort analysis: Pre-alert (-12 months to -1 day), Index encounter (Day 0), and Post-alert (+1 day to +3 months).

---

## 🛠️ Technology Stack

- **Framework**: React 19, TypeScript, Vite 7
- **Routing**: TanStack Router / TanStack Start (SSR + Client routing)
- **Styling**: Tailwind CSS v4, Radix UI Primitives, Lucide Icons
- **Backend & Persistence**: TanStack Server Functions, Supabase PostgreSQL
- **Testing**: Node / tsx custom clinical rules verification suite (28 automated tests)

---

## 📋 Prerequisites & Quickstart

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd cardiao-guide-pal

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start local development server
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🧪 Clinical Rule Verification Suite

To verify that all clinical decision rules, scoring algorithms, and precedence resolvers match guideline specifications:

```bash
npx tsx test-clinical-rules.mjs
```

---

## 🔄 Cohort Management (Benchmark vs. Hospital Dataset)

The CDSS includes a dual-cohort mechanism:

- **Benchmark Cohort (Default - 12 Patients `P001`–`P012`)**: Standardized clinical test cases.
  ```bash
  npm run reset:default
  ```
- **Hospital Cohort (505 Patients)**: 12 Benchmark + 493 Hospital Study Patients.
  ```bash
  npm run load:hospital
  ```

---

## 📁 Project Architecture & Directory Structure

```
src/
├── integrations/                     # Supabase client & database schema types
│   └── supabase/
├── pages/                            # Feature-colocated domains
│   ├── assessment/                   # Patient Assessment & Clinical Calculators
│   ├── alerts/                       # Clinical Alerts Center & Actions
│   ├── patients/                     # Patients Registry / Cohort Directory
│   ├── summary/                      # Consultation Action Summary & Discharge Note
│   ├── timeline/                     # Longitudinal 3-Window Research Timeline
│   ├── analytics/                    # Population Analytics & Epidemiology Audit
│   └── audit/                        # CDSS Decision Audit Trail & CSV Export
├── routes/                           # TanStack Router route definitions
├── shared/                           # Shared foundation
│   ├── cdss/                         # Core CDSS rule engines, types, manifest, server functions
│   ├── components/                   # AppShell layout and UI primitives
│   ├── data/                         # Static datasets (benchmark & hospital cohorts)
│   ├── hooks/                        # Shared hooks
│   └── lib/                          # Utilities and EMR adapters
```
