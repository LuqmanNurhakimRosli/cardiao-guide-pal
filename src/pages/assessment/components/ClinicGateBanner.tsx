import { Ban } from "lucide-react";

export function ClinicGateBanner({
  clinic,
  reason,
}: {
  clinic: string;
  reason?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--clinical-alert)]/50 bg-[var(--clinical-alert-bg)] p-4">
      <div className="flex items-start gap-2">
        <Ban className="mt-0.5 size-5 shrink-0 text-[var(--clinical-alert)]" />
        <div>
          <h3 className="text-sm font-bold text-[var(--clinical-alert)]">
            AF-CDSS Not Applicable
          </h3>
          <p className="mt-1 text-xs">
            This patient's clinic (<strong>{clinic}</strong>) is not part of the
            AF-CDSS deployment scope. No calculations executed and no alerts
            generated for this encounter.
          </p>
          {reason && (
            <p className="mt-1 text-[11px] text-muted-foreground">{reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
