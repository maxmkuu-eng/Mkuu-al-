const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// 1) Persist structured web sources on the assistant message.
// The backend/Exa layer already returns webSources; App.tsx previously dropped
// them when constructing ChatMessage, so the UI could never render them.
// -----------------------------------------------------------------------------
const appFile = path.join(process.cwd(), 'src/App.tsx');
let appSource = fs.readFileSync(appFile, 'utf8');
const appMarker = '        generatedFiles: processedFiles,\n        memoryExtracted:';
if (!appSource.includes('webSources: chatResult.webSources')) {
  if (!appSource.includes(appMarker)) {
    throw new Error('MKUU: App web-sources insertion point not found.');
  }
  appSource = appSource.replace(
    appMarker,
    '        generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:',
  );
  fs.writeFileSync(appFile, appSource);
  console.log('MKUU: Structured web sources are now persisted on assistant messages.');
} else {
  console.log('MKUU: App web-sources wiring already enabled; skipping.');
}

// -----------------------------------------------------------------------------
// 2) Carry Exa sources from /api/chat and /api/chat/stream into ChatEngineResult.
// -----------------------------------------------------------------------------
const engineFile = path.join(process.cwd(), 'src/services/aiEngine.ts');
let engineSource = fs.readFileSync(engineFile, 'utf8');

if (!engineSource.includes('webSources?: { title: string; url: string }[];')) {
  const resultMarker = "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[];";
  if (!engineSource.includes(resultMarker)) {
    throw new Error('MKUU: ChatEngineResult insertion point not found.');
  }
  engineSource = engineSource.replace(
    resultMarker,
    resultMarker + " webSources?: { title: string; url: string }[];",
  );
}

if (!engineSource.includes('webSources:serverRes.webSources||[]')) {
  const nativeMarker = "generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:";
  if (!engineSource.includes(nativeMarker)) {
    throw new Error('MKUU: Native server web-sources insertion point not found.');
  }
  engineSource = engineSource.replace(
    nativeMarker,
    "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server',aiProvider:",
  );
}

if (!engineSource.includes('webSources:serverRes.webSources||[]')) {
  const agentMarker = "generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:";
  if (engineSource.includes(agentMarker)) {
    engineSource = engineSource.replace(
      agentMarker,
      "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server',aiProvider:",
    );
  }
}

if (!engineSource.includes('let webSources:{title:string;url:string}[]=[];')) {
  const streamMarker = "let buffer='';let reply='';emitStream('',false);";
  if (!engineSource.includes(streamMarker)) {
    throw new Error('MKUU: Streaming web-sources insertion point not found.');
  }
  engineSource = engineSource.replace(
    streamMarker,
    "let buffer='';let reply='';let webSources:{title:string;url:string}[]=[];emitStream('',false);",
  );
}

if (!engineSource.includes("if(payload.type==='done'&&Array.isArray(payload.webSources))webSources=payload.webSources;")) {
  const streamEventMarker = "if(payload.type==='delta'&&payload.text){reply+=payload.text;emitStream(payload.text,false);}if(payload.type==='error')";
  if (!engineSource.includes(streamEventMarker)) {
    throw new Error('MKUU: Streaming event insertion point not found.');
  }
  engineSource = engineSource.replace(
    streamEventMarker,
    "if(payload.type==='delta'&&payload.text){reply+=payload.text;emitStream(payload.text,false);}if(payload.type==='done'&&Array.isArray(payload.webSources))webSources=payload.webSources;if(payload.type==='error')",
  );
}

if (!engineSource.includes("chatModel:'gemini-3.7-flash',intent:'chat',webSources")) {
  const streamReturnMarker = "engineUsed:'server',aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat'};}\nexport async function executeMkuuChat";
  if (!engineSource.includes(streamReturnMarker)) {
    throw new Error('MKUU: Streaming return web-sources insertion point not found.');
  }
  engineSource = engineSource.replace(
    streamReturnMarker,
    "engineUsed:'server',aiProvider:'Google Gemini',chatModel:'gemini-3.7-flash',intent:'chat',webSources};}\nexport async function executeMkuuChat",
  );
}

fs.writeFileSync(engineFile, engineSource);
console.log('MKUU: Live web sources now flow from Exa -> backend -> App -> ChatView.');

// -----------------------------------------------------------------------------
// 3) Render the sources as a clean, separated numbered source section.
// -----------------------------------------------------------------------------
const file = path.join(process.cwd(), 'src/components/ChatView.tsx');
let source = fs.readFileSync(file, 'utf8');

if (source.includes('id="mkuu-web-sources"')) {
  console.log('MKUU: Web sources UI already formatted; skipping.');
  process.exit(0);
}

const marker = '<div className="flex items-center space-x-3 px-2 text-[10px] text-[#888888]"><span>MKUU AI • {new Date(msg.timestamp).toLocaleTimeString([], { hour: \'2-digit\', minute: \'2-digit\' })}</span>';

if (!source.includes(marker)) {
  console.error('MKUU: Web sources UI insertion point not found.');
  process.exit(1);
}

const block = `{msg.webSources && msg.webSources.length > 0 && <div id="mkuu-web-sources" className="mt-4 pt-3 border-t border-[#222222] not-italic font-sans w-full"><div className="flex items-center justify-between mb-2.5"><span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider">Vyanzo</span><span className="text-[9px] text-[#666666] uppercase tracking-wider">{msg.webSources.length} source{msg.webSources.length === 1 ? '' : 's'}</span></div><div className="space-y-2">{msg.webSources.map((source, idx) => <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 p-2.5 rounded-xl bg-[#111111]/80 border border-[#222222] hover:border-[#D4AF37]/40 hover:bg-white/[0.03] transition-colors no-underline"><span className="w-7 h-7 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] flex items-center justify-center text-[11px] font-bold flex-shrink-0">{idx + 1}</span><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#F5F2ED] group-hover:text-[#D4AF37] truncate">{source.title || source.url}</span><span className="block text-[9px] text-[#666666] truncate mt-0.5">{source.url.replace(/^https?:\\/\\//, '').split('/')[0]}</span></span><span className="text-[#666666] group-hover:text-[#D4AF37] text-sm flex-shrink-0">↗</span></a>)}</div></div>}`;

const updated = source.replace(marker, `${block}${marker}`);
fs.writeFileSync(file, updated);
console.log('MKUU: Numbered web sources UI enabled.');