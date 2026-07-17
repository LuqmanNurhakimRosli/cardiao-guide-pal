import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  getPatientWithCdss,
  logFieldChange,
  logScoreCalculation,
} from "@/cdss/server.functions";
import { usePatientState, type ClinicianInputs } from "@/cdss/usePatientState";
import { AppShell } from "@/components/cdss/AppShell";
import { HasBledCalculator } from "@/components/cdss/HasBledCalculator";
import { Cha2ds2VascHybrid } from "@/components/cdss/Cha2ds2VascHybrid";
import { AfEvidenceCard } from "@/components/cdss/AfEvidenceCard";
import { AfConfirmationModal } from "@/components/cdss/AfConfirmationModal";
import { MissingDataCard } from "@/components/cdss/MissingDataCard";
import { ClinicGateBanner } from "@/components/cdss/ClinicGateBanner";
import {
  Heart,
  Activity,
  FlaskConical,
  Pill,
  User,
  FileText,
  AlertTriangle,
  Info,
  ArrowRight,
  Save,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ p: search.p }),
  loader: async ({ deps }) => {
    if (!deps.p) {
      throw redirect({ to: "/patients" });
    }
    const current = await getPatientWithCdss({ data: { patient_id: deps.p } });
    return { current };
  },
  component: PatientDashboard,
});

const FIELD_LABELS: Partial<Record<keyof ClinicianInputs, string>> = {
  chf: "CHF / LV dysfunction",
  hypertension: "Hypertension",
  diabetes: "Diabetes",
  stroke: "Stroke / TIA",
  vascular: "Vascular disease",
  age: "Age",
  sex: "Sex",
  abnormalLiver: "Abnormal liver",
  bleedingHistory: "Prior bleeding",
  alcohol: "Excess alcohol",
  hb_hypertension: "HAS-BLED Hypertension",
  hb_abnormalRenal: "HAS-BLED Abnormal renal",
  hb_stroke: "HAS-BLED Stroke",
  hb_labileINR: "HAS-BLED Labile INR",
  hb_elderly: "HAS-BLED Elderly",
  hb_drugs: "HAS-BLED Drugs",
};

function PatientDashboard() {
  const { current } = Route.useLoaderData();
  const { patient } = current;

  const state = usePatientState(patient);
  const { draft, inputs, dirty, setField, reset, saveAndRecalculate, draftCdss, cdss, loading, error, source } = state;

  const logField = useServerFn(logFieldChange);
  const logScore = useServerFn(logScoreCalculation);
  const [saveFlash, setSaveFlash] = useState(false);

  const handleSave = async () => {
    // diff before saving
    const before = inputs;
    const after = draft;
    const changedKeys: (keyof ClinicianInputs)[] = [];
    (Object.keys(after) as (keyof ClinicianInputs)[]).forEach((k) => {
      if (k === "_lastSavedAt") return;
      if (before[k] !== after[k]) changedKeys.push(k);
    });

    saveAndRecalculate();

    // log each field change
    await Promise.all(
      changedKeys.map((k) =>
        logField({
          data: {
            patient_id: patient.patient_id,
            field: FIELD_LABELS[k] ?? String(k),
            old_value: String(before[k] ?? "—"),
            new_value: String(after[k] ?? "—"),
          },
        }).catch(() => {}),
      ),
    );

    // log final scores
    if (draftCdss.scores.cha2ds2vasc) {
      const s = draftCdss.scores.cha2ds2vasc;
      const highRisk =
        (patient.sex === "male" && s.total >= 2) ||
        (patient.sex === "female" && s.total >= 3);
      logScore({
        data: {
          patient_id: patient.patient_id,
          score_name: "CHA2DS2-VASc",
          total: s.total,
          source: changedKeys.length ? "hybrid" : "auto",
          high_risk: highRisk,
        },
      }).catch(() => {});
    }

    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  // safety: incomplete CHA inputs?
  const incompleteCha = useMemo(() => {
    const c = patient.comorbidities ?? {};
    const checks: (boolean | undefined)[] = [
      draft.chf ?? c.chf,
      draft.hypertension ?? c.hypertension,
      draft.diabetes ?? c.diabetes,
      draft.stroke ?? c.stroke,
      draft.vascular ?? c.vascular,
    ];
    return checks.some((v) => v === undefined || v === null);
  }, [draft, patient.comorbidities]);

  // Use draft CDSS for live preview in panel
  const livecdss = draftCdss;

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
          <Section icon={<Heart className="size-4" />} title="Comorbidities (EMR)">
            {Object.entries(patient.comorbidities).map(([k, v]) => (
              <Row
                key={k}
                k={k}
                v={
                  <span className={v ? "font-medium" : "text-muted-foreground"}>
                    {v === undefined ? "—" : v ? "Yes" : "No"}
                  </span>
                }
              />
            ))}
          </Section>
          <Section icon={<FileText className="size-4" />} title="Diagnoses">
            <ul className="space-y-1">
              {patient.diagnoses.map((d: string) => (
                <li key={d} className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              ECG: {patient.ecg_results.join(", ")}
            </p>
          </Section>

          {inputs._lastSavedAt && (
            <div className="rounded-md border border-[var(--clinical-ok)]/40 bg-[var(--clinical-ok-bg)]/40 px-3 py-2 text-[11px]">
              <p className="font-medium text-[var(--clinical-ok)]">
                Session saved
              </p>
              <p className="text-muted-foreground">
                {new Date(inputs._lastSavedAt).toLocaleString()}
              </p>
              <p className="mt-1 text-muted-foreground">
                Restored automatically on refresh.
              </p>
            </div>
          )}
        </aside>

        {/* CENTER */}
        <section className="space-y-3">
          <div className="rounded-md border border-dashed border-[var(--clinical-ok)] bg-[var(--clinical-ok-bg)]/40 px-3 py-2 text-xs">
            <span className="font-semibold text-[var(--clinical-ok)]">
              CDSS engine running live
            </span>
            {" — "}
            scores and alerts re-evaluate on every input change.
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
                value={livecdss.scores.clcr ? `${livecdss.scores.clcr} mL/min` : "insufficient"}
              />
              <Stat
                label="CHA₂DS₂-VASc"
                value={livecdss.scores.cha2ds2vasc?.total ?? "—"}
              />
            </div>
          </Section>

          <Section icon={<Pill className="size-4" />} title="Medications">
            <ul className="space-y-1.5">
              {patient.medications.map((m: import("@/cdss/types").Medication) => (
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

          <Cha2ds2VascHybrid
            patient={patient}
            draft={draft}
            setField={setField}
          />

          <HasBledCalculator
            patient={patient}
            draft={draft}
            setField={setField}
          />

          {/* Save & Recalculate */}
          <div className="sticky bottom-2 z-10 rounded-md border border-border bg-card/95 p-3 shadow-md backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {dirty
                    ? "🟡 Unsaved clinician input"
                    : saveFlash
                      ? "✅ Saved & CDSS recalculated"
                      : "All changes saved"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Saving recalculates all scores, re-runs the alert engine, and
                  writes to the audit log. Inputs persist on refresh.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  disabled={!dirty}
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!dirty}>
                  <Save className="mr-1 size-3" /> Save & Recalculate
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT panel */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-md border border-border bg-card">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-sm font-bold">Combined Clinical Alert Panel</h2>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {loading ? "⏳ Calling CDSS API…" : `Live · API source: ${source}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {livecdss.executed
                  ? livecdss.hasAF
                    ? `${livecdss.alerts.length} alert(s) · ${livecdss.reminders.length} reminder(s)`
                    : "AF not detected"
                  : "CDSS not executed"}
              </p>
              {error && (
                <p className="mt-1 rounded border border-[var(--clinical-alert)] bg-[var(--clinical-alert-bg)] px-2 py-1 text-[10px] font-medium text-[var(--clinical-alert)]">
                  ⚠ CDSS engine unavailable — showing last known result. ({error})
                </p>
              )}
              {dirty && (
                <p className="mt-1 text-[10px] font-medium text-[var(--clinical-warn)]">
                  Showing draft — save to commit to audit trail.
                </p>
              )}
            </div>
            <div className="space-y-2 p-3">
              {incompleteCha && (
                <div className="flex items-start gap-1.5 rounded border border-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)] px-2 py-1.5 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-warn)]" />
                  <span>
                    <strong>Incomplete clinical data</strong> may affect
                    recommendation accuracy. Confirm CHA₂DS₂-VASc inputs before
                    final decision.
                  </span>
                </div>
              )}

              {!livecdss.executed && (
                <EmptyNote>{livecdss.reason ?? "Cardiology Clinic only."}</EmptyNote>
              )}
              {livecdss.executed && !livecdss.hasAF && (
                <EmptyNote>{livecdss.reason}</EmptyNote>
              )}

              {livecdss.alerts.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--clinical-alert)]">
                    🔴 Alerts ({livecdss.alerts.length})
                  </p>
                  <ul className="space-y-1.5">
                    {livecdss.alerts.map((al) => (
                      <li
                        key={al.id}
                        className="rounded border border-l-4 border-border border-l-[var(--clinical-alert)] bg-[var(--clinical-alert-bg)] px-2 py-1.5"
                      >
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-alert)]" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-snug">
                              {al.title}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {al.detail}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {livecdss.reminders.length > 0 && (
                <div>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--clinical-warn)]">
                    🟡 Reminders ({livecdss.reminders.length})
                  </p>
                  <ul className="space-y-1.5">
                    {livecdss.reminders.map((al) => (
                      <li
                        key={al.id}
                        className="rounded border border-l-4 border-border border-l-[var(--clinical-warn)] bg-[var(--clinical-warn-bg)] px-2 py-1.5"
                      >
                        <div className="flex items-start gap-1.5">
                          <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--clinical-warn)]" />
                          <p className="text-xs font-medium leading-snug">
                            {al.title}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {livecdss.executed &&
                livecdss.hasAF &&
                livecdss.alerts.length === 0 &&
                livecdss.reminders.length === 0 && (
                  <EmptyNote>
                    <CheckCircle2 className="mx-auto mb-1 size-4 text-[var(--clinical-ok)]" />
                    No alerts triggered with current inputs.
                  </EmptyNote>
                )}

              {(cdss.alerts.length > 0 || cdss.reminders.length > 0) && (
                <Link
                  to="/alerts"
                  search={{ p: patient.patient_id }}
                  className="mt-2 block"
                >
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={dirty || incompleteCha}
                    title={
                      dirty
                        ? "Save changes first"
                        : incompleteCha
                          ? "Complete clinical data first"
                          : ""
                    }
                  >
                    Review alerts <ArrowRight className="ml-1 size-3" />
                  </Button>
                </Link>
              )}
              {dirty && (
                <p className="text-center text-[10px] text-muted-foreground">
                  Save before proceeding to Clinician Review.
                </p>
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
