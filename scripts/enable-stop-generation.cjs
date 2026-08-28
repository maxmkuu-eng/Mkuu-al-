const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

// App: own the AbortController so Stop cancels the real generation request.
{
  const file = 'src/App.tsx';
  let s = read(file);
  s = s.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect, useRef } from 'react';");
  if (!s.includes('mkuuAbortControllerRef')) {
    s = s.replace("  const [isLoading, setIsLoading] = useState(false);", "  const [isLoading, setIsLoading] = useState(false);\n  const mkuuAbortControllerRef = useRef<AbortController | null>(null);");
  }
  if (!s.includes('const handleStopGenerating = () =>')) {
    s = s.replace("  // Send Message with Offline-First Local Persistence & Autonomous Multi-Tier AI Processing\n", "  const handleStopGenerating = () => {\n    mkuuAbortControllerRef.current?.abort();\n    mkuuAbortControllerRef.current = null;\n    setIsLoading(false);\n  };\n\n  // Send Message with Offline-First Local Persistence & Autonomous Multi-Tier AI Processing\n");
  }
  s = s.replace("    setIsLoading(true);\n\n    try {", "    setIsLoading(true);\n    const abortController = new AbortController();\n    mkuuAbortControllerRef.current = abortController;\n\n    try {");
  s = s.replace("        people,\n      });", "        people,\n        signal: abortController.signal,\n      });");
  s = s.replace("    } catch (e: any) {\n      console.error('Chat execution error:', e);", "    } catch (e: any) {\n      if (e?.name === 'AbortError' || abortController.signal.aborted) {\n        return { reply: '', cleanSpeechText: '' };\n      }\n      console.error('Chat execution error:', e);");
  s = s.replace("    } finally {\n      setIsLoading(false);\n    }\n  };", "    } finally {\n      if (mkuuAbortControllerRef.current === abortController) mkuuAbortControllerRef.current = null;\n      setIsLoading(false);\n    }\n  };");
  if (!s.includes('onStopGenerating={handleStopGenerating}')) {
    s = s.replace('onSendMessage={handleSendMessage}', 'onSendMessage={handleSendMessage} onStopGenerating={handleStopGenerating}');
  }
  write(file, s);
}

// ChatView: the composer control becomes Stop while a real generation is running.
{
  const file = 'src/components/ChatView.tsx';
  let s = read(file);

  if (!s.includes('onStopGenerating?: () => void;')) {
    s = s.replace(
      '  onRetryMessage?: (message: ChatMessage) => Promise<any>; isLoading: boolean;',
      '  onRetryMessage?: (message: ChatMessage) => Promise<any>; onStopGenerating?: () => void; isLoading: boolean;'
    );
  }
  s = s.replace(
    '  messages, conversationTitle = \'Mkuu\', onSendMessage, onRetryMessage, isLoading,',
    '  messages, conversationTitle = \'Mkuu\', onSendMessage, onRetryMessage, onStopGenerating, isLoading,'
  );

  // Allow submit while loading so the same button can stop generation.
  s = s.replace(
    '    if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;',
    '    if (isLoading) { onStopGenerating?.(); return; }\n    if (!inputText.trim() && selectedAttachments.length === 0) return;'
  );

  // Make the top speaker actually read the latest assistant response instead of opening the voice modal.
  if (!s.includes('const speakLatestAssistant = () =>')) {
    s = s.replace(
      '  const getFileIcon = (type: string) => {',
      "  const speakLatestAssistant = () => {\n    const latest = [...messages].reverse().find((m) => m.role === 'assistant' && String(m.content || '').trim());\n    if (latest) playSpeech(latest.id, latest.content);\n    else onOpenVoice();\n  };\n\n  const getFileIcon = (type: string) => {"
    );
  }
  s = s.replace('onClick={onOpenVoice} aria-label="Sauti" className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-[#D4AF37]"><Volume2', 'onClick={speakLatestAssistant} aria-label="Soma jibu kwa sauti" className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-[#D4AF37]"><Volume2');

  // Current ChatGPT-style composer: replace the disabled Send control with a real Stop control.
  const currentButton = '<button type="submit" disabled={isLoading || (!inputText.trim() && selectedAttachments.length === 0)} aria-label="Tuma" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">{isLoading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button>';
  const stopButton = '<button type="submit" disabled={!isLoading && (!inputText.trim() && selectedAttachments.length === 0)} aria-label={isLoading ? "Simamisha jibu" : "Tuma"} title={isLoading ? "Simamisha jibu" : "Tuma ujumbe"} className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${isLoading ? "bg-red-600 text-white hover:bg-red-500" : "bg-zinc-100 text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"}`}>{isLoading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button>';
  if (s.includes(currentButton)) s = s.replace(currentButton, stopButton);

  write(file, s);
}

// AI engine: propagate AbortSignal into every network generation route.
{
  const file = 'src/services/aiEngine.ts';
  let s = read(file);
  if (!s.includes('signal?: AbortSignal;')) {
    s = s.replace('  people?: Person[];\n}', '  people?: Person[];\n  signal?: AbortSignal;\n}');
  }
  s = s.replace(
    "    method: 'POST',\n    body: JSON.stringify({\n      prompt: params.message,",
    "    method: 'POST',\n    signal: params.signal,\n    body: JSON.stringify({\n      prompt: params.message,"
  );
  s = s.replace(
    "const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });",
    "const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: params.signal });"
  );
  s = s.replace(
    "    method: 'POST',\n    body: JSON.stringify({\n      conversationId: params.conversationId,",
    "    method: 'POST',\n    signal: params.signal,\n    body: JSON.stringify({\n      conversationId: params.conversationId,"
  );
  s = s.replace(
    "const response = await fetch(url, { method: 'POST', headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify({ message: params.message",
    "const response = await fetch(url, { method: 'POST', headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, signal: params.signal, body: JSON.stringify({ message: params.message"
  );
  write(file, s);
}

console.log('MKUU: functional Stop generation + working speaker playback enabled.');
