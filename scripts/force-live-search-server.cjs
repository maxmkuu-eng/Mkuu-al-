const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/services/aiEngine.ts');
let source = fs.readFileSync(file, 'utf8');

// HARD ROUTING RULE: current/live/sports/news questions must reach the backend
// before a user-stored Gemini key can be considered. The backend's live path is
// Exa -> evidence, so direct Gemini cannot answer these questions from memory.
const directKey = 'const directApiKey=getStoredGeminiApiKey();';
const liveGuard = "if(needsLiveSearch(params.message)) return callNativeServerChat(params);";
if (!source.includes(liveGuard)) {
  if (!source.includes(directKey)) throw new Error('MKUU: direct Gemini routing marker not found.');
  source = source.replace(directKey, `${liveGuard}\n${directKey}`);
}

// Replace the live-intent function rather than relying on fragile tail markers.
const fnStart = source.indexOf('function needsLiveSearch(message:string){');
if (fnStart === -1) throw new Error('MKUU: needsLiveSearch function not found.');
const fnEnd = source.indexOf('\nasync function ', fnStart);
if (fnEnd === -1) throw new Error('MKUU: needsLiveSearch function boundary not found.');
const liveFn = `function needsLiveSearch(message:string){const lower=String(message||'').toLowerCase();const patterns=[/\\bwaziri mkuu\\b/,/\\brais wa\\b/,/\\bmakamu wa rais\\b/,/\\bkiongozi wa sasa\\b/,/\\bmkuu wa nchi\\b/,/\\bmkuu wa serikali\\b/,/\\bmeya wa\\b/,/\\bnaibu\\s+waziri\\b/,/\\bwaziri wa\\b/,/\\bserikali ya sasa\\b/,/\\bcurrent\\b/,/\\blatest\\b/,/\\bsasa\\b/,/\\bwa sasa\\b/,/\\bleo\\b/,/\\bjana\\b/,/\\bjuzi\\b/,/\\bkesho\\b/,/\\byesterday\\b/,/\\btoday\\b/,/\\btomorrow\\b/,/\\bhivi punde\\b/,/\\bhabari mpya\\b/,/\\bhabari za leo\\b/,/\\bbreaking\\b/,/\\bbei ya\\b/,/\\bthamani ya\\b/,/\\bexchange rate\\b/,/\\brate ya\\b/,/\\bmatokeo ya\\b/,/\\bratiba ya\\b/,/\\bmsimamo wa\\b/,/\\bnani ameshinda\\b/,/\\bnani kashinda\\b/,/\\bmechi\\b/,/\\bmchezo\\b/,/\\banacheza\\b/,/\\bamecheza\\b/,/\\bkucheza\\b/,/\\bmpinzani\\b/,/\\bopponent\\b/,/\\bfixture\\b/,/\\bscore\\b/,/\\blive score\\b/,/\\bsports?\\b/,/\\bsoka\\b/,/\\bfootball\\b/,/\\byanga\\b/,/\\bsimba\\b/,/\\bazam\\b/,/\\bpamba jiji\\b/,/\\bcoastal union\\b/,/\\bjkt tanzania\\b/,/\\bnamungo\\b/,/\\bmashujaa\\b/,/\\bkagera sugar\\b/,/\\bsingida\\b/,/\\bgeita gold\\b/,/\\bchampions league\\b/,/\\bcaf\\b/,/\\bnews\\b/];return patterns.some(p=>p.test(lower));}`;
source = source.slice(0, fnStart) + liveFn + source.slice(fnEnd);

fs.writeFileSync(file, source);
console.log('[MKUU] HARD LIVE ROUTING: current/relative-date/sports/news queries bypass direct Gemini and use MKUU backend.');
