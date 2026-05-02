import { useMemo } from "react";
import { hasBled, type HasBledInputs } from "@/cdss/engine";
import type { Patient } from "@/cdss/types";
import type { ClinicianInputs } from "@/cdss/usePatientState";
import { CheckCircle2, PencilLine, Info, AlertTriangle } from "lucide-react";

export interface HasBledState {
  total: number;
  highRisk: boolean;
  source: "auto" | "hybrid" | "manual";
}

interface Props {
  patient: Patient;
  draft: ClinicianInputs;
  setField: <K extends keyof ClinicianInputs>(k: K, v: ClinicianInputs[K]) => void;
}

/** Compute EMR-derived defaults for HAS-BLED items (with origin info). */
function emrDerive(p: Patient) {
  const out: Partial<Record<keyof HasBledInputs, boolean>> = {};
  const fromEmr: Partial<Record<keyof HasBledInputs, true>> = {};

  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(p.vitals?.bp_latest ?? "");
  if (m) {
    out.hypertension = Number(m[1]) > 160;
    fromEmr.hypertension = true;
  }
  if (p.labs?.creatinine != null) {
    out.abnormalRenal = p.labs.creatinine >= 200;
    fromEmr.abnormalRenal = true;
  }
  if (typeof p.comorbidities?.stroke === "boolean") {
    out.stroke = p.comorbidities.stroke;
    fromEmr.stroke = true;
  }
  if (typeof p.age === "number") {
    out.elderly = p.age > 65;
    fromEmr.elderly = true;
  }
  const inr = p.labs?.inr_history ?? [];
  if (inr.length >= 3) {
    const inRange = inr.filter((v) => v >= 2 && v <= 3).length;
    out.labileINR = inRange / inr.length < 0.6;
    fromEmr.labileINR = true;
  }
  const meds = p.medications ?? [];
  if (meds.some((md) => /aspirin|clopidogrel|nsaid|ibuprofen|naproxen/i.test(md.name))) {
    out.drugs = true;
    fromEmr.drugs = true;
  }
  return { out, fromEmr };
}

export function HasBledCalculator({ patient, draft, setField }: Props) {
  const { out: emr, fromEmr } = useMemo(() => emrDerive(patient), [patient]);

  // Map of HAS-BLED key -> resolved value & source
  type HBKey = keyof HasBledInputs;
  const draftKey: Record<HBKey, keyof ClinicianInputs> = {
    hypertension: "hb_hypertension",
    abnormalRenal: "hb_abnormalRenal",
    stroke: "hb_stroke",
    labileINR: "hb_labileINR",
    elderly: "hb_elderly",
    drugs: "hb_drugs",
    abnormalLiver: "abnormalLiver",
    bleedingHistory: "bleedingHistory",
    alcohol: "alcohol",
  };

  const resolved: Record<HBKey, { value: boolean; source: "emr" | "manual" | "default" }> = {} as never;
  (Object.keys(draftKey) as HBKey[]).forEach((k) => {
    const dk = draftKey[k];
    const dv = draft[dk] as boolean | undefined;
    if (dv !== undefined) {
      resolved[k] = { value: dv, source: "manual" };
    } else if (fromEmr[k]) {
      resolved[k] = { value: emr[k] ?? false, source: "emr" };
    } else {
      resolved[k] = { value: false, source: "default" };
    }
  });

  const inputs: HasBledInputs = {
    hypertension: resolved.hypertension.value,
    abnormalRenal: resolved.abnormalRenal.value,
    abnormalLiver: resolved.abnormalLiver.value,
    stroke: resolved.stroke.value,
    bleedingHistory: resolved.bleedingHistory.value,
    labileINR: resolved.labileINR.value,
    elderly: resolved.elderly.value,
    drugs: resolved.drugs.value,
    alcohol: resolved.alcohol.value,
  };
  const score = hasBled(inputs);

  const anyManual = Object.values(resolved).some((r) => r.source === "manual");
  const anyEmr = Object.values(resolved).some((r) => r.source === "emr");
  const source: HasBledState["source"] = anyManual
    ? anyEmr
      ? "hybrid"
      : "manual"
    : "auto";

  const ITEMS: { key: HBKey; label: string }[] = [
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

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">HAS-BLED (hybrid · live)</h3>
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

      <p className="mb-2 text-[11px] font-medium">
        {source === "auto"
          ? "✅ Auto-prefilled from EMR — please confirm clinical items"
          : source === "hybrid"
            ? "🟡 Updated by clinician"
            : "✏️ Manually entered"}
      </p>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ITEMS.map((it) => {
          const r = resolved[it.key];
          const ring =
            r.source === "manual"
              ? "border-primary/60 bg-primary/5"
              : r.source === "emr"
                ? "border-[var(--clinical-ok)]/60 bg-[var(--clinical-ok-bg)]/30"
                : "border-border";
          const Icon =
            r.source === "manual"
              ? PencilLine
              : r.source === "emr"
                ? CheckCircle2
                : Info;
          const iconClass =
            r.source === "manual"
              ? "text-primary"
              : r.source === "emr"
                ? "text-[var(--clinical-ok)]"
                : "text-muted-foreground";
          return (
            <div
              key={it.key}
              className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs ${ring}`}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon className={`size-3 shrink-0 ${iconClass}`} />
                <span className="truncate">{it.label}</span>
              </div>
              <div className="flex gap-1">
                <Pill
                  active={r.value === true}
                  onClick={() => setField(draftKey[it.key], true)}
                >
                  Yes
                </Pill>
                <Pill
                  active={r.value === false}
                  onClick={() => setField(draftKey[it.key], false)}
                >
                  No
                </Pill>
              </div>
            </div>
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

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
