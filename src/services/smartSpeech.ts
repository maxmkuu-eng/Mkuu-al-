import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

const SWAHILI_WORDS = new Set(['na','ya','wa','ni','kwa','katika','hii','hiyo','hizi','hizo','kama','sana','pia','au','lakini','kwenye','kutoka','mpaka','bila','mimi','wewe','yeye','sisi','wao','hivyo','ambayo','ambaye','wapi','nini','gani','kwa nini','jinsi','leo','jana','kesho','sasa','baada','kabla','zaidi','kidogo','ndiyo','hapana','tafadhali','asante','habari','unaweza','naweza','anataka','nataka','tunahitaji','mfumo','jibu','majibu','swali','maswali','taarifa','mtandao','seva','kazi','mkuu','ongea','zungumza','sauti','lugha','picha','faili','wakati','siku','mwezi','mwaka','waziri','tanzania','tarehe']);
const ENGLISH_WORDS = new Set(['the','and','is','are','was','were','this','that','these','those','with','from','for','about','what','why','how','when','where','who','which','can','could','would','should','will','please','thank','thanks','hello','today','yesterday','tomorrow','system','server','answer','question','information','internet','file','image','voice','speech','language','message','search','source','live','web','current','latest','update','download','upload','open','close','start','stop','yes','no','your','you','my','our','their','because','but','not','have','has','been','more','less','very','good','work','working','done','ready']);

const MONTHS: Record<string, string> = { '01':'Januari','02':'Februari','03':'Machi','04':'Aprili','05':'Mei','06':'Juni','07':'Julai','08':'Agosti','09':'Septemba','10':'Oktoba','11':'Novemba','12':'Desemba' };
const ONES = ['sifuri','moja','mbili','tatu','nne','tano','sita','saba','nane','tisa','kumi','kumi na moja','kumi na mbili','kumi na tatu','kumi na nne','kumi na tano','kumi na sita','kumi na saba','kumi na nane','kumi na tisa'];
function swNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n < 20) return ONES[n] || String(n);
  if (n < 100) { const tens = ['','','ishirini','thelathini','arobaini','hamsini','sitini','sabini','themanini','tisini'][Math.floor(n/10)]; return n % 10 ? `${tens} na ${ONES[n%10]}` : tens; }
  if (n < 1000) { const h = Math.floor(n/100); const r = n%100; return `${h === 1 ? 'mia moja' : `${ONES[h]} mia`}${r ? ` na ${swNumber(r)}` : ''}`; }
  if (n < 1000000) { const t = Math.floor(n/1000); const r = n%1000; return `${t === 1 ? 'elfu moja' : `${swNumber(t)} elfu`}${r ? ` na ${swNumber(r)}` : ''}`; }
  return String(n);
}

function normalizeDatesAndNumbers(text: string): string {
  let out = text;
  // ISO dates / YYYY-MM-DD -> natural Swahili date, avoiding digit-by-digit speech.
  out = out.replace(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/g, (_m, y, m, d) => {
    const year = Number(y), month = String(m).padStart(2,'0'), day = Number(d);
    return `${swNumber(day)} ${MONTHS[month] || month} mwaka ${swNumber(year)}`;
  });
  // Common DD/MM/YYYY and DD-MM-YYYY forms.
  out = out.replace(/\b(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})\b/g, (_m, d, m, y) => `${swNumber(Number(d))} ${MONTHS[String(m).padStart(2,'0')] || m} mwaka ${swNumber(Number(y))}`);
  // Standalone four-digit years such as 2026.
  out = out.replace(/\b(20\d{2})\b/g, (m) => swNumber(Number(m)));
  // Avoid reading ordinary numeric IDs digit-by-digit; convert short integers in natural Swahili.
  out = out.replace(/\b\d{1,3}\b/g, (m) => swNumber(Number(m)));
  return out;
}

export function sanitizeSpeechText(text: string): string {
  return normalizeDatesAndNumbers((text || '')
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
    .trim());
}

function scoreLanguage(text: string, words: Set<string>): number {
  const tokens = text.toLowerCase().replace(/[^a-zA-ZÀ-ÿ' ]/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.reduce((score, token) => score + (words.has(token) ? 1 : 0), 0);
}
function detectLanguage(text: string, fallback: 'sw-TZ' | 'en-US' = 'sw-TZ'): 'sw-TZ' | 'en-US' {
  const sw = scoreLanguage(text, SWAHILI_WORDS), en = scoreLanguage(text, ENGLISH_WORDS);
  if (en > sw + 1) return 'en-US';
  if (sw > en + 1) return 'sw-TZ';
  return fallback;
}
function splitForNaturalSpeech(text: string, fallback: 'sw-TZ' | 'en-US'): Array<{text:string;lang:'sw-TZ'|'en-US'}> {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  return parts.map(part => ({text:part.trim(),lang:detectLanguage(part,fallback)})).filter(p=>p.text);
}
async function nativeSpeak(text: string, lang: 'sw-TZ' | 'en-US'): Promise<void> {
  await TextToSpeech.speak({ text, lang, rate: lang === 'sw-TZ' ? 0.9 : 0.98, pitch: 1.0, volume: 1.0, category: 'playback' });
}
export async function stopSmartSpeech(): Promise<void> { try { await TextToSpeech.stop(); } catch {} if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }
export async function speakSmart(text: string, fallback: 'sw-TZ' | 'en-US' = 'sw-TZ'): Promise<void> {
  const clean = sanitizeSpeechText(text); if (!clean) return;
  const chunks = splitForNaturalSpeech(clean, fallback);
  if (Capacitor.isNativePlatform()) { for (const chunk of chunks) await nativeSpeak(chunk.text, chunk.lang); return; }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  await stopSmartSpeech();
  for (const chunk of chunks) await new Promise<void>(resolve => {
    const u = new SpeechSynthesisUtterance(chunk.text); u.lang = chunk.lang; u.rate = chunk.lang === 'sw-TZ' ? 0.92 : 1.0; u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices(); const voice = voices.find(v=>v.lang.toLowerCase()===chunk.lang.toLowerCase()) || voices.find(v=>v.lang.toLowerCase().startsWith(chunk.lang.slice(0,2).toLowerCase())); if (voice) u.voice=voice;
    u.onend=()=>resolve(); u.onerror=()=>resolve(); window.speechSynthesis.speak(u);
  });
}
