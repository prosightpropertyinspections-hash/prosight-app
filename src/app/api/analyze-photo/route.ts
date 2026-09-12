import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL_VISION } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase-server";

// Accepts { imageBase64, mediaType, note, title, area, severity }
// Returns { text, annotations:[{x,y,rx,ry,label,sev}] } with coords as 0..1 fractions.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { imageBase64, mediaType, note, title, area, severity } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "no image" }, { status: 400 });

  const sevWord = severity === "priority" ? "Priority" : severity === "satisfactory" ? "Satisfactory" : "Monitor";
  const instruction = `You are a certified home inspector writing one finding for a ProSight Property Inspections report (InterNACHI standards).
Area: "${area || "(unspecified)"}". Title: "${title || "(none)"}". Severity: ${sevWord}.
Inspector's rough note: "${note || "(none — describe only what is visibly shown)"}".
Look at the photo. Describe only what is VISIBLY shown; confirm/enrich the note where the image supports it. Do not invent facts a photo can't show (hidden moisture, structural activity). 
Return STRICT JSON, no markdown, with exactly:
{"text":"1-2 sentence polished inspector finding, no severity word, no heading",
 "annotations":[{"x":0.0-1.0,"y":0.0-1.0,"rx":0.0-0.5,"ry":0.0-0.5,"label":"short label"}]}
Coordinates are fractions of the image (0,0 top-left). Circle only clear, visible defects (0-3 of them). If nothing to circle, use an empty array.`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL_VISION, max_tokens: 500,
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
    try { parsed = JSON.parse(raw); }
    catch { parsed = { text: raw, annotations: [] }; }
    return NextResponse.json({
      text: (parsed.text || "").trim(),
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI error" }, { status: 500 });
  }
}
