import fs from 'fs';
import path from 'path';

const depData = JSON.parse(fs.readFileSync('scratch/dependency_analysis.json', 'utf8'));
const { importGraph, reverseGraph } = depData;

const routes = Object.keys(importGraph).filter(f => f.startsWith('src/routes/'));

console.log('=== ROUTE IMPORTS BREAKDOWN ===\n');

for (const route of routes) {
  console.log(`Route: ${route}`);
  const directImports = importGraph[route] || [];
  console.log('  Direct imports:');
  for (const imp of directImports) {
    console.log(`    - ${imp.resolved} (${imp.raw})`);
  }
  console.log('');
}
