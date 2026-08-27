const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// 1) Persist structured web sources on the assistant message.
// -----------------------------------------------------------------------------
const appFile = path.join(process.cwd(), 'src/App.tsx');
let appSource = fs.readFileSync(appFile, 'utf8');
const appMarker = '        generatedFiles: processedFiles,\n        memoryExtracted:';
if (!appSource.includes('webSources: chatResult.webSources')) {
  if (!appSource.includes(appMarker)) throw new Error('MKUU: App web-sources insertion point not found.');
  appSource = appSource.replace(appMarker, '        generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:');
  fs.writeFileSync(appFile, appSource);
  console.log('MKUU: Structured web sources are now persisted on assistant messages.');
} else console.log('MKUU: App web-sources wiring already enabled; skipping.');

// -----------------------------------------------------------------------------
// 2) Carry Exa sources from the backend response into ChatEngineResult.
// This supports both the older SSE client and the current JSON/word-reveal path.
// -----------------------------------------------------------------------------
const engineFile = path.join(process.cwd(), 'src/services/aiEngine.ts');
let engineSource = fs.readFileSync(engineFile, 'utf8');

if (!engineSource.includes('webSources?: { title: string; url: string }[];')) {
  const resultMarker = "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[];";
  if (!engineSource.includes(resultMarker)) throw new Error('MKUU: ChatEngineResult insertion point not found.');
  engineSource = engineSource.replace(resultMarker, resultMarker + " webSources?: { title: string; url: string }[];");
}

// Native /api/chat path.
if (!engineSource.includes('webSources:serverRes.webSources||[]')) {
  const nativeMarker = "generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:";
  if (engineSource.includes(nativeMarker)) {
    engineSource = engineSource.replace(nativeMarker, "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server',aiProvider:");
  }
}

// Current production stream is actually JSON /api/chat with a word-by-word UI reveal.
// Do not require an SSE insertion point here; that implementation was intentionally removed.
const streamStartMarker = 'async function streamServerChat(params:ChatEngineParams):Promise<ChatEngineResult>{';
const streamEndMarker = 'export async function executeMkuuChat';
const streamStart = engineSource.indexOf(streamStartMarker);
const streamEnd = engineSource.indexOf(streamEndMarker, streamStart);
if (streamStart !== -1 && streamEnd !== -1) {
  let streamSource = engineSource.slice(streamStart, streamEnd);

  if (!streamSource.includes('const webSources:Array<{title:string;url:string}>')) {
    const jsonReplyMarker = "const reply=String(serverRes?.reply||'');";
    if (streamSource.includes(jsonReplyMarker)) {
      streamSource = streamSource.replace(
        jsonReplyMarker,
        "const webSources:Array<{title:string;url:string}>=Array.isArray(serverRes?.webSources)?serverRes.webSources:[];\n const reply=String(serverRes?.reply||'');",
      );
    } else {
      const sseMarker = "let buffer='';let reply='';emitStream('',false);";
      if (streamSource.includes(sseMarker)) {
        streamSource = streamSource.replace(
          sseMarker,
          "let buffer='';let reply='';let webSources:Array<{title:string;url:string}>=[];emitStream('',false);",
        );
        const eventMarker = "if(payload.type==='delta'&&payload.text){reply+=payload.text;emitStream(payload.text,false);}if(payload.type==='error')";
        if (streamSource.includes(eventMarker)) {
          streamSource = streamSource.replace(
            eventMarker,
            "if(payload.type==='delta'&&payload.text){reply+=payload.text;emitStream(payload.text,false);}if(payload.type==='done'&&Array.isArray(payload.webSources))webSources=payload.webSources;if(payload.type==='error')",
          );
        }
      }
    }
  }

  if (!streamSource.includes('webSources,engineUsed:')) {
    const returnMarker = "generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:";
    if (streamSource.includes(returnMarker)) {
      streamSource = streamSource.replace(
        returnMarker,
        "generatedFiles:serverRes.generatedFiles,webSources,engineUsed:'server',aiProvider:",
      );
    }
  }

  if (!streamSource.includes('webSources};') && streamSource.includes('let webSources:Array<{title:string;url:string}>')) {
    const oldSseReturn = "chatModel:'gemini-3.7-flash',intent:'chat'};}";
    if (streamSource.includes(oldSseReturn)) {
      streamSource = streamSource.replace(
        oldSseReturn,
        "chatModel:'gemini-3.7-flash',intent:'chat',webSources};}",
      );
    }
  }

  engineSource = engineSource.slice(0, streamStart) + streamSource + engineSource.slice(streamEnd);
} else {
  console.warn('MKUU: streamServerChat function not found; preserving current chat engine implementation.');
}

fs.writeFileSync(engineFile, engineSource);

// -----------------------------------------------------------------------------
// 3) Expose structured Exa citations from /api/chat and /api/chat/stream.
// -----------------------------------------------------------------------------
const serverFile = path.join(process.cwd(), 'server.ts');
let serverSource = fs.readFileSync(serverFile, 'utf8');
const serverReturnMarker = 'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,';
if (!serverSource.includes('webSources:result.webSources')) {
  if (!serverSource.includes(serverReturnMarker)) throw new Error('MKUU: /api/chat web-sources return marker not found.');
  serverSource = serverSource.replace(serverReturnMarker, serverReturnMarker + 'webSources:result.webSources||[],' );
  fs.writeFileSync(serverFile, serverSource);
  console.log('MKUU: /api/chat and streaming responses now expose Exa sources.');
} else console.log('MKUU: Backend web-sources response already enabled; skipping.');

// -----------------------------------------------------------------------------
// 4) Render sources as a clean, separated numbered section below the answer.
// -----------------------------------------------------------------------------
const file = path.join(process.cwd(), 'src/components/ChatView.tsx');
let source = fs.readFileSync(file, 'utf8');
if (source.includes('id="mkuu-web-sources"')) {
  console.log('MKUU: Web sources UI already formatted; skipping.');
  process.exit(0);
}

const marker = '<div className="flex items-center space-x-3 px-2 text-[10px] text-[#888888]"><span>MKUU AI • {new Date(msg.timestamp).toLocaleTimeString([], { hour: \'2-digit\', minute: \'2-digit\' })}</span>';
if (!source.includes(marker)) {
  console.error('MKUU: Web sources UI insertion point not found; preserving current ChatView.');
  process.exit(0);
}

const block = `{msg.webSources && msg.webSources.length > 0 && <div id="mkuu-web-sources" className="mt-4 pt-3 border-t border-[#222222] not-italic font-sans w-full"><div className="flex items-center justify-between mb-2.5"><span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider">Vyanzo</span><span className="text-[9px] text-[#666666] uppercase tracking-wider">{msg.webSources.length} source{msg.webSources.length === 1 ? '' : 's'}</span></div><div className="space-y-2">{msg.webSources.map((source, idx) => <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 p-2.5 rounded-xl bg-[#111111]/80 border border-[#222222] hover:border-[#D4AF37]/40 hover:bg-white/[0.03] transition-colors no-underline"><span className="w-7 h-7 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] flex items-center justify-center text-[11px] font-bold flex-shrink-0">{idx + 1}</span><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#F5F2ED] group-hover:text-[#D4AF37] truncate">{source.title || source.url}</span><span className="block text-[9px] text-[#666666] truncate mt-0.5">{source.url.replace(/^https?:\\/\\//, '').split('/')[0]}</span></span><span className="text-[#666666] group-hover:text-[#D4AF37] text-sm flex-shrink-0">↗</span></a>)}</div></div>}`;
source = source.replace(marker, `${block}${marker}`);
fs.writeFileSync(file, source);
console.log('MKUU: Numbered web sources UI enabled.');