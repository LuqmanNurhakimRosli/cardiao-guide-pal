import { Button } from "@/shared/components/ui/button";
import type { Patient } from "@/shared/cdss/types";
import type { ClinicianInputs } from "@/pages/assessment/hooks/usePatientState";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Heart,
  Info,
  RotateCcw,
  Check,
} from "lucide-react";

interface Cha2VaModalProps {
  open: boolean;
  patient: Patient;
  draft: ClinicianInputs;
  score: number;
  onConfirm: () => void;
  onEdit?: () => void;
  setField?: <K extends keyof ClinicianInputs>(k: K, v: ClinicianInputs[K]) => void;
  onResetToEmr?: () => void;
}

export function Cha2ds2VaConfirmationModal({
  open,
  patient,
  draft,
  score,
  onConfirm,
  setField,
  onResetToEmr,
}: Cha2VaModalProps) {
  if (!open) return null;

  const c = patient.comorbidities ?? {};
  const age = draft.age ?? patient.age_at_encounter ?? patient.age;

  const chfActive = draft.chf ?? c.chf ?? false;
  const htnActive = draft.hypertension ?? c.hypertension ?? false;
  const dmActive = draft.diabetes ?? c.diabetes ?? false;
  const strokeActive = draft.stroke ?? c.stroke ?? false;
  const vascActive = draft.vascular ?? c.vascular ?? false;

  const agePoints = age >= 75 ? 2 : age >= 65 ? 1 : 0;
  const computedScore =
    (chfActive ? 1 : 0) +
    (htnActive ? 1 : 0) +
    agePoints +
    (dmActive ? 1 : 0) +
    (strokeActive ? 2 : 0) +
    (vascActive ? 1 : 0);

  const displayScore = computedScore;
  const highRisk = displayScore >= 2;

  const items = [
    {
      id: "chf" as const,
      label: "CHF / LV dysfunction",
      active: chfActive,
      points: "+1",
      source: draft.chf !== undefined ? "Clinician" : "EMR",
      editable: true,
      onToggle: () => setField?.("chf", !chfActive),
    },
    {
      id: "hypertension" as const,
      label: "Hypertension",
      active: htnActive,
      points: "+1",
      source: draft.hypertension !== undefined ? "Clinician" : "EMR",
      editable: true,
      onToggle: () => setField?.("hypertension", !htnActive),
    },
    {
      id: "age" as const,
      label: `Age ${age} (≥75: +2, 65–74: +1)`,
      active: age >= 65,
      points: age >= 75 ? "+2" : age >= 65 ? "+1" : "0",
      source: draft.age !== undefined ? "Clinician" : "EMR",
      editable: false,
    },
    {
      id: "diabetes" as const,
      label: "Diabetes Mellitus",
      active: dmActive,
      points: "+1",
      source: draft.diabetes !== undefined ? "Clinician" : "EMR",
      editable: true,
      onToggle: () => setField?.("diabetes", !dmActive),
    },
    {
      id: "stroke" as const,
      label: "Stroke / TIA History",
      active: strokeActive,
      points: "+2",
      source: draft.stroke !== undefined ? "Clinician" : "EMR",
      editable: true,
      onToggle: () => setField?.("stroke", !strokeActive),
    },
    {
      id: "vascular" as const,
      label: "Vascular Disease (Prior MI, PAD, Aortic Plaque)",
      active: vascActive,
      points: "+1",
      source: draft.vascular !== undefined ? "Clinician" : "EMR",
      editable: true,
      onToggle: () => setField?.("vascular", !vascActive),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-[var(--clinical-alert)]" />
            <h2 className="text-base font-bold text-foreground">
              CHA₂DS₂-VA Stroke Risk Assessment
            </h2>
          </div>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold border transition-colors ${
              highRisk
                ? "bg-[var(--clinical-alert-bg)] text-[var(--clinical-alert)] border-[var(--clinical-alert)]/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            Score: {displayScore} ({highRisk ? "High Risk ≥2" : "Low Risk"})
          </span>
        </div>

        <p className="mb-2.5 text-xs text-muted-foreground leading-relaxed">
          Verify and adjust patient stroke risk factors. You can toggle criteria directly below to update the clinical score in real-time.
        </p>

        {/* Interactive Checklist */}
        <div className="mb-3.5 space-y-1.5 rounded-lg border border-border bg-background/80 p-2.5 text-xs">
          {items.map((it) => (
            <label
              key={it.id}
              onClick={() => it.editable && it.onToggle?.()}
              className={`flex items-center justify-between rounded-lg px-2.5 py-2 border transition select-none ${
                it.editable ? "cursor-pointer hover:bg-muted/50" : "cursor-default opacity-85"
              } ${
                it.active
                  ? "bg-primary/10 border-primary/30 text-foreground font-medium"
                  : "border-transparent bg-transparent text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-4 items-center justify-center rounded border transition ${
                    it.active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background"
                  }`}
                >
                  {it.active && <Check className="size-3 stroke-[3]" />}
                </div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {it.source}
                </span>
                <span className="text-xs">{it.label}</span>
              </div>
              <span className={`text-xs font-semibold ${it.active ? "text-primary" : "text-muted-foreground/60"}`}>
                {it.active ? (it.points ?? "+1") : "No (0)"}
              </span>
            </label>
          ))}
        </div>

        {highRisk && (
          <div className="mb-3 rounded-lg border border-[var(--clinical-alert)]/30 bg-[var(--clinical-alert-bg)]/40 p-2.5 text-xs text-foreground">
            <p className="font-semibold text-[var(--clinical-alert)] flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> Anticoagulation Indicated
            </p>
            <p className="mt-0.5 text-muted-foreground text-[11px]">
              Guideline recommendation: Oral anticoagulation (DOAC preferred) is recommended for stroke prevention.
            </p>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-border">
          {onResetToEmr ? (
            <Button variant="ghost" size="sm" onClick={onResetToEmr} className="text-xs h-8 text-muted-foreground hover:text-foreground">
              <RotateCcw className="mr-1.5 size-3.5" /> Reset to EMR
            </Button>
          ) : (
            <div />
          )}
          <Button size="sm" onClick={onConfirm} className="text-xs h-8 font-semibold shadow-xs">
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
  onEdit?: () => void;
  setField?: <K extends keyof ClinicianInputs>(k: K, v: ClinicianInputs[K]) => void;
  onResetToEmr?: () => void;
}

export function HasBledConfirmationModal({
  open,
  patient,
  draft,
  score,
  onConfirm,
  setField,
  onResetToEmr,
}: HasBledModalProps) {
  if (!open) return null;

  const bp = patient.vitals?.bp_latest ?? "—";
  const creatinine = patient.labs?.creatinine;
  const age = draft.age ?? patient.age_at_encounter ?? patient.age;

  const hbHtn = draft.hb_hypertension ?? (patient.vitals?.bp_latest ? Number(bp.split("/")[0]) > 160 : false);
  const hbRenal = draft.hb_abnormalRenal ?? (creatinine ?? 0) >= 200;
  const hbLiver = draft.abnormalLiver ?? false;
  const hbStroke = draft.hb_stroke ?? patient.comorbidities?.stroke ?? false;
  const hbBleed = draft.bleedingHistory ?? false;
  const hbInr = draft.hb_labileINR ?? false;
  const hbElderly = draft.hb_elderly ?? age > 65;
  const hbDrugs = draft.hb_drugs ?? false;
  const hbAlcohol = draft.alcohol ?? false;

  const computedScore =
    (hbHtn ? 1 : 0) +
    (hbRenal ? 1 : 0) +
    (hbLiver ? 1 : 0) +
    (hbStroke ? 1 : 0) +
    (hbBleed ? 1 : 0) +
    (hbInr ? 1 : 0) +
    (hbElderly ? 1 : 0) +
    (hbDrugs ? 1 : 0) +
    (hbAlcohol ? 1 : 0);

  const displayScore = computedScore;
  const highRisk = displayScore >= 3;

  const items = [
    {
      id: "hb_hypertension" as const,
      label: `Hypertension (Latest SBP: ${bp})`,
      active: hbHtn,
      source: "Vitals/EMR",
      onToggle: () => setField?.("hb_hypertension", !hbHtn),
    },
    {
      id: "hb_abnormalRenal" as const,
      label: `Abnormal Renal (${creatinine ? `${creatinine} µmol/L` : "Normal"})`,
      active: hbRenal,
      source: "Labs",
      onToggle: () => setField?.("hb_abnormalRenal", !hbRenal),
    },
    {
      id: "abnormalLiver" as const,
      label: "Abnormal Liver Function",
      active: hbLiver,
      source: "Clinician",
      onToggle: () => setField?.("abnormalLiver", !hbLiver),
    },
    {
      id: "hb_stroke" as const,
      label: "Prior Stroke History",
      active: hbStroke,
      source: "EMR",
      onToggle: () => setField?.("hb_stroke", !hbStroke),
    },
    {
      id: "bleedingHistory" as const,
      label: "Prior Major Bleeding History",
      active: hbBleed,
      source: "Clinician",
      onToggle: () => setField?.("bleedingHistory", !hbBleed),
    },
    {
      id: "hb_labileINR" as const,
      label: "Labile INR (TTR <60% or PINRR <56%)",
      active: hbInr,
      source: "Labs/Clinician",
      onToggle: () => setField?.("hb_labileINR", !hbInr),
    },
    {
      id: "hb_elderly" as const,
      label: `Elderly Age (${age} > 65)`,
      active: hbElderly,
      source: "EMR",
      onToggle: () => setField?.("hb_elderly", !hbElderly),
    },
    {
      id: "hb_drugs" as const,
      label: "Drugs (Aspirin / NSAIDs)",
      active: hbDrugs,
      source: "Meds/EMR",
      onToggle: () => setField?.("hb_drugs", !hbDrugs),
    },
    {
      id: "alcohol" as const,
      label: "Excess Alcohol Intake",
      active: hbAlcohol,
      source: "Clinician",
      onToggle: () => setField?.("alcohol", !hbAlcohol),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-[var(--clinical-warn)]" />
            <h2 className="text-base font-bold text-foreground">
              HAS-BLED Bleeding Risk Assessment
            </h2>
          </div>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold border transition-colors ${
              highRisk
                ? "bg-[var(--clinical-warn-bg)] text-[var(--clinical-warn)] border-[var(--clinical-warn)]/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            Score: {displayScore} ({highRisk ? "High Bleeding Risk ≥3" : "Standard Risk"})
          </span>
        </div>

        <p className="mb-2.5 text-xs text-muted-foreground leading-relaxed">
          Verify and address reversible bleeding risk factors. Toggle any risk factors directly to update score:
        </p>

        {/* Interactive Checklist */}
        <div className="mb-3.5 max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-border bg-background/80 p-2.5 text-xs">
          {items.map((it) => (
            <label
              key={it.id}
              onClick={() => it.onToggle()}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border transition cursor-pointer select-none hover:bg-muted/50 ${
                it.active
                  ? "bg-amber-500/10 border-amber-500/30 text-foreground font-medium"
                  : "border-transparent bg-transparent text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-4 items-center justify-center rounded border transition ${
                    it.active
                      ? "border-amber-600 bg-amber-600 text-white dark:border-amber-500 dark:bg-amber-500"
                      : "border-muted-foreground/40 bg-background"
                  }`}
                >
                  {it.active && <Check className="size-3 stroke-[3]" />}
                </div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {it.source}
                </span>
                <span className="text-xs">{it.label}</span>
              </div>
              <span
                className={`text-xs font-semibold ${
                  it.active ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/60"
                }`}
              >
                {it.active ? "Yes (+1)" : "No (0)"}
              </span>
            </label>
          ))}
        </div>

        <div className="mb-3 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-foreground">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <Info className="size-3.5 text-primary" /> Clinical Note:
          </p>
          <p className="mt-0.5 text-muted-foreground text-[11px] leading-relaxed">
            A high HAS-BLED score is <strong>not a contraindication</strong> to anticoagulation. It indicates the need to identify and correct modifiable bleeding risk factors and schedule closer monitoring.
          </p>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          {onResetToEmr ? (
            <Button variant="ghost" size="sm" onClick={onResetToEmr} className="text-xs h-8 text-muted-foreground hover:text-foreground">
              <RotateCcw className="mr-1.5 size-3.5" /> Reset to EMR
            </Button>
          ) : (
            <div />
          )}
          <Button size="sm" onClick={onConfirm} className="text-xs h-8 font-semibold shadow-xs">
            <CheckCircle2 className="mr-1.5 size-3.5" /> Confirm & Proceed to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
