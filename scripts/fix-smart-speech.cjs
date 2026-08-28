const fs = require('fs');

function ensureImport(source, importLine, anchors, label) {
  if (source.includes(importLine)) return source;
  const list = Array.isArray(anchors) ? anchors : [anchors];
  const anchor = list.find(a => source.includes(a));
  if (!anchor) {
    console.warn(`[TTS] target missing: ${label}; preserving existing implementation.`);
    return source;
  }
  return source.replace(anchor, `${anchor}\n${importLine}`);
}

function replaceFunction(source, marker, replacement) {
  const start = source.indexOf(marker);
  if (start < 0) return source;
  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) return source;
  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = bodyStart; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(0, start) + replacement + source.slice(i + 1);
      }
    }
  }
  return source;
}

// ChatView: use the native Capacitor TTS implementation on APK instead of
// window.speechSynthesis, while keeping the speaker button independent from
// the Send/Stop generation button.
let chat = fs.readFileSync('src/components/ChatView.tsx', 'utf8');
chat = ensureImport(
  chat,
  "import { speakSmart, stopSmartSpeech } from '../services/smartSpeech';",
  ["import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';", "import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem } from '../types';"],
  'ChatView import'
);
chat = replaceFunction(chat, '  const playSpeech = ', `  const playSpeech = async (id: string, text: string) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    if (playingMessageId === id) {
      await stopSmartSpeech();
      setPlayingMessageId(null);
      return;
    }
    await stopSmartSpeech();
    setPlayingMessageId(id);
    try {
      await speakSmart(clean, 'sw-TZ');
    } catch (error) {
      console.warn('[TTS] native speech failed:', error);
    } finally {
      setPlayingMessageId(null);
    }
  }`);
// Preserve the Send button's existing generation-stop behavior. Do not wire
// speaker state to isLoading or onStopGenerating.
fs.writeFileSync('src/components/ChatView.tsx', chat);
console.log('[TTS] ChatView native speaker ready');

// VoiceModal uses the same native TTS service.
let voice = fs.readFileSync('src/components/VoiceModal.tsx', 'utf8');
voice = ensureImport(
  voice,
  "import { speakSmart, stopSmartSpeech } from '../services/smartSpeech';",
  ["import { VoiceState, Memory, Person } from '../types';", "import { VoiceState, Memory, Person } from '../types';"],
  'VoiceModal import'
);
const marker = '  // Send speech transcript to backend AI';
const start = voice.indexOf('  // Text-To-Speech Playback');
const end = voice.indexOf(marker, start);
if (start >= 0 && end >= 0) {
  const replacement = `  // Text-To-Speech Playback
  const speakText = async (text: string) => {
    if (isMuted) { setVoiceState('ready'); return; }
    try {
      await stopSmartSpeech();
      if (!(text || '').trim()) { setVoiceState('ready'); return; }
      setVoiceState('speaking');
      await speakSmart(text, selectedLangRef.current);
      setVoiceState('ready');
    } catch (err) {
      console.warn('[TTS] native speech failed:', err);
      setVoiceState('ready');
    }
  };

`;
  voice = voice.slice(0, start) + replacement + voice.slice(end);
}
fs.writeFileSync('src/components/VoiceModal.tsx', voice);
console.log('[TTS] VoiceModal native speaker ready');
