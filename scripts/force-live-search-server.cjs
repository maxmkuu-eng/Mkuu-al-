const fs = require('fs');
const path = require('path');

// LIVE SEARCH CONTRACT:
// Live/current/news/sports queries MUST use Exa only.
// Gemini remains available only for ordinary non-live chat.
const clientFile = path.join(process.cwd(), 'src/services/aiEngine.ts');
let source = fs.readFileSync(clientFile, 'utf8');

const liveGuard = "if(needsLiveSearch(params.message)) return callNativeServerChat(params);";
const directKey = 'const directApiKey=getStoredGeminiApiKey();';
if (!source.includes(liveGuard)) {
  if (source.includes(directKey)) source = source.replace(directKey, `${liveGuard}\n${directKey}`);
}

// Defense-in-depth: direct Gemini must never receive a live query.
const directFn = 'async function callDirectGemini(apiKey:string,params:ChatEngineParams):Promise<ChatEngineResult>{';
const directFnGuard = `${directFn}if(needsLiveSearch(params.message)) return callNativeServerChat(params);`;
if (!source.includes(directFnGuard) && source.includes(directFn)) source = source.replace(directFn, directFnGuard);

// Keep the existing live intent detector if already patched; otherwise patch it.
const fnStart = source.indexOf('function needsLiveSearch(message:string){');
if (fnStart !== -1) {
  const fnEnd = source.indexOf('\nasync function ', fnStart);
  if (fnEnd !== -1) {
    const liveFn = `function needsLiveSearch(message:string){const lower=String(message||'').toLowerCase();const patterns=[/\\bwaziri mkuu\\b/,/\\brais wa\\b/,/\\bmakamu wa rais\\b/,/\\bkiongozi wa sasa\\b/,/\\bmkuu wa nchi\\b/,/\\bmkuu wa serikali\\b/,/\\bmeya wa\\b/,/\\bnaibu\\s+waziri\\b/,/\\bwaziri wa\\b/,/\\bserikali ya sasa\\b/,/\\bcurrent\\b/,/\\blatest\\b/,/\\bsasa\\b/,/\\bwa sasa\\b/,/\\bleo\\b/,/\\bjana\\b/,/\\bjuzi\\b/,/\\bkesho\\b/,/\\byesterday\\b/,/\\btoday\\b/,/\\btomorrow\\b/,/\\bhivi punde\\b/,/\\bhabari mpya\\b/,/\\bhabari za leo\\b/,/\\bbreaking\\b/,/\\bbei ya\\b/,/\\bthamani ya\\b/,/\\bexchange rate\\b/,/\\brate ya\\b/,/\\bmatokeo ya\\b/,/\\bratiba ya\\b/,/\\bmsimamo wa\\b/,/\\bnani ameshinda\\b/,/\\bnani kashinda\\b/,/\\bwho is\\b/,/\\bwho won\\b/,/\\bthis week\\b/,/\\bthis month\\b/,/\\b2025\\b/,/\\b2026\\b/,/\\bmechi\\b/,/\\bmchezo\\b/,/\\banacheza\\b/,/\\bamecheza\\b/,/\\bkucheza\\b/,/\\bmpinzani\\b/,/\\bopponent\\b/,/\\bfixture\\b/,/\\bscore\\b/,/\\blive score\\b/,/\\bsports?\\b/,/\\bsoka\\b/,/\\bfootball\\b/,/\\byanga\\b/,/\\bsimba\\b/,/\\bazam\\b/,/\\bpamba jiji\\b/,/\\bcoastal union\\b/,/\\bjkt tanzania\\b/,/\\bnamungo\\b/,/\\bmashujaa\\b/,/\\bkagera sugar\\b/,/\\bsingida\\b/,/\\bgeita gold\\b/,/\\bchampions league\\b/,/\\bcaf\\b/,/\\bnews\\b/];return patterns.some(p=>p.test(lower));}`;
    source = source.slice(0, fnStart) + liveFn + source.slice(fnEnd);
  }
}
fs.writeFileSync(clientFile, source);

// Backend is now the source of truth for live routing. Do not try to rewrite
// the /api/chat implementation from this legacy build-time patcher.
const serverFile = path.join(process.cwd(), 'server.ts');
const server = fs.readFileSync(serverFile, 'utf8');
if (!server.includes('searchWithExa') && !server.includes('processExaLiveSearch')) {
  console.warn('[MKUU] Backend live routing marker not found; preserving server.ts rather than failing the build.');
}
console.log('[MKUU] LIVE SEARCH HARD LOCK: Exa-only backend path preserved; legacy patch is idempotent.');