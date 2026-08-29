import { useState } from "react";
import { AppShell } from "@/shared/components/layout/AppShell";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Download,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  User,
  ShieldCheck,
} from "lucide-react";
import type { PatientSummary, AuditEntry } from "@/shared/cdss/types";

interface AuditPageProps {
  patients: PatientSummary[];
  audit: AuditEntry[];
  selectedId?: string;
}

export function AuditPage({ patients, audit, selectedId }: AuditPageProps) {
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = audit.filter((entry: AuditEntry) => {
    if (patientFilter !== "all" && entry.patient_id !== patientFilter) return false;
    if (actionFilter !== "all" && entry.action !== actionFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        entry.patient_id.toLowerCase().includes(q) ||
        (entry.mrn ?? "").toLowerCase().includes(q) ||
        entry.alert_title.toLowerCase().includes(q) ||
        (entry.override_reason ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const exportCSV = () => {
    const headers = [
      "ID",
      "Timestamp",
      "Patient_ID",
      "MRN",
      "Visit_ID",
      "Clinician_ID",
      "Alert_ID",
      "Alert_Title",
      "Action",
      "Override_Reason_Code",
      "Override_Reason",
      "Override_Notes",
      "Defer_Until",
      "Med_Change_Drug",
      "Med_Change_NewDose",
      "CHA2DS2_VA",
      "HAS_BLED",
      "CrCl_mL_min",
      "PINRR_pct",
      "Research_Window",
      "Engine_Version",
      "Rule_Version",
    ];

    const rows = filtered.map((a: AuditEntry) => [
      `"${a.id}"`,
      `"${a.timestamp}"`,
      `"${a.patient_id}"`,
      `"${a.mrn ?? ""}"`,
      `"${a.visit_id ?? ""}"`,
      `"${a.clinician_id ?? ""}"`,
      `"${a.alert_id}"`,
      `"${(a.alert_title || "").replace(/"/g, '""')}"`,
      `"${a.action}"`,
      `"${a.override_reason_code ?? ""}"`,
      `"${(a.override_reason ?? "").replace(/"/g, '""')}"`,
      `"${(a.override_notes ?? "").replace(/"/g, '""')}"`,
      `"${a.defer_until ?? ""}"`,
      `"${a.med_change?.name ?? ""}"`,
      `"${a.med_change?.new_dose ?? ""}"`,
      `"${a.snapshot?.cha2ds2va ?? a.snapshot?.cha2ds2vasc ?? ""}"`,
      `"${a.snapshot?.hasbled ?? ""}"`,
      `"${a.snapshot?.clcr ?? ""}"`,
      `"${a.snapshot?.pinrr ?? ""}"`,
      `"${a.research_window ?? ""}"`,
      `"${a.engine_version ?? ""}"`,
      `"${a.rule_version ?? ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `cdss_audit_dataset_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell selectedId={selectedId}>
      <div className="mx-auto max-w-7xl px-3 sm:px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Clinical Audit Trail & Decision Log
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Traceable, immutable record of CDSS evaluations, clinician decisions, and research
              snapshots.
            </p>
          </div>
          <Button
            onClick={exportCSV}
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8 shadow-2xs self-start sm:self-auto"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" /> Export Research CSV
          </Button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-card p-3 text-xs shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-foreground shrink-0">
            <Filter className="size-3.5 text-primary" /> Filters:
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Patient:</span>
            <select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground outline-none shadow-2xs"
            >
              <option value="all">All Patients ({patients.length})</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.patient_id} ({p.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground outline-none shadow-2xs"
            >
              <option value="all">All Actions</option>
              <option value="accept">Accept</option>
              <option value="override">Override</option>
              <option value="defer">Defer</option>
            </select>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search alert, patient ID, reason…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground bg-card">
            No audit records match the selected filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left border-b border-border font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-3 py-3">Patient / MRN</th>
                    <th className="px-3 py-3">Alert Description</th>
                    <th className="px-3 py-3">Action Taken</th>
                    <th className="px-3 py-3">Clinical Details / Override Reason</th>
                    <th className="px-3 py-3">Window</th>
                    <th className="px-4 py-3">Clinician</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((a: AuditEntry) => (
                    <tr key={a.id} className="align-top hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                        {new Date(a.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-bold text-primary font-mono">{a.patient_id}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {a.mrn ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3 min-w-[200px]">
                        <div className="font-semibold text-foreground">{a.alert_title}</div>
                        {a.snapshot?.cha2ds2va != null && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            CHA₂DS₂-VA: {a.snapshot.cha2ds2va} · CrCl: {a.snapshot.clcr ?? "—"}{" "}
                            mL/min
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            a.action === "accept"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : a.action === "override"
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {a.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground min-w-[220px]">
                        {a.override_reason && (
                          <div className="font-semibold text-foreground">
                            Reason: {a.override_reason}
                          </div>
                        )}
                        {a.override_notes && (
                          <div className="text-[11px] mt-0.5 leading-relaxed">
                            Notes: {a.override_notes}
                          </div>
                        )}
                        {a.defer_until && (
                          <div className="text-[11px] font-mono font-semibold text-amber-600">
                            Deferred until: {a.defer_until}
                          </div>
                        )}
                        {a.med_change && (
                          <div className="text-[11px] font-bold text-primary font-mono">
                            Prescription: {a.med_change.name} → {a.med_change.new_dose}
                          </div>
                        )}
                        {!a.override_reason &&
                          !a.override_notes &&
                          !a.defer_until &&
                          !a.med_change &&
                          "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-muted-foreground">
                          {a.research_window ?? "index"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {a.clinician_id ?? "DR-CAR-01"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
