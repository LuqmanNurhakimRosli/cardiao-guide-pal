import fs from 'fs';

const depData = JSON.parse(fs.readFileSync('scratch/dependency_analysis.json', 'utf8'));
const { allFiles } = depData;

console.log(`Total files: ${allFiles.length}`);

// Let's create mapping:
const planMapping = {};

allFiles.forEach(f => {
  let target = '';
  
  // Routes (remain in src/routes as route entries delegating to src/pages)
  if (f.startsWith('src/routes/')) {
    target = f; // Keep route definition, delegate to pages
  }
  // Root level in src
  else if (f === 'src/router.tsx' || f === 'src/routeTree.gen.ts' || f === 'src/styles.css') {
    target = f;
  }
  // Integrations
  else if (f.startsWith('src/integrations/')) {
    target = f; // Unchanged structurally
  }
  // UI components
  else if (f.startsWith('src/components/ui/')) {
    target = f.replace('src/components/ui/', 'src/shared/components/ui/');
  }
  // Hooks
  else if (f.startsWith('src/hooks/')) {
    target = f.replace('src/hooks/', 'src/shared/hooks/');
  }
  // Lib / EMR
  else if (f.startsWith('src/lib/')) {
    target = f.replace('src/lib/', 'src/shared/lib/');
  }
  // Data
  else if (f.startsWith('src/data/')) {
    target = f.replace('src/data/', 'src/shared/data/');
  }
  // Assessment components
  else if ([
    'src/components/cdss/AfConfirmationModal.tsx',
    'src/components/cdss/AfEvidenceCard.tsx',
    'src/components/cdss/Cha2ds2VascHybrid.tsx',
    'src/components/cdss/ClinicGateBanner.tsx',
    'src/components/cdss/HasBledCalculator.tsx',
    'src/components/cdss/MissingDataCard.tsx',
    'src/components/cdss/ScoreEvidenceModal.tsx'
  ].includes(f)) {
    const base = f.split('/').pop();
    target = `src/pages/assessment/components/${base}`;
  }
  // AlertCard
  else if (f === 'src/components/cdss/AlertCard.tsx') {
    target = 'src/pages/alerts/components/AlertCard.tsx';
  }
  // AppShell (shared layout shell)
  else if (f === 'src/components/cdss/AppShell.tsx') {
    target = 'src/shared/components/layout/AppShell.tsx';
  }
  // CDSS API / Services / State hook
  else if (f === 'src/api/cdssApi.ts') {
    target = 'src/pages/assessment/api/cdssApi.ts';
  }
  else if (f === 'src/services/cdssService.ts') {
    target = 'src/pages/assessment/api/cdssService.ts';
  }
  else if (f === 'src/cdss/usePatientState.ts') {
    target = 'src/pages/assessment/hooks/usePatientState.ts';
  }
  // CDSS engine & clinical rules
  else if (f.startsWith('src/cdss/')) {
    target = f.replace('src/cdss/', 'src/shared/cdss/');
  }
  else {
    target = 'UNKNOWN: ' + f;
  }
  
  planMapping[f] = target;
});

let unmapped = 0;
for (const [src, dst] of Object.entries(planMapping)) {
  if (dst.startsWith('UNKNOWN')) {
    console.log('Unmapped:', src);
    unmapped++;
  }
}

console.log(`Mapping finished. Total unmapped: ${unmapped}`);
fs.writeFileSync('scratch/plan_mapping.json', JSON.stringify(planMapping, null, 2));
