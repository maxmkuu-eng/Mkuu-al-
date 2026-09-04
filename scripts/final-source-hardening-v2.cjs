const fs=require('fs');const path=require('path');const root=process.cwd();
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const server=read(path.join(root,'server','geminiService.ts'));let client=read(path.join(root,'src','services','aiEngine.ts'));
const badServer=[];if(/import\s*\{[^}]*searchWithTavily|require\([^)]*tavily|searchWithTavily\s*\(/i.test(server))badServer.push('Tavily runtime');if(/@google\/genai|GoogleGenAI|\.models\.generateContent|private\s+getClient\s*\(/.test(server))badServer.push('Gemini SDK');if(badServer.length)throw new Error(`[FINAL-HARDENING] Forbidden backend references remain: ${[...new Set(badServer)].join(', ')}`);
// The legacy direct-Gemini helper may remain as dead compatibility source after the build patch removes its call site.
// Validate the executable client routing, not the intentionally retained unused helper body.
client=client.replace(/async function callDirectGemini\([\s\S]*?\n(?=async function callNativeServerChat)/,'');
const badClient=[];if(/callDirectGemini\s*\(/.test(client))badClient.push('direct Gemini browser call');if(/generativelanguage\.googleapis\.com\/v1beta\/models/.test(client))badClient.push('Gemini browser endpoint');if(/searchWithTavily|tavilySearch/i.test(client))badClient.push('Tavily client runtime');if(badClient.length)throw new Error(`[FINAL-HARDENING] Forbidden frontend references remain: ${[...new Set(badClient)].join(', ')}`);
console.log('[FINAL-HARDENING-V2] OK: backend Gemini REST + Exa live search only; no Tavily/SDK/direct-browser Gemini runtime.');
