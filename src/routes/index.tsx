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
import {
  Cha2ds2VaConfirmationModal,
  HasBledConfirmationModal,
} from "@/components/cdss/ScoreEvidenceModal";
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
  Calendar,
  Building2,
  Stethoscope,
  ShieldAlert,
  ArrowRightLeft,
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
  const [manualScoreModal, setManualScoreModal] = useState<"cha" | "hasbled" | null>(null);

  const handleSave = async () => {
    const before = inputs;
    const after = draft;
    const changedKeys: (keyof ClinicianInputs)[] = [];
    (Object.keys(after) as (keyof ClinicianInputs)[]).forEach((k) => {
      if (k === "_lastSavedAt") return;
      if (before[k] !== after[k]) changedKeys.push(k);
    });

    saveAndRecalculate();

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

    if (draftCdss.scores.cha2ds2va ?? draftCdss.scores.cha2ds2vasc) {
      const s = (draftCdss.scores.cha2ds2va ?? draftCdss.scores.cha2ds2vasc)!;
      const highRisk = s.total >= 2;
      logScore({
        data: {
          patient_id: patient.patient_id,
          score_name: "CHA2DS2-VA",
          total: s.total,
          source: changedKeys.length ? "hybrid" : "auto",
          high_risk: highRisk,
        },
      }).catch(() => {});
    }

    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

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

  const livecdss = draftCdss;
  const isReal = patient.cohort === "hospital" || patient.patient_id.startsWith("REAL-");

  return (
    <AppShell selectedId={patient.patient_id} selectedName={patient.name}>
      <div className="mx-auto max-w-7xl px-3 sm:px-5 py-4 space-y-4">
        {/* Top Hero Patient Demographics Banner */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-xs font-bold text-lg">
                {patient.name.charAt(0)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    {patient.name}
                  </h1>
                  <span className="font-mono text-xs font-bold rounded-md bg-primary/10 px-2 py-0.5 text-primary border border-primary/20">
                    {patient.patient_id}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    isReal ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" : "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                  }`}>
                    {isReal ? "HASA UiTM" : "Benchmark Case"}
                  </span>
                  {patient.is_valvular && (
                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-500/20">
                      🫀 Valvular AF
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span><strong>MRN:</strong> <span className="font-mono">{patient.mrn ?? "—"}</span></span>
                  <span><strong>Age:</strong> {patient.age_at_encounter ?? patient.age} yrs</span>
                  <span><strong>Sex:</strong> {patient.sex}</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3 text-muted-foreground" />
                    {patient.clinic_location}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="size-3 text-muted-foreground" />
                    {patient.encounter?.clinic_date ?? "2026-08-26"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Link
                to="/patients"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-2xs hover:bg-muted hover:text-foreground transition"
              >
                <ArrowRightLeft className="size-3.5" /> Change Patient
              </Link>
            </div>
          </div>
        </div>

        {/* Clinical Grid Layout (Responsive 3-Column on Desktop, Stacked on Mobile/Tablet) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_340px]">
          {/* LEFT: Clinical Background & Diagnoses */}
          <aside className="space-y-3">
            <Section icon={<Stethoscope className="size-4 text-primary" />} title="Comorbidities (EMR)">
              <div className="divide-y divide-border/60">
                {Object.entries(patient.comorbidities).map(([k, v]) => (
                  <Row
                    key={k}
                    k={k}
                    v={
                      <span className={`font-semibold ${v ? "text-foreground" : "text-muted-foreground/60"}`}>
                        {v === undefined ? "—" : v ? "Yes" : "No"}
                      </span>
                    }
                  />
                ))}
              </div>
            </Section>

            <Section icon={<FileText className="size-4 text-purple-600" />} title="Diagnoses & ECG">
              <ul className="space-y-1.5">
                {patient.diagnoses.map((d: string) => (
                  <li key={d} className="rounded-lg bg-muted/60 px-2.5 py-1 font-mono text-[11px] text-foreground">
                    {d}
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 rounded-lg border border-border/80 bg-background/50 p-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">ECG Rhythm:</span> {patient.ecg_results.join(", ") || "Atrial Fibrillation"}
              </div>
            </Section>

            {inputs._lastSavedAt && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                <p className="font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Session state persisted
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                  Last saved: {new Date(inputs._lastSavedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </aside>

          {/* CENTER: CDSS Calculation Engine & Interactive Scorers */}
          <section className="space-y-3">
            {!livecdss.clinicEligible ? (
              <ClinicGateBanner
                clinic={patient.clinic_location}
                reason={livecdss.reason}
              />
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse-dot" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    CDSS Decision Engine Online
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">v2026.08.26</span>
              </div>
            )}

            {livecdss.clinicEligible && livecdss.afEvidence.length > 0 && (
              <AfEvidenceCard
                evidence={livecdss.afEvidence}
                confirmed={draft.afConfirmed ?? livecdss.afConfirmed}
              />
            )}

            <AfConfirmationModal
              open={
                livecdss.clinicEligible &&
                livecdss.afEvidence.length > 0 &&
                (draft.afConfirmed ?? null) === null
              }
              evidence={livecdss.afEvidence}
              onConfirm={() => setField("afConfirmed", true)}
              onReject={() => setField("afConfirmed", false)}
            />

            <Cha2ds2VaConfirmationModal
              open={
                manualScoreModal === "cha" ||
                (livecdss.clinicEligible &&
                  (draft.afConfirmed ?? livecdss.afConfirmed) === true &&
                  (draft.chaConfirmed ?? null) === null)
              }
              patient={patient}
              draft={draft}
              score={livecdss.scores.cha2ds2va?.total ?? livecdss.scores.cha2ds2vasc?.total ?? 0}
              onConfirm={() => {
                setField("chaConfirmed", true);
                setManualScoreModal(null);
              }}
              onEdit={() => {
                setField("chaConfirmed", true);
                setManualScoreModal(null);
              }}
            />

            <HasBledConfirmationModal
              open={
                manualScoreModal === "hasbled" ||
                (livecdss.clinicEligible &&
                  (draft.afConfirmed ?? livecdss.afConfirmed) === true &&
                  (draft.chaConfirmed ?? null) === true &&
                  (draft.hasBledConfirmed ?? null) === null)
              }
              patient={patient}
              draft={draft}
              score={livecdss.scores.hasbled?.total ?? 0}
              onConfirm={() => {
                setField("hasBledConfirmed", true);
                setManualScoreModal(null);
              }}
              onEdit={() => {
                setField("hasBledConfirmed", true);
                setManualScoreModal(null);
              }}
            />

            {/* Vitals Grid */}
            <Section icon={<Activity className="size-4 text-blue-600" />} title="Vitals & Encounters">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <Stat label="BP Latest" value={patient.vitals.bp_latest ?? "—"} />
                <Stat label="BP Prior" value={patient.vitals.bp_second ?? "—"} />
                <Stat
                  label="Weight"
                  value={patient.vitals.weight ? `${patient.vitals.weight} kg` : "—"}
                />
              </div>
            </Section>

            {/* Labs Grid */}
            <Section icon={<FlaskConical className="size-4 text-purple-600" />} title="Laboratory Metrics & Clearance">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <Stat
                  label="Creatinine"
                  value={
                    patient.labs.creatinine
                      ? `${patient.labs.creatinine} ${patient.labs.creatinine_unit ?? "umol/L"}`
                      : "—"
                  }
                  subLabel={patient.labs.creatinine_record?.date ? `Sample: ${patient.labs.creatinine_record.date}` : undefined}
                />
                <Stat
                  label="eGFR (Lab Report)"
                  value={
                    patient.labs.egfr
                      ? `${patient.labs.egfr} mL/min`
                      : patient.labs.egfr_record?.value
                      ? `${patient.labs.egfr_record.value} mL/min`
                      : "—"
                  }
                  subLabel={
                    patient.labs.egfr_record?.date
                      ? `Date: ${patient.labs.egfr_record.date}`
                      : "Direct from Lab"
                  }
                  badge="EMR Lab Direct"
                  flag={(patient.labs.egfr ?? patient.labs.egfr_record?.value ?? 100) < 60}
                  title="Estimated GFR direct from laboratory biochemistry report (standardized to 1.73m²)"
                />
                <Stat
                  label="CrCl (Cockcroft)"
                  value={livecdss.scores.clcr ? `${livecdss.scores.clcr} mL/min` : "insufficient"}
                  subLabel={
                    patient.age_at_encounter && patient.vitals.weight && patient.labs.creatinine
                      ? `${patient.sex === "female" ? "1.04" : "1.23"} × (140-${patient.age_at_encounter}) × ${patient.vitals.weight}kg / ${patient.labs.creatinine}`
                      : "Weight-adjusted"
                  }
                  badge="DOAC Dosing"
                  flag={(livecdss.scores.clcr ?? 100) < 50}
                  title="Calculated via Cockcroft-Gault: (140 - Age) × Weight (kg) × [1.23 male / 1.04 female] / Serum Creatinine (µmol/L)"
                />
                <Stat
                  label="HbA1c"
                  value={patient.labs.hba1c ? `${patient.labs.hba1c}%` : "—"}
                  subLabel={
                    patient.labs.hba1c_record?.date
                      ? `Date: ${patient.labs.hba1c_record.date}`
                      : patient.comorbidities.diabetes
                      ? "Diabetic"
                      : "Non-diabetic"
                  }
                  flag={(patient.labs.hba1c ?? 0) > 7.0}
                />
                <Stat
                  label="Warfarin PINRR"
                  value={
                    livecdss.scores.pinrr != null
                      ? `${livecdss.scores.pinrr}%`
                      : "—"
                  }
                  subLabel="TTR Quality"
                  flag={(livecdss.scores.pinrr ?? 100) < 56}
                />
              </div>
            </Section>

            {/* Medications Summary */}
            <Section icon={<Pill className="size-4 text-emerald-600" />} title="Current Medication Orders">
              <ul className="space-y-2">
                {patient.medications.map((m: import("@/cdss/types").Medication) => (
                  <li
                    key={m.name}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-foreground">{m.name}</span>
                      {m.dose && (
                        <span className="ml-2 font-mono text-primary font-semibold">{m.dose}</span>
                      )}
                    </div>
                    {m.indication && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {m.indication}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

            {livecdss.clinicEligible && (draft.afConfirmed ?? livecdss.afConfirmed) === true && (
              <>
                <Cha2ds2VascHybrid
                  patient={patient}
                  draft={draft}
                  setField={setField}
                  onOpenModal={() => setManualScoreModal("cha")}
                />

                <HasBledCalculator
                  patient={patient}
                  draft={draft}
                  setField={setField}
                  onOpenModal={() => setManualScoreModal("hasbled")}
                />

                <MissingDataCard reminders={livecdss.reminders} />
              </>
            )}

            {/* Sticky Floating Save & Recalculate Bar */}
            <div className="sticky bottom-3 z-20 rounded-xl border border-border bg-card/95 p-3.5 shadow-lg backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {dirty ? (
                      <span className="flex size-2.5 rounded-full bg-amber-500 animate-pulse" />
                    ) : (
                      <span className="flex size-2.5 rounded-full bg-emerald-500" />
                    )}
                    <p className="text-xs font-bold text-foreground">
                      {dirty
                        ? "Unsaved Clinician Input Changes"
                        : saveFlash
                          ? "✓ Saved & CDSS Recalculated!"
                          : "All Clinician Inputs Synchronized"}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Recalculates guideline rules and writes snapshot to the audit log.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={reset}
                    disabled={!dirty}
                    className="text-xs h-8"
                  >
                    <RotateCcw className="mr-1.5 size-3" /> Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!dirty}
                    className="text-xs h-8 bg-primary text-primary-foreground font-semibold shadow-xs"
                  >
                    <Save className="mr-1.5 size-3" /> Save & Recalculate
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: Combined Clinical Alert Panel */}
          <aside className="lg:sticky lg:top-4 lg:self-start space-y-3">
            <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
              <div className="border-b border-border bg-muted/40 px-4 py-3">
                <h2 className="text-sm font-bold text-foreground">Combined Alert Panel</h2>
                <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground font-mono">
                  <span>{loading ? "⏳ Evaluating…" : `Source: ${source}`}</span>
                  <span className="font-semibold text-foreground">
                    {livecdss.alerts.length} Alert{livecdss.alerts.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="p-3.5 space-y-3">
                {incompleteCha && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    <p className="leading-snug">
                      <strong>Incomplete inputs:</strong> Confirm missing clinical fields before clinical action.
                    </p>
                  </div>
                )}

                {livecdss.alerts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2">
                      Critical Alerts ({livecdss.alerts.length})
                    </p>
                    <ul className="space-y-2">
                      {livecdss.alerts.map((al) => (
                        <li
                          key={al.id}
                          className="rounded-lg border border-l-4 border-rose-500/30 border-l-rose-500 bg-rose-500/5 p-2.5 text-xs"
                        >
                          <p className="font-bold text-foreground leading-snug">{al.title}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{al.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {livecdss.reminders.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">
                      Data Reminders ({livecdss.reminders.length})
                    </p>
                    <ul className="space-y-2">
                      {livecdss.reminders.map((al) => (
                        <li
                          key={al.id}
                          className="rounded-lg border border-l-4 border-amber-500/30 border-l-amber-500 bg-amber-500/5 p-2.5 text-xs"
                        >
                          <p className="font-semibold text-foreground leading-snug">{al.title}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {livecdss.alerts.length === 0 && livecdss.reminders.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" />
                    <p className="font-semibold text-foreground">No Active Alerts</p>
                    <p className="text-[11px] mt-0.5">Current therapy meets guidelines.</p>
                  </div>
                )}

                {(livecdss.alerts.length > 0 || livecdss.reminders.length > 0) && (
                  <Link
                    to="/alerts"
                    search={{ p: patient.patient_id }}
                    className="block pt-1"
                  >
                    <Button
                      className="w-full text-xs font-semibold shadow-xs"
                      size="sm"
                      disabled={dirty || incompleteCha}
                    >
                      Open Action Review <ArrowRight className="ml-1.5 size-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

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
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs first:pt-0 last:pb-0">
      <span className="capitalize text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  flag,
  subLabel,
  badge,
  title,
}: {
  label: string;
  value: React.ReactNode;
  flag?: boolean;
  subLabel?: string;
  badge?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`rounded-xl border p-2.5 shadow-2xs transition hover:border-primary/40 flex flex-col justify-between ${
        flag
          ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
          : "border-border bg-background/60"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
          {badge && (
            <span className="rounded bg-primary/10 px-1 py-0.2 text-[8px] font-bold text-primary shrink-0">
              {badge}
            </span>
          )}
        </div>
        <div
          className={`mt-1 text-sm font-bold font-mono ${
            flag ? "text-amber-700 dark:text-amber-300" : "text-foreground"
          }`}
        >
          {value}
        </div>
      </div>
      {subLabel && (
        <div className="mt-1 text-[9.5px] text-muted-foreground truncate font-mono" title={subLabel}>
          {subLabel}
        </div>
      )}
    </div>
  );
}
