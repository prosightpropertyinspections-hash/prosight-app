import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { reportMessage, toE164 } from "@/lib/report-sms";

/* Texts a customer their report link and password.
   Signed-in owner only. The message is composed here from the stored report
   and its share, so this cannot be used to send arbitrary text. */

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!SID || !TOKEN || !FROM) {
    return NextResponse.json({ error: "Texting isn't configured yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM." }, { status: 400 });
  }

  const { reportId, phone } = await req.json().catch(() => ({}));
  if (!reportId) return NextResponse.json({ error: "No report." }, { status: 400 });

  const to = toE164(phone || "");
  if (!to) return NextResponse.json({ error: "Enter a 10-digit mobile number." }, { status: 400 });

  // RLS keeps this to the signed-in owner's own reports.
  const { data: report } = await supabase.from("reports").select("id,client,address").eq("id", reportId).single();
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  /* The link and password come from the same share endpoint the Share window
     uses, called as this user, so the texted password is always the live one. */
  let share: any = null;
  try {
    const r = await fetch(`${req.nextUrl.origin}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
      body: JSON.stringify({ reportId }),
    });
    share = (await r.json())?.share;
  } catch {}
  if (!share?.code || !share?.password) {
    return NextResponse.json({ error: "Couldn't load the share link for this report." }, { status: 500 });
  }

  const body = reportMessage({
    client: report.client, address: report.address,
    link: `${req.nextUrl.origin}/view/${share.code}`, password: share.password,
  });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: FROM, Body: body }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j?.message || `Carrier rejected the message (${res.status}).` }, { status: 400 });
    return NextResponse.json({ ok: true, sid: j.sid, to });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not send the text." }, { status: 500 });
  }
}
