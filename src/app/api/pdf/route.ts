import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildReportHtml } from "@/lib/report-html";
import type { Report } from "@/lib/types";

export const maxDuration = 60;

export async function GET(req: NextRequest){
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return NextResponse.json({ error:"unauthorized" }, { status:401 });

  const id = new URL(req.url).searchParams.get("id");
  if(!id) return NextResponse.json({ error:"missing id" }, { status:400 });

  // load report (RLS ensures it's the user's own)
  const { data: rep } = await supabase.from("reports").select("*").eq("id", id).single();
  if(!rep) return NextResponse.json({ error:"not_found" }, { status:404 });
  const { data: sections } = await supabase.from("sections").select("*").eq("report_id", id).order("sort_order");
  const { data: findings } = await supabase.from("findings").select("*").eq("report_id", id).order("sort_order");
  const paths:string[]=[]; (findings||[]).forEach((f:any)=>{ if(f.photo_path) paths.push(f.photo_path); });
  if(rep.cover_photo) paths.push(rep.cover_photo);
  const urls:Record<string,string>={};
  for(const p of paths){ const { data }=await supabase.storage.from("inspection-photos").createSignedUrl(p,3600); if(data?.signedUrl) urls[p]=data.signedUrl; }
  (sections||[]).forEach((s:any)=>{ s.findings=(findings||[]).filter((f:any)=>f.section_id===s.id); });
  (rep as any).sections = sections||[];

  const origin = req.nextUrl.origin;
  const html = buildReportHtml(rep as Report, urls, origin);

  const svc = process.env.PDF_SERVICE_URL;
  const secret = process.env.PDF_SERVICE_SECRET || "";
  if(!svc) return NextResponse.json({ error:"PDF_SERVICE_URL not configured" }, { status:500 });

  try{
    const r = await fetch(`${svc.replace(/\/$/,"")}/render`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", ...(secret?{Authorization:`Bearer ${secret}`}:{}) },
      body: JSON.stringify({ html, base_url: origin }),
    });
    if(!r.ok){ const t=await r.text(); return NextResponse.json({ error:`pdf service: ${t.slice(0,200)}` }, { status:502 }); }
    const buf = Buffer.from(await r.arrayBuffer());
    return new NextResponse(buf, { status:200, headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":`inline; filename="ProSight-Report.pdf"`,
    }});
  }catch(e:any){
    return NextResponse.json({ error: e.message || "pdf failed" }, { status:500 });
  }
}
