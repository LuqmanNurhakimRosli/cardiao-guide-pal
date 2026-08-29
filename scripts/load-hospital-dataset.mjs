import fs from 'fs';
import path from 'path';

const benchmarkPath = path.resolve('src/shared/data/benchmark_patients.json');
const hospitalPath = path.resolve('src/shared/data/hospital_patients_2024.json');
const targetPath = path.resolve('src/shared/data/patients.json');

const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
const hospitalData = JSON.parse(fs.readFileSync(hospitalPath, 'utf8'));

const combined = [...benchmarkData, ...hospitalData];
fs.writeFileSync(targetPath, JSON.stringify(combined, null, 2), 'utf8');

console.log(`\n========================================================`);
console.log(`🏥 LOADED DUAL COHORT DATASET (BENCHMARK + HASA UITM)`);
console.log(`========================================================`);
console.log(`✅ Loaded ${benchmarkData.length} Benchmark Cases (P001 - P012).`);
console.log(`✅ Loaded ${hospitalData.length} Anonymized HASA UiTM Patient Cases (REAL-001 - REAL-493).`);
console.log(`✅ Total active patients: ${combined.length}.\n`);
