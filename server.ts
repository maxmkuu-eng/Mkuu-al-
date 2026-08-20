import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, FILES_DIR } from './server/db.js';
import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';
import { imageService, PRIMARY_IMAGE_MODEL } from './server/imageService.js';
import { universalAgent } from './server/agentEngine.js';
import { generateRealFile, ensureInitialSeedFiles } from './server/files.js';
import { getManagerSnapshot, addTask, updateTask, deleteTask, addEvent, updateEvent, deleteEvent, addReminder, updateReminder, deleteReminder, updateSettings, addAction, markReminderDelivered } from './server/assistantManager.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const DEFAULT_USER_ID = 'user_max_owner';
  await ensureInitialSeedFiles();
  app.use((req, res, next) => { res.header('Access-Control-Allow-Origin','*'); res.header('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE, OPTIONS'); res.header('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept, Authorization'); if(req.method==='OPTIONS') return res.status(200).end(); next(); });
  app.use(express.json({ limit:'50mb' }));
  app.use(express.urlencoded({ extended:true, limit:'50mb' }));

  app.get(['/health','/api/health','/api/status','/api/system/status','/api/ping'], async (_req,res)=>{ const health=await geminiService.getHealthStatus(); res.json({status:'ok',service:'MKUU Backend',gemini:'configured',chatModel:health.chatModel||PERSONAL_CHAT_MODEL,backend:health.backend||BACKEND_IDENTIFIER,aiProvider:health.aiProvider||AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString(),latencyMs:health.latencyMs}); });
  app.get(['/api/me','/api/auth/me','/api/user'],(_req,res)=>{const owner=db.getOwner();res.json({...owner,user:owner,authenticated:true,role:'owner',title:'MAX — Mmiliki Aliyeidhinishwa'});});
  app.put(['/api/auth/profile','/api/me','/api/user/profile'],(req,res)=>{try{const updated=db.updateUser(DEFAULT_USER_ID,req.body);res.json({success:true,user:updated,...updated});}catch(e:any){res.status(400).json({error:e.message});}});
  app.post('/api/user/pin',(req,res)=>{try{const {pin}=req.body;const updated=db.updateUser(DEFAULT_USER_ID,{securityPinSet:!!pin,securityPin:pin});res.json({success:true,user:updated});}catch(e:any){res.status(400).json({error:e.message});}});
  app.post('/api/system/reset',(_req,res)=>{try{db.resetSystem();res.json({success:true,message:'Mfumo umerejeshwa katika hali ya msingi.'});}catch(e:any){res.status(500).json({error:e.message});}});

  // AI Assistant Manager: tasks, calendar, reminders, proactive status, Android action intents and settings.
  app.get('/api/manager',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID)));
  app.get('/api/manager/tasks',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).tasks));
  app.post('/api/manager/tasks',(req,res)=>{try{res.status(201).json(addTask(DEFAULT_USER_ID,req.body));}catch(e:any){res.status(400).json({error:e.message});}});
  app.patch('/api/manager/tasks/:id',(req,res)=>{const item=updateTask(DEFAULT_USER_ID,req.params.id,req.body);if(!item)return res.status(404).json({error:'Kazi haijapatikana'});res.json(item);});
  app.delete('/api/manager/tasks/:id',(req,res)=>res.json({success:deleteTask(DEFAULT_USER_ID,req.params.id)}));
  app.get('/api/manager/calendar',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).events));
  app.post('/api/manager/calendar',(req,res)=>{try{res.status(201).json(addEvent(DEFAULT_USER_ID,req.body));}catch(e:any){res.status(400).json({error:e.message});}});
  app.patch('/api/manager/calendar/:id',(req,res)=>{const item=updateEvent(DEFAULT_USER_ID,req.params.id,req.body);if(!item)return res.status(404).json({error:'Tukio halijapatikana'});res.json(item);});
  app.delete('/api/manager/calendar/:id',(req,res)=>res.json({success:deleteEvent(DEFAULT_USER_ID,req.params.id)}));
  app.get('/api/manager/reminders',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).reminders));
  app.post('/api/manager/reminders',(req,res)=>{try{res.status(201).json(addReminder(DEFAULT_USER_ID,req.body));}catch(e:any){res.status(400).json({error:e.message});}});
  app.patch('/api/manager/reminders/:id',(req,res)=>{const item=updateReminder(DEFAULT_USER_ID,req.params.id,req.body);if(!item)return res.status(404).json({error:'Reminder haijapatikana'});res.json(item);});
  app.delete('/api/manager/reminders/:id',(req,res)=>res.json({success:deleteReminder(DEFAULT_USER_ID,req.params.id)}));
  app.post('/api/manager/reminders/:id/deliver',(req,res)=>{const item=markReminderDelivered(DEFAULT_USER_ID,req.params.id);if(!item)return res.status(404).json({error:'Reminder haijapatikana'});res.json(item);});
  app.get('/api/manager/settings',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).settings));
  app.put('/api/manager/settings',(req,res)=>res.json(updateSettings(DEFAULT_USER_ID,req.body)));
  app.post('/api/manager/actions',(req,res)=>{try{const {type,label,payload={}}=req.body||{};if(!type||!label)return res.status(400).json({error:'Action type na label vinahitajika'});res.status(201).json(addAction(DEFAULT_USER_ID,{type,label,payload}));}catch(e:any){res.status(400).json({error:e.message});}});

  const processChatRequest = async (req:any) => {
    const {message='',conversationId,conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};
    if(!message && (!attachments||attachments.length===0)) throw new Error('Ujumbe au kiambatisho kinahitajika');
    let effectiveHistory=Array.isArray(conversationHistory)&&conversationHistory.length?conversationHistory:[];
    if(!effectiveHistory.length&&conversationId){const stored=db.getConversation(conversationId,DEFAULT_USER_ID);if(stored) effectiveHistory=stored.messages;}
    const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message,conversationHistory:effectiveHistory,isVoice,attachments});
    if(conversationId){let c=db.getConversation(conversationId,DEFAULT_USER_ID);const u={id:`msg_${Date.now()}_u`,role:'user' as const,content:message,timestamp:new Date().toISOString(),isVoice,attachments};const a={id:`msg_${Date.now()}_a`,role:'assistant' as const,content:result.reply,timestamp:new Date().toISOString(),generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)};if(c){c.messages.push(u,a);db.saveConversation(c);}else{c={id:conversationId,userId:DEFAULT_USER_ID,title:message.slice(0,35)||'Mazungumzo Mapya',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[u,a]};db.saveConversation(c);}}
    return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};
  };
  app.post(['/api/chat','/api/chat/'],async(req,res)=>{try{res.json(await processChatRequest(req));}catch(error:any){console.error('[MKUU-BACKEND] Chat API Error:',error);res.status(503).json({error:'GEMINI_UNAVAILABLE',message:error.message||'Google Gemini API Error',aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL});}});
  app.post('/api/chat/stream',async(req,res)=>{res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});try{const result=await processChatRequest(req);res.write(`data: ${JSON.stringify({type:'delta',text:result.reply})}\n\n`);res.write(`data: ${JSON.stringify({type:'done',...result})}\n\n`);res.end();}catch(e:any){res.write(`data: ${JSON.stringify({type:'error',message:e.message||'Google Gemini API Error'})}\n\n`);res.end();}});
  app.post('/api/agent',async(req,res)=>{try{const {message='',conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};if(!message&&!attachments.length)throw new Error('Ujumbe au kiambatisho kinahitajika');res.json({success:true,...await universalAgent.execute({userId:DEFAULT_USER_ID,message,conversationHistory,isVoice,attachments,people})});}catch(e:any){res.status(503).json({success:false,error:'GEMINI_UNAVAILABLE',message:e.message,aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL});}});
  app.post(['/api/image/edit','/api/image/generate','/api/image'],async(req,res)=>{try{const {prompt='',imageBase64,mimeType='image/jpeg',filename='picha_iliyohaririwa.png'}=req.body; if(!prompt&&!imageBase64)return res.status(400).json({error:'Maelekezo au picha inahitajika kwa ajili ya Image Studio'});const attachments=imageBase64?[{filename,fileType:mimeType.includes('png')?'png':'jpg',mimeType,base64Data:imageBase64}]:[];const result=await imageService.processImage({userId:DEFAULT_USER_ID,prompt:prompt||'Enhance and edit this image with high precision while strictly preserving identity',attachments});res.json({success:true,reply:result.explanation,file:result.file,generatedFiles:[result.file],modelUsed:result.modelUsed});}catch(e:any){res.status(500).json({error:e.message||'Hitilafu ya Image Studio'});}});

  app.get('/api/conversations',(_req,res)=>res.json(db.getConversations(DEFAULT_USER_ID)));
  app.get('/api/conversations/:id',(req,res)=>{const c=db.getConversation(req.params.id,DEFAULT_USER_ID);res.json(c||{id:req.params.id,userId:DEFAULT_USER_ID,title:'Mazungumzo Mapya',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[]});});
  app.post('/api/conversations',(req,res)=>{const {title='Mazungumzo Mapya',messages=[]}=req.body;res.json(db.saveConversation({id:`conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,userId:DEFAULT_USER_ID,title,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages}));
  });
  app.delete('/api/conversations/:id',(req,res)=>res.json({success:db.deleteConversation(req.params.id,DEFAULT_USER_ID)}));
  app.get('/api/memories',(_req,res)=>res.json(db.getMemories(DEFAULT_USER_ID)));
  app.post('/api/memories',(req,res)=>{const {content,category='General',importance='medium',tags=[],source='manual'}=req.body;if(!content)return res.status(400).json({error:'Kumbukumbu inahitaji maelezo'});res.json(db.addMemory({userId:DEFAULT_USER_ID,content,category,importance,tags,source}));});
  app.put('/api/memories/:id',(req,res)=>{const item=db.updateMemory(req.params.id,DEFAULT_USER_ID,req.body);if(!item)return res.status(404).json({error:'Kumbukumbu haijapatikana'});res.json(item);});
  app.delete('/api/memories/:id',(req,res)=>res.json({success:db.deleteMemory(req.params.id,DEFAULT_USER_ID)}));
  app.get('/api/people',(_req,res)=>res.json(db.getPeople(DEFAULT_USER_ID)));
  app.post('/api/people',(req,res)=>{const {name,nickname,relationship,phone,email,notes,avatarColor}=req.body;if(!name||!relationship)return res.status(400).json({error:'Jina na Uhusiano vinahitajika'});res.json(db.addPerson({userId:DEFAULT_USER_ID,name,nickname,relationship,phone,email,notes,avatarColor:avatarColor||'blue'}));});
  app.put('/api/people/:id',(req,res)=>{const item=db.updatePerson(req.params.id,DEFAULT_USER_ID,req.body);if(!item)return res.status(404).json({error:'Mtu hajapatikana'});res.json(item);});
  app.delete('/api/people/:id',(req,res)=>res.json({success:db.deletePerson(req.params.id,DEFAULT_USER_ID)}));

  app.get('/api/autoreply/settings',(_req,res)=>res.json(db.getAutoReplySettings(DEFAULT_USER_ID)));
  app.put('/api/autoreply/settings',(req,res)=>res.json(db.updateAutoReplySettings(DEFAULT_USER_ID,req.body)));
  app.post('/api/autoreply/verify-phone',(req,res)=>{const phoneNumber=String(req.body?.phoneNumber||'').trim();if(!phoneNumber)return res.status(400).json({error:'PHONE_REQUIRED',message:'Nambari ya simu inahitajika.'});const updated=db.updateAutoReplySettings(DEFAULT_USER_ID,{myPhoneNumber:phoneNumber,phoneVerified:true,phoneVerifiedAt:new Date().toISOString()});res.json({success:true,phoneNumber,phoneVerified:true,phoneVerifiedAt:updated.phoneVerifiedAt});});
  app.post('/api/autoreply/remove-phone',(_req,res)=>{const updated=db.updateAutoReplySettings(DEFAULT_USER_ID,{myPhoneNumber:'',phoneVerified:false,phoneVerifiedAt:undefined});res.json({success:true,phoneNumber:'',phoneVerified:false});});
  app.get('/api/autoreply/logs',(_req,res)=>res.json(db.getAutoReplyLogs(DEFAULT_USER_ID)));
  app.delete('/api/autoreply/logs',(_req,res)=>{db.clearAutoReplyLogs(DEFAULT_USER_ID);res.json({success:true});});
  app.post('/api/autoreply/emergency-stop',(req,res)=>{const current=db.getAutoReplySettings(DEFAULT_USER_ID);const updated=db.updateAutoReplySettings(DEFAULT_USER_ID,{emergencyStop:req.body?.stop!==undefined?!!req.body.stop:!current.emergencyStop});res.json({success:true,emergencyStop:updated.emergencyStop,settings:updated});});

  app.get('/api/files',(_req,res)=>res.json(db.getFiles(DEFAULT_USER_ID)));
  app.get('/api/files/download/:id',(req,res)=>{const file=db.getFile(req.params.id);if(!file)return res.status(404).json({error:'Faili halijapatikana'});const diskPrefix=`${file.id}_`;const filename=fs.readdirSync(FILES_DIR).find(n=>n.startsWith(diskPrefix));if(!filename)return res.status(404).json({error:'Faili halipo kwenye storage'});res.type(file.mimeType);res.download(path.join(FILES_DIR,filename),file.filename);});
  app.get('/api/stats',(_req,res)=>{const memories=db.getMemories(DEFAULT_USER_ID),people=db.getPeople(DEFAULT_USER_ID),files=db.getFiles(DEFAULT_USER_ID),logs=db.getAutoReplyLogs(DEFAULT_USER_ID),settings=db.getAutoReplySettings(DEFAULT_USER_ID);res.json({totalMemories:memories.length,totalPeople:people.length,totalFiles:files.length,totalAutoReplies:logs.length,emergencyStop:settings.emergencyStop,autoReplyEnabled:settings.enabled,systemHealth:'100% Salama & Imeunganishwa',owner:'Max'});});
  app.all('/api/*',(req,res)=>res.status(404).json({error:`API route ${req.method} ${req.path} not found`}));
  if(process.env.NODE_ENV!=='production'){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{const distPath=path.join(process.cwd(),'dist');app.use(express.static(distPath));app.get('*',(_req,res)=>res.sendFile(path.join(distPath,'index.html')));}
  app.listen(PORT,'0.0.0.0',()=>console.log(`👑 MKUU AI Server is running on port ${PORT}`));
}
startServer();