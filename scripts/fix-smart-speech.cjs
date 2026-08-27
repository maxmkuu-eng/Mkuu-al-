const fs = require('fs');

function ensureImport(source, importLine, anchor, label) {
  if (source.includes(importLine)) return source;
  if (!source.includes(anchor)) {
    console.warn(`[TTS] target missing: ${label}; preserving existing implementation.`);
    return source;
  }
  return source.replace(anchor, `${anchor}\n${importLine}`);
}

let chat = fs.readFileSync('src/components/ChatView.tsx', 'utf8');
chat = ensureImport(chat, "import { speakSmart, stopSmartSpeech } from '../services/smartSpeech';", "import { getApiUrl } from '../services/apiConfig';", 'ChatView import');
const playStart = chat.indexOf('  const playSpeech = ');
const playEnd = playStart >= 0 ? chat.indexOf('\n  };', playStart) : -1;
if (playStart >= 0 && playEnd >= 0) {
  const oldBlock = chat.slice(playStart, playEnd + 5);
  const newBlock = `  const playSpeech = async (msgId: string, text: string) => {\n    if (playingMessageId === msgId) { await stopSmartSpeech(); setPlayingMessageId(null); return; }\n    await stopSmartSpeech();\n    setPlayingMessageId(msgId);\n    try { await speakSmart(text, 'sw-TZ'); } catch (error) { console.warn('[TTS] smart speech failed:', error); }\n    setPlayingMessageId(null);\n  };`;
  chat = chat.replace(oldBlock, newBlock);
}
fs.writeFileSync('src/components/ChatView.tsx', chat);
console.log('[TTS] ChatView ready');

let voice = fs.readFileSync('src/components/VoiceModal.tsx', 'utf8');
voice = ensureImport(voice, "import { speakSmart, stopSmartSpeech } from '../services/smartSpeech';", "import { VoiceState, Memory, Person } from '../types';", 'VoiceModal import');
const marker = '  // Send speech transcript to backend AI';
const start = voice.indexOf('  // Text-To-Speech Playback');
const end = voice.indexOf(marker, start);
if (start >= 0 && end >= 0) {
  const replacement = `  // Text-To-Speech Playback\n  const speakText = async (text: string) => {\n    if (isMuted) { setVoiceState('ready'); return; }\n    try {\n      await stopSmartSpeech();\n      if (!(text || '').trim()) { setVoiceState('ready'); return; }\n      setVoiceState('speaking');\n      await speakSmart(text, selectedLangRef.current);\n      setVoiceState('ready');\n    } catch (err) {\n      console.warn('[TTS] smart speech failed:', err);\n      setVoiceState('ready');\n    }\n  };\n\n`;
  voice = voice.slice(0, start) + replacement + voice.slice(end);
}
fs.writeFileSync('src/components/VoiceModal.tsx', voice);
console.log('[TTS] VoiceModal ready');
