const fs = require('fs');
const path = require('path');

function patch(relative, transform) {
  const file = path.join(process.cwd(), relative);
  if (!fs.existsSync(file)) throw new Error(`MKUU: ${relative} not found.`);
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

// Normal spoken text: remove Markdown, URLs and punctuation/symbol noise.
patch('src/components/ChatView.tsx', (source) => {
  const marker = 'const playSpeech = async (msgId: string, text: string) => {';
  const start = source.indexOf(marker);
  if (start < 0) return source;
  const end = source.indexOf('\n  };', start);
  if (end < 0) return source;
  const block = String.raw`const playSpeech = async (msgId: string, text: string) => {
    if (typeof window === 'undefined') return;
    const cleanText = text
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/[*_~#`>]+/g, ' ')
      .replace(/[|{}\[\]<>^=+\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) return;
    const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
    if (playingMessageId === msgId) {
      if (isNative) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop();
      } else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setPlayingMessageId(null);
      return;
    }
    try {
      if (isNative) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop();
        setPlayingMessageId(msgId);
        await TextToSpeech.speak({ text: cleanText, lang: 'sw-TZ', rate: 0.95, pitch: 1, volume: 1 });
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

// Live Voice: use native Android TTS for output, while keeping recognition unchanged.
patch('src/components/VoiceModal.tsx', (source) => {
  const start = source.indexOf('  const speakText = (text: string) => {');
  if (start < 0) return source;
  const end = source.indexOf('\n  };', start);
  if (end < 0) return source;
  const block = String.raw`  const speakText = async (text: string) => {
    if (isMuted) { setVoiceState('ready'); return; }
    const cleaned = sanitizeTextForSpeech(text);
    if (!cleaned) { setVoiceState('ready'); return; }
    const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
    try {
      if (isNative) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop();
        setVoiceState('speaking');
        await TextToSpeech.speak({
          text: cleaned,
          lang: selectedLangRef.current,
          rate: selectedLangRef.current === 'sw-TZ' ? 0.95 : 1.0,
          pitch: 1.0,
          volume: 1.0,
        });
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

console.log('MKUU: speaker punctuation cleanup and native Live Voice output enabled.');
console.log('MKUU: Send/Stop remains handled by the existing cancellable chat patch.');
