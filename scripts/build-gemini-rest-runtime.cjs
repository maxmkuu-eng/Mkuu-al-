const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) throw new Error('[GEMINI-REST] server/geminiService.ts not found.');
let s = fs.readFileSync(target, 'utf8');

// This script is the final build-time normalizer. It is intentionally idempotent:
// earlier scripts may already have changed GeminiService, so we normalize the
// structure instead of relying on one exact source layout.

// Remove legacy Gemini SDK / Tavily imports regardless of whitespace or formatting.
s = s.replace(/import\s*\{\s*GoogleGenAI\s*\}\s*from\s*['"]@google\/genai['"]\s*;?\s*/g, '');
s = s.replace(/import\s*\{\s*searchWithTavily\s*\}\s*from\s*['"]\.\/tavilySearch\.js['"]\s*;?\s*/g, '');

// Remove the old SDK client field and accessor. These are the source of the
// previous runtime ReferenceError and must not survive into the server bundle.
s = s.replace(/\s*private\s+aiClient\s*:\s*GoogleGenAI\s*\|\s*null\s*=\s*null\s*;?/g, '\n');
s = s.replace(/\s*private\s+getClient\s*\([^)]*\)\s*:\s*GoogleGenAI\s*\{[\s\S]*?(?=\s*public\s+async\s+getHealthStatus\b)/m, '\n');

// Remove any remaining standalone legacy accessor if a previous patch moved it.
s = s.replace(/\s*private\s+getClient\s*\([^)]*\)\s*:\s*[^\{]+\{[\s\S]*?\n?\s*\}\s*/m, '\n');

// Lock the intended model architecture.
s = s.replace(/export\s+const\s+PERSONAL_CHAT_MODEL\s*=\s*['"][^'"]+['"]\s*;?/,
  "export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';");
s = s.replace(/export\s+const\s+LIVE_SEARCH_MODEL\s*=\s*['"][^'"]+['"]\s*;?/,
  "export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");
s = s.replace(/export\s+const\s+CHAT_MODEL_FALLBACKS\s*=\s*\[[\s\S]*?\]\s*;?/,
  "export const CHAT_MODEL_FALLBACKS = [PERSONAL_CHAT_MODEL];");

// Exa direct REST helper. This keeps live/current/social queries on Exa and
// avoids another provider being required by the Gemini runtime.
const exaHelper = `\nasync function searchWithExa(query:string):Promise<string>{
  const key=process.env.EXA_API_KEY;
  if(!key)throw new Error('EXA_API_KEY is not configured on MKUU Backend.');
  const r=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify({query,type:'auto',numResults:10,contents:{highlights:true}})});
  const raw=await r.text(); let data:any={}; try{data=JSON.parse(raw)}catch{}
  if(!r.ok)throw new Error(\`Exa HTTP \${r.status}: \${data?.error||raw||'Unknown Exa error'}\`);
  const results=Array.isArray(data?.results)?data.results:[];
  if(!results.length)throw new Error('Exa returned no live web results.');
  return results.map((x:any,i:number)=>{const h=Array.isArray(x?.highlights)?x.highlights.join('\\n'):'';return \`[\${i+1}] \${x?.title||''}\\nURL: \${x?.url||''}\\nPublished: \${x?.publishedDate||'unknown'}\\n\${h||x?.text||''}\`;}).join('\\n\\n');
}\n`;

if (!s.includes('async function searchWithExa(query:string)')) {
  const classPos = s.search(/\nexport\s+class\s+GeminiService\b/);
  if (classPos < 0) throw new Error('[GEMINI-REST] GeminiService class not found.');
  s = s.slice(0, classPos) + exaHelper + s.slice(classPos);
}

const healthMethod = `  public async getHealthStatus(): Promise<{ aiProvider:string; chatModel:string; backend:string; status:'connected'|'unavailable'; latencyMs?:number; error?:string }> {
    const started=Date.now(); const key=process.env.GEMINI_API_KEY;
    if(!key)return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:'GEMINI_API_KEY is not configured on MKUU Backend.'};
    try{
      const r=await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${PERSONAL_CHAT_MODEL}:generateContent\`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Ping status check'}]}]})});
      const raw=await r.text(); let m=raw; try{m=JSON.parse(raw)?.error?.message||raw;}catch{}
      if(!r.ok)return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:m};
      return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'connected',latencyMs:Date.now()-started};
    }catch(e:any){return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:String(e?.message||e)}}
  }\n`;

// Replace an existing health method or inject one immediately before processChat.
const processMatch = s.match(/\n\s{2}public\s+async\s+processChat\b/);
if (!processMatch) throw new Error('[GEMINI-REST] processChat method not found.');
const processPos = processMatch.index;
const healthMatch = s.match(/\n\s{2}public\s+async\s+getHealthStatus\b/);
if (healthMatch && healthMatch.index < processPos) {
  // Find the matching method closing brace using a simple brace scanner.
  const start = healthMatch.index + 1;
  const brace = s.indexOf('{', start);
  if (brace >= 0) {
    let depth=0, end=-1;
    for(let i=brace;i<s.length;i++){
      if(s[i]==='{')depth++; else if(s[i]==='}' && --depth===0){end=i+1;break;}
    }
    if(end>0) s=s.slice(0,start)+healthMethod+s.slice(end);
    else s=s.slice(0,processPos)+'\n'+healthMethod+s.slice(processPos);
  } else s=s.slice(0,processPos)+'\n'+healthMethod+s.slice(processPos);
} else {
  s=s.slice(0,processPos)+'\n'+healthMethod+s.slice(processPos);
}

const restMethod = `  private async executeGeminiCallWithFallback(params:{contents:any;config?:any;preferredModel?:string}):Promise<string>{
    const key=process.env.GEMINI_API_KEY;
    if(!key)throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');
    const model=PERSONAL_CHAT_MODEL; const cfg:any=params.config||{}; const body:any={contents:params.contents};
    if(cfg.systemInstruction)body.systemInstruction=typeof cfg.systemInstruction==='string'?{parts:[{text:cfg.systemInstruction}]}:cfg.systemInstruction;
    const generationConfig:any={}; for(const k of ['temperature','topP','topK','maxOutputTokens','candidateCount','stopSequences'])if(cfg[k]!==undefined)generationConfig[k]=cfg[k];
    if(cfg.thinkingConfig)generationConfig.thinkingConfig=cfg.thinkingConfig; if(Object.keys(generationConfig).length)body.generationConfig=generationConfig;
    console.log(\`[MKUU-BACKEND] [GEMINI_REST_REQUEST] model="\${model}"\`);
    const r=await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent\`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const raw=await r.text(); let data:any={}; try{data=JSON.parse(raw)}catch{}
    if(!r.ok)throw new Error(\`Gemini REST HTTP \${r.status}: \${data?.error?.message||raw||'Unknown Gemini error'}\`);
    const parts=data?.candidates?.[0]?.content?.parts; const text=Array.isArray(parts)?parts.map((p:any)=>p?.text||'').join(''):'';
    if(!text.trim())throw new Error('Gemini REST returned an empty response.');
    console.log(\`[MKUU-BACKEND] [GEMINI_REST_SUCCESS] model="\${model}"\`); return text;
  }\n`;

// Replace the complete executor by method boundary; this also handles the old
// one-line implementation currently present in the repository.
const execMatch = s.match(/\n\s{2}private\s+async\s+executeGeminiCallWithFallback\b/);
if (execMatch) {
  const start=execMatch.index+1; const brace=s.indexOf('{',start); let depth=0,end=-1;
  if(brace>=0){for(let i=brace;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&--depth===0){end=i+1;break;}}}
  if(end<0)throw new Error('[GEMINI-REST] Could not locate executor boundary.');
  s=s.slice(0,start)+restMethod+s.slice(end);
} else {
  const buildPos=s.search(/\n\s{2}private\s+buildSystemPrompt\b/);
  if(buildPos<0)throw new Error('[GEMINI-REST] buildSystemPrompt boundary not found.');
  s=s.slice(0,buildPos)+'\n'+restMethod+s.slice(buildPos);
}

// Replace the complete live-search branch with Exa + Gemini synthesis. This is
// deliberately done by brace matching, not fragile string markers.
const liveMatch=s.match(/if\s*\(\s*isSearchQuery\s*\)\s*\{/);
if(liveMatch){
  const start=liveMatch.index; const brace=s.indexOf('{',start); let depth=0,end=-1;
  for(let i=brace;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&--depth===0){end=i+1;break;}}
  if(end<0)throw new Error('[GEMINI-REST] Live branch boundary not found.');
  const replacement=`if(isSearchQuery){try{\n      console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Live/current/social query routed to Exa.');\n      const exaResults=await searchWithExa(\`${'${message}'}\\nCurrent date/time in Tanzania: \${getCurrentTanzaniaTimeContext().formattedString}\`);\n      const groundedSystemPrompt=\`${'${systemPrompt}'}\\n\\nLIVE WEB SEARCH RESULTS (Exa):\\n\${exaResults}\\n\\nSTRICT LIVE-DATA RULES:\\n- Use the supplied Exa results as the primary evidence.\\n- Prefer the newest credible source and pay attention to publication dates.\\n- For current facts, sports, news, public officials and social/current information, do not invent unsupported details.\\n- If sources conflict, explain briefly and prefer the newest authoritative evidence.\\n\`;\n      const groundedContents=this.buildConversationHistory(conversationHistory,\`${'${message}'}\\n\\n[MKUU LIVE SEARCH EVIDENCE - Exa]\\n\${exaResults}\`,attachments);\n      aiReplyText=await this.executeGeminiCallWithFallback({contents:groundedContents,config:{systemInstruction:groundedSystemPrompt,temperature:0.2},preferredModel:PERSONAL_CHAT_MODEL});\n      console.log(\`[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] Live answer synthesized with Gemini 3.7 Flash latency=\${Date.now()-startTime}ms\`);\n    }catch(exaErr:any){throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live search failed. \${String(exaErr?.message||exaErr)}\`);}\n    }`;
  s=s.slice(0,start)+replacement+s.slice(end);
}

// Final cleanup of legacy identifiers that may have been reintroduced by an
// earlier build step. Only source identifiers are touched; the live implementation
// above is already fully Exa based.
s=s.replace(/\bsearchWithTavily\b/g,'searchWithExa');
s=s.replace(/\bGoogleGenAI\b/g,'');
s=s.replace(/\bprivate\s+getClient\s*\([^)]*\)\s*:\s*[^\{]+\{[\s\S]*?\n?\s*\}\s*/m,'\n');
s=s.replace(/\b(?:client|this\.aiClient)\.models\.generateContent\s*\(/g,'');

// Remove the old import if the identifier cleanup above changed it into an
// invalid import statement.
s=s.replace(/import\s*\{\s*\}\s*from\s*['"]@google\/genai['"]\s*;?\s*/g,'');

const forbidden=[/@google\/genai/,/\bGoogleGenAI\b/,/private\s+getClient\s*\(/,/\bsearchWithTavily\s*\(/,/\b(?:client|this\.aiClient)\.models\.generateContent\s*\(/];
const labels=['@google/genai','GoogleGenAI','private getClient():','searchWithTavily(','.models.generateContent'];
const remaining=[]; for(let i=0;i<forbidden.length;i++)if(forbidden[i].test(s))remaining.push(labels[i]);
if(remaining.length)throw new Error('[GEMINI-REST] Forbidden references remain: '+remaining.join(', '));
if(!s.includes("export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';"))throw new Error('[GEMINI-REST] Gemini 3.7 Flash missing.');
if(!s.includes('https://api.exa.ai/search'))throw new Error('[GEMINI-REST] Exa live search implementation missing.');

fs.writeFileSync(target,s,'utf8');
console.log('[GEMINI-REST] OK: Gemini 3.7 Flash REST + Exa direct live runtime installed.');
