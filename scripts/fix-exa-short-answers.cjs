const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(root, 'server/exaSearch.ts');
let source = fs.readFileSync(file, 'utf8');

// Keep live-search answers concise. Exa search evidence is useful internally,
// but the user should receive the answer to the question, not raw article text.
const oldSports = "else if(sports&&finalResult)answer=results.filter((x:any)=>resultStrength(x)>=6).slice(0,3).map((x:any)=>evidenceText(x).slice(0,1200)).filter(Boolean).join('\\n\\n');";
const newSports = `else if(sports&&finalResult){\n    const compact=[];\n    for(const x of results){\n      const raw=evidenceText(x);\n      const title=String(x?.title||'').replace(/\\s+/g,' ').trim();\n      const text=(title+' '+raw).replace(/\\s+/g,' ').trim();\n      const score=text.match(/\\b(FT|FULL TIME|FINAL SCORE|FINAL RESULT)\\s*[:\\-]?\\s*(\\d+)\\s*[-–:]\\s*(\\d+)\\b/i);\n      const matchup=text.match(/([^|]{2,70}?)\\s+(?:vs\\.?|v\\.?|versus)\\s+([^|]{2,70})/i);\n      if(score){\n        const teams=matchup?`${matchup[1].trim()} vs ${matchup[2].trim()}`:title;\n        compact.push(`${teams}: ${score[2]}-${score[3]}`);\n      }\n      if(compact.length>=5) break;\n    }\n    answer=Array.from(new Set(compact)).join('\\n');\n    if(!answer){\n      answer=results.filter((x:any)=>resultStrength(x)>=6).slice(0,2).map((x:any)=>String(x?.title||'').replace(/\\s+/g,' ').trim()).filter(Boolean).join('\\n');\n    }\n  }`;
if (!source.includes(oldSports)) {
  throw new Error('[MKUU-SHORT] Sports final-result target not found in server/exaSearch.ts');
}
source = source.replace(oldSports, newSports);

// For non-sports live answers, remove obvious raw-source boilerplate and cap the
// response while retaining the first complete factual sentences.
const oldFallback = "else answer=String(data?.output?.content||'').trim()||results.slice(0,social?3:(news?5:2)).map((x:any)=>evidenceText(x).slice(0,1000)).filter(Boolean).join('\\n\\n').trim();";
const newFallback = `else {\n    const rawAnswer=String(data?.output?.content||'').trim();\n    const evidence=results.slice(0,social?3:(news?4:2)).map((x:any)=>evidenceText(x).slice(0,900)).filter(Boolean).join('\\n\\n').trim();\n    answer=(rawAnswer||evidence).replace(/\\s+/g,' ').trim();\n    const sentences=answer.match(/[^.!?]+[.!?]+/g);\n    if(sentences&&sentences.length>0) answer=sentences.slice(0,3).join(' ').trim();\n    if(answer.length>700) answer=answer.slice(0,697).replace(/\\s+\\S*$/,'').trim()+'...';\n  }`;
if (!source.includes(oldFallback)) {
  throw new Error('[MKUU-SHORT] General live-answer target not found in server/exaSearch.ts');
}
source = source.replace(oldFallback, newFallback);

fs.writeFileSync(file, source, 'utf8');
console.log('[MKUU-SHORT] Exa live-search answers now return short, direct answers instead of raw search evidence.');
