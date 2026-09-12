import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL_VISION } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase-server";

// Accepts { imageBase64, mediaType, note, area }
// Returns { text, title, severity, annotations:[{x,y,rx,ry,label}] }.
// Title and severity are chosen by the model from the same source as the text.
//
// Two modes, and the difference matters:
//   note present -> the note IS the finding. The inspector was on site and may
//     have tested things a camera cannot show (GFCI trip, continuity, polarity,
//     breaker sizing). The photo must not influence the text at all; it is used
//     only to place annotation circles.
//   note empty   -> nothing to go on but the photograph, so describe that.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { imageBase64, mediaType, note, area } = await req.json();
  if (!imageBase64) return NextResponse.json({ error: "no image" }, { status: 400 });

  const hasNote = typeof note === "string" && note.trim().length > 0;

  const modeBlock = hasNote
    ? `MODE: NOTE-ONLY. The inspector's field note is the complete and only source for the finding text.

Inspector's note: "${note.trim()}"

The inspector physically inspected and tested this component on site. A photograph cannot show a GFCI that failed to trip, a missing ground, reverse polarity, a breaker oversized for its conductor, a fixture that did not operate, or anything else established by hand. The inspector knows what they found. You do not.

Absolute rules for the text:
- Write ONLY what the note says, in polished inspector language. Nothing else.
- Do NOT describe, mention, reference, contradict, qualify, or hedge based on the photograph. Not one clause.
- If the photo seems to show something different from the note, IGNORE THE PHOTO ENTIRELY. The note is correct.
- Do NOT add conditions, defects, recommendations, or components the note does not mention.
- Read through terse phrasing, shorthand, and misspellings to the inspector's intent.
- If the note says the component is fine, the text says the component is fine.

The photograph is used ONLY to position annotation circles, never to inform the text.`
    : `MODE: PHOTO-ONLY. There is no inspector note, so write the finding from the photograph.

Rules for the text:
- Describe only what is plainly visible: the component, its material, and its observed condition.
- If the photo shows no defect, write a straightforward satisfactory-condition observation. Do not manufacture a problem.
- Never claim anything a photo cannot establish (hidden moisture, age, code status, test results, what is behind a surface).`;

  const instruction = `You are a certified home inspector writing one finding for a ProSight Property Inspections report (InterNACHI standards).
Area: "${area || "(unspecified)"}".

${modeBlock}

Voice: factual, specific, non-alarmist, plain language a homeowner understands. 1-2 sentences. No severity word, no heading, no preamble.

Also choose a short finding title and a severity.

TITLE: 2-4 words naming the component, in title case, e.g. "Chimney & Flashing", "Main Electrical Panel", "Kitchen GFCI Outlets". Name the component, not the problem.

SEVERITY: exactly one of
- "priority"     — a safety hazard, an active defect, or anything needing repair or evaluation by a qualified specialist.
- "monitor"      — serviceable now, but aging, minor, or worth watching / routine maintenance.
- "satisfactory" — functioning as intended, no action required.
Choose it from the same source as the text: in NOTE-ONLY mode judge the note alone and ignore the photo; in PHOTO-ONLY mode judge the photo. When genuinely unclear, choose "monitor".

Return STRICT JSON, no markdown, with exactly:
{"text":"the finding sentence(s)",
 "title":"2-4 word component name",
 "severity":"priority|monitor|satisfactory",
 "annotations":[{"x":0.0-1.0,"y":0.0-1.0,"rx":0.0-0.5,"ry":0.0-0.5,"label":"short label"}]}
Coordinates are fractions of the image (0,0 top-left). Circle 0-3 items only when a circle genuinely helps the reader locate what the finding refers to. If nothing is worth circling, use an empty array.`;

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
    const sev = ["priority","monitor","satisfactory"].includes(parsed.severity) ? parsed.severity : "monitor";
    return NextResponse.json({
      text: (parsed.text || "").trim(),
      title: (parsed.title || "").trim(),
      severity: sev,
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI error" }, { status: 500 });
  }
}
