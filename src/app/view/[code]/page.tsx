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
    setReport(j.report); setUrls(j.urls||{}); setPhase("open");
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
      <style>{`@media print{.noprint{display:none!important;}}`}</style>
      <div className="noprint" style={{background:"#0d2035",color:"#fff",padding:"12px 20px",display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:20}}>
        <img src="/logo-ondark.svg" alt="ProSight Property Inspections" style={{height:40,width:"auto",display:"block",flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{report.address}</div>
          <div style={{fontSize:12,color:"#9fb4c9"}}>Prepared for {report.client} · {fmtDate(report.inspection_date)}</div>
        </div>
        <button onClick={()=>window.print()} style={{background:"#2f9d6b",color:"#fff",border:0,padding:"9px 18px",borderRadius:7,fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>Print &amp; Download</button>
      </div>
      {/* rv-shell: the print stylesheet zeroes this padding. Without the class
          every sheet starts 18px low and the bottom of each page is clipped. */}
      <div className="rv-shell" style={{padding:"18px 0"}}>
        <ReportView report={report} urls={urls} themeId={report.theme}/>
      </div>
    </div>
  );
}

function Center({children}:{children:React.ReactNode}){
  return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#eef0f3",fontFamily:"Inter,-apple-system,sans-serif",padding:20}}>{children}</div>;
}
