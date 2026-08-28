import fs from 'fs';
import path from 'path';
import { evaluate } from './src/cdss/engine.js';

const realPatients = JSON.parse(fs.readFileSync('./src/data/real_patients_2024.json', 'utf8'));

console.log(`\n========================================================`);
console.log(`🏥 CDSS BATCH EVALUATION: ${realPatients.length} REAL HASA UITM AF PATIENTS`);
console.log(`========================================================\n`);

let totalAlertsCount = 0;
const alertTypes = {};
const alertSeverities = {};
let strokeRiskCount = 0;
let bleedingRiskCount = 0;
let doseReviewCount = 0;
let contraindicationCount = 0;
let bpAlertCount = 0;
let hba1cAlertCount = 0;

realPatients.forEach((patient) => {
  const result = evaluate(patient, {
    afConfirmed: true,
  });

  totalAlertsCount += result.alerts.length;

  result.alerts.forEach((alert) => {
    alertTypes[alert.category || alert.group || 'other'] = (alertTypes[alert.category || alert.group || 'other'] || 0) + 1;
    alertSeverities[alert.severity] = (alertSeverities[alert.severity] || 0) + 1;
    
    if (alert.category === 'stroke-risk' || alert.group === 'Stroke Prevention') strokeRiskCount++;
    if (alert.category === 'bleeding-risk' || alert.group === 'Bleeding Risk') bleedingRiskCount++;
    if (alert.category === 'renal-dose' || alert.category === 'age-dose' || alert.category === 'weight-dose') doseReviewCount++;
    if (alert.category === 'contraindication') contraindicationCount++;
    if (alert.category === 'blood-pressure' || alert.group === 'Blood Pressure') bpAlertCount++;
    if (alert.category === 'glycemic' || alert.group === 'Glycemic Control') hba1cAlertCount++;
  });
});

console.log(`✅ Total CDSS Alerts Triggered: ${totalAlertsCount}`);
console.log(`📊 Average Alerts Per Patient: ${(totalAlertsCount / realPatients.length).toFixed(2)}`);

console.log(`\nAlert Breakdown by Severity:`);
Object.entries(alertSeverities).forEach(([sev, cnt]) => {
  console.log(`  - ${sev.toUpperCase()}: ${cnt} (${((cnt / totalAlertsCount) * 100).toFixed(1)}%)`);
});

console.log(`\nAlert Breakdown by Clinical Group:`);
Object.entries(alertTypes).forEach(([type, cnt]) => {
  console.log(`  - ${type}: ${cnt} instances`);
});

console.log(`\nKey Clinical Findings:`);
console.log(`  - Oral Anticoagulation Indicated (CHA2DS2-VA >= 2): ${strokeRiskCount} / 493 patients (${((strokeRiskCount/realPatients.length)*100).toFixed(1)}%)`);
console.log(`  - High Bleeding Risk Flag (HAS-BLED >= 3): ${bleedingRiskCount} / 493 patients (${((bleedingRiskCount/realPatients.length)*100).toFixed(1)}%)`);
console.log(`  - Blood Pressure Clinical Alerts: ${bpAlertCount} instances`);
console.log(`  - Glycemic Control (HbA1c > 7.0%) Alerts: ${hba1cAlertCount} instances`);

console.log(`\n========================================================`);
console.log(`Sample Real Patient CDSS Result (Patient #1 - CTC0050673):`);
const sampleResult = evaluate(realPatients[0], { afConfirmed: true });
console.log(`  Name: ${realPatients[0].name}, Age: ${realPatients[0].age}`);
console.log(`  CHA2DS2-VA Score: ${sampleResult.scores.cha2ds2va?.total}`);
console.log(`  HAS-BLED Score: ${sampleResult.scores.has_bled?.total}`);
console.log(`  Alerts (${sampleResult.alerts.length}):`);
sampleResult.alerts.forEach((a) => console.log(`    • [${a.severity.toUpperCase()}] ${a.title}`));
console.log(`========================================================\n`);
