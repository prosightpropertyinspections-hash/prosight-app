"use client";
import { useState } from "react";

/* Receptacle testing tally. Counts only — this is the one part of the report
   that is deliberately photo-free, because a grid of outlet photos tells a
   client nothing that a number doesn't. */
export type OutletRow = {
  id: string;
  room: string;
  total: number;
  defective: number;
  open_ground: number;
  notes: string;
};

export type OutletData = { rows: OutletRow[] };

const rid = () => `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function normalizeOutlets(raw: any): OutletData {
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];
  return {
    rows: rows.map((r: any, i: number) => ({
      id: r?.id || `o${i}_${Math.random().toString(36).slice(2, 6)}`,
      room: String(r?.room ?? ""),
      total: Number(r?.total) || 0,
      defective: Number(r?.defective) || 0,
      open_ground: Number(r?.open_ground) || 0,
      notes: String(r?.notes ?? ""),
    })),
  };
}

/* Working is derived, not typed: an inspector counting the same outlets twice
   is how a table ends up contradicting itself. */
export const workingCount = (r: OutletRow) =>
  Math.max(0, (r.total || 0) - (r.defective || 0) - (r.open_ground || 0));

export const hasOutletData = (d: OutletData) =>
  d.rows.some(r => (r.total || 0) > 0 || (r.defective || 0) > 0 || (r.open_ground || 0) > 0);

export function outletTotals(rows: OutletRow[]) {
  return rows.reduce(
    (a, r) => ({
      total: a.total + (r.total || 0),
      defective: a.defective + (r.defective || 0),
      open_ground: a.open_ground + (r.open_ground || 0),
      working: a.working + workingCount(r),
    }),
    { total: 0, defective: 0, open_ground: 0, working: 0 }
  );
}

/* Rooms the report already has, so the table starts filled in rather than empty. */
const SKIP_ROOMS = /roof|exterior|siding|crawlspace|sewer|condenser|deck|porch|backyard|scope/i;
export const roomLabel = (name: string) => String(name || "").replace(/^Interior\s+—\s+/, "");
export const outletsApplyTo = (name: string) => !!name && !SKIP_ROOMS.test(name);

/* A row is keyed by its section id, so entering outlets from inside a room and
   editing them on the overview page touch the same record. */
export function seedRowsFromSections(sections: any[]): OutletRow[] {
  return (sections || [])
    .filter(s => outletsApplyTo(s?.name))
    .map(s => ({ id: String(s.id), room: roomLabel(s.name), total: 0, defective: 0, open_ground: 0, notes: "" }));
}

export function rowFor(data: OutletData, section: any): OutletRow {
  const found = data.rows.find(r => r.id === String(section?.id));
  return found || { id: String(section?.id), room: roomLabel(section?.name), total: 0, defective: 0, open_ground: 0, notes: "" };
}

export function upsertRow(data: OutletData, row: OutletRow): OutletData {
  const i = data.rows.findIndex(r => r.id === row.id);
  if (i === -1) return { rows: [...data.rows, row] };
  const rows = data.rows.slice();
  rows[i] = row;
  return { rows };
}

/* Compact per-room tally, shown while inspecting that room. */
export function OutletInline({ row, onChange }: { row: OutletRow; onChange: (r: OutletRow) => void }) {
  const w = workingCount(row);
  const over = (row.defective || 0) + (row.open_ground || 0) > (row.total || 0);
  const num = (v: number) => (v === 0 ? "" : String(v));
  const set = (p: Partial<OutletRow>) => onChange({ ...row, ...p });
  const field = (label: string, key: "total" | "defective" | "open_ground") => (
    <label className="oi-f">
      <span>{label}</span>
      <input inputMode="numeric" value={num(row[key])} placeholder="0"
        onChange={e => set({ [key]: Number(e.target.value.replace(/\D/g, "")) || 0 } as any)} />
    </label>
  );

  return (
    <div className="oi" data-bad={over ? "1" : "0"}>
      <style>{OI_CSS}</style>
      <div className="oi-l">
        <span className="oi-t">Receptacles in this room</span>
        <span className="oi-s">
          {over ? "More faults than outlets tested — check the counts."
                : row.total ? `${w} of ${row.total} tested normally`
                : "Leave blank if you didn't test any here."}
        </span>
      </div>
      {field("Tested", "total")}
      {field("Defective", "defective")}
      {field("Open ground", "open_ground")}
    </div>
  );
}

const OI_CSS = `
.oi{ display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; padding:13px 15px; margin-bottom:16px;
     border:1px solid var(--line); border-radius:10px; background:var(--surface-2); }
.oi[data-bad="1"]{ border-color:var(--danger); }
.oi-l{ flex:1; min-width:180px; }
.oi-t{ display:block; font-size:13px; font-weight:650; }
.oi-s{ display:block; font-size:11.5px; color:var(--muted); margin-top:2px; }
.oi[data-bad="1"] .oi-s{ color:var(--danger); }
.oi-f{ display:flex; flex-direction:column; gap:4px; font-size:10.5px; font-weight:600;
       letter-spacing:.03em; text-transform:uppercase; color:var(--faint); }
.oi-f input{ width:74px; padding:7px 9px; text-align:center; border:1px solid var(--line-2);
             border-radius:7px; font:inherit; font-size:13.5px; background:var(--surface); color:var(--ink); }
`;

/* ---------------- editor ---------------- */

export function OutletEditor({ value, onChange }: { value: OutletData; onChange: (d: OutletData) => void }) {
  const rows = value.rows;
  const t = outletTotals(rows);

  const patch = (id: string, p: Partial<OutletRow>) =>
    onChange({ rows: rows.map(r => (r.id === id ? { ...r, ...p } : r)) });
  const add = () => onChange({ rows: [...rows, { id: rid(), room: "", total: 0, defective: 0, open_ground: 0, notes: "" }] });
  const del = (id: string) => onChange({ rows: rows.filter(r => r.id !== id) });

  const num = (v: number) => (v === 0 ? "" : String(v));

  return (
    <div className="ot">
      <style>{OT_CSS}</style>

      <div className="ot-head">
        <div>
          <h2>Receptacle testing</h2>
          <p>Count the outlets you tested in each room. Working is worked out for you.</p>
        </div>
        <button className="ot-add" onClick={add}>+ Add room</button>
      </div>

      <div className="ot-grid ot-grid-h">
        <span>Room / area</span>
        <span className="n">Tested</span>
        <span className="n">Defective</span>
        <span className="n">Open ground</span>
        <span className="n">Working</span>
        <span />
      </div>

      {rows.length === 0 && (
        <div className="ot-empty">No rooms yet. Add one, or reload the report to pull in its sections.</div>
      )}

      {rows.map(r => {
        const w = workingCount(r);
        const over = (r.defective || 0) + (r.open_ground || 0) > (r.total || 0);
        return (
          <div key={r.id} className="ot-grid ot-row" data-bad={over ? "1" : "0"}>
            <input value={r.room} onChange={e => patch(r.id, { room: e.target.value })} placeholder="Room or area" />
            <input className="n" inputMode="numeric" value={num(r.total)} placeholder="0"
              onChange={e => patch(r.id, { total: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            <input className="n" inputMode="numeric" value={num(r.defective)} placeholder="0"
              onChange={e => patch(r.id, { defective: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            <input className="n" inputMode="numeric" value={num(r.open_ground)} placeholder="0"
              onChange={e => patch(r.id, { open_ground: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            <span className="ot-w">{r.total ? w : "—"}</span>
            <button className="ot-del" onClick={() => del(r.id)} aria-label="Remove row">✕</button>
          </div>
        );
      })}

      {rows.some(r => (r.defective || 0) + (r.open_ground || 0) > (r.total || 0)) && (
        <div className="ot-warn">A row has more faults than outlets tested. Check the counts in the highlighted rows.</div>
      )}

      <div className="ot-grid ot-tot">
        <span>All rooms</span>
        <span className="n">{t.total}</span>
        <span className="n">{t.defective}</span>
        <span className="n">{t.open_ground}</span>
        <span className="n">{t.working}</span>
        <span />
      </div>

      <p className="ot-note">
        Rooms left at zero are skipped in the report. This page prints as a table with no photographs.
      </p>
    </div>
  );
}

const OT_CSS = `
.ot{ max-width:760px; }
.ot-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:16px; }
.ot-head h2{ margin:0; font-size:20px; font-weight:700; }
.ot-head p{ margin:4px 0 0; font-size:13px; color:var(--muted); }
.ot-add{ padding:8px 14px; border:1px solid var(--line-2); border-radius:8px; background:var(--surface); color:var(--ink); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; }
.ot-add:hover{ border-color:var(--accent); color:var(--accent); }
.ot-grid{ display:grid; grid-template-columns:1fr 84px 92px 104px 84px 34px; gap:8px; align-items:center; }
.ot-grid-h{ padding:0 0 7px; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--faint); border-bottom:1px solid var(--line); }
.ot-grid-h .n{ text-align:center; }
.ot-row{ padding:6px 0; border-bottom:1px solid var(--line); }
.ot-row input{ padding:8px 10px; border:1px solid var(--line-2); border-radius:7px; font:inherit; font-size:13px; background:var(--surface); color:var(--ink); width:100%; }
.ot-row input.n{ text-align:center; }
.ot-row[data-bad="1"] input.n{ border-color:var(--danger); }
.ot-w{ text-align:center; font-size:13px; font-weight:700; color:var(--ok); }
.ot-del{ border:0; background:transparent; color:var(--faint); cursor:pointer; font-size:13px; padding:6px; border-radius:6px; }
.ot-del:hover{ color:var(--danger); background:var(--danger-tint); }
.ot-empty{ padding:24px 0; font-size:13px; color:var(--faint); }
.ot-warn{ margin-top:12px; padding:10px 13px; border-radius:8px; background:var(--danger-tint); color:var(--danger); font-size:12.5px; }
.ot-tot{ margin-top:12px; padding:12px 0 0; border-top:2px solid var(--ink); font-size:13.5px; font-weight:700; }
.ot-tot .n{ text-align:center; }
.ot-note{ margin-top:14px; font-size:12px; color:var(--faint); }
@media (max-width:720px){
  .ot-grid{ grid-template-columns:1fr 60px 64px 72px 60px 30px; gap:6px; }
  .ot-grid-h{ font-size:9.5px; }
}
`;
