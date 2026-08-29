const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

// Keep this build-time patch intentionally simple: the root live-provider patch
// performs the full Exa -> Gemini evidence-synthesis replacement later in the
// build chain. This script must never contain nested template literals that can
// break Node parsing.
source = source.replace(
  /import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/,
  "import { searchWithExa } from './exaSearch.js';\n",
);

const intentTerms = [
  'habari', 'news', 'taarifa', 'msanii', 'celebrity', 'zuchu', 'diamond',
  'harmonize', 'alikiba', 'rayvanny', 'mwanamuziki', 'amejifungua',
  'kujifungua', 'amefariki', 'ameoa', 'ameolewa', 'amepata mtoto',
  'mtoto gani', 'mtoto wa kike', 'mtoto wa kiume', 'uvumi', 'rumour',
  'rumor', 'imethibitishwa', 'confirmed', 'imebainika', 'habari mpya',
  'habari za leo', 'hivi punde', 'latest', 'current', 'sasa', 'wa sasa',
];

const marker = 'const searchKeywords = [';
if (source.includes(marker) && !source.includes("'mtoto gani'")) {
  source = source.replace(marker, marker + intentTerms.map((x) => JSON.stringify(x)).join(',') + ',');
}

fs.writeFileSync(file, source);
console.log('MKUU: Exa live-search build preflight applied; root provider patch will install the full evidence-synthesis flow.');
