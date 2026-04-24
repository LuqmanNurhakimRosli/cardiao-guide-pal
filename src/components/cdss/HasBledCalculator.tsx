import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { hasBled, type HasBledInputs } from "@/cdss/engine";

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

const empty: HasBledInputs = {
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

export function HasBledCalculator({
  onScoreChange,
}: {
  onScoreChange?: (total: number, highRisk: boolean) => void;
}) {
  const [v, setV] = useState<HasBledInputs>(empty);
  const score = useMemo(() => hasBled(v), [v]);

  // notify parent
  useMemo(() => {
    onScoreChange?.(score.total, score.highRisk);
  }, [score.total, score.highRisk, onScoreChange]);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">HAS-BLED (manual)</h3>
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
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <label
            key={it.key}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/60"
          >
            <Checkbox
              checked={v[it.key]}
              onCheckedChange={(c) =>
                setV((s) => ({ ...s, [it.key]: c === true }))
              }
            />
            {it.label}
          </label>
        ))}
      </div>
      {score.highRisk && (
        <p className="mt-2 text-xs font-medium text-[var(--clinical-alert)]">
          High bleeding risk — review modifiable factors (not a contraindication
          to anticoagulation).
        </p>
      )}
    </div>
  );
}
