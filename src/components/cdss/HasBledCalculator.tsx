import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { hasBled, type HasBledInputs } from "@/cdss/engine";
import type { Patient } from "@/cdss/types";
import { CheckCircle2, PencilLine, Info, AlertTriangle } from "lucide-react";

const ITEMS: { key: keyof HasBledInputs; label: string }[] = [
  { key: "hypertension", label: "Hypertension (uncontrolled, sys >160)" },
  { key: "abnormalRenal", label: "Abnormal renal function" },
  { key: "abnormalLiver", label: "Abnormal liver function" },
  { key: "stroke", label: "Stroke" },
  { key: "bleedingHistory", label: "Prior major bleeding" },
  { key: "labileINR", label: "Labile INR (TTR <60%)" },
  { key: "elderly", label: "Elderly (>65)" },
  { key: "drugs", label: "Drugs (aspirin/NSAIDs)" },
  { key: "alcohol", label: "Excess alcohol" },
];

export interface HasBledState {
  total: number;
  highRisk: boolean;
  source: "auto" | "hybrid" | "manual";
}

function prefillFromEMR(patient?: Patient): {
  values: HasBledInputs;
  fromEmr: Partial<Record<keyof HasBledInputs, boolean>>;
} {
  const values: HasBledInputs = {
    hypertension: false,
    abnormalRenal: false,
    abnormalLiver: false,
    stroke: false,
    bleedingHistory: false,
    labileINR: false,
    elderly: false,
    drugs: false,
    alcohol: false,
  };
  const fromEmr: Partial<Record<keyof HasBledInputs, boolean>> = {};
  if (!patient) return { values, fromEmr };

  // Hypertension uncontrolled — sys >160 in latest BP
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(patient.vitals?.bp_latest ?? "");
  if (m) {
    values.hypertension = Number(m[1]) > 160;
    fromEmr.hypertension = true;
  }
  // Abnormal renal — creatinine ≥200 µmol/L (proxy)
  if (patient.labs?.creatinine != null) {
    values.abnormalRenal = patient.labs.creatinine >= 200;
    fromEmr.abnormalRenal = true;
  }
  // Stroke from comorbidities
  if (typeof patient.comorbidities?.stroke === "boolean") {
    values.stroke = patient.comorbidities.stroke;
    fromEmr.stroke = true;
  }
  // Elderly (>65)
  if (typeof patient.age === "number") {
    values.elderly = patient.age > 65;
    fromEmr.elderly = true;
  }
  // Labile INR — TTR <60% across history
  const inr = patient.labs?.inr_history ?? [];
  if (inr.length >= 3) {
    const inRange = inr.filter((v) => v >= 2 && v <= 3).length;
    const ttr = (inRange / inr.length) * 100;
    values.labileINR = ttr < 60;
    fromEmr.labileINR = true;
  }
  // Drugs — antiplatelet/NSAID in med list
  const meds = patient.medications ?? [];
  const antiPlt = meds.some((med) =>
    /aspirin|clopidogrel|nsaid|ibuprofen|naproxen/i.test(med.name),
  );
  if (antiPlt) {
    values.drugs = true;
    fromEmr.drugs = true;
  }
  return { values, fromEmr };
}

export function HasBledCalculator({
  patient,
  onScoreChange,
}: {
  patient?: Patient;
  onScoreChange?: (s: HasBledState) => void;
}) {
  const initial = useMemo(
    () => prefillFromEMR(patient),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patient?.patient_id],
  );

  const [v, setV] = useState<HasBledInputs>(initial.values);
  const [touched, setTouched] = useState<Partial<Record<keyof HasBledInputs, boolean>>>({});

  const score = useMemo(() => hasBled(v), [v]);
  const emrCount = Object.keys(initial.fromEmr).length;
  const manualEdits = Object.keys(touched).length;
  const source: HasBledState["source"] =
    emrCount > 0 && manualEdits === 0
      ? "auto"
      : emrCount > 0 && manualEdits > 0
        ? "hybrid"
        : "manual";

  useMemo(() => {
    onScoreChange?.({ total: score.total, highRisk: score.highRisk, source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score.total, score.highRisk, source]);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">HAS-BLED (hybrid)</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${
            score.highRisk
              ? "bg-[var(--clinical-alert-bg)] text-[var(--clinical-alert)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Score: {score.total}
        </span>
      </div>

      <p
        className="mb-2 text-[11px] font-medium"
        title="This score is partially auto-calculated. Please confirm missing inputs."
      >
        {source === "auto"
          ? `✅ Auto-prefilled from EMR (${emrCount} field${emrCount === 1 ? "" : "s"}) — please confirm`
          : source === "hybrid"
            ? "🟡 Partially completed by clinician"
            : "✏️ Manually entered"}
      </p>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ITEMS.map((it) => {
          const isEmr = initial.fromEmr[it.key] && !touched[it.key];
          const ring = isEmr
            ? "border-[var(--clinical-ok)]/60 bg-[var(--clinical-ok-bg)]/30"
            : touched[it.key]
              ? "border-border bg-background"
              : "border-border";
          return (
            <label
              key={it.key}
              className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs ${ring}`}
            >
              <Checkbox
                checked={v[it.key]}
                onCheckedChange={(c) => {
                  setV((s) => ({ ...s, [it.key]: c === true }));
                  setTouched((t) => ({ ...t, [it.key]: true }));
                }}
              />
              {isEmr ? (
                <CheckCircle2 className="size-3 text-[var(--clinical-ok)]" />
              ) : (
                <PencilLine className="size-3 text-muted-foreground" />
              )}
              <span>{it.label}</span>
            </label>
          );
        })}
      </div>

      {score.highRisk && (
        <div className="mt-2 flex items-start gap-1.5 rounded border border-[var(--clinical-alert)] bg-[var(--clinical-alert-bg)] px-2 py-1.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-alert)]" />
          <span className="font-medium text-[var(--clinical-alert)]">
            HAS-BLED ≥3 — high bleeding risk. Review modifiable factors (not a
            contraindication to anticoagulation).
          </span>
        </div>
      )}

      <p className="mt-2 flex items-start gap-1 text-[10px] italic text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" />
        This calculation supports clinical decision-making and does not replace
        clinician judgement.
      </p>
    </div>
  );
}
