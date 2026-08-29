const fs = require('fs');
const path = require('path');

// Verification only. The actual live-provider rewrite is performed by
// fix-live-provider-root.cjs later in the build chain.
const file = path.join(process.cwd(), 'server', 'geminiService.ts');
const source = fs.readFileSync(file, 'utf8');

if (/searchWithTavily/.test(source)) {
  throw new Error('MKUU: Tavily is still present in the live chat service. Exa must be the live provider.');
}

if (!source.includes("searchWithExa")) {
  throw new Error('MKUU: Exa live provider import is missing from geminiService.ts.');
}

console.log('MKUU: Exa live-search evidence is verified; Gemini synthesis may use Exa evidence only.');
