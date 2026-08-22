const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/components/ChatView.tsx');
if (!fs.existsSync(file)) throw new Error('MKUU: ChatView.tsx not found.');
let source = fs.readFileSync(file, 'utf8');

const importMarker = "import { getApiUrl } from '../services/apiConfig';";
if (!source.includes("import { SmartShareExport } from './SmartShareExport';")) {
  if (!source.includes(importMarker)) throw new Error('MKUU: ChatView import marker not found.');
  source = source.replace(importMarker, `${importMarker}\nimport { SmartShareExport } from './SmartShareExport';`);
}

const stateMarker = '  const getFileIcon = (type: string) => {';
if (!source.includes('const latestAssistantMessage = [...messages].reverse().find((message) => message.role === \'assistant\');')) {
  if (!source.includes(stateMarker)) throw new Error('MKUU: ChatView insertion marker not found.');
  source = source.replace(
    stateMarker,
    "  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');\n\n" + stateMarker
  );
}

const returnMarker = '  return (\n    <div className="flex-1 flex flex-col';
if (!source.includes(returnMarker)) throw new Error('MKUU: ChatView return marker not found.');

const headerMarker = '<button id="chat-voice-hud-btn" onClick={onOpenVoice}';
const alreadyRendered = '<SmartShareExport title={conversationTitle} content={latestAssistantMessage.content} />';
if (!source.includes(alreadyRendered)) {
  const start = source.indexOf(headerMarker);
  if (start < 0) throw new Error('MKUU: ChatView voice button marker not found.');
  const end = source.indexOf('</button>', start);
  if (end < 0) throw new Error('MKUU: ChatView voice button end marker not found.');
  const after = end + '</button>'.length;
  source = source.slice(0, after) + `\n          {latestAssistantMessage?.content && <SmartShareExport title={conversationTitle} content={latestAssistantMessage.content} />}` + source.slice(after);
}

fs.writeFileSync(file, source);
console.log('MKUU: Smart Share & Export added without changing existing chat features.');
