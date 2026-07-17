import type { AfEvidence } from "@/cdss/types";
import { Activity, FileCode2, Pill, ClipboardList } from "lucide-react";

const ICONS: Record<AfEvidence["source"], React.ReactNode> = {
  "ICD-10": <FileCode2 className="size-3.5" />,
  "ICD-11": <FileCode2 className="size-3.5" />,
  ECG: <Activity className="size-3.5" />,
  Medication: <Pill className="size-3.5" />,
  PMH: <ClipboardList className="size-3.5" />,
};

export function AfEvidenceCard({
  evidence,
  confirmed,
}: {
  evidence: AfEvidence[];
  confirmed: boolean | null;
}) {
  if (evidence.length === 0) return null;
  const label =
    confirmed === true
      ? "✅ AF confirmed by clinician"
      : confirmed === false
        ? "🚫 AF rejected — workflow terminated"
        : "🟡 Awaiting clinician confirmation";
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">AF Evidence (multi-source)</h3>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <ul className="space-y-1">
        {evidence.map((e, i) => (
          <li
            key={`${e.source}-${i}`}
            className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1 text-xs"
          >
            <span className="text-muted-foreground">{ICONS[e.source]}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {e.source}
            </span>
            <span className="truncate">{e.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
