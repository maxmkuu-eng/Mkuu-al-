const fs = require('fs');
const path = require('path');

// IMPORTANT: Live/current/news/sports answers are Exa-only by design.
// Never inject Gemini synthesis into the Exa live-search path.
const file = path.join(process.cwd(), 'server', 'geminiService.ts');
const source = fs.readFileSync(file, 'utf8');

if (/MKUU EXA LIVE SEARCH EVIDENCE - synthesize this evidence into the answer/.test(source)) {
  throw new Error('MKUU: Gemini synthesis is still present in the Exa live-search path. Remove it from server/geminiService.ts before building.');
}

console.log('MKUU: Exa live-search remains EXA-ONLY; Gemini synthesis is disabled.');
