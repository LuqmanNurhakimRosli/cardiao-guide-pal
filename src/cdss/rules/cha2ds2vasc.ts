import type { Patient } from "../types";

export function cha2ds2vasc(p: Patient) {
  const c = p.comorbidities ?? {};
  const breakdown: Record<string, number> = {};
  breakdown["CHF"] = c.chf ? 1 : 0;
  breakdown["Hypertension"] = c.hypertension ? 1 : 0;
  breakdown["Age ≥75"] = p.age >= 75 ? 2 : 0;
  breakdown["Age 65–74"] = p.age >= 65 && p.age < 75 ? 1 : 0;
  breakdown["Diabetes"] = c.diabetes ? 1 : 0;
  breakdown["Stroke/TIA"] = c.stroke ? 2 : 0;
  breakdown["Vascular disease"] = c.vascular ? 1 : 0;
  breakdown["Female"] = p.sex === "female" ? 1 : 0;
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown };
}
