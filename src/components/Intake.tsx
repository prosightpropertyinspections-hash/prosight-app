"use client";
import { useState } from "react";
import { ROOM_DEFS, SYS_DEFS, buildSkeleton } from "@/lib/skeleton";
import { createReportWithSections } from "@/lib/data";
import { useRouter } from "next/navigation";

const cap = (s:string)=>s.charAt(0).toUpperCase()+s.slice(1);

export default function Intake({ onClose }: { onClose: ()=>void }) {
  const router = useRouter();
  const [step,setStep]=useState(0);
  const [busy,setBusy]=useState(false);
  const [d,setD]=useState({
    property:{client:"",addr:"",date:new Date().toISOString().slice(0,10),time:"10:00",ptype:"Single-family dwelling",inspector:"Islam"},
    rooms:{bedroom:3,bathroom:2,kitchen:1,living:1,family:0,dining:0,laundry:1,office:0} as Record<string,number>,
    systems:{roofing:true,exterior:true,basement:true,crawlspace:false,mechanical:true,ac:true,deck:false,sewer:true} as Record<string,boolean>,
    garage:"attached", extras:[] as string[],
  });
  const [extra,setExtra]=useState("");
  const set=(patch:any)=>setD(p=>({...p,...patch}));

  async function create(){
    if(!d.property.client.trim()||!d.property.addr.trim()){ setStep(0); return; }
    setBusy(true);
    const sk=buildSkeleton(d);
    try{
      const rep=await createReportWithSections({
        status:"draft", client:d.property.client, address:d.property.addr,
        inspection_date:d.property.date, inspection_time:d.property.time,
        property_type:d.property.ptype, inspector:d.property.inspector,
        rooms:d.rooms, systems:d.systems, garage:d.garage, extras:d.extras, theme:"midnight",
      } as any, sk);
      router.push(`/report/${rep.id}`);
    }catch(e:any){ alert("Could not create report: "+e.message); setBusy(false); }
  }

  const valid = d.property.client.trim() && d.property.addr.trim();

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(16,24,40,.5)",zIndex:40,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 20px",overflow:"auto"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="card" style={{width:"100%",maxWidth:760,boxShadow:"var(--shadow-lg)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid var(--line)"}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:650}}>New inspection report</h2>
          <button onClick={onClose} style={{background:"transparent",border:0,color:"var(--muted)",cursor:"pointer",padding:6}}>✕</button>
        </div>
        <div style={{padding:"22px 24px",maxHeight:"64vh",overflow:"auto"}}>
          {step===0 && <>
            <H t="Property details" s="These populate the report cover automatically." />
            <F l="Client name *"><input className="input" value={d.property.client} onChange={e=>set({property:{...d.property,client:e.target.value}})} placeholder="Seth Anderson"/></F>
            <F l="Property address *"><input className="input" value={d.property.addr} onChange={e=>set({property:{...d.property,addr:e.target.value}})} placeholder="2422 Forrister Dr, Adrian, MI 49221"/></F>
            <Row><F l="Date"><input className="input" type="date" value={d.property.date} onChange={e=>set({property:{...d.property,date:e.target.value}})}/></F>
                 <F l="Time"><input className="input" type="time" value={d.property.time} onChange={e=>set({property:{...d.property,time:e.target.value}})}/></F></Row>
            <Row><F l="Property type"><select className="input" value={d.property.ptype} onChange={e=>set({property:{...d.property,ptype:e.target.value}})}>{["Single-family dwelling","Condo / townhouse","Multi-family","Manufactured home"].map(o=><option key={o}>{o}</option>)}</select></F>
                 <F l="Inspector"><input className="input" value={d.property.inspector} onChange={e=>set({property:{...d.property,inspector:e.target.value}})}/></F></Row>
          </>}
          {step===1 && <>
            <H t="Room counts" s="Each room becomes its own section — three bedrooms gives you Bedroom 1, 2, and 3." />
            {ROOM_DEFS.map(r=>(
              <Counter key={r.k} label={r.l} sub={r.s} val={d.rooms[r.k]}
                onDec={()=>set({rooms:{...d.rooms,[r.k]:Math.max(0,d.rooms[r.k]-1)}})}
                onInc={()=>set({rooms:{...d.rooms,[r.k]:d.rooms[r.k]+1}})} />
            ))}
          </>}
          {step===2 && <>
            <H t="Systems & structures" s="Anything set to No is left out of the report." />
            {SYS_DEFS.map(s=>(
              <Toggle key={s.k} label={s.l} sub={s.s} val={d.systems[s.k]} onSet={(v:boolean)=>set({systems:{...d.systems,[s.k]:v}})} />
            ))}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",border:"1px solid var(--line)",borderRadius:9,marginBottom:8}}>
              <div><div style={{fontWeight:600,fontSize:13.5}}>Garage</div><div style={{fontSize:12,color:"var(--faint)"}}>Attached, detached, or none</div></div>
              <Seg opts={["attached","detached","none"]} val={d.garage} onSet={(v)=>set({garage:v})} labels={["Attached","Detached","None"]}/>
            </div>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--faint)",margin:"20px 0 10px"}}>Additional areas</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
              {d.extras.length? d.extras.map((e,i)=>(<span key={i} style={{display:"inline-flex",alignItems:"center",gap:7,padding:"6px 8px 6px 12px",border:"1px solid var(--line-2)",borderRadius:7,fontSize:13,fontWeight:550}}>{e}<button onClick={()=>set({extras:d.extras.filter((_,j)=>j!==i)})} style={{border:0,background:"transparent",color:"var(--faint)",cursor:"pointer",fontSize:15}}>×</button></span>))
                : <span style={{fontSize:12,color:"var(--muted)"}}>None added yet.</span>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input className="input" style={{flex:1}} value={extra} onChange={e=>setExtra(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&extra.trim()){set({extras:[...d.extras,extra.trim()]});setExtra("");}}} placeholder="Add a custom area — e.g. Sunroom, Workshop"/>
              <button className="btn btn-ghost" onClick={()=>{if(extra.trim()){set({extras:[...d.extras,extra.trim()]});setExtra("");}}}>Add</button>
            </div>
          </>}
          {step===3 && <Review d={d} />}
        </div>
        <div style={{padding:"15px 24px",borderTop:"1px solid var(--line)",background:"var(--surface-2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:6}}>{[0,1,2,3].map(i=><span key={i} style={{width:i===step?20:7,height:7,borderRadius:i===step?4:"50%",background:i===step?"var(--accent)":"var(--line-2)"}}/>)}</div>
          <div style={{display:"flex",gap:10}}>
            {step>0 && <button className="btn btn-ghost" onClick={()=>setStep(step-1)}>Back</button>}
            {step<3 ? <button className="btn btn-primary" disabled={step===0&&!valid} onClick={()=>setStep(step+1)}>Continue</button>
                    : <button className="btn btn-primary" disabled={busy} onClick={create}>{busy?"Creating…":"Create report"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function H({t,s}:{t:string;s:string}){return <><div style={{fontSize:16,fontWeight:650,marginBottom:4}}>{t}</div><div style={{fontSize:13,color:"var(--muted)",marginBottom:18}}>{s}</div></>;}
function F({l,children}:{l:string;children:React.ReactNode}){return <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12.5,fontWeight:600,color:"var(--ink-2)",marginBottom:6}}>{l}</label>{children}</div>;}
function Row({children}:{children:React.ReactNode}){return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>;}
function Counter({label,sub,val,onDec,onInc}:any){return(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 14px",border:"1px solid var(--line)",borderRadius:9,marginBottom:8}}>
    <div><div style={{fontWeight:600,fontSize:13.5}}>{label}</div>{sub&&<div style={{fontSize:12,color:"var(--faint)"}}>{sub}</div>}</div>
    <div style={{display:"flex",alignItems:"center",border:"1px solid var(--line-2)",borderRadius:8,overflow:"hidden"}}>
      <button onClick={onDec} style={{width:32,height:32,border:0,background:"transparent",fontSize:16,cursor:"pointer"}}>−</button>
      <span style={{width:38,textAlign:"center",fontWeight:650,borderLeft:"1px solid var(--line)",borderRight:"1px solid var(--line)",height:32,lineHeight:"32px"}}>{val}</span>
      <button onClick={onInc} style={{width:32,height:32,border:0,background:"transparent",fontSize:16,cursor:"pointer"}}>+</button>
    </div>
  </div>);}
function Toggle({label,sub,val,onSet}:any){return(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 14px",border:"1px solid var(--line)",borderRadius:9,marginBottom:8}}>
    <div><div style={{fontWeight:600,fontSize:13.5}}>{label}</div>{sub&&<div style={{fontSize:12,color:"var(--faint)"}}>{sub}</div>}</div>
    <Seg opts={["1","0"]} val={val?"1":"0"} onSet={(v)=>onSet(v==="1")} labels={["Yes","No"]}/>
  </div>);}
function Seg({opts,val,onSet,labels}:{opts:string[];val:string;onSet:(v:string)=>void;labels:string[]}){return(
  <div style={{display:"inline-flex",border:"1px solid var(--line-2)",borderRadius:8,background:"var(--surface-2)",padding:2,gap:2}}>
    {opts.map((o,i)=>(<button key={o} onClick={()=>onSet(o)} style={{border:0,background:val===o?"var(--surface)":"transparent",color:val===o?"var(--accent)":"var(--muted)",padding:"6px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",borderRadius:6,boxShadow:val===o?"var(--shadow-sm)":"none"}}>{labels[i]}</button>))}
  </div>);}
function Review({d}:{d:any}){
  const sk=buildSkeleton(d);
  const rows=[["Client",d.property.client||"—"],["Type",d.property.ptype],["Address",d.property.addr||"—"],["Inspector",d.property.inspector],["Beds · Baths",`${d.rooms.bedroom} · ${d.rooms.bathroom}`],["Garage",cap(d.garage)]];
  return <>
    <H t="Review & create" s="You can add or remove sections after the report is created." />
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:"1px solid var(--line)",borderRadius:10,overflow:"hidden"}}>
      {rows.map((r,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"10px 14px",borderBottom:"1px solid var(--line)",fontSize:13}}><span style={{color:"var(--muted)"}}>{r[0]}</span><span style={{fontWeight:600}}>{r[1]}</span></div>))}
    </div>
    <div style={{fontSize:11,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:"var(--faint)",margin:"18px 0 10px"}}>Report sections · {sk.length}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
      {sk.map((a,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 11px",border:"1px solid var(--line)",borderRadius:8,background:"var(--surface-2)",fontSize:12.5}}><span style={{fontSize:11,color:"var(--faint)",fontWeight:600}}>{String(i+1).padStart(2,"0")}</span>{a.name}</div>))}
    </div>
  </>;
}
