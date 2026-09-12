import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL_TEXT } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase-server";

// Accepts { note, area }
// Returns { text, title, severity }. Used when a finding has no photo.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { note, area } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "empty note" }, { status: 400 });

  const prompt = `You are writing one finding for a professional home inspection report by ProSight Property Inspections (InterNACHI standards).
Area: "${area || "(unspecified)"}".
Inspector's rough field note: "${note.trim()}"

The inspector physically inspected and tested this component on site. The note is the complete and only source for the finding. Write only what it says — do not add conditions, defects, recommendations, or components it does not mention. Read through terse phrasing, shorthand, and misspellings to the inspector's intent. If the note says the component is fine, say it is fine.

Write 1-2 sentences of polished, objective inspector language: factual, specific, non-alarmist, naming the component and its observed condition. No severity word, no heading, no preamble.

Also choose:

TITLE: 2-4 words naming the component, in title case, e.g. "Chimney & Flashing", "Main Electrical Panel", "Kitchen GFCI Outlets". Name the component, not the problem.

SEVERITY: exactly one of
- "priority"     — a safety hazard, an active defect, or anything needing repair or evaluation by a qualified specialist.
- "monitor"      — serviceable now, but aging, minor, or worth watching / routine maintenance.
- "satisfactory" — functioning as intended, no action required.
Judge it from the note alone. When genuinely unclear, choose "monitor".

Return STRICT JSON, no markdown, no backticks, with exactly:
{"text":"the finding sentence(s)","title":"2-4 word component name","severity":"priority|monitor|satisfactory"}`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL_TEXT, max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    let raw = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();
    raw = raw.replace(/^```json\s*|\s*```$/g, "");
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { parsed = { text: raw, title: "", severity: "monitor" }; }
    const sev = ["priority","monitor","satisfactory"].includes(parsed.severity) ? parsed.severity : "monitor";
    return NextResponse.json({
      text: (parsed.text || "").trim(),
      title: (parsed.title || "").trim(),
      severity: sev,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI error" }, { status: 500 });
  }
}
