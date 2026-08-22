import { db, GeneratedFileSummary } from './db.js';
import { imageService } from './imageService.js';
import { geminiService } from './geminiService.js';
export type AgentIntent = 'chat' | 'image' | 'document' | 'spreadsheet' | 'analysis';
export interface AgentRequest { userId: string; message: string; conversationHistory?: any[]; attachments?: any[]; isVoice?: boolean; people?: any[]; }
export interface AgentResult { intent: AgentIntent; reply: string; cleanSpeechText: string; generatedFiles: GeneratedFileSummary[]; memoriesExtracted: any[]; peopleRecognized: any[]; aiProvider?: string; chatModel?: string; latencyMs: number; }
const IMAGE_WORDS = ['picha', 'image', 'logo', 'banner', 'poster', 'cartoon', 'background', 'illustration', 'edit photo', 'ondoa background', 'badilisha picha'];
const DOC_WORDS = ['pdf', 'word', 'docx', 'document', 'proposal', 'report', 'ripoti', 'barua', 'resume', 'cv', 'letter', 'memo'];
const SHEET_WORDS = ['excel', 'xlsx', 'spreadsheet', 'csv', 'budget', 'bajeti', 'table', 'jedwali'];
const CURRENT_GOVERNMENT_TERMS = ['waziri mkuu', 'waziri wa', 'naibu waziri', 'rais wa', 'makamu wa rais', 'serikali ya sasa', 'waziri mwenye dhamana', 'baraza la mawaziri', 'mkuu wa mkoa', 'mkuu wa wilaya', 'meya wa', 'kiongozi wa sasa', 'katibu mkuu', 'current minister', 'prime minister', 'president of tanzania', 'current government', 'current cabinet', 'who is the minister', 'who is the prime minister'];
const LIVE_WEB_TERMS = [
  'habari za leo','habari za sasa','habari mpya','habari za hivi punde','leo hii','sasa hivi','hivi sasa','latest','current','breaking news','nini kimetokea','nini kinaendelea','amejifungua','amejifungua mtoto','ujauzito','mjamzito','mtoto wa','ameoa','ameolewa','ndoa','talaka','amefariki','kifo','msiba','official statement','post ya leo','instagram','facebook','tiktok','youtube','twitter','x.com','social media','matokeo','mechi','mchezo','ratiba','msimamo','kikosi','bei ya','dola','exchange rate','weather today','hali ya hewa','stock price','tuzo za'
];
function includesAny(text: string, words: string[]) { return words.some((word) => text.includes(word)); }
function isCurrentGovernmentQuestion(message: string): boolean { const text = String(message || '').toLowerCase(); return includesAny(text, CURRENT_GOVERNMENT_TERMS) || (/\b(sasa|wa sasa|kwa sasa|leo|current|latest)\b/.test(text) && /\b(waziri|rais|serikali|kiongozi|wizara|cabinet)\b/.test(text)); }
function isLiveWebQuestion(message: string): boolean { const text = String(message || '').toLowerCase(); if (isCurrentGovernmentQuestion(text)) return true; return includesAny(text, LIVE_WEB_TERMS) || /\b(nani|nini|gani|wapi)\b/.test(text) && /\b(leo|sasa|hivi|latest|current|ame|anaendelea|imetokea)\b/.test(text); }
export class UniversalAgentEngine {
  public classify(message: string, attachments: any[] = []): AgentIntent { const text = String(message || '').toLowerCase(); const hasImage = attachments.some((a) => String(a?.mimeType || '').startsWith('image/')); if (hasImage && (includesAny(text, IMAGE_WORDS) || text.length <= 80)) return 'image'; if (includesAny(text, IMAGE_WORDS) && (text.includes('tengeneza') || text.includes('create') || text.includes('generate') || text.includes('edit') || text.includes('design'))) return 'image'; if (includesAny(text, SHEET_WORDS)) return 'spreadsheet'; if (includesAny(text, DOC_WORDS)) return 'document'; if (text.includes('chambua') || text.includes('analyse') || text.includes('analyze') || text.includes('linganisha') || text.includes('compare')) return 'analysis'; return 'chat'; }
  public async execute(request: AgentRequest): Promise<AgentResult> {
    const started = Date.now(); const intent = this.classify(request.message, request.attachments || []);
    if (intent === 'image') { const result = await imageService.processImage({ userId: request.userId, prompt: request.message, attachments: request.attachments || [] }); return { intent, reply: result.explanation, cleanSpeechText: result.explanation, generatedFiles: [result.file], memoriesExtracted: [], peopleRecognized: [], aiProvider: 'Google Gemini', chatModel: result.modelUsed, latencyMs: Date.now() - started }; }
    let liveAwareMessage = request.message;
    if (isLiveWebQuestion(request.message)) {
      liveAwareMessage = `[LIVE_WEB_SEARCH_REQUIRED — Tumia Tavily kupata taarifa mpya kabla ya kujibu]\ntafuta mtandaoni: ${request.message}`;
    }
    const result = await geminiService.processChat({ userId: request.userId, message: liveAwareMessage, conversationHistory: request.conversationHistory || [], isVoice: request.isVoice, attachments: request.attachments || [] });
    return { intent, reply: result.reply, cleanSpeechText: result.cleanSpeechText, generatedFiles: result.generatedFiles || [], memoriesExtracted: result.memoriesExtracted || [], peopleRecognized: result.peopleRecognized || [], aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: Date.now() - started };
  }
  public plan(message: string, attachments: any[] = []) { const intent = this.classify(message, attachments); const steps = intent === 'image' ? ['Elewa maelekezo ya picha', 'Chagua Image Service', 'Tengeneza/hariri picha', 'Hifadhi na toa preview'] : intent === 'document' ? ['Elewa aina ya document', 'Tengeneza maudhui', 'Panga muundo wa kitaalamu', 'Tengeneza faili na preview'] : intent === 'spreadsheet' ? ['Elewa data na lengo', 'Panga jedwali/formulas', 'Tengeneza spreadsheet', 'Kagua matokeo'] : intent === 'analysis' ? ['Elewa swali', 'Kusanya context iliyopo', 'Chambua na linganisha', 'Toa hitimisho'] : ['Elewa ombi', 'Tumia memory/context', 'Chagua uwezo unaofaa', 'Toa jibu na next action']; return { intent, steps }; }
}
export const universalAgent = new UniversalAgentEngine();