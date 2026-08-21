const fs = require('node:fs');

function patch(filePath, label, transform) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after, 'utf8');
    console.log(`MKUU: ${label} applied.`);
  } else {
    console.log(`MKUU: ${label} already applied.`);
  }
}

patch('src/services/aiEngine.ts', 'client source propagation', (source) => {
  if (!source.includes('webSources?: Array<{ title: string; url: string }>;')) {
    source = source.replace(
      '  generatedFiles?: GeneratedFileSummary[];\n  engineUsed:',
      '  generatedFiles?: GeneratedFileSummary[];\n  webSources?: Array<{ title: string; url: string }>;\n  engineUsed:'
    );
  }
  if (!source.includes('webSources: Array.isArray(serverRes.webSources)')) {
    source = source.replace(
      "    generatedFiles: serverRes.generatedFiles,\n    engineUsed: 'server',",
      "    generatedFiles: serverRes.generatedFiles,\n    webSources: Array.isArray(serverRes.webSources) ? serverRes.webSources : [],\n    engineUsed: 'server',"
    );
  }
  if (!source.includes('let webSources: Array<{ title: string; url: string }> = [];')) {
    source = source.replace(
      "  let reply = '';\n  emitStream('', false);",
      "  let reply = '';\n  let webSources: Array<{ title: string; url: string }> = [];\n  emitStream('', false);"
    );
    source = source.replace(
      "        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');",
      "        if (payload.type === 'done' && Array.isArray(payload.webSources)) webSources = payload.webSources;\n        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');"
    );
    source = source.replace(
      "  return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };",
      "  return { reply, cleanSpeechText: reply.replace(/[#*`_~[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim(), webSources, engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };"
    );
  }
  return source;
});

patch('src/App.tsx', 'assistant message source persistence', (source) => {
  return source.replace(
    "        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        savedOffline: true,",
    "        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),\n        webSources: Array.isArray(chatResult.webSources) ? chatResult.webSources : [],\n        savedOffline: true,"
  );
});

patch('src/components/ChatView.tsx', 'visible per-response source footer', (source) => {
  if (source.includes('/* Sources used for this response */')) return source;
  const needle = '                        {/* Generated Real Binary Files / Images Cards */}';
  const block = `                        {/* Sources used for this response */}\n                        {msg.webSources && msg.webSources.length > 0 && (\n                          <div className="mt-3 pt-3 border-t border-[#222222] not-italic font-sans">\n                            <div className="flex items-center justify-end mb-2 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">\n                              <span>Vyanzo vya Taarifa</span>\n                            </div>\n                            <div className="flex flex-wrap justify-end gap-1.5">\n                              {msg.webSources.map((source, idx) => (\n                                <a\n                                  key={source.url || idx}\n                                  href={source.url}\n                                  target="_blank"\n                                  rel="noopener noreferrer"\n                                  className="inline-flex max-w-full items-center px-2.5 py-1.5 rounded-lg bg-white/5 border border-[#333333] text-[10px] text-[#BBBBBB] hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition"\n                                  title={source.url}\n                                >\n                                  <span className="truncate max-w-[220px]">{source.title || source.url}</span>\n                                </a>\n                              ))}\n                            </div>\n                          </div>\n                        )}\n\n`;
  if (!source.includes(needle)) throw new Error('MKUU: ChatView source insertion point not found.');
  return source.replace(needle, block + needle);
});

console.log('MKUU: response-specific sources now flow backend -> API -> message -> UI.');
