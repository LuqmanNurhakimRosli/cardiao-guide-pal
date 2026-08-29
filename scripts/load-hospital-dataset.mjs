import fs from "fs";
import path from "path";

const hospitalPath = path.resolve("src/shared/data/hospital_patients_2024.json");
const benchmarkPath = path.resolve("src/shared/data/benchmark_patients.json");
const targetPath = path.resolve("src/shared/data/patients.json");

if (!fs.existsSync(hospitalPath) || !fs.existsSync(benchmarkPath)) {
  console.error("❌ Error: dataset files not found");
  process.exit(1);
}

const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, "utf8"));
const hospital = JSON.parse(fs.readFileSync(hospitalPath, "utf8"));

const combined = [...benchmark, ...hospital];
fs.writeFileSync(targetPath, JSON.stringify(combined, null, 2), "utf8");

console.log("========================================================");
console.log("🏥 HOSPITAL DUAL-COHORT LOADED SUCCESSFULLY");
console.log("========================================================");
console.log(`✅ Benchmark Cohort: ${benchmark.length} patients`);
console.log(`✅ Hospital Cohort: ${hospital.length} patients`);
console.log(`✅ Total Active Patients: ${combined.length} patients`);
