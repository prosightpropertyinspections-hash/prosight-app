import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL_VISION } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase-server";

/* Reads a data plate: brand, model, serial, and the manufacture year.
   Dating equipment from a serial number is the tedious part of a mechanical
   inspection — every manufacturer encodes it differently — so the model is
   asked to decode only when it is sure, and to return null otherwise. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "no image" }, { status: 400 });

  const instruction = `You are reading the data plate or rating label on a piece of residential equipment (furnace, air conditioner, water heater, electrical panel or similar).

Report ONLY what is legible in the photograph:
- brand: the manufacturer name printed on the plate
- model: the model number exactly as printed
- serial: the serial number exactly as printed
- year: the year of manufacture

For the year, in order of preference:
1. If a manufacture date is printed directly (e.g. "MFG DATE 04/2011", "DATE OF MFR 2015"), use that year.
2. Otherwise, decode the serial number ONLY if you recognise the manufacturer's dating scheme with confidence — for example Rheem/Ruud's first four digits as MMYY, Carrier/Bryant's first four as WWYY, A.O. Smith's first two letters and digits, Trane's leading digit-year formats.
3. If you are not confident, return null. A wrong year on an inspection report is worse than a blank one. Do not estimate from appearance, wear, or style.

Transcribe characters exactly. Do not correct what looks like a typo — plates contain odd strings. If a field is not legible, return an empty string for it.

Also identify what the equipment IS, as specifically as the plate allows, because service life differs sharply within a category — a tankless water heater lasts roughly twice as long as a tank, a standing-seam metal roof more than twice an asphalt one. Use a short specific noun phrase, e.g. "Tankless water heater", "Heat pump water heater", "Gas furnace", "A/C condenser", "Mini-split", "Boiler", "Electrical panel". If the plate does not make the type clear, return an empty string rather than guessing the category.

Return STRICT JSON, no markdown, exactly:
{"brand":"","model":"","serial":"","year":null,"year_basis":"printed|serial|none","equipment_type":""}`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL_VISION, max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
          { type: "text", text: instruction },
        ],
      }],
    });

    let raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();
    raw = raw.replace(/^```json\s*|\s*```$/g, "");
    let p: any;
    try { p = JSON.parse(raw); } catch { return NextResponse.json({ error: "Could not read that plate." }, { status: 400 }); }

    const y = Number(p?.year);
    const thisYear = new Date().getFullYear();
    const year = Number.isFinite(y) && y >= 1950 && y <= thisYear ? y : null;

    return NextResponse.json({
      brand: String(p?.brand || "").trim(),
      model: String(p?.model || "").trim(),
      serial: String(p?.serial || "").trim(),
      year,
      year_basis: ["printed", "serial", "none"].includes(p?.year_basis) ? p.year_basis : "none",
      equipment_type: String(p?.equipment_type || "").trim(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI error" }, { status: 500 });
  }
}
