import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";
import { calculatePinrr, type PinrrResult } from "../pinrr";
import { CLINICAL_RULES } from "../ruleManifest";

interface AcContext {
  clcr?: number;
  indexDate?: string;
}

function normalizeDose(dose?: string): string {
  return (dose ?? "").toLowerCase().replace(/\s+/g, "");
}

export function evaluateAnticoagulants(
  p: Patient,
  ctx: AcContext,
): { alerts: CdssAlert[]; reminders: CdssAlert[]; pinrrResult?: PinrrResult } {
  const allAlerts: CdssAlert[] = [];
  const reminders: CdssAlert[] = [];
  const meds = p.medications ?? [];
  const onMed = (name: string) =>
    meds.find((m) => m.name.toLowerCase().includes(name.toLowerCase()));

  const indexDate = ctx.indexDate ?? p.encounter?.clinic_date ?? "2026-08-26";
  const age = p.age_at_encounter ?? p.age;
  const weight = p.vitals?.weight_record?.value ?? p.vitals?.weight;
  const creatinine = p.labs?.creatinine_record?.value ?? p.labs?.creatinine;

  let pinrrResult: PinrrResult | undefined;

  // ==========================================
  // 1. WARFARIN
  // ==========================================
  const warf = onMed("warfarin");
  if (warf) {
    const inrResults = p.labs?.inr_results ?? [];
    if (inrResults.length === 0) {
      reminders.push(
        buildAlert({
          id: "warfarin-no-inr",
          severity: "reminder",
          category: "data",
          group: "Missing Data",
          title: "No INR available in last 12 months",
          detail: "Recent INR results are required to assess therapeutic range and PINRR.",
          rationale: ["Patient is on Warfarin but no dated INR records found."],
          action: {
            kind: "monitoring",
            prompt_order: "Order International Normalised Ratio (INR)",
          },
        }),
      );
    } else {
      const latest = inrResults[inrResults.length - 1];
      if (latest && (latest.value < 2.0 || latest.value > 3.0)) {
        allAlerts.push(
          buildAlert({
            id: "warfarin-inr-out",
            severity: "alert",
            category: "anticoagulant",
            group: "Drug Safety",
            title: "INR outside therapeutic range (2.0–3.0)",
            detail: `Latest INR = ${latest.value} (${latest.date || "recent"}). Target therapeutic range is 2.0–3.0.`,
            rationale: [
              `Latest INR reading: ${latest.value} on ${latest.date || "recent"}`,
              "Target therapeutic range: 2.0–3.0",
            ],
            guideline: "CPG Management of Atrial Fibrillation / ESC Guidelines",
            recommendation: "Adjust warfarin dose and recheck INR within 1–2 weeks.",
            supporting_values: { latest_inr: latest.value, inr_date: latest.date },
            priority: CLINICAL_RULES.precedence.doseAdjustment,
            action: {
              kind: "medication",
              medication: "Warfarin",
              current_dose: warf.dose,
            },
          }),
        );
      }

      pinrrResult = calculatePinrr(inrResults, indexDate);
      if (
        pinrrResult.percentage != null &&
        pinrrResult.percentage < CLINICAL_RULES.pinrr.alertBelowPercent
      ) {
        allAlerts.push(
          buildAlert({
            id: "warfarin-pinrr-low",
            severity: "alert",
            category: "pinrr",
            group: "Drug Safety",
            title: `Suboptimal INR control (PINRR ${pinrrResult.percentage}% <56%)`,
            detail: `PINRR = ${pinrrResult.percentage}% over last ${pinrrResult.count} readings (${pinrrResult.dateStart ?? ""} to ${pinrrResult.dateEnd ?? ""}). Target is ≥65%.`,
            rationale: [
              `PINRR: ${pinrrResult.percentage}% (<56% threshold indicates poor TTR)`,
              `Total INR readings in past 12 months: ${pinrrResult.count}`,
              "Review adherence, drug interactions, dietary vitamin K, or consider switching to DOAC.",
            ],
            guideline: "ESC 2020 AF Guideline — TTR/PINRR Quality Threshold",
            recommendation: "Consider switching to DOAC or intensifying INR monitoring.",
            supporting_values: {
              pinrr: pinrrResult.percentage,
              inr_count: pinrrResult.count,
            },
            priority: CLINICAL_RULES.precedence.caution,
            action: {
              kind: "review",
              medication: "Warfarin",
              current_dose: warf.dose,
            },
          }),
        );
      }
    }
  }

  // ==========================================
  // 2. APIXABAN
  // ==========================================
  const apix = onMed("apixaban");
  if (apix) {
    const apixAlerts: CdssAlert[] = [];
    const normDose = normalizeDose(apix.dose);
    const isAlreadyReduced = normDose.includes("2.5");

    if (ctx.clcr != null && ctx.clcr < CLINICAL_RULES.apixaban.clcrAvoid) {
      // ClCr < 15 -> Contraindicated
      apixAlerts.push(
        buildAlert({
          id: "apixaban-avoid",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Avoid Apixaban (Contraindicated in ClCr <15 mL/min)",
          detail: `CrCl = ${ctx.clcr} mL/min (<15 mL/min). Apixaban is contraindicated in severe renal impairment.`,
          rationale: [`Calculated CrCl: ${ctx.clcr} mL/min`, "Threshold: CrCl <15 mL/min is contraindicated."],
          guideline: "Apixaban Product Monograph / ESC Guidelines",
          recommendation: "Discontinue Apixaban; seek nephrology / cardiology consultation for alternative anticoagulation.",
          supporting_values: { clcr: ctx.clcr },
          priority: CLINICAL_RULES.precedence.contraindicated,
          action: {
            kind: "medication",
            medication: "Apixaban",
            current_dose: apix.dose,
            suggested_dose: "DISCONTINUE",
          },
        }),
      );
    } else if (!isAlreadyReduced) {
      // 2-of-3 criteria (Age >= 80, Weight <= 60, Creatinine >= 133)
      const criteria: string[] = [];
      if (age != null && age >= CLINICAL_RULES.apixaban.criteriaAge) {
        criteria.push(`Age ${age} ≥ 80 years`);
      }
      if (weight != null && weight <= CLINICAL_RULES.apixaban.criteriaWeight) {
        criteria.push(`Weight ${weight} kg ≤ 60 kg`);
      }
      if (creatinine != null && creatinine >= CLINICAL_RULES.apixaban.criteriaCreatinine) {
        criteria.push(`Serum Creatinine ${creatinine} µmol/L ≥ 133 µmol/L`);
      }

      if (criteria.length >= 2) {
        apixAlerts.push(
          buildAlert({
            id: "apixaban-reduce",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Consider Apixaban dose reduction to 2.5 mg BD",
            detail: `${criteria.length} of 3 dose-reduction criteria met (${criteria.join(", ")}).`,
            rationale: criteria,
            guideline: "Apixaban Product Monograph — 2-of-3 Dose Reduction Rule",
            recommendation: "Consider dose reduction if the current dose is 5 mg twice daily, subject to clinical review.",
            supporting_values: { criteria_met: criteria.length },
            priority: CLINICAL_RULES.precedence.doseAdjustment,
            action: {
              kind: "medication",
              medication: "Apixaban",
              current_dose: apix.dose,
              suggested_dose: "2.5 mg BD",
            },
          }),
        );
      } else if (
        ctx.clcr != null &&
        ctx.clcr >= 15 &&
        ctx.clcr <= CLINICAL_RULES.apixaban.clcrReduce
      ) {
        // ClCr 15-29 mL/min review
        apixAlerts.push(
          buildAlert({
            id: "apixaban-renal-review",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Consider Apixaban dose reduction (CrCl 15–29 mL/min)",
            detail: `CrCl = ${ctx.clcr} mL/min (15–29 mL/min).`,
            rationale: [`CrCl: ${ctx.clcr} mL/min`, "Threshold: CrCl 15–29 mL/min indicates severe renal impairment."],
            guideline: "Apixaban Product Monograph",
            recommendation: "Consider dose reduction if the current dose is 5 mg twice daily, subject to clinical review.",
            supporting_values: { clcr: ctx.clcr },
            priority: CLINICAL_RULES.precedence.doseAdjustment,
            action: {
              kind: "medication",
              medication: "Apixaban",
              current_dose: apix.dose,
              suggested_dose: "2.5 mg BD",
            },
          }),
        );
      }
    }
    allAlerts.push(...resolveDrugAlerts(apixAlerts));
  }

  // ==========================================
  // 3. EDOXABAN
  // ==========================================
  const edox = onMed("edoxaban");
  if (edox) {
    const edoxAlerts: CdssAlert[] = [];
    const normDose = normalizeDose(edox.dose);
    const isAlreadyReduced = normDose.includes("30");

    if (ctx.clcr != null && ctx.clcr < CLINICAL_RULES.edoxaban.clcrAvoid) {
      edoxAlerts.push(
        buildAlert({
          id: "edoxaban-avoid",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Avoid Edoxaban (Contraindicated in CrCl <15 mL/min)",
          detail: `CrCl = ${ctx.clcr} mL/min (<15 mL/min). Edoxaban is contraindicated.`,
          rationale: [`CrCl: ${ctx.clcr} mL/min`, "Threshold: CrCl <15 mL/min is contraindicated."],
          guideline: "Edoxaban Product Monograph",
          recommendation: "Discontinue Edoxaban and select alternative therapy.",
          supporting_values: { clcr: ctx.clcr },
          priority: CLINICAL_RULES.precedence.contraindicated,
          action: {
            kind: "medication",
            medication: "Edoxaban",
            current_dose: edox.dose,
            suggested_dose: "DISCONTINUE",
          },
        }),
      );
    } else if (!isAlreadyReduced) {
      const reasons: string[] = [];
      if (ctx.clcr != null && ctx.clcr >= 15 && ctx.clcr <= CLINICAL_RULES.edoxaban.clcrReduce) {
        reasons.push(`CrCl ${ctx.clcr} mL/min (15–50 mL/min)`);
      }
      if (weight != null && weight <= CLINICAL_RULES.edoxaban.weightReduce) {
        reasons.push(`Weight ${weight} kg ≤ 60 kg`);
      }

      if (reasons.length > 0) {
        edoxAlerts.push(
          buildAlert({
            id: "edoxaban-reduce",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Consider Edoxaban dose reduction to 30 mg OD",
            detail: `Criteria met: ${reasons.join("; ")}.`,
            rationale: reasons,
            guideline: "Edoxaban Product Monograph — Dose Adjustment Criteria",
            recommendation: "Consider reducing Edoxaban from 60 mg OD to 30 mg OD, subject to clinical review.",
            supporting_values: { clcr: ctx.clcr ?? "", weight: weight ?? "" },
            priority: CLINICAL_RULES.precedence.doseAdjustment,
            action: {
              kind: "medication",
              medication: "Edoxaban",
              current_dose: edox.dose,
              suggested_dose: "30 mg OD",
            },
          }),
        );
      }
    }
    allAlerts.push(...resolveDrugAlerts(edoxAlerts));
  }

  // ==========================================
  // 4. RIVAROXABAN
  // ==========================================
  const riva = onMed("rivaroxaban");
  if (riva) {
    const rivaAlerts: CdssAlert[] = [];
    const normDose = normalizeDose(riva.dose);
    const isAlreadyReduced = normDose.includes("15");

    if (ctx.clcr != null && ctx.clcr < CLINICAL_RULES.rivaroxaban.clcrAvoid) {
      rivaAlerts.push(
        buildAlert({
          id: "rivaroxaban-avoid",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Avoid Rivaroxaban (Contraindicated in CrCl <15 mL/min)",
          detail: `CrCl = ${ctx.clcr} mL/min (<15 mL/min). Rivaroxaban is contraindicated.`,
          rationale: [`CrCl: ${ctx.clcr} mL/min`, "Threshold: CrCl <15 mL/min is contraindicated."],
          guideline: "Rivaroxaban Product Monograph",
          recommendation: "Discontinue Rivaroxaban and select alternative anticoagulation.",
          supporting_values: { clcr: ctx.clcr },
          priority: CLINICAL_RULES.precedence.contraindicated,
          action: {
            kind: "medication",
            medication: "Rivaroxaban",
            current_dose: riva.dose,
            suggested_dose: "DISCONTINUE",
          },
        }),
      );
    } else if (!isAlreadyReduced && ctx.clcr != null && ctx.clcr >= 15 && ctx.clcr <= CLINICAL_RULES.rivaroxaban.clcrReduce) {
      rivaAlerts.push(
        buildAlert({
          id: "rivaroxaban-reduce",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Consider Rivaroxaban dose reduction to 15 mg OD",
          detail: `CrCl = ${ctx.clcr} mL/min (15–49 mL/min).`,
          rationale: [`Calculated CrCl: ${ctx.clcr} mL/min`, "Threshold: CrCl 15–49 mL/min indicates moderate renal impairment."],
          guideline: "Rivaroxaban Product Monograph — Renal Dose Adjustment",
          recommendation: "Consider reducing Rivaroxaban from 20 mg OD to 15 mg OD, subject to clinical review.",
          supporting_values: { clcr: ctx.clcr },
          priority: CLINICAL_RULES.precedence.doseAdjustment,
          action: {
            kind: "medication",
            medication: "Rivaroxaban",
            current_dose: riva.dose,
            suggested_dose: "15 mg OD",
          },
        }),
      );
    }
    allAlerts.push(...resolveDrugAlerts(rivaAlerts));
  }

  // ==========================================
  // 5. DABIGATRAN
  // ==========================================
  const dabi = onMed("dabigatran");
  if (dabi) {
    const dabiAlerts: CdssAlert[] = [];
    const normDose = normalizeDose(dabi.dose);
    const isAlreadyReduced = normDose.includes("110");

    if (ctx.clcr != null && ctx.clcr < CLINICAL_RULES.dabigatran.clcrAvoid) {
      dabiAlerts.push(
        buildAlert({
          id: "dabigatran-avoid",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Avoid Dabigatran (Contraindicated in CrCl <30 mL/min)",
          detail: `CrCl = ${ctx.clcr} mL/min (<30 mL/min). Dabigatran is contraindicated due to high renal clearance.`,
          rationale: [`CrCl: ${ctx.clcr} mL/min`, "Threshold: CrCl <30 mL/min is contraindicated."],
          guideline: "Dabigatran Product Monograph",
          recommendation: "Discontinue Dabigatran and switch to an alternative anticoagulant.",
          supporting_values: { clcr: ctx.clcr },
          priority: CLINICAL_RULES.precedence.contraindicated,
          action: {
            kind: "medication",
            medication: "Dabigatran",
            current_dose: dabi.dose,
            suggested_dose: "DISCONTINUE",
          },
        }),
      );
    } else if (!isAlreadyReduced) {
      // ClCr 30-50
      if (ctx.clcr != null && ctx.clcr >= 30 && ctx.clcr <= CLINICAL_RULES.dabigatran.clcrReduce) {
        dabiAlerts.push(
          buildAlert({
            id: "dabigatran-reduce-renal",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Consider Dabigatran dose reduction to 110 mg BD (CrCl 30–50 mL/min)",
            detail: `CrCl = ${ctx.clcr} mL/min (30–50 mL/min).`,
            rationale: [`Calculated CrCl: ${ctx.clcr} mL/min`, "Threshold: CrCl 30–50 mL/min requires dose reduction."],
            guideline: "Dabigatran Product Monograph — Renal Dosing",
            recommendation: "Consider reducing Dabigatran from 150 mg BD to 110 mg BD, subject to clinical review.",
            supporting_values: { clcr: ctx.clcr },
            priority: CLINICAL_RULES.precedence.doseAdjustment,
            action: {
              kind: "medication",
              medication: "Dabigatran",
              current_dose: dabi.dose,
              suggested_dose: "110 mg BD",
            },
          }),
        );
      }

      // Age >= 80 -> "Recommend"
      if (age != null && age >= CLINICAL_RULES.dabigatran.ageMandatory) {
        dabiAlerts.push(
          buildAlert({
            id: "dabigatran-age-80",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Recommend Dabigatran dose reduction to 110 mg BD (Age ≥80)",
            detail: `Patient age is ${age} (≥80 years). Guideline recommends 110 mg BD to mitigate bleeding risk.`,
            rationale: [`Age: ${age} years (≥80 threshold)`, "Guideline recommendation: 110 mg BD for patients aged ≥80."],
            guideline: "ESC Guidelines / Dabigatran Product Monograph",
            recommendation: "Reduce Dabigatran dose to 110 mg BD.",
            supporting_values: { age },
            priority: CLINICAL_RULES.precedence.doseAdjustment,
            action: {
              kind: "medication",
              medication: "Dabigatran",
              current_dose: dabi.dose,
              suggested_dose: "110 mg BD",
            },
          }),
        );
      } else if (
        age != null &&
        age >= CLINICAL_RULES.dabigatran.ageConsider &&
        age < CLINICAL_RULES.dabigatran.ageMandatory
      ) {
        // Age 75-79 -> "Consider" (separate card)
        dabiAlerts.push(
          buildAlert({
            id: "dabigatran-age-75-79",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Consider Dabigatran dose reduction to 110 mg BD (Age 75–79)",
            detail: `Patient age is ${age} (75–79 years). Consider 110 mg BD if bleeding risk is elevated or comorbidities exist.`,
            rationale: [
              `Age: ${age} years (75–79 range)`,
              "Consider 110 mg BD based on individual thromboembolic vs bleeding risk assessment.",
            ],
            guideline: "ESC Guidelines / Dabigatran SPC",
            recommendation: "Evaluate bleeding risk; consider reducing to 110 mg BD if clinically warranted.",
            supporting_values: { age },
            priority: CLINICAL_RULES.precedence.caution,
            action: {
              kind: "medication",
              medication: "Dabigatran",
              current_dose: dabi.dose,
              suggested_dose: "110 mg BD",
            },
          }),
        );
      }

      // Verapamil Interaction
      if (onMed("verapamil")) {
        dabiAlerts.push(
          buildAlert({
            id: "dabigatran-verapamil",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Consider Dabigatran dose reduction to 110 mg BD (Verapamil interaction)",
            detail: "Concomitant verapamil increases dabigatran exposure through P-gp inhibition.",
            rationale: ["Concomitant Verapamil prescription detected.", "P-glycoprotein interaction increases plasma dabigatran."],
            guideline: "Dabigatran Product Monograph — Drug Interactions",
            recommendation: "Consider reducing Dabigatran to 110 mg BD while on Verapamil, subject to clinical review.",
            priority: CLINICAL_RULES.precedence.doseAdjustment,
            action: {
              kind: "medication",
              medication: "Dabigatran",
              current_dose: dabi.dose,
              suggested_dose: "110 mg BD",
            },
          }),
        );
      }
    }
    allAlerts.push(...resolveDrugAlerts(dabiAlerts));
  }

  return { alerts: allAlerts, reminders, pinrrResult };
}

/**
 * Precedence Resolver:
 * Emits only the single highest-priority finding for a medication.
 * Avoid / Contraindicated (500) suppresses all dose reductions (300) and cautions (200).
 */
function resolveDrugAlerts(alerts: CdssAlert[]): CdssAlert[] {
  if (alerts.length <= 1) return alerts;

  // Sort descending by priority
  const sorted = [...alerts].sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));
  const topPriority = sorted[0].priority ?? 100;

  // If top is Avoid (contraindicated), keep only the top alert
  if (topPriority >= CLINICAL_RULES.precedence.contraindicated) {
    return [sorted[0]];
  }

  // If multiple alerts share the highest priority, aggregate their rationales into one alert
  const topAlerts = sorted.filter((a) => (a.priority ?? 100) === topPriority);
  if (topAlerts.length > 1) {
    const combinedRationale = Array.from(
      new Set(topAlerts.flatMap((a) => a.rationale)),
    );
    const primary = topAlerts[0];
    return [
      {
        ...primary,
        title: primary.title,
        detail: topAlerts.map((a) => a.detail).join(" "),
        rationale: combinedRationale,
      },
    ];
  }

  return [sorted[0]];
}
