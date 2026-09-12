"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getReport, updateReport } from "@/lib/data";
import { createClient } from "@/lib/supabase-browser";
import type { Report } from "@/lib/types";
import ReportView from "@/components/ReportView";
import { THEME_LIST } from "@/lib/themes";

export default function PrintReport(){
  const { id } = useParams<{id:string}>();
  const sb = createClient();
  const sp = useSearchParams();
  const pdfMode = sp.get("pdf")==="1";
  const [dl,setDl]=useState(false);
  const [report,setReport]=useState<Report|null>(null);
  const [urls,setUrls]=useState<Record<string,string>>({});
  const [theme,setTheme]=useState<string>("estate");
  const [ready,setReady]=useState(false);

  useEffect(()=>{ (async()=>{
    const r = await getReport(id); setReport(r);
    if(r){
      setTheme(r.theme||"estate");
      const map:Record<string,string>={}; const paths:string[]=[];
      r.sections?.forEach(s=>s.findings?.forEach(f=>{ if(f.photo_path) paths.push(f.photo_path); }));
      if(r.cover_photo) paths.push(r.cover_photo);
      for(const p of paths){ const { data }=await sb.storage.from("inspection-photos").createSignedUrl(p,3600); if(data?.signedUrl) map[p]=data.signedUrl; }
      setUrls(map);
    }
    setReady(true);
  })(); },[id]);

  async function pick(tid:string){ setTheme(tid); if(report){ await updateReport(report.id,{theme:tid}); } }

  async function downloadPdf(){
    setDl(true);
    try{
      const res=await fetch(`/api/pdf?id=${id}`);
      if(!res.ok){ alert("PDF generation failed. Use Print / Save as PDF instead."); setDl(false); return; }
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=`ProSight-Report.pdf`; a.click();
      URL.revokeObjectURL(url);
    }catch(e){ alert("PDF generation failed. Use Print / Save as PDF instead."); }
    setDl(false);
  }

  if(!ready) return <div style={{padding:40,fontFamily:"Inter,sans-serif",color:"#667"}}>Preparing report…</div>;
  if(!report) return <div style={{padding:40}}>Report not found.</div>;

  return (
    <div style={{background:"#e9ebee",minHeight:"100vh"}}>
      {!pdfMode && <div className="noprint" style={{position:"sticky",top:0,zIndex:20,background:"#0d1420",color:"#fff",padding:"12px 20px",display:"flex",gap:14,alignItems:"center"}}>
        <strong style={{fontSize:14}}>Report preview</strong>
        <div style={{display:"flex",gap:6,flex:1,flexWrap:"wrap"}}>
          {THEME_LIST.map(t=>(
            <button key={t.id} onClick={()=>pick(t.id)} title={t.blurb}
              style={{border:theme===t.id?"1px solid #c98a4b":"1px solid #2c333c",background:theme===t.id?"#1c2530":"transparent",color:theme===t.id?"#fff":"#9aa4b2",padding:"6px 13px",borderRadius:7,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
              {t.name}
            </button>
          ))}
        </div>
        <button onClick={downloadPdf} disabled={dl} style={{background:"#2f9d6b",color:"#fff",border:0,padding:"8px 16px",borderRadius:7,fontWeight:700,cursor:"pointer",fontSize:13}}>{dl?"Generating…":"Download PDF"}</button>
        <button onClick={()=>window.print()} style={{background:"#c98a4b",color:"#0d1420",border:0,padding:"8px 16px",borderRadius:7,fontWeight:700,cursor:"pointer",fontSize:13}}>Print</button>
      </div>}
      <div style={{padding:"18px 0"}}>
        <ReportView report={report} urls={urls} themeId={theme}/>
      </div>
    </div>
  );
}
