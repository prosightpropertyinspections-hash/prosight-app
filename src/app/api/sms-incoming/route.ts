import { NextRequest } from "next/server";

/* Incoming texts to the toll-free number.

   A client replying to a confirmation is the most useful message the business
   gets — "can we move to 10?" — and without this it lands in Twilio and is never
   seen. Each one is forwarded to the inspector's mobile with the sender's number
   attached, so a reply can go straight back from the phone.

   Twilio posts here as form data and expects TwiML back. */

const SID   = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM  = process.env.TWILIO_FROM;            // the toll-free number
const TO    = process.env.TWILIO_FORWARD_TO;      // the inspector's mobile

const empty = () =>
  new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } });

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const from = String(form.get("From") || "");
    const body = String(form.get("Body") || "").trim();

    // STOP and HELP are handled by the carrier; forwarding them would be noise.
    if (/^(stop|unstop|start|help|cancel|end|quit)$/i.test(body)) return empty();
    if (!SID || !TOKEN || !FROM || !TO || !from) return empty();

    // Never forward to the sending number: that would loop.
    if (TO.replace(/\D/g, "") === from.replace(/\D/g, "")) return empty();

    const text = `Reply from ${from}:\n\n${body.slice(0, 1200)}`;

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: TO, From: FROM, Body: text }),
    });
  } catch {
    // Never return an error to Twilio: it would retry and the client would see
    // a delivery failure for a message that actually arrived.
  }
  return empty();
}

export async function GET() {
  return new Response("ok", { status: 200 });
}
