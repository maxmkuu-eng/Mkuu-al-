const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');

function findMatchingBrace(source, openIndex) {
  let depth = 0, quote = null, escaped = false, line = false, block = false;
  for (let i = openIndex; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) { if (escaped) { escaped = false; continue; } if (c === '\\') { escaped = true; continue; } if (c === quote) quote = null; continue; }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

let exa = read('server/exaSearch.ts');
const start = exa.indexOf('export async function searchWithExa(');
if (start >= 0) {
  const open = exa.indexOf('{', start);
  const close = open >= 0 ? findMatchingBrace(exa, open) : -1;
  if (open >= 0 && close >= 0) {
    const fn = `export async function searchWithExa(query:string):Promise<ExaSearchResult>{
  const apiKey=resolveExaApiKey();
  const dates=tanzaniaDateContext();
  const q=String(query||'').trim();
  const relative=/\\b(jana|yesterday|juzi|leo|today|latest|newest|current|sasa|wa sasa|hivi punde|habari mpya|habari za leo)\\b/i.test(q);
  const sports=isSportsQuery(q), news=isNewsQuery(q), social=isSocialQuery(q), finalResult=isFinalResultQuery(q), opponent=isOpponentQuestion(q);
  const requestedDate=/\\b(jana|yesterday)\\b/i.test(q)?dates.yesterday:/\\bjuzi\\b/i.test(q)?dates.twoDaysAgo:dates.today;
  const allMatches=sports&&finalResult&&/\\b(matokeo|mechi|mchezo|results?|scores?|zimeish|iliish|jana|yesterday)\\b/i.test(q)&&/\\b(tanzania|ligi kuu|ligi|premier league|bara)\\b/i.test(q);
  const baseContext=`TANZANIA TIME: ${dates.formatted}. Current Tanzania date=${dates.today}. Requested date=${requestedDate}.`;
  const queries=allMatches?[
    `${q} ${baseContext} ALL COMPLETED TANZANIA PREMIER LEAGUE MATCHES ON ${requestedDate}. Return every match played that date with final score. Do not return fixtures, previews, future matches or one-match-only answers.`,
    `Tanzania Premier League results ${requestedDate} all matches final scores completed`,
    `Tanzania Ligi Kuu Bara ${requestedDate} matokeo mechi zote final scores`,
  ]:[`${q}\\n${baseContext}\\nUse only the requested date/event. For live or social questions return only the information asked. Prefer the newest credible result.`];
  async function run(searchQuery:string){
    const body:any={query:searchQuery,type:'fast',numResults:allMatches?20:(sports?12:(relative?12:8)),contents:{highlights:true,text:true}};
    if(relative){body.startPublishedDate=new Date(`${requestedDate}T00:00:00+03:00`).toISOString();body.endPublishedDate=new Date(`${requestedDate}T23:59:59+03:00`).toISOString();body.maxAgeHours=0;}
    const r=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw new Error('EXA_SEARCH_FAILED: HTTP '+r.status);
    const d=await r.json(); return Array.isArray(d?.results)?d.results:[];
  }
  const raw=(await Promise.all(queries.map(run))).flat();
  const unique=[]; const seen=new Set();
  for(const item of raw){if(item?.url&&!seen.has(item.url)){seen.add(item.url);unique.push(item);}}
  const ranked=sports&&finalResult?[...unique].sort((a,b)=>resultStrength(b)-resultStrength(a)):news?[...unique].sort((a,b)=>newsEvidenceStrength(b)-newsEvidenceStrength(a)):unique;
  const results=ranked.slice(0,allMatches?50:(sports?12:(news?10:8)));
  const citations=results.filter(x=>x?.url).map(x=>({title:String(x.title||x.url).trim(),url:String(x.url).trim()})).slice(0,10);
  let answer='';
  if(allMatches){
    const aliases=['Singida Black Stars','Polisi Tanzania','JKT Tanzania','TRA United','Dodoma Jiji','Tabora United','Namungo','Young Africans','Yanga','Pamba Jiji','Mbeya City','Fountain Gate','Geita Gold','Azam','Simba','Coastal Union','Mashujaa','Kagera Sugar'];
    const esc=aliases.sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\\]\\]/g,'\\\\$&')).join('|');
    const scoreRe=new RegExp(`(${esc})(?:\\\\s+(?:FC|SC))?\\\\s+(?:FT\\\\s*)?(\\\\d{1,2})\\\\s*[-–:]\\\\s*(\\\\d{1,2})\\\\s+(${esc})(?:\\\\s+(?:FC|SC))?`,'gi');
    const found=new Map();
    for(const item of results){const t=evidenceText(item);let m;while((m=scoreRe.exec(t))){const home=m[1].trim(),away=m[4].trim(),key=home.toLowerCase()+'|'+away.toLowerCase();found.set(key,`${home} ${m[2]}-${m[3]} ${away}`);}}
    answer=[...found.values()].slice(0,20).map(x=>'- '+x).join('\\n');
    if(!answer){
      answer=results.filter(x=>resultStrength(x)>=6).slice(0,12).map(x=>evidenceText(x).slice(0,700)).filter(Boolean).join('\\n\\n');
    }
  } else if(sports&&opponent){ answer=extractOpponentAnswer(q,results)||''; }
  else if(sports&&finalResult){ answer=results.filter(x=>resultStrength(x)>=6).slice(0,3).map(x=>evidenceText(x).slice(0,900)).filter(Boolean).join('\\n\\n'); }
  else if(news&&isNewsFactQuestion(q)){ answer=extractNewsFactAnswer(q,results)||''; }
  else { answer=String(results.slice(0,social?3:(news?5:2)).map(x=>evidenceText(x).slice(0,1000)).filter(Boolean).join('\\n\\n')).trim(); }
  if(!answer)throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');
  return {answer,citations};
}`;
    exa=exa.slice(0,start)+fn+exa.slice(close+1);
  }
}
write('server/exaSearch.ts',exa);

let engine=read('src/services/aiEngine.ts');
engine=engine.replace(/export interface ChatEngineResult \{([\s\S]*?)\n\}/, (m,body)=>body.includes('webSources')?m:`export interface ChatEngineResult {${body}\n  webSources?: Array<{ title:string; url:string }>;
}`);
engine=engine.replace(/return\{reply:serverRes\.reply,cleanSpeechText:serverRes\.cleanSpeechText\|\|serverRes\.reply,memoriesExtracted:serverRes\.memoriesExtracted,peopleRecognized:serverRes\.peopleRecognized,generatedFiles:serverRes\.generatedFiles,engineUsed:'server',aiProvider:serverRes\.aiProvider\|\|'Google Gemini',chatModel:serverRes\.chatModel\|\|'gemini-3\.7-flash',intent:serverRes\.intent\|\|'chat'\};/, "return{reply:serverRes.reply,cleanSpeechText:serverRes.cleanSpeechText||serverRes.reply,memoriesExtracted:serverRes.memoriesExtracted,peopleRecognized:serverRes.peopleRecognized,generatedFiles:serverRes.generatedFiles,webSources:Array.isArray(serverRes.webSources)?serverRes.webSources:[],engineUsed:'server',aiProvider:serverRes.aiProvider||'Google Gemini',chatModel:serverRes.chatModel||'gemini-3.7-flash',intent:serverRes.intent||'chat'};");
engine=engine.replace(/const directApiKey=getStoredGeminiApiKey\(\);if\(directApiKey&&directApiKey\.trim\(\)\.length>10\)return callDirectGemini\(directApiKey\.trim\(\),params\);if\(isCapacitorNative\(\)\)return callNativeServerChat\(params\);/, "const directApiKey=getStoredGeminiApiKey();if(!needsLiveSearch(params.message)&&directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);");
write('src/services/aiEngine.ts',engine);

let app=read('src/App.tsx');
app=app.replace(/generatedFiles: processedFiles,\n        memoryExtracted:/, "generatedFiles: processedFiles,\n        webSources: Array.isArray((chatResult as any).webSources) ? (chatResult as any).webSources : [],\n        memoryExtracted:");
write('src/App.tsx',app);

let gemini=read('server/geminiService.ts');
if(!gemini.includes("import { searchWithExa } from './exaSearch.js';")) gemini=gemini.replace("import { generateRealFile } from './files.js';", "import { generateRealFile } from './files.js';\nimport { searchWithExa } from './exaSearch.js';");
gemini=gemini.replace(/import \{ searchWithTavily \} from ['"]\.\/tavilySearch\.js['"];?\n?/g,'');
gemini=gemini.replace(/export const LIVE_SEARCH_MODEL = ['"][^'"]+['"];\n/, "export const LIVE_SEARCH_MODEL = PERSONAL_CHAT_MODEL;\n");
// Ensure the result interface carries source cards.
gemini=gemini.replace(/  latencyMs: number;\n\}/, "  latencyMs: number;\n  webSources: Array<{ title:string; url:string }>;\n}");
// Final routing marker: replace any Tavily live-search call with direct Exa call.
gemini=gemini.replace(/searchWithTavily\(/g,'searchWithExa(');
// If the current live branch still contains Gemini synthesis, fail closed by returning Exa directly.
const liveMarker='const isSearchQuery = this.detectSearchIntent(message);';
if(!gemini.includes('let webSources: Array<{ title:string; url:string }> = [];')) gemini=gemini.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n    let webSources: Array<{ title:string; url:string }> = [];");
if(!gemini.includes('webSources: webSources')) gemini=gemini.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
// Convert the first live-search branch to direct Exa when possible.
const idx=gemini.indexOf('if (isSearchQuery)');
if(idx>=0){const open=gemini.indexOf('{',idx), close=open>=0?findMatchingBrace(gemini,open):-1; if(open>=0&&close>=0){const tail=gemini.slice(close+1);const em=tail.match(/^\s*else\s*\{/);if(em){const exaBlock=`if (isSearchQuery) {\n      try {\n        const exa = await searchWithExa(message + '\\nCurrent date/time in Tanzania: ' + getCurrentTanzaniaTimeContext().formattedString);\n        webSources = Array.isArray(exa.citations) ? exa.citations.filter((c:any)=>c?.url).map((c:any)=>({title:String(c.title||c.url),url:String(c.url)})) : [];\n        aiReplyText = String(exa.answer||'').trim();\n        if(!aiReplyText) throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live answer.');\n      } catch (exaErr:any) { throw new Error('LIVE_SEARCH_UNAVAILABLE: Exa live web/social search failed. '+String(exaErr?.message||exaErr)); }\n    `; const eo=close+1+em[0].lastIndexOf('{'); gemini=gemini.slice(0,idx)+exaBlock+gemini.slice(eo);}}}
write('server/geminiService.ts',gemini);
console.log('[MKUU-EXA-ALL] Restored source cards, all-match aggregation, and Exa-only live/social routing.');
