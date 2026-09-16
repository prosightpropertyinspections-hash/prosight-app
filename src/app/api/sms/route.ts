import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/* Sends an appointment confirmation by SMS.
   The body is composed server-side from the stored appointment, so a caller
   cannot use this route to send arbitrary text to arbitrary numbers. */

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM;

/* US numbers are typed every way imaginable in the field — (313) 555-0142,
   313-555-0142, 3135550142. Normalise to E.164 or refuse. */
function toE164(raw: string): string | null {
  const d = (raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.length >= 11 ? d : null;
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function fmt(dt: Date) {
  const date = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date, time };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!SID || !TOKEN || !FROM) {
    return NextResponse.json({ error: "Texting isn't configured yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM." }, { status: 400 });
  }

  const { appointmentId } = await req.json();
  if (!appointmentId) return NextResponse.json({ error: "no appointment" }, { status: 400 });

  // RLS keeps this to the signed-in owner's own rows.
  const { data: appt } = await supabase.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appt) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

  const to = toE164(appt.phone || "");
  if (!to) return NextResponse.json({ error: "That client has no usable mobile number saved." }, { status: 400 });

  const when = fmt(new Date(appt.starts_at));
  const services: string[] = (appt.services && appt.services.length ? appt.services : [appt.service]).filter(Boolean);
  const lines = [
    `ProSight Property Inspections`,
    ``,
    `Hi${appt.client_name ? ` ${appt.client_name.split(" ")[0]}` : ""}, your inspection is confirmed.`,
    `${when.date} at ${when.time}`,
    appt.address ? `${appt.address}` : "",
    services.length ? `Service: ${services.join(", ")}` : "",
    ``,
    `Reply to this message with any questions. Reply STOP to opt out.`,
  ].filter(Boolean);

  const body = lines.join("\n");

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: FROM, Body: body }),
    });

    const j = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: j?.message || `Carrier rejected the message (${res.status}).` }, { status: 400 });
    }

    await supabase.from("appointments")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", appointmentId);

    return NextResponse.json({ ok: true, sid: j.sid, to });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not send the text." }, { status: 500 });
  }
}
