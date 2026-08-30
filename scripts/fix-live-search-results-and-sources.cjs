const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(path.join(root, rel), value, 'utf8');

function patch(rel, fn, label) {
  const before = read(rel);
  const after = fn(before);
  if (after !== before) {
    write(rel, after);
    console.log(`[MKUU-LIVE] ${label}: patched`);
  } else {
    console.log(`[MKUU-LIVE] ${label}: already patched/no-op`);
  }
}

// Live-search must bypass Gemini completely. The APK may have a direct Gemini key,
// so route every current/live query to the MKUU server before the direct-Gemini path.
patch('src/services/aiEngine.ts', (text) => {
  if (text.includes("if(needsLiveSearch(params.message))return callNativeServerChat(params);")) return text;
  const marker = "if(needsImageRoute(params))return callImageStudio(params);";
  if (!text.includes(marker)) return text;
  return text.replace(marker, marker + "if(needsLiveSearch(params.message))return callNativeServerChat(params);");
}, 'force live queries through server/Exa');

// Server-side live queries use Exa directly and return its answer + citations.
// No Gemini/Tavily/Google grounding is involved in this path.
patch('server.ts', (text) => {
  let out = text;
  if (!out.includes("import { searchWithExa } from './server/exaSearch.js';")) {
    out = out.replace("import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';", "import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';\nimport { searchWithExa } from './server/exaSearch.js';");
  }
  const old = "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
  if (!out.includes('let result:any;')) {
    const replacement = `let result:any;\n    if(currentFactQuery){\n      const live=await searchWithExa(message);\n      result={reply:live.answer,cleanSpeechText:live.answer.replace(/[#*\`_~\\[\\]\\(\\)]/g,' ').replace(/\\s+/g,' ').trim(),memoriesExtracted:[],peopleRecognized:[],generatedFiles:[],aiProvider:'Exa Live Search',chatModel:'Exa',latencyMs:0,webSources:live.citations};\n    }else{\n      result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});\n    }`;
    if (!out.includes(old)) throw new Error('server.ts live-search insertion marker not found');
    out = out.replace(old, replacement);
  }
  out = out.replace("generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)", "generatedFiles:result.generatedFiles,webSources:result.webSources||[],memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)");
  out = out.replace("generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};", "generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};");
  return out;
}, 'server Exa direct response + source bridge');

// Replace the old sports-result formatter with an all-match formatter for
// questions such as: "Mechi za jana Tanzania zimeisha kwa matokeo gani".
patch('server/exaSearch.ts', (text) => {
  const start = text.indexOf('export async function searchWithExa');
  if (start < 0) throw new Error('exaSearch.ts searchWithExa function not found');
  const replacement = `export async function searchWithExa(query:string):Promise<ExaSearchResult>{\n  const apiKey=resolveExaApiKey(), dates=tanzaniaDateContext();\n  const fresh=isFreshOrRelativeQuery(query), social=isSocialQuery(query), sports=isSportsQuery(query), news=isNewsQuery(query);\n  const finalResult=isFinalResultQuery(query), opponent=isOpponentQuestion(query);\n  const requestedDate=/\\b(jana|yesterday)\\b/i.test(query)?dates.yesterday:/\\b(juzi)\\b/i.test(query)?dates.twoDaysAgo:dates.today;\n  const allTanzaniaLeagueResults=sports&&finalResult&&/\\b(jana|yesterday)\\b/i.test(query)&&/\\b(tanzania|ligi|premier league|ligi kuu|bara|mechi)\\b/i.test(query);\n  const baseQuery=allTanzaniaLeagueResults\n    ? \`Tanzania Premier League Ligi Kuu Bara ALL FINAL RESULTS \\${requestedDate} \\${query}. List every completed league match played on this date with the final score. Exclude scheduled, preview, future, and older matches.\`\n    : \`\\${query}\\nCURRENT TANZANIA TIME: \\${dates.formatted}\\${fresh?`\\nREQUESTED EVENT DATE: \\${requestedDate}`:''}\`;\n  const body:any={query:baseQuery,type:fresh?'fast':'auto',numResults:allTanzaniaLeagueResults?20:(sports?12:(fresh?12:8)),contents:{highlights:true,text:true}};\n  if(fresh){body.startPublishedDate=allTanzaniaLeagueResults?new Date(\`\\${requestedDate}T00:00:00+03:00\`).toISOString():(sports&&finalResult?new Date(\`\\${requestedDate}T00:00:00+03:00\`).toISOString():new Date(Date.now()-7*86400000).toISOString());body.endPublishedDate=new Date(Date.now()+86400000).toISOString();body.maxAgeHours=0;}\n  async function runExa(searchQuery:string){const payload={...body,query:searchQuery};const response=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});if(!response.ok){const eb=await response.text().catch(()=> '');throw new Error('EXA_SEARCH_FAILED: HTTP '+response.status+(eb?' - '+eb.slice(0,500):''));}const data=await response.json() as any;return Array.isArray(data?.results)?data.results:[];}\n  const raw=allTanzaniaLeagueResults?(await Promise.all([runExa(baseQuery),runExa(\`Tanzania Ligi Kuu Bara results \\${requestedDate} final scores all matches\`)])).flat():await runExa(baseQuery);\n  const ranked=sports&&finalResult?[...raw].sort((a:any,b:any)=>resultStrength(b)-resultStrength(a)):news?[...raw].sort((a:any,b:any)=>newsEvidenceStrength(b)-newsEvidenceStrength(a)):raw;\n  const results=ranked.slice(0,allTanzaniaLeagueResults?20:(sports?10:(news?10:8)));\n  const citations=results.filter((x:any)=>x?.url).map((x:any)=>({title:String(x.title||x.url).trim(),url:String(x.url).trim()})).filter((x:any,i:number,a:any[])=>a.findIndex(y=>y.url===x.url)===i).slice(0,10);\n  if(allTanzaniaLeagueResults){\n    const teams=['Singida Black Stars','Polisi Tanzania','JKT Tanzania','TRA United','Dodoma Jiji','Tabora United','Namungo','Young Africans','Yanga','Pamba Jiji','Mbeya City','Fountain Gate','Geita Gold','Azam','Simba','Coastal Union','Mashujaa','Kagera Sugar'].sort((a,b)=>b.length-a.length);\n    const teamAlt=teams.map(t=>t.replace(/[.*+?^\\${}()|[\\]\\\\]/g,'\\\\$&')).join('|');\n    const matchRe=new RegExp(\`(\\${teamAlt})(?:\\\\s+(?:FC|SC))?\\\\s+(?:FT\\\\s*)?(\\\\d{1,2})\\\\s*[-–:]\\\\s*(\\\\d{1,2})\\\\s+(\\${teamAlt})(?:\\\\s+(?:FC|SC))?\`,'gi');\n    const matches=new Map<string,string>();\n    for(const item of results){const evidence=evidenceText(item);let m:RegExpExecArray|null;while((m=matchRe.exec(evidence))){const home=m[1].replace(/\\\\s+(?:FC|SC)$/i,'').trim(),away=m[4].replace(/\\\\s+(?:FC|SC)$/i,'').trim();matches.set(\`\\${home.toLowerCase()}|\\${away.toLowerCase()}\`,\`\\${home} \\${m[2]}-\\${m[3]} \\${away}\`);}}\n    if(matches.size){const lines=[...matches.values()].slice(0,12);return {answer:\`Matokeo ya Ligi Kuu Tanzania ya jana (\\${requestedDate}):\\n\\${lines.map(x=>\`- \\${x}\`).join('\\n')}\`,citations};}\n  }\n  let answer='';if(sports&&opponent)answer=extractOpponentAnswer(query,results)||'';else if(sports&&finalResult)answer=results.filter((x:any)=>resultStrength(x)>=6).slice(0,3).map((x:any)=>evidenceText(x).slice(0,500)).filter(Boolean).join('\\n\\n');else if(news&&isNewsFactQuestion(query))answer=extractNewsFactAnswer(query,results)||'';else answer=results.slice(0,social?3:(news?5:2)).map((x:any)=>evidenceText(x).slice(0,700)).filter(Boolean).join('\\n\\n').trim();\n  if(!answer)throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');return {answer,citations};\n}\n`;
  return text.slice(0,start)+replacement;
}, 'all Tanzania league results + concise answer + citations');

console.log('MKUU: live search now uses Exa directly, returns all requested Tanzania league results, and preserves source cards.');
`;
  return text.slice(0,start) + replacement;
}, 'all Tanzania league results + concise answer + citations');

console.log('MKUU: live search now uses Exa directly, returns all requested Tanzania league results, and preserves source cards.');
