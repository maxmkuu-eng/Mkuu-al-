const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'exaSearch.ts');
let source = fs.readFileSync(file, 'utf8');

const start = source.indexOf('function extractOpponentAnswer(');
const end = source.indexOf('\n\nexport async function searchWithExa', start);
if (start === -1 || end === -1) {
  console.log('MKUU: sports opponent/time function target missing; preserving current implementation.');
  process.exit(0);
}

const replacement = String.raw`function extractOpponentAnswer(query:string,results:any[]){
  const q=String(query);
  const teamMatch=q.match(/\b(simba(?: sc)?|yanga(?: sc)?|young africans|azam(?: fc)?|coastal union(?: fc)?)\b/i);
  const team=teamMatch?.[1];
  if(!team)return null;
  const aliases:Record<string,string>={yanga:'young africans','yanga sc':'young africans','young africans':'young africans',simba:'simba','simba sc':'simba',azam:'azam','azam fc':'azam','coastal union':'coastal union','coastal union fc':'coastal union'};
  const canonical=aliases[team.toLowerCase()]||team;
  const tr=canonical.replace(/\s+/g,'\\s+');
  const a=new RegExp(tr+'\\s*(?:sc|fc)?\\s*(?:vs\\.?|v\\.?|versus|[-–—])\\s*([^|\\-–—,]+)','i');
  const b=new RegExp('([^|\\-–—,]+)\\s*(?:vs\\.?|v\\.?|versus|[-–—])\\s*'+tr+'\\s*(?:sc|fc)?','i');
  const future=/\b(kesho|tomorrow|will play|will face|anacheza|tutacheza|itaikabili|leo|today)\b/i.test(q);

  function tanzaniaKickoff(text:string){
    const s=String(text||'');
    const patterns=[
      {re:/(\b\d{1,2}:\d{2})\s*(?:UTC|GMT)\b/i, offset:3},
      {re:/(\b\d{1,2}:\d{2})\s*(?:EAT|UTC\+?3)\b/i, offset:0},
      {re:/(\b\d{1,2}:\d{2})\s*(?:CET)\b/i, offset:2},
      {re:/(\b\d{1,2}:\d{2})\s*(?:CEST)\b/i, offset:1},
      {re:/(\b\d{1,2}:\d{2})\s*(?:BST)\b/i, offset:2},
      {re:/(\b\d{1,2}:\d{2})\s*(?:CAT)\b/i, offset:1}
    ];
    for(const p of patterns){
      const m=s.match(p.re); if(!m)continue;
      const [hh,mm]=m[1].split(':').map(Number); const total=(hh*60+mm+p.offset*60+1440)%1440;
      return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')+' EAT';
    }
    return null;
  }

  for(const item of results){
    const h=(String(item?.title||'')+' '+(item?.highlights?.join?.(' ')||'')+' '+String(item?.summary||'')+' '+String(item?.text||''));
    const m=h.match(a)||h.match(b);
    let opp=(m?.[1]||'').replace(/\s*(live score|live result|result|score|today|leo|tonight|scheduled|kick[- ]?off).*$/i,'').trim();
    if(!opp){
      const title=String(item?.title||'');
      const direct=title.match(/(?:Young Africans|Yanga(?: SC)?)\s+(?:vs\.?|v\.?|versus)\s+(.+)/i);
      if(direct)opp=direct[1].replace(/\s*(?:[-|:].*)$/,'').trim();
    }
    const kickoff=tanzaniaKickoff(h);
    if(opp && opp.length<80){
      const day=/\b(jana|yesterday)\b/i.test(q)?'Jana':/\b(juzi)\b/i.test(q)?'Juzi':/\b(kesho|tomorrow)\b/i.test(q)?'Kesho':'Leo';
      return `${day} ${team.replace(/\b\w/g,c=>c.toUpperCase())} ${future?'anacheza':'alicheza'} na ${opp}${kickoff?' saa '+kickoff:''}.`;
    }
  }
  return null;
}`;

source = source.slice(0,start) + replacement + source.slice(end);
fs.writeFileSync(file, source);
console.log('MKUU: Sports fixture timezone conversion fixed; UTC/other source times are normalized to Tanzania EAT.');
