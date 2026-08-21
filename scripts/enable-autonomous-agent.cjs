const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'server.ts');
let source = fs.readFileSync(file, 'utf8');
const importNeedle = "import { universalAgent } from './server/agentEngine.js';";
if (!source.includes("./server/autonomousAgent.js")) {
  if (!source.includes(importNeedle)) throw new Error('MKUU: autonomous agent import point not found.');
  source = source.replace(importNeedle, `${importNeedle}\nimport { executeAutonomous } from './server/autonomousAgent.js';`);
}
const endpointNeedle = "  app.post('/api/agent',async(req,res)=>";
if (!source.includes('/api/agent/autonomous')) {
  if (!source.includes(endpointNeedle)) throw new Error('MKUU: /api/agent endpoint insertion point not found.');
  const endpoint = `  app.post('/api/agent/autonomous',async(req,res)=>{try{const {message='',conversationHistory=[],isVoice=false,attachments=[],people=[],maxSteps}=req.body||{};if(!message&&!attachments.length)throw new Error('Ujumbe au kiambatisho kinahitajika');res.json(await executeAutonomous({userId:DEFAULT_USER_ID,message,conversationHistory,isVoice,attachments,people,maxSteps}));}catch(e:any){console.error('[MKUU-AUTONOMOUS]',e);res.status(503).json({success:false,error:'AUTONOMOUS_EXECUTION_FAILED',message:e.message,aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL});}});\n`;
  source = source.replace(endpointNeedle, endpoint + endpointNeedle);
}
fs.writeFileSync(file, source);
console.log('MKUU: bounded autonomous execution enabled.');
