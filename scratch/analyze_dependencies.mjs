import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (['node_modules', '.git', '.tanstack', '.output', '.wrangler'].includes(file)) return;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) results = results.concat(walk(filePath));
    else if (/\.(ts|tsx|js|jsx|json)$/.test(filePath)) results.push(filePath);
  });
  return results;
}

const allFiles = walk('src').map(f => f.replace(/\\/g, '/'));
const importGraph = {}; // file -> [importedFiles]
const reverseGraph = {}; // file -> [filesThatImportIt]

allFiles.forEach(f => {
  importGraph[f] = [];
  reverseGraph[f] = [];
});

// Match multiline imports and exports
const importRegex = /(?:import|export)\s+(?:(?:[\s\S]*?from\s+)|(?:\(\s*))['"]([^'"]+)['"]\)?/g;

allFiles.forEach(file => {
  if (file.endsWith('.json')) return;
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath) continue;
    
    // Resolve @/ or relative
    let resolved = null;
    if (importPath.startsWith('@/')) {
      const sub = importPath.slice(2);
      const candidates = [
        `src/${sub}`,
        `src/${sub}.ts`,
        `src/${sub}.tsx`,
        `src/${sub}.js`,
        `src/${sub}.jsx`,
        `src/${sub}/index.ts`,
        `src/${sub}/index.tsx`,
        `src/${sub}.json`
      ];
      for (const c of candidates) {
        if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) {
          resolved = c.replace(/\\/g, '/');
          break;
        }
      }
    } else if (importPath.startsWith('.')) {
      const dir = path.dirname(file);
      const rel = path.join(dir, importPath);
      const candidates = [
        rel,
        `${rel}.ts`,
        `${rel}.tsx`,
        `${rel}.js`,
        `${rel}.jsx`,
        `${rel}/index.ts`,
        `${rel}/index.tsx`,
        `${rel}.json`
      ];
      for (const c of candidates) {
        if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) {
          resolved = c.replace(/\\/g, '/');
          break;
        }
      }
    }
    
    if (resolved) {
      if (!importGraph[file].some(i => i.resolved === resolved)) {
        importGraph[file].push({ raw: importPath, resolved });
      }
      if (!reverseGraph[resolved]) reverseGraph[resolved] = [];
      if (!reverseGraph[resolved].includes(file)) {
        reverseGraph[resolved].push(file);
      }
    }
  }
});

fs.writeFileSync('scratch/dependency_analysis.json', JSON.stringify({
  allFiles,
  importGraph,
  reverseGraph
}, null, 2));

console.log('Analysis complete. Total files:', allFiles.length);
