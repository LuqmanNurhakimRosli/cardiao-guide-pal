import type { Patient, CdssAlert } from "../types";
import { buildAlert } from "./alertBuilder";
import { pinrr as computePinrr } from "../pinrr";

interface AcContext {
  clcr?: number;
}

export function evaluateAnticoagulants(
  p: Patient,
  ctx: AcContext,
): { alerts: CdssAlert[]; reminders: CdssAlert[]; pinrrPct?: number } {
  const alerts: CdssAlert[] = [];
  const reminders: CdssAlert[] = [];
  const meds = p.medications ?? [];
  const onMed = (name: string) =>
    meds.find((m) => m.name.toLowerCase().includes(name.toLowerCase()));

  let pinrrPct: number | undefined;

  // Warfarin — INR + PINRR
  const warf = onMed("warfarin");
  if (warf) {
    const inr = p.labs?.inr_history ?? [];
    if (inr.length === 0) {
      reminders.push(
        buildAlert({
          id: "warfarin-no-inr",
          severity: "reminder",
          category: "data",
          group: "Missing Data",
          title: "No INR available in last 12 months",
          detail: "Recent INR required to assess therapeutic range and PINRR.",
          rationale: [],
        }),
      );
    } else {
      const latest = inr[inr.length - 1];
      if (latest < 2 || latest > 3) {
        alerts.push(
          buildAlert({
            id: "warfarin-inr-out",
            severity: "alert",
            category: "anticoagulant",
            group: "Drug Safety",
            title: "INR outside therapeutic range (2.0–3.0)",
            detail: `Latest INR = ${latest}.`,
            rationale: [`INR history: ${inr.join(", ")}`, "Target: 2.0–3.0."],
            guideline: "ESC/AHA warfarin dosing guideline",
            recommendation: "Adjust warfarin dose; recheck INR within 1 week.",
            supporting_values: { latest_inr: latest },
          }),
        );
      }
      pinrrPct = computePinrr(inr);
      if (pinrrPct != null && pinrrPct < 55) {
        alerts.push(
          buildAlert({
            id: "warfarin-pinrr-low",
            severity: "alert",
            category: "pinrr",
            group: "Drug Safety",
            title: "Suboptimal INR control (PINRR <55%)",
            detail: `PINRR = ${pinrrPct}% over last ${inr.length} INR readings.`,
            rationale: [
              `INR history: ${inr.join(", ")}`,
              "Review adherence, drug interactions, diet.",
            ],
            guideline: "ESC 2020 AF Guideline — TTR/PINRR ≥65%",
            recommendation:
              "Consider switching to DOAC or intensify INR monitoring.",
            supporting_values: { pinrr: pinrrPct },
          }),
        );
      }
    }
  }

  // Apixaban — 2 of 3 criteria
  if (onMed("apixaban")) {
    const crit: string[] = [];
    if (p.age >= 80) crit.push(`Age ${p.age} ≥80`);
    if ((p.vitals?.weight ?? Infinity) <= 60)
      crit.push(`Weight ${p.vitals?.weight} kg ≤60`);
    if ((p.labs?.creatinine ?? 0) >= 133)
      crit.push(`Creatinine ${p.labs?.creatinine} µmol/L ≥133`);
    if (crit.length >= 2) {
      alerts.push(
        buildAlert({
          id: "apixaban-reduce",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Reduce Apixaban to 2.5 mg BD",
          detail: `${crit.length} of 3 dose-reduction criteria met.`,
          rationale: crit,
          guideline: "Apixaban SPC — 2-of-3 dose-reduction rule",
          recommendation: "Reduce dose to 2.5 mg BD.",
        }),
      );
    }
  }

  // Rivaroxaban — renal
  if (onMed("rivaroxaban") && ctx.clcr != null) {
    if (ctx.clcr < 15)
      alerts.push(
        buildAlert({
          id: "rivaroxaban-avoid",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Avoid Rivaroxaban (ClCr <15)",
          detail: `ClCr = ${ctx.clcr} mL/min.`,
          rationale: ["Threshold: ClCr <15 → contraindicated."],
          guideline: "Rivaroxaban SPC",
          recommendation: "Discontinue and switch anticoagulant.",
        }),
      );
    else if (ctx.clcr < 50)
      alerts.push(
        buildAlert({
          id: "rivaroxaban-reduce",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Reduce Rivaroxaban to 15 mg OD",
          detail: `ClCr = ${ctx.clcr} mL/min (15–49).`,
          rationale: ["Threshold: ClCr 15–49 → reduce."],
          guideline: "Rivaroxaban SPC",
          recommendation: "Reduce dose to 15 mg OD.",
        }),
      );
  }

  // Dabigatran — renal + age + verapamil
  if (onMed("dabigatran")) {
    if (ctx.clcr != null) {
      if (ctx.clcr < 30)
        alerts.push(
          buildAlert({
            id: "dabigatran-avoid",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Avoid Dabigatran (ClCr <30)",
            detail: `ClCr = ${ctx.clcr} mL/min.`,
            rationale: ["Threshold: ClCr <30 → contraindicated."],
            guideline: "Dabigatran SPC",
            recommendation: "Discontinue and switch anticoagulant.",
          }),
        );
      else if (ctx.clcr <= 50)
        alerts.push(
          buildAlert({
            id: "dabigatran-reduce-renal",
            severity: "alert",
            category: "drug-dose",
            group: "Drug Safety",
            title: "Reduce Dabigatran to 110 mg BD",
            detail: `ClCr = ${ctx.clcr} mL/min (30–50).`,
            rationale: ["Threshold: ClCr 30–50 → reduce."],
            guideline: "Dabigatran SPC",
            recommendation: "Reduce dose to 110 mg BD.",
          }),
        );
    }
    if (p.age >= 60) {
      reminders.push(
        buildAlert({
          id: "dabigatran-age",
          severity: "reminder",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Review Dabigatran dose (age ≥60)",
          detail: `Age = ${p.age}. Consider 110 mg BD if bleeding risk elevated.`,
          rationale: ["Age ≥60 is a dose-reduction consideration."],
        }),
      );
    }
    if (onMed("verapamil")) {
      alerts.push(
        buildAlert({
          id: "dabigatran-verapamil",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Dabigatran + Verapamil interaction — reduce to 110 mg BD",
          detail: "Verapamil increases dabigatran exposure.",
          rationale: ["Concomitant verapamil use."],
          guideline: "Dabigatran SPC — drug interaction",
          recommendation: "Reduce dabigatran to 110 mg BD.",
        }),
      );
    }
  }

  // Edoxaban — weight / renal
  if (onMed("edoxaban")) {
    const reasons: string[] = [];
    if (ctx.clcr != null && ctx.clcr >= 15 && ctx.clcr <= 50)
      reasons.push(`ClCr ${ctx.clcr} (15–50)`);
    if ((p.vitals?.weight ?? Infinity) <= 60)
      reasons.push(`Weight ${p.vitals?.weight} kg ≤60`);
    if (reasons.length) {
      alerts.push(
        buildAlert({
          id: "edoxaban-reduce",
          severity: "alert",
          category: "drug-dose",
          group: "Drug Safety",
          title: "Reduce Edoxaban to 30 mg OD",
          detail: reasons.join("; "),
          rationale: reasons,
          guideline: "Edoxaban SPC",
          recommendation: "Reduce dose to 30 mg OD.",
        }),
      );
    }
  }

  return { alerts, reminders, pinrrPct };
}
