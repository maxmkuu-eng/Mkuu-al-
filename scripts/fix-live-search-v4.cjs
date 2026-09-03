const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');const write=(p,v)=>fs.writeFileSync(path.join(root,p),v,'utf8');
function patch(p,fn,label){const a=read(p),b=fn(a);if(a!==b){write(p,b);console.log(`[MKUU-LIVE-V4] ${label}: patched`)}else console.log(`[MKUU-LIVE-V4] ${label}: no-op`)}

// Normal conversation must remain on Gemini. Only genuine live/current questions
// are routed to the server's Exa path. In particular, generic words such as
// "mkuu wa" or "sasa" must not turn an ordinary question into a web search.
patch('server.ts',t=>t.replace(/const currentFactQuery = \/\\b\(waziri mkuu\|rais wa\|makamu wa rais\|kiongozi wa sasa\|mkuu wa nchi\|meya wa\|mkuu wa\|mkurugenzi wa\|mwanasiasa\|current\|latest\|sasa\|wa sasa\|leo\|hivi punde\|habari mpya\|habari za leo\|bei ya\|thamani ya\|exchange rate\|rate ya\|matokeo ya\|ratiba ya\|msimamo wa\|nani ameshinda\|nani kashinda\)\\b\//,`const currentFactQuery = /\\b(waziri mkuu|rais wa|makamu wa rais|kiongozi wa sasa|mkuu wa nchi|meya wa|mkurugenzi wa|mwanasiasa|current|latest|wa sasa|leo|hivi punde|habari mpya|habari za leo|bei ya|thamani ya|exchange rate|rate ya|matokeo ya|ratiba ya|msimamo wa|nani ameshinda|nani kashinda)\\b/i.test(lowerMessage);`),'narrow server live-search trigger');

// Never let a stored/direct Gemini key bypass live search on web or Android.
patch('src/services/aiEngine.ts',t=>{if(t.includes('if(needsLiveSearch(params.message))return callNativeServerChat(params);'))return t;const m='if(needsImageRoute(params))return callImageStudio(params);';return t.includes(m)?t.replace(m,m+'if(needsLiveSearch(params.message))return callNativeServerChat(params);'):t},'route live queries to server Exa');

// Make the backend live path Exa-only. Normal chat remains on Gemini.
patch('server.ts',t=>{let o=t;if(!o.includes("import { searchWithExa } from './server/exaSearchV2.js';"))o=o.replace("import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';","import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';\nimport { searchWithExa } from './server/exaSearchV2.js';");
const old='const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});';
if(!o.includes('let result:any;')){if(!o.includes(old))throw new Error('server live marker missing');const neu=`let result:any;\n    if(currentFactQuery){\n      const live=await searchWithExa(message);\n      result={reply:live.answer,cleanSpeechText:live.answer.replace(/[#*\`_~\\[\\]\\(\\)]/g,' ').replace(/\\s+/g,' ').trim(),memoriesExtracted:[],peopleRecognized:[],generatedFiles:[],webSources:live.citations,aiProvider:'Exa Live Search',chatModel:'Exa',latencyMs:0};\n    }else{\n      result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});\n    }`;o=o.replace(old,neu)}
o=o.replace('generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)','generatedFiles:result.generatedFiles,webSources:result.webSources||[],memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)');
o=o.replace('generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};','generatedFiles:result.generatedFiles,webSources:result.webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};');return o},'Exa-only server live path + source bridge');

console.log('MKUU LIVE V4: normal chat stays on Gemini; genuine live/current questions use Exa.');
