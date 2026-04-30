import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  listPatients,
  getPatientWithCdss,
} from "@/cdss/server.functions";
import { AppShell } from "@/components/cdss/AppShell";
import { HasBledCalculator } from "@/components/cdss/HasBledCalculator";
import { Heart, Activity, FlaskConical, Pill, User, FileText, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ deps }) => {
    const patients = await listPatients();
    const patient_id = deps.p ?? patients[0].patient_id;
    const current = await getPatientWithCdss({ data: { patient_id } });
    return { patients, current };
  },
  component: PatientDashboard,
});

function PatientDashboard() {
  const { patients, current } = Route.useLoaderData();
  const { patient, cdss } = current;

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-[1600px] grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[260px_1fr_360px]">
        {/* LEFT */}
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
                  <span className={v ? "font-medium" : "text-muted-foreground"}>
                    {v ? "Yes" : "No"}
                  </span>
                }
              />
            ))}
          </Section>
          <Section icon={<FileText className="size-4" />} title="Diagnoses">
            <ul className="space-y-1">
              {patient.diagnoses.map((d) => (
                <li key={d} className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              ECG: {patient.ecg_results.join(", ")}
            </p>
          </Section>
        </aside>

        {/* CENTER */}
        <section className="space-y-3">
          <div className="rounded-md border border-dashed border-[var(--clinical-ok)] bg-[var(--clinical-ok-bg)]/40 px-3 py-2 text-xs">
            <span className="font-semibold text-[var(--clinical-ok)]">
              CDSS engine running in background
            </span>
            {" — "}
            triggered automatically because{" "}
            <span className="font-mono">clinic = {patient.clinic_location}</span>.
          </div>

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
                value={cdss.scores.clcr ? `${cdss.scores.clcr} mL/min` : "insufficient"}
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
                    const ok = v >= 2 && v <= 3;
                    return (
                      <span
                        key={i}
                        className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                          ok
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

        {/* RIGHT panel */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-sm font-bold">Combined Clinical Alert Panel</h2>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                CDSS Recommendation (Advisory Only)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cdss.executed
                  ? cdss.hasAF
                    ? `${cdss.alerts.length} alert(s) · ${cdss.reminders.length} reminder(s)`
                    : "AF not detected"
                  : "CDSS not executed"}
              </p>
            </div>
            <div className="space-y-2 p-3">
              {!cdss.executed && (
                <EmptyNote>{cdss.reason ?? "Cardiology Clinic only."}</EmptyNote>
              )}
              {cdss.executed && !cdss.hasAF && <EmptyNote>{cdss.reason}</EmptyNote>}

              {cdss.alerts.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--clinical-alert)]">
                    🔴 Alerts ({cdss.alerts.length})
                  </p>
                  <ul className="space-y-1.5">
                    {cdss.alerts.map((al) => (
                      <li
                        key={al.id}
                        className="rounded border border-l-4 border-border border-l-[var(--clinical-alert)] bg-[var(--clinical-alert-bg)] px-2 py-1.5"
                      >
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-alert)]" />
                          <p className="text-xs font-medium leading-snug">{al.title}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cdss.reminders.length > 0 && (
                <div>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--clinical-warn)]">
                    🟡 Reminders ({cdss.reminders.length})
                  </p>
                  <ul className="space-y-1.5">
                    {cdss.reminders.map((al) => (
                      <li
                        key={al.id}
                        className="rounded border border-l-4 border-border border-l-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)] px-2 py-1.5"
                      >
                        <div className="flex items-start gap-1.5">
                          <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-warn)]" />
                          <p className="text-xs font-medium leading-snug">{al.title}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cdss.executed &&
                cdss.hasAF &&
                cdss.alerts.length === 0 &&
                cdss.reminders.length === 0 && (
                  <EmptyNote>No alerts triggered.</EmptyNote>
                )}

              {(cdss.alerts.length > 0 || cdss.reminders.length > 0) && (
                <Link
                  to="/alerts"
                  search={{ p: patient.patient_id }}
                  className="mt-2 block"
                >
                  <Button className="w-full" size="sm">
                    Review alerts <ArrowRight className="ml-1 size-3" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

// presentational helpers
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
