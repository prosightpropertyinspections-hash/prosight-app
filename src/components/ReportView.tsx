"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Report } from "@/lib/types";
import { buildModel, GRADE_DESC, coverImage } from "@/lib/report-model";
import { getTheme, THEME_FONT_HREF, ThemeTokens } from "@/lib/themes";
import { AnnotatedPhoto, normalizeShapes } from "@/components/Annotations";
import { normalizeOutlets, outletTotals, workingCount, hasOutletData, type OutletRow } from "@/components/Outlets";
import { normalizeAttic, atticRated, isAttic, ATTIC_ITEMS, RATING_TONE, RATING_LABEL, type AtticData } from "@/components/Attic";
import { normalizeEquipment, hasEquipment, ageOf, lifeBand, BAND_LABEL, BAND_TONE, serviceLifeFor, type EquipRow } from "@/components/Equipment";
import { normalizeProfile, type Profile } from "@/lib/profile";

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
const PHOTO_H = 240;                          // standard finding photo
const ATTIC_GAP = 12;
const ATTIC_COL_W = Math.round((CONTENT_W - ATTIC_GAP) / 2);  // two attic cards per row
const THERMAL_GAP = 11;
const THERMAL_COLS = 3;                                        // six scans per page
const THERMAL_COL_W = Math.round((CONTENT_W - THERMAL_GAP * (THERMAL_COLS - 1)) / THERMAL_COLS);
const isThermal = (n:string) => /thermal|infrared|\bIR\b/i.test(String(n||""));

type Chunk = { sec:any; g:any; idx:number; findings:any[]; part:number; parts:number };
type ExecBlock = { key:string; kind:"p"|"mh"|"m"; x?:any };
const OUTLET_ROWS_PER_PAGE = 22;   // uniform row height, so a count is enough

/* Cover is 1 and unnumbered; contents is 2. Everything after is derived. */
const P_ABOUT = 3;
const P_GRADE = 4;
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

export default function ReportView({ report, urls, themeId, profile }:{ report:Report; urls:Record<string,string>; themeId?:string|null; profile?:any; }){
  /* Business details come from settings when available; a report opened without
     them still renders, just with the defaults. */
  const biz:Profile = normalizeProfile(profile);
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
        const list = sec.findings||[];

        if(isThermal(sec.name)){
          /* Three scans to a row, so the packing unit is the row — as tall as
             its tallest card. */
          for(let i=0; i<list.length; i+=THERMAL_COLS){
            const row = list.slice(i, i+THERMAL_COLS);
            const h = Math.max(...row.map((f:any)=> findH[f.id] ?? 0)) + THERMAL_GAP;
            if(cur.length && used + h > budget){ pages.push(cur); cur=[]; used=0; }
            cur.push(...row); used += h;
          }
        } else if(isAttic(sec.name)){
          /* Attic runs two square cards per row, so the packing unit is a ROW:
             a row is as tall as its taller card. Packing card-by-card here
             would double-count the height of every pair. */
          for(let i=0; i<list.length; i+=2){
            const pair = list.slice(i, i+2);
            const h = Math.max(...pair.map((f:any)=> findH[f.id] ?? 0)) + ATTIC_GAP;
            if(cur.length && used + h > budget){ pages.push(cur); cur=[]; used=0; }
            cur.push(...pair); used += h;
          }
        } else {
          list.forEach((f:any)=>{
            const h = findH[f.id] ?? 0;
            if(cur.length && used + h > budget){ pages.push(cur); cur=[]; used=0; }
            cur.push(f); used += h;
          });
        }
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

  /* Receptacle tally. Rooms left at zero are dropped rather than printed as a
     row of dashes, and the whole page disappears when nothing was recorded. */
  const attic = normalizeAttic((report as any).attic);
  const equip = normalizeEquipment((report as any).equipment);
  const equipRows = hasEquipment(equip)
    ? equip.rows.filter(r => r.name && (r.brand || r.model || r.year))
    : [];
  const P_EQUIP = 5;
  const P_EXEC = equipRows.length ? 6 : 5;
  /* Every page number in the report is derived from this block, so the contents
     page and the footers can never disagree about where something is. */
  const secChunks:Chunk[] = chunks ?? M.withF.map((sx:any,i:number)=>({
    sec:sx, g:M.graded.find((x:any)=>x.section.id===sx.id), idx:i,
    findings:sx.findings||[], part:1, parts:1,
  }));
  const execCount = execChunks ? execChunks.length : 1;

  const outletData = normalizeOutlets((report as any).outlets);
  const outletRows = hasOutletData(outletData)
    ? outletData.rows.filter(r => (r.total||0) > 0 || (r.defective||0) > 0 || (r.open_ground||0) > 0)
    : [];
  const outletPages:OutletRow[][] = [];
  for(let i=0; i<outletRows.length; i+=OUTLET_ROWS_PER_PAGE){
    outletPages.push(outletRows.slice(i, i+OUTLET_ROWS_PER_PAGE));
  }

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

      {t.coverStyle==="monograph" && <MonographCover biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="obsidian"  && <ObsidianCover  biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="warrant"   && <WarrantCover   biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="vanguard"  && <VanguardCover  biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="terra"     && <TerraCover     biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="noir"      && <NoirCover      biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="aurora"    && <AuroraCover    biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="prestige"  && <PrestigeCover  biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="blueprint" && <BlueprintCover biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="lumen"     && <LumenCover     biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="split"     && <SplitCover     biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}
      {t.coverStyle==="ultra"     && <UltraCover     biz={biz} t={t} report={report} cover={cover} M={M} reportNo={reportNo} base={coverBase}/>}

      <TocPage biz={biz} t={t} report={report} M={M} secChunks={secChunks} execCount={execCount}
        outletPages={outletPages.length} equipPage={equipRows.length ? P_EQUIP : 0}
        execPage={P_EXEC} pageBase={pageBase} reportNo={reportNo} pageNo={2}/>

      <AboutPage biz={biz} t={t} report={report} pageBase={pageBase} reportNo={reportNo} pageNo={P_ABOUT}/>
      <GradePage biz={biz} t={t} report={report} M={M} pageBase={pageBase} reportNo={reportNo} pageNo={P_GRADE}/>
      {equipRows.length > 0 && (
        <EquipmentPage biz={biz} t={t} report={report} rows={equipRows}
          pageBase={pageBase} reportNo={reportNo} pageNo={P_EQUIP}/>
      )}

      {(execChunks ?? [{ blocks: execBlocks(M), part:1, parts:1 }]).map((ec:ExecChunk,i:number)=>(
        <ExecPage biz={biz} key={`exec-${ec.part}`} t={t} report={report} M={M}
          blocks={ec.blocks} part={ec.part} parts={ec.parts}
          pageBase={pageBase} reportNo={reportNo} pageNo={P_EXEC+i}/>
      ))}

      {secChunks.map((c:Chunk,i:number)=>(
        <SectionPage biz={biz} key={`${c.sec.id}-${c.part}`} t={t} s={c.sec} g={c.g} idx={c.idx}
          findings={c.findings} part={c.part} parts={c.parts}
          attic={isAttic(c.sec.name) ? attic : null}
          urls={urls} pageBase={pageBase} reportNo={reportNo} address={report.address}
          pageNo={P_EXEC + execCount + i}/>
      ))}

      {outletPages.map((rows,i)=>(
        <OutletPage biz={biz} key={`out-${i}`} t={t} report={report} rows={rows}
          part={i+1} parts={outletPages.length} totals={outletTotals(outletRows)}
          pageBase={pageBase} reportNo={reportNo}
          pageNo={P_EXEC + execCount + secChunks.length + i}/>
      ))}

      <ScopePage biz={biz} t={t} report={report} pageBase={pageBase} reportNo={reportNo}
        pageNo={P_EXEC + execCount + secChunks.length + outletPages.length}/>

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
                <div data-mh={sec.id}>
                  <SectionHeader t={t} s={sec} g={g} idx={i} part={1} parts={1}/>
                  {isAttic(sec.name) && atticRated(attic) && <AtticGrid t={t} d={attic}/>}
                </div>
                {(sec.findings||[]).map((f:any)=>(
                  <div key={f.id} data-mf={f.id}
                    style={isThermal(sec.name)?{width:THERMAL_COL_W}:isAttic(sec.name)?{width:ATTIC_COL_W}:undefined}>
                    <FindingCard t={t} f={f} urls={urls}
                      square={isAttic(sec.name)} thermal={isThermal(sec.name)}/>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Text colour follows the panel it sits on, not the theme. The old check was a
   hardcoded comparison against one theme's page colour, so any new dark theme
   landed on the light card with light ink and became unreadable. */
function isLightHex(hex:string){
  const h = (hex||"").replace("#","");
  if(h.length!==6) return true;
  const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return (0.2126*r + 0.7152*g + 0.0722*b) > 140;
}
const onPanel = (bg:string, t:ThemeTokens) => isLightHex(bg)
  ? { ink:"#1a1a1a", sub:"#4a4a4a" }
  : { ink:t.ink, sub:t.sub };

function Foot({t,reportNo,address,p,biz}:{t:ThemeTokens;reportNo:string;address:string;p:number;biz?:Profile}){
  const onDark = !isLightHex(t.pageBg);
  return <div className="rv-foot" style={{color:t.sub,borderTop:`1px solid ${t.hair}`,paddingTop:8,alignItems:"center"}}>
    <span style={{fontSize:8.5}}>{(biz?.company_name||"ProSight Property Inspections").toUpperCase()} · {reportNo} · {address} · Page {p}</span>
    <img src={onDark?"/logo-ondark.svg":"/logo.svg"} alt="" style={{height:54,width:"auto",opacity:.9}}/>
  </div>;
}

/* ---------------- COVERS ----------------
   Every cover is a flex column inside a hard 11in box. The image block carries
   flex:1 so it absorbs leftover space; the blocks above and below it keep their
   fixed sizes. Previously these used min-height:11in and simply grew past the
   sheet, which is what put the bottom strip on a page of its own.            */

function MonographCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="0 64px 26px"/>
    </div>
  );
}

function ObsidianCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="14px 0 0"/>
    </div>
  );
}

function WarrantCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="0 54px 26px"/>
    </div>
  );
}

function VanguardCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="0 54px 22px"/>
    </div>
  );
}

function TerraCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="14px 0 0"/>
    </div>
  );
}

function NoirCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="0 56px 22px"/>
    </div>
  );
}

function AuroraCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="18px 0 0"/>
      </div>
    </div>
  );
}

function PrestigeCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="18px 0 0"/>
      </div>
    </div>
  );
}

function BlueprintCover({t,report,cover,M,reportNo,base,biz}:any){
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
      <CoverLegal biz={biz} report={report} pad="18px 0 0"/>
      </div>
    </div>
  );
}


/* Contents. Built from the same chunk list that lays the report out, so a
   section that spills onto a second page still points at the page it starts on.
   Each system carries its grade, which makes this page useful rather than
   merely navigational — an agent can read the whole condition here. */

/* Equipment and service life. A table, no photographs: the data-plate images
   exist so the inspector doesn't have to decode a serial by hand, and a client
   has no use for a picture of a sticker. */
function EquipmentPage({t,report,rows,pageBase,reportNo,pageNo,biz}:any){
  const asOf = report.inspection_date || null;
  const cell:React.CSSProperties = { padding:"11px 10px", borderBottom:`1px solid ${t.hair}`, fontSize:11.5, verticalAlign:"top" };
  const aging = rows.filter((r:EquipRow)=>{ const b=lifeBand(r,asOf); return b==="late"||b==="past"; }).length;

  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t} title="Equipment & Service Life" sub="Makes, models and approximate ages of major equipment"/>

      <table style={{width:"100%",borderCollapse:"collapse",marginTop:10}}>
        <thead>
          <tr>
            {["System","Make & model","Installed","Age","Typical life","Standing"].map((h,i)=>(
              <th key={i} style={{borderBottom:`2px solid ${t.ink}`,color:t.ink,fontSize:9,letterSpacing:1,
                textTransform:"uppercase",textAlign:i>=2&&i<=4?"center":"left",padding:"8px 10px",
                fontFamily:t.bodyFont,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r:EquipRow)=>{
            const age = ageOf(r, asOf);
            const band = lifeBand(r, asOf);
            const life = serviceLifeFor(r);
            return (
              <tr key={r.id}>
                <td style={{...cell,fontWeight:700,fontFamily:t.displayFont,fontSize:12.5}}>{r.name}</td>
                <td style={cell}>
                  <div style={{fontWeight:600}}>{r.brand || "Make not determined"}</div>
                  {r.model ? <div style={{fontSize:10,color:t.sub,marginTop:1}}>Model {r.model}</div> : null}
                  {r.serial ? <div style={{fontSize:9.5,color:t.sub,marginTop:1}}>Serial {r.serial}</div> : null}
                </td>
                <td style={{...cell,textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{r.year || "—"}</td>
                <td style={{...cell,textAlign:"center",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>
                  {age !== null ? `${age} yr${age===1?"":"s"}` : "—"}
                </td>
                <td style={{...cell,textAlign:"center",color:t.sub,fontVariantNumeric:"tabular-nums"}}>
                  {life ? `${life} yrs` : "—"}
                </td>
                <td style={cell}>
                  <span style={{fontSize:9.5,fontWeight:700,letterSpacing:.4,textTransform:"uppercase",
                    color:BAND_TONE[band],whiteSpace:"nowrap"}}>{BAND_LABEL[band]}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* A life-stage bar per system reads faster than the numbers beside it. */}
      <div style={{marginTop:22}}>
        <div style={{fontFamily:t.displayFont,fontSize:13,fontWeight:700,marginBottom:9}}>Where each system sits in its expected life</div>
        {rows.filter((r:EquipRow)=>serviceLifeFor(r) && ageOf(r,asOf)!==null).map((r:EquipRow)=>{
          const life = serviceLifeFor(r);
          const age = ageOf(r, asOf) || 0;
          const pctRaw = (age / life) * 100;
          const pct = Math.max(3, Math.min(100, pctRaw));
          const band = lifeBand(r, asOf);
          return (
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:11,marginBottom:7}}>
              <div style={{width:"1.5in",fontSize:10.5,color:t.sub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}</div>
              <div style={{flex:1,height:7,borderRadius:4,background:t.hair,overflow:"hidden"}}>
                <div style={{width:`${pct}%`,height:"100%",background:BAND_TONE[band],borderRadius:4}}/>
              </div>
              <div style={{width:"0.62in",textAlign:"right",fontSize:10,color:t.sub,fontVariantNumeric:"tabular-nums"}}>
                {Math.round(pctRaw)}%
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:20,fontSize:10.5,color:t.sub,lineHeight:1.65,borderTop:`1px solid ${t.hair}`,paddingTop:12}}>
        Ages are taken from the manufacturer's data plate where legible, or decoded from the serial number.
        Typical service life figures are general industry guidance, not a prediction — equipment beyond its
        typical life may continue to operate for years, and equipment within it can still fail.
        {aging>0 ? ` ${aging} system${aging===1?" is":"s are"} at or near the end of the typical range and should be budgeted for.` : ""}
        {" "}No equipment was dismantled, and ages could not be confirmed where a plate was missing or illegible.
      </div>

      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo} biz={biz}/>
    </div>
  );
}

function TocPage({t,report,M,secChunks,execCount,outletPages,equipPage,execPage,pageBase,reportNo,pageNo,biz}:any){
  type Entry = { label:string; page:number; grade?:string; sub?:string };

  const groups:{ title:string; items:Entry[] }[] = [];

  const top:Entry[] = [
    { label:"About This Inspection", page:P_ABOUT, sub:"Standards of practice and scope" },
    { label:"Overall Property Condition", page:P_GRADE, sub:"Summary grade by system" },
  ];
  if(equipPage) top.push({ label:"Equipment & Service Life", page:equipPage, sub:"Makes, models and ages" });
  top.push({ label:"Executive Summary", page:execPage, sub:`${M.cP} priority · ${M.cM} monitor` });
  groups.push({ title:"The report", items:top });

  // A section occupies one entry no matter how many pages it runs to.
  const secStart = execPage + execCount;
  const seen = new Set<string>();
  const systems:Entry[] = [];
  secChunks.forEach((c:Chunk, i:number)=>{
    if(seen.has(c.sec.id)) return;
    seen.add(c.sec.id);
    systems.push({
      label: c.sec.name,
      page: secStart + i,
      grade: c.g?.grade,
      sub: c.sec.subtitle || c.sec.grp,
    });
  });
  if(systems.length) groups.push({ title:"Systems & areas", items:systems });

  const ref:Entry[] = [];
  const outStart = secStart + secChunks.length;
  if(outletPages > 0) ref.push({ label:"Receptacle Testing", page:outStart, sub:"Outlets tested by room" });
  ref.push({ label:"Scope & Limitations", page:outStart + outletPages, sub:"Report terms and signature" });
  groups.push({ title:"Reference", items:ref });

  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t} title="Contents" sub={`Inspection of ${report.address}`}/>

      <div style={{marginTop:14}}>
        {groups.map((g,gi)=>(
          <div key={gi} style={{marginBottom:20}}>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:t.accent,
              fontWeight:700,paddingBottom:6,borderBottom:`1px solid ${t.hair}`,marginBottom:4}}>{g.title}</div>

            {g.items.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"baseline",gap:8,padding:"7px 0",
                borderBottom:`1px solid ${t.hair}`}}>
                <div style={{minWidth:0,flexShrink:1}}>
                  <div style={{fontFamily:t.displayFont,fontSize:13,fontWeight:700,whiteSpace:"nowrap",
                    overflow:"hidden",textOverflow:"ellipsis"}}>{e.label}</div>
                  {e.sub ? <div style={{fontSize:9.5,color:t.sub,marginTop:1}}>{e.sub}</div> : null}
                </div>

                {/* dotted leader: the line that makes a contents page read as one */}
                <div style={{flex:1,minWidth:18,alignSelf:"center",height:1,marginTop:2,
                  borderBottom:`1px dotted ${t.hair}`}}/>

                {e.grade ? (
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:.5,color:t.gradeColor[e.grade],
                    border:`1px solid ${t.hair}`,borderRadius:t.radius,padding:"1px 6px"}}>{e.grade}</span>
                ) : null}

                <span style={{fontFamily:t.displayFont,fontSize:13,fontWeight:700,minWidth:22,
                  textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{e.page}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo} biz={biz}/>
    </div>
  );
}


/* Attribution and ownership notice. Every value comes from settings, so it
   stays correct across reports without being retyped. */
function CoverLegal({biz,report,pad}:{biz:any;report:any;pad?:string}){
  const inspector = report.inspector || biz?.inspector_name || "";
  const company = biz?.company_name || "ProSight Property Inspections";
  const entity = [biz?.legal_name, biz?.address].filter(Boolean).join(", ");

  const credit = [
    inspector ? `Inspected by ${inspector}, Certified Property Inspector` : "",
    entity,
  ].filter(Boolean).join("  ·  ");

  /* currentColor + opacity so one component sits correctly on all nine covers,
     dark or light, without each theme needing its own palette. */
  return (
    <div style={{flexShrink:0,padding:pad||"0 54px 24px"}}>
      <div style={{borderTop:"1px solid currentColor",opacity:.45,marginBottom:10}}/>
      {credit ? (
        <div style={{fontSize:10,fontWeight:700,letterSpacing:.2,opacity:.9,marginBottom:5}}>{credit}</div>
      ) : null}
      <div style={{fontSize:8.6,lineHeight:1.7,opacity:.62,textAlign:"justify"}}>
        This report is the exclusive property of {company} and the named client, prepared solely
        for their use, and is not transferable to any subsequent purchaser, agent, or lender.
        Reproduction or reliance by any other party is prohibited. This inspection was visual and
        non-invasive: findings reflect the readily accessible condition of the property on the date
        of inspection only, and concealed or obstructed areas are excluded. It is not a warranty or
        guarantee against future failure. This report should be read in full.
      </div>
    </div>
  );
}


/* Lumen — the photograph is the cover. A long four-stop scrim lets the top of
   the image stay bright and lets the type sit on near-solid ink at the foot,
   so nothing needs a box behind it. Rules fade out rather than stopping, which
   is what keeps the page feeling like a gallery print and not a form. */
function LumenCover({t,report,cover,M,reportNo,base,biz}:any){
  const gradeC = t.gradeColor[M.overall];
  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0,display:"block"}}>
      {cover && <img src={cover} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>}

      {/* the long fade: bright at the crown, solid under the type */}
      <div style={{position:"absolute",inset:0,background:
        "linear-gradient(180deg, rgba(13,17,23,.20) 0%, rgba(13,17,23,.06) 26%, rgba(13,17,23,.55) 58%, rgba(13,17,23,.90) 78%, rgba(13,17,23,.98) 100%)"}}/>
      {/* a soft bloom behind the wordmark so the logo never sits on a busy sky */}
      <div style={{position:"absolute",top:"-14%",left:"-10%",width:"78%",height:"46%",
        background:"radial-gradient(ellipse at 30% 40%, rgba(211,177,119,.20), transparent 68%)",filter:"blur(12px)"}}/>
      <div style={{position:"absolute",bottom:"-8%",right:"-12%",width:"62%",height:"44%",
        background:"radial-gradient(ellipse, rgba(43,58,74,.42), transparent 70%)",filter:"blur(16px)"}}/>
      {/* hairline frame, inset — the one crisp edge on the page */}
      <div style={{position:"absolute",inset:24,border:"1px solid rgba(246,244,239,.16)",pointerEvents:"none"}}/>

      <div style={{position:"relative",height:"100%",display:"flex",flexDirection:"column",padding:"42px 52px 34px",boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <Logo dark height={118}/>
          <div style={{textAlign:"right",fontSize:8.5,letterSpacing:2.4,textTransform:"uppercase",color:"rgba(246,244,239,.5)"}}>
            Report<br/><span style={{color:t.coverAccent,letterSpacing:1.6}}>{reportNo}</span>
          </div>
        </div>

        <div style={{flex:"1 1 0",minHeight:0}}/>

        <div style={{flexShrink:0}}>
          <div style={{fontSize:9.5,letterSpacing:7,textTransform:"uppercase",color:t.coverAccent,marginBottom:14}}>
            Property Inspection Report
          </div>
          <div style={{fontFamily:t.displayFont,fontSize:50,fontWeight:400,lineHeight:1.05,letterSpacing:"-1px",
            maxWidth:"7in",textShadow:"0 2px 26px rgba(0,0,0,.45)"}}>
            {report.address||"Property address"}
          </div>

          {/* rule that dissolves instead of ending */}
          <div style={{height:1,marginTop:20,marginBottom:16,
            background:"linear-gradient(90deg, rgba(246,244,239,.55), rgba(246,244,239,.10) 55%, transparent)"}}/>

          <div style={{display:"flex",alignItems:"flex-end",gap:26}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:8.5,letterSpacing:2.6,textTransform:"uppercase",color:"rgba(246,244,239,.48)",marginBottom:5}}>
                Prepared for
              </div>
              <div style={{fontFamily:t.displayFont,fontSize:25,fontWeight:400,letterSpacing:"-.2px"}}>
                {report.client||"—"}
              </div>
              <div style={{fontSize:10.5,color:"rgba(246,244,239,.58)",marginTop:7}}>
                {fmtDate(report.inspection_date)}
                {report.inspector||biz?.inspector_name ? ` · ${report.inspector||biz.inspector_name}` : ""}
              </div>
            </div>

            {[["Systems",M.withF.length],["Priority",M.cP]].map((x:any,i:number)=>(
              <div key={i} style={{textAlign:"center",paddingRight:4}}>
                <div style={{fontFamily:t.displayFont,fontSize:27,fontWeight:400,lineHeight:1}}>{x[1]}</div>
                <div style={{fontSize:7.5,letterSpacing:1.8,textTransform:"uppercase",color:"rgba(246,244,239,.45)",marginTop:4}}>{x[0]}</div>
              </div>
            ))}

            {/* grade as a soft ring, lit from within */}
            <div style={{width:82,height:82,borderRadius:"50%",flexShrink:0,position:"relative",
              display:"flex",alignItems:"center",justifyContent:"center",
              background:`radial-gradient(circle at 42% 34%, ${gradeC}33, transparent 68%)`,
              boxShadow:`inset 0 0 0 1px ${gradeC}66, 0 0 26px -6px ${gradeC}55`}}>
              <div style={{fontFamily:t.displayFont,fontSize:36,fontWeight:400,color:t.coverInk,lineHeight:1}}>{M.overall}</div>
              <div style={{position:"absolute",bottom:11,fontSize:6.5,letterSpacing:1.6,
                textTransform:"uppercase",color:"rgba(246,244,239,.5)"}}>Grade</div>
            </div>
          </div>
        </div>

        <CoverLegal biz={biz} report={report} pad="18px 0 0"/>
      </div>
    </div>
  );
}


/* Prosighty — the cover is split down the middle: a solid brand panel carrying
   every word, and the photograph running full height beside it. Nothing sits on
   top of the image, so a dark or busy exterior shot can never make the type
   hard to read — the failure mode every photo-backed cover has. */
function SplitCover({t,report,cover,M,reportNo,base,biz}:any){
  const gradeC = t.gradeColor[M.overall];
  const rule = "rgba(242,247,251,.16)";

  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0,flexDirection:"row"}}>

      {/* left: the panel */}
      <div style={{width:"47%",flexShrink:0,position:"relative",display:"flex",flexDirection:"column",
        padding:"44px 34px 30px 46px",boxSizing:"border-box",overflow:"hidden"}}>
        {/* a low diagonal sheen keeps the panel from reading as flat fill */}
        <div style={{position:"absolute",inset:0,background:
          "linear-gradient(152deg, rgba(57,167,230,.16) 0%, rgba(57,167,230,.04) 34%, transparent 62%)"}}/>
        <div style={{position:"absolute",left:"-30%",bottom:"-18%",width:"120%",height:"46%",
          background:"radial-gradient(ellipse at 40% 60%, rgba(57,167,230,.20), transparent 68%)",filter:"blur(18px)"}}/>

        <div style={{position:"relative",display:"flex",flexDirection:"column",height:"100%"}}>
          <Logo dark height={112}/>

          <div style={{flex:"1 1 0",minHeight:0}}/>

          <div style={{flexShrink:0}}>
            <div style={{fontSize:8.5,letterSpacing:4.4,textTransform:"uppercase",color:t.coverAccent,marginBottom:13}}>
              Inspection Report
            </div>
            <div style={{fontFamily:t.displayFont,fontSize:31,fontWeight:600,lineHeight:1.17,letterSpacing:"-.7px"}}>
              {report.address||"Property address"}
            </div>

            <div style={{height:3,width:52,background:t.coverAccent,margin:"20px 0 18px",borderRadius:2}}/>

            <div style={{fontSize:8,letterSpacing:2.4,textTransform:"uppercase",color:"rgba(242,247,251,.5)",marginBottom:4}}>
              Prepared for
            </div>
            <div style={{fontFamily:t.displayFont,fontSize:17,fontWeight:600}}>{report.client||"—"}</div>
            <div style={{fontSize:10,color:"rgba(242,247,251,.6)",marginTop:6,lineHeight:1.5}}>
              {fmtDate(report.inspection_date)}
              {report.inspector||biz?.inspector_name ? <><br/>Inspected by {report.inspector||biz.inspector_name}</> : null}
            </div>

            {/* three figures on a hairline grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",marginTop:22,
              borderTop:`1px solid ${rule}`,borderBottom:`1px solid ${rule}`}}>
              {[["Systems",M.withF.length,t.coverInk],["Priority",M.cP,t.sev.priority.c],["Grade",M.overall,gradeC]].map((x:any,i:number)=>(
                <div key={i} style={{padding:"13px 0 12px",borderRight:i<2?`1px solid ${rule}`:"none"}}>
                  <div style={{fontFamily:t.displayFont,fontSize:22,fontWeight:600,color:x[2],lineHeight:1}}>{x[1]}</div>
                  <div style={{fontSize:7,letterSpacing:1.6,textTransform:"uppercase",color:"rgba(242,247,251,.45)",marginTop:4}}>{x[0]}</div>
                </div>
              ))}
            </div>

            <div style={{fontSize:8,letterSpacing:2,color:"rgba(242,247,251,.4)",marginTop:14}}>{reportNo}</div>
          </div>

          <CoverLegal biz={biz} report={report} pad="16px 0 0"/>
        </div>
      </div>

      {/* the seam */}
      <div style={{width:3,flexShrink:0,background:`linear-gradient(180deg, ${t.coverAccent}, ${t.coverAccent}55)`}}/>

      {/* right: the photograph, full height */}
      <div style={{flex:1,position:"relative",overflow:"hidden"}}>
        {cover
          ? <img src={cover} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
          : <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,#16314f,#0d1f33)"}}/>}
        {/* the image is graded toward the panel so the seam reads as one object */}
        <div style={{position:"absolute",inset:0,background:
          "linear-gradient(90deg, rgba(13,31,51,.62) 0%, rgba(13,31,51,.12) 26%, transparent 55%)"}}/>
        <div style={{position:"absolute",inset:0,background:
          "linear-gradient(0deg, rgba(13,31,51,.42) 0%, transparent 34%)"}}/>
      </div>
    </div>
  );
}


/* Prosighty Ultra — photograph above, brand panel below, and a card floating
   across the seam carrying the type. The card sits on solid colour at its foot
   and over the image at its head, so it reads as depth without ever putting
   small text on top of a photograph. */
function UltraCover({t,report,cover,M,reportNo,base,biz}:any){
  const gradeC = t.gradeColor[M.overall];
  const line = "rgba(234,242,250,.14)";
  const Bracket = ({pos}:{pos:string}) => {
    const c = "rgba(69,176,238,.75)";
    const base:React.CSSProperties = {position:"absolute",width:15,height:15,pointerEvents:"none"};
    const m:Record<string,React.CSSProperties> = {
      tl:{top:-1,left:-1,borderTop:`2px solid ${c}`,borderLeft:`2px solid ${c}`},
      tr:{top:-1,right:-1,borderTop:`2px solid ${c}`,borderRight:`2px solid ${c}`},
      bl:{bottom:-1,left:-1,borderBottom:`2px solid ${c}`,borderLeft:`2px solid ${c}`},
      br:{bottom:-1,right:-1,borderBottom:`2px solid ${c}`,borderRight:`2px solid ${c}`},
    };
    return <div style={{...base,...m[pos]}}/>;
  };

  return (
    <div className="rv-page" style={{...base,background:t.coverBg,color:t.coverInk,padding:0,display:"block"}}>

      {/* upper: the photograph */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:"56%",overflow:"hidden"}}>
        {cover
          ? <img src={cover} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
          : <div style={{position:"absolute",inset:0,background:"linear-gradient(150deg,#12314f,#081120)"}}/>}
        <div style={{position:"absolute",inset:0,background:
          "linear-gradient(180deg, rgba(8,17,32,.30) 0%, rgba(8,17,32,.05) 34%, rgba(8,17,32,.75) 88%, rgba(8,17,32,1) 100%)"}}/>
      </div>

      {/* lower: the panel */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"46%",background:t.coverBg}}/>
      <div style={{position:"absolute",bottom:"-14%",left:"-16%",width:"84%",height:"52%",
        background:"radial-gradient(ellipse at 42% 50%, rgba(69,176,238,.22), transparent 68%)",filter:"blur(20px)"}}/>
      <div style={{position:"absolute",bottom:"-10%",right:"-18%",width:"70%",height:"44%",
        background:"radial-gradient(ellipse, rgba(63,211,155,.13), transparent 70%)",filter:"blur(22px)"}}/>

      {/* masthead, over the bright part of the image */}
      <div style={{position:"absolute",top:40,left:46,right:46,display:"flex",
        justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{filter:"drop-shadow(0 3px 14px rgba(0,0,0,.6))"}}><Logo dark height={112}/></div>
        <div style={{textAlign:"right",fontSize:8,letterSpacing:2.4,textTransform:"uppercase",
          color:"rgba(234,242,250,.55)",textShadow:"0 1px 10px rgba(0,0,0,.6)"}}>
          Report No.<br/><span style={{color:t.coverAccent,fontSize:10,letterSpacing:1.4}}>{reportNo}</span>
        </div>
      </div>

      {/* the card, straddling the seam */}
      <div style={{position:"absolute",left:42,right:42,top:"36%",borderRadius:t.radius,
        background:"linear-gradient(165deg, rgba(20,38,60,.97), rgba(9,19,34,.99))",
        boxShadow:"0 26px 60px -20px rgba(0,0,0,.85), inset 0 1px 0 rgba(234,242,250,.10)",
        border:`1px solid ${line}`,padding:"28px 30px 26px"}}>
        <Bracket pos="tl"/><Bracket pos="tr"/><Bracket pos="bl"/><Bracket pos="br"/>

        <div style={{fontSize:8.5,letterSpacing:5,textTransform:"uppercase",color:t.coverAccent,marginBottom:12}}>
          Property Inspection Report
        </div>
        <div style={{fontFamily:t.displayFont,fontSize:33,fontWeight:600,lineHeight:1.14,letterSpacing:"-.8px"}}>
          {report.address||"Property address"}
        </div>

        <div style={{height:1,margin:"18px 0 16px",
          background:`linear-gradient(90deg, ${t.coverAccent}, ${line} 46%, transparent)`}}/>

        <div style={{display:"flex",alignItems:"flex-end",gap:22}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:7.5,letterSpacing:2.4,textTransform:"uppercase",color:"rgba(234,242,250,.45)",marginBottom:4}}>
              Prepared for
            </div>
            <div style={{fontFamily:t.displayFont,fontSize:19,fontWeight:600}}>{report.client||"—"}</div>
            <div style={{fontSize:10,color:"rgba(234,242,250,.55)",marginTop:5}}>
              {fmtDate(report.inspection_date)}
              {report.inspector||biz?.inspector_name ? ` · ${report.inspector||biz.inspector_name}` : ""}
            </div>
          </div>

          {[["Systems",M.withF.length],["Priority",M.cP]].map((x:any,i:number)=>(
            <div key={i} style={{textAlign:"center"}}>
              <div style={{fontFamily:t.displayFont,fontSize:22,fontWeight:600,lineHeight:1}}>{x[1]}</div>
              <div style={{fontSize:7,letterSpacing:1.6,textTransform:"uppercase",color:"rgba(234,242,250,.42)",marginTop:3}}>{x[0]}</div>
            </div>
          ))}

          <div style={{width:70,height:70,borderRadius:"50%",flexShrink:0,position:"relative",
            display:"flex",alignItems:"center",justifyContent:"center",
            background:`radial-gradient(circle at 40% 34%, ${gradeC}2e, transparent 70%)`,
            boxShadow:`inset 0 0 0 1px ${gradeC}66, 0 0 22px -4px ${gradeC}66`}}>
            <div style={{fontFamily:t.displayFont,fontSize:30,fontWeight:700,color:gradeC,lineHeight:1}}>{M.overall}</div>
            <div style={{position:"absolute",bottom:9,fontSize:6,letterSpacing:1.4,
              textTransform:"uppercase",color:"rgba(234,242,250,.45)"}}>Grade</div>
          </div>
        </div>
      </div>

      <div style={{position:"absolute",left:46,right:46,bottom:26}}>
        <CoverLegal biz={biz} report={report} pad="0"/>
      </div>
    </div>
  );
}

function AboutPage({t,report,pageBase,reportNo,pageNo,biz}:any){
  const lay=t.layout;
  const cardBg = isLightHex(t.pageBg) ? (lay==="technical" ? "transparent" : "#f6f5f1") : "#15171b";
  const card = onPanel(cardBg==="transparent" ? t.pageBg : cardBg, t);
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
        <div style={{fontFamily:t.displayFont,fontSize:16,fontWeight:700,marginBottom:8,color:card.ink}}>Welcome, {report.client||"valued client"}.</div>
        <div style={{fontSize:11.5,color:card.sub,lineHeight:1.7}}>Thank you for choosing {biz?.company_name||"ProSight Property Inspections"} — a locally owned, InterNACHI-certified inspection company{biz?.address?` based in ${biz.address}`:" based in Dearborn Heights, Michigan"}. This report presents a thorough, unbiased evaluation of the readily accessible systems and components of your property at {report.address||"the inspected address"}. Our goal is simple — to give you a clear, honest understanding of the home's condition so you can make confident, well-informed decisions.</div>
      </div>

      {pill("Performed to InterNACHI Standards of Practice",
        `This inspection was performed in general accordance with the Standards of Practice of the International Association of Certified Home Inspectors (InterNACHI) — the industry's most respected benchmark. Our inspector is InterNACHI-certified (InterNACHI ID ${biz?.internachi_id || report.nachi_id || "NACHI26020705"}) and bound by its Code of Ethics, ensuring an objective assessment carried out solely in your interest.${biz?.standards_note ? " " + biz.standards_note : ""}`)}

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
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo} biz={biz}/>
    </div>
  );
}

/* ---------------- GRADE PAGE ---------------- */

function GradePage({t,report,M,pageBase,reportNo,pageNo,biz}:any){
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
      {t.gradeStyle==="orbit" && (
        <div style={{position:"relative",margin:"10px 0 26px",padding:"30px 30px",borderRadius:t.radius,
          overflow:"hidden",border:`1px solid ${t.hair}`,
          background:"linear-gradient(150deg, rgba(20,38,60,.85), rgba(9,19,34,.95))"}}>
          <div style={{position:"absolute",top:"-46%",left:"14%",width:"64%",height:"180%",
            background:`radial-gradient(circle, ${t.gradeColor[M.overall]}30, transparent 66%)`,filter:"blur(24px)"}}/>
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:28}}>
            {/* concentric rings, brightest at the centre */}
            <div style={{width:124,height:124,flexShrink:0,position:"relative",display:"grid",placeItems:"center"}}>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`1px solid ${t.gradeColor[M.overall]}22`}}/>
              <div style={{position:"absolute",inset:13,borderRadius:"50%",border:`1px solid ${t.gradeColor[M.overall]}3a`}}/>
              <div style={{position:"absolute",inset:26,borderRadius:"50%",
                background:`radial-gradient(circle at 40% 34%, ${t.gradeColor[M.overall]}33, transparent 72%)`,
                boxShadow:`inset 0 0 0 1px ${t.gradeColor[M.overall]}70`}}/>
              <div style={{position:"relative",fontFamily:t.displayFont,fontSize:46,fontWeight:700,
                color:t.gradeColor[M.overall],lineHeight:1}}>{M.overall}</div>
            </div>
            <div>
              <div style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:t.accent,marginBottom:7}}>Overall condition</div>
              <div style={{fontFamily:t.displayFont,fontSize:24,fontWeight:600,letterSpacing:"-.4px"}}>{GRADE_DESC[M.overall]}</div>
              <div style={{fontSize:12,color:t.sub,lineHeight:1.75,marginTop:8,maxWidth:"4.2in"}}>
                Weighted across {M.withF.length} system{M.withF.length===1?"":"s"} evaluated at this property.
                {M.cP>0?` ${M.cP} priority item${M.cP>1?"s":""} hold the grade back and warrant correction by a qualified specialist.`:" No priority items were identified."}
              </div>
            </div>
          </div>
        </div>
      )}
      {t.gradeStyle==="bars" && (
        <div style={{margin:"10px 0 26px",border:`1px solid ${t.hair}`,borderRadius:t.radius,overflow:"hidden"}}>
          <div style={{background:t.coverBg,color:t.coverInk,padding:"18px 22px",display:"flex",alignItems:"center",gap:20}}>
            <div style={{fontFamily:t.displayFont,fontSize:52,fontWeight:700,lineHeight:1,color:t.gradeColor[M.overall]}}>{M.overall}</div>
            <div style={{borderLeft:"1px solid rgba(242,247,251,.18)",paddingLeft:20}}>
              <div style={{fontFamily:t.displayFont,fontSize:19,fontWeight:600}}>{GRADE_DESC[M.overall]}</div>
              <div style={{fontSize:11.5,color:"rgba(242,247,251,.65)",lineHeight:1.65,marginTop:4,maxWidth:"4.2in"}}>
                Weighted across {M.withF.length} system{M.withF.length===1?"":"s"}.
                {M.cP>0?` ${M.cP} priority item${M.cP>1?"s":""} require correction by a qualified specialist.`:" No priority items identified."}
              </div>
            </div>
          </div>
          {/* the scale, with the achieved grade lit */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,padding:"16px 22px 18px"}}>
            {["A","B","C","D","F"].map(g=>{
              const on = g===M.overall;
              return (
                <div key={g} style={{textAlign:"center"}}>
                  <div style={{height:7,borderRadius:4,marginBottom:7,
                    background:on?t.gradeColor[g]:t.hair,
                    boxShadow:on?`0 0 0 3px ${t.gradeColor[g]}22`:"none"}}/>
                  <div style={{fontFamily:t.displayFont,fontSize:12,fontWeight:on?700:500,
                    color:on?t.gradeColor[g]:t.sub}}>{g}</div>
                  <div style={{fontSize:7.5,letterSpacing:.4,color:t.sub,marginTop:2,textTransform:"uppercase"}}>
                    {GRADE_DESC[g].split(" — ")[0]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {t.gradeStyle==="ring" && (
        <div style={{display:"flex",gap:30,alignItems:"center",margin:"10px 0 28px",
          padding:"26px 28px",borderRadius:t.radius,
          background:`linear-gradient(120deg, ${t.gradeColor[M.overall]}0d, transparent 62%)`,
          border:`1px solid ${t.hair}`}}>
          <div style={{width:132,height:132,borderRadius:"50%",flexShrink:0,position:"relative",
            display:"flex",alignItems:"center",justifyContent:"center",
            background:`radial-gradient(circle at 40% 34%, ${t.gradeColor[M.overall]}26, transparent 70%)`,
            boxShadow:`inset 0 0 0 1px ${t.gradeColor[M.overall]}55`}}>
            <div style={{fontFamily:t.displayFont,fontSize:62,fontWeight:400,lineHeight:1,
              color:t.gradeColor[M.overall]}}>{M.overall}</div>
            <div style={{position:"absolute",bottom:20,fontSize:7,letterSpacing:2.2,
              textTransform:"uppercase",color:t.sub}}>Overall</div>
          </div>
          <div>
            <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:400,marginBottom:8,letterSpacing:"-.3px"}}>
              {GRADE_DESC[M.overall]}
            </div>
            <div style={{height:1,width:66,marginBottom:11,
              background:`linear-gradient(90deg, ${t.accent}, transparent)`}}/>
            <div style={{fontSize:12,color:t.sub,lineHeight:1.75,maxWidth:"4.3in"}}>
              Weighted across {M.withF.length} system{M.withF.length===1?"":"s"} evaluated during this inspection.
              {M.cP>0?` ${M.cP} priority item${M.cP>1?"s":""} hold this grade back and warrant attention from a qualified specialist.`:" No priority items were identified."}
            </div>
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
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo} biz={biz}/>
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

function ExecPage({t,report,M,blocks,part=1,parts=1,pageBase,reportNo,pageNo,biz}:any){
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
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo} biz={biz}/>
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
    <div style={{marginBottom:16,padding:"14px 16px",border:`1px solid ${t.hair}`,borderLeft:`4px solid ${t.gradeColor[g.grade]}`,borderRadius:t.radius,display:"flex",alignItems:"center",gap:14,background:isLightHex(t.pageBg)?"transparent":"#15171b"}}>
      <div style={{fontFamily:"monospace",fontSize:13,color:t.accent,letterSpacing:1}}>[{String(idx+1).padStart(2,"0")}]</div>
      <div style={{flex:1}}><div style={{fontFamily:t.displayFont,fontSize:18,fontWeight:700}}>{name}</div><div style={{fontSize:9,letterSpacing:1.5,color:t.sub,textTransform:"uppercase",fontFamily:"monospace"}}>{partNote ? `${s.subtitle||s.grp} \u00b7 ${partNote}` : (s.subtitle||s.grp)}</div></div>
      <span style={{fontSize:11,fontWeight:700,color:"#fff",background:t.gradeColor[g.grade],borderRadius:t.radius,padding:"3px 10px",fontFamily:"monospace"}}>GRADE {g.grade}</span>
    </div>
  );
  if(lay==="monolith") return (
    <div style={{position:"relative",marginBottom:20,paddingBottom:16,overflow:"hidden"}}>
      <div style={{position:"absolute",right:-4,top:-14,fontFamily:t.displayFont,fontSize:78,fontWeight:700,
        lineHeight:1,color:t.hair,opacity:.75,letterSpacing:"-3px"}}>{String(idx+1).padStart(2,"0")}</div>
      <div style={{position:"relative"}}>
        <div style={{fontSize:8,letterSpacing:3.2,textTransform:"uppercase",color:t.accent,marginBottom:5}}>
          {s.subtitle||s.grp}
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:12}}>
          <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:600,letterSpacing:"-.6px"}}>{name}</div>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",
            color:t.gradeColor[g.grade],border:`1px solid ${t.gradeColor[g.grade]}55`,borderRadius:20,
            padding:"2px 10px",boxShadow:`0 0 14px -4px ${t.gradeColor[g.grade]}88`}}>Grade {g.grade}</span>
        </div>
      </div>
      <div style={{position:"absolute",left:0,right:0,bottom:0,height:2,borderRadius:2,
        background:`linear-gradient(90deg, ${t.accent}, ${t.accent}22 52%, transparent)`}}/>
    </div>
  );
  if(lay==="ledger") return (
    <div style={{marginBottom:18,display:"flex",alignItems:"stretch",borderRadius:t.radius,overflow:"hidden",
      background:t.coverBg,color:t.coverInk}}>
      <div style={{width:54,flexShrink:0,background:t.accent,display:"grid",placeItems:"center"}}>
        <span style={{fontFamily:t.displayFont,fontSize:19,fontWeight:700,color:"#fff"}}>{String(idx+1).padStart(2,"0")}</span>
      </div>
      <div style={{flex:1,minWidth:0,padding:"13px 16px"}}>
        <div style={{fontFamily:t.displayFont,fontSize:18,fontWeight:600,letterSpacing:"-.2px"}}>{name}</div>
        <div style={{fontSize:8.5,letterSpacing:2,textTransform:"uppercase",color:"rgba(242,247,251,.55)",marginTop:2}}>
          {s.subtitle||s.grp}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",padding:"0 16px 0 12px",gap:9,
        borderLeft:"1px solid rgba(242,247,251,.14)"}}>
        <span style={{fontSize:7.5,letterSpacing:1.6,textTransform:"uppercase",color:"rgba(242,247,251,.5)"}}>Grade</span>
        <span style={{fontFamily:t.displayFont,fontSize:21,fontWeight:700,color:t.gradeColor[g.grade]}}>{g.grade}</span>
      </div>
    </div>
  );
  if(lay==="atrium") return (
    <div style={{marginBottom:20,paddingBottom:15,position:"relative"}}>
      {/* the rule fades out to the right — no hard stop anywhere on the page */}
      <div style={{position:"absolute",left:0,right:0,bottom:0,height:1,
        background:`linear-gradient(90deg, ${t.ink}, ${t.hair} 42%, transparent)`}}/>
      <div style={{display:"flex",alignItems:"flex-end",gap:16}}>
        <div style={{fontFamily:t.displayFont,fontSize:40,fontWeight:300,lineHeight:.95,
          color:t.hair,letterSpacing:"-1px"}}>{String(idx+1).padStart(2,"0")}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:8.5,letterSpacing:3.2,color:t.accent,textTransform:"uppercase",marginBottom:4}}>
            {s.subtitle||s.grp}
          </div>
          <div style={{fontFamily:t.displayFont,fontSize:25,fontWeight:400,letterSpacing:"-.4px",lineHeight:1.1}}>{name}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,paddingBottom:2}}>
          <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:400,lineHeight:1,
            color:t.gradeColor[g.grade]}}>{g.grade}</div>
          <div style={{fontSize:7,letterSpacing:1.8,color:t.sub,textTransform:"uppercase",marginTop:2}}>Grade</div>
        </div>
      </div>
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


/* Attic ratings. A client never goes up there, so a graded grid communicates
   the state of the space faster than prose can. */
function AtticGrid({t,d}:{t:ThemeTokens;d:AtticData}){
  return (
    <div style={{marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {ATTIC_ITEMS.map(item=>{
          const v = (d as any)[item.key] as keyof typeof RATING_TONE;
          const c = RATING_TONE[v];
          return (
            <div key={item.key} style={{display:"flex",alignItems:"center",gap:10,border:`1px solid ${t.hair}`,
              borderLeft:`3px solid ${c}`,borderRadius:t.radius,padding:"10px 13px"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:t.displayFont,fontSize:12.5,fontWeight:700}}>{item.label}</div>
                <div style={{fontSize:9.5,color:t.sub,marginTop:1}}>{item.hint}</div>
              </div>
              <span style={{fontSize:9.5,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",
                color:c,whiteSpace:"nowrap"}}>{RATING_LABEL[v]}</span>
            </div>
          );
        })}
      </div>
      {d.note ? (
        <div style={{marginTop:10,fontSize:11.5,color:t.sub,lineHeight:1.6,
          borderLeft:`2px solid ${t.hair}`,paddingLeft:11}}>{d.note}</div>
      ) : null}
    </div>
  );
}

function FindingCard({t,f,urls,photoH=PHOTO_H,square=false,thermal=false}:any){
  const m=t.sev[f.severity as keyof typeof t.sev]||t.sev.monitor;
  const purl=f.photo_path?urls[f.photo_path]:null;
  const lay=t.layout;
  const shapes=normalizeShapes(f.annotations);
  /* Same rendered size as the object-fit:cover image this replaces — the photo
     does not change shape. AnnotatedPhoto just crops the overlay identically so
     the shapes stay locked to what they were drawn around. */
  const body=(<><div style={{fontSize:11.5,color:t.sub,lineHeight:1.6}}>{f.ai_text||f.note}</div>{purl && (
    <div style={{marginTop:11}}>
      {thermal
        ? <AnnotatedPhoto src={purl} shapes={shapes} aspect={4/3} radius={t.radius} strokeWidth={1.6} fontSize={8}/>
        : square
        ? <AnnotatedPhoto src={purl} shapes={shapes} aspect={1} radius={t.radius} strokeWidth={2} fontSize={9}/>
        : <AnnotatedPhoto src={purl} shapes={shapes} height={photoH} radius={t.radius} strokeWidth={2.5} fontSize={11}/>}
    </div>
  )}</>);
  if(lay==="band" || lay==="technical") return (
    <div style={{border:`1px solid ${t.hair}`,borderLeft:`4px solid ${m.c}`,borderRadius:t.radius,padding:"13px 15px",marginBottom:11,pageBreakInside:"avoid",background:isLightHex(t.pageBg)?"transparent":"#15171b"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:4}}>
        <div style={{fontFamily:t.displayFont,fontSize:14,fontWeight:700}}>{f.title||"Observation"}</div>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:.5,padding:"3px 9px",borderRadius:t.radius,color:m.c,background:m.bg}}>{f.severity.toUpperCase()}</span>
      </div>{body}
    </div>
  );
  if(thermal) return (
    /* A scan plate: the image leads, the reading sits beneath it in small type.
       Six to a page, so everything here is sized down rather than reflowed. */
    <div style={{border:`1px solid ${t.hair}`,borderRadius:t.radius,overflow:"hidden",pageBreakInside:"avoid",
      background:isLightHex(t.pageBg)?"transparent":"#15171b"}}>
      <div style={{position:"relative"}}>
        {purl
          ? <AnnotatedPhoto src={purl} shapes={shapes} aspect={4/3} radius={0} strokeWidth={1.6} fontSize={8}/>
          : <div style={{aspectRatio:"4 / 3",background:t.hair}}/>}
        <span style={{position:"absolute",top:6,left:6,fontSize:6.5,fontWeight:700,letterSpacing:1.1,
          color:"#fff",background:"rgba(0,0,0,.55)",borderRadius:3,padding:"2px 5px"}}>IR</span>
        <span style={{position:"absolute",top:6,right:6,width:7,height:7,borderRadius:"50%",
          background:m.c,boxShadow:"0 0 0 2px rgba(0,0,0,.35)"}}/>
      </div>
      <div style={{padding:"8px 10px 10px"}}>
        <div style={{fontFamily:t.displayFont,fontSize:11,fontWeight:700,lineHeight:1.25,marginBottom:2}}>
          {f.title||"Scan"}
        </div>
        <div style={{fontSize:7,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:m.c,marginBottom:4}}>
          {f.severity}
        </div>
        <div style={{fontSize:8.8,color:t.sub,lineHeight:1.5}}>{f.ai_text||f.note}</div>
      </div>
    </div>
  );
  if(lay==="monolith") return (
    /* A raised panel with a lit edge. On a dark page a bordered box disappears,
       so the separation comes from the panel being lighter than the sheet. */
    <div style={{position:"relative",borderRadius:t.radius,overflow:"hidden",marginBottom:13,
      background:"linear-gradient(160deg, rgba(23,42,66,.85), rgba(13,25,42,.9))",
      boxShadow:`inset 0 1px 0 rgba(234,242,250,.07)`,pageBreakInside:"avoid"}}>
      <div style={{height:2,background:`linear-gradient(90deg, ${m.c}, ${m.c}33 48%, transparent)`}}/>
      <div style={{padding:"13px 16px 15px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:5}}>
          <div style={{fontFamily:t.displayFont,fontSize:15,fontWeight:600,letterSpacing:"-.2px"}}>{f.title||"Observation"}</div>
          <span style={{display:"flex",alignItems:"center",gap:6,fontSize:8,fontWeight:700,letterSpacing:1.3,
            textTransform:"uppercase",color:m.c,whiteSpace:"nowrap"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:m.c,boxShadow:`0 0 8px ${m.c}`}}/>
            {f.severity}
          </span>
        </div>{body}
      </div>
    </div>
  );
  if(lay==="ledger") return (
    /* A ledger row, not a card: a narrow gutter carries the severity marker and
       the entries stack on hairlines. It reads as a record rather than a list of
       boxes, which is what makes a long report feel orderly. */
    <div style={{display:"flex",gap:13,padding:"13px 0",borderBottom:`1px solid ${t.hair}`,pageBreakInside:"avoid"}}>
      <div style={{width:4,flexShrink:0,borderRadius:3,background:m.c,marginTop:3,marginBottom:3}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:4}}>
          <div style={{fontFamily:t.displayFont,fontSize:14.5,fontWeight:600,letterSpacing:"-.1px"}}>{f.title||"Observation"}</div>
          <span style={{fontSize:8,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",color:m.c,
            background:m.bg,padding:"3px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{f.severity}</span>
        </div>{body}
      </div>
    </div>
  );
  if(lay==="atrium") return (
    /* No border box. A soft wash of the severity colour bleeds in from the left
       and dissolves, which separates findings without ruling lines around them. */
    <div style={{position:"relative",padding:"15px 17px",marginBottom:12,borderRadius:t.radius,
      background:`linear-gradient(100deg, ${m.bg} 0%, ${m.bg}66 34%, transparent 78%)`,
      pageBreakInside:"avoid"}}>
      <div style={{position:"absolute",left:0,top:12,bottom:12,width:2,borderRadius:2,
        background:`linear-gradient(180deg, ${m.c}, ${m.c}22)`}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:5}}>
        <div style={{fontFamily:t.displayFont,fontSize:16,fontWeight:500,letterSpacing:"-.2px"}}>{f.title||"Observation"}</div>
        <span style={{fontSize:8,fontWeight:700,letterSpacing:1.4,color:m.c,textTransform:"uppercase",whiteSpace:"nowrap"}}>{f.severity}</span>
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

function SectionPage({t,s,g,idx,findings,part=1,parts=1,attic,urls,pageBase,reportNo,address,pageNo,biz}:any){
  const list = findings ?? s.findings ?? [];
  const wide = isAttic(s.name);
  const ir = isThermal(s.name);
  return (
    <div className="rv-page" style={pageBase}>
      <SectionHeader t={t} s={s} g={g} idx={idx} part={part} parts={parts}/>
      {part===1 && attic && atticRated(attic) && <AtticGrid t={t} d={attic}/>}
      {ir ? (
        <>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${THERMAL_COLS},1fr)`,gap:THERMAL_GAP,alignItems:"start"}}>
            {list.map((f:any)=>(<FindingCard key={f.id} t={t} f={f} urls={urls} thermal/>))}
          </div>
          {part===parts && (
            <div style={{marginTop:16,paddingTop:11,borderTop:`1px solid ${t.hair}`,fontSize:9.5,color:t.sub,lineHeight:1.65}}>
              Infrared imaging detects surface temperature difference, not moisture itself. Apparent
              anomalies indicate an area warranting further evaluation and are not, on their own,
              confirmation of a defect. Scanning is affected by surface material, air movement and the
              temperature differential present at the time of inspection.
            </div>
          )}
        </>
      ) : wide ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:ATTIC_GAP,alignItems:"start"}}>
          {list.map((f:any)=>(<FindingCard key={f.id} t={t} f={f} urls={urls} square/>))}
        </div>
      ) : (
        list.map((f:any)=>(<FindingCard key={f.id} t={t} f={f} urls={urls} photoH={PHOTO_H}/>))
      )}
      <Foot t={t} reportNo={reportNo} address={address} p={pageNo} biz={biz}/>
    </div>
  );
}

/* ---------------- SCOPE PAGE ---------------- */

function ScopePage({t,report,pageBase,reportNo,pageNo,biz}:any){
  const lay=t.layout;
  const boxBg = isLightHex(t.pageBg) ? (lay==="technical"?"transparent":"#f6f5f1") : "#15171b";
  const box = onPanel(boxBg==="transparent" ? t.pageBg : boxBg, t);
  const disclaimer=(
    <>
      <p style={{fontSize:11.5,color:box.sub,lineHeight:1.7,margin:"0 0 12px"}}>This report reflects a visual, non-invasive inspection of the readily accessible systems and components of the property on the date noted, performed in general accordance with the InterNACHI Standards of Practice. It is not a code-compliance inspection, a warranty, or a guarantee against future failure. Conditions concealed behind finishes, beneath floor coverings, within walls, or otherwise not visible at the time of inspection are excluded.</p>
      <p style={{fontSize:11.5,color:box.sub,lineHeight:1.7,margin:0}}>The inspector assumes no liability for repairs performed by others or for conditions arising after the inspection date. This report is prepared solely for the named client and may not be relied upon by any other party.</p>
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
        <div style={{flex:1,borderTop:`1px solid ${t.ink}`,paddingTop:8}}>Inspector — {report.inspector||biz?.inspector_name||"—"}, Certified Property Inspector{` · InterNACHI ID ${biz?.internachi_id||report.nachi_id||"NACHI26020705"}`}{biz?.license_no?` · Licence ${biz.license_no}`:""}</div>
        <div style={{flex:1,borderTop:`1px solid ${t.ink}`,paddingTop:8}}>Date — {fmtDate(report.inspection_date)}</div>
      </div>
      {lay==="band" ? (
        <div style={{background:t.accent,color:"#fff",borderRadius:t.radius,padding:22,textAlign:"center",marginTop:34}}>
          <div style={{fontFamily:t.displayFont,fontSize:18,fontWeight:700}}>Thank you for choosing {biz?.company_name||"ProSight Property Inspections"}</div>
          <div style={{fontSize:11,opacity:.85,marginTop:5}}>{[biz?.legal_name||"AdjusterFlow L.L.C.", biz?.address||"Dearborn Heights, MI"].filter(Boolean).join(" · ")} · Reference {reportNo}</div>
        </div>
      ) : lay==="minimal" ? (
        <div style={{textAlign:"center",marginTop:44}}>
          <div style={{width:40,height:1,background:t.ink,margin:"0 auto 18px"}}/>
          <div style={{fontFamily:t.displayFont,fontSize:17,fontWeight:700,letterSpacing:1}}>Thank you</div>
          <div style={{fontSize:11,color:t.sub,marginTop:6,letterSpacing:1}}>{biz?.company_name||"ProSight Property Inspections"} · {reportNo}</div>
        </div>
      ) : (
        <div style={{textAlign:"center",marginTop:34,paddingTop:22,borderTop:`1px solid ${t.hair}`}}>
          <div style={{fontFamily:t.displayFont,fontSize:17,fontWeight:700,color:t.accent}}>Thank you for choosing {biz?.company_name||"ProSight Property Inspections"}</div>
          <div style={{fontSize:11,color:t.sub,marginTop:5}}>{[biz?.legal_name||"AdjusterFlow L.L.C.", biz?.address||"Dearborn Heights, MI"].filter(Boolean).join(" · ")} · Reference {reportNo}</div>
        </div>
      )}
      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo} biz={biz}/>
    </div>
  );
}


/* Receptacle testing. Deliberately a table and nothing else: no photographs,
   because a count is the whole finding. */
function OutletPage({t,report,rows,part,parts,totals,pageBase,reportNo,pageNo,biz}:any){
  const faults = totals.defective + totals.open_ground;
  const cell:React.CSSProperties = { padding:"9px 10px", borderBottom:`1px solid ${t.hair}`, fontSize:11.5 };
  const num:React.CSSProperties = { ...cell, textAlign:"center", fontVariantNumeric:"tabular-nums" };

  return (
    <div className="rv-page" style={pageBase}>
      <SecTitle t={t}
        title={part===1 ? "Receptacle Testing" : "Receptacle Testing (continued)"}
        sub={parts>1 ? `Page ${part} of ${parts} · outlets tested by room`
                     : "Outlets tested by room, with faults noted"}/>

      {part===1 && (
        <div style={{display:"flex",gap:12,margin:"6px 0 20px"}}>
          {[["Outlets tested",totals.total,t.ink],
            ["Working normally",totals.working,t.sev.satisfactory.c],
            ["Defective",totals.defective,t.sev.priority.c],
            ["Open ground",totals.open_ground,t.sev.monitor.c]].map((x:any,i:number)=>(
            <div key={i} style={{flex:1,border:`1px solid ${t.hair}`,borderRadius:t.radius,padding:"13px 10px",textAlign:"center"}}>
              <div style={{fontFamily:t.displayFont,fontSize:24,fontWeight:700,color:x[2]}}>{x[1]}</div>
              <div style={{fontSize:8.5,letterSpacing:1,color:t.sub,textTransform:"uppercase",marginTop:2}}>{x[0]}</div>
            </div>
          ))}
        </div>
      )}

      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr>
            {["Room / Area","Tested","Working","Defective","Open Ground"].map((h,i)=>(
              <th key={i} style={{borderBottom:`2px solid ${t.ink}`,color:t.ink,fontSize:9,letterSpacing:1,
                textTransform:"uppercase",textAlign:i===0?"left":"center",padding:"8px 10px",fontFamily:t.bodyFont}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r:OutletRow)=>{
            const w = workingCount(r);
            const clean = (r.defective||0)===0 && (r.open_ground||0)===0;
            return (
              <tr key={r.id}>
                <td style={{...cell,fontWeight:600}}>
                  {r.room||"—"}
                  {r.notes ? <div style={{fontSize:10,color:t.sub,fontWeight:400,marginTop:1}}>{r.notes}</div> : null}
                </td>
                <td style={num}>{r.total||0}</td>
                <td style={{...num,color:clean?t.sev.satisfactory.c:t.sub,fontWeight:clean?700:400}}>{w}</td>
                <td style={{...num,color:(r.defective||0)?t.sev.priority.c:t.sub,fontWeight:(r.defective||0)?700:400}}>{r.defective||"—"}</td>
                <td style={{...num,color:(r.open_ground||0)?t.sev.monitor.c:t.sub,fontWeight:(r.open_ground||0)?700:400}}>{r.open_ground||"—"}</td>
              </tr>
            );
          })}
        </tbody>
        {part===parts && (
          <tfoot>
            <tr>
              <td style={{padding:"11px 10px",borderTop:`2px solid ${t.ink}`,fontSize:11.5,fontWeight:700}}>All rooms</td>
              <td style={{padding:"11px 10px",borderTop:`2px solid ${t.ink}`,textAlign:"center",fontSize:11.5,fontWeight:700}}>{totals.total}</td>
              <td style={{padding:"11px 10px",borderTop:`2px solid ${t.ink}`,textAlign:"center",fontSize:11.5,fontWeight:700,color:t.sev.satisfactory.c}}>{totals.working}</td>
              <td style={{padding:"11px 10px",borderTop:`2px solid ${t.ink}`,textAlign:"center",fontSize:11.5,fontWeight:700,color:t.sev.priority.c}}>{totals.defective}</td>
              <td style={{padding:"11px 10px",borderTop:`2px solid ${t.ink}`,textAlign:"center",fontSize:11.5,fontWeight:700,color:t.sev.monitor.c}}>{totals.open_ground}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {part===parts && (
        <div style={{marginTop:18,fontSize:10.5,color:t.sub,lineHeight:1.65,borderTop:`1px solid ${t.hair}`,paddingTop:12}}>
          Receptacles were tested with a plug-in circuit tester at readily accessible locations.
          {faults>0
            ? ` ${faults} receptacle${faults===1?"":"s"} did not test correctly. Repairs should be carried out by a licensed electrician.`
            : " All tested receptacles responded correctly at the time of inspection."}
          {" "}Outlets behind furniture, appliances or stored belongings were not accessible and are excluded.
        </div>
      )}

      <Foot t={t} reportNo={reportNo} address={report.address} p={pageNo} biz={biz}/>
    </div>
  );
}

function SecTitle({t,title,sub}:{t:ThemeTokens;title:string;sub:string}){
  if(t.layout==="monolith") return (
    <div style={{position:"relative",marginBottom:16,paddingBottom:13}}>
      <div style={{fontSize:8,letterSpacing:3.4,textTransform:"uppercase",color:t.accent,marginBottom:6}}>ProSight Ultra</div>
      <div style={{fontFamily:t.displayFont,fontSize:26,fontWeight:600,letterSpacing:"-.6px"}}>{title}</div>
      <div style={{fontSize:11,color:t.sub,marginTop:4}}>{sub}</div>
      <div style={{position:"absolute",left:0,right:0,bottom:0,height:2,borderRadius:2,
        background:`linear-gradient(90deg, ${t.accent}, ${t.accent}22 52%, transparent)`}}/>
    </div>
  );
  if(t.layout==="ledger") return (
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6}}>
        <div style={{width:22,height:3,background:t.accent,borderRadius:2}}/>
        <div style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:t.accent,fontWeight:700}}>ProSight</div>
      </div>
      <div style={{fontFamily:t.displayFont,fontSize:23,fontWeight:600,letterSpacing:"-.4px"}}>{title}</div>
      <div style={{fontSize:11,color:t.sub,marginTop:3}}>{sub}</div>
    </div>
  );
  if(t.layout==="atrium") return (
    <div style={{marginBottom:12,paddingBottom:12,position:"relative"}}>
      <div style={{position:"absolute",left:0,right:0,bottom:0,height:1,
        background:`linear-gradient(90deg, ${t.accent}, ${t.hair} 40%, transparent)`}}/>
      <div style={{fontFamily:t.displayFont,fontSize:25,fontWeight:400,letterSpacing:"-.4px"}}>{title}</div>
      <div style={{fontSize:11,color:t.sub,marginTop:4}}>{sub}</div>
    </div>
  );
  return <div style={{marginBottom:8}}>
    <div style={{fontFamily:t.displayFont,fontSize:22,fontWeight:700,borderLeft:`3px solid ${t.accent}`,paddingLeft:12}}>{title}</div>
    <div style={{fontSize:12,color:t.sub,marginLeft:15,marginTop:3}}>{sub}</div>
  </div>;
}
