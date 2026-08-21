const fs = require('node:fs');

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');

const marker = "const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message:searchMessage,conversationHistory:effectiveHistory,isVoice,attachments});";
if (!source.includes(marker)) throw new Error('MKUU: chat result marker not found.');

const replacement = `${marker}\n    // Sources are opt-in per response. Personal/casual/creative questions must not inherit\n    // or display sources unless the user explicitly asks for web/search/current verification.\n    const explicitWebRequest = /\\b(tafuta google|search google|tafuta mtandaoni|search online|tafuta kwenye mtandao|angalia mtandaoni|source|vyanzo)\\b/i.test(lowerMessage);\n    const shouldExposeSources = currentFactQuery || explicitWebRequest;\n    const responseWebSources = shouldExposeSources && Array.isArray((result as any).webSources)\n      ? (result as any).webSources\n      : [];\n    (result as any).webSources = responseWebSources;`;

if (!source.includes('const shouldExposeSources = currentFactQuery || explicitWebRequest;')) {
  source = source.replace(marker, replacement);
}

const persistNeedle = "personRecognized:result.peopleRecognized?.map(p=>p.name),";
const persistReplacement = "personRecognized:result.peopleRecognized?.map(p=>p.name),webSources:(result as any).webSources||[],";
if (source.includes(persistNeedle) && !source.includes(persistReplacement)) {
  source = source.replace(persistNeedle, persistReplacement);
}

const returnNeedle = "generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};";
const returnReplacement = "generatedFiles:result.generatedFiles,webSources:(result as any).webSources||[],aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};";
if (source.includes(returnNeedle) && !source.includes(returnReplacement)) {
  source = source.replace(returnNeedle, returnReplacement);
}

fs.writeFileSync(file, source, 'utf8');
console.log('MKUU: source eligibility is now request-scoped; personal/casual replies return no sources.');
