import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

function gen(len:number, chars:string){ let o=""; const a=new Uint8Array(len); crypto.getRandomValues(a); for(let i=0;i<len;i++) o+=chars[a[i]%chars.length]; return o; }

export async function POST(req: NextRequest){
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return NextResponse.json({ error:"unauthorized" }, { status:401 });
  const { reportId } = await req.json();
  if(!reportId) return NextResponse.json({ error:"missing reportId" }, { status:400 });

  // return existing share if present
  const { data: existing } = await supabase.from("report_shares").select("*").eq("report_id", reportId).eq("owner", user.id).maybeSingle();
  if(existing) return NextResponse.json({ share: existing });

  const code = gen(7, "abcdefghijkmnpqrstuvwxyz23456789");
  const password = gen(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
  const { data, error } = await supabase.from("report_shares")
    .insert({ report_id: reportId, owner: user.id, code, password }).select().single();
  if(error) return NextResponse.json({ error: error.message }, { status:500 });
  return NextResponse.json({ share: data });
}

// toggle enable/disable or regenerate password
export async function PATCH(req: NextRequest){
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return NextResponse.json({ error:"unauthorized" }, { status:401 });
  const { reportId, enabled, regenerate } = await req.json();
  const patch:any = {};
  if(typeof enabled==="boolean") patch.enabled = enabled;
  if(regenerate) patch.password = gen(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
  const { data, error } = await supabase.from("report_shares").update(patch)
    .eq("report_id", reportId).eq("owner", user.id).select().single();
  if(error) return NextResponse.json({ error: error.message }, { status:500 });
  return NextResponse.json({ share: data });
}
