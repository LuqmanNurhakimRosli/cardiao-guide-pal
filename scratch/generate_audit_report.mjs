import fs from 'fs';
import path from 'path';

const depData = JSON.parse(fs.readFileSync('scratch/dependency_analysis.json', 'utf8'));
const { allFiles, importGraph, reverseGraph } = depData;

console.log('Total files in src:', allFiles.length);

const categorized = {
  routes: allFiles.filter(f => f.startsWith('src/routes/')),
  components_cdss: allFiles.filter(f => f.startsWith('src/components/cdss/')),
  components_ui: allFiles.filter(f => f.startsWith('src/components/ui/')),
  hooks: allFiles.filter(f => f.startsWith('src/hooks/')),
  api_services: allFiles.filter(f => f.startsWith('src/api/') || f.startsWith('src/services/')),
  cdss_engine: allFiles.filter(f => f.startsWith('src/cdss/')),
  lib: allFiles.filter(f => f.startsWith('src/lib/')),
  integrations: allFiles.filter(f => f.startsWith('src/integrations/')),
  data: allFiles.filter(f => f.startsWith('src/data/')),
  root_src: allFiles.filter(f => !f.slice(4).includes('/'))
};

console.log('Categories breakdown:');
for (const [k, v] of Object.entries(categorized)) {
  console.log(`- ${k}: ${v.length} files`);
}

// Let's print each file and its reverse dependencies (who imports it)
console.log('\n================ DETAILS ================');
for (const [k, list] of Object.entries(categorized)) {
  console.log(`\n### ${k.toUpperCase()}`);
  for (const f of list) {
    const importers = reverseGraph[f] || [];
    console.log(`\n* File: ${f}`);
    console.log(`  Importers (${importers.length}):`);
    importers.forEach(imp => console.log(`    - ${imp}`));
  }
}
