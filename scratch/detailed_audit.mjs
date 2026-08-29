import fs from 'fs';

const depData = JSON.parse(fs.readFileSync('scratch/dependency_analysis.json', 'utf8'));
const { allFiles, importGraph, reverseGraph } = depData;

// Let's identify all routes:
const routes = allFiles.filter(f => f.startsWith('src/routes/'));
console.log('--- ALL ROUTES ---');
routes.forEach(r => console.log(r));

// Let's identify all cdss components, ui components, hooks, api, services, lib, cdss engine files, etc.
console.log('\n--- CDSS COMPONENTS USAGE ---');
const cdssComponents = allFiles.filter(f => f.startsWith('src/components/cdss/'));
cdssComponents.forEach(c => {
  const users = reverseGraph[c] || [];
  console.log(`${c} -> used by (${users.length}):`);
  users.forEach(u => console.log(`   - ${u}`));
});

console.log('\n--- UI COMPONENTS USAGE ---');
const uiComponents = allFiles.filter(f => f.startsWith('src/components/ui/'));
const uiUsage = {};
uiComponents.forEach(c => {
  const users = reverseGraph[c] || [];
  uiUsage[c] = users;
});

console.log('\n--- HOOKS USAGE ---');
const hooks = allFiles.filter(f => f.startsWith('src/hooks/'));
hooks.forEach(h => {
  const users = reverseGraph[h] || [];
  console.log(`${h} -> used by (${users.length}):`);
  users.forEach(u => console.log(`   - ${u}`));
});

console.log('\n--- API / SERVICES USAGE ---');
const apisAndServices = allFiles.filter(f => f.startsWith('src/api/') || f.startsWith('src/services/'));
apisAndServices.forEach(a => {
  const users = reverseGraph[a] || [];
  console.log(`${a} -> used by (${users.length}):`);
  users.forEach(u => console.log(`   - ${u}`));
});

console.log('\n--- CDSS ENGINE / RULES USAGE ---');
const cdssRules = allFiles.filter(f => f.startsWith('src/cdss/'));
cdssRules.forEach(a => {
  const users = reverseGraph[a] || [];
  console.log(`${a} -> used by (${users.length}):`);
  users.forEach(u => console.log(`   - ${u}`));
});

console.log('\n--- LIB / EMR USAGE ---');
const libFiles = allFiles.filter(f => f.startsWith('src/lib/'));
libFiles.forEach(a => {
  const users = reverseGraph[a] || [];
  console.log(`${a} -> used by (${users.length}):`);
  users.forEach(u => console.log(`   - ${u}`));
});

console.log('\n--- DATA USAGE ---');
const dataFiles = allFiles.filter(f => f.startsWith('src/data/'));
dataFiles.forEach(a => {
  const users = reverseGraph[a] || [];
  console.log(`${a} -> used by (${users.length}):`);
  users.forEach(u => console.log(`   - ${u}`));
});
