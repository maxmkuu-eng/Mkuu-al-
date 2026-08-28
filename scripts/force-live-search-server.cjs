const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/services/aiEngine.ts');
let source = fs.readFileSync(file, 'utf8');

// Current/latest/today/yesterday/sports/news questions must never use a
// user-stored Gemini key directly. Route them through the MKUU backend so the
// backend can apply the real-time Tanzania clock + live-search policy.
const marker = "  const directApiKey=getStoredGeminiApiKey();";
const guard = "  if(needsLiveSearch(params.message)) return callNativeServerChat(params);\n";
if (!source.includes(guard)) {
  if (!source.includes(marker)) throw new Error('MKUU: direct Gemini routing marker not found.');
  source = source.replace(marker, guard + marker);
}

// Expand the live intent detector for sports/news and relative-date wording.
const oldTail = "/\\b2025\\b/,/\\b2026\\b/];return patterns.some(p=>p.test(lower));";
const newTail = "/\\b2025\\b/,/\\b2026\\b/,/\\bjana\\b/,/\\byesterday\\b/,/\\bjuzi\\b/,/\\bkesho\\b/,/\\btomorrow\\b/,/\\bmechi\\b/,/\\bcheza\\b/,/\\banacheza\\b/,/\\bfootball\\b/,/\\bsoka\\b/,/\\bsports?\\b/,/\\blive score\\b/,/\\bnews\\b/,/\\bbreaking\\b/,/\\bjust now\\b/];return patterns.some(p=>p.test(lower));";
if (source.includes(oldTail) && !source.includes('/\\bjana\\b/')) {
  source = source.replace(oldTail, newTail);
}

fs.writeFileSync(file, source);
console.log('[MKUU] Forced live/current queries through MKUU backend; expanded today/yesterday/sports intent.');
