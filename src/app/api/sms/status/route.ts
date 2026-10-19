import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

/* Texts the client when a booking is canceled, rescheduled or completed.
   The wording lives here, not in the request, so this route can't be used to
   send arbitrary text to arbitrary numbers. */

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_FROM;

const REVIEW_URL = "https://g.page/r/Cdau2RCZvisXEAI/review";
const BOOK_URL = "https://app.prosightpropertyinspections.com/book";
const PHONE = "(313) 266-2268";

function toE164(raw: string): string | null {
  const d = (raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.length >= 11 ? d : null;
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function fmt(dt: Date) {
  const date = dt.toLocaleDateString("en-US", { timeZone: "America/Detroit", weekday: "long", month: "long", day: "numeric" });
  const time = dt.toLocaleTimeString("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });
  return { date, time };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!SID || !TOKEN || !FROM) {
    return NextResponse.json({ error: "Texting isn't configured yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM." }, { status: 400 });
  }

  const { appointmentId, kind } = await req.json();
  if (!appointmentId || !["canceled", "rescheduled", "completed"].includes(kind)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { data: appt } = await supabase.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appt) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  if (appt.sms_consent === false) return NextResponse.json({ error: "This client didn't agree to texts." }, { status: 400 });

  const to = toE164(appt.phone || "");
  if (!to) return NextResponse.json({ error: "That client has no usable mobile number saved." }, { status: 400 });

  const first = appt.client_name ? ` ${String(appt.client_name).split(" ")[0]}` : "";
  const when = fmt(new Date(appt.starts_at));
  let lines: string[];

  if (kind === "canceled") {
    lines = [
      `ProSight Property Inspections`, ``,
      `Hi${first}, your inspection on ${when.date} at ${when.time} has been canceled.`,
      `To rebook, call or text ${PHONE} or book online: ${BOOK_URL}`,
    ];
  } else if (kind === "rescheduled") {
    lines = [
      `ProSight Property Inspections`, ``,
      `Hi${first}, your inspection has been rescheduled.`,
      `New time: ${when.date} at ${when.time}`,
      appt.address ? `${appt.address}` : "",
      ``, `Questions? Call or text ${PHONE}.`,
    ];
  } else {
    lines = [
      `ProSight Property Inspections`, ``,
      `Hi${first}, thank you for choosing ProSight. It was a pleasure working with you.`,
      ``,
      `If you were happy with the inspection, a quick Google review helps a small local business a lot: ${REVIEW_URL}`,
    ];
  }
  lines.push(``, `Reply STOP to opt out.`);
  const body = lines.filter((l, i, a) => !(l === "" && (a[i - 1] === "" || i === 0))).join("\n");

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
    if (!res.ok) return NextResponse.json({ error: j?.message || `Carrier rejected the message (${res.status}).` }, { status: 400 });
    return NextResponse.json({ ok: true, sid: j.sid, to });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not send the text." }, { status: 500 });
  }
}
