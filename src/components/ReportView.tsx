"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import { buildModel, GRADE_DESC, coverImage } from "@/lib/report-model";
import { getTheme, THEME_FONT_HREF, ThemeTokens } from "@/lib/themes";
import { AnnotatedPhoto, normalizeShapes } from "@/components/Annotations";

function fmtDate(iso:string|null){ if(!iso)return "—"; return new Date(iso+"T00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); }

function Logo({ dark, height=48 }:{ dark?:boolean; height?:number }){
  // Real ProSight logo. White version on dark backgrounds, full-color on light — no plate/box.
  return <img src={dark?"/logo-ondark.svg":"/logo.svg"} alt="ProSight Property Inspections" style={{height,display:"block",width:"auto"}}/>;
}

/* Every page is a hard 8.5x11 box. Nothing may grow past it — growing past it is
   what pushed the bottom strip of each page onto its own sheet in print. */
const PAGE_BOX:React.CSSProperties = {
  position:"relative", width:"8.5in", height:"11in", overflow:"hidden",
  margin:"0 auto 16px", boxSizing:"border-box",
};

/* Flexible filler used on covers: soaks up whatever height is left over so the
   fixed blocks above and below always land inside the 11in box. */
const FILL:React.CSSProperties = { flex:"1 1 0", minHeight:0, display:"flex", overflow:"hidden" };

/* Pagination budget, in CSS px at 96dpi.
   A page is 11in tall with 46px of top padding. The footer is absolutely
   positioned 26px from the bottom and stands about 62px tall, so anything
   below ~958px would run underneath it. That is what made a third finding
   print straight through the footer and off the sheet. */
const PAGE_PX = 11 * 96;
const PAD_TOP = 46;
const FOOT_RESERVE = 104;
const SAFETY_PX = 10;                       // absorbs sub-pixel line-height rounding
const USABLE_PX = PAGE_PX - PAD_TOP - FOOT_RESERVE - SAFETY_PX;
const CONTENT_W = 8.5 * 96 - 108;   // page width minus left+right padding

type Chunk = { sec:any; g:any; idx:number; findings:any[]; part:number; parts:number };
type ExecBlock = { key:string; kind:"p"|"mh"|"m"; x?:any };
type ExecChunk = { blocks:ExecBlock[]; part:number; parts:number };

/* The executive summary is a flat run of blocks, so it paginates the same way
   a section does. Built in one place: the measuring pass and the render must
   walk an identical list or the packing is meaningless. */
function execBlocks(M:any):ExecBlock[]{
  const out:ExecBlock[] = M.priority.map((x:any,i:number)=>({ key:`p${i}`, kind:"p" as const, x }));
  const mons = M.monitor.slice(0,7);
  if(mons.length){
    out.push({ key:"mh", kind:"mh" });
    mons.forEach((x:any,i:number)=> out.push({ key:`m${i}`, kind:"m" as const, x }));
  }
  return out;
}

function outerHeight(el: Element){
  const cs = getComputedStyle(el as HTMLElement);
  return (el as HTMLElement).getBoundingClientRect().height
       + parseFloat(cs.marginTop || "0") + parseFloat(cs.marginBottom || "0");
}
const FILL_IMG:React.CSSProperties = { width:"100%", height:"100%", objectFit:"cover" };

export default function ReportView({ report, urls, themeId }:{ report:Report; urls:Record<string,string>; themeId?:string|null; }){
  const t = getTheme(themeId);
  const M = buildModel(report);
  const cover = coverImage(report, urls, M.allF);
  const reportNo = report.report_no || `PSPI-${(report.id||"").slice(0,8).toUpperCase()}`;

  /* Findings are measured off-screen at the real page width, then packed into
     as many pages as they need. Photos vary too much in aspect ratio to
     estimate: a wrong guess silently clips a finding out of the report. */
  const measureRef = useRef<HTMLDivElement|null>(null);
  const [chunks,setChunks] = useState<Chunk[]|null>(null);
  const [execChunks,setExecChunks] = useState<ExecChunk[]|null>(null);

  useLayoutEffect(()=>{ setChunks(null); setExecChunks(null); },[report, themeId]);

  useEffect(()=>{
    const root = measureRef.current;
    if(!root || (chunks && execChunks)) return;
    let dead = false;

    const imgs = Array.from(root.querySelectorAll("img"));
    const settled = imgs.map(im => (im as HTMLImageElement).complete
      ? Promise.resolve()
      : new Promise<void>(done => { (im as HTMLImageElement).onload = (im as HTMLImageElement).onerror = () => done(); }));

    Promise.all(settled).then(()=>{
      if(dead || !measureRef.current) return;
      const hdrH:Record<string,number> = {};
      measureRef.current.querySelectorAll("[data-mh]").forEach(el=>{
        hdrH[(el as HTMLElement).dataset.mh!] = outerHeight(el);
      });
      const findH:Record<string,number> = {};
      measureRef.current.querySelectorAll("[data-mf]").forEach(el=>{
        findH[(el as HTMLElement).dataset.mf!] = outerHeight(el);
      });

      const out:Chunk[] = [];
      M.withF.forEach((sec:any, idx:number)=>{
        const g = M.graded.find((x:any)=>x.section.id===sec.id);
        const budget = USABLE_PX - (hdrH[sec.id] || 0);
        const pages:any[][] = [];
        let cur:any[] = [];
        let used = 0;
        (sec.findings||[]).forEach((f:any)=>{
          const h = findH[f.id] ?? 0;
          if(cur.length && used + h > budget){ pages.push(cur); cur=[]; used=0; }
          cur.push(f); used += h;
        });
        if(cur.length || !pages.length) pages.push(cur);
        pages.forEach((fs,i)=> out.push({ sec, g, idx, findings:fs, part:i+1, parts:pages.length }));
      });
      setChunks(out);

      const eb = execBlocks(M);
      const headH = Number((measureRef.current.querySelector('[data-me="head"]') as HTMLElement)?.getBoundingClientRect().height || 0);
      const contH = Number((measureRef.current.querySelector('[data-me="cont"]') as HTMLElement)?.getBoundingClientRect().height || 0);
      const blockH:Record<string,number> = {};
      measureRef.current.querySelectorAll("[data-mb]").forEach(el=>{
        blockH[(el as HTMLElement).dataset.mb!] = outerHeight(el);
      });

      const epages:ExecBlock[][] = [];
      let ecur:ExecBlock[] = [];
      let eused = 0;
      let ebudget = USABLE_PX - headH;
      eb.forEach(b=>{
        const h = blockH[b.key] ?? 0;
        if(ecur.length && eused + h > ebudget){
          epages.push(ecur); ecur = []; eused = 0;
          ebudget = USABLE_PX - contH;   // later pages carry only the heading
        }
        ecur.push(b); eused += h;
      });
      if(ecur.length || !epages.length) epages.push(ecur);
      setExecChunks(epages.map((blocks,i)=>({ blocks, part:i+1, parts:epages.length })));
    });

    return ()=>{ dead = true; };
  },[report, themeId, urls, chunks, execChunks, M]);

  /* A page is a fixed 8.5in wide, which overflows a phone. Zoom is used rather
     than transform because it affects layout, so the page genuinely becomes
     narrower instead of overhanging with a scrollbar. It is applied to .rv-page
     only — the off-screen measuring pass must keep its true pixel sizes, or
     pagination would pack the wrong number of findings per sheet. */
  useEffect(()=>{
    const fit = () => {
      const avail = Math.min(window.innerWidth - 16, document.documentElement.clientWidth - 16);
      const z = Math.min(1, avail / (8.5 * 96));
      document.documentElement.style.setProperty("--rv-zoom", String(z > 0 ? z : 1));
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  },[]);

  // Dev helper: warns in the console if any page's content is taller than the
  // sheet, so an overflow never silently becomes a clipped or spilled page again.
  useEffect(()=>{
    const id = setTimeout(()=>{
      document.querySelectorAll(".rv-page").forEach((p,i)=>{
        const el = p as HTMLElement;
        const over = el.scrollHeight - el.clientHeight;
        if(over > 1) console.warn(`[rv] page ${i+1} overflows its sheet by ${over}px — it will clip in print.`);
      });
    }, 1500);
    return ()=>clearTimeout(id);
  }, [report, themeId]);

  const pageBase:React.CSSProperties = {
    ...PAGE_BOX,
    background:t.pageBg, color:t.ink, padding:"46px 54px 64px",
    fontFamily:t.bodyFont,
  };

  const coverBase:React.CSSProperties = {
    ...PAGE_BOX,
    display:"flex", flexDirection:"column",
    fontFamily:t.bodyFont,
  };

  return (
    <div>
      <link href={THEME_FONT_HREF} rel="stylesheet" />
      <style>{`
        @page { size: letter; margin: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing:border-box; }
        html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .rv-page{ box-shadow:0 2px 16px rgba(0,0,0,.14); box-sizing:border-box; width:8.5in; height:11in; overflow:hidden; }
        @media screen { .rv-page{ zoom: var(--rv-zoom, 1); } }
        @media print {
          .noprint{ display:none !important; }
          html, body { margin:0 !important; padding:0 !important; }
          .rv-shell{ padding:0 !important; background:#fff !important; min-height:0 !important; }
          .rv-page{
            zoom:1 !important;
            box-shadow:none !important;
            margin:0 !important;
            width:8.5in !important;
            /* 10.98in not 11in: Chrome rounds sub-pixel, and a box exactly the
               height of the sheet spills a hairline onto the next one. */
            height:10.98in !important;
            max-height:10.98in !important;
            min-height:0 !important;
            overflow:hidden !important;
            page-break-after:auto;
            break-inside:avoid;
          }
          /* Break BEFORE each page except the first. Using :first-child here does
             not work — the first child of the wrapper is the <link> tag, not the
             cover — so this sibling rule is used instead. */
          .rv-page{ page-break-before:auto; }
          .rv-page + .rv-page{ page-break-before:always; }
        }
        .rv-foot{ position:absolute; bottom:26px; left:54px; right:54px; display:flex; justify-content:space-between; font-size:8.5px; }
      `}</style>

      {t.coverStyle==="monograph" && <MonographCover t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="obsidian"  && <ObsidianCover  t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="warrant"   && <WarrantCover   t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="vanguard"  && <VanguardCover  t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="terra"     && <TerraCover     t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="noir"      && <NoirCover      t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="aurora"    && <AuroraCover    t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="prestige"  && <PrestigeCover  t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="blueprint" && <BlueprintCover t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}

      <AboutPage t={t} report={report} pageBase={pageBase} reportNo={reportNo} pageNo={2}/>
      <GradePage t={t} report={report} M={M} pageBase={pageBase} reportNo={reportNo} pageNo={3}/>
      {(execChunks ?? [{ blocks: execBlocks(M), part:1, parts:1 }]).map((ec:ExecChunk,i:number)=>(
        <ExecPage key={`exec-${ec.part}`} t={t} report={report} M={M}
          blocks={ec.blocks} part={ec.part} parts={ec.parts}
          pageBase={pageBase} reportNo={reportNo} pageNo={4+i}/>
      ))}

      {(chunks ?? M.withF.map((s:any,i:number)=>({
          sec:s, g:M.graded.find((x:any)=>x.section.id===s.id), idx:i,
          findings:s.findings||[], part:1, parts:1,
        }))).map((c:Chunk,i:number)=>(
        <SectionPage key={`${c.sec.id}-${c.part}`} t={t} s={c.sec} g={c.g} idx={c.idx}
          findings={c.findings} part={c.part} parts={c.parts}
          urls={urls} pageBase={pageBase} reportNo={reportNo} address={report.address}
          pageNo={4 + (execChunks ? execChunks.length : 1) + i}/>
      ))}

      <ScopePage t={t} report={report} pageBase={pageBase} reportNo={reportNo}
        pageNo={4 + (execChunks ? execChunks.length : 1) + (chunks ? chunks.length : M.withF.length)}/>

      {/* Off-screen measuring pass. Removed from the document once packed. */}
      {!chunks && (
        <div ref={measureRef} aria-hidden className="noprint"
          style={{position:"absolute",left:-99999,top:0,width:CONTENT_W,visibility:"hidden",pointerEvents:"none",fontFamily:t.bodyFont,color:t.ink,background:t.pageBg}}>
          <div data-me="head">
            <SecTitle t={t} title="Executive Summary" sub={`Most significant findings from the inspection of ${report.address}`}/>
            <ExecCounts t={t} M={M}/>
            <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700,margin:"0 0 10px"}}>Priority Findings</div>
          </div>
          <div data-me="cont">
            <SecTitle t={t} title="Executive Summary (continued)" sub={`Page 2 of 2 · ${report.address}`}/>
            <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700,margin:"12px 0 10px"}}>Priority Findings (continued)</div>
          </div>
          {execBlocks(M).map(b=>(
            <div key={b.key} data-mb={b.key}><ExecBlockView t={t} b={b}/></div>
          ))}
          {M.withF.map((sec:any,i:number)=>{
            const g=M.graded.find((x:any)=>x.section.id===sec.id);
            return (
              <div key={sec.id}>
                <div data-mh={sec.id}><SectionHeader t={t} s={sec} g={g} idx={i} part={1} parts={1}/></div>
                {(sec.findings||[]).map((f:any)=>(
                  <div key={f.id} data-mf={f.id}><FindingCard t={t} f={f} urls={urls}/></div>
                ))}
              </div>
            );
          })}
        </div>
      )}
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

/* ---------------- COVERS ----------------
   Every cover is a flex column inside a hard 11in box. The image block carries
   flex:1 so it absorbs leftover space; the blocks above and below it keep their
   fixed sizes. Previously these used min-height:11in and simply grew past the
   sheet, which is what put the bottom strip on a page of its own.            */

function MonographCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0}}>
      <div style={{padding:"64px 64px 0",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderBottom:`1px solid ${t.accent}`,paddingBottom:18}}>
          <Logo height={160}/>
          <div style={{fontSize:10,letterSpacing:2,color:t.sub}}>{reportNo}</div>
        </div>
      </div>
      <div style={{padding:"48px 64px 0",flexShrink:0}}>
        <div style={{fontFamily:t.bodyFont,fontSize:11,letterSpacing:4,color:t.accent,textTransform:"uppercase",marginBottom:20}}>Confidential Property Inspection</div>
        <div style={{fontFamily:t.displayFont,fontSize:52,lineHeight:1.05,fontWeight:600,letterSpacing:"-.5px"}}>{report.address||"Property address"}</div>
      </div>
      <div style={{...FILL,margin:"40px 64px 0"}}>
        {cover && <img src={cover} style={FILL_IMG}/>}
      </div>
      <div style={{padding:"36px 64px",display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexShrink:0}}>
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

function ObsidianCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:"54px 54px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:44,flexShrink:0}}>
        <Logo dark height={144}/>
        <div style={{fontFamily:t.displayFont,fontSize:10,letterSpacing:2,color:t.sub}}>{reportNo}</div>
      </div>
      <div style={{fontFamily:t.displayFont,fontSize:13,letterSpacing:5,color:t.coverAccent,textTransform:"uppercase",marginBottom:16,flexShrink:0}}>Inspection Report</div>
      <div style={{fontFamily:t.displayFont,fontSize:44,fontWeight:700,lineHeight:1.08,letterSpacing:"-1px",marginBottom:30,flexShrink:0}}>{report.address||"Property address"}</div>
      <div style={{...FILL,marginBottom:30,borderRadius:t.radius}}>
        {cover && <img src={cover} style={{...FILL_IMG,borderRadius:t.radius}}/>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:t.hair,border:`1px solid ${t.hair}`,borderRadius:t.radius,overflow:"hidden",flexShrink:0}}>
        {[["Systems",M.withF.length,t.coverInk],["Priority",M.cP,t.sev.priority.c],["Grade",M.overall,t.gradeColor[M.overall]]].map((x:any,i:number)=>(
          <div key={i} style={{background:t.coverBg,padding:"22px 18px"}}>
            <div style={{fontFamily:t.displayFont,fontSize:34,fontWeight:700,color:x[2]}}>{x[1]}</div>
            <div style={{fontSize:9,letterSpacing:1.5,color:t.sub,textTransform:"uppercase",marginTop:2}}>{x[0]}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:34,display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderTop:`1px solid ${t.hair}`,paddingTop:22,flexShrink:0}}>
        <div><div style={{fontSize:9,letterSpacing:2,color:t.sub,textTransform:"uppercase"}}>Prepared exclusively for</div>
        <div style={{fontSize:22,fontWeight:600,marginTop:3}}>{report.client||"—"}</div></div>
        <div style={{fontSize:12,color:t.sub,textAlign:"right"}}>{fmtDate(report.inspection_date)}<br/>Inspector {report.inspector||"—"}</div>
      </div>
    </div>
  );
}

function WarrantCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.pageBg,color:t.ink,padding:0}}>
      <div style={{background:t.coverBg,color:t.coverInk,padding:"40px 54px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <Logo dark height={152}/>
          <div style={{textAlign:"right",fontSize:10,color:"#9fb4c9"}}>REPORT NO.<br/><span style={{color:t.coverInk,fontWeight:700,fontSize:12}}>{reportNo}</span></div>
        </div>
      </div>
      <div style={{height:4,background:t.coverAccent,flexShrink:0}}/>
      <div style={{padding:"46px 54px 0",flexShrink:0}}>
        <div style={{fontSize:11,letterSpacing:3,color:t.accent2,textTransform:"uppercase",marginBottom:14}}>Confidential Inspection Report</div>
        <div style={{fontFamily:t.displayFont,fontSize:34,fontWeight:700,lineHeight:1.15}}>{report.address||"Property address"}</div>
      </div>
      <div style={{...FILL,margin:"32px 54px 0"}}>
        {cover && <img src={cover} style={{...FILL_IMG,borderRadius:t.radius,border:`1px solid ${t.hair}`}}/>}
      </div>
      <div style={{margin:"32px 54px 54px",border:`1px solid ${t.hair}`,borderRadius:t.radius,flexShrink:0}}>
        {[["Client",report.client||"—"],["Inspection date",fmtDate(report.inspection_date)],["Inspector",report.inspector||"—"],["Overall grade",`${M.overall} — ${GRADE_DESC[M.overall].split(" — ")[0]}`]].map((r:any,i:number,a:any)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 16px",borderBottom:i<a.length-1?`1px solid ${t.hair}`:"none",fontSize:13}}>
            <span style={{color:t.sub}}>{r[0]}</span><span style={{fontWeight:700}}>{r[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VanguardCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0}}>
      <div style={{padding:"48px 54px 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <Logo dark height={144}/>
        <div style={{fontSize:11,color:t.coverAccent,fontWeight:700}}>{reportNo}</div>
      </div>
      <div style={{padding:"70px 54px 0",flexShrink:0}}>
        <div style={{width:60,height:6,background:t.coverAccent,marginBottom:26}}/>
        <div style={{fontFamily:t.displayFont,fontSize:64,fontWeight:700,lineHeight:.98,letterSpacing:"-2px"}}>{report.address||"Property address"}</div>
        <div style={{fontFamily:t.displayFont,fontSize:15,letterSpacing:6,color:t.coverAccent,textTransform:"uppercase",marginTop:24}}>Inspection Report</div>
      </div>
      <div style={{...FILL,margin:"44px 0 0"}}>
        {cover && <img src={cover} style={FILL_IMG}/>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",flexShrink:0}}>
        {[["Systems",M.withF.length],["Priority",M.cP],["Grade",M.overall]].map((x:any,i:number)=>(
          <div key={i} style={{padding:"28px 54px",borderTop:`6px solid ${i===2?t.gradeColor[M.overall]:t.coverAccent}`,borderRight:i<2?`1px solid rgba(255,255,255,.12)`:"none"}}>
            <div style={{fontFamily:t.displayFont,fontSize:46,fontWeight:700,lineHeight:1}}>{x[1]}</div>
            <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,.6)",textTransform:"uppercase",marginTop:4}}>{x[0]}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"26px 54px",display:"flex",justifyContent:"space-between",alignItems:"baseline",flexShrink:0}}>
        <div style={{fontSize:20,fontWeight:700}}>{report.client||"—"}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>{fmtDate(report.inspection_date)} · {report.inspector||"—"}</div>
      </div>
    </div>
  );
}

function TerraCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:"56px 56px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:40,paddingBottom:20,borderBottom:`1px solid ${t.coverAccent}`,flexShrink:0}}>
        <Logo dark height={152}/>
        <div style={{fontSize:10,letterSpacing:2,color:t.coverAccent}}>{reportNo}</div>
      </div>
      <div style={{fontSize:11,letterSpacing:4,color:t.coverAccent,textTransform:"uppercase",marginBottom:18,flexShrink:0}}>Confidential Property Inspection</div>
      <div style={{fontFamily:t.displayFont,fontSize:46,fontWeight:600,lineHeight:1.1,letterSpacing:"-.5px",flexShrink:0}}>{report.address||"Property address"}</div>
      <div style={{...FILL,margin:"34px 0"}}>
        {cover && <img src={cover} style={{...FILL_IMG,borderRadius:12}}/>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexShrink:0}}>
        <div>
          <div style={{fontSize:10,letterSpacing:2,color:t.coverAccent,textTransform:"uppercase"}}>Prepared for</div>
          <div style={{fontFamily:t.displayFont,fontSize:28,fontWeight:600,marginTop:2}}>{report.client||"—"}</div>
          <div style={{fontSize:12,color:"rgba(247,240,230,.7)",marginTop:8}}>{fmtDate(report.inspection_date)} · Inspector {report.inspector||"—"}</div>
        </div>
        <div style={{width:92,height:92,borderRadius:"50%",background:t.coverAccent,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:t.coverBg,flexShrink:0}}>
          <div style={{fontFamily:t.displayFont,fontSize:38,fontWeight:700,lineHeight:1}}>{M.overall}</div>
          <div style={{fontSize:7.5,letterSpacing:1.5,textTransform:"uppercase"}}>Overall</div>
        </div>
      </div>
    </div>
  );
}

function NoirCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0}}>
      <div style={{padding:"54px 56px 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <Logo dark height={140}/>
        <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,.5)"}}>{reportNo}</div>
      </div>
      <div style={{padding:"90px 56px 0",textAlign:"center",flexShrink:0}}>
        <div style={{fontSize:11,letterSpacing:8,textTransform:"uppercase",color:"rgba(255,255,255,.55)",marginBottom:26}}>Inspection Report</div>
        <div style={{fontFamily:t.displayFont,fontSize:50,fontWeight:700,lineHeight:1.1,letterSpacing:"-.5px"}}>{report.address||"Property address"}</div>
        <div style={{width:40,height:1,background:"#fff",margin:"30px auto"}}/>
        <div style={{fontSize:13,letterSpacing:2,color:"rgba(255,255,255,.8)"}}>{report.client||"—"}</div>
      </div>
      <div style={{...FILL,margin:"56px 0 0"}}>
        {cover && <img src={cover} style={{...FILL_IMG,filter:"grayscale(1) contrast(1.05)"}}/>}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:0,borderTop:"1px solid rgba(255,255,255,.18)",flexShrink:0}}>
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

function AuroraCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0,display:"block"}}>
      {cover && <img src={cover} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>}
      <div style={{position:"absolute",inset:0,background:cover?"linear-gradient(180deg, rgba(11,13,24,.35) 0%, rgba(11,13,24,.15) 40%, rgba(11,13,24,.92) 100%)":"linear-gradient(135deg,#1a1145,#0b0d18)"}}/>
      <div style={{position:"absolute",top:"-20%",right:"-10%",width:"70%",height:"55%",background:"radial-gradient(circle, rgba(109,74,255,.55), transparent 70%)",filter:"blur(20px)"}}/>
      <div style={{position:"absolute",top:"10%",left:"-15%",width:"55%",height:"45%",background:"radial-gradient(circle, rgba(255,77,141,.4), transparent 70%)",filter:"blur(20px)"}}/>
      <div style={{position:"relative",height:"100%",display:"flex",flexDirection:"column",padding:"54px 54px",boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <Logo dark height={144}/>
          <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,.7)"}}>{reportNo}</div>
        </div>
        <div style={{flex:"1 1 0",minHeight:0}}/>
        <div style={{flexShrink:0}}>
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

function PrestigeCover({t,report,cover,M,reportNo,base}:any){
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0,display:"block"}}>
      <div style={{position:"absolute",top:"-15%",left:"50%",transform:"translateX(-50%)",width:"90%",height:"50%",background:"radial-gradient(ellipse, rgba(212,175,95,.22), transparent 70%)",filter:"blur(10px)"}}/>
      <div style={{position:"relative",height:"100%",display:"flex",flexDirection:"column",padding:"56px 60px",boxSizing:"border-box"}}>
        <div style={{textAlign:"center",borderBottom:`1px solid ${t.coverAccent}66`,paddingBottom:22,marginBottom:34,flexShrink:0}}>
          <Logo dark height={176}/>
          <div style={{fontSize:9,letterSpacing:4,color:t.coverAccent,textTransform:"uppercase",marginTop:6}}>Established Excellence · AdjusterFlow L.L.C.</div>
        </div>
        <div style={{textAlign:"center",flexShrink:0}}>
          <div style={{fontSize:10,letterSpacing:5,color:t.coverAccent,textTransform:"uppercase",marginBottom:20}}>Confidential Inspection Report</div>
          <div style={{fontFamily:t.displayFont,fontSize:46,fontWeight:600,lineHeight:1.1,letterSpacing:"-.5px"}}>{report.address||"Property address"}</div>
        </div>
        <div style={{...FILL,margin:"34px 0",position:"relative"}}>
          {cover && <>
            <img src={cover} style={{...FILL_IMG,borderRadius:t.radius}}/>
            <div style={{position:"absolute",inset:0,borderRadius:t.radius,boxShadow:`inset 0 0 0 1px ${t.coverAccent}55, inset 0 -60px 60px -30px rgba(14,42,31,.7)`}}/>
          </>}
        </div>
        <div style={{textAlign:"center",flexShrink:0}}>
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

function BlueprintCover({t,report,cover,M,reportNo,base}:any){
  const grid=`linear-gradient(rgba(77,141,255,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(77,141,255,.10) 1px, transparent 1px)`;
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0,display:"block"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:grid,backgroundSize:"32px 32px"}}/>
      <div style={{position:"absolute",bottom:"-10%",right:"-5%",width:"60%",height:"45%",background:"radial-gradient(circle, rgba(0,194,209,.35), transparent 70%)",filter:"blur(24px)"}}/>
      <div style={{position:"relative",height:"100%",display:"flex",flexDirection:"column",padding:"54px 56px",boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:40,flexShrink:0}}>
          <Logo dark height={144}/>
          <div style={{fontSize:10,letterSpacing:2,color:t.coverAccent,fontFamily:"monospace"}}>{reportNo}</div>
        </div>
        <div style={{fontSize:12,letterSpacing:5,color:t.coverAccent,textTransform:"uppercase",marginBottom:18,fontFamily:"monospace",flexShrink:0}}>◦ Inspection Report</div>
        <div style={{fontFamily:t.displayFont,fontSize:48,fontWeight:700,lineHeight:1.05,letterSpacing:"-1px",flexShrink:0}}>{report.address||"Property address"}</div>
        <div style={{height:2,width:120,background:`linear-gradient(90deg,${t.coverAccent},transparent)`,margin:"22px 0",boxShadow:`0 0 12px ${t.coverAccent}`,flexShrink:0}}/>
        <div style={{...FILL}}>
          {cover && <img src={cover} style={{...FILL_IMG,borderRadius:t.radius,border:`1px solid ${t.coverAccent}44`}}/>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:26,flexShrink:0}}>
          {[["Systems",M.withF.length,t.coverInk],["Priority",M.cP,t.sev.priority.c],["Grade",M.overall,t.gradeColor[M.overall]]].map((x:any,i:number)=>(
            <div key={i} style={{border:`1px solid ${t.coverAccent}33`,borderRadius:t.radius,padding:"16px 18px",background:"rgba(77,141,255,.06)"}}>
              <div style={{fontFamily:t.displayFont,fontSize:32,fontWeight:700,color:x[2]}}>{x[1]}</div>
              <div style={{fontSize:9,letterSpacing:1.5,color:"rgba(234,240,255,.55)",textTransform:"uppercase",marginTop:2,fontFamily:"monospace"}}>{x[0]}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:26,fontSize:12,color:"rgba(234,240,255,.7)",flexShrink:0}}>Prepared for <strong style={{color:t.coverInk}}>{report.client||"—"}</strong> · {fmtDate(report.inspection_date)}</div>
      </div>
    </div>
  );
}

function AboutPage({t,report,pageBase,reportNo,pageNo}:any){
  const lay=t.layout;
  const cardBg = t.pageBg==="#0e0f12" ? "#15171b" : (lay==="technical" ? "transparent" : "#f6f5f1");
  const pill = (title:string, body:string) => (
    <div style={{marginBottom:14}}>
      <div style={{fontFamily:t.displayFont,fontSize:14,fontWeight:700,color:t.accent,marginBottom:5}}>{title}</div>
      <div style={{fontSize:11.5,color:t.sub,lineHeight:1.65}}>{body}</div>
    </div>
  );
  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t} title="About This Inspection" sub="Standards of practice & our commitment to you"/>
      <div style={{background:cardBg,borderRadius:t.radius,padding:18,margin:"8px 0 18px",border:lay==="technical"?`1px solid ${t.hair}`:(lay==="band"?`1px solid ${t.hair}`:"none")}}>
        <div style={{fontFamily:t.displayFont,fontSize:16,fontWeight:700,marginBottom:8}}>Welcome, {report.client||"valued client"}.</div>
        <div style={{fontSize:11.5,color:t.sub,lineHeight:1.7}}>Thank you for choosing ProSight Property Inspections — a locally owned, InterNACHI-certified inspection company based in Dearborn Heights, Michigan. This report presents a thorough, unbiased evaluation of the readily accessible systems and components of your property at {report.address||"the inspected address"}. Our goal is simple — to give you a clear, honest understanding of the home's condition so you can make confident, well-informed decisions.</div>
      </div>

      {pill("Performed to InterNACHI Standards of Practice",
        "This inspection was performed in general accordance with the Standards of Practice of the International Association of Certified Home Inspectors (InterNACHI) — the industry's most respected benchmark. Our inspector is InterNACHI-certified (InterNACHI ID NACHI26020705) and bound by its Code of Ethics, ensuring an objective assessment carried out solely in your interest.")}

      {pill("What This Inspection Covers",
        "A visual, non-invasive examination of the major visible and readily accessible systems and components — including the roof, exterior and structure, foundation, interior rooms, and installed mechanical, electrical, and plumbing systems — documented with photographs and clear, plain-language findings. Each observation is graded by priority so you know what needs attention now versus what to simply monitor.")}

      {pill("Our Commitment to You",
        "We inspect every property as if it were our own — with diligence, integrity, and a genuine commitment to your safety and peace of mind. Findings are reported factually and without exaggeration. Where a condition warrants further evaluation by a licensed specialist, we say so plainly, so nothing is left to guesswork before you move forward.")}

      <div style={{display:"flex",gap:12,marginTop:18}}>
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

function ExecCounts({t,M}:any){
  return (
    <div style={{display:"flex",gap:12,margin:"6px 0 22px"}}>
      {[["Priority / Safety",M.cP,t.sev.priority],["Monitor / Maintain",M.cM,t.sev.monitor],["Satisfactory",M.cS,t.sev.satisfactory]].map((x:any,i:number)=>(
        <div key={i} style={{flex:1,border:`1px solid ${t.hair}`,borderRadius:t.radius,padding:16,textAlign:"center",background:x[2].bg}}>
          <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:700,color:x[2].c}}>{x[1]}</div>
          <div style={{fontSize:9,letterSpacing:1,color:t.sub,textTransform:"uppercase",marginTop:2}}>{x[0]}</div>
        </div>
      ))}
    </div>
  );
}

function ExecBlockView({t,b}:{t:ThemeTokens;b:ExecBlock}){
  if(b.kind==="mh") return <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700,margin:"18px 0 10px"}}>Monitor &amp; Maintenance</div>;
  if(b.kind==="m") return (
    <div style={{display:"flex",gap:9,padding:"7px 0",borderBottom:`1px solid ${t.hair}`,fontSize:11.5,color:t.sub}}>
      <span style={{color:t.sev.monitor.c}}>◆</span><span>{b.x.f.ai_text||b.x.f.note}</span>
    </div>
  );
  return (
    <div style={{borderLeft:`3px solid ${t.sev.priority.c}`,background:t.sev.priority.bg,borderRadius:t.radius,padding:"12px 15px",marginBottom:10,pageBreakInside:"avoid"}}>
      <div style={{fontSize:9,letterSpacing:1,color:t.sev.priority.c,fontWeight:700,textTransform:"uppercase"}}>{b.x.area}</div>
      <div style={{fontFamily:t.displayFont,fontSize:14,fontWeight:700,margin:"2px 0"}}>{b.x.f.title||"Priority item"}</div>
      <div style={{fontSize:11.5,color:t.sub,lineHeight:1.6}}>{b.x.f.ai_text||b.x.f.note}</div>
    </div>
  );
}

function ExecPage({t,report,M,blocks,part=1,parts=1,pageBase,reportNo,pageNo}:any){
  const list:ExecBlock[] = blocks ?? execBlocks(M);
  const first = part===1;
  // The "Priority Findings" heading belongs to the first priority block on each
  // page, so a page that opens mid-run still says what it is showing.
  const opensPriority = list.length>0 && list[0].kind==="p";
  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t}
        title={first ? "Executive Summary" : "Executive Summary (continued)"}
        sub={parts>1 ? `Page ${part} of ${parts} · ${report.address}` : `Most significant findings from the inspection of ${report.address}`}/>
      {first && <ExecCounts t={t} M={M}/>}
      {opensPriority && <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:700,margin:first?"0 0 10px":"12px 0 10px"}}>
        {first ? "Priority Findings" : "Priority Findings (continued)"}
      </div>}
      {list.map(b=><ExecBlockView key={b.key} t={t} b={b}/>)}
      {first && list.length===0 && <div style={{fontSize:12,color:t.sub}}>No priority or maintenance items identified. See sections for detail.</div>}
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo}/>
    </div>
  );
}

/* ---------------- SECTION PAGE ---------------- */

function SectionHeader({t,s,g,idx,part=1,parts=1}:any){
  const lay=t.layout;
  // "(continued)" so a split section still reads as one section.
  const name = part>1 ? `${s.name} (continued)` : s.name;
  const partNote = parts>1 ? `Page ${part} of ${parts}` : "";
  if(lay==="band") return (
    <div style={{background:t.accent,color:"#fff",borderRadius:t.radius,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
      <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:700,opacity:.85}}>{String(idx+1).padStart(2,"0")}</div>
      <div style={{width:1,height:30,background:"rgba(255,255,255,.35)"}}/>
      <div style={{flex:1}}><div style={{fontFamily:t.displayFont,fontSize:19,fontWeight:700}}>{name}</div><div style={{fontSize:9,letterSpacing:1.5,opacity:.8,textTransform:"uppercase"}}>{partNote ? `${s.subtitle||s.grp} \u00b7 ${partNote}` : (s.subtitle||s.grp)}</div></div>
      <span style={{fontFamily:t.displayFont,fontSize:20,fontWeight:700,background:"#fff",color:t.gradeColor[g.grade],borderRadius:t.radius,padding:"2px 12px"}}>{g.grade}</span>
    </div>
  );
  if(lay==="technical") return (
    <div style={{marginBottom:16,padding:"14px 16px",border:`1px solid ${t.hair}`,borderLeft:`4px solid ${t.gradeColor[g.grade]}`,borderRadius:t.radius,display:"flex",alignItems:"center",gap:14,background:t.pageBg==="#0e0f12"?"#15171b":"transparent"}}>
      <div style={{fontFamily:"monospace",fontSize:13,color:t.accent,letterSpacing:1}}>[{String(idx+1).padStart(2,"0")}]</div>
      <div style={{flex:1}}><div style={{fontFamily:t.displayFont,fontSize:18,fontWeight:700}}>{name}</div><div style={{fontSize:9,letterSpacing:1.5,color:t.sub,textTransform:"uppercase",fontFamily:"monospace"}}>{partNote ? `${s.subtitle||s.grp} \u00b7 ${partNote}` : (s.subtitle||s.grp)}</div></div>
      <span style={{fontSize:11,fontWeight:700,color:"#fff",background:t.gradeColor[g.grade],borderRadius:t.radius,padding:"3px 10px",fontFamily:"monospace"}}>GRADE {g.grade}</span>
    </div>
  );
  if(lay==="minimal") return (
    <div style={{marginBottom:20,textAlign:"center",paddingBottom:16,borderBottom:`1px solid ${t.hair}`}}>
      <div style={{fontSize:10,letterSpacing:4,color:t.sub,textTransform:"uppercase",marginBottom:6}}>Section {String(idx+1).padStart(2,"0")} — Grade {g.grade}</div>
      <div style={{fontFamily:t.displayFont,fontSize:24,fontWeight:700}}>{name}</div>
      <div style={{fontSize:11,letterSpacing:1,color:t.sub,marginTop:2}}>{partNote ? `${s.subtitle||s.grp} \u00b7 ${partNote}` : (s.subtitle||s.grp)}</div>
    </div>
  );
  // editorial (default): huge ghost number, serif, side accent
  return (
    <div style={{position:"relative",marginBottom:18,paddingBottom:14,borderBottom:`2px solid ${t.accent}`}}>
      <div style={{position:"absolute",right:0,top:-8,fontFamily:t.displayFont,fontSize:72,fontWeight:700,color:t.hair,lineHeight:1,zIndex:0}}>{String(idx+1).padStart(2,"0")}</div>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{fontSize:10,letterSpacing:3,color:t.accent,textTransform:"uppercase",marginBottom:4}}>Grade {g.grade}</div>
        <div style={{fontFamily:t.displayFont,fontSize:24,fontWeight:700}}>{name}</div>
        <div style={{fontSize:11,letterSpacing:1,color:t.sub}}>{partNote ? `${s.subtitle||s.grp} \u00b7 ${partNote}` : (s.subtitle||s.grp)}</div>
      </div>
    </div>
  );
}

function FindingCard({t,f,urls}:any){
  const m=t.sev[f.severity as keyof typeof t.sev]||t.sev.monitor;
  const purl=f.photo_path?urls[f.photo_path]:null;
  const lay=t.layout;
  const shapes=normalizeShapes(f.annotations);
  /* Same rendered size as the object-fit:cover image this replaces — the photo
     does not change shape. AnnotatedPhoto just crops the overlay identically so
     the shapes stay locked to what they were drawn around. */
  const body=(<><div style={{fontSize:11.5,color:t.sub,lineHeight:1.6}}>{f.ai_text||f.note}</div>{purl && (
    <div style={{marginTop:11}}>
      <AnnotatedPhoto src={purl} shapes={shapes} height={240} radius={t.radius} strokeWidth={2.5} fontSize={11}/>
    </div>
  )}</>);
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

function SectionPage({t,s,g,idx,findings,part=1,parts=1,urls,pageBase,reportNo,address,pageNo}:any){
  const list = findings ?? s.findings ?? [];
  return (
    <div className="rv-page" style={pageBase}>
      <SectionHeader t={t} s={s} g={g} idx={idx} part={part} parts={parts}/>
      {list.map((f:any)=>(<FindingCard key={f.id} t={t} f={f} urls={urls}/>))}
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
