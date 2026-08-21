const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/components/VoiceModal.tsx');
let source = fs.readFileSync(file, 'utf8');

const nativeImport = "import { Capacitor } from '@capacitor/core';\nimport { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';\n";
if (!source.includes("@capacitor-community/text-to-speech")) {
  source = source.replace("import { VoiceState, Memory, Person } from '../types';", "import { VoiceState, Memory, Person } from '../types';\n" + nativeImport.trimEnd());
}

const startMarker = "  // Text-To-Speech Playback\n  const speakText = (text: string) => {";
const endMarker = "\n\n  // Send speech transcript to backend AI";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error('MKUU: native TTS insertion point not found.');
}

const replacement = `  // Text-To-Speech Playback\n  const speakText = async (text: string) => {\n    if (isMuted) {\n      setVoiceState('ready');\n      return;\n    }\n\n    const cleaned = sanitizeTextForSpeech(text);\n    if (!cleaned) {\n      setVoiceState('ready');\n      return;\n    }\n\n    const isNativeAndroid = Capacitor.getPlatform() === 'android';\n    if (isNativeAndroid) {\n      try {\n        setVoiceState('speaking');\n        await TextToSpeech.stop();\n        const isSwahili = selectedLangRef.current === 'sw-TZ';\n        const supported = await TextToSpeech.isLanguageSupported({\n          lang: isSwahili ? 'sw-TZ' : 'en-US',\n        });\n        const lang = supported.supported ? (isSwahili ? 'sw-TZ' : 'en-US') : 'en-US';\n        await TextToSpeech.speak({\n          text: cleaned,\n          lang,\n          rate: isSwahili ? 0.95 : 1.0,\n          pitch: 1.0,\n          volume: 1.0,\n          queueStrategy: QueueStrategy.Flush,\n        });\n        setVoiceState('ready');\n        return;\n      } catch (err) {\n        console.warn('Native Android TTS failed; falling back to Web Speech:', err);\n      }\n    }\n\n    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {\n      setVoiceState('ready');\n      return;\n    }\n\n    try {\n      window.speechSynthesis.cancel();\n      const utterance = new SpeechSynthesisUtterance(cleaned);\n      const isSwahili = selectedLangRef.current === 'sw-TZ';\n      utterance.lang = isSwahili ? 'sw-TZ' : 'en-US';\n      utterance.rate = isSwahili ? 0.95 : 1.0;\n      utterance.pitch = 1.0;\n\n      const voices = window.speechSynthesis.getVoices();\n      if (voices && voices.length > 0) {\n        const preferred = isSwahili\n          ? voices.find((v) => v.lang.toLowerCase().startsWith('sw'))\n          : voices.find((v) => v.lang.toLowerCase().includes('en-us') || v.lang.toLowerCase().includes('en-gb'));\n        if (preferred) utterance.voice = preferred;\n      }\n\n      utterance.onstart = () => setVoiceState('speaking');\n      utterance.onend = () => setVoiceState('ready');\n      utterance.onerror = (e) => {\n        console.warn('Speech synthesis error:', e);\n        setVoiceState('ready');\n      };\n      window.speechSynthesis.speak(utterance);\n    } catch (err) {\n      console.error('TTS playback error:', err);\n      setVoiceState('ready');\n    }\n  };`;

source = source.slice(0, start) + replacement + source.slice(end);

source = source.replace(
  "  const toggleMute = () => {\n    if (synthRef.current) synthRef.current.cancel();",
  "  const toggleMute = () => {\n    if (synthRef.current) synthRef.current.cancel();\n    if (Capacitor.getPlatform() === 'android') TextToSpeech.stop().catch(() => {});"
);
source = source.replace(
  "                if (synthRef.current) synthRef.current.cancel();\n                if (recognitionRef.current) recognitionRef.current.abort();",
  "                if (synthRef.current) synthRef.current.cancel();\n                if (Capacitor.getPlatform() === 'android') TextToSpeech.stop().catch(() => {});\n                if (recognitionRef.current) recognitionRef.current.abort();"
);
source = source.replace(
  "                  if (synthRef.current) synthRef.current.cancel();\n                  setVoiceState('ready');",
  "                  if (synthRef.current) synthRef.current.cancel();\n                  if (Capacitor.getPlatform() === 'android') TextToSpeech.stop().catch(() => {});\n                  setVoiceState('ready');"
);

fs.writeFileSync(file, source);
console.log('MKUU: native Android TTS enabled; Web Speech remains the browser fallback.');

const chatFile = path.join(process.cwd(), 'src/components/ChatView.tsx');
let chat = fs.readFileSync(chatFile, 'utf8');
const chatImport = "import { Capacitor } from '@capacitor/core';\nimport { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';\n";
if (!chat.includes("@capacitor-community/text-to-speech")) {
  chat = chat.replace("import { getApiUrl } from '../services/apiConfig';", "import { getApiUrl } from '../services/apiConfig';\n" + chatImport.trimEnd());
}
const chatStartMarker = "  const playSpeech = (msgId: string, text: string) => {";
const chatEndMarker = "\n\n  const quickActions = [";
const chatStart = chat.indexOf(chatStartMarker);
const chatEnd = chat.indexOf(chatEndMarker, chatStart);
if (chatStart === -1 || chatEnd === -1) {
  throw new Error('MKUU: chat message TTS insertion point not found.');
}
const chatReplacement = `  const playSpeech = async (msgId: string, text: string) => {\n    if (playingMessageId === msgId) {\n      try { await TextToSpeech.stop(); } catch {}\n      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();\n      setPlayingMessageId(null);\n      return;\n    }\n\n    const cleanText = text\n      .replace(/#{1,6}\\s+/g, '')\n      .replace(/\\*\\*(.*?)\\*\\*/g, '$1')\n      .replace(/\\*(.*?)\\*/g, '$1')\n      .replace(/\`(.*?)\`/g, '$1')\n      .replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1')\n      .trim();\n    if (!cleanText) return;\n\n    setPlayingMessageId(msgId);\n    if (Capacitor.getPlatform() === 'android') {\n      try {\n        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();\n        await TextToSpeech.stop();\n        const supported = await TextToSpeech.isLanguageSupported({ lang: 'sw-TZ' });\n        await TextToSpeech.speak({\n          text: cleanText,\n          lang: supported.supported ? 'sw-TZ' : 'en-US',\n          rate: 0.95,\n          pitch: 1.0,\n          volume: 1.0,\n          queueStrategy: QueueStrategy.Flush,\n        });\n        setPlayingMessageId(null);\n        return;\n      } catch (err) {\n        console.warn('Chat message native TTS failed; falling back to Web Speech:', err);\n      }\n    }\n\n    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {\n      setPlayingMessageId(null);\n      return;\n    }\n    window.speechSynthesis.cancel();\n    const utterance = new SpeechSynthesisUtterance(cleanText);\n    utterance.lang = 'sw-TZ';\n    utterance.rate = 0.95;\n    utterance.onend = () => setPlayingMessageId(null);\n    utterance.onerror = () => setPlayingMessageId(null);\n    window.speechSynthesis.speak(utterance);\n  };`;
chat = chat.slice(0, chatStart) + chatReplacement + chat.slice(chatEnd);
fs.writeFileSync(chatFile, chat);
console.log('MKUU: chat message speaker buttons now use native Android TTS.');
