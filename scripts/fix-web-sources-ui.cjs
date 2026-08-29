const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

// App: persist the structured live-source list on assistant messages.
{
  const file = 'src/App.tsx';
  let source = read(file);
  const marker = '        generatedFiles: processedFiles,\n        memoryExtracted:';
  const replacement = '        generatedFiles: processedFiles,\n        webSources: (chatResult.webSources || []).filter((s: any) => s?.url).map((s: any) => ({ title: String(s.title || s.url), url: String(s.url) })),\n        memoryExtracted:';
  if (!source.includes('webSources: (chatResult.webSources || [])') && source.includes(marker)) {
    source = source.replace(marker, replacement);
    write(file, source);
  }
}

// AI engine: preserve source links returned by /api/chat.
{
  const file = 'src/services/aiEngine.ts';
  let source = read(file);
  const resultMarker = "export interface ChatEngineResult { reply:string; cleanSpeechText:string; memoriesExtracted?:Memory[]; peopleRecognized?:Person[]; generatedFiles?:GeneratedFileSummary[];";
  if (!source.includes('webSources?: { title: string; url: string }[];') && source.includes(resultMarker)) {
    source = source.replace(resultMarker, resultMarker + " webSources?: { title: string; url: string }[];");
  }
  const nativeMarker = "generatedFiles:serverRes.generatedFiles,engineUsed:'server',aiProvider:";
  if (!source.includes('webSources:serverRes.webSources||[]') && source.includes(nativeMarker)) {
    source = source.replace(nativeMarker, "generatedFiles:serverRes.generatedFiles,webSources:serverRes.webSources||[],engineUsed:'server',aiProvider:");
  }
  write(file, source);
}

// Server API: expose the source list returned by the backend.
{
  const file = 'server.ts';
  let source = read(file);
  const marker = 'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,';
  if (!source.includes('webSources:result.webSources') && source.includes(marker)) {
    source = source.replace(marker, marker + 'webSources:result.webSources||[],');
    write(file, source);
  }
}

// ChatView: replace the existing compact source chips with a clear, clickable
// numbered source section. This intentionally uses exact string matching instead
// of a large JSX regular expression; the previous regex was parsed by Node as
// having invalid flags and stopped the entire Faable build.
{
  const file = 'src/components/ChatView.tsx';
  let source = read(file);

  if (source.includes('id="mkuu-web-sources"')) {
    console.log('MKUU: Numbered web sources UI already enabled; skipping.');
  } else {
    const compactBlock = '{msg.webSources?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{msg.webSources.slice(0, 6).map((source, i) => <a key={i} href={source.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-zinc-400 hover:text-[#D4AF37]">{source.title}</a>)}</div> : null}';
    const block = '{msg.webSources?.length ? <div id="mkuu-web-sources" className="mt-4 w-full border-t border-white/[0.08] pt-3"><div className="mb-2.5 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">Vyanzo vya taarifa</span><span className="text-[9px] uppercase tracking-wider text-zinc-600">{msg.webSources.length} source{msg.webSources.length === 1 ? "" : "s"}</span></div><div className="space-y-1.5">{msg.webSources.slice(0, 8).map((source, i) => <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 no-underline transition hover:border-[#D4AF37]/30 hover:bg-white/[0.04]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[10px] font-bold text-[#D4AF37]">{i + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-zinc-300 group-hover:text-[#D4AF37]">{source.title || source.url}</span><span className="mt-0.5 block truncate text-[9px] text-zinc-600">{source.url}</span></span><span className="shrink-0 text-zinc-600 group-hover:text-[#D4AF37]">↗</span></a>)}</div></div> : null}';

    if (source.includes(compactBlock)) {
      source = source.replace(compactBlock, block);
      write(file, source);
      console.log('MKUU: Clearly labelled numbered live-source section enabled.');
    } else {
      console.warn('MKUU: Existing webSources UI pattern not found; leaving ChatView unchanged.');
    }
  }
}

console.log('MKUU: web-source UI pipeline is syntax-safe and idempotent.');
