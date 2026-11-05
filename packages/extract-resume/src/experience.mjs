// Local, conservative resume work-history extraction; no invented employment entries.
const BEGIN=/^(?:professional experience|work experience|employment history|work history|relevant experience|experience)$/i;
const END=/^(?:education|skills|technical skills|projects|certifications|awards|summary|profile|languages|publications|volunteering)$/i;
const MONTHS=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const D="(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4}[-/]\\d{1,2}|\\d{4}";
const RANGE=new RegExp("("+D+")\\s*(?:–|—|\\bto\\b|\\s-\\s)\\s*(Present|Current|Now|Ongoing|"+D+")\\b","i");
const TITLE=/\b(?:engineer|developer|manager|director|analyst|consultant|architect|designer|lead|specialist|intern|researcher|scientist|administrator|coordinator|technician|founder|owner|executive|product|sales|operations|support|programmer|devops|sre|qa)\b/i;
const COMPANY=/\b(?:inc\.?|llc|ltd\.?|corp\.?|company|technologies|technology|solutions|systems|group|labs|bank|university|software|consulting)\b/i;
const BULLET=/^(?:[-*•▪◦‣]|\d+[.)])\s*/;
function date(value){
  if(/^(?:present|current|now|ongoing)$/i.test(value))return null;
  const m=value.replace(/\./g,"").trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if(m){const n=MONTHS.findIndex(x=>m[1].toLowerCase().startsWith(x));return n<0?null:m[2]+"-"+String(n+1).padStart(2,"0");}
  const a=value.match(/^(\d{4})[-/](\d{1,2})$/),b=value.match(/^(\d{1,2})\/(\d{4})$/);
  if(a)return +a[2]>=1&&+a[2]<=12?a[1]+"-"+a[2].padStart(2,"0"):null;
  if(b)return +b[1]>=1&&+b[1]<=12?b[2]+"-"+b[1].padStart(2,"0"):null;
  return /^\d{4}$/.test(value)?value:null;
}
function clean(s){return s.replace(/^[\s|,:;–—-]+|[\s|,:;–—-]+$/g,"").trim();}
function header(s){return !!s&&s.length<100&&!BULLET.test(s)&&!/[.!?]$/.test(s)&&!/@|https?:/i.test(s)&&!END.test(s);}
function identity(lines){
  const p=lines.flatMap(x=>x.split(/\s+[|•]\s+/)).map(clean).filter(Boolean);
  let company="",jobTitle="",location="";
  if(p.length===1){const m=p[0].match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);if(!m)return null;jobTitle=m[1];company=m[2];}
  else if(p.length>=2){
    const t=p.findIndex(x=>TITLE.test(x));
    jobTitle=p[t<0?1:t];
    const c=p.findIndex((x,i)=>i!==t&&COMPANY.test(x));
    company=p[c>=0?c:p.findIndex((_,i)=>i!==t)];
    location=p.find(x=>x!==company&&x!==jobTitle)||"";
  }
  return company&&jobTitle&&company!==jobTitle&&header(company)&&header(jobTitle)?{company,jobTitle,location}:null;
}
export function extractEmploymentHistory(text){
  if(typeof text!=="string")return [];
  const all=text.split(/\r?\n/).map(x=>x.trim());
  const start=all.findIndex(x=>BEGIN.test(x.replace(/[:：]$/,"")));
  if(start<0)return [];
  const lines=[];
  for(const line of all.slice(start+1)){if(END.test(line.replace(/[:：]$/,"")))break;lines.push(line);}
  const jobs=[];
  for(let i=0;i<lines.length;i++){
    const m=RANGE.exec(lines[i]);if(!m)continue;
    const startDate=date(m[1]),isCurrent=/^(?:present|current|now|ongoing)$/i.test(m[2]),endDate=isCurrent?null:date(m[2]);
    if(!startDate||(!isCurrent&&!endDate))continue;
    const prefix=clean(lines[i].slice(0,m.index)),parts=prefix?[prefix]:[];
    let begin=i;
    for(let k=i-1;k>=Math.max(0,i-3)&&parts.length<2&&!/\s+[|•]\s+|\s+(?:at|@)\s+/i.test(prefix);k--){
      if(!lines[k]){if(parts.length)break;else continue;}
      if(!header(lines[k])||RANGE.test(lines[k]))break;
      parts.unshift(lines[k]);begin=k;
    }
    const id=identity(parts);if(id)jobs.push({...id,startDate,endDate,isCurrent,begin,end:i});
  }
  return jobs.slice(0,40).map((j,n)=>({
    company:j.company,jobTitle:j.jobTitle,location:j.location,startDate:j.startDate,endDate:j.endDate,isCurrent:j.isCurrent,
    description:lines.slice(j.end+1,n+1<jobs.length?jobs[n+1].begin:lines.length).map(x=>x.replace(BULLET,"").trim()).filter(Boolean).join("\n").slice(0,4000)
  }));
}
