import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";

/* Public: the agreement behind a signing link. The token is the only key. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });

  const db = admin();
  const { data: ag } = await db.from("agreements")
    .select("id,client_name,address,fee,inspection_at,body,status,signed_at,signer_name,viewed_at")
    .eq("token", token).maybeSingle();
  if (!ag) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });

  if (!ag.viewed_at && ag.status !== "signed") {
    await db.from("agreements").update({ viewed_at: new Date().toISOString() }).eq("id", ag.id);
  }
  const { id, viewed_at, ...out } = ag;
  return NextResponse.json({ agreement: out });
}
