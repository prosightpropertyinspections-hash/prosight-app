import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";

/* Public booking endpoint. Anyone on the marketing site can reach it, so it is
   written defensively: it trusts nothing from the browser, writes only the
   fields it names, and never returns anything about other bookings. */

const MAX = 240;
const clean = (v: any, n = MAX) => String(v ?? "").trim().slice(0, n);

const OPEN_HOUR = 8;      // earliest start
const CLOSE_HOUR = 17;    // latest start
const SLOT_MIN = 30;

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    const name = clean(b.name, 120);
    const phone = clean(b.phone, 40);
    const email = clean(b.email, 160);
    const address = clean(b.address, 240);
    const services: string[] = Array.isArray(b.services)
      ? b.services.slice(0, 3).map((s: any) => clean(s, 60)).filter(Boolean)
      : [];
    const startsAt = clean(b.starts_at, 40);
    const notes = clean(b.notes, 1000);
    const consent = b.sms_consent === true;

    if (!name || !address || !startsAt) {
      return NextResponse.json({ error: "Please fill in your name, the property address and a time." }, { status: 400 });
    }
    if (!phone && !email) {
      return NextResponse.json({ error: "Please leave a phone number or an email so we can confirm." }, { status: 400 });
    }

    const when = new Date(startsAt);
    if (isNaN(when.getTime())) return NextResponse.json({ error: "That date and time didn't come through." }, { status: 400 });
    if (when.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "That time is in the past." }, { status: 400 });
    }

    const db = admin();

    /* Taken slots are checked again here, not only in the browser: two people
       can open the form at once and pick the same morning. */
    const dayStart = new Date(when); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(when); dayEnd.setHours(23, 59, 59, 999);
    const { data: sameDay } = await db.from("appointments")
      .select("starts_at,duration_min,status")
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString());

    const clash = (sameDay || []).some((a: any) => {
      if (a.status === "canceled") return false;
      const s = new Date(a.starts_at).getTime();
      const e = s + (a.duration_min || 180) * 60_000;
      return when.getTime() >= s && when.getTime() < e;
    });
    if (clash) {
      return NextResponse.json({ error: "That time was just taken. Please choose another." }, { status: 409 });
    }

    const row: any = {
      client_name: name,
      phone, email, address,
      service: services[0] || "Full home inspection",
      services: services.length ? services : ["Full home inspection"],
      starts_at: when.toISOString(),
      duration_min: 180,
      status: "requested",
      source: "website",
      notes,
      sms_consent: consent,
      sms_consent_at: consent ? new Date().toISOString() : null,
    };

    const { data, error } = await db.from("appointments").insert(row).select("id").single();
    if (error) {
      return NextResponse.json({ error: "We couldn't save that request. Please call us instead." }, { status: 500 });
    }

    // Tell the inspector a request came in. Best effort — the booking already
    // succeeded, and a failed notification must not fail the request.
    const SID = process.env.TWILIO_ACCOUNT_SID;
    const TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const FROM = process.env.TWILIO_FROM;
    const TO = process.env.TWILIO_FORWARD_TO;
    if (SID && TOKEN && FROM && TO) {
      const pretty = when.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
      });
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: TO, From: FROM,
          Body: `New booking request\n${name}\n${address}\n${pretty}\n${phone || email}`,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please call us instead." }, { status: 500 });
  }
}

/* Which slots are already gone, for the day the form is showing. Returns times
   only — never names, addresses or any other booking detail. */
export async function GET(req: NextRequest) {
  try {
    const day = req.nextUrl.searchParams.get("day") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ taken: [] });

    const db = admin();
    const from = new Date(`${day}T00:00:00`);
    const to = new Date(`${day}T23:59:59`);
    const { data } = await db.from("appointments")
      .select("starts_at,duration_min,status")
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString());

    const taken: string[] = [];
    (data || []).forEach((a: any) => {
      if (a.status === "canceled") return;
      const s = new Date(a.starts_at);
      const mins = a.duration_min || 180;
      for (let m = 0; m < mins; m += SLOT_MIN) {
        const t = new Date(s.getTime() + m * 60_000);
        taken.push(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
      }
    });
    return NextResponse.json({ taken, open: OPEN_HOUR, close: CLOSE_HOUR, slot: SLOT_MIN });
  } catch {
    return NextResponse.json({ taken: [] });
  }
}
