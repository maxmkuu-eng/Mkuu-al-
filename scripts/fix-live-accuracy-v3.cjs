const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

// Idempotent live-accuracy patch. Earlier build patches may already have
// inserted the same declarations, so normalize before adding anything.
{
  const file = 'server/exaSearch.ts';
  let s = read(file);

  if (!s.includes('function isGovernmentOfficeQuery')) {
    const marker = "function isSocialQuery(q:string){return /\\b(instagram|facebook|tiktok|youtube|twitter|x\\.com|social media|post ya|tweet|reel|story|official post|profile)\\b/i.test(q);}";
    const helper = marker + "\nfunction isGovernmentOfficeQuery(q:string){return /\\b(waziri mkuu|waziri wa|naibu waziri|makamu wa rais|rais wa|rais|makamu|kiongozi wa sasa|serikali ya sasa|mkuu wa nchi|cabinet|baraza la mawaziri|minister|prime minister|vice president|president)\\b/i.test(q);}\nfunction authorityStrength(item:any){const u=String(item?.url||'').toLowerCase();const t=evidenceText(item);let s=0;if(/\\.(go\\.tz|gov\\.tz)\\b/.test(u))s+=12;if(/\\b(ikulu|ofisi ya waziri mkuu|serikali|wizara|jamhuri ya muungano|official statement|tovuti rasmi)\\b/i.test(t))s+=5;if(item?.publishedDate)s+=1;return s;}";
    s = s.replace(marker, helper);
  }

  // Remove every declaration first. This prevents duplicate const errors when
  // another live-search patch has already inserted governmentQuery.
  s = s.replace(/(?:const|let|var) governmentQuery=isGovernmentOfficeQuery\(query\);\s*/g, '');

  const anchor = "const apiKey=resolveExaApiKey(), dates=tanzaniaDateContext(), fresh=isFreshOrRelativeQuery(query), social=isSocialQuery(query), sports=isSportsQuery(query), news=isNewsQuery(query), finalResult=isFinalResultQuery(query), opponent=isOpponentQuestion(query), newsFact=isNewsFactQuestion(query);";
  if (s.includes(anchor)) s = s.replace(anchor, anchor + "const governmentQuery=isGovernmentOfficeQuery(query);");

  // Upgrade sports ranking if the older version exists.
  s = s.replace(
    "function resultStrength(item:any){const t=`${item?.title||''} ${item?.highlights?.join?.(' ')||''} ${item?.summary||''} ${item?.text||''}`.toLowerCase();let s=0;if(/\\b(full time|ft|final score|match result|result|muda kamili|matokeo|ushindi|won|defeated|beat|victory|1\\s*[-–]\\s*0|0\\s*[-–]\\s*1|2\\s*[-–]\\s*1|1\\s*[-–]\\s*2)\\b/i.test(t))s+=8;if(/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa)\\b/i.test(t))s-=8;if(/\\b(2026)\\b/i.test(t))s+=2;return s;}",
    "function resultStrength(item:any){const t=evidenceText(item).toLowerCase();let s=0;if(/\\b(full time|ft|final score|match result|result|muda kamili|matokeo|ushindi|won|defeated|defeating|beat|victory)\\b/i.test(t))s+=8;if(/\\b\\d{1,2}\\s*[-–:]\\s*\\d{1,2}\\b/.test(t))s+=8;if(/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa|fixture|upcoming|will meet|will take on)\\b/i.test(t))s-=14;if(/\\b(2026)\\b/i.test(t))s+=2;return s;}"
  );

  const bodyMarker = "const body:any={query:sports&&finalResult?`${q}\\nFINAL RESULT ONLY: ${requestedDate}`:q,type:fresh?'fast':'auto',numResults:sports?12:(fresh?12:8),contents:{highlights:true,text:true}};";
  if (!s.includes("body.includeDomains=['ikulu.go.tz'")) {
    s = s.replace(bodyMarker, bodyMarker + "if(governmentQuery)body.includeDomains=['ikulu.go.tz','pmo.go.tz','go.tz','gov.go.tz','michezo.go.tz','bunge.go.tz'];");
  }

  const oldRanking = "const data=await response.json() as any;const raw=Array.isArray(data?.results)?data.results:[];const ranked=sports&&finalResult?[...raw].sort((a:any,b:any)=>resultStrength(b)-resultStrength(a)):news?[...raw].sort((a:any,b:any)=>newsEvidenceStrength(b)-newsEvidenceStrength(a)):raw;";
  const newRanking = "const data=await response.json() as any;const raw=Array.isArray(data?.results)?data.results:[];const ranked=sports&&finalResult?[...raw].sort((a:any,b:any)=>resultStrength(b)-resultStrength(a)):governmentQuery?[...raw].sort((a:any,b:any)=>authorityStrength(b)-authorityStrength(a)):news?[...raw].sort((a:any,b:any)=>newsEvidenceStrength(b)-newsEvidenceStrength(a)):raw;";
  s = s.replace(oldRanking, newRanking);
  s = s.replace("else body.startPublishedDate=new Date(Date.now()-7*86400000).toISOString();", "else body.startPublishedDate=new Date(Date.now()-30*86400000).toISOString();");

  write(file, s);
}

// 2) Do not let stored browser Gemini credentials bypass Exa for live queries.
{
  const file = 'src/services/aiEngine.ts';
  let s = read(file);
  s = s.replace(
    "const directApiKey=getStoredGeminiApiKey();if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative())return callNativeServerChat(params);",
    "const directApiKey=getStoredGeminiApiKey();if(!needsLiveSearch(params.message)&&directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);"
  );
  write(file, s);
}

// 3) Propagate real health and web sources.
{
  const file = 'server.ts';
  let s = read(file);
  s = s.replace(
    "res.json({status:'ok',service:'MKUU Backend',gemini:'configured',chatModel:health.chatModel||PERSONAL_CHAT_MODEL,backend:health.backend||BACKEND_IDENTIFIER,aiProvider:health.aiProvider||AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString(),latencyMs:health.latencyMs})",
    "res.status(health.status==='connected'?200:503).json({status:health.status,service:'MKUU Backend',gemini:health.status,chatModel:health.chatModel||PERSONAL_CHAT_MODEL,backend:health.backend||BACKEND_IDENTIFIER,aiProvider:health.aiProvider||AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString(),latencyMs:health.latencyMs,error:health.error||undefined})"
  );
  s = s.replace(
    "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};",
    "return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};"
  );
  write(file, s);
}

// 4) Carry sources into the client result.
{
  const file = 'src/services/aiEngine.ts';
  let s = read(file);
  if (!s.includes('webSources?:Array<{title:string;url:string}>')) {
    s = s.replace('generatedFiles?:GeneratedFileSummary[]; engineUsed:', 'generatedFiles?:GeneratedFileSummary[]; webSources?:Array<{title:string;url:string}>; engineUsed:');
  }
  s = s.replace("generatedFiles:serverRes.generatedFiles,engineUsed:'server'", "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server'");
  write(file, s);
}

{
  const file = 'src/App.tsx';
  let s = read(file);
  if (!s.includes('webSources: (chatResult.webSources || [])')) {
    s = s.replace('generatedFiles: processedFiles,\n        memoryExtracted:', 'generatedFiles: processedFiles,\n        webSources: (chatResult.webSources || []).filter((s: any) => s?.url).map((s: any) => ({ title: String(s.title || s.url), url: String(s.url) })),\n        memoryExtracted:');
  }
  write(file, s);
}

// 5) Normalize the server result declaration to exactly one webSources local.
{
  const file = 'server/geminiService.ts';
  let s = read(file);
  if (!s.includes('webSources: Array<{ title: string; url: string }>')) {
    s = s.replace('  latencyMs: number;\n}', '  latencyMs: number;\n  webSources: Array<{ title: string; url: string }>;\n}');
  }
  const decl = "    let webSources: Array<{ title: string; url: string }> = [];";
  s = s.split(decl).join('');
  s = s.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n" + decl);
  s = s.replace('      generatedFiles: generatedFilesList,\n      aiProvider:', '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:');
  write(file, s);
}

console.log('[MKUU] LIVE ACCURACY V3: official-source priority, sports score extraction, Exa-only live routing, real health status and source propagation hardened.');
