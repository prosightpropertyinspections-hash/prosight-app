"use client";
import type { Report } from "@/lib/types";
import { buildModel, GRADE_DESC, coverImage } from "@/lib/report-model";
import { getTheme, THEME_FONT_HREF, ThemeTokens } from "@/lib/themes";

function fmtDate(iso:string|null){ if(!iso)return "—"; return new Date(iso+"T00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); }

function Logo({ dark, height=48 }:{ dark?:boolean; height?:number }){
  // Real ProSight logo. White version on dark backgrounds, full-color on light — no plate/box.
  return <img src={dark?"/logo-ondark.svg":"/logo.svg"} alt="ProSight Property Inspections" style={{height,display:"block",width:"auto"}}/>;
}

export default function ReportView({ report, urls, themeId }:{ report:Report; urls:Record<string,string>; themeId?:string|null; }){
  const t = getTheme(themeId);
  const M = buildModel(report);
  const cover = coverImage(report, urls, M.allF);
  const reportNo = report.report_no || `PSPI-${(report.id||"").slice(0,8).toUpperCase()}`;

  const pageBase:React.CSSProperties = {
    position:"relative", width:"8.5in", minHeight:"11in", margin:"0 auto 16px",
    background:t.pageBg, color:t.ink, padding:"46px 54px 64px",
    fontFamily:t.bodyFont,
  };

  return (
    <div>
      <link href={THEME_FONT_HREF} rel="stylesheet" />
      <style>{`
        @page { size: letter; margin: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing:border-box; }
        html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .rv-page{ box-shadow:0 2px 16px rgba(0,0,0,.14); box-sizing:border-box; min-height:11in; }
        @media print {
          .noprint{ display:none !important; }
          .rv-page{ box-shadow:none !important; margin:0 !important; page-break-after:always; }
          .rv-page:last-child{ page-break-after:auto; }
        }
        .rv-foot{ position:absolute; bottom:26px; left:54px; right:54px; display:flex; justify-content:space-between; font-size:8.5px; }
      `}</style>

      {t.coverStyle==="monograph" && <MonographCover t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="obsidian"  && <ObsidianCover  t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="warrant"   && <WarrantCover   t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="vanguard"  && <VanguardCover  t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="terra"     && <TerraCover     t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="noir"      && <NoirCover      t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="aurora"    && <AuroraCover    t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="prestige"  && <PrestigeCover  t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}
      {t.coverStyle==="blueprint" && <BlueprintCover t={t} report={report} cover={cover} M={M} reportNo={reportNo}/>}

      <AboutPage t={t} report={report} pageBase={pageBase} reportNo={reportNo} pageNo={2}/>
      <GradePage t={t} report={report} M={M} pageBase={pageBase} reportNo={reportNo} pageNo={3}/>
      <ExecPage  t={t} report={report} M={M} pageBase={pageBase} reportNo={reportNo} pageNo={4}/>

      {M.withF.map((s:any,i:number)=>{
        const g=M.graded.find((x:any)=>x.section.id===s.id);
        return <SectionPage key={s.id} t={t} s={s} g={g} idx={i} urls={urls} pageBase={pageBase} reportNo={reportNo} address={report.address} pageNo={5+i}/>;
      })}

      <ScopePage t={t} report={report} pageBase={pageBase} reportNo={reportNo} pageNo={5+M.withF.length}/>
    </div>
  );
}

function Foot({t,reportNo,address,p}:{t:ThemeTokens;reportNo:string;address:string;p:number}){
  const onDark = t.pageBg==="#0e0f12";
  return <div className="rv-foot" style={{color:t.sub,borderTop:`1px solid ${t.hair}`,paddingTop:8,alignItems:"center"}}>
    <span style={{fontSize:8.5}}>PROSIGHT PROPERTY INSPECTIONS · {reportNo} · {address} · Page {p}</span>
    <img src={onDark?"/logo-ondark.svg":"/logo.svg"} alt="" style={{height:54,width:"auto",opacity:.9}}/>
  </div>;
}

/* ---------------- COVERS ---------------- */

function MonographCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:"0"}}>
      <div style={{padding:"64px 64px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderBottom:`1px solid ${t.accent}`,paddingBottom:18}}>
          <Logo height={160}/>
          <div style={{fontSize:10,letterSpacing:2,color:t.sub}}>{reportNo}</div>
        </div>
      </div>
      <div style={{padding:"48px 64px 0"}}>
        <div style={{fontFamily:t.bodyFont,fontSize:11,letterSpacing:4,color:t.accent,textTransform:"uppercase",marginBottom:20}}>Confidential Property Inspection</div>
        <div style={{fontFamily:t.displayFont,fontSize:52,lineHeight:1.05,fontWeight:600,letterSpacing:"-.5px",maxWidth:"9in"}}>{report.address||"Property address"}</div>
      </div>
      {cover && <div style={{margin:"40px 64px 0"}}><img src={cover} style={{width:"100%",height:340,objectFit:"cover"}}/></div>}
      <div style={{padding:"36px 64px",display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:10,letterSpacing:2,color:t.sub,textTransform:"uppercase"}}>Prepared for</div>
          <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:600,marginTop:2}}>{report.client||"—"}</div>
          <div style={{fontSize:12,color:t.sub,marginTop:10}}>{fmtDate(report.inspection_date)} · Inspector {report.inspector||"—"}</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{width:96,height:96,borderRadius:"50%",border:`2px solid ${t.accent}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:t.displayFont,fontSize:40,fontWeight:600,color:t.gradeColor[M.overall]}}>{M.overall}</div>
            <div style={{fontSize:7.5,letterSpacing:1.5,color:t.sub,textTransform:"uppercase"}}>Overall</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ObsidianCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:"54px 54px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:44}}>
        <Logo dark height={144}/>
        <div style={{fontFamily:t.displayFont,fontSize:10,letterSpacing:2,color:t.sub}}>{reportNo}</div>
      </div>
      <div style={{fontFamily:t.displayFont,fontSize:13,letterSpacing:5,color:t.coverAccent,textTransform:"uppercase",marginBottom:16}}>Inspection Report</div>
      <div style={{fontFamily:t.displayFont,fontSize:44,fontWeight:700,lineHeight:1.08,letterSpacing:"-1px",marginBottom:30}}>{report.address||"Property address"}</div>
      {cover && <img src={cover} style={{width:"100%",height:300,objectFit:"cover",borderRadius:t.radius,marginBottom:30}}/>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:t.hair,border:`1px solid ${t.hair}`,borderRadius:t.radius,overflow:"hidden"}}>
        {[["Systems",M.withF.length,t.coverInk],["Priority",M.cP,t.sev.priority.c],["Grade",M.overall,t.gradeColor[M.overall]]].map((x:any,i:number)=>(
          <div key={i} style={{background:t.coverBg,padding:"22px 18px"}}>
            <div style={{fontFamily:t.displayFont,fontSize:34,fontWeight:700,color:x[2]}}>{x[1]}</div>
            <div style={{fontSize:9,letterSpacing:1.5,color:t.sub,textTransform:"uppercase",marginTop:2}}>{x[0]}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:34,display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderTop:`1px solid ${t.hair}`,paddingTop:22}}>
        <div><div style={{fontSize:9,letterSpacing:2,color:t.sub,textTransform:"uppercase"}}>Prepared exclusively for</div>
        <div style={{fontSize:22,fontWeight:600,marginTop:3}}>{report.client||"—"}</div></div>
        <div style={{fontSize:12,color:t.sub,textAlign:"right"}}>{fmtDate(report.inspection_date)}<br/>Inspector {report.inspector||"—"}</div>
      </div>
    </div>
  );
}

function WarrantCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.pageBg,color:t.ink,fontFamily:t.bodyFont,padding:0}}>
      <div style={{background:t.coverBg,color:t.coverInk,padding:"40px 54px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <Logo dark height={152}/>
          <div style={{textAlign:"right",fontSize:10,color:"#9fb4c9"}}>REPORT NO.<br/><span style={{color:t.coverInk,fontWeight:700,fontSize:12}}>{reportNo}</span></div>
        </div>
      </div>
      <div style={{height:4,background:t.coverAccent}}/>
      <div style={{padding:"46px 54px 0"}}>
        <div style={{fontSize:11,letterSpacing:3,color:t.accent2,textTransform:"uppercase",marginBottom:14}}>Confidential Inspection Report</div>
        <div style={{fontFamily:t.displayFont,fontSize:34,fontWeight:700,lineHeight:1.15}}>{report.address||"Property address"}</div>
      </div>
      {cover && <div style={{margin:"32px 54px 0"}}><img src={cover} style={{width:"100%",height:300,objectFit:"cover",borderRadius:t.radius,border:`1px solid ${t.hair}`}}/></div>}
      <div style={{margin:"32px 54px 0",border:`1px solid ${t.hair}`,borderRadius:t.radius}}>
        {[["Client",report.client||"—"],["Inspection date",fmtDate(report.inspection_date)],["Inspector",report.inspector||"—"],["Overall grade",`${M.overall} — ${GRADE_DESC[M.overall].split(" — ")[0]}`]].map((r:any,i:number,a:any)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 16px",borderBottom:i<a.length-1?`1px solid ${t.hair}`:"none",fontSize:13}}>
            <span style={{color:t.sub}}>{r[0]}</span><span style={{fontWeight:700}}>{r[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function VanguardCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:0}}>
      <div style={{padding:"48px 54px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo dark height={144}/>
        <div style={{fontSize:11,color:t.coverAccent,fontWeight:700}}>{reportNo}</div>
      </div>
      <div style={{padding:"70px 54px 0"}}>
        <div style={{width:60,height:6,background:t.coverAccent,marginBottom:26}}/>
        <div style={{fontFamily:t.displayFont,fontSize:64,fontWeight:700,lineHeight:.98,letterSpacing:"-2px",maxWidth:"8in"}}>{report.address||"Property address"}</div>
        <div style={{fontFamily:t.displayFont,fontSize:15,letterSpacing:6,color:t.coverAccent,textTransform:"uppercase",marginTop:24}}>Inspection Report</div>
      </div>
      {cover && <div style={{margin:"44px 0 0"}}><img src={cover} style={{width:"100%",height:320,objectFit:"cover"}}/></div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
        {[["Systems",M.withF.length],["Priority",M.cP],["Grade",M.overall]].map((x:any,i:number)=>(
          <div key={i} style={{padding:"28px 54px",borderTop:`6px solid ${i===2?t.gradeColor[M.overall]:t.coverAccent}`,borderRight:i<2?`1px solid rgba(255,255,255,.12)`:"none"}}>
            <div style={{fontFamily:t.displayFont,fontSize:46,fontWeight:700,lineHeight:1}}>{x[1]}</div>
            <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,.6)",textTransform:"uppercase",marginTop:4}}>{x[0]}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"26px 54px",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <div style={{fontSize:20,fontWeight:700}}>{report.client||"—"}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>{fmtDate(report.inspection_date)} · {report.inspector||"—"}</div>
      </div>
    </div>
  );
}

function TerraCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:"56px 56px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:40,paddingBottom:20,borderBottom:`1px solid ${t.coverAccent}`}}>
        <Logo dark height={152}/>
        <div style={{fontSize:10,letterSpacing:2,color:t.coverAccent}}>{reportNo}</div>
      </div>
      <div style={{fontSize:11,letterSpacing:4,color:t.coverAccent,textTransform:"uppercase",marginBottom:18}}>Confidential Property Inspection</div>
      <div style={{fontFamily:t.displayFont,fontSize:46,fontWeight:600,lineHeight:1.1,letterSpacing:"-.5px"}}>{report.address||"Property address"}</div>
      {cover && <img src={cover} style={{width:"100%",height:320,objectFit:"cover",borderRadius:12,margin:"34px 0"}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:10,letterSpacing:2,color:t.coverAccent,textTransform:"uppercase"}}>Prepared for</div>
          <div style={{fontFamily:t.displayFont,fontSize:28,fontWeight:600,marginTop:2}}>{report.client||"—"}</div>
          <div style={{fontSize:12,color:"rgba(247,240,230,.7)",marginTop:8}}>{fmtDate(report.inspection_date)} · Inspector {report.inspector||"—"}</div>
        </div>
        <div style={{width:92,height:92,borderRadius:"50%",background:t.coverAccent,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:t.coverBg}}>
          <div style={{fontFamily:t.displayFont,fontSize:38,fontWeight:700,lineHeight:1}}>{M.overall}</div>
          <div style={{fontSize:7.5,letterSpacing:1.5,textTransform:"uppercase"}}>Overall</div>
        </div>
      </div>
    </div>
  );
}

function NoirCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:0}}>
      <div style={{padding:"54px 56px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo dark height={140}/>
        <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,.5)"}}>{reportNo}</div>
      </div>
      <div style={{padding:"90px 56px 0",textAlign:"center"}}>
        <div style={{fontSize:11,letterSpacing:8,textTransform:"uppercase",color:"rgba(255,255,255,.55)",marginBottom:26}}>Inspection Report</div>
        <div style={{fontFamily:t.displayFont,fontSize:50,fontWeight:700,lineHeight:1.1,letterSpacing:"-.5px"}}>{report.address||"Property address"}</div>
        <div style={{width:40,height:1,background:"#fff",margin:"30px auto"}}/>
        <div style={{fontSize:13,letterSpacing:2,color:"rgba(255,255,255,.8)"}}>{report.client||"—"}</div>
      </div>
      {cover && <div style={{margin:"56px 0 0"}}><img src={cover} style={{width:"100%",height:330,objectFit:"cover",filter:"grayscale(1) contrast(1.05)"}}/></div>}
      <div style={{display:"flex",justifyContent:"center",gap:0,borderTop:"1px solid rgba(255,255,255,.18)"}}>
        {[["Systems",M.withF.length],["Priority",M.cP],["Grade",M.overall]].map((x:any,i:number)=>(
          <div key={i} style={{flex:1,padding:"26px 0",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,.18)":"none"}}>
            <div style={{fontFamily:t.displayFont,fontSize:34,fontWeight:700}}>{x[1]}</div>
            <div style={{fontSize:9,letterSpacing:2,color:"rgba(255,255,255,.5)",textTransform:"uppercase",marginTop:3}}>{x[0]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


function AuroraCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:0,overflow:"hidden"}}>
      {cover && <img src={cover} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>}
      <div style={{position:"absolute",inset:0,background:cover?"linear-gradient(180deg, rgba(11,13,24,.35) 0%, rgba(11,13,24,.15) 40%, rgba(11,13,24,.92) 100%)":"linear-gradient(135deg,#1a1145,#0b0d18)"}}/>
      <div style={{position:"absolute",top:"-20%",right:"-10%",width:"70%",height:"55%",background:"radial-gradient(circle, rgba(109,74,255,.55), transparent 70%)",filter:"blur(20px)"}}/>
      <div style={{position:"absolute",top:"10%",left:"-15%",width:"55%",height:"45%",background:"radial-gradient(circle, rgba(255,77,141,.4), transparent 70%)",filter:"blur(20px)"}}/>
      <div style={{position:"relative",minHeight:"11in",display:"flex",flexDirection:"column",padding:"54px 54px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <Logo dark height={144}/>
          <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,.7)"}}>{reportNo}</div>
        </div>
        <div style={{flex:1}}/>
        <div>
          <div style={{fontFamily:t.displayFont,fontSize:14,letterSpacing:6,color:t.coverAccent,textTransform:"uppercase",marginBottom:16}}>Inspection Report</div>
          <div style={{fontFamily:t.displayFont,fontSize:58,fontWeight:700,lineHeight:1.02,letterSpacing:"-1.5px",textShadow:"0 2px 30px rgba(0,0,0,.4)"}}>{report.address||"Property address"}</div>
          <div style={{display:"flex",gap:24,marginTop:26,alignItems:"center"}}>
            {[["Systems",M.withF.length],["Priority",M.cP]].map((x:any,i:number)=>(
              <div key={i}><div style={{fontFamily:t.displayFont,fontSize:30,fontWeight:700}}>{x[1]}</div><div style={{fontSize:9,letterSpacing:1.5,color:"rgba(255,255,255,.6)",textTransform:"uppercase"}}>{x[0]}</div></div>
            ))}
            <div style={{width:1,height:44,background:"rgba(255,255,255,.25)"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:60,height:60,borderRadius:"50%",background:`radial-gradient(circle at 30% 30%, ${t.gradeColor[M.overall]}, ${t.gradeColor[M.overall]}bb)`,boxShadow:`0 0 30px ${t.gradeColor[M.overall]}88`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:t.displayFont,fontSize:28,fontWeight:700}}>{M.overall}</div>
              <div><div style={{fontSize:12,fontWeight:600}}>Overall Grade</div><div style={{fontSize:11,color:"rgba(255,255,255,.6)"}}>{report.client||"—"}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrestigeCover({t,report,cover,M,reportNo}:any){
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:"0",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"-15%",left:"50%",transform:"translateX(-50%)",width:"90%",height:"50%",background:"radial-gradient(ellipse, rgba(212,175,95,.22), transparent 70%)",filter:"blur(10px)"}}/>
      <div style={{position:"relative",padding:"56px 60px"}}>
        <div style={{textAlign:"center",borderBottom:`1px solid ${t.coverAccent}66`,paddingBottom:22,marginBottom:34}}>
          <Logo dark height={176}/>
          <div style={{fontSize:9,letterSpacing:4,color:t.coverAccent,textTransform:"uppercase",marginTop:6}}>Established Excellence · AdjusterFlow L.L.C.</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,letterSpacing:5,color:t.coverAccent,textTransform:"uppercase",marginBottom:20}}>Confidential Inspection Report</div>
          <div style={{fontFamily:t.displayFont,fontSize:46,fontWeight:600,lineHeight:1.1,letterSpacing:"-.5px"}}>{report.address||"Property address"}</div>
        </div>
        {cover && <div style={{margin:"34px 0",position:"relative"}}>
          <img src={cover} style={{width:"100%",height:300,objectFit:"cover",borderRadius:t.radius}}/>
          <div style={{position:"absolute",inset:0,borderRadius:t.radius,boxShadow:`inset 0 0 0 1px ${t.coverAccent}55, inset 0 -60px 60px -30px rgba(14,42,31,.7)`}}/>
        </div>}
        <div style={{textAlign:"center",marginTop:10}}>
          <div style={{width:110,height:110,margin:"0 auto",borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${t.coverAccent}, #a8823f)`,boxShadow:`0 0 40px ${t.coverAccent}66`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:t.coverBg}}>
            <div style={{fontFamily:t.displayFont,fontSize:46,fontWeight:700,lineHeight:1}}>{M.overall}</div>
            <div style={{fontSize:7.5,letterSpacing:2,textTransform:"uppercase"}}>Overall</div>
          </div>
          <div style={{fontFamily:t.displayFont,fontSize:22,fontWeight:600,marginTop:22}}>{report.client||"—"}</div>
          <div style={{fontSize:11,color:"rgba(244,239,224,.65)",marginTop:6}}>{fmtDate(report.inspection_date)} · Inspector {report.inspector||"—"} · {reportNo}</div>
        </div>
      </div>
    </div>
  );
}

function BlueprintCover({t,report,cover,M,reportNo}:any){
  const grid=`linear-gradient(rgba(77,141,255,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(77,141,255,.10) 1px, transparent 1px)`;
  return (
    <div className="rv-page" style={{position:"relative",width:"8.5in",minHeight:"11in",margin:"0 auto 16px",background:t.coverBg,color:t.coverInk,fontFamily:t.bodyFont,padding:0,overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:grid,backgroundSize:"32px 32px"}}/>
      <div style={{position:"absolute",bottom:"-10%",right:"-5%",width:"60%",height:"45%",background:"radial-gradient(circle, rgba(0,194,209,.35), transparent 70%)",filter:"blur(24px)"}}/>
      <div style={{position:"relative",padding:"54px 56px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:40}}>
          <Logo dark height={144}/>
          <div style={{fontSize:10,letterSpacing:2,color:t.coverAccent,fontFamily:"monospace"}}>{reportNo}</div>
        </div>
        <div style={{fontSize:12,letterSpacing:5,color:t.coverAccent,textTransform:"uppercase",marginBottom:18,fontFamily:"monospace"}}>◦ Inspection Report</div>
        <div style={{fontFamily:t.displayFont,fontSize:48,fontWeight:700,lineHeight:1.05,letterSpacing:"-1px"}}>{report.address||"Property address"}</div>
        <div style={{height:2,width:120,background:`linear-gradient(90deg,${t.coverAccent},transparent)`,margin:"22px 0",boxShadow:`0 0 12px ${t.coverAccent}`}}/>
        {cover && <img src={cover} style={{width:"100%",height:290,objectFit:"cover",borderRadius:t.radius,border:`1px solid ${t.coverAccent}44`}}/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:26}}>
          {[["Systems",M.withF.length,t.coverInk],["Priority",M.cP,t.sev.priority.c],["Grade",M.overall,t.gradeColor[M.overall]]].map((x:any,i:number)=>(
            <div key={i} style={{border:`1px solid ${t.coverAccent}33`,borderRadius:t.radius,padding:"16px 18px",background:"rgba(77,141,255,.06)"}}>
              <div style={{fontFamily:t.displayFont,fontSize:32,fontWeight:700,color:x[2]}}>{x[1]}</div>
              <div style={{fontSize:9,letterSpacing:1.5,color:"rgba(234,240,255,.55)",textTransform:"uppercase",marginTop:2,fontFamily:"monospace"}}>{x[0]}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:26,fontSize:12,color:"rgba(234,240,255,.7)"}}>Prepared for <strong style={{color:t.coverInk}}>{report.client||"—"}</strong> · {fmtDate(report.inspection_date)}</div>
      </div>
    </div>
  );
}

function AboutPage({t,report,pageBase,reportNo,pageNo}:any){
  const lay=t.layout;
  const cardBg = t.pageBg==="#0e0f12" ? "#15171b" : (lay==="technical" ? "transparent" : "#f6f5f1");
  const pill = (title:string, body:string) => (
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:t.displayFont,fontSize:14,fontWeight:700,color:t.accent,marginBottom:5}}>{title}</div>
      <div style={{fontSize:11.5,color:t.sub,lineHeight:1.7}}>{body}</div>
    </div>
  );
  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t} title="About This Inspection" sub="Standards of practice & our commitment to you"/>
      <div style={{background:cardBg,borderRadius:t.radius,padding:22,margin:"8px 0 22px",border:lay==="technical"?`1px solid ${t.hair}`:(lay==="band"?`1px solid ${t.hair}`:"none")}}>
        <div style={{fontFamily:t.displayFont,fontSize:16,fontWeight:700,marginBottom:8}}>Welcome, {report.client||"valued client"}.</div>
        <div style={{fontSize:11.5,color:t.sub,lineHeight:1.75}}>Thank you for choosing ProSight Property Inspections — a locally owned, InterNACHI-certified inspection company based in Dearborn Heights, Michigan. This report presents a thorough, unbiased evaluation of the readily accessible systems and components of your property at {report.address||"the inspected address"}. Our goal is simple — to give you a clear, honest understanding of the home's condition so you can make confident, well-informed decisions.</div>
      </div>

      {pill("Performed to InterNACHI Standards of Practice",
        "This inspection was performed in general accordance with the Standards of Practice of the International Association of Certified Home Inspectors (InterNACHI) — the industry's most respected benchmark. Our inspector is InterNACHI-certified (InterNACHI ID NACHI26020705) and bound by its Code of Ethics, ensuring an objective assessment carried out solely in your interest.")}

      {pill("What This Inspection Covers",
        "A visual, non-invasive examination of the major visible and readily accessible systems and components — including the roof, exterior and structure, foundation, interior rooms, and installed mechanical, electrical, and plumbing systems — documented with photographs and clear, plain-language findings. Each observation is graded by priority so you know what needs attention now versus what to simply monitor.")}

      {pill("Our Commitment to You",
        "We inspect every property as if it were our own — with diligence, integrity, and a genuine commitment to your safety and peace of mind. Findings are reported factually and without exaggeration. Where a condition warrants further evaluation by a licensed specialist, we say so plainly, so nothing is left to guesswork before you move forward.")}

      <div style={{display:"flex",gap:12,marginTop:22}}>
        {[["InterNACHI","Certified & Insured"],["Photo-Documented","Every Finding"],["Plain-Language","Clear Grading"]].map((x:any,i:number)=>(
          <div key={i} style={{flex:1,textAlign:"center",border:`1px solid ${t.hair}`,borderRadius:t.radius,padding:"14px 8px"}}>
            <div style={{fontFamily:t.displayFont,fontSize:13,fontWeight:700,color:t.accent}}>{x[0]}</div>
            <div style={{fontSize:9.5,color:t.sub,letterSpacing:.5,textTransform:"uppercase",marginTop:3}}>{x[1]}</div>
          </div>
        ))}
      </div>
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo}/>
    </div>
  );
}

/* ---------------- GRADE PAGE ---------------- */

function GradePage({t,report,M,pageBase,reportNo,pageNo}:any){
  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t} title="Overall Property Condition" sub="Summary grade of the systems evaluated"/>
      {t.gradeStyle==="seal" && (
        <div style={{display:"flex",gap:26,alignItems:"center",margin:"8px 0 26px"}}>
          <div style={{width:130,height:130,borderRadius:"50%",border:`3px double ${t.accent}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <div style={{fontFamily:t.displayFont,fontSize:58,fontWeight:600,color:t.gradeColor[M.overall],lineHeight:1}}>{M.overall}</div>
            <div style={{fontSize:8,letterSpacing:2,color:t.sub,textTransform:"uppercase",marginTop:4}}>Overall</div>
          </div>
          <div>
            <div style={{fontFamily:t.displayFont,fontSize:24,fontWeight:600,marginBottom:6}}>{GRADE_DESC[M.overall]}</div>
            <div style={{fontSize:12.5,color:t.sub,lineHeight:1.7,maxWidth:"4.6in"}}>This grade reflects the combined condition of all {M.withF.length} systems evaluated. {M.cP>0?`It is held back by ${M.cP} priority item${M.cP>1?"s":""} warranting attention from qualified specialists.`:"No priority items were identified."}</div>
          </div>
        </div>
      )}
      {t.gradeStyle==="number" && (
        <div style={{background:t.coverBg,border:`1px solid ${t.hair}`,borderRadius:t.radius,padding:28,margin:"8px 0 26px",display:"flex",alignItems:"center",gap:28}}>
          <div><div style={{fontFamily:t.displayFont,fontSize:88,fontWeight:700,color:t.gradeColor[M.overall],lineHeight:.9}}>{M.overall}</div></div>
          <div style={{borderLeft:`1px solid ${t.hair}`,paddingLeft:24}}>
            <div style={{fontSize:20,fontWeight:600,marginBottom:6,color:t.coverInk}}>{GRADE_DESC[M.overall]}</div>
            <div style={{fontSize:12.5,color:t.sub,lineHeight:1.7,maxWidth:"4.4in"}}>Weighted across {M.withF.length} systems. {M.cP>0?`${M.cP} priority item${M.cP>1?"s":""} require prompt correction.`:"No priority items identified."}</div>
          </div>
        </div>
      )}
      {t.gradeStyle==="certificate" && (
        <div style={{border:`2px solid ${t.accent}`,borderRadius:t.radius,padding:"26px 30px",margin:"8px 0 26px",textAlign:"center"}}>
          <div style={{fontSize:10,letterSpacing:3,color:t.sub,textTransform:"uppercase",marginBottom:10}}>Certified Overall Condition</div>
          <div style={{fontFamily:t.displayFont,fontSize:64,fontWeight:700,color:t.gradeColor[M.overall],lineHeight:1}}>{M.overall}</div>
          <div style={{fontSize:15,fontWeight:700,marginTop:6}}>{GRADE_DESC[M.overall]}</div>
          <div style={{fontSize:12,color:t.sub,lineHeight:1.6,maxWidth:"5in",margin:"10px auto 0"}}>Based on {M.withF.length} systems evaluated. {M.cP>0?`${M.cP} priority item${M.cP>1?"s":""} noted for correction.`:"No priority items identified."}</div>
        </div>
      )}
      {t.gradeStyle==="block" && (
        <div style={{display:"flex",margin:"8px 0 26px",border:`2px solid ${t.ink}`}}>
          <div style={{background:t.gradeColor[M.overall],color:"#fff",padding:"28px 34px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontFamily:t.displayFont,fontSize:72,fontWeight:700,lineHeight:.9}}>{M.overall}</div>
          </div>
          <div style={{padding:"24px 28px",flex:1}}>
            <div style={{fontFamily:t.displayFont,fontSize:22,fontWeight:700,marginBottom:6}}>{GRADE_DESC[M.overall]}</div>
            <div style={{fontSize:12.5,color:t.sub,lineHeight:1.7}}>Weighted across {M.withF.length} systems. {M.cP>0?`${M.cP} priority item${M.cP>1?"s":""} require prompt correction by qualified specialists.`:"No priority items identified."}</div>
          </div>
        </div>
      )}
      {t.gradeStyle==="glow" && (
        <div style={{position:"relative",borderRadius:t.radius,padding:28,margin:"8px 0 26px",overflow:"hidden",background:t.pageBg==="#ffffff"?"#0e1220":t.coverBg,color:"#fff"}}>
          <div style={{position:"absolute",top:"-40%",left:"20%",width:"60%",height:"140%",background:`radial-gradient(circle, ${t.gradeColor[M.overall]}55, transparent 70%)`,filter:"blur(20px)"}}/>
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:26}}>
            <div style={{width:96,height:96,borderRadius:"50%",background:`radial-gradient(circle at 35% 30%, ${t.gradeColor[M.overall]}, ${t.gradeColor[M.overall]}aa)`,boxShadow:`0 0 34px ${t.gradeColor[M.overall]}88`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:t.displayFont,fontSize:44,fontWeight:700}}>{M.overall}</div>
            <div>
              <div style={{fontFamily:t.displayFont,fontSize:22,fontWeight:700,marginBottom:6}}>{GRADE_DESC[M.overall]}</div>
              <div style={{fontSize:12.5,color:"rgba(255,255,255,.72)",lineHeight:1.7,maxWidth:"4.6in"}}>This grade reflects the combined condition of all {M.withF.length} systems evaluated. {M.cP>0?`It is held back by ${M.cP} priority item${M.cP>1?"s":""} warranting qualified attention.`:"No priority items were identified."}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700,marginBottom:10}}>Condition Grade by System</div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["System / Area","Priority","Monitor","Grade"].map((h,i)=>(
          <th key={i} style={{borderBottom:`2px solid ${t.ink}`,color:t.ink,fontSize:9.5,letterSpacing:1,textTransform:"uppercase",textAlign:i===0?"left":i===3?"right":"center",padding:"8px 10px",fontFamily:t.bodyFont}}>{h}</th>
        ))}</tr></thead>
        <tbody>{M.graded.map((g:any)=>(
          <tr key={g.section.id}>
            <td style={{padding:"9px 10px",borderBottom:`1px solid ${t.hair}`,fontSize:11,fontWeight:600}}>{g.section.name}</td>
            <td style={{padding:"9px 10px",borderBottom:`1px solid ${t.hair}`,fontSize:11,textAlign:"center",color:g.counts.priority?t.sev.priority.c:t.sub}}>{g.counts.priority||"—"}</td>
            <td style={{padding:"9px 10px",borderBottom:`1px solid ${t.hair}`,fontSize:11,textAlign:"center",color:g.counts.monitor?t.sev.monitor.c:t.sub}}>{g.counts.monitor||"—"}</td>
            <td style={{padding:"9px 10px",borderBottom:`1px solid ${t.hair}`,textAlign:"right"}}><span style={{fontSize:10,fontWeight:700,color:t.gradeColor[g.grade]}}>{g.grade}</span></td>
          </tr>
        ))}</tbody>
      </table>
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo}/>
    </div>
  );
}

/* ---------------- EXEC PAGE ---------------- */

function ExecPage({t,report,M,pageBase,reportNo,pageNo}:any){
  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t} title="Executive Summary" sub={`Most significant findings from the inspection of ${report.address}`}/>
      <div style={{display:"flex",gap:12,margin:"6px 0 22px"}}>
        {[["Priority / Safety",M.cP,t.sev.priority],["Monitor / Maintain",M.cM,t.sev.monitor],["Satisfactory",M.cS,t.sev.satisfactory]].map((x:any,i:number)=>(
          <div key={i} style={{flex:1,border:`1px solid ${t.hair}`,borderRadius:t.radius,padding:16,textAlign:"center",background:x[2].bg}}>
            <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:700,color:x[2].c}}>{x[1]}</div>
            <div style={{fontSize:9,letterSpacing:1,color:t.sub,textTransform:"uppercase",marginTop:2}}>{x[0]}</div>
          </div>
        ))}
      </div>
      {M.priority.length>0 && <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700,marginBottom:10}}>Priority Findings</div>}
      {M.priority.map((x:any,i:number)=>(
        <div key={i} style={{borderLeft:`3px solid ${t.sev.priority.c}`,background:t.sev.priority.bg,borderRadius:t.radius,padding:"12px 15px",marginBottom:10}}>
          <div style={{fontSize:9,letterSpacing:1,color:t.sev.priority.c,fontWeight:700,textTransform:"uppercase"}}>{x.area}</div>
          <div style={{fontFamily:t.displayFont,fontSize:14,fontWeight:700,margin:"2px 0"}}>{x.f.title||"Priority item"}</div>
          <div style={{fontSize:11.5,color:t.sub,lineHeight:1.6}}>{x.f.ai_text||x.f.note}</div>
        </div>
      ))}
      {M.monitor.length>0 && <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700,margin:"18px 0 10px"}}>Monitor &amp; Maintenance</div>}
      {M.monitor.slice(0,7).map((x:any,i:number)=>(
        <div key={i} style={{display:"flex",gap:9,padding:"7px 0",borderBottom:`1px solid ${t.hair}`,fontSize:11.5,color:t.sub}}>
          <span style={{color:t.sev.monitor.c}}>◆</span><span>{x.f.ai_text||x.f.note}</span>
        </div>
      ))}
      {M.priority.length===0 && M.monitor.length===0 && <div style={{fontSize:12,color:t.sub}}>No priority or maintenance items identified. See sections for detail.</div>}
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo}/>
    </div>
  );
}

/* ---------------- SECTION PAGE ---------------- */

function SectionHeader({t,s,g,idx}:any){
  const lay=t.layout;
  if(lay==="band") return (
    <div style={{background:t.accent,color:"#fff",borderRadius:t.radius,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
      <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:700,opacity:.85}}>{String(idx+1).padStart(2,"0")}</div>
      <div style={{width:1,height:30,background:"rgba(255,255,255,.35)"}}/>
      <div style={{flex:1}}><div style={{fontFamily:t.displayFont,fontSize:19,fontWeight:700}}>{s.name}</div><div style={{fontSize:9,letterSpacing:1.5,opacity:.8,textTransform:"uppercase"}}>{s.subtitle||s.grp}</div></div>
      <span style={{fontFamily:t.displayFont,fontSize:20,fontWeight:700,background:"#fff",color:t.gradeColor[g.grade],borderRadius:t.radius,padding:"2px 12px"}}>{g.grade}</span>
    </div>
  );
  if(lay==="technical") return (
    <div style={{marginBottom:16,padding:"14px 16px",border:`1px solid ${t.hair}`,borderLeft:`4px solid ${t.gradeColor[g.grade]}`,borderRadius:t.radius,display:"flex",alignItems:"center",gap:14,background:t.pageBg==="#0e0f12"?"#15171b":"transparent"}}>
      <div style={{fontFamily:"monospace",fontSize:13,color:t.accent,letterSpacing:1}}>[{String(idx+1).padStart(2,"0")}]</div>
      <div style={{flex:1}}><div style={{fontFamily:t.displayFont,fontSize:18,fontWeight:700}}>{s.name}</div><div style={{fontSize:9,letterSpacing:1.5,color:t.sub,textTransform:"uppercase",fontFamily:"monospace"}}>{s.subtitle||s.grp}</div></div>
      <span style={{fontSize:11,fontWeight:700,color:"#fff",background:t.gradeColor[g.grade],borderRadius:t.radius,padding:"3px 10px",fontFamily:"monospace"}}>GRADE {g.grade}</span>
    </div>
  );
  if(lay==="minimal") return (
    <div style={{marginBottom:20,textAlign:"center",paddingBottom:16,borderBottom:`1px solid ${t.hair}`}}>
      <div style={{fontSize:10,letterSpacing:4,color:t.sub,textTransform:"uppercase",marginBottom:6}}>Section {String(idx+1).padStart(2,"0")} — Grade {g.grade}</div>
      <div style={{fontFamily:t.displayFont,fontSize:24,fontWeight:700}}>{s.name}</div>
      <div style={{fontSize:11,letterSpacing:1,color:t.sub,marginTop:2}}>{s.subtitle||s.grp}</div>
    </div>
  );
  // editorial (default): huge ghost number, serif, side accent
  return (
    <div style={{position:"relative",marginBottom:18,paddingBottom:14,borderBottom:`2px solid ${t.accent}`}}>
      <div style={{position:"absolute",right:0,top:-8,fontFamily:t.displayFont,fontSize:72,fontWeight:700,color:t.hair,lineHeight:1,zIndex:0}}>{String(idx+1).padStart(2,"0")}</div>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{fontSize:10,letterSpacing:3,color:t.accent,textTransform:"uppercase",marginBottom:4}}>Grade {g.grade}</div>
        <div style={{fontFamily:t.displayFont,fontSize:24,fontWeight:700}}>{s.name}</div>
        <div style={{fontSize:11,letterSpacing:1,color:t.sub}}>{s.subtitle||s.grp}</div>
      </div>
    </div>
  );
}

function FindingCard({t,f,urls}:any){
  const m=t.sev[f.severity as keyof typeof t.sev]||t.sev.monitor;
  const purl=f.photo_path?urls[f.photo_path]:null;
  const lay=t.layout;
  const body=(<><div style={{fontSize:11.5,color:t.sub,lineHeight:1.6}}>{f.ai_text||f.note}</div>{purl && <img src={purl} style={{width:"100%",maxHeight:240,objectFit:"cover",borderRadius:t.radius,marginTop:11}}/>}</>);
  if(lay==="band" || lay==="technical") return (
    <div style={{border:`1px solid ${t.hair}`,borderLeft:`4px solid ${m.c}`,borderRadius:t.radius,padding:"13px 15px",marginBottom:11,pageBreakInside:"avoid",background:t.pageBg==="#0e0f12"?"#15171b":"transparent"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:4}}>
        <div style={{fontFamily:t.displayFont,fontSize:14,fontWeight:700}}>{f.title||"Observation"}</div>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:.5,padding:"3px 9px",borderRadius:t.radius,color:m.c,background:m.bg}}>{f.severity.toUpperCase()}</span>
      </div>{body}
    </div>
  );
  if(lay==="minimal") return (
    <div style={{padding:"14px 0",marginBottom:4,borderBottom:`1px solid ${t.hair}`,pageBreakInside:"avoid"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,marginBottom:6}}>
        <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700}}>{f.title||"Observation"}</div>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:1,color:m.c,textTransform:"uppercase"}}>{f.severity}</span>
      </div>{body}
    </div>
  );
  // editorial: top severity band, borderless
  return (
    <div style={{marginBottom:14,pageBreakInside:"avoid"}}>
      <div style={{height:3,width:44,background:m.c,marginBottom:8}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,marginBottom:4}}>
        <div style={{fontFamily:t.displayFont,fontSize:16,fontWeight:700}}>{f.title||"Observation"}</div>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:1,color:m.c,textTransform:"uppercase"}}>{f.severity}</span>
      </div>{body}
    </div>
  );
}

function SectionPage({t,s,g,idx,urls,pageBase,reportNo,address,pageNo}:any){
  return (
    <div className="rv-page" style={pageBase}>
      <SectionHeader t={t} s={s} g={g} idx={idx}/>
      {s.findings?.map((f:any)=>(<FindingCard key={f.id} t={t} f={f} urls={urls}/>))}
      <Foot t={t} reportNo={reportNo} address={address} p={pageNo}/>
    </div>
  );
}

/* ---------------- SCOPE PAGE ---------------- */

function ScopePage({t,report,pageBase,reportNo,pageNo}:any){
  const lay=t.layout;
  const darkBox = t.pageBg==="#0e0f12";
  const boxBg = darkBox?"#15171b":(lay==="technical"?"transparent":"#f6f5f1");
  const disclaimer=(
    <>
      <p style={{fontSize:11.5,color:t.sub,lineHeight:1.7,margin:"0 0 12px"}}>This report reflects a visual, non-invasive inspection of the readily accessible systems and components of the property on the date noted, performed in general accordance with the InterNACHI Standards of Practice. It is not a code-compliance inspection, a warranty, or a guarantee against future failure. Conditions concealed behind finishes, beneath floor coverings, within walls, or otherwise not visible at the time of inspection are excluded.</p>
      <p style={{fontSize:11.5,color:t.sub,lineHeight:1.7,margin:0}}>The inspector assumes no liability for repairs performed by others or for conditions arising after the inspection date. This report is prepared solely for the named client and may not be relied upon by any other party.</p>
    </>
  );
  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t} title="Scope & Limitations" sub="Standards of practice and report terms"/>
      {lay==="technical" ? (
        <div style={{margin:"8px 0 22px",padding:"0 0 0 16px",borderLeft:`3px solid ${t.accent}`}}>{disclaimer}</div>
      ) : lay==="minimal" ? (
        <div style={{margin:"8px 0 22px",maxWidth:"5.6in"}}>{disclaimer}</div>
      ) : (
        <div style={{background:boxBg,borderRadius:t.radius,padding:22,margin:"8px 0 22px",border:lay==="band"?`1px solid ${t.hair}`:"none"}}>{disclaimer}</div>
      )}
      <div style={{display:"flex",gap:40,marginTop:28,fontSize:11.5,color:t.ink}}>
        <div style={{flex:1,borderTop:`1px solid ${t.ink}`,paddingTop:8}}>Inspector — {report.inspector||"—"}, Certified Property Inspector{` · InterNACHI ID ${report.nachi_id||"NACHI26020705"}`}</div>
        <div style={{flex:1,borderTop:`1px solid ${t.ink}`,paddingTop:8}}>Date — {fmtDate(report.inspection_date)}</div>
      </div>
      {lay==="band" ? (
        <div style={{background:t.accent,color:"#fff",borderRadius:t.radius,padding:22,textAlign:"center",marginTop:34}}>
          <div style={{fontFamily:t.displayFont,fontSize:18,fontWeight:700}}>Thank you for choosing ProSight Property Inspections</div>
          <div style={{fontSize:11,opacity:.85,marginTop:5}}>AdjusterFlow L.L.C. · Dearborn Heights, MI · Reference {reportNo}</div>
        </div>
      ) : lay==="minimal" ? (
        <div style={{textAlign:"center",marginTop:44}}>
          <div style={{width:40,height:1,background:t.ink,margin:"0 auto 18px"}}/>
          <div style={{fontFamily:t.displayFont,fontSize:17,fontWeight:700,letterSpacing:1}}>Thank you</div>
          <div style={{fontSize:11,color:t.sub,marginTop:6,letterSpacing:1}}>ProSight Property Inspections · {reportNo}</div>
        </div>
      ) : (
        <div style={{textAlign:"center",marginTop:34,paddingTop:22,borderTop:`1px solid ${t.hair}`}}>
          <div style={{fontFamily:t.displayFont,fontSize:17,fontWeight:700,color:t.accent}}>Thank you for choosing ProSight Property Inspections</div>
          <div style={{fontSize:11,color:t.sub,marginTop:5}}>AdjusterFlow L.L.C. · Dearborn Heights, MI · Reference {reportNo}</div>
        </div>
      )}
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo}/>
    </div>
  );
}

function SecTitle({t,title,sub}:{t:ThemeTokens;title:string;sub:string}){
  return <div style={{marginBottom:8}}>
    <div style={{fontFamily:t.displayFont,fontSize:22,fontWeight:700,borderLeft:`3px solid ${t.accent}`,paddingLeft:12}}>{title}</div>
    <div style={{fontSize:12,color:t.sub,marginLeft:15,marginTop:3}}>{sub}</div>
  </div>;
}
