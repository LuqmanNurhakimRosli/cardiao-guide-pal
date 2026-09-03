/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { logFieldChange, logScoreCalculation } from "@/shared/cdss/server.functions";
import { usePatientState, type ClinicianInputs } from "@/pages/assessment/hooks/usePatientState";
import { AppShell } from "@/shared/components/layout/AppShell";
import { HasBledCalculator } from "@/pages/assessment/components/HasBledCalculator";
import { Cha2ds2VascHybrid } from "@/pages/assessment/components/Cha2ds2VascHybrid";
import { AfEvidenceCard } from "@/pages/assessment/components/AfEvidenceCard";
import { AfConfirmationModal } from "@/pages/assessment/components/AfConfirmationModal";
import {
  Cha2ds2VaConfirmationModal,
  HasBledConfirmationModal,
} from "@/pages/assessment/components/ScoreEvidenceModal";
import { MissingDataCard } from "@/pages/assessment/components/MissingDataCard";
import { ClinicGateBanner } from "@/pages/assessment/components/ClinicGateBanner";
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
  Check,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { Patient, CdssEvaluationResult } from "@/shared/cdss/types";

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

interface AssessmentPageProps {
  current: {
    patient: Patient;
    cdss: CdssEvaluationResult;
  };
}

export function AssessmentPage({ current }: AssessmentPageProps) {
  const { patient } = current;
  const navigate = useNavigate();

  const state = usePatientState(patient);
  const {
    draft,
    inputs,
    dirty,
    setField,
    commitField,
    reset,
    saveAndRecalculate,
    draftCdss,
    cdss,
    loading,
    error,
    source,
  } = state;

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
  const isReal = (patient as any).cohort === "hospital" || patient.patient_id.startsWith("REAL-");

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
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      isReal
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                    }`}
                  >
                    {isReal ? "HASA UiTM" : "Benchmark Case"}
                  </span>
                  {(patient as any).is_valvular && (
                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-500/20">
                      🫀 Valvular AF
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <strong>MRN:</strong> <span className="font-mono">{patient.mrn ?? "—"}</span>
                  </span>
                  <span>
                    <strong>Age:</strong> {patient.age_at_encounter ?? patient.age} yrs
                  </span>
                  <span>
                    <strong>Sex:</strong> {patient.sex}
                  </span>
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

            {/* Quick Clinical Status Summary */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs shadow-2xs">
                <Pill className="size-3.5 text-primary" />
                <span className="text-muted-foreground font-medium">Active Rx:</span>
                <span className="font-bold text-foreground font-mono">
                  {patient.current_anticoagulant ?? "None"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs shadow-2xs">
                <ShieldAlert className="size-3.5 text-red-500" />
                <span className="text-muted-foreground font-medium">CHA₂DS₂-VA:</span>
                <span className="font-bold text-foreground font-mono">
                  {livecdss.scores.cha2ds2va?.total ?? livecdss.scores.cha2ds2vasc?.total ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs shadow-2xs">
                <Heart className="size-3.5 text-amber-500" />
                <span className="text-muted-foreground font-medium">HAS-BLED:</span>
                <span className="font-bold text-foreground font-mono">
                  {livecdss.scores.hasbled?.total ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Grid Layout (Responsive 3-Column on Desktop, Stacked on Mobile/Tablet) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_340px]">
          {/* LEFT: Clinical Background & Diagnoses */}
          <aside className="space-y-3">
            <Section
              icon={<Stethoscope className="size-4 text-primary" />}
              title="Comorbidities (EMR)"
            >
              <div className="space-y-1.5">
                {Object.entries(patient.comorbidities).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs transition hover:bg-muted/30"
                  >
                    <span className="capitalize font-medium text-foreground/80">
                      {k.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        v
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border/60"
                      }`}
                    >
                      {v ? "✓ Yes" : "No"}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={<FileText className="size-4 text-purple-600" />} title="Diagnoses & ECG">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {patient.diagnoses.map((d: string) => (
                    <span
                      key={d}
                      className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 font-mono text-[11px] font-semibold text-purple-700 dark:text-purple-300"
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground text-[11px] mb-0.5">Recorded Rhythm:</p>
                  <p className="font-mono text-xs text-foreground/90 font-medium">
                    {patient.ecg_results.join(", ") || "Atrial Fibrillation"}
                  </p>
                </div>
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
              <ClinicGateBanner clinic={patient.clinic_location} reason={livecdss.reason} />
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
              onConfirm={async () => {
                await commitField("afConfirmed", true);
              }}
              onReject={async () => {
                await commitField("afConfirmed", false);
              }}
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
              setField={setField}
              onConfirm={async () => {
                await commitField("chaConfirmed", true);
                setManualScoreModal(null);
              }}
              onResetToEmr={() => {
                setField("chf", undefined);
                setField("hypertension", undefined);
                setField("diabetes", undefined);
                setField("stroke", undefined);
                setField("vascular", undefined);
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
              setField={setField}
              onConfirm={async () => {
                const res = await commitField("hasBledConfirmed", true);
                setManualScoreModal(null);
                if (res && res.alerts && res.alerts.length > 0) {
                  navigate({ to: "/alerts", search: { p: patient.patient_id } });
                }
              }}
              onResetToEmr={() => {
                setField("hb_hypertension", undefined);
                setField("hb_abnormalRenal", undefined);
                setField("abnormalLiver", undefined);
                setField("hb_stroke", undefined);
                setField("bleedingHistory", undefined);
                setField("hb_labileINR", undefined);
                setField("hb_elderly", undefined);
                setField("hb_drugs", undefined);
                setField("alcohol", undefined);
              }}
            />

            {/* Vitals Grid */}
            <Section
              icon={<Activity className="size-4 text-blue-600" />}
              title="Vitals & Encounters"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat
                  label="BP Latest"
                  value={patient.vitals.bp_latest ?? "—"}
                  subLabel={patient.vitals.bp_second ? `Prior: ${patient.vitals.bp_second}` : "Latest recorded BP"}
                  flag={patient.vitals.bp_latest ? Number(patient.vitals.bp_latest.split("/")[0]) >= 140 : false}
                />
                <Stat
                  label="BP Prior"
                  value={patient.vitals.bp_second ?? "—"}
                  subLabel="Confirmation Reading"
                  flag={patient.vitals.bp_second ? Number(patient.vitals.bp_second.split("/")[0]) >= 140 : false}
                />
                <Stat
                  label="Weight"
                  value={patient.vitals.weight ? `${patient.vitals.weight} kg` : "—"}
                  subLabel="Used in DOAC & CrCl dosing"
                  flag={patient.vitals.weight ? patient.vitals.weight <= 60 : false}
                />
              </div>
            </Section>

            {/* Labs Grid */}
            <Section
              icon={<FlaskConical className="size-4 text-purple-600" />}
              title="Laboratory Metrics & Clearance"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Stat
                  label="Creatinine"
                  value={
                    patient.labs.creatinine
                      ? `${patient.labs.creatinine} ${patient.labs.creatinine_unit ?? "µmol/L"}`
                      : "—"
                  }
                  subLabel={
                    patient.labs.creatinine_record?.date
                      ? `Sample: ${patient.labs.creatinine_record.date}`
                      : "Biochemistry"
                  }
                  badge="Renal"
                  flag={(patient.labs.creatinine ?? 0) >= 133}
                />
                <Stat
                  label="eGFR"
                  value={
                    patient.labs.egfr
                      ? `${patient.labs.egfr} mL/min`
                      : patient.labs.egfr_record?.value
                        ? `${patient.labs.egfr_record.value} mL/min`
                        : "—"
                  }
                  subLabel="Standardized 1.73m²"
                  badge="EMR Direct"
                  flag={(patient.labs.egfr ?? patient.labs.egfr_record?.value ?? 100) < 60}
                  title="Estimated GFR direct from laboratory biochemistry report"
                />
                <Stat
                  label="CrCl (CG)"
                  value={livecdss.scores.clcr ? `${livecdss.scores.clcr} mL/min` : "No Data"}
                  subLabel="Cockcroft-Gault (DOAC)"
                  badge="DOAC"
                  flag={(livecdss.scores.clcr ?? 100) < 50}
                  title="Calculated via Cockcroft-Gault: (140 - Age) × Weight (kg) × [1.23 male / 1.04 female] / Serum Creatinine (µmol/L)"
                />
                <Stat
                  label="HbA1c"
                  value={patient.labs.hba1c ? `${patient.labs.hba1c}%` : "—"}
                  subLabel={
                    patient.labs.hba1c_record?.date
                      ? `Tested: ${patient.labs.hba1c_record.date}`
                      : patient.comorbidities.diabetes
                        ? "Diabetic (Target ≤7.0%)"
                        : "Non-diabetic"
                  }
                  badge="Glycaemic"
                  flag={(patient.labs.hba1c ?? 0) > 7.0}
                />
                <Stat
                  label="INR / PINRR"
                  value={
                    patient.labs.inr_latest
                      ? `Latest: ${patient.labs.inr_latest}`
                      : livecdss.scores.pinrr != null
                        ? `${livecdss.scores.pinrr}% TTR`
                        : "—"
                  }
                  subLabel={
                    livecdss.scores.pinrr != null
                      ? `PINRR: ${livecdss.scores.pinrr}% in range`
                      : "Target INR 2.0–3.0"
                  }
                  badge="Warfarin"
                  flag={(livecdss.scores.pinrr ?? 100) < 56}
                />
              </div>
            </Section>

            {/* Medications Summary */}
            <Section
              icon={<Pill className="size-4 text-emerald-600" />}
              title="Current Medication Orders"
            >
              <ul className="space-y-2">
                {patient.medications.map((m: import("@/shared/cdss/types").Medication) => (
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

            {/* Sticky Floating Save & Recalculate Bar (Only shown when manual edits exist on the page) */}
            {(dirty || saveFlash) && (
              <div className="sticky bottom-3 z-20 rounded-xl border border-border bg-card/95 p-3.5 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
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
                          : "✓ Saved & CDSS Recalculated!"}
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
            )}
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
                      <strong>Incomplete inputs:</strong> Confirm missing clinical fields before
                      clinical action.
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
                          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                            {al.detail}
                          </p>
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
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center text-xs">
                    <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <p className="text-sm font-bold text-foreground">All Protocols Verified</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">
                      Patient medication, stroke risk, and clinical monitoring align fully with guidelines.
                    </p>
                    <div className="mt-4 pt-3 border-t border-emerald-500/20">
                      <Link
                        to="/summary"
                        search={{ p: patient.patient_id }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                      >
                        <ClipboardList className="size-3.5" /> View Consultation Summary
                      </Link>
                    </div>
                  </div>
                )}

                {(livecdss.alerts.length > 0 || livecdss.reminders.length > 0) && (
                  <Link to="/alerts" search={{ p: patient.patient_id }} className="block pt-1">
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
      className={`rounded-xl border p-3 shadow-2xs transition hover:border-primary/40 flex flex-col justify-between min-h-[105px] overflow-hidden ${
        flag
          ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
          : "border-border bg-card hover:bg-muted/10"
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
            {label}
          </span>
          {badge && (
            <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-bold text-primary shrink-0 border border-primary/20">
              {badge}
            </span>
          )}
        </div>
        <div
          className={`text-sm sm:text-base font-bold font-mono tracking-tight leading-snug pt-0.5 ${
            flag ? "text-amber-700 dark:text-amber-300" : "text-foreground"
          }`}
        >
          {value}
        </div>
      </div>
      {subLabel && (
        <div
          className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate"
          title={subLabel}
        >
          {subLabel}
        </div>
      )}
    </div>
  );
}

