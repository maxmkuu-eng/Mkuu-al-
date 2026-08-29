const fs = require('fs');
const path = require('path');

const appFile = path.join(process.cwd(), 'src/App.tsx');
let appSource = fs.readFileSync(appFile, 'utf8');
const appMarker = '        generatedFiles: processedFiles,\n        memoryExtracted:';
if (!appSource.includes('webSources: chatResult.webSources') && appSource.includes(appMarker)) {
  appSource = appSource.replace(appMarker, '        generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:');
  fs.writeFileSync(appFile, appSource);
  console.log('MKUU: Structured web sources are now persisted on assistant messages.');
}

const engineFile = path.join(process.cwd(), 'src/services/aiEngine.ts');
let engineSource = fs.readFileSync(engineFile, 'utf8');
if (!engineSource.includes('webSources?: { title: string; url: string }[];')) {
  const resultMarker = "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[];";
  if (engineSource.includes(resultMarker)) engineSource = engineSource.replace(resultMarker, resultMarker + " webSources?: { title: string; url: string }[];");
}
if (!engineSource.includes('webSources:serverRes.webSources||[]')) {
  const nativeMarker = "generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:";
  if (engineSource.includes(nativeMarker)) engineSource = engineSource.replace(nativeMarker, "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server',aiProvider:");
}
fs.writeFileSync(engineFile, engineSource);

const serverFile = path.join(process.cwd(), 'server.ts');
let serverSource = fs.readFileSync(serverFile, 'utf8');
const serverReturnMarker = 'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,';
if (!serverSource.includes('webSources:result.webSources') && serverSource.includes(serverReturnMarker)) {
  serverSource = serverSource.replace(serverReturnMarker, serverReturnMarker + 'webSources:result.webSources||[],' );
  fs.writeFileSync(serverFile, serverSource);
  console.log('MKUU: /api/chat and streaming responses now expose Exa sources.');
}

// Render sources even when the redesigned ChatView does not contain the old
// footer insertion point. The existing compact source chips are replaced with a
// clearly labelled, numbered VYANZO section so the user can see exactly where a
// live answer came from.
const file = path.join(process.cwd(), 'src/components/ChatView.tsx');
let source = fs.readFileSync(file, 'utf8');
if (source.includes('id="mkuu-web-sources"')) {
  console.log('MKUU: Numbered web sources UI already enabled; skipping.');
  process.exit(0);
}

const compactPattern = /\{msg\.webSources\?\.length \? <div className="mt-3 flex flex-wrap gap-1\.5">\{msg\.webSources\.slice\(0, 6\)\.map\(\(source, i\) => <a key=\{i\} href=\{source\.url\} target="_blank" rel="noreferrer" className="rounded-full border border-white\/\[0\.08\] bg-white\/\[0\.03\] px-2\.5 py-1 text-\[10px\] text-zinc-400 hover:text-\[#D4AF37\]">\{source\.title\}</a>\)\}</div> : null\}"/;

const block = `{msg.webSources?.length ? <div id="mkuu-web-sources" className="mt-4 w-full border-t border-white/[0.08] pt-3"><div className="mb-2.5 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">Vyanzo vya taarifa</span><span className="text-[9px] uppercase tracking-wider text-zinc-600">{msg.webSources.length} source{msg.webSources.length === 1 ? '' : 's'}</span></div><div className="space-y-1.5">{msg.webSources.slice(0, 8).map((source, i) => <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 no-underline transition hover:border-[#D4AF37]/30 hover:bg-white/[0.04]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[10px] font-bold text-[#D4AF37]">{i + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-zinc-300 group-hover:text-[#D4AF37]">{source.title || source.url}</span><span className="mt-0.5 block truncate text-[9px] text-zinc-600">{source.url}</span></span><span className="shrink-0 text-zinc-600 group-hover:text-[#D4AF37]">↗</span></a>)}</div></div> : null}`;

if (compactPattern.test(source)) {
  source = source.replace(compactPattern, block);
  fs.writeFileSync(file, source);
  console.log('MKUU: Clearly labelled numbered live-source section enabled.');
} else {
  console.warn('MKUU: Existing webSources UI pattern changed; source section was not rewritten.');
}
