"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import { getReport, updateReport } from "@/lib/data";
import { THEME_LIST } from "@/lib/themes";
import { createClient } from "@/lib/supabase-browser";
import type { Report, Finding, Severity } from "@/lib/types";
import { AnnotationEditor, AnnotatedPhoto, normalizeShapes, type Shape } from "@/components/Annotations";

export default function ReportPage(){ return <AuthGate><Editor/></AuthGate>; }

const SEV_META:Record<Severity,{w:string;c:string;bg:string}>={
  priority:{w:"Priority",c:"var(--danger)",bg:"var(--danger-tint)"},
  monitor:{w:"Monitor",c:"var(--warn)",bg:"var(--warn-tint)"},
  satisfactory:{w:"Satisfactory",c:"var(--ok)",bg:"var(--ok-tint)"},
};

/* Shrink a photo in the browser before sending it to the AI route.
   A phone/drone shot is 5-10MB; base64 adds ~33% on top, which blows past the
   request body limit (Vercel caps at 4.5MB and will not budge) and comes back
   as a plain-text 413 that res.json() chokes on. Anthropic downscales anything
   over 1568px on the long edge anyway, so nothing is lost by doing it here. */
const AI_MAX_EDGE = 1568;

async function toAnalyzablePayload(blob: Blob): Promise<{ data:string; mediaType:string }> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, AI_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if(!ctx) throw new Error("Could not read the image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // Step the quality down until it comfortably fits the request budget.
  for(const q of [0.85, 0.7, 0.55]){
    const out: Blob | null = await new Promise(res => canvas.toBlob(res, "image/jpeg", q));
    if(!out) continue;
    if(out.size < 3_000_000 || q === 0.55){
      const data = await new Promise<string>((resolve, reject) => {
        const rd = new FileReader();
        rd.onload = () => resolve((rd.result as string).split(",")[1]);
        rd.onerror = () => reject(new Error("Could not read the image."));
        rd.readAsDataURL(out);
      });
      return { data, mediaType: "image/jpeg" };
    }
  }
  throw new Error("Image is too large to analyze.");
}

/* Error routes return plain text for 413/504, so res.json() throws on the raw
   body and hides the real cause. Read as text, then parse. */
async function readJson(res: Response){
  const raw = await res.text();
  try { return JSON.parse(raw); }
  catch {
    if(res.status === 413) return { error: "That photo is too large to analyze. Try a smaller image." };
    return { error: `Server error ${res.status}. ${raw.slice(0,120)}` };
  }
}

function Editor(){
  const { id } = useParams<{id:string}>();
  const sb = createClient();
  const [report,setReport]=useState<Report|null>(null);
  const [activeSec,setActiveSec]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{ const r=await getReport(id); setReport(r); if(r?.sections?.length)setActiveSec(prev=>prev||r.sections![0].id); setLoading(false); },[id]);
  useEffect(()=>{ load(); },[load]);

  if(loading) return <div style={{display:"grid",placeItems:"center",height:"100vh",color:"var(--muted)"}}>Loading report…</div>;
  if(!report) return <div style={{display:"grid",placeItems:"center",height:"100vh",gap:12}}><div>Report not found.</div><Link className="btn btn-ghost" href="/">Back to reports</Link></div>;

  const section=report.sections?.find(s=>s.id===activeSec)||null;

  async function addFinding(){
    if(!section) return;
    const { data:{ user } } = await sb.auth.getUser();
    const { data } = await sb.from("findings").insert({
      section_id:section.id, report_id:report!.id, owner:user!.id,
      title:"", note:"", ai_text:"", severity:"monitor", sort_order:(section.findings?.length||0),
    }).select().single();
    if(data){ section.findings=[...(section.findings||[]),data as Finding]; setReport({...report!}); }
  }

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column"}}>
      <header style={{background:"var(--surface)",borderBottom:"1px solid var(--line)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14,height:56,padding:"0 20px"}}>
          <Link href="/" style={{display:"flex",alignItems:"center",gap:8,color:"var(--muted)",fontSize:13}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>Reports
          </Link>
          <div style={{width:1,height:22,background:"var(--line)"}}/>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:650,fontSize:14.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{report.address||"Untitled"}</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>{report.client||"—"}</div>
          </div>
          <div style={{flex:1}}/>
          <select value={report.theme||"estate"} onChange={async e=>{ await updateReport(report.id,{theme:e.target.value}); setReport({...report!,theme:e.target.value}); }} style={{padding:"7px 10px",border:"1px solid var(--line-2)",borderRadius:8,background:"var(--surface)",color:"var(--ink)",font:"inherit",fontSize:13,fontWeight:600}} title="Report theme">{THEME_LIST.map(t=>(<option key={t.id} value={t.id}>{t.name}</option>))}</select>
          <button className="btn btn-ghost" onClick={()=>window.open(`/report/${report.id}/print`,"_blank")}>Export PDF</button>
          <ShareButton report={report} />
        </div>
      </header>

      <div style={{flex:1,display:"flex",minHeight:0}}>
        <aside style={{width:280,borderRight:"1px solid var(--line)",background:"var(--surface)",overflow:"auto",flexShrink:0}}>
          <div style={{padding:"14px 16px",fontSize:11,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--faint)"}}>Sections · {report.sections?.length||0}</div>
          {report.sections?.map((s,i)=>{
            const hasF=(s.findings?.length||0)>0;
            return (
            <div key={s.id} onClick={()=>setActiveSec(s.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",cursor:"pointer",background:s.id===activeSec?"var(--accent-tint)":"transparent",borderLeft:s.id===activeSec?"3px solid var(--accent)":"3px solid transparent"}}>
              <span style={{fontSize:11,color:"var(--faint)",fontWeight:600,width:18}}>{String(i+1).padStart(2,"0")}</span>
              <span style={{flex:1,fontSize:13,fontWeight:s.id===activeSec?600:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name}</span>
              <span style={{width:7,height:7,borderRadius:"50%",background:hasF?"var(--ok)":"var(--line-2)"}}/>
            </div>);
          })}
        </aside>

        <main style={{flex:1,overflow:"auto",padding:"24px 28px"}}>
          <CoverPhoto report={report} onChange={()=>setReport({...report!})} />
          {section && <>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:4}}>
              <h1 style={{margin:0,fontSize:20,fontWeight:700}}>{section.name}</h1>
              <span style={{fontSize:11,color:"var(--faint)",textTransform:"uppercase",letterSpacing:".05em"}}>{section.grp}</span>
            </div>
            <p style={{margin:"0 0 20px",fontSize:13,color:"var(--muted)"}}>{section.subtitle||"Add findings, photos, and notes for this area."}</p>
            {(section.findings||[]).map(f=>(
              <FindingCard key={f.id} finding={f} report={report} area={section.name} onChange={()=>setReport({...report!})} />
            ))}
            <button className="btn btn-ghost" onClick={addFinding} style={{marginTop:6}}>+ Add finding</button>
          </>}
        </main>
      </div>
    </div>
  );
}

function CoverPhoto({report,onChange}:{report:Report;onChange:()=>void}){
  const sb=createClient();
  const [url,setUrl]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{ (async()=>{ if(report.cover_photo){ const { data }=await sb.storage.from("inspection-photos").createSignedUrl(report.cover_photo,3600); setUrl(data?.signedUrl||null);} else { setUrl(null);} })(); },[report.cover_photo]);
  async function onPhoto(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    setBusy(true);
    const fd=new FormData(); fd.append("file",file); fd.append("reportId",report.id);
    const res=await fetch("/api/upload",{method:"POST",body:fd});
    const j=await readJson(res);
    if(j.path){ await sb.from("reports").update({cover_photo:j.path}).eq("id",report.id); report.cover_photo=j.path; onChange(); }
    else alert(j.error||"Upload failed");
    setBusy(false);
  }
  async function remove(){ await sb.from("reports").update({cover_photo:null}).eq("id",report.id); report.cover_photo=null; onChange(); }
  return (
    <div className="card" style={{padding:14,marginBottom:20,display:"flex",gap:14,alignItems:"center"}}>
      <div style={{flexShrink:0}}>
        {url ? <img src={url} alt="" style={{width:140,height:92,objectFit:"cover",borderRadius:8,border:"1px solid var(--line)"}}/> :
          <label style={{width:140,height:92,border:"1px dashed var(--line-2)",borderRadius:8,display:"grid",placeItems:"center",cursor:"pointer",color:"var(--faint)",fontSize:12,textAlign:"center",padding:6}}>+ Front of house<input type="file" accept="image/*" style={{display:"none"}} onChange={onPhoto}/></label>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:650,fontSize:14.5}}>Cover photo</div>
        <div style={{fontSize:12.5,color:"var(--muted)",marginTop:2}}>The front-of-house image shown on page one of the report.</div>
        <div style={{display:"flex",gap:8,marginTop:9}}>
          <label className="btn btn-ghost" style={{padding:"6px 12px",fontSize:12.5,cursor:"pointer"}}>{busy?"Uploading…":(url?"Replace":"Upload front image")}<input type="file" accept="image/*" style={{display:"none"}} onChange={onPhoto}/></label>
          {url && <button className="btn btn-ghost" style={{padding:"6px 12px",fontSize:12.5}} onClick={remove}>Remove</button>}
        </div>
      </div>
    </div>
  );
}

function ShareButton({report}:{report:Report}){
  const [open,setOpen]=useState(false);
  const [share,setShare]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState("");
  async function ensure(){
    setBusy(true);
    const res=await fetch("/api/share",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reportId:report.id})});
    const j=await readJson(res); setShare(j.share); setBusy(false);
  }
  function openPanel(){ setOpen(true); if(!share) ensure(); }
  const link = share ? `${location.origin}/view/${share.code}` : "";
  async function regen(){ setBusy(true); const res=await fetch("/api/share",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({reportId:report.id,regenerate:true})}); const j=await readJson(res); setShare(j.share); setBusy(false); }
  function copy(text:string,what:string){ navigator.clipboard.writeText(text); setCopied(what); setTimeout(()=>setCopied(""),1500); }
  return (
    <>
      <button className="btn btn-primary" onClick={openPanel}>Share with client</button>
      {open && (
        <div style={{position:"fixed",inset:0,background:"rgba(16,24,40,.5)",zIndex:50,display:"grid",placeItems:"center",padding:20}} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
          <div className="card" style={{width:"100%",maxWidth:480,padding:24,boxShadow:"var(--shadow-lg)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <h2 style={{margin:0,fontSize:17,fontWeight:650}}>Share report with client</h2>
              <button onClick={()=>setOpen(false)} style={{border:0,background:"transparent",color:"var(--muted)",cursor:"pointer",fontSize:18}}>✕</button>
            </div>
            <p style={{fontSize:13,color:"var(--muted)",margin:"0 0 18px"}}>Send your client the link and password. They enter the password to view and download their report.</p>
            {busy && !share ? <div style={{padding:20,color:"var(--muted)"}}>Preparing link…</div> : share && (
              <>
                <div style={{marginBottom:14}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--ink-2)",marginBottom:5}}>Link</label>
                  <div style={{display:"flex",gap:8}}>
                    <input className="input" readOnly value={link} onFocus={e=>e.target.select()} style={{fontSize:13}}/>
                    <button className="btn btn-ghost" style={{whiteSpace:"nowrap"}} onClick={()=>copy(link,"link")}>{copied==="link"?"Copied":"Copy"}</button>
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--ink-2)",marginBottom:5}}>Password</label>
                  <div style={{display:"flex",gap:8}}>
                    <input className="input" readOnly value={share.password} style={{fontSize:16,letterSpacing:2,fontWeight:700}}/>
                    <button className="btn btn-ghost" style={{whiteSpace:"nowrap"}} onClick={()=>copy(share.password,"pw")}>{copied==="pw"?"Copied":"Copy"}</button>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <button className="btn btn-ghost" style={{fontSize:12.5}} onClick={regen} disabled={busy}>Generate new password</button>
                  <div style={{flex:1}}/>
                  <span style={{fontSize:12,color:"var(--muted)"}}>{share.views||0} views</span>
                </div>
                <div style={{marginTop:16,padding:12,background:"var(--surface-2)",borderRadius:8,fontSize:12.5,color:"var(--muted)"}}>
                  Tip: text or email the client both the link and password. Anyone with both can view this report.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FindingCard({finding,report,area,onChange}:{finding:Finding;report:Report;area?:string;onChange:()=>void}){
  const sb=createClient();
  const [f,setF]=useState(finding);
  const [busy,setBusy]=useState(false);
  const [photoUrl,setPhotoUrl]=useState<string|null>(null);
  const [annOpen,setAnnOpen]=useState(false);
  const [editingText,setEditingText]=useState(false);
  const shapes=normalizeShapes((f as any).annotations);

  useEffect(()=>{ (async()=>{ if(f.photo_path){ const { data }=await sb.storage.from("inspection-photos").createSignedUrl(f.photo_path,3600); setPhotoUrl(data?.signedUrl||null);} })(); },[f.photo_path]);

  const save=async(patch:Partial<Finding>)=>{ const nf={...f,...patch}; setF(nf); await sb.from("findings").update(patch).eq("id",f.id); };

  async function onPhoto(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return;
    setBusy(true);
    const fd=new FormData(); fd.append("file",file); fd.append("reportId",report.id);
    const res=await fetch("/api/upload",{method:"POST",body:fd});
    const j=await readJson(res);
    if(j.path){ await save({photo_path:j.path}); } else { alert(j.error||"Upload failed"); }
    setBusy(false);
  }

  async function rewrite(){
    setBusy(true);
    try{
      let j:any;
      if(f.photo_path && photoUrl){
        const blob=await (await fetch(photoUrl)).blob();
        const { data, mediaType } = await toAnalyzablePayload(blob);
        const res=await fetch("/api/analyze-photo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64:data,mediaType,note:f.note,area})});
        j=await readJson(res);
      } else {
        const res=await fetch("/api/rewrite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({note:f.note,area})});
        j=await readJson(res);
      }
      if(j?.text){
        const patch:Partial<Finding>={ ai_text:j.text };
        // Severity is re-decided on every rewrite, as requested.
        if(j.severity) patch.severity=j.severity as Severity;
        // A title you typed yourself is kept; the model only fills a blank one.
        if(j.title && !f.title?.trim()) patch.title=j.title;
        await save(patch);
      } else alert(j?.error||"AI error");
    }catch(e:any){ alert("AI unavailable: "+(e?.message||e)); }
    setBusy(false);
  }

  async function del(){ if(confirm("Delete this finding?")){ await sb.from("findings").delete().eq("id",f.id); const sec=report.sections?.find(s=>s.id===f.section_id); if(sec)sec.findings=sec.findings?.filter(x=>x.id!==f.id); onChange(); } }

  return (
    <div className="card" style={{padding:14,marginBottom:12}}>
      <div style={{display:"flex",gap:12}}>
        <div style={{width:96,flexShrink:0}}>
          {photoUrl ? (
            <>
              <div onClick={()=>setAnnOpen(true)} title="Click to annotate" style={{cursor:"pointer",border:"1px solid var(--line)",borderRadius:6,overflow:"hidden"}}>
                <AnnotatedPhoto src={photoUrl} shapes={shapes} height={72} aspect={96/72} strokeWidth={1.5} fontSize={6}/>
              </div>
              <button onClick={()=>setAnnOpen(true)} style={{width:"100%",marginTop:5,fontSize:11,fontWeight:600,padding:"4px 0",borderRadius:6,border:"1px solid var(--line-2)",background:"var(--surface)",color:"var(--muted)",cursor:"pointer"}}>
                {shapes.length?`Annotations (${shapes.length})`:"Annotate"}
              </button>
              <label style={{display:"block",textAlign:"center",marginTop:4,fontSize:10.5,color:"var(--faint)",cursor:"pointer"}}>Replace<input type="file" accept="image/*" style={{display:"none"}} onChange={onPhoto}/></label>
            </>
          ) :
            <label style={{width:96,height:72,border:"1px dashed var(--line-2)",borderRadius:6,display:"grid",placeItems:"center",cursor:"pointer",color:"var(--faint)",fontSize:22}}>+<input type="file" accept="image/*" style={{display:"none"}} onChange={onPhoto}/></label>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <input className="input" value={f.title} onChange={e=>setF({...f,title:e.target.value})} onBlur={e=>save({title:e.target.value})} placeholder="Finding title (e.g. Chimney &amp; Flashing)" style={{fontWeight:600,marginBottom:6}}/>
          <textarea className="input" value={f.note} onChange={e=>setF({...f,note:e.target.value})} onBlur={e=>save({note:e.target.value})} placeholder="Rough field note — type it how you'd say it out loud" style={{minHeight:56,resize:"vertical"}}/>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            {(["priority","monitor","satisfactory"] as Severity[]).map(s=>{const m=SEV_META[s];const on=f.severity===s;return(
              <button key={s} onClick={()=>save({severity:s})} style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20,cursor:"pointer",border:`1px solid ${on?m.c:"var(--line-2)"}`,background:on?m.bg:"var(--surface)",color:on?m.c:"var(--muted)"}}>{m.w}</button>);})}
          </div>
          <div style={{display:"flex",gap:8,marginTop:9}}>
            <button className="btn btn-primary" style={{padding:"6px 12px",fontSize:12.5}} disabled={busy} onClick={rewrite}>{busy?"Working…":"Rewrite with AI"}</button>
            <button className="btn btn-ghost" style={{padding:"6px 12px",fontSize:12.5}} onClick={del}>Delete</button>
          </div>
        </div>
      </div>
      {annOpen && photoUrl && (
        <AnnotationEditor src={photoUrl} initial={shapes}
          onClose={()=>setAnnOpen(false)}
          onSave={async(next:Shape[])=>{ await save({ annotations: next } as any); setAnnOpen(false); }} />
      )}
      <div style={{marginTop:11,paddingTop:11,borderTop:"1px dashed var(--line)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <div style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase",color:"var(--accent-2)",fontWeight:700}}>Report text</div>
          <div style={{flex:1}}/>
          {!editingText && <button onClick={()=>setEditingText(true)} style={{fontSize:11,fontWeight:600,color:"var(--muted)",background:"transparent",border:0,cursor:"pointer",padding:0}}>Edit</button>}
        </div>
        {editingText ? (
          /* This is what actually goes in the report, so it stays editable —
             the AI produces a draft, not the final word. */
          <textarea
            className="input" autoFocus
            value={f.ai_text||""}
            onChange={e=>setF({...f,ai_text:e.target.value})}
            onBlur={e=>{ save({ai_text:e.target.value}); setEditingText(false); }}
            placeholder="Write the report text for this finding"
            style={{minHeight:72,resize:"vertical",fontSize:13,lineHeight:1.55}}
          />
        ) : (
          <div onClick={()=>setEditingText(true)} title="Click to edit"
            style={{fontSize:13,cursor:"text",color:f.ai_text?"var(--ink)":"var(--faint)",fontStyle:f.ai_text?"normal":"italic"}}>
            {f.ai_text||"Not written yet — type a note and click Rewrite with AI, or click here to write it yourself."}
          </div>
        )}
      </div>
    </div>
  );
}
