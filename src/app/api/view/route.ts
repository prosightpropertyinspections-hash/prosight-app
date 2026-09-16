import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";

// Public endpoint: verify code+password, return report + sections + findings + signed photo urls.
export async function POST(req: NextRequest){
  const { code, password } = await req.json();
  if(!code) return NextResponse.json({ error:"missing code" }, { status:400 });
  const db = admin();

  const { data: share } = await db.from("report_shares").select("*").eq("code", code).maybeSingle();
  if(!share || !share.enabled) return NextResponse.json({ error:"not_found" }, { status:404 });

  // First call may come with no password just to get the client name/address for the gate header.
  if(password === undefined || password === null){
    const { data: rep } = await db.from("reports").select("client,address").eq("id", share.report_id).single();
    return NextResponse.json({ locked:true, client: rep?.client||"", address: rep?.address||"" });
  }

  if(String(password).toUpperCase() !== String(share.password).toUpperCase())
    return NextResponse.json({ error:"bad_password" }, { status:401 });

  // Correct password — return the full report
  const { data: rep } = await db.from("reports").select("*").eq("id", share.report_id).single();
  if(!rep) return NextResponse.json({ error:"not_found" }, { status:404 });
  const { data: sections } = await db.from("sections").select("*").eq("report_id", rep.id).order("sort_order");
  const { data: findings } = await db.from("findings").select("*").eq("report_id", rep.id).order("sort_order");

  const paths:string[] = [];
  (findings||[]).forEach((f:any)=>{ if(f.photo_path) paths.push(f.photo_path); });
  if(rep.cover_photo) paths.push(rep.cover_photo);
  const urls:Record<string,string> = {};
  for(const p of paths){
    const { data } = await db.storage.from("inspection-photos").createSignedUrl(p, 3600);
    if(data?.signedUrl) urls[p] = data.signedUrl;
  }

  (sections||[]).forEach((s:any)=>{ s.findings = (findings||[]).filter((f:any)=>f.section_id===s.id); });
  (rep as any).sections = sections||[];

  /* The client's copy carries the business details too: the report itself reads
     them, and the page needs the contact block and the review link. Only the
     public-facing fields are sent — nothing about the account. */
  const { data: prof } = await db.from("profiles").select(
    "company_name,legal_name,address,phone,email,website,inspector_name,internachi_id,license_no,standards_note,review_url"
  ).eq("user_id", rep.owner).maybeSingle();

  // bump view count (best effort)
  db.from("report_shares").update({ views: (share.views||0)+1 }).eq("id", share.id).then(()=>{});

  return NextResponse.json({
    report: rep,
    urls,
    profile: prof || null,
    acknowledged_at: share.acknowledged_at || null,
  });
}
