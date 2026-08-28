const fs = require('fs');

// This script patches the CURRENT source shape and is intentionally idempotent.
// It must never fail just because an older marker was removed by another patch.

let chat = fs.readFileSync('src/components/ChatView.tsx', 'utf8');
const speechImport = "import { speakSmart, stopSmartSpeech } from '../services/smartSpeech';";
const typeImport = "import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';";
if (!chat.includes(speechImport) && chat.includes(typeImport)) {
  chat = chat.replace(typeImport, `${typeImport}\n${speechImport}`);
}

if (!chat.includes('onStopGeneration?: () => void;')) {
  chat = chat.replace(
    '  onRetryMessage?: (message: ChatMessage) => Promise<any>; isLoading: boolean;',
    '  onStopGeneration?: () => void;\n  onRetryMessage?: (message: ChatMessage) => Promise<any>; isLoading: boolean;'
  );
}
chat = chat.replace(
  'messages, conversationTitle = \'Mkuu\', onSendMessage, onRetryMessage, isLoading,',
  'messages, conversationTitle = \'Mkuu\', onSendMessage, onStopGeneration, onRetryMessage, isLoading,'
);

// Stop must NOT be disabled while a response is generating.
chat = chat.replace(
  'if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;',
  'if (isLoading) { onStopGeneration?.(); return; }\n    if (!inputText.trim() && selectedAttachments.length === 0) return;'
);
chat = chat.replace(
  'disabled={isLoading || (!inputText.trim() && selectedAttachments.length === 0)} aria-label="Tuma"',
  'disabled={!isLoading && (!inputText.trim() && selectedAttachments.length === 0)} aria-label={isLoading ? "Stop" : "Tuma"} title={isLoading ? "Simamisha jibu" : "Tuma ujumbe"}'
);

// Replace the existing browser-only speaker with the native Android speaker service.
if (!chat.includes('await speakSmart(clean, \'sw-TZ\')')) {
  const marker = '  const playSpeech = ';
  const start = chat.indexOf(marker);
  if (start >= 0) {
    const bodyStart = chat.indexOf('{', start);
    let depth = 0, quote = null, escaped = false, end = -1;
    for (let i = bodyStart; i < chat.length; i++) {
      const c = chat[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end > 0) {
      const replacement = `  const playSpeech = async (id: string, text: string) => {\n    const clean = String(text || '').trim();\n    if (!clean) return;\n    if (playingMessageId === id) {\n      await stopSmartSpeech();\n      setPlayingMessageId(null);\n      return;\n    }\n    await stopSmartSpeech();\n    setPlayingMessageId(id);\n    try {\n      await speakSmart(clean, 'sw-TZ');\n    } catch (error) {\n      console.warn('[TTS] playback failed:', error);\n    } finally {\n      setPlayingMessageId(null);\n    }\n  };`;
      chat = chat.slice(0, start) + replacement + chat.slice(end);
    }
  }
}
fs.writeFileSync('src/components/ChatView.tsx', chat);

// Wire the same Stop button to the REAL fetch AbortController in App.
let app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes('useRef')) {
  app = app.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect, useRef } from 'react';");
}
if (!app.includes('const chatAbortControllerRef = useRef<AbortController | null>(null);')) {
  app = app.replace(
    '  const [isLoading, setIsLoading] = useState(false);',
    '  const [isLoading, setIsLoading] = useState(false);\n  const chatAbortControllerRef = useRef<AbortController | null>(null);'
  );
}
if (!app.includes('chatAbortControllerRef.current = new AbortController();')) {
  app = app.replace(
    '    try {\n      // 2. Execute Multi-Tier AI Engine',
    '    try {\n      chatAbortControllerRef.current = new AbortController();\n      // 2. Execute Multi-Tier AI Engine'
  );
}

// Add AbortSignal to executeMkuuChat without duplicating it.
if (!app.includes('signal: chatAbortControllerRef.current.signal')) {
  const callStart = app.indexOf('const chatResult = await executeMkuuChat({');
  if (callStart >= 0) {
    const callEnd = app.indexOf('});', callStart);
    if (callEnd >= 0) {
      app = app.slice(0, callEnd) + '        signal: chatAbortControllerRef.current?.signal,\n      ' + app.slice(callEnd);
    }
  }
}
if (!app.includes('const handleStopGeneration = () =>')) {
  const marker = '  // Retry Failed Message with fresh network execution (NO local mock)';
  const stop = `  const handleStopGeneration = () => {\n    chatAbortControllerRef.current?.abort();\n    chatAbortControllerRef.current = null;\n    setIsLoading(false);\n  };\n\n`;
  if (app.includes(marker)) app = app.replace(marker, stop + marker);
}
if (!app.includes('onStopGeneration={handleStopGeneration}')) {
  app = app.replace(
    '            onSendMessage={handleSendMessage}\n            onRetryMessage=',
    '            onSendMessage={handleSendMessage}\n            onStopGeneration={handleStopGeneration}\n            onRetryMessage='
  );
}
app = app.replace(
  '    } finally {\n      setIsLoading(false);',
  '    } finally {\n      chatAbortControllerRef.current = null;\n      setIsLoading(false);'
);
fs.writeFileSync('src/App.tsx', app);

console.log('[MKUU] REAL Stop button + native speaker controls fixed');