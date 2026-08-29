const fs = require('fs');
const path = require('path');

function patch(filePath, ...groups) {
  const file = path.join(process.cwd(), filePath);
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const replacements of groups) {
    for (const [from, to] of replacements) {
      if (source.includes(from)) {
        const next = source.replace(from, to);
        if (next !== source) changed = true;
        source = next;
      }
    }
  }
  if (changed) fs.writeFileSync(file, source);
}

// Backend: add the live-source container only once. Previous versions of this
// build patch could insert a second `webSources` declaration on every deploy.
patch('server/geminiService.ts', [
  [
    "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];",
    "    let aiReplyText = '';\n    let webSources: Array<{ title: string; url: string }> = [];",
  ],
]);

// If another earlier patch already added webSources, do not add it again.
{
  const file = path.join(process.cwd(), 'server', 'geminiService.ts');
  if (fs.existsSync(file)) {
    let source = fs.readFileSync(file, 'utf8');
    const declaration = "    let webSources: Array<{ title: string; url: string }> = [];";
    const matches = source.split(declaration).length - 1;
    if (matches > 1) {
      const first = source.indexOf(declaration);
      source = source.slice(0, first + declaration.length) + source.slice(first + declaration.length).replaceAll(declaration, '');
      fs.writeFileSync(file, source);
    }
  }
}

// Return Exa citations through the HTTP API when the fields exist.
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

// Client engine: preserve source links returned by /api/chat.
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

// Streaming: retain sources from the final done event.
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

// App: save sources with the assistant message.
patch('src/App.tsx', [
  [
    'generatedFiles: processedFiles,\n        memoryExtracted:',
    'generatedFiles: processedFiles,\n        webSources: (chatResult.webSources || []).filter((s: any) => s?.url).map((s: any) => ({ title: String(s.title || s.url), url: String(s.url) })),\n        memoryExtracted:',
  ],
  [
    'signal: abortController.signal,\n        signal: chatAbortControllerRef.current?.signal,',
    'signal: chatAbortControllerRef.current?.signal || abortController.signal,',
  ],
]);

console.log('MKUU: live source pipeline is idempotent; Exa citations propagate without duplicate declarations.');
