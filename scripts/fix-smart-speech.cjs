const fs = require('fs');

function replaceOnce(file, from, to, label) {
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) return false;
  if (!source.includes(from)) throw new Error(`[MKUU] ${label}: target not found`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
  console.log(`[MKUU] ${label}: fixed`);
  return true;
}

// ChatView: Stop must call the real App cancellation handler. It must not be
// disabled while loading, and speaker playback must use the native TTS service.
let chat = fs.readFileSync('src/components/ChatView.tsx', 'utf8');
if (!chat.includes("../services/smartSpeech")) {
  const anchor = "import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';";
  if (!chat.includes(anchor)) throw new Error('[MKUU] TTS import anchor not found');
  chat = chat.replace(anchor, `${anchor}\nimport { speakSmart, stopSmartSpeech } from '../services/smartSpeech';`);
}
chat = chat.replace(
  '  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;\n  onRetryMessage?:',
  '  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;\n  onStopGeneration?: () => void;\n  onRetryMessage?:'
);
chat = chat.replace(
  '  messages, conversationTitle = \'Mkuu\', onSendMessage, onRetryMessage, isLoading,',
  '  messages, conversationTitle = \'Mkuu\', onSendMessage, onStopGeneration, onRetryMessage, isLoading,'
);
chat = chat.replace(
  '    if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;',
  '    if (isLoading) { onStopGeneration?.(); return; }\n    if (!inputText.trim() && selectedAttachments.length === 0) return;'
);
const oldPlayStart = '  const playSpeech = ';
if (chat.includes(oldPlayStart) && !chat.includes('await speakSmart(clean, \'sw-TZ\')')) {
  const start = chat.indexOf(oldPlayStart);
  const bodyStart = chat.indexOf('{', start);
  let depth = 0, quote = null, escaped = false, end = -1;
  for (let i = bodyStart; i < chat.length; i++) {
    const c = chat[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('[MKUU] TTS playSpeech function boundary not found');
  const fn = `  const playSpeech = async (id: string, text: string) => {\n    const clean = String(text || '').trim();\n    if (!clean) return;\n    if (playingMessageId === id) {\n      await stopSmartSpeech();\n      setPlayingMessageId(null);\n      return;\n    }\n    await stopSmartSpeech();\n    setPlayingMessageId(id);\n    try {\n      await speakSmart(clean, 'sw-TZ');\n    } catch (error) {\n      console.warn('[TTS] native speech failed:', error);\n    } finally {\n      setPlayingMessageId(null);\n    }\n  };`;
  chat = chat.slice(0, start) + fn + chat.slice(end);
}
fs.writeFileSync('src/components/ChatView.tsx', chat);
console.log('[MKUU] ChatView native speaker + Stop control ready');

// App: create a real AbortController for every chat request and expose it to ChatView.
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect, useRef } from 'react';");
if (!app.includes('const chatAbortControllerRef = useRef<AbortController | null>(null);')) {
  const stateAnchor = '  const [isLoading, setIsLoading] = useState(false);';
  if (!app.includes(stateAnchor)) throw new Error('[MKUU] App loading state anchor not found');
  app = app.replace(stateAnchor, `${stateAnchor}\n  const chatAbortControllerRef = useRef<AbortController | null>(null);`);
}
const execAnchor = '    try {\n      // 2. Execute Multi-Tier AI Engine';
if (app.includes(execAnchor) && !app.includes('chatAbortControllerRef.current = new AbortController();')) {
  app = app.replace(execAnchor, '    try {\n      chatAbortControllerRef.current = new AbortController();\n      // 2. Execute Multi-Tier AI Engine');
  app = app.replace(
    '        people,\n      });',
    '        people,\n        signal: chatAbortControllerRef.current.signal,\n      });'
  );
}
if (!app.includes('const handleStopGeneration = () =>')) {
  const marker = '  // Retry Failed Message with fresh network execution (NO local mock)';
  if (!app.includes(marker)) throw new Error('[MKUU] App retry marker not found');
  const stopFn = `  const handleStopGeneration = () => {\n    chatAbortControllerRef.current?.abort();\n    chatAbortControllerRef.current = null;\n    setIsLoading(false);\n  };\n\n`;
  app = app.replace(marker, stopFn + marker);
}
app = app.replace(
  '            onSendMessage={handleSendMessage}\n            onRetryMessage=',
  '            onSendMessage={handleSendMessage}\n            onStopGeneration={handleStopGeneration}\n            onRetryMessage='
);
app = app.replace(
  '    } finally {\n      setIsLoading(false);',
  '    } finally {\n      chatAbortControllerRef.current = null;\n      setIsLoading(false);'
);
fs.writeFileSync('src/App.tsx', app);
console.log('[MKUU] App real AbortController + Send/Stop wiring ready');

// Do not alter live-search/provider routing here.
