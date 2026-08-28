const fs = require('fs');
const path = require('path');

// HARD CLIENT ROUTING: live/current/sports/news questions bypass direct Gemini.
const clientFile = path.join(process.cwd(), 'src/services/aiEngine.ts');
let source = fs.readFileSync(clientFile, 'utf8');
const directKey = 'const directApiKey=getStoredGeminiApiKey();';
const liveGuard = "if(needsLiveSearch(params.message)) return callNativeServerChat(params);";
if (!source.includes(liveGuard)) {
  if (!source.includes(directKey)) throw new Error('MKUU: direct Gemini routing marker not found.');
  source = source.replace(directKey, `${liveGuard}\n${directKey}`);
}
const fnStart = source.indexOf('function needsLiveSearch(message:string){');
if (fnStart === -1) throw new Error('MKUU: needsLiveSearch function not found.');
const fnEnd = source.indexOf('\nasync function ', fnStart);
if (fnEnd === -1) throw new Error('MKUU: needsLiveSearch function boundary not found.');
const liveFn = `function needsLiveSearch(message:string){const lower=String(message||'').toLowerCase();const patterns=[/\\bwaziri mkuu\\b/,/\\brais wa\\b/,/\\bmakamu wa rais\\b/,/\\bkiongozi wa sasa\\b/,/\\bmkuu wa nchi\\b/,/\\bmkuu wa serikali\\b/,/\\bmeya wa\\b/,/\\bnaibu\\s+waziri\\b/,/\\bwaziri wa\\b/,/\\bserikali ya sasa\\b/,/\\bcurrent\\b/,/\\blatest\\b/,/\\bsasa\\b/,/\\bwa sasa\\b/,/\\bleo\\b/,/\\bjana\\b/,/\\bjuzi\\b/,/\\bkesho\\b/,/\\byesterday\\b/,/\\btoday\\b/,/\\btomorrow\\b/,/\\bhivi punde\\b/,/\\bhabari mpya\\b/,/\\bhabari za leo\\b/,/\\bbreaking\\b/,/\\bbei ya\\b/,/\\bthamani ya\\b/,/\\bexchange rate\\b/,/\\brate ya\\b/,/\\bmatokeo ya\\b/,/\\bratiba ya\\b/,/\\bmsimamo wa\\b/,/\\bnani ameshinda\\b/,/\\bnani kashinda\\b/,/\\bmechi\\b/,/\\bmchezo\\b/,/\\banacheza\\b/,/\\bamecheza\\b/,/\\bkucheza\\b/,/\\bmpinzani\\b/,/\\bopponent\\b/,/\\bfixture\\b/,/\\bscore\\b/,/\\blive score\\b/,/\\bsports?\\b/,/\\bsoka\\b/,/\\bfootball\\b/,/\\byanga\\b/,/\\bsimba\\b/,/\\bazam\\b/,/\\bpamba jiji\\b/,/\\bcoastal union\\b/,/\\bjkt tanzania\\b/,/\\bnamungo\\b/,/\\bmashujaa\\b/,/\\bkagera sugar\\b/,/\\bsingida\\b/,/\\bgeita gold\\b/,/\\bchampions league\\b/,/\\bcaf\\b/,/\\bnews\\b/];return patterns.some(p=>p.test(lower));}`;
source = source.slice(0, fnStart) + liveFn + source.slice(fnEnd);
fs.writeFileSync(clientFile, source);

// HARD BACKEND ROUTING: the live branch in /api/chat goes straight to Exa.
// Gemini is not called for current/live/sports/news queries, including as a
// fallback or as a synthesis model. Normal non-live chat remains unchanged.
const serverFile = path.join(process.cwd(), 'server.ts');
let server = fs.readFileSync(serverFile, 'utf8');
const exaImport = "import { processExaLiveSearch } from './server/exaLiveSearch.js';";
if (!server.includes(exaImport)) {
  const anchor = "import { universalAgent } from './server/agentEngine.js';";
  if (!server.includes(anchor)) throw new Error('MKUU: server import anchor not found.');
  server = server.replace(anchor, `${anchor}\n${exaImport}`);
}
const oldResult = "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
const newResult = "const result=currentFactQuery ? await processExaLiveSearch(message) : await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
if (server.includes(oldResult)) server = server.replace(oldResult, newResult);
else if (!server.includes(newResult)) throw new Error('MKUU: /api/chat result routing target not found.');
fs.writeFileSync(serverFile, server);
console.log('[MKUU] EXA-ONLY LIVE SEARCH: Gemini is bypassed for live/current/sports/news queries, including synthesis/fallback.');
