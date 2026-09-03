const fs = require('fs');
const path = require('path');

const root = process.cwd();
const aiPath = path.join(root, 'src', 'services', 'aiEngine.ts');
const apiPath = path.join(root, 'src', 'services', 'apiConfig.ts');

function patch(file, replacements, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`);
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`${label}: expected source pattern not found`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text, 'utf8');
}

patch(aiPath, [
  [
    "if(!response.ok)throw new MkuuApiError({code:'GEMINI_UNAVAILABLE',status:response.status,userMessage:'GEMINI HAIPATIKANI KWA SASA\\nTafadhali jaribu tena.',technicalDetails:`Gemini API error (${response.status})`,targetUrl:url});",
    "if(!response.ok){let errorBody:any={};try{errorBody=await response.json();}catch{}const apiMessage=String(errorBody?.error?.message||errorBody?.message||errorBody?.error||'Google Gemini API request failed').trim();const status=response.status;const code=status===401?'GEMINI_AUTHENTICATION_ERROR':status===403?'GEMINI_PERMISSION_ERROR':status===404?'GEMINI_MODEL_ERROR':status===429?'GEMINI_RATE_LIMIT_ERROR':status>=500?'GEMINI_SERVER_ERROR':'GEMINI_REQUEST_ERROR';throw new MkuuApiError({code:'GEMINI_UNAVAILABLE',status,userMessage:`GEMINI ERROR ${status}: ${apiMessage}`,technicalDetails:`${code}: ${apiMessage}`,targetUrl:url});}",
  ],
  [
    "if(!response.ok||!response.body)throw new MkuuApiError({code:'BACKEND_UNREACHABLE',status:response.status,userMessage:'SEVA YA MKUU HAIPATIKANI\\nTafadhali jaribu tena.',technicalDetails:`Streaming endpoint returned HTTP ${response.status}`,targetUrl:url});",
    "if(!response.ok||!response.body){let errorBody:any={};try{errorBody=await response.json();}catch{}const apiMessage=String(errorBody?.error?.message||errorBody?.message||errorBody?.error||`Streaming endpoint returned HTTP ${response.status}`).trim();throw new MkuuApiError({code:'GEMINI_UNAVAILABLE',status:response.status,userMessage:`GEMINI ERROR ${response.status}: ${apiMessage}`,technicalDetails:apiMessage,targetUrl:url});}",
  ],
  [
    "if(payload.type==='error')throw new Error(payload.message||'Streaming error');",
    "if(payload.type==='error')throw new MkuuApiError({code:'GEMINI_UNAVAILABLE',status:payload.status||503,userMessage:`GEMINI ERROR ${payload.status||503}: ${payload.message||'Streaming error'}`,technicalDetails:String(payload.message||'Streaming error'),targetUrl:url});",
  ],
], 'aiEngine.ts');

patch(apiPath, [
  [
    "throw new MkuuApiError({code:isExa?'EXA_UNAVAILABLE':r.status===429||r.status===503?'GEMINI_UNAVAILABLE':'BACKEND_UNREACHABLE',status:r.status,userMessage:isExa?'EXA LIVE SEARCH HAIPATIKANI KWA SASA\\nTafadhali jaribu tena.':r.status===429||r.status===503?'GEMINI HAIPATIKANI KWA SASA\\nTafadhali jaribu tena.':'SEVA YA MKUU HAIPATIKANI\\nTafadhali jaribu tena.',technicalDetails:String(detail),targetUrl:url});",
    "throw new MkuuApiError({code:isExa?'EXA_UNAVAILABLE':r.status===429||r.status===503?'GEMINI_UNAVAILABLE':'BACKEND_UNREACHABLE',status:r.status,userMessage:isExa?'EXA LIVE SEARCH HAIPATIKANI KWA SASA\\nTafadhali jaribu tena.':r.status===429||r.status===503?`GEMINI ERROR ${r.status}: ${String(detail)}`:`SEVA YA MKUU HAIPATIKANI\\n${String(detail)}`,technicalDetails:String(detail),targetUrl:url});",
  ],
], 'apiConfig.ts');

console.log('[fix-gemini-client-errors] patched client Gemini error reporting');
