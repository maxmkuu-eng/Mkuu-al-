const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'server', 'geminiService.ts');
if (!fs.existsSync(target)) throw new Error('[GEMINI-REST] server/geminiService.ts not found.');
let s = fs.readFileSync(target, 'utf8');

// Deterministic, idempotent normalization. Do not depend on one exact source layout.
s = s.replace(/import\s*\{\s*GoogleGenAI\s*\}\s*from\s*['"]@google\/genai['"];?\s*/g, '');
s = s.replace(/import\s*\{\s*searchWithTavily\s*\}\s*from\s*['"]\.\/tavilySearch\.js['"];?\s*/g, '');
s = s.replace(/\s*private\s+aiClient\s*:\s*GoogleGenAI\s*\|\s*null\s*=\s*null;?\s*/g, '\n');
s = s.replace(/\s*private\s+getClient\s*\(\s*\)\s*:\s*GoogleGenAI\s*\{[\s\S]*?\n\s*\}\s*(?=\s*public\s+(?:async\s+)?getHealthStatus\b)/m, '\n');

s = s.replace(/export\s+const\s+PERSONAL_CHAT_MODEL\s*=\s*['"][^'"]+['"]\s*;?/, "export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';");
s = s.replace(/export\s+const\s+LIVE_SEARCH_MODEL\s*=\s*['"][^'"]+['"]\s*;?/, "export const LIVE_SEARCH_MODEL = 'EXA_DIRECT';");
s = s.replace(/export\s+const\s+CHAT_MODEL_FALLBACKS\s*=\s*\[[\s\S]*?\]\s*;?/, "export const CHAT_MODEL_FALLBACKS = [PERSONAL_CHAT_MODEL];");

// Use plain quoted strings in generated source. This avoids nested template-literal syntax errors.
const healthMethod = [
"  public async getHealthStatus(): Promise<{ aiProvider:string; chatModel:string; backend:string; status:'connected'|'unavailable'; latencyMs?:number; error?:string }> {",
"    const started=Date.now(); const key=process.env.GEMINI_API_KEY;",
"    if(!key)return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:'GEMINI_API_KEY is not configured on MKUU Backend.'};",
"    try{",
"      const url='https://generativelanguage.googleapis.com/v1beta/models/'+PERSONAL_CHAT_MODEL+':generateContent';",
"      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Ping status check'}]}]})});",
"      const raw=await r.text(); let m=raw; try{m=JSON.parse(raw)?.error?.message||raw;}catch{}",
"      if(!r.ok)return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:m};",
"      return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'connected',latencyMs:Date.now()-started};",
"    }catch(e){return {aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'unavailable',latencyMs:Date.now()-started,error:String(e?.message||e)}}",
"  }",
"",
].join('\n');

const processPos = s.search(/\n\s{2}public\s+async\s+processChat\b/);
if(processPos < 0) throw new Error('[GEMINI-REST] processChat method not found; refusing unsafe build.');
const healthStart = s.search(/\n\s{2}public\s+async\s+getHealthStatus\b/);
if(healthStart >= 0 && healthStart < processPos){
  const brace=s.indexOf('{',healthStart); let depth=0,end=-1;
  if(brace>=0){for(let i=brace;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&--depth===0){end=i+1;break;}}}
  if(end<0)throw new Error('[GEMINI-REST] Health method boundary not found; refusing unsafe build.');
  s=s.slice(0,healthStart)+'\n'+healthMethod+s.slice(end);
}else{
  s=s.slice(0,processPos)+'\n'+healthMethod+s.slice(processPos);
}

const restMethod = [
"  private async executeGeminiCallWithFallback(params:{contents:any;config?:any;preferredModel?:string}):Promise<string>{",
"    const key=process.env.GEMINI_API_KEY;",
"    if(!key)throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');",
"    const model=PERSONAL_CHAT_MODEL; const cfg:any=params.config||{}; const body:any={contents:params.contents};",
"    if(cfg.systemInstruction)body.systemInstruction=typeof cfg.systemInstruction==='string'?{parts:[{text:cfg.systemInstruction}]}:cfg.systemInstruction;",
"    const generationConfig:any={}; for(const k of ['temperature','topP','topK','maxOutputTokens','candidateCount','stopSequences'])if(cfg[k]!==undefined)generationConfig[k]=cfg[k];",
"    if(cfg.thinkingConfig)generationConfig.thinkingConfig=cfg.thinkingConfig; if(Object.keys(generationConfig).length)body.generationConfig=generationConfig;",
"    console.log('[MKUU-BACKEND] [GEMINI_REST_REQUEST] model=\"'+model+'\"');",
"    const url='https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent';",
"    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});",
"    const raw=await r.text(); let data:any={}; try{data=JSON.parse(raw)}catch{}",
"    if(!r.ok)throw new Error('Gemini REST HTTP '+r.status+': '+(data?.error?.message||raw||'Unknown Gemini error'));",
"    const parts=data?.candidates?.[0]?.content?.parts; const text=Array.isArray(parts)?parts.map((p:any)=>p?.text||'').join(''):'';",
"    if(!text.trim())throw new Error('Gemini REST returned an empty response.');",
"    console.log('[MKUU-BACKEND] [GEMINI_REST_SUCCESS] model=\"'+model+'\"'); return text;",
"  }",
"",
].join('\n');

const execRe=/\n\s{2}private\s+async\s+executeGeminiCallWithFallback\b[\s\S]*?(?=\n\s{2}private\s+buildSystemPrompt\b)/m;
if(execRe.test(s)){
  s=s.replace(execRe,'\n'+restMethod);
}else{
  const buildPos=s.search(/\n\s{2}private\s+buildSystemPrompt\b/);
  if(buildPos<0)throw new Error('[GEMINI-REST] buildSystemPrompt boundary not found; refusing unsafe build.');
  s=s.slice(0,buildPos)+'\n'+restMethod+s.slice(buildPos);
}

// Remove executable legacy SDK/Tavily imports/calls without rejecting harmless source text.
s=s.replace(/\bsearchWithTavily\b/g,'searchWithExa');
s=s.replace(/\bGoogleGenAI\b/g,'');
s=s.replace(/import\s*\{\s*\}\s*from\s*['"]@google\/genai['"]\s*;?\s*/g,'');

const forbidden=[/@google\/genai/,/private\s+getClient\s*\(/,/\bsearchWithTavily\s*\(/,/\b(?:client|this\.aiClient)\.models\.generateContent\s*\(/];
const labels=['@google/genai','private getClient():','searchWithTavily(','.models.generateContent'];
const remaining=[]; for(let i=0;i<forbidden.length;i++)if(forbidden[i].test(s))remaining.push(labels[i]);
if(remaining.length)throw new Error('[GEMINI-REST] Forbidden executable references remain: '+remaining.join(', '));
if(!s.includes("export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';"))throw new Error('[GEMINI-REST] Gemini 3.7 Flash missing.');

fs.writeFileSync(target,s,'utf8');
console.log('[GEMINI-REST] OK: Gemini 3.7 Flash REST + Exa direct live runtime installed.');
