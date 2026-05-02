import { useMemo } from "react";
import type { Patient } from "@/cdss/types";
import type { ClinicianInputs } from "@/cdss/usePatientState";
import { Input } from "@/components/ui/input";
import { CheckCircle2, PencilLine, AlertTriangle, Info } from "lucide-react";

type Sex = "male" | "female";

export interface Cha2VascState {
  total: number;
  source: "auto" | "hybrid" | "manual";
  complete: boolean;
  highRisk: boolean;
  threshold: string;
}

interface Props {
  patient: Patient; // raw EMR patient
  draft: ClinicianInputs;
  setField: <K extends keyof ClinicianInputs>(k: K, v: ClinicianInputs[K]) => void;
}

/**
 * Resolve a field's effective value + source.
 * - If clinician edited it → "manual"
 * - Else if EMR has it → "emr"
 * - Else → undefined (missing)
 */
function resolve<T>(
  emrVal: T | undefined,
  draftVal: T | undefined,
): { value: T | undefined; source: "emr" | "manual" | "missing" } {
  if (draftVal !== undefined && draftVal !== null) {
    return { value: draftVal, source: "manual" };
  }
  if (emrVal !== undefined && emrVal !== null) {
    return { value: emrVal, source: "emr" };
  }
  return { value: undefined, source: "missing" };
}

export function Cha2ds2VascHybrid({ patient, draft, setField }: Props) {
  const c = patient.comorbidities ?? {};

  const chf = resolve<boolean>(c.chf, draft.chf);
  const htn = resolve<boolean>(c.hypertension, draft.hypertension);
  const dm = resolve<boolean>(c.diabetes, draft.diabetes);
  const stroke = resolve<boolean>(c.stroke, draft.stroke);
  const vasc = resolve<boolean>(c.vascular, draft.vascular);
  const age = resolve<number>(patient.age, draft.age);
  const sex = resolve<Sex>(patient.sex, draft.sex);

  const fields = [chf, htn, dm, stroke, vasc, age, sex];
  const complete = fields.every((f) => f.value !== undefined);
  const anyManual = fields.some((f) => f.source === "manual");
  const allManual = fields.every((f) => f.source === "manual");

  const totals = useMemo(() => {
    const breakdown: Record<string, number> = {
      CHF: chf.value ? 1 : 0,
      Hypertension: htn.value ? 1 : 0,
      "Age ≥75": age.value !== undefined && age.value >= 75 ? 2 : 0,
      "Age 65–74":
        age.value !== undefined && age.value >= 65 && age.value < 75 ? 1 : 0,
      Diabetes: dm.value ? 1 : 0,
      "Stroke/TIA": stroke.value ? 2 : 0,
      "Vascular disease": vasc.value ? 1 : 0,
      Female: sex.value === "female" ? 1 : 0,
    };
    return {
      breakdown,
      total: Object.values(breakdown).reduce((s, v) => s + v, 0),
    };
  }, [chf.value, htn.value, age.value, dm.value, stroke.value, vasc.value, sex.value]);

  const source: Cha2VascState["source"] = !complete
    ? "hybrid"
    : anyManual
      ? allManual
        ? "manual"
        : "hybrid"
      : "auto";

  const threshold = sex.value === "female" ? "≥3" : "≥2";
  const highRisk =
    complete &&
    ((sex.value === "male" && totals.total >= 2) ||
      (sex.value === "female" && totals.total >= 3));

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">CHA₂DS₂-VASc (hybrid · live)</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${
            highRisk
              ? "bg-[var(--clinical-alert-bg)] text-[var(--clinical-alert)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Score: {totals.total}
          {!complete && " *"}
        </span>
      </div>

      <SourceLabel source={source} complete={complete} />

      {!complete && (
        <div className="mb-2 flex items-start gap-1.5 rounded border border-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)] px-2 py-1.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-warn)]" />
          <span>
            <strong>Incomplete data.</strong> Score below assumes "No" for missing
            fields — confirm each before saving.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <YesNoField
          label="CHF / LV dysfunction"
          value={chf.value}
          source={chf.source}
          onChange={(v) => setField("chf", v)}
        />
        <YesNoField
          label="Hypertension"
          value={htn.value}
          source={htn.source}
          onChange={(v) => setField("hypertension", v)}
        />
        <NumField
          label="Age (years)"
          value={age.value}
          source={age.source}
          onChange={(v) => setField("age", v)}
        />
        <YesNoField
          label="Diabetes"
          value={dm.value}
          source={dm.source}
          onChange={(v) => setField("diabetes", v)}
        />
        <YesNoField
          label="Stroke / TIA"
          value={stroke.value}
          source={stroke.source}
          onChange={(v) => setField("stroke", v)}
        />
        <YesNoField
          label="Vascular disease"
          value={vasc.value}
          source={vasc.source}
          onChange={(v) => setField("vascular", v)}
        />
        <SexField
          value={sex.value}
          source={sex.source}
          onChange={(v) => setField("sex", v)}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] sm:grid-cols-4">
        {Object.entries(totals.breakdown).map(([k, v]) => (
          <div
            key={k}
            className={`flex items-center justify-between rounded px-1.5 py-0.5 ${
              v > 0 ? "bg-muted font-medium" : "text-muted-foreground"
            }`}
          >
            <span>{k}</span>
            <span>+{v}</span>
          </div>
        ))}
      </div>

      {highRisk && (
        <p className="mt-2 text-xs font-medium text-[var(--clinical-alert)]">
          Score {totals.total} ({threshold} threshold) — anticoagulation
          indicated for stroke prevention.
        </p>
      )}

      <p className="mt-2 flex items-start gap-1 text-[10px] italic text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" />
        This calculation supports clinical decision-making and does not replace
        clinician judgement.
      </p>
    </div>
  );
}

function SourceLabel({
  source,
  complete,
}: {
  source: Cha2VascState["source"];
  complete: boolean;
}) {
  if (!complete) {
    return (
      <p className="mb-2 text-[11px] font-medium text-[var(--clinical-warn)]">
        ✏️ Awaiting clinician input
      </p>
    );
  }
  const label =
    source === "auto"
      ? "✅ Auto-calculated from EMR data"
      : source === "manual"
        ? "✏️ Fully completed by clinician"
        : "🟡 Updated by clinician";
  return <p className="mb-2 text-[11px] font-medium">{label}</p>;
}

function FieldChrome({
  label,
  source,
  children,
}: {
  label: string;
  source: "emr" | "manual" | "missing";
  children: React.ReactNode;
}) {
  const ring =
    source === "missing"
      ? "border-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)]/40"
      : source === "emr"
        ? "border-[var(--clinical-ok)]/60 bg-[var(--clinical-ok-bg)]/30"
        : "border-primary/60 bg-primary/5";
  const Icon =
    source === "missing"
      ? AlertTriangle
      : source === "emr"
        ? CheckCircle2
        : PencilLine;
  const iconClass =
    source === "missing"
      ? "text-[var(--clinical-warn)]"
      : source === "emr"
        ? "text-[var(--clinical-ok)]"
        : "text-primary";
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs ${ring}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className={`size-3 shrink-0 ${iconClass}`} />
        <span className="truncate">{label}</span>
      </div>
      {children}
    </div>
  );
}

function YesNoField({
  label,
  value,
  source,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  source: "emr" | "manual" | "missing";
  onChange: (v: boolean) => void;
}) {
  return (
    <FieldChrome label={label} source={source}>
      <div className="flex gap-1">
        <Pill active={value === true} onClick={() => onChange(true)}>
          Yes
        </Pill>
        <Pill active={value === false} onClick={() => onChange(false)}>
          No
        </Pill>
      </div>
    </FieldChrome>
  );
}

function NumField({
  label,
  value,
  source,
  onChange,
}: {
  label: string;
  value: number | undefined;
  source: "emr" | "manual" | "missing";
  onChange: (v: number) => void;
}) {
  return (
    <FieldChrome label={label} source={source}>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n) && e.target.value !== "") onChange(n);
        }}
        className="h-6 w-16 px-1 py-0 text-xs"
      />
    </FieldChrome>
  );
}

function SexField({
  value,
  source,
  onChange,
}: {
  value: Sex | undefined;
  source: "emr" | "manual" | "missing";
  onChange: (v: Sex) => void;
}) {
  return (
    <FieldChrome label="Sex" source={source}>
      <div className="flex gap-1">
        <Pill active={value === "male"} onClick={() => onChange("male")}>
          Male
        </Pill>
        <Pill active={value === "female"} onClick={() => onChange("female")}>
          Female
        </Pill>
      </div>
    </FieldChrome>
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
