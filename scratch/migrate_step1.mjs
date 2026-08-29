import fs from 'fs';
import path from 'path';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function moveFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  fs.unlinkSync(src);
  console.log(`Moved: ${src} -> ${dst}`);
}

// 1. Move UI components
const uiFiles = fs.readdirSync('src/components/ui');
uiFiles.forEach(f => {
  moveFile(`src/components/ui/${f}`, `src/shared/components/ui/${f}`);
});
fs.rmdirSync('src/components/ui');

// 2. Move AppShell
moveFile('src/components/cdss/AppShell.tsx', 'src/shared/components/layout/AppShell.tsx');

// 3. Move hook
moveFile('src/hooks/use-mobile.tsx', 'src/shared/hooks/use-mobile.tsx');
try { fs.rmdirSync('src/hooks'); } catch (e) {}

// 4. Move lib/utils
moveFile('src/lib/utils.ts', 'src/shared/lib/utils.ts');

// 5. Move lib/emr
const emrFiles = fs.readdirSync('src/lib/emr');
emrFiles.forEach(f => {
  moveFile(`src/lib/emr/${f}`, `src/shared/lib/emr/${f}`);
});
fs.rmdirSync('src/lib/emr');
try { fs.rmdirSync('src/lib'); } catch (e) {}

// 6. Move data
const dataFiles = fs.readdirSync('src/data');
dataFiles.forEach(f => {
  moveFile(`src/data/${f}`, `src/shared/data/${f}`);
});
fs.rmdirSync('src/data');

// 7. Move CDSS rules and core engine
ensureDir('src/shared/cdss/rules');
const ruleFiles = fs.readdirSync('src/cdss/rules');
ruleFiles.forEach(f => {
  moveFile(`src/cdss/rules/${f}`, `src/shared/cdss/rules/${f}`);
});
fs.rmdirSync('src/cdss/rules');

const cdssCoreFiles = [
  'afDetection.ts',
  'config.ts',
  'engine.ts',
  'pinrr.ts',
  'researchTimeline.ts',
  'ruleManifest.ts',
  'ruleTraceability.ts',
  'schemas.ts',
  'server.functions.ts',
  'types.ts'
];

cdssCoreFiles.forEach(f => {
  if (fs.existsSync(`src/cdss/${f}`)) {
    moveFile(`src/cdss/${f}`, `src/shared/cdss/${f}`);
  }
});

console.log('Step 1 file moves complete. Now updating imports...');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (['node_modules', '.git', '.tanstack', '.output', '.wrangler'].includes(file)) return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) results = results.concat(walk(filePath));
    else if (/\.(ts|tsx|js|jsx|json|mjs)$/.test(filePath)) results.push(filePath);
  });
  return results;
}

const allCodeFiles = walk('.');

allCodeFiles.forEach(file => {
  if (file.startsWith('scratch') || file.includes('package-lock.json')) return;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replacements
  content = content.replace(/@\/components\/ui\//g, '@/shared/components/ui/');
  content = content.replace(/@\/components\/cdss\/AppShell/g, '@/shared/components/layout/AppShell');
  content = content.replace(/@\/hooks\/use-mobile/g, '@/shared/hooks/use-mobile');
  content = content.replace(/@\/lib\/utils/g, '@/shared/lib/utils');
  content = content.replace(/@\/lib\/emr\//g, '@/shared/lib/emr/');
  content = content.replace(/@\/data\//g, '@/shared/data/');
  content = content.replace(/src\/data\//g, 'src/shared/data/');
  
  // CDSS imports:
  // Note: usePatientState is still in src/cdss/usePatientState.ts for now until Step 2
  // We replace @/cdss/(everything else) -> @/shared/cdss/$1
  content = content.replace(/@\/cdss\/(?!usePatientState)/g, '@/shared/cdss/');

  // Relative imports inside src/shared/
  if (file.startsWith('src' + path.sep + 'shared') || file.startsWith('src/shared')) {
    // Relative imports fix if needed
  }

  // Update test scripts and root scripts referencing ./src/cdss/... or src/data/...
  content = content.replace(/\.\/src\/cdss\//g, './src/shared/cdss/');
  content = content.replace(/src\/cdss\/rules\//g, 'src/shared/cdss/rules/');
  content = content.replace(/src\/cdss\//g, 'src/shared/cdss/');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated imports in: ${file}`);
  }
});

console.log('Step 1 import updates finished.');
