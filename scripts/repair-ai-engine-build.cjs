const fs=require('fs');
const path=require('path');
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');

let engine=read('src/services/aiEngine.ts');
engine=engine.replace(/export interface ChatEngineResult \{[^\n]*\}/,m=>m.includes('webSources?')?m:m.replace('generatedFiles?:GeneratedFileSummary[];','generatedFiles?:GeneratedFileSummary[]; webSources?:Array<{title:string;url:string}>;'));
const oldRouting='const directApiKey=getStoredGeminiApiKey();if(directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative())return callNativeServerChat(params);';
const newRouting='const directApiKey=getStoredGeminiApiKey();if(!needsLiveSearch(params.message)&&directApiKey&&directApiKey.trim().length>10)return callDirectGemini(directApiKey.trim(),params);if(isCapacitorNative()||needsLiveSearch(params.message))return callNativeServerChat(params);';
engine=engine.replace(oldRouting,newRouting);
engine=engine.replace(/webSources:Array\.isArray\(serverRes\.webSources\)\?serverRes\.webSources:\[\],webSources:Array\.isArray\(serverRes\.webSources\)\?serverRes\.webSources:\[\],/g,'webSources:Array.isArray(serverRes.webSources)?serverRes.webSources:[],');
write('src/services/aiEngine.ts',engine);

let gem=read('server/geminiService.ts');
if(!gem.includes("from './exaSearch.js'")) gem=gem.replace("import { searchWithTavily } from './tavilySearch.js';","import { searchWithExa } from './exaSearch.js';");
else gem=gem.replace("import { searchWithTavily } from './tavilySearch.js';\n",'');
if(!gem.includes('webSources: Array<{ title: string; url: string }>')) gem=gem.replace('  latencyMs: number;\n}', '  latencyMs: number;\n  webSources: Array<{ title: string; url: string }>;\n}');
if(!gem.includes('let liveWebSources')) gem=gem.replace("    let aiReplyText = '';", "    let aiReplyText = '';\n    let liveWebSources: Array<{ title: string; url: string }> = [];");
const live=/    if \(isSearchQuery\) \{[\s\S]*?\n    \} else \{\n      try \{\n        aiReplyText = await this\.executeGeminiCallWithFallback/;
if(live.test(gem)) gem=gem.replace(live,`    if (isSearchQuery) {
      try {
        const exa = await searchWithExa(\`${'${message}'}\\nCurrent Tanzania date/time: ${'${getCurrentTanzaniaTimeContext().formattedString}'}\`);
        aiReplyText = String(exa?.answer || '').trim();
        liveWebSources = Array.isArray(exa?.citations) ? exa.citations : [];
        if (!aiReplyText) throw new Error('Exa returned an empty live answer.');
        console.log(\`[MKUU-BACKEND] [EXA_LIVE_SUCCESS] sources=${'${liveWebSources.length}'} latency=${'${Date.now() - startTime}'}ms\`);
      } catch (exaErr: any) {
        const msg = String(exaErr?.message || exaErr);
        console.error(\`[MKUU-BACKEND] [EXA_LIVE_FAILED] ${'${msg}'}\`);
        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Exa live search failed. ${'${msg}'}\`);
      }
    } else {
      try {
        aiReplyText = await this.executeGeminiCallWithFallback`);
else throw new Error('Expected GeminiService live branch was not found; refusing unsafe fallback.');
gem=gem.replace('      latencyMs: Date.now() - startTime,\n    };','      latencyMs: Date.now() - startTime,\n      webSources: liveWebSources,\n    };');
write('server/geminiService.ts',gem);
console.log('[MKUU-BUILD-REPAIR] Fixed build duplicates and enforced Exa-only live/social routing; Gemini is not called for live searches.');
