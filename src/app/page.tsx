"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import Intake from "@/components/Intake";
import { listReports, deleteReport } from "@/lib/data";
import { createClient } from "@/lib/supabase-browser";
import type { Report } from "@/lib/types";

function fmtDate(iso:string|null){ if(!iso)return "—"; return new Date(iso+"T00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }

export default function Home(){
  return <AuthGate><Dashboard/></AuthGate>;
}

function Dashboard(){
  const [reports,setReports]=useState<Report[]>([]);
  const [loading,setLoading]=useState(true);
  const [showIntake,setShowIntake]=useState(false);
  const [q,setQ]=useState("");

  async function refresh(){ setLoading(true); try{ setReports(await listReports()); }catch(e){} setLoading(false); }
  useEffect(()=>{ refresh(); },[]);

  const filtered=reports.filter(r=>!q||`${r.address} ${r.client}`.toLowerCase().includes(q.toLowerCase()));
  const drafts=reports.filter(r=>r.status!=="done").length;
  const done=reports.length-drafts;
  const month=reports.filter(r=>{const d=new Date(r.created_at);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).length;

  async function signOut(){ await createClient().auth.signOut(); location.reload(); }
  async function del(r:Report){ if(confirm(`Delete the report for ${r.address||"this property"}? This can't be undone.`)){ await deleteReport(r.id); refresh(); } }

  return (
    <div>
      <header style={{background:"var(--surface)",borderBottom:"1px solid var(--line)",position:"sticky",top:0,zIndex:30}}>
        <div style={{display:"flex",alignItems:"center",gap:14,height:56,padding:"0 24px",maxWidth:1120,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:7,background:"var(--accent)",display:"grid",placeItems:"center"}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 21v-6h6v6"/></svg>
            </div>
            <div style={{fontWeight:650,fontSize:14.5}}>ProSight <span style={{color:"var(--muted)",fontWeight:500}}>Studio</span></div>
          </div>
          <div style={{width:1,height:22,background:"var(--line)"}}/>
          <div style={{fontSize:13,color:"var(--muted)"}}>Inspection reports</div>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost" onClick={signOut} style={{padding:"6px 12px",fontSize:12.5}}>Sign out</button>
        </div>
      </header>

      <div style={{maxWidth:1120,margin:"0 auto",padding:"28px 24px 80px"}}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16,marginBottom:22,flexWrap:"wrap"}}>
          <div><h1 style={{margin:0,fontSize:24,fontWeight:700,letterSpacing:"-.02em"}}>Reports</h1>
          <p style={{margin:"4px 0 0",fontSize:14,color:"var(--muted)"}}>Your inspection reports, saved to your account.</p></div>
          <button className="btn btn-primary" onClick={()=>setShowIntake(true)}>+ New report</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {[["Total reports",reports.length],["In progress",drafts],["Completed",done],["This month",month]].map(([l,v],i)=>(
            <div key={i} className="card" style={{padding:"16px 18px"}}><div style={{fontSize:24,fontWeight:700}}>{v}</div><div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{l}</div></div>
          ))}
        </div>

        {loading ? <div style={{padding:60,textAlign:"center",color:"var(--muted)"}}>Loading…</div> :
         reports.length===0 ? (
          <div className="card" style={{textAlign:"center",padding:"64px 24px",border:"1px dashed var(--line-2)",boxShadow:"none"}}>
            <h3 style={{margin:"0 0 6px",fontSize:17}}>No reports yet</h3>
            <p style={{margin:"0 0 20px",fontSize:14,color:"var(--muted)"}}>Start your first inspection report — a few quick questions and we build the section structure.</p>
            <button className="btn btn-primary" onClick={()=>setShowIntake(true)}>Create your first report</button>
          </div>
         ) : (<>
          <div style={{marginBottom:16}}>
            <input className="input" style={{maxWidth:340}} placeholder="Search by address or client" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <div className="card" style={{overflow:"hidden"}}>
            {filtered.map(r=>{
              const total=(r as any).section_count||0;
              return (
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:16,padding:"15px 20px",borderBottom:"1px solid var(--line)"}}>
                <Link href={`/report/${r.id}`} style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:16}}>
                  <div style={{width:52,height:52,borderRadius:8,background:"var(--surface-2)",border:"1px solid var(--line)",display:"grid",placeItems:"center",color:"var(--faint)"}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:650,fontSize:14.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.address||"Untitled property"}</div>
                    <div style={{fontSize:12.5,color:"var(--muted)",marginTop:2}}>{r.client||"—"} · {fmtDate(r.inspection_date)}</div>
                  </div>
                </Link>
                <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:r.status==="done"?"var(--ok-tint)":"var(--warn-tint)",color:r.status==="done"?"var(--ok)":"var(--warn)"}}>{r.status==="done"?"Complete":"Draft"}</span>
                <button className="btn btn-ghost" style={{padding:"6px 12px",fontSize:12.5}} onClick={()=>del(r)}>Delete</button>
              </div>);
            })}
            {filtered.length===0 && <div style={{padding:30,textAlign:"center",color:"var(--muted)",fontSize:14}}>No reports match your search.</div>}
          </div>
         </>)}
      </div>

      {showIntake && <Intake onClose={()=>{setShowIntake(false);refresh();}} />}
    </div>
  );
}
