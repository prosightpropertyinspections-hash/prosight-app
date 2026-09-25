import { randomBytes } from "crypto";
import { AGREEMENT_TEMPLATE } from "@/content/agreement";

/* Server-side helpers for inspection agreements. */

export const TZ = "America/Detroit";

export function whenText(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

export const feeText = (fee: any) => {
  const n = Number(fee);
  return n > 0 ? `$${n % 1 ? n.toFixed(2) : n.toLocaleString("en-US")}` : "the amount quoted";
};

export function templateReady() {
  return !AGREEMENT_TEMPLATE.includes("PASTE_AGREEMENT_HERE") && AGREEMENT_TEMPLATE.trim().length > 200;
}

export function fillAgreement(a: { client_name?: string | null; address?: string | null; starts_at: string; fee?: any }) {
  return AGREEMENT_TEMPLATE.trim()
    .replace(/\{\{CLIENT\}\}/g, a.client_name || "the Client")
    .replace(/\{\{ADDRESS\}\}/g, a.address || "the Property")
    .replace(/\{\{DATE\}\}/g, whenText(a.starts_at))
    .replace(/\{\{FEE\}\}/g, feeText(a.fee));
}

/* The agreement for an appointment, created on first use. Until it is signed
   it is refreshed from the appointment, so a reschedule or a changed fee is
   reflected in what the client signs. Once signed it never changes. */
export async function ensureAgreement(sb: any, appt: any) {
  if (!templateReady()) throw new Error("Add your agreement text in src/content/agreement.ts first.");

  const { data: existing } = await sb.from("agreements").select("*").eq("appointment_id", appt.id).maybeSingle();
  if (existing?.status === "signed") return existing;

  const fields = {
    client_name: appt.client_name || null,
    address: appt.address || null,
    fee: appt.fee ?? null,
    inspection_at: appt.starts_at,
    body: fillAgreement(appt),
  };

  if (existing) {
    const { data, error } = await sb.from("agreements").update(fields).eq("id", existing.id).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await sb.from("agreements")
    .insert({ ...fields, appointment_id: appt.id, token: randomBytes(18).toString("base64url") })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export const agreementUrl = (origin: string, token: string) => `${origin}/agree/${token}`;

/* US numbers typed any way; E.164 or null. */
export function toE164(raw: string): string | null {
  const d = (raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.length >= 11 ? d : null;
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(to: string, body: string) {
  const SID = process.env.TWILIO_ACCOUNT_SID, TOKEN = process.env.TWILIO_AUTH_TOKEN, FROM = process.env.TWILIO_FROM;
  if (!SID || !TOKEN || !FROM) throw new Error("Texting isn't configured yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM.");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: FROM, Body: body }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.message || `Carrier rejected the message (${res.status}).`);
  return j.sid as string;
}
