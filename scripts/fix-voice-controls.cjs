const fs = require('fs');
const path = require('path');

function patch(relative, transform) {
  const file = path.join(process.cwd(), relative);
  if (!fs.existsSync(file)) throw new Error(`MKUU: ${relative} not found.`);
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function ensureCapacitorImport(source) {
  if (source.includes("from '@capacitor/core'")) return source;
  return source.replace(/^import React/m, "import { Capacitor } from '@capacitor/core';\nimport React");
}

patch('src/components/ChatView.tsx', (original) => {
  let source = ensureCapacitorImport(original);
  const marker = 'const playSpeech = async (msgId: string, text: string) => {';
  let start = source.indexOf(marker);
  if (start < 0) {
    const oldMarker = 'const playSpeech = (msgId: string, text: string) => {';
    start = source.indexOf(oldMarker);
    if (start < 0) return source;
  }
  const end = source.indexOf('\n  };', start);
  if (end < 0) return source;
  const block = String.raw`const playSpeech = async (msgId: string, text: string) => {
    if (typeof window === 'undefined') return;
    const cleanText = text
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/[*_~#\`>]+/g, ' ')
      .replace(/[|{}\[\]<>^=+\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) return;

    const isNative = Capacitor.isNativePlatform();
    if (playingMessageId === msgId) {
      try {
        if (isNative) {
          const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
          await TextToSpeech.stop();
        } else if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch (error) { console.warn('[MKUU] TTS stop failed:', error); }
      setPlayingMessageId(null);
      return;
    }

    try {
      if (isNative) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop();
        setPlayingMessageId(msgId);
        try {
          await TextToSpeech.speak({ text: cleanText, lang: 'sw-TZ', rate: 0.95, pitch: 1, volume: 1 });
        } catch (swError) {
          console.warn('[MKUU] sw-TZ TTS unavailable; using Android default voice:', swError);
          await TextToSpeech.stop();
          await TextToSpeech.speak({ text: cleanText, lang: 'en-US', rate: 0.95, pitch: 1, volume: 1 });
        }
        setPlayingMessageId(null);
        return;
      }

      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      setPlayingMessageId(msgId);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'sw-TZ';
      utterance.rate = 0.95;
      utterance.onend = () => setPlayingMessageId(null);
      utterance.onerror = () => setPlayingMessageId(null);
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('[MKUU] TTS failed:', error);
      setPlayingMessageId(null);
    }
  };`;
  return source.slice(0, start) + block + source.slice(end + 5);
});

patch('src/components/VoiceModal.tsx', (original) => {
  let source = ensureCapacitorImport(original);
  const asyncMarker = '  const speakText = async (text: string) => {';
  const syncMarker = '  const speakText = (text: string) => {';
  const start = source.indexOf(asyncMarker) >= 0 ? source.indexOf(asyncMarker) : source.indexOf(syncMarker);
  if (start < 0) return source;
  const end = source.indexOf('\n  };', start);
  if (end < 0) return source;
  const block = String.raw`  const speakText = async (text: string) => {
    if (isMuted) { setVoiceState('ready'); return; }
    const cleaned = sanitizeTextForSpeech(text);
    if (!cleaned) { setVoiceState('ready'); return; }
    const isNative = Capacitor.isNativePlatform();

    try {
      if (isNative) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop();
        setVoiceState('speaking');
        try {
          await TextToSpeech.speak({
            text: cleaned,
            lang: selectedLangRef.current,
            rate: selectedLangRef.current === 'sw-TZ' ? 0.95 : 1.0,
            pitch: 1.0,
            volume: 1.0,
          });
        } catch (primaryError) {
          console.warn('[MKUU] Selected TTS language unavailable; using Android default voice:', primaryError);
          await TextToSpeech.stop();
          await TextToSpeech.speak({
            text: cleaned,
            lang: 'en-US',
            rate: 0.95,
            pitch: 1.0,
            volume: 1.0,
          });
        }
        setVoiceState('ready');
        return;
      }

      if (!('speechSynthesis' in window)) { setVoiceState('ready'); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = selectedLangRef.current;
      utterance.rate = selectedLangRef.current === 'sw-TZ' ? 0.95 : 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setVoiceState('speaking');
      utterance.onend = () => setVoiceState('ready');
      utterance.onerror = () => setVoiceState('ready');
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[MKUU] Live voice TTS failed:', err);
      setVoiceState('ready');
    }
  };`;
  return source.slice(0, start) + block + source.slice(end + 5);
});

console.log('MKUU: Android native speaker and Live Voice TTS enabled with language fallback.');
console.log('MKUU: Send/Stop remains handled by the existing cancellable chat patch.');
