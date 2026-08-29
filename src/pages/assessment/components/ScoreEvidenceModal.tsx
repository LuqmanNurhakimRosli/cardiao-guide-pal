import { Button } from "@/shared/components/ui/button";
import type { Patient } from "@/shared/cdss/types";
import type { ClinicianInputs } from "@/pages/assessment/hooks/usePatientState";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Activity,
  Heart,
  Info,
  PencilLine,
} from "lucide-react";

interface Cha2VaModalProps {
  open: boolean;
  patient: Patient;
  draft: ClinicianInputs;
  score: number;
  onConfirm: () => void;
  onEdit: () => void;
}

export function Cha2ds2VaConfirmationModal({
  open,
  patient,
  draft,
  score,
  onConfirm,
  onEdit,
}: Cha2VaModalProps) {
  if (!open) return null;

  const c = patient.comorbidities ?? {};
  const age = draft.age ?? patient.age_at_encounter ?? patient.age;

  const items = [
    {
      label: "CHF / LV dysfunction",
      active: draft.chf ?? c.chf,
      source: draft.chf !== undefined ? "Clinician" : "EMR",
    },
    {
      label: "Hypertension",
      active: draft.hypertension ?? c.hypertension,
      source: draft.hypertension !== undefined ? "Clinician" : "EMR",
    },
    {
      label: `Age ${age} (≥75: +2, 65–74: +1)`,
      active: age >= 65,
      points: age >= 75 ? "+2" : age >= 65 ? "+1" : "0",
      source: draft.age !== undefined ? "Clinician" : "EMR",
    },
    {
      label: "Diabetes Mellitus",
      active: draft.diabetes ?? c.diabetes,
      source: draft.diabetes !== undefined ? "Clinician" : "EMR",
    },
    {
      label: "Stroke / TIA History",
      active: draft.stroke ?? c.stroke,
      points: "+2",
      source: draft.stroke !== undefined ? "Clinician" : "EMR",
    },
    {
      label: "Vascular Disease",
      active: draft.vascular ?? c.vascular,
      source: draft.vascular !== undefined ? "Clinician" : "EMR",
    },
  ];

  const highRisk = score >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-[var(--clinical-alert)]" />
            <h2 className="text-base font-bold text-foreground">
              CHA₂DS₂-VA Stroke Risk Assessment
            </h2>
          </div>
          <span
            className={`rounded px-2.5 py-0.5 text-xs font-bold ${
              highRisk
                ? "bg-[var(--clinical-alert-bg)] text-[var(--clinical-alert)] border border-[var(--clinical-alert)]/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Score: {score} ({highRisk ? "High Risk ≥2" : "Low Risk"})
          </span>
        </div>

        <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
          The CDSS analyzed stroke risk factors from patient comorbidities and demographics. Please
          confirm the clinical profile before continuing.
        </p>

        {/* Evidence List */}
        <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-border bg-background/70 p-2.5 space-y-1.5 text-xs">
          {items.map((it, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between rounded px-2 py-1 ${
                it.active
                  ? "bg-primary/5 border border-primary/20 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-muted-foreground/80 bg-muted px-1 rounded">
                  {it.source}
                </span>
                <span>{it.label}</span>
              </div>
              <span className={it.active ? "text-primary font-semibold" : "text-muted-foreground"}>
                {it.active ? (it.points ?? "+1") : "No (0)"}
              </span>
            </div>
          ))}
        </div>

        {highRisk && (
          <div className="mb-3 rounded border border-[var(--clinical-alert)]/30 bg-[var(--clinical-alert-bg)]/40 p-2.5 text-xs text-foreground">
            <p className="font-semibold text-[var(--clinical-alert)] flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> Anticoagulation Indicated
            </p>
            <p className="mt-0.5 text-muted-foreground text-[11px]">
              Guideline recommendation: Oral anticoagulation (DOAC preferred) is recommended for
              stroke prevention.
            </p>
          </div>
        )}

        <p className="mb-4 text-[11px] italic text-muted-foreground flex items-center gap-1">
          <Info className="size-3 shrink-0" />
          Sex category (Sc) removed in CHA₂DS₂-VA per 2026.08.26 guideline.
        </p>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onEdit} className="text-xs">
            <PencilLine className="mr-1 size-3.5" /> Edit Risk Factors
          </Button>
          <Button size="sm" onClick={onConfirm} className="text-xs">
            Confirm Score & Proceed <ChevronRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface HasBledModalProps {
  open: boolean;
  patient: Patient;
  draft: ClinicianInputs;
  score: number;
  onConfirm: () => void;
  onEdit: () => void;
}

export function HasBledConfirmationModal({
  open,
  patient,
  draft,
  score,
  onConfirm,
  onEdit,
}: HasBledModalProps) {
  if (!open) return null;

  const bp = patient.vitals?.bp_latest ?? "—";
  const creatinine = patient.labs?.creatinine;
  const age = draft.age ?? patient.age_at_encounter ?? patient.age;

  const items = [
    {
      label: `Hypertension (Latest BP: ${bp})`,
      active:
        draft.hb_hypertension ??
        (patient.vitals?.bp_latest ? Number(bp.split("/")[0]) > 160 : false),
      source: "Vitals/EMR",
    },
    {
      label: `Abnormal Renal (${creatinine ? `${creatinine} µmol/L` : "Normal"})`,
      active: draft.hb_abnormalRenal ?? (creatinine ?? 0) >= 200,
      source: "Labs",
    },
    { label: "Abnormal Liver Function", active: draft.abnormalLiver ?? false, source: "Clinician" },
    {
      label: "Prior Stroke History",
      active: draft.hb_stroke ?? patient.comorbidities?.stroke ?? false,
      source: "EMR",
    },
    {
      label: "Prior Major Bleeding History",
      active: draft.bleedingHistory ?? false,
      source: "Clinician",
    },
    {
      label: "Labile INR (TTR <60%)",
      active: draft.hb_labileINR ?? false,
      source: "Labs/Clinician",
    },
    { label: `Elderly Age (${age} > 65)`, active: draft.hb_elderly ?? age > 65, source: "EMR" },
    { label: "Drugs (Aspirin / NSAIDs)", active: draft.hb_drugs ?? false, source: "Meds/EMR" },
    { label: "Excess Alcohol Intake", active: draft.alcohol ?? false, source: "Clinician" },
  ];

  const highRisk = score >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-[var(--clinical-warn)]" />
            <h2 className="text-base font-bold text-foreground">
              HAS-BLED Bleeding Risk Assessment
            </h2>
          </div>
          <span
            className={`rounded px-2.5 py-0.5 text-xs font-bold ${
              highRisk
                ? "bg-[var(--clinical-warn-bg)] text-[var(--clinical-warn)] border border-[var(--clinical-warn)]/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Score: {score} ({highRisk ? "High Bleeding Risk ≥3" : "Standard Risk"})
          </span>
        </div>

        <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
          The CDSS pre-filled bleeding risk factors from vitals, labs, and medications. Please
          verify reversible risk factors.
        </p>

        {/* Evidence List */}
        <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-border bg-background/70 p-2.5 space-y-1.5 text-xs">
          {items.map((it, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between rounded px-2 py-1 ${
                it.active
                  ? "bg-amber-500/10 border border-amber-500/20 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-muted-foreground/80 bg-muted px-1 rounded">
                  {it.source}
                </span>
                <span>{it.label}</span>
              </div>
              <span
                className={
                  it.active
                    ? "text-amber-600 dark:text-amber-400 font-semibold"
                    : "text-muted-foreground"
                }
              >
                {it.active ? "Yes (+1)" : "No (0)"}
              </span>
            </div>
          ))}
        </div>

        <div className="mb-3 rounded border border-border bg-muted/40 p-2.5 text-xs text-foreground">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <Info className="size-3.5 text-primary" /> Clinical Note:
          </p>
          <p className="mt-0.5 text-muted-foreground text-[11px] leading-relaxed">
            A high HAS-BLED score is <strong>not a contraindication</strong> to anticoagulation. It
            indicates the need to identify and correct modifiable bleeding risk factors and schedule
            closer clinical monitoring.
          </p>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onEdit} className="text-xs">
            <PencilLine className="mr-1 size-3.5" /> Edit Bleeding Factors
          </Button>
          <Button size="sm" onClick={onConfirm} className="text-xs">
            <CheckCircle2 className="mr-1 size-3.5" /> Confirm & Proceed to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
