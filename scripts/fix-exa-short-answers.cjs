const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server/exaSearch.ts');
if (!fs.existsSync(file)) throw new Error('[MKUU-SHORT] server/exaSearch.ts not found');
let source = fs.readFileSync(file, 'utf8');

// Do not depend on one exact intermediate Exa implementation. Several earlier
// build patches legitimately rewrite the answer-selection branch. Instead,
// install one final, idempotent compactor immediately before the API return.
const helper = `\nfunction compactExaAnswer(query:string, answer:string, results:any[]):string {\n  const q=String(query||'');\n  const raw=String(answer||'').replace(/\\s+/g,' ').trim();\n  const sports=/\\b(simba|yanga|young africans|azam|coastal union|singida|jkt tanzania|namungo|mashujaa|dodoma jiji|mechi|mchezo|matokeo|score|ligi|premier league)\\b/i.test(q);\n  const finalResult=/\\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|amecheza|alicheza|ilicheza|imeshinda|kashinda|ushindi|zimeishaje|imeishaje|yameishaje|zimekwisha|zimeisha|won|lost|draw|final)\\b/i.test(q) && !/\\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho|leo|today)\\b/i.test(q);\n  if(sports&&finalResult){\n    const compact:string[]=[];\n    for(const item of results||[]){\n      const title=String(item?.title||'').replace(/\\s+/g,' ').trim();\n      const text=(title+' '+evidenceText(item)).replace(/\\s+/g,' ').trim();\n      const score=text.match(/\\b(?:FT|FULL TIME|FINAL SCORE|FINAL RESULT)\\s*[:\\-]?\\s*(\\d+)\\s*[-–:]\\s*(\\d+)\\b/i);\n      const genericScore=text.match(/\\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{2,50})\\s+(?:vs\\.?|v\\.?|versus)\\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{2,50})[^.]{0,120}\\b(?:FT|FULL TIME|FINAL SCORE|RESULT)\\s*[:\\-]?\\s*(\\d+)\\s*[-–:]\\s*(\\d+)\\b/i);\n      if(score){\n        const teams=genericScore?genericScore[1].trim()+' vs '+genericScore[2].trim():((title.match(/([^|]{2,70}?)\\s+(?:vs\\.?|v\\.?|versus)\\s+([^|]{2,70})/i)||[]).slice(1).join(' vs ')||title);\n        compact.push(teams+': '+score[1]+'-'+score[2]);\n      }\n      if(compact.length>=5) break;\n    }\n    if(compact.length) return Array.from(new Set(compact)).join('\\n');\n  }\n  const sentences=raw.match(/[^.!?]+[.!?]+/g);\n  const short=sentences&&sentences.length ? sentences.slice(0,3).join(' ').trim() : raw;\n  return short.length>700 ? short.slice(0,697).replace(/\\s+\\S*$/,'').trim()+'...' : short;\n}\n`;

if (!source.includes('function compactExaAnswer(')) {
  const marker = 'export async function searchWithExa';
  if (!source.includes(marker)) throw new Error('[MKUU-SHORT] searchWithExa insertion point not found');
  source = source.replace(marker, helper + '\n' + marker);
}

const returnPattern = /if\(!answer\)throw new Error\('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence\.'\);return \{answer,citations\};/;
const replacement = "if(!answer)throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');answer=compactExaAnswer(query,answer,results);return {answer,citations};";
if (returnPattern.test(source)) {
  source = source.replace(returnPattern, replacement);
} else if (!source.includes('answer=compactExaAnswer(query,answer,results);')) {
  throw new Error('[MKUU-SHORT] Exa final return target not found');
}

fs.writeFileSync(file, source, 'utf8');
console.log('[MKUU-SHORT] Exa answers are now compacted at the final return point; patch is idempotent.');
