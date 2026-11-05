import { validateResume } from "./validate.mjs";

// Letter-size, one-column, selectable-text PDF. No dependency on OCR/extraction.
const PAGE_W=612,PAGE_H=792,LEFT=54,TOP=744,BOTTOM=54,CONTENT=504;
function encode(value) {
  let out="";
  // Preserve ATS-readable text using WinAnsi-compatible punctuation. PDF's
  // built-in Helvetica fonts cannot represent arbitrary Unicode code points.
  const mapped=String(value??"")
    .replace(/[‐‑‒–—−]/g,"-")
    .replace(/[‘’]/g,"'")
    .replace(/[“”]/g,'"')
    .replace(/…/g,"...")
    .replace(/[●•◦▪■◆♦►▸‣⁃]/g,"-")
    .replace(/[✓✔☑]/g,"[x]")
    .replace(/[✗✘☒]/g,"[ ]")
    .replace(/\u00a0/g," ");
  for(const ch of mapped) {
    const n=ch.codePointAt(0);
    if(n===9){out+=" ";continue;}
    if((n>=32&&n<=126)||(n>=160&&n<=255))out+=String.fromCharCode(n);
    else throw new Error("PDF cannot encode character "+JSON.stringify(ch)+" with built-in Latin font; Unicode fonts are required.");
  }
  return out.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
}
function approximateWidth(s,size){
  let width=0;
  for(const ch of s)width+=ch===" "?278:"ilI.,:;!|'".includes(ch)?230:"MW@%".includes(ch)?870:"ftjr".includes(ch)?335:/[A-Z]/.test(ch)?700:/[0-9]/.test(ch)?557:560;
  return width*size/1000;
}
function wrap(text,size,maxWidth){
  const lines=[];
  for(const row of String(text??"").split(/\r?\n/)) {
    let active="";
    for(let word of row.trim().split(/\s+/).filter(Boolean)){
      const combined=active?active+" "+word:word;
      if(approximateWidth(combined,size)<=maxWidth){active=combined;continue;}
      if(active)lines.push(active);
      while(word&&approximateWidth(word,size)>maxWidth){
        let i=1;while(i<word.length&&approximateWidth(word.slice(0,i+1),size)<=maxWidth)i++;
        lines.push(word.slice(0,i));word=word.slice(i);
      }
      active=word;
    }
    if(active)lines.push(active);
  }
  return lines;
}
function date(value){
  if(!value)return "";
  if(/^\d{4}$/.test(value))return value;
  const [y,m]=value.split("-");return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1]+" "+y;
}
function when(e){return [date(e.startDate),e.isCurrent?"Present":date(e.endDate)].filter(Boolean).join(" - ");}
function recent(items){return [...items].sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""));}

export function renderResumePdf(input){
  const profile=validateResume(input),pages=[];let y=TOP,commands=[];
  function nextPage(){if(commands.length)pages.push(commands.join("\n")+"\n");commands=[];y=TOP;}
  function reserve(height){if(y-height<BOTTOM)nextPage();}
  function line(str,options={}){
    const size=options.size||10,step=options.step||14,indent=options.indent||0;
    reserve(step);
    commands.push("BT /"+(options.bold?"F2":"F1")+" "+size+" Tf 1 0 0 1 "+(LEFT+indent)+" "+y.toFixed(1)+" Tm ("+encode(str)+") Tj ET");
    y-=step;
  }
  function para(str,options={}){
    for(const item of wrap(str,options.size||10,CONTENT-(options.indent||0)))line(item,options);
  }
  function heading(str){
    reserve(35);y-=12;line(str.toUpperCase(),{size:10.5,bold:true,step:17});
    commands.push("0.55 w "+LEFT+" "+(y+5)+" m "+(PAGE_W-LEFT)+" "+(y+5)+" l S");y-=6;
  }
  function bullet(str){
    const text=String(str).replace(/^[\s•*-]+/,"").trim();
    if(text)para("- "+text,{indent:11,step:13});
  }
  function job(title,meta,period,description){
    reserve(46);para(title,{size:10.5,bold:true,step:15});
    if(meta)para(meta,{size:9.5,step:13});
    if(period)para(period,{size:9.5,step:13});
    if(description)for(const part of String(description).split(/\r?\n/))bullet(part);
    y-=8;
  }
  const c=profile.contact,name=[c.firstName,c.lastName].filter(Boolean).join(" ").trim();
  if(name)para(name,{size:17,bold:true,step:23});
  const info=[c.location,c.phone,c.email].filter(Boolean).join("  |  ");
  if(info)para(info,{size:9.5,step:13});
  const links=[c.linkedIn,c.github,c.website].filter(Boolean).join("  |  ");
  if(links)para(links,{size:9,step:13});
  if(profile.summary.trim()){heading("Professional Summary");para(profile.summary);}
  if(profile.experience.length){
    heading("Work Experience");
    for(const e of recent(profile.experience))
      job(e.jobTitle,[e.company,e.location].filter(Boolean).join("  |  "),when(e),e.description);
  }
  if(profile.skills.length){heading("Skills");para(profile.skills.join(", "));}
  if(profile.education.length){
    heading("Education");
    for(const e of recent(profile.education))
      job(e.institution,[e.degree,e.fieldOfStudy,e.location].filter(Boolean).join("  |  "),when(e),e.description);
  }
  if(profile.projects.length){
    heading("Projects");
    for(const e of profile.projects)job(e.name,e.url,e.technologies.join(", "),e.description);
  }
  if(profile.certifications.length){
    heading("Certifications");
    for(const e of profile.certifications)job(e.name,[e.issuer,date(e.issuedDate)].filter(Boolean).join("  |  "),[e.credentialId,e.url].filter(Boolean).join("  |  "),"");
  }
  if(profile.languages.length){heading("Languages");para(profile.languages.join(", "));}
  if(profile.awards.length){heading("Awards");for(const e of profile.awards)bullet(e);}
  nextPage();if(!pages.length)pages.push("");

  const obj=new Map([[1,"<< /Type /Catalog /Pages 2 0 R >>"],[3,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"],[4,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"]]),kids=[];
  for(const [i,stream] of pages.entries()){
    const sid=5+i*2,pid=sid+1;kids.push(pid+" 0 R");
    obj.set(sid,"<< /Length "+stream.length+" >>\nstream\n"+stream+"endstream");
    obj.set(pid,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+PAGE_W+" "+PAGE_H+"] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+sid+" 0 R >>");
  }
  obj.set(2,"<< /Type /Pages /Kids ["+kids.join(" ")+"] /Count "+pages.length+" >>");
  let pdf="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";const offsets=[0],count=4+pages.length*2;
  for(let id=1;id<=count;id++){offsets[id]=pdf.length;pdf+=id+" 0 obj\n"+obj.get(id)+"\nendobj\n";}
  const xref=pdf.length;
  pdf+="xref\n0 "+(count+1)+"\n0000000000 65535 f \n";
  for(let id=1;id<=count;id++)pdf+=String(offsets[id]).padStart(10,"0")+" 00000 n \n";
  pdf+="trailer\n<< /Size "+(count+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";
  return Uint8Array.from(pdf,c=>c.charCodeAt(0));
}
