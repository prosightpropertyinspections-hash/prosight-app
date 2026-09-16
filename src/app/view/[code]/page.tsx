"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReportView from "@/components/ReportView";

const SEV:Record<string,{w:string;c:string;bg:string}> = {
  priority:{w:"PRIORITY",c:"#b6413a",bg:"#faeceb"},
  monitor:{w:"MONITOR",c:"#c98a1e",bg:"#fbf3e2"},
  satisfactory:{w:"SATISFACTORY",c:"#2f7d4f",bg:"#e7f2ea"},
};
const GRADE_COLOR:Record<string,string>={A:"#2f7d4f",B:"#5a9e56",C:"#c98a1e",D:"#cf6b3a",F:"#b6413a"};
function fmtDate(iso:string|null){ if(!iso)return "—"; return new Date(iso+"T00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); }

export default function ClientView(){
  const { code } = useParams<{code:string}>();
  const [phase,setPhase]=useState<"loading"|"locked"|"open"|"notfound">("loading");
  const [header,setHeader]=useState<{client:string;address:string}>({client:"",address:""});
  const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<any>(null); const [urls,setUrls]=useState<Record<string,string>>({});
  const [profile,setProfile]=useState<any>(null);

  useEffect(()=>{ (async()=>{
    const res=await fetch("/api/view",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
    if(res.status===404){ setPhase("notfound"); return; }
    const j=await res.json();
    if(j.locked){ setHeader({client:j.client,address:j.address}); setPhase("locked"); }
  })(); },[code]);

  async function unlock(){
    setErr(""); setBusy(true);
    const res=await fetch("/api/view",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,password:pw})});
    setBusy(false);
    if(res.status===401){ setErr("Incorrect password. Please check and try again."); return; }
    if(!res.ok){ setErr("This report link is unavailable."); return; }
    const j=await res.json();
    setReport(j.report); setUrls(j.urls||{});
    setProfile(j.profile||null);
    setPhase("open");
  }

  if(phase==="loading") return <Center>Loading…</Center>;
  if(phase==="notfound") return <Center><div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:700,marginBottom:6}}>Report not found</div><div style={{color:"#667"}}>This link is invalid or has been disabled.</div></div></Center>;

  if(phase==="locked") return (
    <Center>
      <div style={{width:"100%",maxWidth:420,background:"#fff",border:"1px solid #e5e7eb",borderRadius:14,boxShadow:"0 12px 32px -8px rgba(16,24,40,.18)",padding:30}}>
        <img src="/logo.svg" alt="ProSight Property Inspections" style={{height:46,width:"auto",display:"block",marginBottom:22}}/>
        <div style={{fontSize:11,letterSpacing:2,color:"#b98a2e",fontWeight:600}}>CONFIDENTIAL INSPECTION REPORT</div>
        <div style={{fontSize:22,fontWeight:800,color:"#0d2035",margin:"6px 0 2px"}}>{header.address||"Your property"}</div>
        <div style={{fontSize:14,color:"#667",marginBottom:22}}>Prepared for {header.client||"you"}</div>
        <label style={{display:"block",fontSize:12.5,fontWeight:600,color:"#374151",marginBottom:6}}>Enter your access password</label>
        <input value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&unlock()} placeholder="Password from your inspector" autoFocus
          style={{width:"100%",padding:"10px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:15,letterSpacing:"1px"}}/>
        {err && <div style={{color:"#b91c1c",fontSize:12.5,marginTop:8}}>{err}</div>}
        <button onClick={unlock} disabled={busy||!pw} style={{width:"100%",marginTop:14,padding:"11px",background:"#0d2035",color:"#fff",border:0,borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",opacity:busy||!pw?.6:1}}>{busy?"Checking…":"View my report"}</button>
        <div style={{fontSize:12,color:"#9aa",marginTop:14,textAlign:"center"}}>Your inspector provided this password. Contact them if you need it.</div>
      </div>
    </Center>
  );

  // OPEN — render themed report via shared ReportView
  return (
    <div style={{background:"#e9ebee",minHeight:"100vh"}}>
      <style>{`
        @media print{ .noprint{ display:none !important; } }
        .cv-bar{ background:#0d2035; color:#fff; padding:12px 20px; display:flex; align-items:center; gap:14px; position:sticky; top:0; z-index:20; }
        .cv-logo{ height:40px; width:auto; display:block; flex-shrink:0; }
        .cv-addr{ font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cv-sub{ font-size:12px; color:#9fb4c9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cv-btn{ background:#2f9d6b; color:#fff; border:0; padding:9px 18px; border-radius:7px; font-weight:700; cursor:pointer; font-size:13px; white-space:nowrap; }
        .cv-shell{ padding:18px 0; }
        @media (max-width:700px){
          .cv-bar{ flex-wrap:wrap; gap:10px; padding:10px 14px; }
          .cv-logo{ height:30px; }
          .cv-meta{ flex:1 1 100%; order:3; }
          .cv-addr{ font-size:13px; white-space:normal; }
          .cv-btn{ padding:9px 14px; font-size:12.5px; }
          .cv-shell{ padding:10px 0; }
        }
      `}</style>
      <div className="noprint cv-bar">
        <img className="cv-logo" src="/logo-ondark.svg" alt="ProSight Property Inspections"/>
        <div className="cv-meta" style={{flex:1,minWidth:0}}>
          <div className="cv-addr">{report.address}</div>
          <div className="cv-sub">Prepared for {report.client} · {fmtDate(report.inspection_date)}</div>
        </div>
        <button className="cv-btn" onClick={()=>window.print()}>Print &amp; Download</button>
      </div>
      {/* rv-shell: the print stylesheet zeroes this padding. Without the class
          every sheet starts 18px low and the bottom of each page is clipped. */}
      <div className="rv-shell cv-shell">
        {/* The ask sits between the last finding and the closing page — read, but
            never printed. */}
        <ReportView report={report} urls={urls} themeId={report.theme} profile={profile}
          beforeScope={<ClientFooter report={report} profile={profile}/>}/>
      </div>

      <ClientContact profile={profile}/>
    </div>
  );
}

function Center({children}:{children:React.ReactNode}){
  return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#eef0f3",fontFamily:"Inter,-apple-system,sans-serif",padding:20}}>{children}</div>;
}

/* What follows the report: the ask for a review, and how to reach the business.
   No gate in front of the ask — a client who has scrolled this far has read the
   work, which is the moment it is worth asking. */
function ClientFooter({report,profile}:{ report:any; profile:any }){

  const company = profile?.company_name || "ProSight Property Inspections";
  const review  = profile?.review_url || "";


  return (
    <div className="cf noprint">
      <style dangerouslySetInnerHTML={{__html: CF_CSS}}/>

      {review ? (
        <div className="cf-card cf-review">
          <div className="cf-stars">★★★★★</div>
          <h3>Was this report useful?</h3>
          <p>
            A short review helps other buyers find an inspector they can trust, and it takes about a
            minute. Thank you for choosing {company}.
          </p>
          <a className="cf-btn cf-btn-go" href={review} target="_blank" rel="noopener noreferrer">
            Leave a Google review
          </a>
        </div>
      ) : null}

    </div>
  );
}

const CF_CSS = `
.cf{ color-scheme:light; max-width:8.5in; margin:0 auto; padding:8px 16px 60px;
  font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
.cf-card{ background:#fff; border:1px solid #e3e8ee; border-radius:14px; padding:24px 26px; margin-bottom:14px;
  box-shadow:0 10px 30px -18px rgba(16,26,38,.4); }
.cf-card h3{ margin:0 0 6px; font-size:17px; font-weight:700; color:#16202b; }
.cf-card p{ margin:0 0 16px; font-size:14px; line-height:1.65; color:#44536a; }
.cf-btn{ padding:12px 20px; border:0; border-radius:10px; background:#0d2035; color:#fff;
  font:inherit; font-size:14px; font-weight:650; cursor:pointer; white-space:nowrap; }
.cf-btn:hover:not(:disabled){ background:#16324f; }


.cf-review{ text-align:center; background:linear-gradient(170deg,#fff,#f6faff); border-color:#cfe0f3; }
.cf-stars{ font-size:24px; color:#f5b301; letter-spacing:4px; margin-bottom:8px; }
.cf-review p{ max-width:44ch; margin:0 auto 18px; }
.cf-btn-go{ display:inline-block; text-decoration:none; background:#2f7fd0; }
.cf-btn-go:hover{ background:#2569b0; }


@media (max-width:600px){
  .cf-card{ padding:20px 18px; }
}
@media print{ .cf{ display:none !important; } }
`;

/* Contact details, shown once at the very end — after the closing page, where a
   business card belongs. Screen only, like the review ask. */
function ClientContact({profile}:{profile:any}){
  const company = profile?.company_name || "ProSight Property Inspections";
  const phone = profile?.phone || "";
  const email = profile?.email || "";
  const site  = profile?.website || "";
  const siteHref = site ? (site.startsWith("http") ? site : `https://${site}`) : "";
  if(!(phone || email || siteHref)) return null;

  return (
    <div className="cc noprint">
      <style dangerouslySetInnerHTML={{__html: CC_CSS}}/>
      <div className="cc-t">{company}</div>
      <div className="cc-links">
        {phone && <a href={`tel:${phone.replace(/[^0-9+]/g,"")}`}>{phone}</a>}
        {email && <a href={`mailto:${email}`}>{email}</a>}
        {siteHref && <a href={siteHref} target="_blank" rel="noopener noreferrer">{site}</a>}
      </div>
      <div className="cc-note">Questions about anything in this report? Get in touch — we are happy to explain.</div>
    </div>
  );
}

const CC_CSS = `
.cc{ color-scheme:light; max-width:8.5in; margin:0 auto; padding:26px 16px 64px; text-align:center;
  font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
.cc-t{ font-size:14px; font-weight:700; color:#16202b; }
.cc-links{ display:flex; gap:18px; justify-content:center; flex-wrap:wrap; margin:9px 0 7px; }
.cc-links a{ font-size:13.5px; color:#2f7fd0; text-decoration:none; }
.cc-links a:hover{ text-decoration:underline; }
.cc-note{ font-size:12.5px; color:#7d8b9c; }
@media print{ .cc{ display:none !important; } }
`;
