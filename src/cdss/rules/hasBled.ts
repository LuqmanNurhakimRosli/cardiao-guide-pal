export interface HasBledInputs {
  hypertension: boolean;
  abnormalRenal: boolean;
  abnormalLiver: boolean;
  stroke: boolean;
  bleedingHistory: boolean;
  labileINR: boolean;
  elderly: boolean;
  drugs: boolean;
  alcohol: boolean;
}

export function hasBled(i: HasBledInputs) {
  const breakdown: Record<string, number> = {
    Hypertension: i.hypertension ? 1 : 0,
    "Abnormal renal": i.abnormalRenal ? 1 : 0,
    "Abnormal liver": i.abnormalLiver ? 1 : 0,
    Stroke: i.stroke ? 1 : 0,
    "Bleeding history": i.bleedingHistory ? 1 : 0,
    "Labile INR": i.labileINR ? 1 : 0,
    "Elderly >65": i.elderly ? 1 : 0,
    Drugs: i.drugs ? 1 : 0,
    Alcohol: i.alcohol ? 1 : 0,
  };
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown, highRisk: total >= 3 };
}
