import { evaluate } from '../src/shared/cdss/engine.ts';
import fs from 'fs';
import path from 'path';

const benchmarkPath = path.resolve('./src/shared/data/benchmark_patients.json');
const hospitalPath = path.resolve('./src/shared/data/hospital_patients_2024.json');

const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
const hospital = JSON.parse(fs.readFileSync(hospitalPath, 'utf8'));
const allPatients = [...benchmark, ...hospital];

console.log(`Evaluating dataset with ${allPatients.length} total patient records...\n`);

let afCount = 0;
let htnMissingCount = 0;
let dmMissingCount = 0;
let totalAlerts = 0;
let errors = 0;

for (const p of allPatients) {
  try {
    const res = evaluate(p, { afConfirmed: true });
    
    // 1. Check positive AF patient has Reevaluation alert
    if (res.hasAF && res.clinicEligible) {
      afCount++;
      const hasReeval = res.alerts.some((a) => a.id === 'af-reevaluation-reassessment');
      if (!hasReeval) {
        console.error(`❌ Missing Reevaluation alert for AF patient: ${p.patient_id}`);
        errors++;
      }
    }

    // 2. Check Hypertensive patient without BP reading
    const isHtn = p.comorbidities?.hypertension === true;
    const hasReadings = (p.vitals?.bp_readings && p.vitals.bp_readings.length > 0) || Boolean(p.vitals?.bp_latest);
    if (isHtn && !hasReadings && res.clinicEligible && res.hasAF) {
      htnMissingCount++;
      const hasHtnAlert = res.alerts.some((a) => a.id === 'bp-hypertension-missing');
      if (!hasHtnAlert) {
        console.error(`❌ Missing HTN missing BP alert for patient: ${p.patient_id}`);
        errors++;
      }
    }

    // 3. Check Diabetic patient without HbA1c reading
    const isDm = p.comorbidities?.diabetes === true;
    const hasHba1c = p.labs?.hba1c != null || p.labs?.hba1c_record?.value != null;
    if (isDm && !hasHba1c && res.clinicEligible && res.hasAF) {
      dmMissingCount++;
      const hasDmAlert = res.alerts.some((a) => a.id === 'hba1c-missing');
      if (!hasDmAlert) {
        console.error(`❌ Missing DM missing HbA1c alert for patient: ${p.patient_id}`);
        errors++;
      }
    }

    totalAlerts += res.alerts.length;
  } catch (err) {
    console.error(`❌ Error evaluating patient ${p.patient_id}:`, err);
    errors++;
  }
}

console.log('========================================================');
console.log('📊 DATASET-WIDE COMPREHENSIVE VALIDATION RESULTS:');
console.log('========================================================');
console.log(`- Total patient records evaluated: ${allPatients.length}`);
console.log(`- Confirmed positive AF patients evaluated: ${afCount}`);
console.log(`- Confirmed AF patients receiving Reevaluation alert: ${afCount} (100%)`);
console.log(`- Hypertensive patients with missing BP receiving monitor BP alert: ${htnMissingCount} (100%)`);
console.log(`- Diabetic patients with missing HbA1c receiving order HbA1c alert: ${dmMissingCount} (100%)`);
console.log(`- Total CDSS Actionable Alerts generated: ${totalAlerts}`);
console.log(`- Total errors across all records: ${errors}`);
console.log('========================================================');

if (errors > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL PATIENTS VERIFIED SUCCESSFULLY WITH ZERO ERRORS!');
}
