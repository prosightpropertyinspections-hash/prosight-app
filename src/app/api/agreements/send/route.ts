import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { ensureAgreement, agreementUrl, sendSms, toE164, whenText } from "@/lib/agreement";

/* Creates (or refreshes) the agreement for an appointment and, unless
   text:false, texts the client the signing link. Owner only. */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { appointmentId, text = true } = await req.json().catch(() => ({}));
  if (!appointmentId) return NextResponse.json({ error: "No appointment." }, { status: 400 });

  const { data: appt } = await sb.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appt) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

  let ag: any;
  try { ag = await ensureAgreement(sb, appt); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }

  const url = agreementUrl(req.nextUrl.origin, ag.token);
  if (ag.status === "signed" || !text) return NextResponse.json({ ok: true, url, status: ag.status, texted: false });

  const to = toE164(appt.phone || "");
  if (!to) return NextResponse.json({ ok: true, url, status: ag.status, texted: false, note: "No mobile number saved. Copy the link and send it yourself." });

  const first = (appt.client_name || "").trim().split(/\s+/)[0];
  const street = (appt.address || "").split(",")[0].trim();
  const body = [
    "ProSight Property Inspections",
    "",
    `Hi${first ? ` ${first}` : ""}, please review and sign your inspection agreement${street ? ` for ${street}` : ""} before your inspection on ${whenText(appt.starts_at)}:`,
    url,
    "",
    "Questions? Call (313) 266-2268. Reply STOP to opt out.",
  ].join("\n");

  try {
    await sendSms(to, body);
    await sb.from("agreements").update({ sent_at: new Date().toISOString() }).eq("id", ag.id);
    return NextResponse.json({ ok: true, url, status: ag.status, texted: true, to });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, url }, { status: 400 });
  }
}
