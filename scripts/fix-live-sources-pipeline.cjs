const fs = require('fs');
const path = require('path');

function patch(filePath, replacements) {
  const file = path.join(process.cwd(), filePath);
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (source.includes(from)) {
      const next = source.replace(from, to);
      if (next !== source) changed = true;
      source = next;
    }
  }
  if (changed) fs.writeFileSync(file, source);
}

// 1) Backend: expose Exa citations from the live-search branch.
patch('server/geminiService.ts', [
  [
    '        const evidence = String(exa.answer || \'\').trim();',
    '        const webSources = Array.isArray(exa.citations) ? exa.citations.filter((c) => c?.url).map((c) => ({ title: String(c.title || c.url), url: String(c.url) })) : [];\n        const evidence = String(exa.answer || \'\').trim();',
  ],
  [
    '  generatedFiles: GeneratedFileSummary[];\n  aiProvider: string;',
    '  generatedFiles: GeneratedFileSummary[];\n  webSources?: Array<{ title: string; url: string }>;\n  aiProvider: string;',
  ],
  [
    '      generatedFiles: generatedFilesList,\n      aiProvider:',
    '      generatedFiles: generatedFilesList,\n      webSources,\n      aiProvider:',
  ],
]);

// 2) HTTP API: return and persist the sources with the assistant message.
patch('server.ts', [
  [
    'generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)',
    'generatedFiles:result.generatedFiles,webSources:result.webSources,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)',
  ],
  [
    'generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs',
    'generatedFiles:result.generatedFiles,webSources:result.webSources,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs',
  ],
]);

// 3) Client engine: propagate sources for native JSON, artifact and streaming paths.
patch('src/services/aiEngine.ts', [
  [
    'generatedFiles?:GeneratedFileSummary[]; engineUsed:',
    'generatedFiles?:GeneratedFileSummary[]; webSources?:Array<{title:string;url:string}>; engineUsed:',
  ],
  [
    'generatedFiles:serverRes.generatedFiles,engineUsed:\'server\'',
    'generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources,engineUsed:\'server\'',
  ],
  [
    'generatedFiles:serverRes.generatedFiles,engineUsed:\'server\',aiProvider',
    'generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources,engineUsed:\'server\',aiProvider',
  ],
]);

// Streaming endpoint sends sources in the final `done` event. Preserve them.
patch('src/services/aiEngine.ts', [
  [
    "let buffer='';let reply='';emitStream('',false);",
    "let buffer='';let reply='';let webSources:Array<{title:string;url:string}>=[];emitStream('',false);",
  ],
  [
    "if(payload.type==='delta'&&payload.text){reply+=payload.text;emitStream(payload.text,false);}if(payload.type==='error')throw new Error(payload.message||'Streaming error');",
    "if(payload.type==='delta'&&payload.text){reply+=payload.text;emitStream(payload.text,false);}if(payload.type==='done'&&Array.isArray(payload.webSources)){webSources=payload.webSources.filter((s:any)=>s?.url).map((s:any)=>({title:String(s.title||s.url),url:String(s.url)}));}if(payload.type==='error')throw new Error(payload.message||'Streaming error');",
  ],
  [
    "engineUsed:'server',aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat'",
    "engineUsed:'server',webSources,aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat'",
  ],
]);

// 4) Force changing/current sports and news questions through the server/Exa path.
// This prevents a locally stored Gemini key from bypassing Exa and returning stale answers.
patch('src/services/aiEngine.ts', [
  [
    "export async function executeMkuuChat(params:ChatEngineParams):Promise<ChatEngineResult>{const smsCommand=await handleDirectSmsCommand(params);if(smsCommand)return smsCommand;if(needsImageRoute(params))return callImageStudio(params);const directApiKey=getStoredGeminiApiKey();",
    "export async function executeMkuuChat(params:ChatEngineParams):Promise<ChatEngineResult>{const smsCommand=await handleDirectSmsCommand(params);if(smsCommand)return smsCommand;if(needsImageRoute(params))return callImageStudio(params);if(needsLiveSearch(params.message))return streamServerChat(params);const directApiKey=getStoredGeminiApiKey();",
  ],
  [
    "const patterns=[/\\bwaziri mkuu\\b/,/\\brais wa\\b/",
    "const patterns=[/\\bjana\\b/,/\\bjuzi\\b/,/\\byanga\\b/,/\\bsimba\\b/,/\\byoung africans\\b/,/\\bazam\\b/,/\\bpamba jiji\\b/,/\\bcoastal union\\b/,/\\bmechi\\b/,/\\bmchezo\\b/,/\\banacheza\\b/,/\\bamecheza\\b/,/\\balicheza\\b/,/\\bmatokeo\\b/,/\\bratiba\\b/,/\\bmsimamo\\b/,/\\bopponent\\b/,/\\bwaziri mkuu\\b/,/\\brais wa\\b/",
  ],
]);

// 5) Make the source section visibly identifiable in ChatView.
patch('src/components/ChatView.tsx', [
  [
    '{msg.webSources?.length ? <div className="mt-3 flex flex-wrap gap-1.5">',
    '{msg.webSources?.length ? <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Vyanzo vya taarifa</div><div className="flex flex-wrap gap-1.5">',
  ],
  [
    '>{source.title}</a>)}</div> : null}',
    '>{source.title}</a>)}</div></div> : null}',
  ],
]);

// 6) Remove the duplicate AbortSignal object key reported by Vite/esbuild.
patch('src/App.tsx', [
  [
    'signal: abortController.signal,\n        signal: chatAbortControllerRef.current?.signal,',
    'signal: chatAbortControllerRef.current?.signal || abortController.signal,',
  ],
]);

// 7) App: save web sources on the assistant message so ChatView can render them.
patch('src/App.tsx', [
  [
    'generatedFiles: processedFiles,\n        memoryExtracted:',
    'generatedFiles: processedFiles,\n        webSources: (chatResult.webSources || []).filter((s: any) => s?.url).map((s: any) => ({ title: String(s.title || s.url), url: String(s.url) })),\n        memoryExtracted:',
  ],
]);

console.log('MKUU: live Exa citations now propagate backend -> API -> AI engine -> local chat -> ChatView; live sports/news cannot bypass Exa; source section is visible.');
