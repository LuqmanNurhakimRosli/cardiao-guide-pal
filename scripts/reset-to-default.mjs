import fs from 'fs';
import path from 'path';

const benchmarkPath = path.resolve('src/shared/data/benchmark_patients.json');
const targetPath = path.resolve('src/shared/data/patients.json');

if (!fs.existsSync(benchmarkPath)) {
  console.error("❌ Benchmark backup file not found at src/shared/data/benchmark_patients.json");
  process.exit(1);
}

const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

// Write pure benchmark dataset
fs.writeFileSync(targetPath, JSON.stringify(benchmarkData, null, 2), 'utf8');

console.log(`\n========================================================`);
console.log(`🔄 SYSTEM RESET SUCCESSFUL: RESTORED TO DEFAULT (FASA 1)`);
console.log(`========================================================`);
console.log(`✅ Restored ${benchmarkData.length} core benchmark cases (P001 - P012).`);
console.log(`✅ HASA UiTM 493 dataset detached from main patient registry.`);
console.log(`✅ System is in pure default state.\n`);
