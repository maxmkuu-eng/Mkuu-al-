const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(path.join(root, rel), value, 'utf8');

function patch(rel, fn, label) {
  const before = read(rel);
  const after = fn(before);
  if (after !== before) {
    write(rel, after);
    console.log(`[MKUU-EXA] ${label}: patched`);
  } else {
    console.log(`[MKUU-EXA] ${label}: already patched/no-op`);
  }
}

// This script must be safe to run repeatedly. Earlier versions aborted the
// entire Android build when a source-layout marker had already changed.
patch('server.ts', (text) => {
  if (text.includes('webSources:result.webSources||[]')) return text;
  const exact = 'latencyMs:result.latencyMs};';
  if (text.includes(exact)) {
    return text.replace(exact, 'latencyMs:result.latencyMs,webSources:(result as any).webSources||[]};');
  }
  return text.replace(/return \{reply:result\.reply,cleanSpeechText:result\.cleanSpeechText,memoriesExtracted:result\.memoriesExtracted,peopleRecognized:result\.peopleRecognized,generatedFiles:result\.generatedFiles,aiProvider:result\.aiProvider,chatModel:result\.chatModel,latencyMs:result\.latencyMs\};/, 'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs,webSources:(result as any).webSources||[]};');
}, 'server webSources response bridge');

patch('src/services/aiEngine.ts', (text) => {
  let out = text;
  if (!out.includes('webSources?:Array<{title:string;url:string}>;')) {
    out = out.replace(/intent\?:string;\s*}/, "intent?:string; webSources?:Array<{title:string;url:string}>; }");
  }
  if (!out.includes('webSources:serverRes.webSources')) {
    out = out.replace(/intent:serverRes\.intent\|\|'chat'\}/, "intent:serverRes.intent||'chat',webSources:serverRes.webSources||[]}");
  }
  return out;
}, 'client webSources type/bridge');

patch('src/App.tsx', (text) => {
  if (text.includes('webSources: chatResult.webSources')) return text;
  return text.replace('generatedFiles: processedFiles,\n        memoryExtracted:', 'generatedFiles: processedFiles,\n        webSources: chatResult.webSources || [],\n        memoryExtracted:');
}, 'ChatMessage webSources persistence');

console.log('MKUU: Exa source cards bridge is idempotent; build will not fail on an already-patched target.');
