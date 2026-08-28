const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'exaSearch.ts');
let source = fs.readFileSync(file, 'utf8');

const old = "if (/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa)\\b/i.test(text)) score -= 8;";
const replacement = "if (/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|starts? on|starting at|it starts|itaikabili|inatarajiwa|will meet|will take on|fixture|upcoming)\\b/i.test(text)) score -= 12;";

if (source.includes(old)) {
  source = source.replace(old, replacement);
} else if (!source.includes('starts? on|starting at')) {
  throw new Error('EXA SPORTS RANKING patch target missing in server/exaSearch.ts');
}

fs.writeFileSync(file, source);
console.log('MKUU: Exa sports ranking now strongly rejects pre-match and scheduled-match evidence.');
