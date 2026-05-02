import { useMemo, useState } from "react";
import type { Patient } from "@/cdss/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, PencilLine, AlertTriangle, Info } from "lucide-react";

type Sex = "male" | "female";

interface FieldState<T> {
  value: T | undefined;
  source: "emr" | "manual";
}

export interface Cha2VascState {
  total: number;
  source: "auto" | "hybrid" | "manual";
  complete: boolean;
  highRisk: boolean;
  threshold: string;
}

export function Cha2ds2VascHybrid({
  patient,
  onChange,
}: {
  patient: Patient;
  onChange?: (s: Cha2VascState) => void;
}) {
  const c = patient.comorbidities ?? {};

  // Detect from EMR. A value is "from EMR" when explicitly defined.
  const initial = useMemo(
    () => ({
      chf: { value: typeof c.chf === "boolean" ? c.chf : undefined, source: "emr" as const },
      hypertension: {
        value: typeof c.hypertension === "boolean" ? c.hypertension : undefined,
        source: "emr" as const,
      },
      age: { value: typeof patient.age === "number" ? patient.age : undefined, source: "emr" as const },
      diabetes: {
        value: typeof c.diabetes === "boolean" ? c.diabetes : undefined,
        source: "emr" as const,
      },
      stroke: {
        value: typeof c.stroke === "boolean" ? c.stroke : undefined,
        source: "emr" as const,
      },
      vascular: {
        value: typeof c.vascular === "boolean" ? c.vascular : undefined,
        source: "emr" as const,
      },
      sex: { value: patient.sex as Sex | undefined, source: "emr" as const },
    }),
    // patient identity is stable per render of this component instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patient.patient_id],
  );

  const [chf, setChf] = useState<FieldState<boolean>>(initial.chf);
  const [htn, setHtn] = useState<FieldState<boolean>>(initial.hypertension);
  const [age, setAge] = useState<FieldState<number>>(initial.age);
  const [dm, setDm] = useState<FieldState<boolean>>(initial.diabetes);
  const [stroke, setStroke] = useState<FieldState<boolean>>(initial.stroke);
  const [vasc, setVasc] = useState<FieldState<boolean>>(initial.vascular);
  const [sex, setSex] = useState<FieldState<Sex>>(initial.sex);

  const fields = { chf, htn, age, dm, stroke, vasc, sex };

  const complete =
    chf.value !== undefined &&
    htn.value !== undefined &&
    age.value !== undefined &&
    dm.value !== undefined &&
    stroke.value !== undefined &&
    vasc.value !== undefined &&
    sex.value !== undefined;

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
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    return { breakdown, total };
  }, [chf, htn, age, dm, stroke, vasc, sex]);

  const anyManual = Object.values(fields).some((f) => f.source === "manual");
  const source: Cha2VascState["source"] = !complete
    ? "hybrid"
    : anyManual
      ? Object.values(fields).every((f) => f.source === "manual")
        ? "manual"
        : "hybrid"
      : "auto";

  const threshold = sex.value === "female" ? "≥3" : "≥2";
  const highRisk =
    complete &&
    ((sex.value === "male" && totals.total >= 2) ||
      (sex.value === "female" && totals.total >= 3));

  // notify parent (avoid loop: depend only on primitives)
  useMemo(() => {
    onChange?.({
      total: totals.total,
      source,
      complete,
      highRisk,
      threshold,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.total, source, complete, highRisk, threshold]);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">CHA₂DS₂-VASc (hybrid)</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${
            highRisk
              ? "bg-[var(--clinical-alert-bg)] text-[var(--clinical-alert)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Score: {complete ? totals.total : "—"}
        </span>
      </div>

      <SourceLabel source={source} complete={complete} />

      {!complete && (
        <div className="mb-2 flex items-start gap-1.5 rounded border border-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)] px-2 py-1.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-warn)]" />
          <span>
            <strong>Incomplete data detected.</strong> Manual input required for
            highlighted fields.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <BoolField
          label="CHF / LV dysfunction"
          state={chf}
          onChange={(v) => setChf({ value: v, source: "manual" })}
        />
        <BoolField
          label="Hypertension"
          state={htn}
          onChange={(v) => setHtn({ value: v, source: "manual" })}
        />
        <NumField
          label="Age (years)"
          state={age}
          onChange={(v) => setAge({ value: v, source: "manual" })}
        />
        <BoolField
          label="Diabetes"
          state={dm}
          onChange={(v) => setDm({ value: v, source: "manual" })}
        />
        <BoolField
          label="Stroke / TIA"
          state={stroke}
          onChange={(v) => setStroke({ value: v, source: "manual" })}
        />
        <BoolField
          label="Vascular disease"
          state={vasc}
          onChange={(v) => setVasc({ value: v, source: "manual" })}
        />
        <SexField
          state={sex}
          onChange={(v) => setSex({ value: v, source: "manual" })}
        />
      </div>

      {complete && (
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
      )}

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

export function SourceLabel({
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
        : "🟡 Partially completed by clinician";
  return (
    <p
      className="mb-2 text-[11px] font-medium"
      title="This score is partially auto-calculated. Please confirm missing inputs."
    >
      {label}
    </p>
  );
}

function FieldChrome({
  label,
  state,
  children,
}: {
  label: string;
  state: FieldState<unknown>;
  children: React.ReactNode;
}) {
  const isEmr = state.source === "emr" && state.value !== undefined;
  const isMissing = state.value === undefined;
  const ring = isMissing
    ? "border-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)]/40"
    : isEmr
      ? "border-[var(--clinical-ok)]/60 bg-[var(--clinical-ok-bg)]/30"
      : "border-border bg-background";
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs ${ring}`}
    >
      <div className="flex items-center gap-1.5">
        {isMissing ? (
          <PencilLine className="size-3 text-[var(--clinical-warn)]" />
        ) : isEmr ? (
          <CheckCircle2 className="size-3 text-[var(--clinical-ok)]" />
        ) : (
          <PencilLine className="size-3 text-muted-foreground" />
        )}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function BoolField({
  label,
  state,
  onChange,
}: {
  label: string;
  state: FieldState<boolean>;
  onChange: (v: boolean) => void;
}) {
  return (
    <FieldChrome label={label} state={state}>
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1">
          <Checkbox
            checked={state.value === true}
            onCheckedChange={(c) => onChange(c === true)}
          />
          <span className="text-[10px] text-muted-foreground">Yes</span>
        </label>
      </div>
    </FieldChrome>
  );
}

function NumField({
  label,
  state,
  onChange,
}: {
  label: string;
  state: FieldState<number>;
  onChange: (v: number) => void;
}) {
  return (
    <FieldChrome label={label} state={state}>
      <Input
        type="number"
        value={state.value ?? ""}
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
  state,
  onChange,
}: {
  state: FieldState<Sex>;
  onChange: (v: Sex) => void;
}) {
  return (
    <FieldChrome label="Sex" state={state}>
      <div className="flex gap-1 text-[10px]">
        {(["male", "female"] as Sex[]).map((s) => (
          <Label
            key={s}
            className={`cursor-pointer rounded border px-1.5 py-0.5 ${
              state.value === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border"
            }`}
          >
            <input
              type="radio"
              className="hidden"
              checked={state.value === s}
              onChange={() => onChange(s)}
            />
            {s[0].toUpperCase() + s.slice(1)}
          </Label>
        ))}
      </div>
    </FieldChrome>
  );
}
