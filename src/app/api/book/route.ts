import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";
import { BOOKING_MIN, conflicts } from "@/lib/availability";
import { quote } from "@/lib/pricing";

/* Public booking endpoint. Anyone on the marketing site can reach it, so it is
   written defensively: it trusts nothing from the browser, writes only the
   fields it names, and never returns anything about other bookings. */

const MAX = 240;
const clean = (v: any, n = MAX) => String(v ?? "").trim().slice(0, n);

const OPEN_HOUR = 8;      // earliest start
const CLOSE_HOUR = 17;    // latest start
const SLOT_MIN = 30;
const DURATION_MIN = BOOKING_MIN; // a website booking holds two hours
const TZ = "America/Detroit";

/* The server runs in UTC, but every time on this form is Michigan time.
   These convert between the two so a 9:00 AM booking is stored as 9:00 AM
   Detroit, not 9:00 AM UTC (5:00 AM here). */
function tzOffsetMs(d: Date) {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - d.getTime();
}
function detroitTime(day: string, hh = 0, mm = 0) {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - tzOffsetMs(new Date(guess)));
}
function detroitHHMM(d: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(d);
}
function detroitDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    const name = clean(b.name, 120);
    const phone = clean(b.phone, 40);
    const email = clean(b.email, 160);
    const address = clean(b.address, 240);
    const services: string[] = Array.isArray(b.services)
      ? b.services.slice(0, 8).map((s: any) => clean(s, 60)).filter(Boolean)
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

    // A bare "YYYY-MM-DDTHH:MM" from the form is Michigan wall-clock time.
    const local = startsAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    const when = local && !/(Z|[+-]\d{2}:?\d{2})$/.test(startsAt)
      ? detroitTime(local[1], +local[2], +local[3])
      : new Date(startsAt);
    if (isNaN(when.getTime())) return NextResponse.json({ error: "That date and time didn't come through." }, { status: 400 });
    if (when.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "That time is in the past." }, { status: 400 });
    }

    const db = admin();

    /* Taken slots are checked again here, not only in the browser: two people
       can open the form at once and pick the same morning. */
    const dayStart = detroitTime(detroitDay(when));
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000 - 1);
    const { data: sameDay } = await db.from("appointments")
      .select("starts_at,duration_min,status")
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString());

    // Same rule as the schedule: see src/lib/availability.ts
    const clash = conflicts(when.getTime(), DURATION_MIN, sameDay || []).length > 0;
    if (clash) {
      return NextResponse.json({ error: "That time was just taken. Please choose another." }, { status: 409 });
    }

    const row: any = {
      client_name: name,
      phone, email, address,
      service: services[0] || "Full home inspection",
      services: services.length ? services : ["Full home inspection"],
      // Priced here from the same table the page shows, never taken from the browser.
      fee: quote(services.length ? services : ["Full home inspection"],
        Math.max(0, Math.min(99999, Math.round(Number(b.sqft) || 0)))).total,
      starts_at: when.toISOString(),
      duration_min: DURATION_MIN,
      status: "requested",
      source: "website",
      notes,
      sms_consent: consent,
      sms_consent_at: consent ? new Date().toISOString() : null,
    };

    // Website bookings belong to the business owner's account, since no one
    // is signed in when a customer books.
    row.owner = process.env.BOOKING_OWNER_ID || await soleUserId(db);
    if (!row.owner) {
      console.error("book: set BOOKING_OWNER_ID - could not pick an owner account");
      return NextResponse.json({ error: "We couldn't save that request. Please call us instead." }, { status: 500 });
    }

    const { data, error } = await db.from("appointments").insert(row).select("id").single();
    if (error) {
      console.error("book insert failed:", error);
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
    const from = detroitTime(day);
    const to = new Date(from.getTime() + 24 * 3600_000 - 1);
    const { data } = await db.from("appointments")
      .select("starts_at,duration_min,status")
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString());

    /* A start time is unavailable if a two-hour inspection starting then would
       overlap any booking: so a 11:30 booking also blocks 10:00 through 11:00,
       not just the hours it occupies. */
    const taken: string[] = [];
    for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MIN) {
        if (h === CLOSE_HOUR && m > 0) break;
        const st = detroitTime(day, h, m).getTime();
        if (conflicts(st, DURATION_MIN, data || []).length) {
          taken.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      }
    }
    return NextResponse.json({ taken, open: OPEN_HOUR, close: CLOSE_HOUR, slot: SLOT_MIN });
  } catch {
    return NextResponse.json({ taken: [] });
  }
}

/* If there is exactly one account, website bookings go to it. With more than
   one, BOOKING_OWNER_ID must say which. */
async function soleUserId(db: any): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 2 });
    const users = data?.users || [];
    return users.length === 1 ? users[0].id : null;
  } catch { return null; }
}
