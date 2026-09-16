import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";

/* Records that the client confirmed receipt of the report.
   Public, but it can only ever set a timestamp on a share whose code and
   password are both already known — it cannot read or change the report. */
export async function POST(req: NextRequest){
  const { code, password, name } = await req.json();
  if(!code) return NextResponse.json({ error:"missing code" }, { status:400 });

  const db = admin();
  const { data: share } = await db.from("report_shares").select("*").eq("code", code).maybeSingle();
  if(!share || !share.enabled) return NextResponse.json({ error:"not_found" }, { status:404 });

  if(String(password||"").toUpperCase() !== String(share.password).toUpperCase())
    return NextResponse.json({ error:"bad_password" }, { status:401 });

  // First acknowledgement stands. A later click must not overwrite the original
  // date, because that date is the whole point of the record.
  if(share.acknowledged_at){
    return NextResponse.json({ ok:true, acknowledged_at: share.acknowledged_at });
  }

  const at = new Date().toISOString();
  await db.from("report_shares")
    .update({ acknowledged_at: at, acknowledged_name: String(name||"").slice(0,120) })
    .eq("id", share.id);

  return NextResponse.json({ ok:true, acknowledged_at: at });
}
