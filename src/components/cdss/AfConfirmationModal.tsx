import { Button } from "@/components/ui/button";
import type { AfEvidence } from "@/cdss/types";
import { AlertTriangle } from "lucide-react";

/**
 * AF Confirmation nudge (Stage 2 of the AF-CDSS workflow).
 * Shown when AF evidence exists but the clinician has not yet confirmed
 * or rejected the diagnosis.
 */
export function AfConfirmationModal({
  open,
  evidence,
  onConfirm,
  onReject,
}: {
  open: boolean;
  evidence: AfEvidence[];
  onConfirm: () => void;
  onReject: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-5 text-[var(--clinical-warn)]" />
          <h2 className="text-base font-bold">AF Evidence Detected</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          The system found evidence of Atrial Fibrillation from multiple EMR
          sources. Please confirm the diagnosis before proceeding.
        </p>
        <ul className="mb-4 space-y-1 rounded border border-border bg-background p-2">
          {evidence.map((e, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                {e.source}
              </span>
              <span>{e.value}</span>
            </li>
          ))}
        </ul>
        <p className="mb-4 text-[11px] italic text-muted-foreground">
          Rejecting will terminate the CDSS workflow for this encounter.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onReject}>
            Reject AF
          </Button>
          <Button onClick={onConfirm}>Confirm AF</Button>
        </div>
      </div>
    </div>
  );
}
