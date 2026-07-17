import { Info } from "lucide-react";
import type { CdssAlert } from "@/cdss/types";

/**
 * Missing data reminders — displayed separately from clinical alerts
 * (Stage 13 of the AF-CDSS workflow).
 */
export function MissingDataCard({ reminders }: { reminders: CdssAlert[] }) {
  const missing = reminders.filter((r) => r.category === "data");
  if (missing.length === 0) return null;
  return (
    <div className="rounded-md border border-[var(--clinical-warn)]/40 bg-[var(--clinical-warn-bg)]/40 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--clinical-warn)]">
        <Info className="size-4" /> Monitoring Reminders
      </h3>
      <ul className="space-y-1">
        {missing.map((r) => (
          <li
            key={r.id}
            className="rounded border border-border bg-card px-2 py-1.5 text-xs"
          >
            <p className="font-medium">{r.title}</p>
            {r.detail && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {r.detail}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] italic text-muted-foreground">
        Arrange monitoring to complete the clinical picture.
      </p>
    </div>
  );
}
