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
  if (!source.includes(directKey)) throw new Error('MKUU: direct Gemini routing marker not found.');
  source = source.replace(directKey, `${liveGuard}\n${directKey}`);
}

// Defense-in-depth: even if executeMkuuChat is changed later, direct Gemini
// itself can never receive a live query.
const directFn = 'async function callDirectGemini(apiKey:string,params:ChatEngineParams):Promise<ChatEngineResult>{';
const directFnGuard = `${directFn}if(needsLiveSearch(params.message)) return callNativeServerChat(params);`;
if (!source.includes(directFnGuard)) {
  if (!source.includes(directFn)) throw new Error('MKUU: callDirectGemini function not found.');
  source = source.replace(directFn, directFnGuard);
}

// Keep live intent broad enough for current facts and sports/news.
const fnStart = source.indexOf('function needsLiveSearch(message:string){');
if (fnStart === -1) throw new Error('MKUU: needsLiveSearch function not found.');
const fnEnd = source.indexOf('\nasync function ', fnStart);
if (fnEnd === -1) throw new Error('MKUU: needsLiveSearch function boundary not found.');
const liveFn = `function needsLiveSearch(message:string){const lower=String(message||'').toLowerCase();const patterns=[/\\bwaziri mkuu\\b/,/\\brais wa\\b/,/\\bmakamu wa rais\\b/,/\\bkiongozi wa sasa\\b/,/\\bmkuu wa nchi\\b/,/\\bmkuu wa serikali\\b/,/\\bmeya wa\\b/,/\\bnaibu\\s+waziri\\b/,/\\bwaziri wa\\b/,/\\bserikali ya sasa\\b/,/\\bcurrent\\b/,/\\blatest\\b/,/\\bsasa\\b/,/\\bwa sasa\\b/,/\\bleo\\b/,/\\bjana\\b/,/\\bjuzi\\b/,/\\bkesho\\b/,/\\byesterday\\b/,/\\btoday\\b/,/\\btomorrow\\b/,/\\bhivi punde\\b/,/\\bhabari mpya\\b/,/\\bhabari za leo\\b/,/\\bbreaking\\b/,/\\bbei ya\\b/,/\\bthamani ya\\b/,/\\bexchange rate\\b/,/\\brate ya\\b/,/\\bmatokeo ya\\b/,/\\bratiba ya\\b/,/\\bmsimamo wa\\b/,/\\bnani ameshinda\\b/,/\\bnani kashinda\\b/,/\\bwho is\\b/,/\\bwho won\\b/,/\\btoday\\b/,/\\btonight\\b/,/\\bthis week\\b/,/\\bthis month\\b/,/\\b2025\\b/,/\\b2026\\b/,/\\bmechi\\b/,/\\bmchezo\\b/,/\\banacheza\\b/,/\\bamecheza\\b/,/\\bkucheza\\b/,/\\bmpinzani\\b/,/\\bopponent\\b/,/\\bfixture\\b/,/\\bscore\\b/,/\\blive score\\b/,/\\bsports?\\b/,/\\bsoka\\b/,/\\bfootball\\b/,/\\byanga\\b/,/\\bsimba\\b/,/\\bazam\\b/,/\\bpamba jiji\\b/,/\\bcoastal union\\b/,/\\bjkt tanzania\\b/,/\\bnamungo\\b/,/\\bmashujaa\\b/,/\\bkagera sugar\\b/,/\\bsingida\\b/,/\\bgeita gold\\b/,/\\bchampions league\\b/,/\\bcaf\\b/,/\\bnews\\b/];return patterns.some(p=>p.test(lower));}`;
source = source.slice(0, fnStart) + liveFn + source.slice(fnEnd);
fs.writeFileSync(clientFile, source);

// HARD BACKEND ROUTING: patch the actual /api/chat handler so live requests
// enter Exa before geminiService.processChat. This is deliberately done at
// build time too, protecting the existing source from legacy Google-search code.
const serverFile = path.join(process.cwd(), 'server.ts');
let server = fs.readFileSync(serverFile, 'utf8');
const exaImport = "import { processExaLiveSearch } from './server/exaLiveSearch.js';";
if (!server.includes(exaImport)) {
  const anchor = "import { universalAgent } from './server/agentEngine.js';";
  if (!server.includes(anchor)) throw new Error('MKUU: server import anchor not found.');
  server = server.replace(anchor, `${anchor}\n${exaImport}`);
}

const backendLiveGuard = "if (currentFactQuery) return await processExaLiveSearch(String(message));";
if (!server.includes(backendLiveGuard)) {
  const anchor = "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
  if (server.includes(anchor)) {
    server = server.replace(anchor, `${backendLiveGuard}\n    ${anchor}`);
  } else {
    const old = "const result=currentFactQuery ? await processExaLiveSearch(message) : await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
    if (!server.includes(old)) throw new Error('MKUU: /api/chat Gemini routing target not found.');
    server = server.replace(old, backendLiveGuard);
  }
}
fs.writeFileSync(serverFile, server);
console.log('[MKUU] LIVE SEARCH HARD LOCK: Exa ONLY; Gemini allowed only for ordinary non-live chat.');