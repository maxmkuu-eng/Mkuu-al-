const fs = require('fs');

function patch(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`Smart speech patch target missing in ${file}: ${from.slice(0, 80)}`);
    source = source.replace(from, to);
  }
  fs.writeFileSync(file, source);
  console.log(`[TTS] patched ${file}`);
}

patch('src/components/ChatView.tsx', [
  ["import { getApiUrl } from '../services/apiConfig';", "import { getApiUrl } from '../services/apiConfig';\nimport { speakSmart, stopSmartSpeech } from '../services/smartSpeech';"],
  ["  const playSpeech = (msgId: string, text: string) => {\n    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;\n    if (playingMessageId === msgId) { window.speechSynthesis.cancel(); setPlayingMessageId(null); return; }\n    window.speechSynthesis.cancel(); setPlayingMessageId(msgId);\n    const cleanText = text.replace(/#{1,6}\\s+/g, '').replace(/\\*\\*(.*?)\\*\\*/g, '$1').replace(/\\*(.*?)\\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1').trim();\n    const utterance = new SpeechSynthesisUtterance(cleanText); utterance.lang = 'sw-TZ'; utterance.rate = 0.95;\n    utterance.onend = () => setPlayingMessageId(null); utterance.onerror = () => setPlayingMessageId(null); window.speechSynthesis.speak(utterance);\n  };", "  const playSpeech = async (msgId: string, text: string) => {\n    if (playingMessageId === msgId) { await stopSmartSpeech(); setPlayingMessageId(null); return; }\n    await stopSmartSpeech();\n    setPlayingMessageId(msgId);\n    try { await speakSmart(text, 'sw-TZ'); } catch (error) { console.warn('[TTS] smart speech failed:', error); }\n    setPlayingMessageId(null);\n  };"],
]);

patch('src/components/VoiceModal.tsx', [
  ["import { VoiceState, Memory, Person } from '../types';", "import { VoiceState, Memory, Person } from '../types';\nimport { speakSmart, stopSmartSpeech } from '../services/smartSpeech';"],
  ["  // Text-To-Speech Playback\n  const speakText = (text: string) => {", "  // Text-To-Speech Playback\n  const speakText = async (text: string) => {"],
]);

// Replace the old browser-only body of VoiceModal's speakText implementation.
let voice = fs.readFileSync('src/components/VoiceModal.tsx', 'utf8');
const start = voice.indexOf('  // Text-To-Speech Playback\n  const speakText = async (text: string) => {');
if (start < 0) throw new Error('[TTS] VoiceModal speakText start not found');
const end = voice.indexOf('\n\n  // Send speech transcript to backend AI', start);
if (end < 0) throw new Error('[TTS] VoiceModal speakText end not found');
const replacement = `  // Text-To-Speech Playback\n  const speakText = async (text: string) => {\n    if (isMuted) {\n      setVoiceState('ready');\n      return;\n    }\n\n    try {\n      await stopSmartSpeech();\n      const cleanText = text || '';\n      if (!cleanText.trim()) {\n        setVoiceState('ready');\n        return;\n      }\n      setVoiceState('speaking');\n      await speakSmart(cleanText, selectedLangRef.current);\n      setVoiceState('ready');\n    } catch (err) {\n      console.warn('[TTS] smart speech failed:', err);\n      setVoiceState('ready');\n    }\n  };`;
voice = voice.slice(0, start) + replacement + voice.slice(end);
fs.writeFileSync('src/components/VoiceModal.tsx', voice);
console.log('[TTS] patched VoiceModal speech playback');
