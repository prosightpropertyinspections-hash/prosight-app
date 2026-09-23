/* The text a customer receives with their report. One function, used by the
   share window to preview it and by the server to send it, so what you see
   is exactly what goes out. */

export const BUSINESS_PHONE = "(313) 266-2268";

export function reportMessage(o: { client?: string; address?: string; link: string; password: string }) {
  const first = (o.client || "").trim().split(/\s+/)[0];
  const street = (o.address || "").split(",")[0].trim();
  return [
    "ProSight Property Inspections",
    "",
    `Hi${first ? ` ${first}` : ""}, your inspection report${street ? ` for ${street}` : ""} is ready.`,
    "",
    `View it here: ${o.link}`,
    `Password: ${o.password}`,
    "",
    `Questions? Call ${BUSINESS_PHONE}. Reply STOP to opt out.`,
  ].join("\n");
}

/* US numbers arrive typed every way: (313) 555-0142, 313-555-0142, 3135550142. */
export function toE164(raw: string): string | null {
  const d = (raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.length >= 11 ? d : null;
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
