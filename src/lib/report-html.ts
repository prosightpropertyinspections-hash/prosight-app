import type { Report } from "@/lib/types";
import { getTheme } from "@/lib/themes";
import { buildModel, GRADE_DESC, coverImage } from "@/lib/report-model";

function esc(s:any){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c] as string)); }
function fmtDate(iso:string|null){ if(!iso)return "—"; return new Date(iso+"T00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); }

// Builds a complete, self-contained HTML document for WeasyPrint.
export function buildReportHtml(report:Report, urls:Record<string,string>, origin:string){
  const t = getTheme(report.theme);
  const M = buildModel(report);
  const cover = coverImage(report, urls, M.allF);
  const reportNo = report.report_no || `PSPI-${(report.id||"").slice(0,8).toUpperCase()}`;
  const logo = `${origin}/logo.png`;
  const logoDark = `${origin}/logo-ondark.png`;
  const darkCover = ["obsidian","noir","aurora","prestige","blueprint","warrant","vanguard","terra"].includes(t.coverStyle) || t.coverBg !== "#ffffff";

  const sev = (s:string)=> t.sev[s as keyof typeof t.sev] || t.sev.monitor;

  const page = (inner:string, extraStyle="") =>
    `<div class="page" style="background:${t.pageBg};color:${t.ink};${extraStyle}">${inner}<div class="foot"><span>PROSIGHT PROPERTY INSPECTIONS · ${esc(reportNo)}</span><img src="${t.pageBg==='#0e0f12'?logoDark:logo}" style="height:36px"/></div></div>`;

  // COVER (simplified but themed: color, font, logo, hero, stats)
  const coverInner = `
    <div style="min-height:9.4in;display:flex;flex-direction:column;${cover&&t.coverStyle==='aurora'?`background:linear-gradient(180deg,rgba(11,13,24,.35),rgba(11,13,24,.92)),url('${cover}');background-size:cover;background-position:center;`:''}">
      <div style="padding:${t.coverStyle==='aurora'?'54px':'0'} 0;">
        <img src="${darkCover?logoDark:logo}" style="height:70px;margin-bottom:30px"/>
        <div style="font-size:12px;letter-spacing:4px;color:${t.coverAccent};text-transform:uppercase;margin-bottom:14px">Confidential Inspection Report</div>
        <div style="font-family:${t.displayFont};font-size:44px;font-weight:700;line-height:1.05;letter-spacing:-1px;margin-bottom:26px">${esc(report.address||"Property address")}</div>
        ${cover&&t.coverStyle!=='aurora'?`<img src="${cover}" style="width:100%;height:300px;object-fit:cover;border-radius:${t.radius}px;margin-bottom:26px"/>`:''}
      </div>
      <div style="margin-top:auto;display:flex;gap:14px;margin-bottom:24px">
        ${[["Systems",M.withF.length,t.coverInk],["Priority",M.cP,sev('priority').c],["Grade",M.overall,t.gradeColor[M.overall]]].map(x=>
          `<div style="flex:1;border:1px solid ${darkCover?'rgba(255,255,255,.2)':t.hair};border-radius:${t.radius}px;padding:16px;text-align:center">
            <div style="font-family:${t.displayFont};font-size:26px;font-weight:800;color:${x[2]}">${x[1]}</div>
            <div style="font-size:9px;letter-spacing:1px;color:${darkCover?'#9fb4c9':t.sub};text-transform:uppercase;margin-top:2px">${x[0]}</div>
          </div>`).join("")}
      </div>
      <div style="padding-top:20px;border-top:1px solid ${darkCover?'rgba(255,255,255,.15)':t.hair}">
        <div style="font-size:10px;letter-spacing:2px;color:${t.coverAccent};text-transform:uppercase">Prepared exclusively for</div>
        <div style="font-family:${t.displayFont};font-size:22px;font-weight:600;margin-top:2px">${esc(report.client||"—")}</div>
        <div style="font-size:12px;color:${darkCover?'#c9d6e4':t.sub};margin-top:10px">${fmtDate(report.inspection_date)} · Inspector ${esc(report.inspector||"—")} · ${esc(reportNo)}</div>
      </div>
    </div>`;
  const coverPage = `<div class="page cover" style="background:${t.coverBg};color:${t.coverInk};padding:54px">${coverInner}</div>`;

  // GRADE PAGE
  const gradeInner = `
    <div class="sec-title" style="font-family:${t.displayFont};border-left:3px solid ${t.accent}">Overall Property Condition</div>
    <div class="sec-sub">Summary grade of the systems evaluated</div>
    <div style="display:flex;gap:24px;align-items:center;margin:14px 0 24px">
      <div style="width:120px;height:120px;border-radius:50%;background:${t.gradeColor[M.overall]};color:#fff;display:flex;align-items:center;justify-content:center;font-family:${t.displayFont};font-size:56px;font-weight:700;flex-shrink:0">${M.overall}</div>
      <div><div style="font-family:${t.displayFont};font-size:22px;font-weight:700;margin-bottom:6px">${GRADE_DESC[M.overall]}</div>
      <div style="font-size:12.5px;color:${t.sub};line-height:1.7">This grade reflects the combined condition of all ${M.withF.length} systems evaluated. ${M.cP>0?`It is held back by ${M.cP} priority item${M.cP>1?"s":""} warranting attention from qualified specialists.`:"No priority items were identified."}</div></div>
    </div>
    <div style="font-family:${t.displayFont};font-size:15px;font-weight:700;margin-bottom:10px">Condition Grade by System</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>${["System / Area","Priority","Monitor","Grade"].map((h,i)=>`<th style="border-bottom:2px solid ${t.ink};font-size:9.5px;letter-spacing:1px;text-transform:uppercase;text-align:${i===0?'left':i===3?'right':'center'};padding:8px 10px">${h}</th>`).join("")}</tr></thead>
      <tbody>${M.graded.map(g=>`<tr>
        <td style="padding:9px 10px;border-bottom:1px solid ${t.hair};font-size:11px;font-weight:600">${esc(g.section.name)}</td>
        <td style="padding:9px 10px;border-bottom:1px solid ${t.hair};font-size:11px;text-align:center;color:${g.counts.priority?sev('priority').c:t.sub}">${g.counts.priority||"—"}</td>
        <td style="padding:9px 10px;border-bottom:1px solid ${t.hair};font-size:11px;text-align:center;color:${g.counts.monitor?sev('monitor').c:t.sub}">${g.counts.monitor||"—"}</td>
        <td style="padding:9px 10px;border-bottom:1px solid ${t.hair};text-align:right"><span style="font-size:10px;font-weight:700;color:${t.gradeColor[g.grade]}">${g.grade}</span></td>
      </tr>`).join("")}</tbody>
    </table>`;

  // ABOUT PAGE
  const aboutInner = `
    <div class="sec-title" style="font-family:${t.displayFont};border-left:3px solid ${t.accent}">About This Inspection</div>
    <div class="sec-sub">Standards of practice & our commitment to you</div>
    <div style="background:${t.pageBg==='#0e0f12'?'#15171b':'#f6f5f1'};border-radius:${t.radius}px;padding:20px;margin:12px 0 18px">
      <div style="font-family:${t.displayFont};font-size:16px;font-weight:700;margin-bottom:8px">Welcome, ${esc(report.client||"valued client")}.</div>
      <div style="font-size:11.5px;color:${t.sub};line-height:1.75">Thank you for choosing ProSight Property Inspections — a locally owned, InterNACHI-certified inspection company based in Dearborn Heights, Michigan. This report presents a thorough, unbiased evaluation of the readily accessible systems and components of your property at ${esc(report.address||"the inspected address")}.</div>
    </div>
    <div style="font-family:${t.displayFont};font-size:14px;font-weight:700;color:${t.accent};margin-bottom:5px">Performed to InterNACHI Standards of Practice</div>
    <div style="font-size:11.5px;color:${t.sub};line-height:1.7;margin-bottom:16px">This inspection was performed in general accordance with the Standards of Practice of the International Association of Certified Home Inspectors (InterNACHI). Our inspector is InterNACHI-certified (InterNACHI ID NACHI26020705) and bound by its Code of Ethics.</div>
    <div style="font-family:${t.displayFont};font-size:14px;font-weight:700;color:${t.accent};margin-bottom:5px">Our Commitment to You</div>
    <div style="font-size:11.5px;color:${t.sub};line-height:1.7">We inspect every property as if it were our own — with diligence, integrity, and a genuine commitment to your safety and peace of mind. Findings are reported factually, and where a condition warrants a licensed specialist, we say so plainly.</div>`;

  // EXEC PAGE
  const execInner = `
    <div class="sec-title" style="font-family:${t.displayFont};border-left:3px solid ${t.accent}">Executive Summary</div>
    <div class="sec-sub">Most significant findings from the inspection of ${esc(report.address)}</div>
    <div style="display:flex;gap:12px;margin:14px 0 20px">
      ${[["Priority / Safety",M.cP,sev('priority')],["Monitor / Maintain",M.cM,sev('monitor')],["Satisfactory",M.cS,sev('satisfactory')]].map((x:any)=>
        `<div style="flex:1;border-radius:${t.radius}px;padding:16px;text-align:center;background:${x[2].bg}"><div style="font-family:${t.displayFont};font-size:24px;font-weight:800;color:${x[2].c}">${x[1]}</div><div style="font-size:8.5px;letter-spacing:1px;text-transform:uppercase;color:${t.sub}">${x[0]}</div></div>`).join("")}
    </div>
    ${M.priority.length?`<div style="font-family:${t.displayFont};font-size:15px;font-weight:700;margin-bottom:10px">Priority Findings</div>`:""}
    ${M.priority.map(x=>`<div style="border-left:4px solid ${sev('priority').c};background:${sev('priority').bg};border-radius:${t.radius}px;padding:12px 14px;margin-bottom:10px">
      <div style="font-size:9px;letter-spacing:1px;color:${sev('priority').c};font-weight:700;text-transform:uppercase">${esc(x.area)}</div>
      <div style="font-family:${t.displayFont};font-size:13px;font-weight:700;margin:2px 0">${esc(x.f.title||"Priority item")}</div>
      <div style="font-size:11px;color:${t.sub};line-height:1.6">${esc(x.f.ai_text||x.f.note)}</div></div>`).join("")}
    ${!M.priority.length&&!M.monitor.length?`<div style="font-size:12px;color:${t.sub}">No priority or maintenance items identified.</div>`:""}`;

  // SECTION PAGES
  const sectionPages = M.withF.map((s:any,i:number)=>{
    const g = M.graded.find((x:any)=>x.section.id===s.id)!;
    const findings = (s.findings||[]).map((f:any)=>{
      const m=sev(f.severity); const purl=f.photo_path?urls[f.photo_path]:null;
      return `<div style="border:1px solid ${t.hair};border-left:4px solid ${m.c};border-radius:${t.radius}px;padding:13px 15px;margin-bottom:11px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-family:${t.displayFont};font-size:14px;font-weight:700">${esc(f.title||"Observation")}</div>
          <span style="font-size:9px;font-weight:700;padding:3px 9px;border-radius:${t.radius}px;color:${m.c};background:${m.bg}">${esc(String(f.severity).toUpperCase())}</span>
        </div>
        <div style="font-size:11.5px;color:${t.sub};line-height:1.6">${esc(f.ai_text||f.note)}</div>
        ${purl?`<img src="${purl}" style="width:100%;max-height:240px;object-fit:cover;border-radius:${t.radius}px;margin-top:11px"/>`:""}
      </div>`;
    }).join("");
    const inner = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid ${t.hair}">
        <div style="font-family:${t.displayFont};font-size:32px;font-weight:700;color:${t.accent}">${String(i+1).padStart(2,"0")}</div>
        <div style="flex:1"><div style="font-family:${t.displayFont};font-size:20px;font-weight:700">${esc(s.name)}</div><div style="font-size:9px;letter-spacing:1.5px;color:${t.sub};text-transform:uppercase">${esc(s.subtitle||s.grp)}</div></div>
        <span style="font-family:${t.displayFont};font-size:20px;font-weight:700;color:${t.gradeColor[g.grade]};border:1.5px solid ${t.gradeColor[g.grade]};border-radius:${t.radius}px;padding:3px 12px">${g.grade}</span>
      </div>${findings}`;
    return page(inner);
  }).join("");

  // SCOPE PAGE
  const scopeInner = `
    <div class="sec-title" style="font-family:${t.displayFont};border-left:3px solid ${t.accent}">Scope & Limitations</div>
    <div class="sec-sub">Standards of practice and report terms</div>
    <div style="background:${t.pageBg==='#0e0f12'?'#15171b':'#f6f5f1'};border-radius:${t.radius}px;padding:20px;margin:12px 0 20px">
      <p style="font-size:11.5px;color:${t.sub};line-height:1.7;margin:0 0 12px">This report reflects a visual, non-invasive inspection of the readily accessible systems and components of the property on the date noted, performed in general accordance with the InterNACHI Standards of Practice. It is not a code-compliance inspection, a warranty, or a guarantee against future failure. Conditions concealed behind finishes, beneath floor coverings, within walls, or otherwise not visible at the time of inspection are excluded.</p>
      <p style="font-size:11.5px;color:${t.sub};line-height:1.7;margin:0">The inspector assumes no liability for repairs performed by others or for conditions arising after the inspection date. This report is prepared solely for the named client and may not be relied upon by any other party.</p>
    </div>
    <div style="display:flex;gap:40px;margin-top:28px;font-size:11.5px">
      <div style="flex:1;border-top:1px solid ${t.ink};padding-top:8px">Inspector — ${esc(report.inspector||"—")}, Certified Property Inspector · InterNACHI ID ${esc(report.nachi_id||"NACHI26020705")}</div>
      <div style="flex:1;border-top:1px solid ${t.ink};padding-top:8px">Date — ${fmtDate(report.inspection_date)}</div>
    </div>
    <div style="text-align:center;margin-top:32px;padding-top:22px;border-top:1px solid ${t.hair}">
      <div style="font-family:${t.displayFont};font-size:17px;font-weight:700;color:${t.accent}">Thank you for choosing ProSight Property Inspections</div>
      <div style="font-size:11px;color:${t.sub};margin-top:5px">AdjusterFlow L.L.C. · Dearborn Heights, MI · Reference ${esc(reportNo)}</div>
    </div>`;

  const fontImports = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Libre+Baskerville:wght@400;700&family=Archivo:wght@600;700;800&family=Fraunces:wght@500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    ${fontImports}
    @page { size: letter; margin: 0; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:${t.bodyFont}; color:${t.ink}; }
    .page { width:8.5in; min-height:11in; padding:46px 54px 70px; position:relative; page-break-after:always; }
    .page:last-child { page-break-after:auto; }
    .sec-title { font-size:22px; font-weight:700; padding-left:12px; }
    .sec-sub { font-size:12px; color:${t.sub}; margin-left:15px; margin-top:3px; margin-bottom:8px; }
    .foot { position:absolute; bottom:26px; left:54px; right:54px; display:flex; justify-content:space-between; align-items:center; font-size:8.5px; color:${t.sub}; border-top:1px solid ${t.hair}; padding-top:8px; }
    table { page-break-inside:auto; }
    tr { page-break-inside:avoid; }
    img { -webkit-print-color-adjust:exact; }
  </style></head><body>
    ${coverPage}
    ${page(aboutInner)}
    ${page(gradeInner)}
    ${page(execInner)}
    ${sectionPages}
    ${page(scopeInner)}
  </body></html>`;
}
