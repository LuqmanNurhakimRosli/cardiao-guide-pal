import type { Patient } from "../types";

export function creatinineClearance(p: Patient): {
  clcr?: number;
  missing: string[];
  sourceDates?: { creatinine_date?: string; weight_date?: string };
  formula_working?: string;
} {
  const missing: string[] = [];
  const age = p.age_at_encounter ?? p.age;
  if (age == null) missing.push("age");
  if (!p.sex) missing.push("sex");

  const weight = p.vitals?.weight_record?.value ?? p.vitals?.weight;
  const weightDate = p.vitals?.weight_record?.date;
  if (!weight) missing.push("weight");

  const scr = p.labs?.creatinine_record?.value ?? p.labs?.creatinine;
  const scrUnit = p.labs?.creatinine_record?.unit ?? p.labs?.creatinine_unit ?? "umol/L";
  const scrDate = p.labs?.creatinine_record?.date;
  if (!scr) missing.push("serum creatinine");

  if (missing.length) return { missing };

  // Convert to umol/L if in mg/dL
  const scrUmol = scrUnit === "mg/dL" ? scr! * 88.4 : scr!;

  // Formula as per CPG Malaysia & ESC Guidelines:
  // Male:   CrCl = ((140 - age) * weight * 1.23) / serum_creatinine (umol/L)
  // Female: CrCl = ((140 - age) * weight * 1.04) / serum_creatinine (umol/L)
  const isFemale = p.sex?.toLowerCase() === "female";
  const multiplier = isFemale ? 1.04 : 1.23;
  const clcr = ((140 - age!) * weight! * multiplier) / scrUmol;

  const formulaWorking = isFemale
    ? `(140 - ${age}) × ${weight} kg × 1.04 / ${scrUmol} µmol/L = ${clcr.toFixed(1)} mL/min`
    : `(140 - ${age}) × ${weight} kg × 1.23 / ${scrUmol} µmol/L = ${clcr.toFixed(1)} mL/min`;

  return {
    clcr: Math.round(clcr * 10) / 10,
    missing: [],
    sourceDates: {
      creatinine_date: scrDate,
      weight_date: weightDate,
    },
    formula_working: formulaWorking,
  };
}
