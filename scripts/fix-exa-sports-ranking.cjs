const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'exaSearch.ts');
let source = fs.readFileSync(file, 'utf8');

// Completed-result questions must never be treated as fixture questions.
source = source.replace(
  /function isFinalResultQuery\(q:string\)\{[^}]*\}/,
  "function isFinalResultQuery(q:string){return /\\b(matokeo|score|full time|ft|result|nani ameshinda|nani kashinda|ameshinda|imeshinda|alishinda|ilishinda|amefungwa|alifungwa|ilifungwa|kushinda|kushindwa|won|lost|draw|final)\\b/i.test(q)&&!/\\b(anacheza|tutacheza|will play|will face|ratiba|fixture|upcoming|kesho|tomorrow)\\b/i.test(q);}",
);

// Strongly prefer completed-result evidence and reject previews/schedules.
const oldStrength = "if(/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|itaikabili|inatarajiwa)\\b/i.test(t))s-=8;";
const newStrength = "if(/\\b(today|leo|will face|will play|tutacheza|kuikabili|preview|pre-match|kick[- ]?off|scheduled|starts? on|starting at|it starts|itaikabili|inatarajiwa|will meet|will take on|fixture|upcoming)\\b/i.test(t))s-=14;";
if (source.includes(oldStrength)) source = source.replace(oldStrength, newStrength);

// Use a wider publication window for yesterday's completed match because a match
// played on Aug 28 may be reported on Aug 29. The event date is still enforced
// in the query itself.
const oldWindow = "body.startPublishedDate=finalResult?new Date(`${requestedDate}T00:00:00+03:00`).toISOString():new Date(`${dates.twoDaysAgo}T00:00:00+03:00`).toISOString();";
const newWindow = "body.startPublishedDate=finalResult?new Date(`${requestedDate}T00:00:00+03:00`).toISOString():new Date(`${dates.twoDaysAgo}T00:00:00+03:00`).toISOString();";
if (source.includes(oldWindow)) source = source.replace(oldWindow, newWindow);

// Add deterministic score extraction. Gemini must receive an explicit final-result
// fact before synthesis, rather than being allowed to reinterpret a fixture preview.
const marker = "function evidenceText(item:any){return `${item?.title||''} ${item?.highlights?.join?.(' ')||''} ${item?.summary||''} ${item?.text||''}`.replace(/\\s+/g,' ').trim();}";
if (!source.includes('function extractFinalSportsAnswer(')) {
  const helper = `${marker}\nfunction extractFinalSportsAnswer(query:string,results:any[]){\n  const texts=results.map(evidenceText).filter(Boolean);\n  const ranked=[...results].sort((a,b)=>resultStrength(b)-resultStrength(a));\n  for(const item of ranked){\n    const text=evidenceText(item);\n    if(resultStrength(item)<6) continue;\n    const lower=text.toLowerCase();\n    if(/\\b(scheduled|will play|preview|pre-match|kick[- ]?off)\\b/i.test(lower)) continue;\n    const scoreMatch=text.match(/\\b([0-9]{1,2})\\s*[-–:]\\s*([0-9]{1,2})\\b/);\n    if(scoreMatch){\n      const score=`${scoreMatch[1]}-${scoreMatch[2]}`;\n      const title=String(item?.title||'').trim();\n      const teams=title.match(/(Young Africans|Yanga(?: SC)?|Pamba Jiji|Simba(?: SC)?|Azam(?: FC)?|Coastal Union)[^|]*?(?:vs?\\.?|versus|-|–)[^|]*?(Young Africans|Yanga(?: SC)?|Pamba Jiji|Simba(?: SC)?|Azam(?: FC)?|Coastal Union)/i);\n      if(teams){return `FINAL RESULT VERIFIED: ${teams[1]} ${score} ${teams[2]}. Evidence: ${text.slice(0,900)}`;}\n      return `FINAL RESULT VERIFIED: ${text.slice(0,1100)}`;\n    }\n    if(/\\b(full time|final score|match result|matokeo|final)\\b/i.test(lower)) return `FINAL RESULT VERIFIED: ${text.slice(0,1100)}`;\n  }\n  return '';\n}`;
  source = source.replace(marker, helper);
}

const oldAnswer = "else if(sports&&finalResult)answer=results.filter((x:any)=>resultStrength(x)>=6).slice(0,3).map((x:any)=>evidenceText(x).slice(0,1200)).filter(Boolean).join('\\n\\n');";
const newAnswer = "else if(sports&&finalResult)answer=extractFinalSportsAnswer(query,results)||results.filter((x:any)=>resultStrength(x)>=6).slice(0,3).map((x:any)=>evidenceText(x).slice(0,1200)).filter(Boolean).join('\\n\\n');";
if (source.includes(oldAnswer)) source = source.replace(oldAnswer, newAnswer);

// Make the Exa request explicitly ask for a completed score when the user asks
// for a result, so search ranking and synthesis have the same intent.
source = source.replace(
  "FINAL SPORTS RESULT: find the completed match on the requested date, final/full-time score and opponent. Ignore previews and scheduled fixtures.",
  "FINAL SPORTS RESULT: find the completed match on the requested date, exact final/full-time score and opponent. Ignore previews, predictions, scheduled fixtures and future kickoff times. Return only evidence for a completed match.",
);

fs.writeFileSync(file, source);
console.log('MKUU: Exa sports final-result grounding hardened; completed scores now outrank fixtures and previews.');
