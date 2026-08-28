const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'exaSearch.ts');
let source = fs.readFileSync(file, 'utf8');

const old = "if (/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa)\\b/i.test(t))s-=8;";
const replacement = "if (/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|starts? on|starting at|it starts|itaikabili|inatarajiwa|will meet|will take on|fixture|upcoming)\\b/i.test(t))s-=12;";

if (source.includes(replacement)) {
  console.log('MKUU: Exa sports ranking patch already applied; skipping.');
} else if (source.includes(old)) {
  source = source.replace(old, replacement);
  fs.writeFileSync(file, source);
  console.log('MKUU: Exa sports ranking now strongly rejects pre-match and scheduled-match evidence.');
} else {
  // This is a non-essential build-time ranking enhancement. Do not make CI fail
  // when exaSearch.ts has already been refactored by another patch.
  console.log('MKUU: Exa sports ranking target not found; preserving current implementation and continuing build.');
}
