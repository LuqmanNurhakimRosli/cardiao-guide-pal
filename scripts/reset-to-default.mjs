import fs from "fs";
import path from "path";

const benchmarkPath = path.resolve("src/shared/data/benchmark_patients.json");
const targetPath = path.resolve("src/shared/data/patients.json");

if (!fs.existsSync(benchmarkPath)) {
  console.error("❌ Error: benchmark_patients.json not found at", benchmarkPath);
  process.exit(1);
}

const benchmarkData = fs.readFileSync(benchmarkPath, "utf8");
fs.writeFileSync(targetPath, benchmarkData, "utf8");

const patients = JSON.parse(benchmarkData);
console.log("========================================================");
console.log("🔄 SYSTEM RESET SUCCESSFUL: RESTORED TO DEFAULT (FASA 1)");
console.log("========================================================");
console.log(`✅ Restored ${patients.length} core benchmark cases (P001 - P012).`);
console.log("✅ Hospital dataset detached from main patient registry.");
console.log("✅ System is in pure default state.");
