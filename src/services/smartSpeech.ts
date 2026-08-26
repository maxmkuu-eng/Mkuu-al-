import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

const SWAHILI_WORDS = new Set([
  'na','ya','wa','ni','kwa','katika','hii','hiyo','hizi','hizo','kama','sana','pia','au','lakini','kwa','kwenye','kutoka','mpaka','bila','mimi','wewe','yeye','sisi','wao','hii','hivyo','ambayo','ambaye','wapi','nini','gani','kwa nini','jinsi','leo','jana','kesho','sasa','baada','kabla','zaidi','kidogo','ndiyo','hapana','tafadhali','asante','habari','unaweza','naweza','anataka','nataka','tunahitaji','mfumo','jibu','majibu','swali','maswali','taarifa','habari','mtandao','seva','kazi','mkuu','ongea','zungumza','sauti','lugha','picha','faili','wakati','siku','mwezi','mwaka','waziri','tanzania'
]);

const ENGLISH_WORDS = new Set([
  'the','and','is','are','was','were','this','that','these','those','with','from','for','about','what','why','how','when','where','who','which','can','could','would','should','will','please','thank','thanks','hello','today','yesterday','tomorrow','system','server','answer','question','information','internet','file','image','voice','speech','language','message','search','source','live','web','current','latest','update','download','upload','open','close','start','stop','yes','no','your','you','my','our','their','because','but','not','have','has','been','more','less','very','good','work','working','done','ready'
]);

export function sanitizeSpeechText(text: string): string {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s*[-+•]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreLanguage(text: string, words: Set<string>): number {
  const tokens = text.toLowerCase().replace(/[^a-zA-ZÀ-ÿ' ]/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.reduce((score, token) => score + (words.has(token) ? 1 : 0), 0);
}

function detectLanguage(text: string, fallback: 'sw-TZ' | 'en-US' = 'sw-TZ'): 'sw-TZ' | 'en-US' {
  const sw = scoreLanguage(text, SWAHILI_WORDS);
  const en = scoreLanguage(text, ENGLISH_WORDS);
  if (en > sw + 1) return 'en-US';
  if (sw > en + 1) return 'sw-TZ';
  return fallback;
}

function splitForNaturalSpeech(text: string, fallback: 'sw-TZ' | 'en-US'): Array<{ text: string; lang: 'sw-TZ' | 'en-US' }> {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  return parts.map((part) => ({ text: part.trim(), lang: detectLanguage(part, fallback) })).filter((p) => p.text);
}

async function nativeSpeak(text: string, lang: 'sw-TZ' | 'en-US'): Promise<void> {
  await TextToSpeech.speak({
    text,
    lang,
    rate: lang === 'sw-TZ' ? 0.92 : 0.98,
    pitch: 1.0,
    volume: 1.0,
    category: 'playback',
  });
}

export async function stopSmartSpeech(): Promise<void> {
  try { await TextToSpeech.stop(); } catch {}
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function speakSmart(text: string, fallback: 'sw-TZ' | 'en-US' = 'sw-TZ'): Promise<void> {
  const clean = sanitizeSpeechText(text);
  if (!clean) return;

  const chunks = splitForNaturalSpeech(clean, fallback);
  if (Capacitor.isNativePlatform()) {
    for (const chunk of chunks) {
      await nativeSpeak(chunk.text, chunk.lang);
    }
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  await stopSmartSpeech();
  for (const chunk of chunks) {
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = chunk.lang;
      utterance.rate = chunk.lang === 'sw-TZ' ? 0.94 : 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang.toLowerCase() === chunk.lang.toLowerCase()) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(chunk.lang.slice(0, 2).toLowerCase()));
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }
}
