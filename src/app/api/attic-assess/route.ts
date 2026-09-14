import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL_VISION } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase-server";

/* Reads an attic photo and proposes a rating for each item.
   These are suggestions only — the inspector was in the attic and the model
   was not, so the editor lets every value be overridden. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "no image" }, { status: 400 });

  const instruction = `You are a certified home inspector looking at one photograph taken inside a residential attic.

Rate each of these four items from what is VISIBLE in this photograph:
- framing: rafters, ridge, collar ties, roof sheathing from below
- insulation: depth, coverage, displacement, gaps
- ventilation: soffit, ridge or gable vents, bath fans vented outside
- moisture: staining, dark patches, mould, frost, active leaks

Use exactly one of these values per item:
"good"  — visible and appears sound, no defect apparent
"fair"  — visible, serviceable, but with a minor or developing issue
"poor"  — visible and clearly defective, damaged, or unsafe
"na"    — NOT VISIBLE in this photograph, or you cannot tell

Be strict about "na". A photo of rafters says nothing about ventilation; rate ventilation "na" unless a vent is actually in frame. Do not infer, do not guess, do not assume typical construction. Under-rating what you cannot see is correct behaviour.

Also write one short factual sentence describing what the photograph shows.

Return STRICT JSON, no markdown, exactly:
{"framing":"good|fair|poor|na","insulation":"good|fair|poor|na","ventilation":"good|fair|poor|na","moisture":"good|fair|poor|na","note":"one sentence"}`;

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
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: "Could not read the photo." }, { status: 400 }); }

    const ok = (v: any) => (["good", "fair", "poor", "na"].includes(v) ? v : "na");
    return NextResponse.json({
      framing: ok(parsed.framing),
      insulation: ok(parsed.insulation),
      ventilation: ok(parsed.ventilation),
      moisture: ok(parsed.moisture),
      note: String(parsed.note || "").trim(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI error" }, { status: 500 });
  }
}
