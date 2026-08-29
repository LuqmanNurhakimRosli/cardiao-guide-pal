import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
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

  content = content.replace(/@\/cdss\/usePatientState/g, '@/pages/assessment/hooks/usePatientState');
  content = content.replace(/@\/api\/cdssApi/g, '@/pages/assessment/api/cdssApi');
  content = content.replace(/@\/services\/cdssService/g, '@/pages/assessment/api/cdssService');
  content = content.replace(/@\/components\/cdss\/AfConfirmationModal/g, '@/pages/assessment/components/AfConfirmationModal');
  content = content.replace(/@\/components\/cdss\/AfEvidenceCard/g, '@/pages/assessment/components/AfEvidenceCard');
  content = content.replace(/@\/components\/cdss\/Cha2ds2VascHybrid/g, '@/pages/assessment/components/Cha2ds2VascHybrid');
  content = content.replace(/@\/components\/cdss\/ClinicGateBanner/g, '@/pages/assessment/components/ClinicGateBanner');
  content = content.replace(/@\/components\/cdss\/HasBledCalculator/g, '@/pages/assessment/components/HasBledCalculator');
  content = content.replace(/@\/components\/cdss\/MissingDataCard/g, '@/pages/assessment/components/MissingDataCard');
  content = content.replace(/@\/components\/cdss\/ScoreEvidenceModal/g, '@/pages/assessment/components/ScoreEvidenceModal');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated imports in: ${file}`);
  }
});
