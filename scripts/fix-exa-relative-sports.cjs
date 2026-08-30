const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'server', 'exaSearch.ts');
if (!fs.existsSync(file)) throw new Error('[EXA-SPORTS] server/exaSearch.ts not found');
let source = fs.readFileSync(file, 'utf8');
const oldText = "function isFinalResultQuery(q:string){return /\\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|won|lost|draw|final)\\b/i.test(q)&&!/\\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho|leo|today)\\b/i.test(q);}";
const newText = "function isFinalResultQuery(q:string){return /\\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|zimeishaje|imeishaje|yameishaje|zimekwisha|zimeisha|won|lost|draw|final)\\b/i.test(q)&&!/\\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho|leo|today)\\b/i.test(q);}";
if (source.includes(oldText)) {
  source = source.replace(oldText, newText);
  fs.writeFileSync(file, source, 'utf8');
  console.log('[EXA-SPORTS] Relative-date match-result questions now route to final-result extraction.');
} else if (source.includes('zimeishaje|imeishaje|yameishaje|zimekwisha')) {
  console.log('[EXA-SPORTS] Relative-date result detection already enabled.');
} else {
  throw new Error('[EXA-SPORTS] Final-result intent target not found.');
}
