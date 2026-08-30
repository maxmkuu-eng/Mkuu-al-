const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s, 'utf8');

// This patch must stay syntax-safe: it runs before every production build.
let exa = read('server/exaSearch.ts');

// Make Tanzania relative-date context explicit and add an all-completed-results branch.
const oldFn = /export async function searchWithExa\(query:string\):Promise<ExaSearchResult>\{[\s\S]*?\n\}/;
if (oldFn.test(exa)) {
  const fn = [
    'export async function searchWithExa(query:string):Promise<ExaSearchResult>{',
    '  const apiKey=resolveExaApiKey();',
    '  const dates=tanzaniaDateContext();',
    '  const q=String(query||\'\').trim();',
    '  const fresh=isFreshOrRelativeQuery(q), social=isSocialQuery(q), sports=isSportsQuery(q), news=isNewsQuery(q), finalResult=isFinalResultQuery(q), opponent=isOpponentQuestion(q);',
    '  const requestedDate=/\\b(jana|yesterday)\\b/i.test(q)?dates.yesterday:/\\bjuzi\\b/i.test(q)?dates.twoDaysAgo:dates.today;',
    '  const allMatches=sports&&finalResult&&/\\b(matokeo|mechi|mchezo|results?|scores?|zimeish|iliish)\\b/i.test(q)&&/\\b(jana|yesterday)\\b/i.test(q)&&/\\b(tanzania|ligi kuu|ligi|premier league|bara)\\b/i.test(q);',
    '  const context=\'TANZANIA TIME: \'+dates.formatted+\'. Current Tanzania date=\'+dates.today+\'. Requested date=\'+requestedDate+\'.\';',
    '  const queries=allMatches?',
    '    [q+\' \'+context+\' ALL COMPLETED TANZANIA PREMIER LEAGUE MATCHES ON \'+requestedDate+\'. Return every completed match played that date with final score. Do not return fixtures, previews, future matches, or only one match.\',',
    '     \'Tanzania Premier League all match results \'+requestedDate+\' final scores\',',
    '     \'Tanzania Ligi Kuu Bara matokeo mechi zote \'+requestedDate+\' final scores\']:',
    '    [q+\'\\n\'+context+\'\\nUse only the requested date/event and return only what the user asked.\'];',
    '  async function run(searchQuery:string){',
    '    const body:any={query:searchQuery,type:\'fast\',numResults:allMatches?20:(sports?12:(fresh?12:8)),contents:{highlights:true,text:true}};',
    '    if(allMatches||fresh){',
    '      body.startPublishedDate=new Date(requestedDate+\'T00:00:00+03:00\').toISOString();',
    '      body.endPublishedDate=new Date(requestedDate+\'T23:59:59+03:00\').toISOString();',
    '      body.maxAgeHours=0;',
    '    }',
    '    const r=await fetch(\'https://api.exa.ai/search\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\',\'x-api-key\':apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});',
    '    if(!r.ok)throw new Error(\'EXA_SEARCH_FAILED: HTTP \'+r.status);',
    '    const d=await r.json(); return Array.isArray(d?.results)?d.results:[];',
    '  }',
    '  const raw=(await Promise.all(queries.map(run))).flat();',
    '  const unique:any[]=[]; const seen=new Set<string>();',
    '  for(const item of raw){if(item?.url&&!seen.has(item.url)){seen.add(item.url);unique.push(item);}}',
    '  const ranked=sports&&finalResult?[...unique].sort((a,b)=>resultStrength(b)-resultStrength(a)):news?[...unique].sort((a,b)=>newsEvidenceStrength(b)-newsEvidenceStrength(a)):unique;',
    '  const results=ranked.slice(0,allMatches?50:(sports?12:(news?10:8)));',
    '  const citations=results.filter(x=>x?.url).map(x=>({title:String(x.title||x.url).trim(),url:String(x.url).trim()})).slice(0,10);',
    '  let answer=\'\';',
    '  if(allMatches){',
    '    const aliases=[\'Singida Black Stars\',\'Polisi Tanzania\',\'JKT Tanzania\',\'TRA United\',\'Dodoma Jiji\',\'Tabora United\',\'Namungo\',\'Young Africans\',\'Yanga\',\'Pamba Jiji\',\'Mbeya City\',\'Fountain Gate\',\'Geita Gold\',\'Azam\',\'Simba\',\'Coastal Union\',\'Mashujaa\',\'Kagera Sugar\'];',
    '    const esc=aliases.sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\\]\\\\]/g,\'\\\\$&\')).join(\'|\');',
    '    const scoreRe=new RegExp(\'(\'+esc+\')(?:\\\\s+(?:FC|SC))?\\\\s+(?:FT\\\\s*)?(\\\\d{1,2})\\\\s*[-–:]\\\\s*(\\\\d{1,2})\\\\s+(\'+esc+\')(?:\\\\s+(?:FC|SC))?\',\'gi\');',
    '    const found=new Map<string,string>();',
    '    for(const item of results){const t=evidenceText(item);let m;while((m=scoreRe.exec(t))){const home=m[1].trim(),away=m[4].trim(),key=home.toLowerCase()+\'|\'+away.toLowerCase();found.set(key,home+\' \'+m[2]+\'-\'+m[3]+\' \'+away);}}',
    '    answer=Array.from(found.values()).slice(0,20).map(x=>\'- \'+x).join(\'\\n\');',
    '    if(!answer){answer=results.filter(x=>resultStrength(x)>=6).slice(0,12).map(x=>evidenceText(x).slice(0,700)).filter(Boolean).join(\'\\n\\n\');}',
    '  } else if(sports&&opponent){answer=extractOpponentAnswer(q,results)||\'\';}',
    '  else if(sports&&finalResult){answer=results.filter(x=>resultStrength(x)>=6).slice(0,3).map(x=>evidenceText(x).slice(0,900)).filter(Boolean).join(\'\\n\\n\');}',
    '  else if(news&&isNewsFactQuestion(q)){answer=extractNewsFactAnswer(q,results)||\'\';}',
    '  else {answer=results.slice(0,social?3:(news?5:2)).map(x=>evidenceText(x).slice(0,1000)).filter(Boolean).join(\'\\n\\n\').trim();}',
    '  if(!answer)throw new Error(\'EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.\');',
    '  return {answer,citations};',
    '}'
  ].join('\n');
  exa = exa.replace(oldFn, fn);
}
write('server/exaSearch.ts', exa);

// Native APK must never fall back to direct Gemini for live/current queries.
let engine = read('src/services/aiEngine.ts');
const interfacePattern = /export interface ChatEngineResult \{([\s\S]*?)\n\}/;
if (!engine.includes('webSources?: Array<{ title:string; url:string }>')) {
  engine = engine.replace(interfacePattern, (m, body) =>
    'export interface ChatEngineResult {' + body + '\n  webSources?: Array<{ title:string; url:string }>;\n}'
  );
}

// Avoid a fragile giant RegExp here. Exact substring replacement is deterministic and
// keeps this build-time patch valid even when the surrounding implementation changes.
const oldRouting = 'const directApiKey=getStoredGeminiApiKey();if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative())return callNativeServerChat(params);';
const newRouting = 'const directApiKey=getStoredGeminiApiKey();if(!needsLiveSearch(params.message)&&directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);';
if (engine.includes(oldRouting)) engine = engine.replace(oldRouting, newRouting);

engine = engine.replace(
  /generatedFiles:serverRes\.generatedFiles,engineUsed:/,
  'generatedFiles:serverRes.generatedFiles,webSources:Array.isArray(serverRes.webSources)?serverRes.webSources:[],engineUsed:'
);
write('src/services/aiEngine.ts', engine);

console.log('[MKUU-EXA-ALL] Syntax-safe all-results + source bridge + Exa-only native live routing applied.');
