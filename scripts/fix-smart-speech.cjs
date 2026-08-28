const fs = require('fs');

function mustReplace(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[MKUU] ${label}: target not found`);
  return source.replace(from, to);
}

// Native speaker for Android + browser fallback.
let chat = fs.readFileSync('src/components/ChatView.tsx', 'utf8');
const typeImport = "import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';";
if (!chat.includes("../services/smartSpeech")) {
  if (!chat.includes(typeImport)) throw new Error('[MKUU] TTS import anchor not found');
  chat = chat.replace(typeImport, `${typeImport}\nimport { speakSmart, stopSmartSpeech } from '../services/smartSpeech';`);
}
chat = mustReplace(chat,
  '  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;\n  onRetryMessage?:',
  '  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;\n  onStopGeneration?: () => void;\n  onRetryMessage?:',
  'ChatView Stop prop');
chat = mustReplace(chat,
  "  messages, conversationTitle = 'Mkuu', onSendMessage, onRetryMessage, isLoading,",
  "  messages, conversationTitle = 'Mkuu', onSendMessage, onStopGeneration, onRetryMessage, isLoading,",
  'ChatView Stop destructuring');
chat = mustReplace(chat,
  '    if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;',
  '    if (isLoading) { onStopGeneration?.(); return; }\n    if (!inputText.trim() && selectedAttachments.length === 0) return;',
  'ChatView Stop handler');
chat = chat.replace(
  'disabled={isLoading || (!inputText.trim() && selectedAttachments.length === 0)} aria-label="Tuma"',
  'disabled={!isLoading && (!inputText.trim() && selectedAttachments.length === 0)} aria-label={isLoading ? "Stop" : "Tuma"} title={isLoading ? "Simamisha jibu" : "Tuma ujumbe"}'
);

// Replace the existing speaker function by balanced-brace parsing.
if (!chat.includes('await speakSmart(clean, \'sw-TZ\')')) {
  const marker = '  const playSpeech = ';
  const start = chat.indexOf(marker);
  if (start < 0) throw new Error('[MKUU] speaker function not found');
  const bodyStart = chat.indexOf('{', start);
  let depth = 0, quote = null, escaped = false, end = -1;
  for (let i = bodyStart; i < chat.length; i++) {
    const c = chat[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('[MKUU] speaker function boundary not found');
  const replacement = `  const playSpeech = async (id: string, text: string) => {\n    const clean = String(text || '').trim();\n    if (!clean) return;\n    if (playingMessageId === id) {\n      await stopSmartSpeech();\n      setPlayingMessageId(null);\n      return;\n    }\n    await stopSmartSpeech();\n    setPlayingMessageId(id);\n    try {\n      await speakSmart(clean, 'sw-TZ');\n    } catch (error) {\n      console.warn('[TTS] native speech failed:', error);\n    } finally {\n      setPlayingMessageId(null);\n    }\n  };`;
  chat = chat.slice(0, start) + replacement + chat.slice(end);
}
fs.writeFileSync('src/components/ChatView.tsx', chat);

// App: real AbortController, passed through to aiEngine so Stop actually cancels fetch.
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect, useRef } from 'react';");
if (!app.includes('const chatAbortControllerRef = useRef<AbortController | null>(null);')) {
  const anchor = '  const [isLoading, setIsLoading] = useState(false);';
  if (!app.includes(anchor)) throw new Error('[MKUU] App loading state not found');
  app = app.replace(anchor, `${anchor}\n  const chatAbortControllerRef = useRef<AbortController | null>(null);`);
}
if (!app.includes('chatAbortControllerRef.current = new AbortController();')) {
  const anchor = '    try {\n      // 2. Execute Multi-Tier AI Engine';
  if (!app.includes(anchor)) throw new Error('[MKUU] App execute anchor not found');
  app = app.replace(anchor, '    try {\n      chatAbortControllerRef.current = new AbortController();\n      // 2. Execute Multi-Tier AI Engine');
  const callStart = app.indexOf('      const chatResult = await executeMkuuChat({');
  const callEnd = callStart >= 0 ? app.indexOf('      });', callStart) : -1;
  if (callStart < 0 || callEnd < 0) throw new Error('[MKUU] executeMkuuChat call not found');
  const segment = app.slice(callStart, callEnd);
  if (!segment.includes('signal: chatAbortControllerRef.current.signal')) {
    app = app.slice(0, callEnd) + '        signal: chatAbortControllerRef.current.signal,\n' + app.slice(callEnd);
  }
}
if (!app.includes('const handleStopGeneration = () =>')) {
  const marker = '  // Retry Failed Message with fresh network execution (NO local mock)';
  if (!app.includes(marker)) throw new Error('[MKUU] retry marker not found');
  app = app.replace(marker, `  const handleStopGeneration = () => {\n    chatAbortControllerRef.current?.abort();\n    chatAbortControllerRef.current = null;\n    setIsLoading(false);\n  };\n\n${marker}`);
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

console.log('[MKUU] REAL Stop + native speaker fix applied');
