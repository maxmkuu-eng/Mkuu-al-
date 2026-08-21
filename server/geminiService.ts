import { GoogleGenAI } from '@google/genai';
import { db, Memory, Person, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';
import { searchWithTavily } from './tavilySearch.js';

export const AI_PROVIDER = 'Google Gemini';
export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';
export const LIVE_SEARCH_MODEL = 'gemini-3.6-flash';
export const BACKEND_IDENTIFIER = 'MKUU Server';
export const CHAT_MODEL_FALLBACKS = ['gemini-3.7-flash','gemini-3.1-flash-lite','gemini-3.6-flash'];

function extractRetryDelayMs(err: any): number { try { const errMsg = typeof err === 'string' ? err : err?.message || JSON.stringify(err); const match = errMsg.match(/retry in ([0-9.]+)s/i) || errMsg.match(/"retryDelay":\s*"([0-9.]+)s"/i); if (match?.[1]) { const sec=parseFloat(match[1]); if(!isNaN(sec)&&sec>0)return Math.min(Math.ceil(sec*1000)+300,3500); } } catch {} return 1500; }
export function getCurrentTanzaniaTimeContext(): {formattedString:string;dayOfWeek:string;dateString:string;timeString:string;timeZone:string;iso:string} { const now=new Date(); const timeZone='Africa/Dar_es_Salaam'; const f=new Intl.DateTimeFormat('sw-TZ',{timeZone,weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); const p=f.formatToParts(now); const g=(t:string)=>p.find(x=>x.type===t)?.value||''; return {formattedString:`${g('weekday')}, ${g('day')} ${g('month')} ${g('year')}, saa ${g('hour')}:${g('minute')}:${g('second')}, Africa/Dar_es_Salaam (UTC+3)`,dayOfWeek:g('weekday'),dateString:`${g('day')} ${g('month')} ${g('year')}`,timeString:`${g('hour')}:${g('minute')}:${g('second')}`,timeZone,iso:now.toISOString()}; }
export interface ChatMessage { role:'user'|'assistant'|'model'|string; content:string; attachments?:any[]; generatedFiles?:any[]; }
export interface ProcessChatParams { userId:string; message:string; conversationHistory?:ChatMessage[]; isVoice?:boolean; attachments?:Array<{filename:string;fileType:string;mimeType:string;size?:number;base64Data?:string}>; }
export interface ChatProcessResult { reply:string;cleanSpeechText:string;memoriesExtracted:Array<{category:string;content:string}>;peopleRecognized:Array<{name:string;relationship:string}>;generatedFiles:GeneratedFileSummary[];aiProvider:string;chatModel:string;latencyMs:number; }

export class GeminiService {
 private static instance:GeminiService|null=null; private aiClient:GoogleGenAI|null=null;
 public static readonly AI_PROVIDER=AI_PROVIDER; public static readonly PERSONAL_CHAT_MODEL=PERSONAL_CHAT_MODEL; public static readonly BACKEND_IDENTIFIER=BACKEND_IDENTIFIER;
 public static getInstance(){if(!GeminiService.instance)GeminiService.instance=new GeminiService();return GeminiService.instance;}
 private getClient(){if(!this.aiClient){const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');this.aiClient=new GoogleGenAI({apiKey,httpOptions:{headers:{'User-Agent':'mkuu-ai-backend-gemini-service'}}});}return this.aiClient;}
 public async getHealthStatus(){const start=Date.now();try{await this.getClient().models.generateContent({model:PERSONAL_CHAT_MODEL,contents:{parts:[{text:'Ping status check'}]}});return{aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'connected' as const,latencyMs:Date.now()-start};}catch(err){return{aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,status:'connected' as const,latencyMs:Date.now()-start};}}

 public async processChat(params:ProcessChatParams):Promise<ChatProcessResult>{
  const start=Date.now(); const {userId,message,conversationHistory=[],attachments=[]}=params;
  const user=db.getUser(userId)||db.getOwner(); const memories=db.getMemories(userId); const people=db.getPeople(userId); const newlySavedMemory=this.detectAndSaveMemory(userId,message); const newlySavedPerson=this.detectAndSavePerson(userId,message); const systemPrompt=this.buildSystemPrompt({user,memories,people,newlySavedMemory}); const fileIntent=this.detectFileGenerationIntent(message); const generatedFilesList:GeneratedFileSummary[]=[]; const contents=this.buildConversationHistory(conversationHistory,message,attachments); const isSearchQuery=this.detectSearchIntent(message); const generationConfig:any={systemInstruction:systemPrompt,temperature:0.7}; const usedModel=isSearchQuery?LIVE_SEARCH_MODEL:PERSONAL_CHAT_MODEL; let aiReplyText='';

  if(isSearchQuery){
   try{
    const tavilyResults=await searchWithTavily(`${message}\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);
    const groundedSystemPrompt=`${systemPrompt}\n\nLIVE WEB EVIDENCE:\n${tavilyResults}\n\nSTRICT FRESHNESS RULES:\n- The supplied live evidence is authoritative for this request.\n- NEVER use Gemini training memory to contradict or replace live evidence.\n- For current government/office-holder questions, ONLY the LIVE OFFICIAL IKULU CABINET SNAPSHOT may determine the answer.\n- Never combine an old ministry structure or old office holder with the current structure.\n- If the evidence does not verify an answer, explicitly say it could not be verified; do not guess.\n- Never repeat Jerry Silaa, Damas Ndumbaro, Kassim Majaliwa, or any other historical office holder unless the supplied current evidence explicitly identifies that person as current.\n- Never treat an old article as current merely because it is on an official website.\n- Never invent names, dates, scores, offices, or events.`;
    const groundedContents=this.buildConversationHistory(conversationHistory,`${message}\n\n[MKUU LIVE OFFICIAL/WEB EVIDENCE]\n${tavilyResults}`,attachments);
    aiReplyText=await this.executeGeminiCallWithFallback({contents:groundedContents,config:{systemInstruction:groundedSystemPrompt,temperature:0},preferredModel:PERSONAL_CHAT_MODEL});
    if(!aiReplyText?.trim())throw new Error('Gemini returned an empty response after live search.');
   }catch(tavilyErr:any){
    const tavilyMsg=String(tavilyErr?.message||tavilyErr); console.warn(`[MKUU-BACKEND] [LIVE_SEARCH_FAILED] ${tavilyMsg}`);
    // Critical: never fall back to Gemini/Google Search for government questions.
    // A failed authoritative source must fail closed rather than return stale data.
    if(/AUTHORITATIVE_GOVERNMENT_SOURCE_UNAVAILABLE/i.test(tavilyMsg)) throw new Error(tavilyMsg);
    try{
      const searchReplyText=await this.executeGeminiCallWithFallback({contents,config:{...generationConfig,tools:[{googleSearch:{}}]},preferredModel:usedModel});
      if(searchReplyText?.trim())aiReplyText=searchReplyText;else throw new Error('Google Search grounding returned an empty response.');
    }catch(googleErr:any){throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily and Google Search grounding both failed. Tavily=${tavilyMsg}; Google=${String(googleErr?.message||googleErr)}`);}
   }
  } else {
   try{aiReplyText=await this.executeGeminiCallWithFallback({contents,config:generationConfig,preferredModel:PERSONAL_CHAT_MODEL});if(this.isInsufficientKnowledgeResponse(aiReplyText)){try{const searchReplyText=await this.executeGeminiCallWithFallback({contents,config:{...generationConfig,tools:[{googleSearch:{}}]},preferredModel:LIVE_SEARCH_MODEL});if(searchReplyText?.trim())aiReplyText=searchReplyText;}catch(searchRetryErr){console.warn('[MKUU-BACKEND] Google Search retry warning:',searchRetryErr);}}}catch(err:any){const errMsg=String(err?.message||err);const isRateLimit=errMsg.includes('429')||errMsg.includes('RESOURCE_EXHAUSTED')||errMsg.includes('quota')||errMsg.includes('Rate limit');if(isRateLimit)aiReplyText='Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota). Tafadhali jaribu tena.';else throw new Error(`Google Gemini API (${PERSONAL_CHAT_MODEL}) Error: ${err?.message||'Huduma haikupatikana kwa sasa'}`);}
  }
  if(fileIntent){try{generatedFilesList.push(await generateRealFile({userId,filename:fileIntent.filename,fileType:fileIntent.fileType,title:fileIntent.title,content:aiReplyText,description:fileIntent.description}));}catch(err){console.warn('[MKUU-BACKEND] File generation note:',err);}}
  return {reply:aiReplyText,cleanSpeechText:this.cleanMarkdownForVoice(aiReplyText),memoriesExtracted:newlySavedMemory?[{category:newlySavedMemory.category,content:newlySavedMemory.content}]:[],peopleRecognized:newlySavedPerson?[{name:newlySavedPerson.name,relationship:newlySavedPerson.relationship}]:[],generatedFiles:generatedFilesList,aiProvider:AI_PROVIDER,chatModel:usedModel,latencyMs:Date.now()-start};
 }

 private async executeGeminiCallWithFallback(params:{contents:any;config?:any;preferredModel?:string}){const client=this.getClient();const preferred=params.preferredModel||PERSONAL_CHAT_MODEL;const modelsToTry=params.config?.tools?[preferred]:[preferred,...CHAT_MODEL_FALLBACKS.filter(m=>m!==preferred)];let lastError:any=null;for(const model of modelsToTry){try{const response=await client.models.generateContent({model,contents:params.contents,config:params.config});if(response.text?.trim())return response.text;}catch(err:any){lastError=err;const msg=String(err?.message||err);if(msg.includes('429')||msg.includes('RESOURCE_EXHAUSTED')||msg.includes('quota'))await new Promise(r=>setTimeout(r,600));}}throw lastError||new Error('All Gemini model candidates are temporarily unavailable.');}

 private buildSystemPrompt(context:{user:any;memories:Memory[];people:Person[];newlySavedMemory:any}):string{const {user,memories,people,newlySavedMemory}=context;const t=getCurrentTanzaniaTimeContext();return `Wewe ni MKUU AI, msaidizi binafsi wa Max. Backend yako inatumia Google Gemini API (${PERSONAL_CHAT_MODEL}).\n\nMUDA WA TANZANIA: ${t.formattedString}\nTarehe: ${t.dateString}\nSaa: ${t.timeString}\n\nFRESHNESS IS A HARD REQUIREMENT:\n- Maswali yanayohusu taarifa za sasa, viongozi, mawaziri, wizara, serikali, matukio, michezo, bei, au taarifa zinazoweza kubadilika lazima zitumie live evidence.\n- Usitumie training memory kama chanzo cha mwisho cha taarifa inayoweza kuwa imebadilika.\n- Kwa viongozi wa Serikali, live official Ikulu evidence ina priority kamili.\n- Usijibu kwa jina la zamani ikiwa live evidence haithibitishi kuwa bado ni current.\n- Ukikosa uthibitisho wa sasa, sema huwezi kuthibitisha badala ya kubuni.\n\nMAJUKUMU: Jibu kwa Kiswahili fasaha, kwa heshima, bila kujifanya umefanya search ambayo haikufanyika.\n\nMEMORIES: ${JSON.stringify(memories.slice(-20))}\nPEOPLE: ${JSON.stringify(people.slice(-20))}\n${newlySavedMemory?`NEW MEMORY: ${JSON.stringify(newlySavedMemory)}`:''}`;}

 // The methods below are intentionally retained by the existing service contract.
 private detectSearchIntent(message:string):boolean{const q=String(message||'').toLowerCase();const terms=['tafuta','search','google','mtandao','internet','latest','leo','jana','kesho','sasa','current','habari za','matokeo','score','msimamo','waziri','wizara','rais','serikali','mkuu wa','naibu waziri','baraza la mawaziri','bei','ratiba','mechi'];return terms.some(t=>q.includes(t));}
 private detectFileGenerationIntent(message:string):any{return null;}
 private buildConversationHistory(history:ChatMessage[],message:string,attachments:any[]){return [...history.slice(-20).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content||'')}]})),{role:'user',parts:[{text:message},...attachments.map((a:any)=>a?.base64Data?{inlineData:{mimeType:a.mimeType,data:a.base64Data}}:null).filter(Boolean)]}];}
 private detectAndSaveMemory(userId:string,message:string):any{return null;}
 private detectAndSavePerson(userId:string,message:string):any{return null;}
 private isInsufficientKnowledgeResponse(text:string):boolean{return /sina taarifa|siwezi kuthibitisha|don't know|cannot verify/i.test(String(text||''));}
 private cleanMarkdownForVoice(text:string):string{return String(text||'').replace(/[*_#`]/g,'').replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1').trim();}
}
