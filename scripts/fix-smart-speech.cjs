const fs = require('fs');

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[TTS] target missing: ${label}`);
  return source.replace(from, to);
}

let chat = fs.readFileSync('src/components/ChatView.tsx', 'utf8');
chat = replaceOnce(chat, "import { getApiUrl } from '../services/apiConfig';", "import { getApiUrl } from '../services/apiConfig';\nimport { speakSmart, stopSmartSpeech } from '../services/smartSpeech';", 'ChatView import');
const oldPlaySpeech = "  const playSpeech = (msgId: string, text: string) => {\n    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;\n    if (playingMessageId === msgId) { window.speechSynthesis.cancel(); setPlayingMessageId(null); return; }\n    window.speechSynthesis.cancel(); setPlayingMessageId(msgId);\n    const cleanText = text.replace(/#{1,6}\\s+/g, '').replace(/\\*\\*(.*?)\\*\\*/g, '$1').replace(/\\*(.*?)\\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1').trim();\n    const utterance = new SpeechSynthesisUtterance(cleanText); utterance.lang = 'sw-TZ'; utterance.rate = 0.95;\n    utterance.onend = () => setPlayingMessageId(null); utterance.onerror = () => setPlayingMessageId(null); window.speechSynthesis.speak(utterance);\n  };";
const newPlaySpeech = "  const playSpeech = async (msgId: string, text: string) => {\n    if (playingMessageId === msgId) { await stopSmartSpeech(); setPlayingMessageId(null); return; }\n    await stopSmartSpeech();\n    setPlayingMessageId(msgId);\n    try { await speakSmart(text, 'sw-TZ'); } catch (error) { console.warn('[TTS] smart speech failed:', error); }\n    setPlayingMessageId(null);\n  };";
if (chat.includes(oldPlaySpeech)) chat = chat.replace(oldPlaySpeech, newPlaySpeech);
fs.writeFileSync('src/components/ChatView.tsx', chat);
console.log('[TTS] ChatView ready');

let voice = fs.readFileSync('src/components/VoiceModal.tsx', 'utf8');
voice = replaceOnce(voice, "import { VoiceState, Memory, Person } from '../types';", "import { VoiceState, Memory, Person } from '../types';\nimport { speakSmart, stopSmartSpeech } from '../services/smartSpeech';", 'VoiceModal import');
const marker = '  // Send speech transcript to backend AI';
const start = voice.indexOf('  // Text-To-Speech Playback');
const end = voice.indexOf(marker, start);
if (start < 0 || end < 0) throw new Error('[TTS] VoiceModal speech block not found');
const replacement = `  // Text-To-Speech Playback\n  const speakText = async (text: string) => {\n    if (isMuted) { setVoiceState('ready'); return; }\n    try {\n      await stopSmartSpeech();\n      const cleanText = text || '';\n      if (!cleanText.trim()) { setVoiceState('ready'); return; }\n      setVoiceState('speaking');\n      await speakSmart(cleanText, selectedLangRef.current);\n      setVoiceState('ready');\n    } catch (err) {\n      console.warn('[TTS] smart speech failed:', err);\n      setVoiceState('ready');\n    }\n  };\n\n`;
voice = voice.slice(0, start) + replacement + voice.slice(end);
fs.writeFileSync('src/components/VoiceModal.tsx', voice);
console.log('[TTS] VoiceModal ready');
