import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL_TEXT } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { note, title, area, severity } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "empty note" }, { status: 400 });

  const sevWord = severity === "priority" ? "Priority (repair / further evaluation)"
    : severity === "satisfactory" ? "Satisfactory (no action required)"
    : "Monitor (maintenance recommended)";

  const prompt = `You are writing one finding for a professional home inspection report by ProSight Property Inspections (InterNACHI standards).
Area: "${area || "(unspecified)"}". Finding title: "${title || "(none)"}". Severity: ${sevWord}.
Inspector's rough field note: "${note}".
Rewrite into 1–2 sentences of polished, objective inspector language: factual, specific, non-alarmist, names the component and observed condition. Do NOT invent measurements or facts not implied. Do NOT include the severity word or a heading. Output ONLY the finding sentence(s).`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL_TEXT, max_tokens: 220,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.filter(b => b.type === "text").map(b => (b as any).text).join("").trim();
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "AI error" }, { status: 500 });
  }
}
