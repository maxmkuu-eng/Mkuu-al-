const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}
function write(file, content) {
  fs.writeFileSync(path.join(process.cwd(), file), content, 'utf8');
}

// This is the LAST source-normalization step in the build. It does not change
// the normal Gemini runtime. It only guarantees that live queries use Exa and
// that the API response contains exactly one webSources field.
const geminiPath = 'server/geminiService.ts';
let gemini = read(geminiPath);
gemini = gemini.replace(
  /import \{ searchWithTavily \} from '\.\/tavilySearch\.js';/,
  "import { searchWithExa } from './exaSearch.js';"
);

// Ensure the result contract carries Exa citations.
gemini = gemini.replace(
  /export interface ChatProcessResult \{ reply:string; cleanSpeechText:string; memoriesExtracted:Array<\{category:string;content:string\}>; peopleRecognized:Array<\{name:string;relationship:string\}>; generatedFiles:GeneratedFileSummary\[\]; aiProvider:string; chatModel:string; latencyMs:number; \}/,
  "export interface ChatProcessResult { reply:string; cleanSpeechText:string; memoriesExtracted:Array<{category:string;content:string}>; peopleRecognized:Array<{name:string;relationship:string}>; generatedFiles:GeneratedFileSummary[]; webSources:Array<{title:string;url:string}>; aiProvider:string; chatModel:string; latencyMs:number; }"
);

gemini = gemini.replace(
  /const contents=this\.buildConversationHistory\(conversationHistory,message,attachments\); const isSearchQuery=this\.detectSearchIntent\(message\); const generationConfig:any=\{systemInstruction:systemPrompt,temperature:0\.7\}; const usedModel=isSearchQuery\?LIVE_SEARCH_MODEL:PERSONAL_CHAT_MODEL; let aiReplyText='';/,
  "const contents=this.buildConversationHistory(conversationHistory,message,attachments); const isSearchQuery=this.detectSearchIntent(message); const generationConfig:any={systemInstruction:systemPrompt,temperature:0.7}; const usedModel=isSearchQuery?LIVE_SEARCH_MODEL:PERSONAL_CHAT_MODEL; let aiReplyText=''; let webSources:Array<{title:string;url:string}>=[];"
);

const liveStart = gemini.indexOf('    if(isSearchQuery){');
const liveEnd = gemini.indexOf('}else{try{aiReplyText=await this.executeGeminiCallWithFallback', liveStart);
if (liveStart < 0 || liveEnd < 0) {
  throw new Error('Final hardening could not locate Gemini live-search branch.');
}
const cleanLiveBranch = `    if(isSearchQuery){try{\n      console.log('[MKUU-BACKEND] [EXA_SEARCH_STARTED] Live query routed to Exa.');\n      const exaResult=await searchWithExa(\`${'${message}'}\\nCurrent date/time in Tanzania: ${'${getCurrentTanzaniaTimeContext().formattedString}'}\`);\n      const groundedSystemPrompt=\`${'${systemPrompt}'}\\n\\nLIVE WEB SEARCH RESULTS (Exa):\\n${'${exaResult.answer}'}\\n\\nSTRICT LIVE-DATA RULES:\\n- Answer using the supplied Exa live evidence as the primary evidence.\\n- Do not use stale model memory to override current search evidence.\\n- Prefer the newest credible source and the requested event date.\\n- Never invent a name, score, date, event, or current fact not supported by the supplied evidence.\\n\`;\n      const groundedContents=this.buildConversationHistory(conversationHistory,\`${'${message}'}\\n\\n[MKUU EXA LIVE SEARCH EVIDENCE]\\n${'${exaResult.answer}'}\`,attachments);\n      aiReplyText=await this.executeGeminiCallWithFallback({contents:groundedContents,config:{systemInstruction:groundedSystemPrompt,temperature:0.2},preferredModel:PERSONAL_CHAT_MODEL});\n      if(!aiReplyText?.trim())throw new Error('Gemini returned an empty response after Exa search.');\n      webSources=Array.isArray(exaResult.citations)?exaResult.citations.filter(x=>x?.url).map(x=>({title:String(x.title||x.url).trim(),url:String(x.url).trim()})):[];\n      console.log(\`[MKUU-BACKEND] [EXA_SEARCH_SUCCESS] citations=${'${webSources.length}'} latency=${'${Date.now()-startTime}'}ms\`);\n    }catch(exaErr:any){\n      const exaMsg=String(exaErr?.message||exaErr);\n      console.error(\`[MKUU-BACKEND] [EXA_SEARCH_FAILED] ${'${exaMsg}'}\`);\n      throw new Error(\`LIVE_SEARCH_UNAVAILABLE: ${'${exaMsg}'}\`);\n    }}else{try{aiReplyText=await this.executeGeminiCallWithFallback`;

gemini = gemini.slice(0, liveStart) + cleanLiveBranch + gemini.slice(liveEnd + '}else{try{aiReplyText=await this.executeGeminiCallWithFallback'.length);

// Return Exa citations exactly once.
gemini = gemini.replace(
  /return \{reply:aiReplyText,cleanSpeechText,memoriesExtracted:newlySavedMemory\?\[\{category:newlySavedMemory\.category,content:newlySavedMemory\.content\}\]:\[\],peopleRecognized:newlySavedPerson\?\[\{name:newlySavedPerson\.name,relationship:newlySavedPerson\.relationship\}\]:\[\],generatedFiles:generatedFilesList(?:,webSources:[^,}]+)?(?:,webSources:[^,}]+)?,aiProvider:AI_PROVIDER,chatModel:usedModel,latencyMs:Date\.now\(\)-startTime\};/,
  'return {reply:aiReplyText,cleanSpeechText,memoriesExtracted:newlySavedMemory?[{category:newlySavedMemory.category,content:newlySavedMemory.content}]:[],peopleRecognized:newlySavedPerson?[{name:newlySavedPerson.name,relationship:newlySavedPerson.relationship}]:[],generatedFiles:generatedFilesList,webSources,aiProvider:AI_PROVIDER,chatModel:usedModel,latencyMs:Date.now()-startTime};'
);

write(geminiPath, gemini);

const serverPath = 'server.ts';
let server = read(serverPath);
server = server.replace(
  /return \{reply:result\.reply,cleanSpeechText:result\.cleanSpeechText,memoriesExtracted:result\.memoriesExtracted,peopleRecognized:result\.peopleRecognized,generatedFiles:result\.generatedFiles(?:,webSources:[^,}]+)?(?:,webSources:[^,}]+)?,aiProvider:result\.aiProvider,chatModel:result\.chatModel,latencyMs:result\.latencyMs(?:,webSources:[^,}]+)?\};/,
  'return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};'
);
write(serverPath, server);

console.log('[MKUU] Final hardening: normal Gemini preserved; live queries use Exa; webSources normalized to one field.');
