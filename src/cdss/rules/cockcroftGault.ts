import type { Patient } from "../types";

export function creatinineClearance(p: Patient): {
  clcr?: number;
  missing: string[];
} {
  const missing: string[] = [];
  if (p.age == null) missing.push("age");
  if (!p.sex) missing.push("sex");
  if (!p.vitals?.weight) missing.push("weight");
  if (!p.labs?.creatinine) missing.push("serum creatinine");
  if (missing.length) return { missing };

  const unit = p.labs.creatinine_unit ?? "umol/L";
  const scrMgDl =
    unit === "mg/dL" ? p.labs.creatinine! : p.labs.creatinine! / 88.4;
  let clcr = ((140 - p.age) * p.vitals.weight!) / (72 * scrMgDl);
  if (p.sex === "female") clcr *= 0.85;
  return { clcr: Math.round(clcr * 10) / 10, missing: [] };
}
