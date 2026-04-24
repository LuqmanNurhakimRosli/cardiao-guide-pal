import { useState } from "react";
import type { CdssAlert, ClinicianAction } from "@/cdss/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, Info, CheckCircle2, Clock } from "lucide-react";

const OVERRIDE_REASONS = [
  "Clinical judgement",
  "Dose already appropriate",
  "Temporary factor",
  "Adherence issue",
  "Other",
];

interface Props {
  alert: CdssAlert;
  onAction: (
    action: ClinicianAction,
    override?: { reason: string; notes?: string },
  ) => Promise<void> | void;
}

export function AlertCard({ alert, onAction }: Props) {
  const [done, setDone] = useState<ClinicianAction | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const isAlert = alert.severity === "alert";
  const Icon = isAlert ? AlertTriangle : Info;

  const submit = async (action: ClinicianAction) => {
    if (action === "override") {
      if (!reason) return;
      await onAction(action, { reason, notes });
    } else {
      await onAction(action);
    }
    setDone(action);
    setOverriding(false);
  };

  const palette = isAlert
    ? "border-l-[var(--clinical-alert)] bg-[var(--clinical-alert-bg)]"
    : "border-l-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)]";
  const iconColor = isAlert
    ? "text-[var(--clinical-alert)]"
    : "text-[var(--clinical-warn)]";

  return (
    <div className={`rounded-md border border-border border-l-4 p-3 ${palette}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {alert.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>

          {alert.rationale.length > 0 && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground">
                <ChevronDown
                  className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
                Why this alert triggered
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 rounded bg-background/60 p-2 text-xs">
                <ul className="list-disc space-y-0.5 pl-4 text-foreground/80">
                  {alert.rationale.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}

          {done ? (
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--clinical-ok)]">
              <CheckCircle2 className="size-3" />
              Logged: {done}
              {done === "override" && reason ? ` — ${reason}` : ""}
            </div>
          ) : overriding ? (
            <div className="mt-2 space-y-2">
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Override reason…" />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reason === "Other" && (
                <Textarea
                  placeholder="Specify reason…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px] text-xs"
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => submit("override")}
                  disabled={!reason}
                >
                  Confirm override
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setOverriding(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => submit("accept")}
              >
                <CheckCircle2 className="mr-1 size-3" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setOverriding(true)}
              >
                Override
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => submit("defer")}
              >
                <Clock className="mr-1 size-3" /> Defer
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
