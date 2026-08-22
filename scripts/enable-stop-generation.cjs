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

// ChatView: while loading, the same control becomes a dark-red Stop button.
{
  const file = 'src/components/ChatView.tsx';
  let s = read(file);
  s = s.replace('  Send, Mic, Crown, Brain, Users, Download, FileText, FileSpreadsheet, FileCode,', '  Send, Square, Mic, Crown, Brain, Users, Download, FileText, FileSpreadsheet, FileCode,');
  s = s.replace('  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;', '  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>; onStopGenerating?: () => void;');
  s = s.replace('  messages, conversationTitle = \'Mkuu Chat\', onSendMessage, onRetryMessage, isLoading,', '  messages, conversationTitle = \'Mkuu Chat\', onSendMessage, onStopGenerating, onRetryMessage, isLoading,');
  s = s.replace("    if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;", "    if (isLoading) { onStopGenerating?.(); return; }\n    if (!inputText.trim() && selectedAttachments.length === 0) return;");
  const oldButton = '<button type="submit" id="chat-send-btn" disabled={(!inputText.trim() && selectedAttachments.length === 0) || isLoading} className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md ${(inputText.trim() || selectedAttachments.length > 0) && !isLoading ? \'bg-[#D4AF37] hover:bg-[#c59f2e] text-black cursor-pointer\' : \'bg-[#1a1a1a] text-[#666666] cursor-not-allowed border border-[#252525]\'}`}><span>SEND</span><Send className="w-3.5 h-3.5" /></button>';
  const newButton = '<button type="submit" id="chat-send-btn" disabled={!isLoading && (!inputText.trim() && selectedAttachments.length === 0)} className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-md ${isLoading ? \'bg-[#B71C1C] hover:bg-[#D32F2F] text-white cursor-pointer border border-red-700\' : (inputText.trim() || selectedAttachments.length > 0) ? \'bg-[#D4AF37] hover:bg-[#c59f2e] text-black cursor-pointer\' : \'bg-[#1a1a1a] text-[#666666] cursor-not-allowed border border-[#252525]\'}`} title={isLoading ? "Simamisha jibu" : "Tuma ujumbe"}>{isLoading ? <Square className="w-3.5 h-3.5 fill-current" /> : <><span>SEND</span><Send className="w-3.5 h-3.5" /></>}</button>';
  if (s.includes(oldButton)) s = s.replace(oldButton, newButton);
  write(file, s);
}

// AI engine: propagate AbortSignal into every network generation route.
{
  const file = 'src/services/aiEngine.ts';
  let s = read(file);
  if (!s.includes('signal?: AbortSignal;')) {
    s = s.replace('  people?: Person[];\n}', '  people?: Person[];\n  signal?: AbortSignal;\n}');
  }
  s = s.replace("    method: 'POST',\n    body: JSON.stringify({\n      prompt: params.message,", "    method: 'POST',\n    signal: params.signal,\n    body: JSON.stringify({\n      prompt: params.message,");
  s = s.replace("const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });", "const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: params.signal });");
  s = s.replace("    method: 'POST',\n    body: JSON.stringify({\n      conversationId: params.conversationId,", "    method: 'POST',\n    signal: params.signal,\n    body: JSON.stringify({\n      conversationId: params.conversationId,");
  s = s.replace("const response = await fetch(url, { method: 'POST', headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify({ message: params.message", "const response = await fetch(url, { method: 'POST', headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, signal: params.signal, body: JSON.stringify({ message: params.message");
  write(file, s);
}

console.log('MKUU: functional red Stop generation control enabled; network requests are abortable.');
