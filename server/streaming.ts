import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';

export interface StreamRequest {
  userId: string;
  message: string;
  conversationHistory?: any[];
  people?: any[];
  attachments?: any[];
}

const MODELS = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];

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
  const systemInstruction = `Wewe ni MKUU AI, agent binafsi wa Max. Jibu kwa Kiswahili fasaha isipokuwa mtumiaji atumie lugha nyingine. Usibuni taarifa ambazo hazipo. Tumia memory na watu wa karibu hapa chini. Ukipewa kazi yenye hatua nyingi, ifanye kwa mpangilio na toa matokeo ya mwisho.\n\nMAX MEMORY:\n${memoryText}\n\nWATU WA KARIBU:\n${peopleText}`;

  const contents = cleanHistory(request.conversationHistory || []);
  contents.push({ role: 'user', parts: [{ text: request.message }] });

  let lastError: any = null;
  for (const model of MODELS) {
    try {
      const stream = await client.models.generateContentStream({
        model,
        contents,
        config: { systemInstruction, temperature: 0.7 },
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
