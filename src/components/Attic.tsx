"use client";
import { useState } from "react";

/* Attic condition. Four items, rated rather than written, because an attic is
   the one space the client will never see for themselves — a grade per item
   reads faster than a paragraph. */
export type Rating = "good" | "fair" | "poor" | "na";

export type AtticItem = { key: keyof AtticData & string; label: string; hint: string };

export type AtticData = {
  framing: Rating;
  insulation: Rating;
  ventilation: Rating;
  moisture: Rating;
  note: string;
  source?: "ai" | "manual";
};

export const ATTIC_ITEMS: AtticItem[] = [
  { key: "framing",     label: "Framing & rafters",  hint: "Rafters, ridge, collar ties, sheathing" },
  { key: "insulation",  label: "Insulation",         hint: "Depth, coverage, displacement" },
  { key: "ventilation", label: "Ventilation",        hint: "Soffit, ridge, gable, bath fan venting" },
  { key: "moisture",    label: "Moisture & staining", hint: "Stains, mould, frost, active leaks" },
];

export const RATINGS: { v: Rating; l: string }[] = [
  { v: "good", l: "Good" },
  { v: "fair", l: "Fair" },
  { v: "poor", l: "Poor" },
  { v: "na",   l: "N/A" },
];

export const RATING_TONE: Record<Rating, string> = {
  good: "#2f9d6b",
  fair: "#c0813a",
  poor: "#d14343",
  na:   "#8a97a6",
};

export const RATING_LABEL: Record<Rating, string> = {
  good: "Good", fair: "Fair", poor: "Poor", na: "Not inspected",
};

const EMPTY: AtticData = { framing: "na", insulation: "na", ventilation: "na", moisture: "na", note: "" };

export function normalizeAttic(raw: any): AtticData {
  const ok = (v: any): Rating => (["good", "fair", "poor", "na"].includes(v) ? v : "na");
  return {
    framing: ok(raw?.framing),
    insulation: ok(raw?.insulation),
    ventilation: ok(raw?.ventilation),
    moisture: ok(raw?.moisture),
    note: String(raw?.note ?? ""),
    source: raw?.source === "ai" ? "ai" : raw?.source === "manual" ? "manual" : undefined,
  };
}

export const atticRated = (d: AtticData) =>
  ATTIC_ITEMS.some(i => (d as any)[i.key] !== "na") || !!d.note;

export const isAttic = (name: string) => /attic/i.test(String(name || ""));

/* ---------------- editor ---------------- */

export function AtticPanel({
  value, onChange, photoPath, onAssess,
}: {
  value: AtticData;
  onChange: (d: AtticData) => void;
  photoPath?: string | null;
  onAssess?: () => Promise<Partial<AtticData> | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function assess() {
    if (!onAssess) return;
    setBusy(true); setMsg("");
    try {
      const got = await onAssess();
      if (got) {
        onChange({ ...value, ...got, source: "ai" });
        setMsg("Suggested from the photo — change anything that doesn't match what you saw.");
      } else setMsg("Couldn't read the photo.");
    } catch (e: any) { setMsg(e?.message || "Couldn't read the photo."); }
    setBusy(false);
  }

  return (
    <div className="at">
      <style>{AT_CSS}</style>

      <div className="at-head">
        <div>
          <span className="at-t">Attic condition</span>
          <span className="at-s">
            {value.source === "ai" ? "Suggested from the photo — check each one." : "Rate what you saw up there."}
          </span>
        </div>
        {onAssess && (
          <button className="at-ai" disabled={busy || !photoPath} onClick={assess}
            title={photoPath ? "Read the ratings from the attic photo" : "Add a photo to a finding first"}>
            {busy ? "Reading photo…" : "Suggest from photo"}
          </button>
        )}
      </div>

      {msg && <div className="at-msg">{msg}</div>}

      {ATTIC_ITEMS.map(item => {
        const cur = (value as any)[item.key] as Rating;
        return (
          <div key={item.key} className="at-row">
            <div className="at-l">
              <span className="at-l-t">{item.label}</span>
              <span className="at-l-h">{item.hint}</span>
            </div>
            <div className="at-opts">
              {RATINGS.map(r => (
                <button key={r.v} data-on={cur === r.v ? "1" : "0"}
                  style={cur === r.v ? { background: RATING_TONE[r.v], borderColor: RATING_TONE[r.v], color: "#fff" } : undefined}
                  onClick={() => onChange({ ...value, [item.key]: r.v, source: "manual" } as AtticData)}>
                  {r.l}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <label className="at-note">
        <span>Attic note (optional)</span>
        <textarea rows={2} value={value.note}
          onChange={e => onChange({ ...value, note: e.target.value })}
          placeholder="Access point, what was visible, anything the ratings don't cover" />
      </label>
    </div>
  );
}

const AT_CSS = `
.at{ border:1px solid var(--line); border-radius:11px; background:var(--surface); padding:15px 17px; margin-bottom:18px; }
.at-head{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:10px; }
.at-t{ display:block; font-size:14px; font-weight:700; }
.at-s{ display:block; font-size:12px; color:var(--muted); margin-top:2px; }
.at-ai{ padding:8px 14px; border:1px solid var(--line-2); border-radius:8px; background:var(--surface);
        color:var(--ink); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; }
.at-ai:hover:not(:disabled){ border-color:var(--accent); color:var(--accent); }
.at-ai:disabled{ opacity:.5; cursor:not-allowed; }
.at-msg{ font-size:12px; color:var(--accent-2); background:var(--accent-tint); border-radius:7px; padding:8px 11px; margin-bottom:10px; }
.at-row{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;
         padding:10px 0; border-top:1px solid var(--line); }
.at-l-t{ display:block; font-size:13px; font-weight:600; }
.at-l-h{ display:block; font-size:11.5px; color:var(--faint); margin-top:1px; }
.at-opts{ display:flex; gap:5px; }
.at-opts button{ padding:6px 13px; border:1px solid var(--line-2); border-radius:7px; background:var(--surface);
                 color:var(--muted); font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
.at-opts button:hover[data-on="0"]{ border-color:var(--line); color:var(--ink); }
.at-note{ display:block; margin-top:12px; font-size:12px; font-weight:600; color:var(--muted); }
.at-note textarea{ display:block; width:100%; margin-top:5px; padding:9px 11px; border:1px solid var(--line-2);
                   border-radius:8px; font:inherit; font-size:13px; color:var(--ink); background:var(--surface);
                   resize:vertical; font-weight:400; }
@media (max-width:620px){ .at-opts button{ padding:6px 10px; font-size:11.5px; } }
`;
