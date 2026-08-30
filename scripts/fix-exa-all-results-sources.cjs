const fs=require('fs');
const path=require('path');
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s,'utf8');

let exa=read('server/exaSearch.ts');
const start=exa.indexOf('export async function searchWithExa');
if(start<0) throw new Error('searchWithExa function not found');
const prefix=exa.slice(0,start);
const fn=`export async function searchWithExa(query:string):Promise<ExaSearchResult>{
  const apiKey=resolveExaApiKey();
  const q=String(query||'').trim();
  const dates=tanzaniaDateContext();
  const fresh=isFreshOrRelativeQuery(q);
  const social=isSocialQuery(q);
  const sports=isSportsQuery(q);
  const news=isNewsQuery(q);
  const finalResult=isFinalResultQuery(q);
  const opponent=isOpponentQuestion(q);
  const newsFact=isNewsFactQuestion(q);
  const requestedDate=/\\b(jana|yesterday)\\b/i.test(q)?dates.yesterday:/\\bjuzi\\b/i.test(q)?dates.twoDaysAgo:dates.today;
  const allMatches=sports&&finalResult&&/\\b(matokeo|mechi|mchezo|results?|scores?|zimeish|iliish)\\b/i.test(q)&&/\\b(jana|yesterday)\\b/i.test(q)&&/\\b(tanzania|ligi kuu|ligi|premier league|bara|nbc)\\b/i.test(q);
  const context='TANZANIA TIME: '+dates.formatted+'. Current Tanzania date='+dates.today+'. Requested event date='+requestedDate+'.';
  const queries:string[]=allMatches?[
    q+' '+context+' ALL COMPLETED TANZANIA PREMIER LEAGUE MATCHES ON '+requestedDate+'. Return every completed match played that date with final/full-time score. Ignore fixtures, previews and scheduled matches. Do not return only one match.',
    'Tanzania Premier League Ligi Kuu Bara all results '+requestedDate+' final score completed matches',
    'Tanzania NBC Premier League '+requestedDate+' match results FT scores all matches'
  ]:[q+'\\n'+context+'\\nAnswer only the exact thing the user asked. Use the requested event date, not an older year.'];
  async function run(searchQuery:string){
    const body:any={query:searchQuery,type:'fast',numResults:allMatches?25:(sports?12:(fresh?12:8)),contents:{highlights:true,text:true}};
    if(fresh&&!sports){
      body.startPublishedDate=new Date(Date.now()-14*86400000).toISOString();
      body.endPublishedDate=new Date(Date.now()+86400000).toISOString();
      body.maxAgeHours=0;
    }
    const r=await fetch('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw new Error('EXA_SEARCH_FAILED: HTTP '+r.status);
    const d=await r.json();
    return Array.isArray(d?.results)?d.results:[];
  }
  const raw=(await Promise.all(queries.map(run))).flat();
  const unique:any[]=[]; const seen=new Set<string>();
  for(const item of raw){const u=String(item?.url||'').trim();if(u&&!seen.has(u)){seen.add(u);unique.push(item);}}
  const ranked=sports&&finalResult?[...unique].sort((a,b)=>resultStrength(b)-resultStrength(a)):news?[...unique].sort((a,b)=>newsEvidenceStrength(b)-newsEvidenceStrength(a)):unique;
  const results=ranked.slice(0,allMatches?50:(sports?12:(news?10:8)));
  const citations=results.filter(x=>x?.url).map(x=>({title:String(x.title||x.url).trim(),url:String(x.url).trim()})).slice(0,10);
  let answer='';
  if(allMatches){
    const lines=new Map<string,string>();
    for(const item of results){
      const text=evidenceText(item);
      const parts=text.split(/\\n|(?=\\b(?:FT|Final|Full Time)\\b)/i);
      for(const part of parts){
        const m=part.match(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .&'’\\-]{2,50}?)\\s+(?:FC|SC)?\\s*(?:vs\\.?|v\\.?|versus)\\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .&'’\\-]{2,50}?)(?:\\s+FC|\\s+SC)?\\s+(?:FT\\s*)?(\\d{1,2})\\s*[-–:]\\s*(\\d{1,2})\\b/i);
        if(m){
          const key=(m[1]+'|'+m[2]).toLowerCase().replace(/\\s+/g,' ');
          lines.set(key,m[1].trim()+' '+m[3]+'-'+m[4]+' '+m[2].trim());
        }
      }
    }
    answer=Array.from(lines.values()).slice(0,20).map(x=>'- '+x).join('\\n');
    if(!answer)answer=results.filter(x=>resultStrength(x)>=6).slice(0,12).map(x=>evidenceText(x).slice(0,650)).filter(Boolean).join('\\n\\n');
  }else if(sports&&opponent){
    answer=extractOpponentAnswer(q,results)||'';
  }else if(sports&&finalResult){
    answer=results.filter(x=>resultStrength(x)>=6).slice(0,5).map(x=>evidenceText(x).slice(0,850)).filter(Boolean).join('\\n\\n');
  }else if(newsFact){
    answer=extractNewsFactAnswer(q,results)||'';
  }else{
    answer=results.slice(0,social?3:(news?5:2)).map(x=>evidenceText(x).slice(0,900)).filter(Boolean).join('\\n\\n').trim();
  }
  if(!answer)throw new Error('EXA_SEARCH_EMPTY: Exa returned no usable live-search evidence.');
  return {answer,citations};
}
`;
write('server/exaSearch.ts',prefix+fn);

let engine=read('src/services/aiEngine.ts');
engine=engine.replace(/const patterns=\[[^;]+\];return patterns\.some\(p=>p\.test\(lower\)\);/,`const patterns=[/\\bwaziri mkuu\\b/,/\\brais wa\\b/,/\\bmakamu wa rais\\b/,/\\bkiongozi wa sasa\\b/,/\\bmkuu wa nchi\\b/,/\\bmkuu wa serikali\\b/,/\\bmeya wa\\b/,/\\bnaibu\\s+waziri\\b/,/\\bwaziri wa\\b/,/\\bserikali ya sasa\\b/,/\\bcurrent\\b/,/\\blatest\\b/,/\\bsasa\\b/,/\\bwa sasa\\b/,/\\bleo\\b/,/\\bhivi punde\\b/,/\\bhabari mpya\\b/,/\\bhabari za leo\\b/,/\\bbei ya\\b/,/\\bthamani ya\\b/,/\\bexchange rate\\b/,/\\brate ya\\b/,/\\bmatokeo ya\\b/,/\\bratiba ya\\b/,/\\bmsimamo wa\\b/,/\\bnani ameshinda\\b/,/\\bnani kashinda\\b/,/\\bwho is\\b/,/\\bwho won\\b/,/\\btoday\\b/,/\\btonight\\b/,/\\bthis week\\b/,/\\bthis month\\b/,/\\b2025\\b/,/\\b2026\\b/,/\\binstagram\\b/,/\\bfacebook\\b/,/\\btiktok\\b/,/\\byoutube\\b/,/\\btwitter\\b/,/\\bx\\.com\\b/,/\\bsocial media\\b/,/\\bpost ya\\b/,/\\btweet\\b/,/\\breel\\b/,/\\bstory\\b/,/\\bofficial post\\b/];return patterns.some(p=>p.test(lower));`);
write('src/services/aiEngine.ts',engine);
console.log('[MKUU-EXA-ALL] Rebuilt Exa live search function safely; all-results and social routing hardened.');
