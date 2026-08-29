import fs from 'fs';
import path from 'path';
import { evaluateCdssRules } from './src/shared/cdss/engine.js';

const rootDir = process.cwd();
const realPatients = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/shared/data/real_patients_2024.json'), 'utf8'));

console.log(`\n========================================================`);
console.log(`🏥 EVALUATING CDSS ENGINE ON ${realPatients.length} REAL HASA UITM AF PATIENTS`);
console.log(`========================================================\n`);

let totalAlertsCount = 0;
const alertTypes: Record<string, number> = {};
const alertSeverities: Record<string, number> = {};
let strokeRiskCount = 0;
let bleedingRiskCount = 0;
let doacDoseReviewCount = 0;
let doacAvoidCount = 0;
let bpAlertCount = 0;
let hba1cAlertCount = 0;

realPatients.forEach((patient: any) => {
  const result = evaluateCdssRules({
    patient,
    clinicianInputs: {
      afConfirmed: true,
      chaConfirmed: true,
      hasBledConfirmed: true,
    }
  });

  totalAlertsCount += result.alerts.length;

  result.alerts.forEach((alert: any) => {
    alertTypes[alert.type] = (alertTypes[alert.type] || 0) + 1;
    alertSeverities[alert.severity] = (alertSeverities[alert.severity] || 0) + 1;
    
    if (alert.type === 'stroke_risk') strokeRiskCount++;
    if (alert.type === 'bleeding_risk') bleedingRiskCount++;
    if (alert.type === 'drug_dose_review') doacDoseReviewCount++;
    if (alert.type === 'drug_contraindication') doacAvoidCount++;
    if (alert.type === 'blood_pressure_uncontrolled' || alert.type === 'blood_pressure_single_reading') bpAlertCount++;
    if (alert.type === 'glycemic_control') hba1cAlertCount++;
  });
});

console.log(`Total Alerts Generated: ${totalAlertsCount}`);
console.log(`Average Alerts Per Patient: ${(totalAlertsCount / realPatients.length).toFixed(2)}`);

console.log(`\nAlert Breakdown by Severity:`);
Object.entries(alertSeverities).forEach(([sev, cnt]) => {
  console.log(`  - ${sev.toUpperCase()}: ${cnt} (${((cnt / totalAlertsCount) * 100).toFixed(1)}%)`);
});

console.log(`\nAlert Breakdown by Clinical Category:`);
Object.entries(alertTypes).forEach(([type, cnt]) => {
  console.log(`  - ${type}: ${cnt} instances`);
});

console.log(`\nSample Real Patient Output (Patient #1 - CTC0050673):`);
const sampleResult = evaluateCdssRules({
  patient: realPatients[0],
  clinicianInputs: { afConfirmed: true, chaConfirmed: true, hasBledConfirmed: true }
});
console.log(`  Name: ${realPatients[0].name}, Age: ${realPatients[0].age}, CrCl: ${sampleResult.crcl?.crcl} mL/min`);
console.log(`  CHA2DS2-VA Score: ${sampleResult.cha2ds2va.total} (${sampleResult.cha2ds2va.category})`);
console.log(`  HAS-BLED Score: ${sampleResult.hasBled.total} (${sampleResult.hasBled.category})`);
console.log(`  Alerts (${sampleResult.alerts.length}):`);
sampleResult.alerts.forEach((a: any) => console.log(`    [${a.severity.toUpperCase()}] ${a.title}`));
