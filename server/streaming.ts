import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import { searchWithTavily } from './tavilySearch.js';

export interface StreamRequest {
  userId: string;
  message: string;
  conversationHistory?: any[];
  people?: any[];
  attachments?: any[];
}

const MODELS = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
const LIVE_TERMS = ['habari za leo','habari za sasa','habari mpya','habari za hivi punde','leo hii','sasa hivi','hivi sasa','latest','current','breaking news','nini kimetokea','nini kinaendelea','amejifungua','amejifungua mtoto','ujauzito','mjamzito','mtoto wa','ameoa','ameolewa','ndoa','talaka','amefariki','kifo','official statement','post ya leo','instagram','facebook','tiktok','youtube','twitter','x.com','social media','matokeo','mechi','mchezo','ratiba','msimamo','kikosi','bei ya','dola','exchange rate','weather today','hali ya hewa','stock price','tuzo za','waziri','rais wa','serikali ya sasa','kiongozi wa sasa','wizara'];
function needsLiveSearch(message:string){const text=String(message||'').toLowerCase();return LIVE_TERMS.some((term)=>text.includes(term)) || (/\b(nani|nini|gani|wapi)\b/.test(text)&&/\b(leo|sasa|hivi|latest|current|ame|anaendelea|imetokea)\b/.test(text));}

function cleanHistory(history: any[]) {
  const turns = Array.isArray(history) ? history.slice(-10) : [];
  return turns
    .filter((m) => m && (m.content || m.parts))
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: Array.isArray(m.parts) ? m.parts : [{ text: String(m.content || '') }],
    }));
}

export async function* streamGemini(request: StreamRequest): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');

  const client = new GoogleGenAI({ apiKey });
  const memories = db.getMemories(request.userId).slice(0, 30);
  const dbPeople = db.getPeople(request.userId).slice(0, 30);
  const suppliedPeople = Array.isArray(request.people) ? request.people.slice(0, 30) : [];
  const people = suppliedPeople.length ? suppliedPeople : dbPeople;

  const memoryText = memories.map((m) => `- [${m.category}] ${m.content}`).join('\n') || 'Hakuna memory ya ziada.';
  const peopleText = people.map((p) => `- ${p.name}${p.nickname ? ` (${p.nickname})` : ''}: ${p.relationship}; ${p.phone || ''}; ${p.notes || ''}`).join('\n') || 'Hakuna watu wa karibu waliosajiliwa.';
  let systemInstruction = `Wewe ni MKUU AI, agent binafsi wa Max. Jibu kwa Kiswahili fasaha isipokuwa mtumiaji atumie lugha nyingine. Usibuni taarifa ambazo hazipo. Tumia memory na watu wa karibu hapa chini. Ukipewa kazi yenye hatua nyingi, ifanye kwa mpangilio na toa matokeo ya mwisho.\n\nMAX MEMORY:\n${memoryText}\n\nWATU WA KARIBU:\n${peopleText}`;

  const contents = cleanHistory(request.conversationHistory || []);
  let userMessage = request.message;
  if (needsLiveSearch(request.message)) {
    try {
      const liveResults = await searchWithTavily(`${request.message}\nCurrent date/time in Tanzania: ${new Intl.DateTimeFormat('sw-TZ',{timeZone:'Africa/Dar_es_Salaam',weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}`);
      systemInstruction += `\n\nLIVE WEB EVIDENCE (TAVILY — PRIMARY SOURCE):\n${liveResults}\n\nSTRICT LIVE-DATA RULES:\n- Use the supplied Tavily evidence as the primary source for this answer.\n- Do not use stale model memory to override newer evidence.\n- Prefer the newest credible source and pay attention to publication dates/event dates.\n- If evidence does not confirm a claim, say that it could not be verified instead of guessing.\n- For current public officials, sports, news and public-figure events, never revive an older fact when newer evidence is available.\n`;
      userMessage = `${request.message}\n\n[MKUU LIVE SEARCH EVIDENCE — ANSWER FROM THIS EVIDENCE]\n${liveResults}`;
    } catch (error:any) {
      console.warn('[MKUU-BACKEND] Streaming Tavily search failed:', error?.message || error);
      // Do not silently pretend that a stale model answer is live data.
      systemInstruction += '\n\nLIVE SEARCH FAILED: The requested information is time-sensitive. Do not present model memory as verified current fact. State that live verification failed if the answer cannot be established from the available context.\n';
    }
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  let lastError: any = null;
  for (const model of MODELS) {
    try {
      const stream = await client.models.generateContentStream({
        model,
        contents,
        config: { systemInstruction, temperature: needsLiveSearch(request.message) ? 0.2 : 0.7 },
      });
      for await (const chunk of stream) {
        const text = chunk.text || '';
        if (text) yield text;
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('All Gemini streaming models are temporarily unavailable.');
}
