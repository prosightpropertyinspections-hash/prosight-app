"use client";
import { useEffect, useState } from "react";
import { ROOM_DEFS, SYS_DEFS, buildSkeleton } from "@/lib/skeleton";
import { createReportWithSections } from "@/lib/data";
import { createClient } from "@/lib/supabase-browser";
import { loadProfile } from "@/lib/profile";
import { useRouter } from "next/navigation";

const cap = (s:string)=>s.charAt(0).toUpperCase()+s.slice(1);

/* Everything a booking already knows, so the wizard opens filled in rather than
   asking for details that were taken over the phone a week ago. */
export type IntakePrefill = {
  client?: string;
  addr?: string;
  date?: string;      // yyyy-mm-dd
  time?: string;      // HH:mm
  inspector?: string;
};

export default function Intake({
  onClose, prefill, appointmentId,
}: {
  onClose: ()=>void;
  prefill?: IntakePrefill;
  appointmentId?: string;
}) {
  const router = useRouter();
  const sb = createClient();
  const [step,setStep]=useState(0);
  const [busy,setBusy]=useState(false);
  const [d,setD]=useState({
    property:{
      client:prefill?.client||"",
      addr:prefill?.addr||"",
      date:prefill?.date||new Date().toISOString().slice(0,10),
      time:prefill?.time||"10:00",
      ptype:"Single-family dwelling",
      inspector:prefill?.inspector||"",
    },
    rooms:{bedroom:3,bathroom:2,kitchen:1,living:1,family:0,dining:0,laundry:1,office:0} as Record<string,number>,
    systems:{roofing:true,exterior:true,basement:true,crawlspace:false,attic:true,mechanical:true,
             electrical:true,ac:true,deck:false,backyard:false,thermal:false,sewer:true} as Record<string,boolean>,
    garage:"attached", extras:[] as string[],
  });
  const [theme,setTheme]=useState("estate");
  const [extra,setExtra]=useState("");
  const set=(patch:any)=>setD(p=>({...p,...patch}));

  /* Inspector and theme come from settings so they are not retyped per job. */
  useEffect(()=>{ (async()=>{
    const p = await loadProfile(sb);
    setTheme(p.default_theme || "estate");
    if(!prefill?.inspector && p.inspector_name){
      setD(prev=>({...prev, property:{...prev.property, inspector:p.inspector_name}}));
    }
  })(); },[]);

  async function create(){
    if(!d.property.client.trim()||!d.property.addr.trim()){ setStep(0); return; }
    setBusy(true);
    const sk=buildSkeleton(d);
    try{
      const rep=await createReportWithSections({
        status:"draft", client:d.property.client, address:d.property.addr,
        inspection_date:d.property.date, inspection_time:d.property.time,
        property_type:d.property.ptype, inspector:d.property.inspector,
        rooms:d.rooms, systems:d.systems, garage:d.garage, extras:d.extras, theme,
      } as any, sk);

      // Tie the report back to the booking it came from.
      if(appointmentId){
        await sb.from("appointments").update({ report_id: rep.id }).eq("id", appointmentId);
      }
      router.push(`/report/${rep.id}`);
    }catch(e:any){ alert("Could not create report: "+e.message); setBusy(false); }
  }

  const valid = d.property.client.trim() && d.property.addr.trim();

  return (
    <div className="ik" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <style dangerouslySetInnerHTML={{__html: IK_CSS }} />
      <div className="ik-sheet" onClick={e=>e.stopPropagation()}>
        <div className="ik-h">
          <div>
            <h2>New inspection report</h2>
            {appointmentId && <div className="ik-from">Started from a booking — details carried over</div>}
          </div>
          <button className="ik-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ik-b">
          {step===0 && <>
            <H t="Property details" s="These populate the report cover automatically." />
            <F l="Client name *"><input className="ik-in" value={d.property.client} onChange={e=>set({property:{...d.property,client:e.target.value}})} placeholder="Seth Anderson"/></F>
            <F l="Property address *"><input className="ik-in" value={d.property.addr} onChange={e=>set({property:{...d.property,addr:e.target.value}})} placeholder="2422 Forrister Dr, Adrian, MI 49221"/></F>
            <Row><F l="Date"><input className="ik-in" type="date" value={d.property.date} onChange={e=>set({property:{...d.property,date:e.target.value}})}/></F>
                 <F l="Time"><input className="ik-in" type="time" value={d.property.time} onChange={e=>set({property:{...d.property,time:e.target.value}})}/></F></Row>
            <Row><F l="Property type"><select className="ik-in" value={d.property.ptype} onChange={e=>set({property:{...d.property,ptype:e.target.value}})}>{["Single-family dwelling","Condo / townhouse","Multi-family","Manufactured home"].map(o=><option key={o}>{o}</option>)}</select></F>
                 <F l="Inspector"><input className="ik-in" value={d.property.inspector} onChange={e=>set({property:{...d.property,inspector:e.target.value}})} placeholder="Islam"/></F></Row>
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
              <Toggle key={s.k} label={s.l} sub={s.s} val={!!d.systems[s.k]} onSet={(v:boolean)=>set({systems:{...d.systems,[s.k]:v}})} />
            ))}
            <div className="ik-row">
              <div><div className="ik-row-t">Garage</div><div className="ik-row-s">Attached, detached, or none</div></div>
              <Seg opts={["attached","detached","none"]} val={d.garage} onSet={(v)=>set({garage:v})} labels={["Attached","Detached","None"]}/>
            </div>
            <div className="ik-cap">Additional areas</div>
            <div className="ik-tags">
              {d.extras.length? d.extras.map((e,i)=>(
                <span key={i} className="ik-tag">{e}
                  <button onClick={()=>set({extras:d.extras.filter((_,j)=>j!==i)})} aria-label="Remove">✕</button>
                </span>))
                : <span className="ik-none">None added yet.</span>}
            </div>
            <div style={{display:"flex",gap:9}}>
              <input className="ik-in" style={{flex:1}} value={extra} onChange={e=>setExtra(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&extra.trim()){set({extras:[...d.extras,extra.trim()]});setExtra("");}}}
                placeholder="Add a custom area — e.g. Sunroom, Workshop"/>
              <button className="ik-ghost" onClick={()=>{if(extra.trim()){set({extras:[...d.extras,extra.trim()]});setExtra("");}}}>Add</button>
            </div>
          </>}

          {step===3 && <Review d={d} />}
        </div>

        <div className="ik-f">
          <div className="ik-dots">{[0,1,2,3].map(i=><span key={i} data-on={i===step?"1":"0"}/>)}</div>
          <div style={{display:"flex",gap:10}}>
            {step>0 && <button className="ik-ghost" onClick={()=>setStep(step-1)}>Back</button>}
            {step<3
              ? <button className="ik-cta" disabled={step===0&&!valid} onClick={()=>setStep(step+1)}>Continue</button>
              : <button className="ik-cta" disabled={busy} onClick={create}>{busy?"Creating…":"Create report"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function H({t,s}:{t:string;s:string}){return <><div className="ik-ht">{t}</div><div className="ik-hs">{s}</div></>;}
function F({l,children}:{l:string;children:React.ReactNode}){return <div className="ik-f-wrap"><label>{l}</label>{children}</div>;}
function Row({children}:{children:React.ReactNode}){return <div className="ik-2col">{children}</div>;}

function Counter({label,sub,val,onDec,onInc}:any){return(
  <div className="ik-row">
    <div><div className="ik-row-t">{label}</div>{sub&&<div className="ik-row-s">{sub}</div>}</div>
    <div className="ik-count">
      <button onClick={onDec} aria-label="Fewer">−</button>
      <span>{val}</span>
      <button onClick={onInc} aria-label="More">+</button>
    </div>
  </div>);}

function Toggle({label,sub,val,onSet}:any){return(
  <div className="ik-row">
    <div><div className="ik-row-t">{label}</div>{sub&&<div className="ik-row-s">{sub}</div>}</div>
    <Seg opts={["1","0"]} val={val?"1":"0"} onSet={(v)=>onSet(v==="1")} labels={["Yes","No"]}/>
  </div>);}

function Seg({opts,val,onSet,labels}:{opts:string[];val:string;onSet:(v:string)=>void;labels:string[]}){return(
  <div className="ik-seg">
    {opts.map((o,i)=>(<button key={o} data-on={val===o?"1":"0"} onClick={()=>onSet(o)}>{labels[i]}</button>))}
  </div>);}

function Review({d}:{d:any}){
  const sk=buildSkeleton(d);
  const rows=[["Client",d.property.client||"—"],["Type",d.property.ptype],["Address",d.property.addr||"—"],
    ["Inspector",d.property.inspector||"—"],["Beds · Baths",`${d.rooms.bedroom} · ${d.rooms.bathroom}`],["Garage",cap(d.garage)]];
  return <>
    <H t="Review & create" s="You can add or remove sections after the report is created." />
    <div className="ik-review">
      {rows.map((r,i)=>(<div key={i}><span>{r[0]}</span><strong>{r[1]}</strong></div>))}
    </div>
    <div className="ik-cap">Report sections · {sk.length}</div>
    <div className="ik-secs">
      {sk.map((a,i)=>(<div key={i}><em>{String(i+1).padStart(2,"0")}</em>{a.name}</div>))}
    </div>
  </>;
}

const IK_CSS = `
.ik{ position:fixed; inset:0; z-index:70; display:flex; align-items:flex-start; justify-content:center;
  padding:38px 18px; overflow:auto; background:rgba(4,8,14,.72); backdrop-filter:blur(5px);
  --ik-line:#1d3048; --ik-panel:#0f1a2a; --ik-ink:#eaf2fa; --ik-ink2:#a8bbd0; --ik-faint:#6d8199; --ik-blue:#45b0ee;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif; color:var(--ik-ink);
}
.ik-sheet{ width:100%; max-width:760px; border:1px solid var(--ik-line); border-radius:16px; overflow:hidden;
  background:linear-gradient(160deg,#132234,#0b1421); box-shadow:0 34px 80px -22px rgba(0,0,0,.92); }
.ik-h{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:19px 24px;
  border-bottom:1px solid var(--ik-line); }
.ik-h h2{ margin:0; font-family:"Sora","Helvetica Neue",sans-serif; font-size:19px; font-weight:600; }
.ik-from{ font-size:12px; color:var(--ik-blue); margin-top:3px; }
.ik-x{ border:0; background:transparent; color:var(--ik-faint); font-size:15px; cursor:pointer; padding:6px; }
.ik-x:hover{ color:var(--ik-ink); }
.ik-b{ padding:22px 24px; max-height:62vh; overflow:auto; }

.ik-ht{ font-family:"Sora",sans-serif; font-size:16px; font-weight:600; margin-bottom:4px; }
.ik-hs{ font-size:13px; color:var(--ik-ink2); margin-bottom:18px; }
.ik-f-wrap{ margin-bottom:15px; }
.ik-f-wrap label{ display:block; font-size:12.5px; font-weight:600; color:var(--ik-ink2); margin-bottom:6px; }
.ik-2col{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.ik-in{ width:100%; padding:11px 13px; border:1px solid var(--ik-line); border-radius:9px;
  background:var(--ik-panel); color:var(--ik-ink); font:inherit; font-size:13.5px; }
.ik-in:focus{ outline:none; border-color:var(--ik-blue); box-shadow:0 0 0 3px rgba(69,176,238,.14); }

.ik-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px;
  border:1px solid var(--ik-line); border-radius:10px; margin-bottom:8px; background:rgba(15,26,42,.5); }
.ik-row-t{ font-weight:600; font-size:13.5px; }
.ik-row-s{ font-size:12px; color:var(--ik-faint); margin-top:1px; }
.ik-count{ display:flex; align-items:center; border:1px solid var(--ik-line); border-radius:9px; overflow:hidden; }
.ik-count button{ width:38px; height:38px; border:0; background:transparent; color:var(--ik-ink); font-size:17px; cursor:pointer; }
.ik-count button:hover{ background:rgba(69,176,238,.12); }
.ik-count span{ width:42px; text-align:center; font-weight:650; height:38px; line-height:38px;
  border-left:1px solid var(--ik-line); border-right:1px solid var(--ik-line); }
.ik-seg{ display:inline-flex; border:1px solid var(--ik-line); border-radius:9px; background:rgba(9,17,29,.7); padding:3px; gap:3px; }
.ik-seg button{ border:0; background:transparent; color:var(--ik-ink2); padding:8px 14px; font:inherit;
  font-weight:600; font-size:12.5px; cursor:pointer; border-radius:7px; }
.ik-seg button[data-on="1"]{ color:#fff; background:linear-gradient(150deg,#45b0ee,#1d6fa8); }

.ik-cap{ font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  color:var(--ik-faint); margin:20px 0 10px; }
.ik-tags{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
.ik-tag{ display:inline-flex; align-items:center; gap:8px; padding:7px 9px 7px 13px; border:1px solid var(--ik-line);
  border-radius:8px; font-size:13px; font-weight:550; }
.ik-tag button{ border:0; background:transparent; color:var(--ik-faint); cursor:pointer; font-size:12px; }
.ik-none{ font-size:12px; color:var(--ik-faint); }

.ik-review{ display:grid; grid-template-columns:1fr 1fr; border:1px solid var(--ik-line); border-radius:11px; overflow:hidden; }
.ik-review > div{ display:flex; justify-content:space-between; gap:12px; padding:11px 14px;
  border-bottom:1px solid var(--ik-line); font-size:13px; }
.ik-review span{ color:var(--ik-ink2); }
.ik-secs{ display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.ik-secs > div{ display:flex; align-items:center; gap:9px; padding:9px 11px; border:1px solid var(--ik-line);
  border-radius:9px; background:rgba(15,26,42,.5); font-size:12.5px; }
.ik-secs em{ font-style:normal; font-size:11px; color:var(--ik-faint); font-weight:600; }

.ik-f{ padding:16px 24px; border-top:1px solid var(--ik-line); display:flex; justify-content:space-between;
  align-items:center; background:linear-gradient(160deg,#111e2f,#0b1421); }
.ik-dots{ display:flex; gap:6px; }
.ik-dots span{ width:7px; height:7px; border-radius:50%; background:var(--ik-line); }
.ik-dots span[data-on="1"]{ width:20px; border-radius:4px; background:var(--ik-blue); }
.ik-ghost{ padding:11px 17px; border:1px solid var(--ik-line); border-radius:10px; background:transparent;
  color:var(--ik-ink2); font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; }
.ik-ghost:hover{ border-color:#2a4767; color:var(--ik-ink); }
.ik-cta{ padding:11px 20px; border:0; border-radius:10px; color:#fff; font:inherit; font-size:13.5px;
  font-weight:600; cursor:pointer; background:linear-gradient(150deg,#1a6fa9,#134d78);
  box-shadow:inset 0 1px 0 rgba(234,242,250,.14); }
.ik-cta:hover:not(:disabled){ background:linear-gradient(150deg,#2183c4,#175a8c); }
.ik-cta:disabled{ opacity:.5; cursor:not-allowed; }

.ik :focus-visible{ outline:2px solid var(--ik-blue); outline-offset:2px; border-radius:8px; }
@media (pointer:coarse){
  .ik-in, .ik-seg button{ font-size:16px; }
  .ik-count button, .ik-count span{ width:46px; height:46px; line-height:46px; }
  .ik-ghost, .ik-cta{ min-height:48px; }
}
@media (max-width:680px){
  .ik{ padding:16px 12px; }
  .ik-2col, .ik-review, .ik-secs{ grid-template-columns:1fr; }
  .ik-b{ max-height:66vh; padding:18px 16px; }
}
`;
