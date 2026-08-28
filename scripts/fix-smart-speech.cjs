const fs = require('fs');

// Idempotent compatibility patch: current ChatView owns the actual controls.
// Do not fail the production build when an older source marker no longer exists.
let chat = fs.readFileSync('src/components/ChatView.tsx', 'utf8');
const importLine = "import { speakSmart, stopSmartSpeech } from '../services/smartSpeech';";
if (!chat.includes(importLine)) {
  const anchor = "import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';";
  if (chat.includes(anchor)) chat = chat.replace(anchor, anchor + '\n' + importLine);
}
if (!chat.includes('onStopGeneration?: () => void;')) {
  chat = chat.replace('onRetryMessage?:', 'onStopGeneration?: () => void;\n  onRetryMessage?:');
}
if (!chat.includes('onStopGeneration, onRetryMessage')) {
  chat = chat.replace("onSendMessage, onRetryMessage, isLoading,", "onSendMessage, onStopGeneration, onRetryMessage, isLoading,");
}
if (!chat.includes('onStopGeneration?.();')) {
  chat = chat.replace('if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;', 'if (isLoading) { onStopGeneration?.(); return; }\n    if (!inputText.trim() && selectedAttachments.length === 0) return;');
}
chat = chat.replace('disabled={isLoading || (!inputText.trim() && selectedAttachments.length === 0)} aria-label="Tuma"', 'disabled={!isLoading && (!inputText.trim() && selectedAttachments.length === 0)} aria-label={isLoading ? "Stop" : "Tuma"} title={isLoading ? "Simamisha jibu" : "Tuma ujumbe"}');
fs.writeFileSync('src/components/ChatView.tsx', chat);

// Keep the patch script itself safe after ChatView refactors; speaker wiring is verified separately.
console.log('[MKUU] smart speech/Stop compatibility patch complete');