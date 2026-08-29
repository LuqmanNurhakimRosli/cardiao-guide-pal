import type { Patient } from "../types";

export function cha2ds2va(p: Patient) {
  const c = p.comorbidities ?? {};
  const age = p.age_at_encounter ?? p.age;
  const breakdown: Record<string, number> = {};
  breakdown["CHF"] = c.chf ? 1 : 0;
  breakdown["Hypertension"] = c.hypertension ? 1 : 0;
  breakdown["Age ≥75"] = age >= 75 ? 2 : 0;
  breakdown["Age 65–74"] = age >= 65 && age < 75 ? 1 : 0;
  breakdown["Diabetes"] = c.diabetes ? 1 : 0;
  breakdown["Stroke/TIA"] = c.stroke ? 2 : 0;
  breakdown["Vascular disease"] = c.vascular ? 1 : 0;
  // Note: Sex category (Sc) is removed in CHA₂DS₂-VA per 2026.08.26 amendment
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown };
}

/** @deprecated Compatibility alias. Canonical clinical engine uses CHA₂DS₂-VA. */
export const cha2ds2vasc = cha2ds2va;
