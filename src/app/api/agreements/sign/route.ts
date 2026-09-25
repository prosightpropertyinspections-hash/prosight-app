import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";

/* Public: records the client's electronic signature. Stores their typed name,
   the time, their IP address and browser alongside the exact text signed. */
export async function POST(req: NextRequest) {
  const { token, name, agree } = await req.json().catch(() => ({}));
  const signer = String(name || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(String(token || ""))) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  if (signer.length < 3 || !signer.includes(" ")) return NextResponse.json({ error: "Type your full name, first and last." }, { status: 400 });
  if (agree !== true) return NextResponse.json({ error: "Check the box to agree before signing." }, { status: 400 });

  const db = admin();
  const { data: ag } = await db.from("agreements").select("id,status").eq("token", token).maybeSingle();
  if (!ag) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  if (ag.status === "signed") return NextResponse.json({ error: "This agreement is already signed." }, { status: 409 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
  const { error } = await db.from("agreements").update({
    status: "signed",
    signed_at: new Date().toISOString(),
    signer_name: signer,
    signer_ip: ip,
    signer_ua: (req.headers.get("user-agent") || "").slice(0, 300),
  }).eq("id", ag.id).eq("status", "sent");
  if (error) return NextResponse.json({ error: "Could not save your signature. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
