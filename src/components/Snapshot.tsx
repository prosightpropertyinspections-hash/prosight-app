"use client";

/* Property facts that belong to the building rather than to a finding, plus a
   manual override for the overall grade. Both live on the report row. */
export type Snapshot = {
  year_built: string;
  sqft: string;
  roof_type: string;
};

export const EMPTY_SNAPSHOT: Snapshot = { year_built: "", sqft: "", roof_type: "" };

export const ROOF_TYPES = [
  "Asphalt shingle",
  "Architectural shingle",
  "Metal / standing seam",
  "Wood shake",
  "Clay or concrete tile",
  "Slate",
  "Flat / modified bitumen",
  "Rolled roofing",
  "Not determined",
];

export function normalizeSnapshot(raw: any): Snapshot {
  const s = (v: any) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
  return {
    year_built: s(raw?.year_built),
    sqft: s(raw?.sqft),
    roof_type: s(raw?.roof_type),
  };
}

export const hasSnapshot = (s: Snapshot) => !!(s.year_built || s.sqft || s.roof_type);

/* Age is derived, never typed — an inspector entering both invites the two
   disagreeing on the printed page. */
export function propertyAge(s: Snapshot, asOf: string | null): number | null {
  const y = parseInt(s.year_built, 10);
  if (!y || y < 1600 || y > 2100) return null;
  const now = asOf ? new Date(asOf + "T00:00").getFullYear() : new Date().getFullYear();
  return Math.max(0, now - y);
}

export const fmtSqft = (v: string) => {
  const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return n ? n.toLocaleString("en-US") : "";
};

export const GRADES = ["A", "B", "C", "D", "F"] as const;
export type GradeLetter = typeof GRADES[number];

/* ---------------- editor ---------------- */

export function SnapshotPanel({
  value, onChange, override, onOverride, calculated,
}: {
  value: Snapshot;
  onChange: (s: Snapshot) => void;
  override: string;
  onOverride: (g: string) => void;
  calculated: string;
}) {
  const set = (p: Partial<Snapshot>) => onChange({ ...value, ...p });
  const age = propertyAge(value, null);

  return (
    <div className="sn">
      <style dangerouslySetInnerHTML={{ __html: SN_CSS }} />

      <div className="sn-head">
        <h2>Property snapshot</h2>
        <p>Facts about the building itself. They appear on their own page near the front of the report.</p>
      </div>

      <div className="sn-grid">
        <label className="sn-f">
          <span>Year built</span>
          <input inputMode="numeric" value={value.year_built} placeholder="1968"
            onChange={e => set({ year_built: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })} />
          <em>{age !== null ? `${age} years old at inspection` : "Four digits"}</em>
        </label>

        <label className="sn-f">
          <span>Square footage</span>
          <input inputMode="numeric" value={value.sqft} placeholder="1840"
            onChange={e => set({ sqft: e.target.value.replace(/[^\d]/g, "").slice(0, 6) })} />
          <em>Living area, as listed</em>
        </label>

        <label className="sn-f sn-wide">
          <span>Roof covering</span>
          <select value={value.roof_type} onChange={e => set({ roof_type: e.target.value })}>
            <option value="">Not recorded</option>
            {ROOF_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      <div className="sn-sep" />

      <div className="sn-head">
        <h2>Overall grade</h2>
        <p>
          Worked out from the findings as <strong>{calculated}</strong>. Set it by hand if your
          judgement of the property differs — the report prints whichever is chosen here.
        </p>
      </div>

      <div className="sn-grades">
        <button data-on={override ? "0" : "1"} onClick={() => onOverride("")}>
          Automatic<em>{calculated}</em>
        </button>
        {GRADES.map(g => (
          <button key={g} data-on={override === g ? "1" : "0"} onClick={() => onOverride(g)}>
            {g}
          </button>
        ))}
      </div>

      {override ? (
        <div className="sn-note">
          Printing <strong>{override}</strong> instead of the calculated <strong>{calculated}</strong>.
          Section grades in the table are unaffected.
        </div>
      ) : null}
    </div>
  );
}

const SN_CSS = `
.sn{ max-width:640px; }
.sn-head h2{ margin:0; font-size:17px; font-weight:700; }
.sn-head p{ margin:4px 0 14px; font-size:13px; color:var(--muted); }
.sn-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.sn-f{ display:flex; flex-direction:column; gap:5px; }
.sn-f > span{ font-size:12.5px; font-weight:600; color:var(--ink-2); }
.sn-f input, .sn-f select{ padding:10px 12px; border:1px solid var(--line-2); border-radius:8px;
  font:inherit; font-size:13.5px; background:var(--surface); color:var(--ink); }
.sn-f em{ font-style:normal; font-size:11.5px; color:var(--faint); }
.sn-wide{ grid-column:1 / -1; }
.sn-sep{ height:1px; background:var(--line); margin:22px 0 18px; }
.sn-grades{ display:flex; gap:7px; flex-wrap:wrap; }
.sn-grades button{ min-width:52px; padding:10px 14px; border:1px solid var(--line-2); border-radius:9px;
  background:var(--surface); color:var(--muted); font:inherit; font-size:14px; font-weight:700; cursor:pointer; }
.sn-grades button:hover[data-on="0"]{ border-color:var(--accent); color:var(--accent); }
.sn-grades button[data-on="1"]{ background:var(--accent); border-color:var(--accent); color:#fff; }
.sn-grades button em{ display:block; font-style:normal; font-size:10.5px; font-weight:600; opacity:.7; margin-top:2px; }
.sn-note{ margin-top:12px; padding:11px 13px; border-radius:9px; background:var(--warn-tint);
  color:var(--warn); font-size:12.5px; }
@media (pointer:coarse){
  .sn-f input, .sn-f select{ font-size:16px; min-height:48px; }
  .sn-grades button{ min-height:48px; }
}
@media (max-width:640px){ .sn-grid{ grid-template-columns:1fr; } }
`;
