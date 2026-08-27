/**
 * Automated Hands-On Test Suite for AF-CArE 2026.08.26 Remediation
 */
import { cha2ds2va } from "./src/cdss/rules/cha2ds2vasc.js";
import { hasBled, evaluateHasBledAlert } from "./src/cdss/rules/hasBled.js";
import { creatinineClearance } from "./src/cdss/rules/cockcroftGault.js";
import { evaluateBP } from "./src/cdss/rules/bloodPressure.js";
import { evaluateHbA1c } from "./src/cdss/rules/hba1c.js";
import { evaluateAnticoagulants } from "./src/cdss/rules/anticoagulants.js";
import { calculatePinrr } from "./src/cdss/pinrr.js";
import { classifyDateWindow } from "./src/cdss/researchTimeline.js";
import { evaluate } from "./src/cdss/engine.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log("\n========================================================");
console.log("🧪 RUNNING HANDS-ON VERIFICATION SUITE (2026.08.26 AMENDMENT)");
console.log("========================================================\n");

// 1. CHA2DS2-VA (Sex points removed, threshold >= 2 for all)
console.log("1. CHA2DS2-VA Scoring & Threshold Tests:");
const femaleScore1 = { age: 60, sex: "female", comorbidities: { hypertension: true } };
const femaleScore2 = { age: 66, sex: "female", comorbidities: { hypertension: true } }; // 66yo (+1) + HTN (+1) = 2
assert(cha2ds2va(femaleScore1).total === 1, "Female HTN Age 60 score = 1 (no sex points)");
assert(cha2ds2va(femaleScore2).total === 2, "Female HTN Age 66 score = 2");

const resScore1 = evaluate({ ...femaleScore1, patient_id: "T1", name: "Test", clinic_location: "Cardiology Clinic", diagnoses: ["I48.0"], ecg_results: ["AF"], medications: [], vitals: {}, labs: {} }, { afConfirmed: true });
assert(resScore1.alerts.filter(a => a.id === "stroke-prevention").length === 0, "CHA2DS2-VA = 1 does NOT trigger stroke alert");

const resScore2 = evaluate({ ...femaleScore2, patient_id: "T2", name: "Test", clinic_location: "Cardiology Clinic", diagnoses: ["I48.0"], ecg_results: ["AF"], medications: [], vitals: {}, labs: {} }, { afConfirmed: true });
assert(resScore2.alerts.filter(a => a.id === "stroke-prevention").length === 1, "CHA2DS2-VA = 2 triggers stroke alert for female (previously needed 3)");

// 2. HAS-BLED Informational Alert
console.log("\n2. HAS-BLED Scoring & Informational Alert:");
const hbHigh = hasBled({ hypertension: true, abnormalRenal: true, abnormalLiver: false, stroke: true, bleedingHistory: false, labileINR: false, elderly: true, drugs: false, alcohol: false });
assert(hbHigh.total === 4 && hbHigh.highRisk, "HAS-BLED total = 4 (high risk)");
const hbAlert = evaluateHasBledAlert(hbHigh.total, hbHigh.breakdown);
assert(hbAlert !== null && hbAlert.detail.includes("not contraindicated"), "HAS-BLED >= 3 emits informational alert ('not contraindicated solely by score')");

// 3. Cockcroft-Gault CrCl
console.log("\n3. Cockcroft-Gault CrCl Calculation:");
const crclPatient = {
  age: 78,
  sex: "female",
  vitals: { weight: 55 },
  labs: { creatinine: 140, creatinine_unit: "umol/L" },
};
const crclResult = creatinineClearance(crclPatient);
// (140 - 78) * 55 / (72 * (140/88.4)) * 0.85 = 62 * 55 / (72 * 1.5837) * 0.85 = 3410 / 114.027 * 0.85 = 29.9 * 0.85 = 25.4
assert(crclResult.clcr !== undefined && crclResult.clcr > 20 && crclResult.clcr < 35, `CrCl calculated correctly: ${crclResult.clcr} mL/min`);

// 4. Blood Pressure
console.log("\n4. Blood Pressure (2 readings, no averaging):");
const bp1Only = evaluateBP({ vitals: { bp_readings: [{ value: "150/95", date: "2026-08-26" }] } });
assert(bp1Only.reminders.some(r => r.id === "bp-missing-second"), "1 BP reading produces reminder to obtain second reading");

const bpUncontrolled = evaluateBP({ vitals: { bp_readings: [{ value: "150/95", date: "2026-08-26" }, { value: "148/92", date: "2026-08-26" }] } });
assert(bpUncontrolled.alerts.some(a => a.id === "bp-uncontrolled"), "Both BP >140/90 triggers uncontrolled BP alert");

// 5. HbA1c
console.log("\n5. HbA1c Evaluation (>7.0%):");
const hb70 = evaluateHbA1c({ labs: { hba1c: 7.0 } });
const hb71 = evaluateHbA1c({ labs: { hba1c: 7.1 } });
assert(hb70.alerts.length === 0, "HbA1c = 7.0% -> No alert");
assert(hb71.alerts.some(a => a.id === "hba1c-high"), "HbA1c = 7.1% -> Alert triggered");

// 6. PINRR (< 56% over 12 months, min 2 readings)
console.log("\n6. PINRR Calculation (12 months lookback):");
const inrSeries = [
  { value: 1.5, date: "2026-01-10" },
  { value: 3.5, date: "2026-03-15" },
  { value: 2.4, date: "2026-06-20" },
  { value: 1.8, date: "2026-08-10" },
]; // 1 in range out of 4 = 25% (< 56%)
const pinrrRes = calculatePinrr(inrSeries, "2026-08-26");
assert(pinrrRes.percentage === 25, `PINRR computed = ${pinrrRes.percentage}%`);

// 7. Dabigatran Age Bands & Precedence
console.log("\n7. Dabigatran Age Bands & Dose Guard:");
const dabi81 = evaluateAnticoagulants({ age: 81, medications: [{ name: "Dabigatran", dose: "150 mg BD" }] }, { clcr: 65 });
assert(dabi81.alerts.some(a => a.id === "dabigatran-age-80" && a.title.includes("Recommend")), "Age 81 on 150 mg BD -> 'Recommend' 110 mg BD alert");

const dabi76 = evaluateAnticoagulants({ age: 76, medications: [{ name: "Dabigatran", dose: "150 mg BD" }] }, { clcr: 65 });
assert(dabi76.alerts.some(a => a.id === "dabigatran-age-75-79" && a.title.includes("Consider")), "Age 76 on 150 mg BD -> 'Consider' 110 mg BD alert (separate card)");

const dabi74 = evaluateAnticoagulants({ age: 74, medications: [{ name: "Dabigatran", dose: "150 mg BD" }] }, { clcr: 65 });
assert(!dabi74.alerts.some(a => a.id.includes("dabigatran-age")), "Age 74 on 150 mg BD -> No age reduction alert");

const dabiAlready110 = evaluateAnticoagulants({ age: 82, medications: [{ name: "Dabigatran", dose: "110 mg BD" }] }, { clcr: 65 });
assert(dabiAlready110.alerts.length === 0, "Dabigatran already on 110 mg BD -> Alert suppressed (Dose Guard)");

// 8. Precedence Resolver (Avoid suppresses dose reduction)
console.log("\n8. Precedence Resolver (Avoid suppresses Dose Review):");
const rivaSevereRenal = evaluateAnticoagulants({ medications: [{ name: "Rivaroxaban", dose: "20 mg OD" }] }, { clcr: 12 });
assert(rivaSevereRenal.alerts.length === 1 && rivaSevereRenal.alerts[0].id === "rivaroxaban-avoid", "Rivaroxaban CrCl 12 -> Only 'Avoid' alert emitted; dose reduction suppressed");

const apixSevereRenal = evaluateAnticoagulants({ age: 82, vitals: { weight: 50 }, labs: { creatinine: 150 }, medications: [{ name: "Apixaban", dose: "5 mg BD" }] }, { clcr: 12 });
assert(apixSevereRenal.alerts.length === 1 && apixSevereRenal.alerts[0].id === "apixaban-avoid", "Apixaban CrCl 12 -> Only 'Avoid' alert emitted; 2-of-3 reduction suppressed");

// 9. Research Timeline Classification
console.log("\n9. Research Timeline Windows (-12m, Index Date, +3m):");
assert(classifyDateWindow("2026-02-15", "2026-08-26") === "pre-alert", "Date 6 months before index -> pre-alert");
assert(classifyDateWindow("2026-08-25", "2026-08-26") === "pre-alert", "Date 1 day before index -> pre-alert");
assert(classifyDateWindow("2026-08-26", "2026-08-26") === "index", "Date of encounter -> index");
assert(classifyDateWindow("2026-08-27", "2026-08-26") === "post-alert", "Date 1 day after index -> post-alert");
assert(classifyDateWindow("2026-10-15", "2026-08-26") === "post-alert", "Date 2 months after index -> post-alert");
assert(classifyDateWindow("2027-02-01", "2026-08-26") === "outside", "Date > 3 months after index -> outside");

console.log("\n========================================================");
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("========================================================\n");

if (failed > 0) process.exit(1);
