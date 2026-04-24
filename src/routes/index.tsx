import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  listPatients,
  getPatientWithCdss,
  logAction,
  getAuditLog,
} from "@/cdss/server.functions";
import type { ClinicianAction } from "@/cdss/types";
import { AlertCard } from "@/components/cdss/AlertCard";
import { HasBledCalculator } from "@/components/cdss/HasBledCalculator";
import { Heart, Activity, FlaskConical, Pill, User, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [patients, audit] = await Promise.all([
      listPatients(),
      getAuditLog(),
    ]);
    const first = await getPatientWithCdss({
      data: { patient_id: patients[0].patient_id },
    });
    return { patients, audit, current: first };
  },
  component: CdssApp,
});

function CdssApp() {
  const { patients, audit, current } = Route.useLoaderData();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(current.patient.patient_id);
  const [data, setData] = useState(current);
  const [showAudit, setShowAudit] = useState(false);

  const selectPatient = async (id: string) => {
    setSelectedId(id);
    const next = await getPatientWithCdss({ data: { patient_id: id } });
    setData(next);
  };

  const handleAction = async (
    alertId: string,
    alertTitle: string,
    action: ClinicianAction,
    override?: { reason: string; notes?: string },
  ) => {
    await logAction({
      data: {
        patient_id: data.patient.patient_id,
        alert_id: alertId,
        alert_title: alertTitle,
        action,
        override_reason: override?.reason,
        override_notes: override?.notes,
      },
    });
    router.invalidate();
  };

  const { patient, cdss } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-[var(--clinical-alert)]" />
            <div>
              <h1 className="text-base font-bold leading-tight">My HEART:AFCArE</h1>
              <p className="text-xs text-muted-foreground">
                Clinical Decision Support — Atrial Fibrillation
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAudit((s) => !s)}
            className="text-xs"
          >
            <FileText className="mr-1 size-3" />
            Audit log ({audit.length})
          </Button>
        </div>
      </header>

      {/* Patient picker */}
      <nav className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 py-2">
          {patients.map((p) => (
            <button
              key={p.patient_id}
              onClick={() => selectPatient(p.patient_id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                selectedId === p.patient_id
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              {p.patient_id} · {p.name}{" "}
              <span className="text-muted-foreground">
                ({p.clinic_location.replace(" Clinic", "")})
              </span>
            </button>
          ))}
        </div>
      </nav>

      {showAudit && (
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-[1600px] px-4 py-3">
            <h2 className="mb-2 text-sm font-semibold">Audit log</h2>
            {audit.length === 0 ? (
              <p className="text-xs text-muted-foreground">No actions logged yet.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="px-2 py-1">Time</th>
                      <th className="px-2 py-1">Patient</th>
                      <th className="px-2 py-1">Alert</th>
                      <th className="px-2 py-1">Action</th>
                      <th className="px-2 py-1">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="px-2 py-1 font-mono">
                          {new Date(a.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-2 py-1">{a.patient_id}</td>
                        <td className="px-2 py-1">{a.alert_title}</td>
                        <td className="px-2 py-1 font-medium">{a.action}</td>
                        <td className="px-2 py-1 text-muted-foreground">
                          {a.override_reason ?? "—"}
                          {a.override_notes ? ` (${a.override_notes})` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3-column layout */}
      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[260px_1fr_360px]">
        {/* LEFT: demographics */}
        <aside className="space-y-3">
          <Section icon={<User className="size-4" />} title="Patient">
            <Row k="ID" v={patient.patient_id} />
            <Row k="Name" v={patient.name} />
            <Row k="Age" v={`${patient.age} y`} />
            <Row k="Sex" v={patient.sex} />
            <Row k="Clinic" v={patient.clinic_location} />
          </Section>
          <Section icon={<Heart className="size-4" />} title="Comorbidities">
            {Object.entries(patient.comorbidities).map(([k, v]) => (
              <Row
                key={k}
                k={k}
                v={
                  <span
                    className={
                      v ? "text-foreground font-medium" : "text-muted-foreground"
                    }
                  >
                    {v ? "Yes" : "No"}
                  </span>
                }
              />
            ))}
          </Section>
          <Section icon={<FileText className="size-4" />} title="Diagnoses">
            <ul className="space-y-1">
              {patient.diagnoses.map((d) => (
                <li
                  key={d}
                  className="rounded bg-muted px-2 py-1 font-mono text-xs"
                >
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              ECG: {patient.ecg_results.join(", ")}
            </p>
          </Section>
        </aside>

        {/* CENTER: clinical data */}
        <section className="space-y-3">
          <Section icon={<Activity className="size-4" />} title="Vitals">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="BP latest" value={patient.vitals.bp_latest ?? "—"} />
              <Stat label="BP previous" value={patient.vitals.bp_second ?? "—"} />
              <Stat
                label="Weight"
                value={patient.vitals.weight ? `${patient.vitals.weight} kg` : "—"}
              />
            </div>
          </Section>

          <Section icon={<FlaskConical className="size-4" />} title="Labs">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="Creatinine"
                value={
                  patient.labs.creatinine
                    ? `${patient.labs.creatinine} ${patient.labs.creatinine_unit}`
                    : "—"
                }
              />
              <Stat
                label="HbA1c"
                value={patient.labs.hba1c ? `${patient.labs.hba1c}%` : "—"}
              />
              <Stat
                label="ClCr (CG)"
                value={
                  cdss.scores.clcr ? `${cdss.scores.clcr} mL/min` : "insufficient"
                }
              />
              <Stat
                label="CHA₂DS₂-VASc"
                value={cdss.scores.cha2ds2vasc?.total ?? "—"}
              />
            </div>
            {patient.labs.inr_history && patient.labs.inr_history.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">INR history</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {patient.labs.inr_history.map((v, i) => {
                    const inRange = v >= 2 && v <= 3;
                    return (
                      <span
                        key={i}
                        className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                          inRange
                            ? "bg-[var(--clinical-ok-bg)] text-[var(--clinical-ok)]"
                            : "bg-[var(--clinical-alert-bg)] text-[var(--clinical-alert)]"
                        }`}
                      >
                        {v}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>

          <Section icon={<Pill className="size-4" />} title="Medications">
            <ul className="space-y-1.5">
              {patient.medications.map((m) => (
                <li
                  key={m.name}
                  className="flex items-start justify-between rounded border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <div>
                    <span className="font-medium">{m.name}</span>
                    {m.dose && (
                      <span className="ml-2 text-muted-foreground">{m.dose}</span>
                    )}
                  </div>
                  {m.indication && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.indication}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          {cdss.scores.cha2ds2vasc && (
            <Section icon={<Heart className="size-4" />} title="CHA₂DS₂-VASc breakdown">
              <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
                {Object.entries(cdss.scores.cha2ds2vasc.breakdown).map(([k, v]) => (
                  <div
                    key={k}
                    className={`flex items-center justify-between rounded px-2 py-1 ${
                      v > 0 ? "bg-muted font-medium" : "text-muted-foreground"
                    }`}
                  >
                    <span>{k}</span>
                    <span>+{v}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <HasBledCalculator />
        </section>

        {/* RIGHT: sticky alert panel */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-sm font-bold">Combined Clinical Alert Panel</h2>
              <p className="text-xs text-muted-foreground">
                {cdss.executed
                  ? cdss.hasAF
                    ? `${cdss.alerts.length} alert(s) · ${cdss.reminders.length} reminder(s)`
                    : "AF not detected"
                  : "CDSS not executed"}
              </p>
            </div>
            <div className="space-y-2 p-3">
              {!cdss.executed && (
                <EmptyNote>
                  {cdss.reason ?? "CDSS only runs in the Cardiology Clinic."}
                </EmptyNote>
              )}
              {cdss.executed && !cdss.hasAF && (
                <EmptyNote>{cdss.reason}</EmptyNote>
              )}
              {cdss.alerts.length === 0 &&
                cdss.reminders.length === 0 &&
                cdss.executed &&
                cdss.hasAF && (
                  <EmptyNote>No alerts triggered. Patient within targets.</EmptyNote>
                )}

              {cdss.alerts.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--clinical-alert)]">
                    🔴 Alerts
                  </p>
                  <div className="space-y-2">
                    {cdss.alerts.map((al) => (
                      <AlertCard
                        key={al.id}
                        alert={al}
                        onAction={(action, override) =>
                          handleAction(al.id, al.title, action, override)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {cdss.reminders.length > 0 && (
                <div>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--clinical-warn)]">
                    🟡 Reminders
                  </p>
                  <div className="space-y-2">
                    {cdss.reminders.map((al) => (
                      <AlertCard
                        key={al.id}
                        alert={al}
                        onAction={(action, override) =>
                          handleAction(al.id, al.title, action, override)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

// ---------- presentational helpers ----------
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-1 text-xs last:border-0">
      <span className="capitalize text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
