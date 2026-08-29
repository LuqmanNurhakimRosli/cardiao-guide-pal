import { evaluate } from '../src/cdss/engine.ts';

// Test 1: Hypertensive patient with no BP readings
const p1: any = {
  patient_id: 'TEST-HTN-NO-BP',
  name: 'Test HTN Missing BP',
  age: 68,
  sex: 'male',
  clinic_location: 'Cardiology Clinic',
  diagnoses: ['I48.0', 'I10'],
  ecg_results: ['Atrial Fibrillation'],
  medications: [],
  vitals: { weight: 70 },
  labs: { creatinine: 90 },
  comorbidities: { hypertension: true, diabetes: false },
};

const r1 = evaluate(p1, { afConfirmed: true });
console.log('Test 1 (HTN with missing BP):');
console.log('Alerts:', r1.alerts.map(a => a.id));
const hasHtnMissingAlert = r1.alerts.some(a => a.id === 'bp-hypertension-missing');
console.log('-> Has bp-hypertension-missing alert?', hasHtnMissingAlert);

// Test 2: Diabetic patient with no HbA1c reading
const p2: any = {
  patient_id: 'TEST-DM-NO-HBA1C',
  name: 'Test DM Missing HbA1c',
  age: 65,
  sex: 'female',
  clinic_location: 'Cardiology Clinic',
  diagnoses: ['I48.0', 'E11'],
  ecg_results: ['Atrial Fibrillation'],
  medications: [],
  vitals: { bp_latest: '120/80', weight: 60 },
  labs: { creatinine: 85 },
  comorbidities: { hypertension: false, diabetes: true },
};

const r2 = evaluate(p2, { afConfirmed: true });
console.log('\nTest 2 (DM with missing HbA1c):');
console.log('Alerts:', r2.alerts.map(a => a.id));
const hasDmMissingAlert = r2.alerts.some(a => a.id === 'hba1c-missing');
console.log('-> Has hba1c-missing alert?', hasDmMissingAlert);

if (!hasHtnMissingAlert || !hasDmMissingAlert) {
  process.exit(1);
} else {
  console.log('\n✅ ALL MISSING VITALS / LABS TESTS PASSED!');
}
