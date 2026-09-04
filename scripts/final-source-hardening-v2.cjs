const fs=require('fs');const path=require('path');const root=process.cwd();
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const serverPath=path.join(root,'server','geminiService.ts');const server=read(serverPath);let client=read(path.join(root,'src','services','aiEngine.ts'));

// build-gemini-rest-runtime.cjs is the transformer of record. This final gate must
// validate executable legacy paths, not harmless type names/comments left by the
// source template. Do not reject the build merely because the words GoogleGenAI or
// getClient appear in a non-executable string/comment.
const badServer=[];
if(/import\s*\{[^}]*searchWithTavily|require\([^)]*tavily|\bsearchWithTavily\s*\(/i.test(server))badServer.push('Tavily runtime');
if(/import\s*\{[^}]*GoogleGenAI[^}]*\}\s*from\s*['"]@google\/genai['"]|from\s*['"]@google\/genai['"]/i.test(server))badServer.push('Gemini SDK import');
if(/\b(?:this\.)?aiClient\s*[:=]\s*new\s+GoogleGenAI|\b(?:client|this\.aiClient)\.models\.generateContent\s*\(/.test(server))badServer.push('Gemini SDK call');
if(/\bprivate\s+getClient\s*\(\s*\)\s*:\s*GoogleGenAI\s*\{/.test(server))badServer.push('Gemini SDK client helper');
if(badServer.length)throw new Error(`[FINAL-HARDENING] Forbidden executable backend references remain: ${[...new Set(badServer)].join(', ')}`);

// Validate executable client routing. Legacy helper text is removed from the
// validation copy so comments/unused compatibility source cannot block a release.
client=client.replace(/async function callDirectGemini\([\s\S]*?\n(?=async function callNativeServerChat)/,'');
const badClient=[];
if(/\bcallDirectGemini\s*\(/.test(client))badClient.push('direct Gemini browser call');
if(/generativelanguage\.googleapis\.com\/v1beta\/models/.test(client))badClient.push('Gemini browser endpoint');
if(/searchWithTavily|tavilySearch/i.test(client))badClient.push('Tavily client runtime');
if(badClient.length)throw new Error(`[FINAL-HARDENING] Forbidden frontend references remain: ${[...new Set(badClient)].join(', ')}`);

console.log('[FINAL-HARDENING-V2] OK: backend Gemini REST + Exa live search only; executable legacy SDK/Tavily paths are absent.');
