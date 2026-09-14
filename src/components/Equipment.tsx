"use client";
import { useState } from "react";
import { PhotoInput } from "@/components/PhotoInput";

/* Equipment makes, models and ages.
   The data-plate photograph exists so the model can read a serial number the
   inspector would otherwise decode by hand. It is never rendered in the report —
   a client does not need a photo of a sticker, they need the year. */
export type EquipRow = {
  id: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  year: number | null;
  notes: string;
  /* Overrides the typical-life lookup when set. */
  life?: number | null;
  plate_path?: string | null;
};

export type EquipData = { rows: EquipRow[] };

const rid = () => `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/* Typical service life, in years. Industry rule-of-thumb figures used to give a
   client a sense of where equipment sits in its life — not a prediction.

   Matched most-specific-first: a tankless water heater lasts about twice as
   long as a tank, and a standing-seam metal roof more than twice an asphalt
   one, so "water heater" or "roof" alone would put the wrong figure in the
   report. */
const LIFE_RULES: { re: RegExp; years: number }[] = [
  // water heating
  { re: /tankless|on[-\s]?demand|combi\b/i,                     years: 20 },
  { re: /(heat[-\s]?pump|hybrid).*(water heater)|hpwh/i,        years: 13 },
  { re: /(indirect|solar).*(water heater)/i,                     years: 15 },
  { re: /water heater|\bDHW\b|hot water tank/i,                 years: 10 },
  // heating & cooling
  { re: /boiler/i,                                               years: 25 },
  { re: /mini[-\s]?split|ductless/i,                             years: 15 },
  { re: /heat[-\s]?pump/i,                                       years: 15 },
  { re: /furnace/i,                                              years: 18 },
  { re: /a\/?c|air condition|condenser|compressor/i,             years: 15 },
  // roof
  { re: /(metal|standing seam)\s*roof|standing seam/i,           years: 45 },
  { re: /(tile|slate)\s*roof/i,                                  years: 60 },
  { re: /(wood|cedar)\s*(shake|shingle)/i,                       years: 25 },
  { re: /architectural|dimensional/i,                            years: 28 },
  { re: /roof|shingle/i,                                         years: 20 },
  // other
  { re: /electrical panel|service panel|load ?cent/i,            years: 40 },
  { re: /water softener/i,                                       years: 15 },
  { re: /well pump/i,                                            years: 12 },
  { re: /sump pump/i,                                            years: 8 },
  { re: /garage door opener/i,                                   years: 12 },
];

export function serviceLifeFor(row: { name?: string; model?: string; life?: number | null }): number | null {
  // An explicit figure on the row always wins — the inspector knows the unit.
  if (row.life && row.life > 0) return row.life;
  const hay = `${row.name || ""} ${row.model || ""}`;
  const hit = LIFE_RULES.find(r => r.re.test(hay));
  return hit ? hit.years : null;
}

/* Kept for the name suggestions in the editor's datalist. */
export const SERVICE_LIFE: Record<string, number> = {
  "Furnace": 18,
  "Boiler": 25,
  "A/C condenser": 15,
  "Heat pump": 15,
  "Mini-split / ductless": 15,
  "Water heater": 10,
  "Tankless water heater": 20,
  "Heat pump water heater": 13,
  "Roof covering": 20,
  "Metal roof": 45,
  "Electrical panel": 40,
  "Water softener": 15,
  "Sump pump": 8,
};

export const DEFAULT_EQUIPMENT = [
  "Furnace", "A/C condenser", "Water heater", "Roof covering", "Electrical panel",
];

export function normalizeEquipment(raw: any): EquipData {
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];
  return {
    rows: rows.map((r: any, i: number) => ({
      id: r?.id || `e${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: String(r?.name ?? ""),
      brand: String(r?.brand ?? ""),
      model: String(r?.model ?? ""),
      serial: String(r?.serial ?? ""),
      year: Number.isFinite(Number(r?.year)) && Number(r?.year) > 1900 ? Number(r.year) : null,
      notes: String(r?.notes ?? ""),
      life: Number.isFinite(Number(r?.life)) && Number(r?.life) > 0 ? Number(r.life) : null,
      plate_path: r?.plate_path ?? null,
    })),
  };
}

export const seedEquipment = (): EquipRow[] =>
  DEFAULT_EQUIPMENT.map(n => ({ id: rid(), name: n, brand: "", model: "", serial: "", year: null, notes: "", life: null, plate_path: null }));

export const hasEquipment = (d: EquipData) =>
  d.rows.some(r => r.brand || r.model || r.year);

export function ageOf(row: EquipRow, asOf: string | null): number | null {
  if (!row.year) return null;
  const y = asOf ? new Date(asOf + "T00:00").getFullYear() : new Date().getFullYear();
  return Math.max(0, y - row.year);
}

/* Where equipment sits in its expected life. Deliberately coarse — three bands,
   not a percentage, because the underlying figure is a rule of thumb. */
export type LifeBand = "early" | "mid" | "late" | "past" | "unknown";
export function lifeBand(row: EquipRow, asOf: string | null): LifeBand {
  const life = serviceLifeFor(row);
  const age = ageOf(row, asOf);
  if (!life || age === null) return "unknown";
  const r = age / life;
  if (r >= 1) return "past";
  if (r >= 0.75) return "late";
  if (r >= 0.4) return "mid";
  return "early";
}

export const BAND_LABEL: Record<LifeBand, string> = {
  early: "Early life",
  mid: "Mid life",
  late: "Near end of life",
  past: "Beyond typical life",
  unknown: "Not determined",
};

export const BAND_TONE: Record<LifeBand, string> = {
  early: "#2f9d6b",
  mid: "#2f7fd0",
  late: "#c0813a",
  past: "#d14343",
  unknown: "#8a97a6",
};

export const isMechanical = (name: string) => /utility|mechanical/i.test(String(name || ""));

/* ---------------- editor ---------------- */

export function EquipmentPanel({
  value, onChange, inspectionDate, onReadPlate,
}: {
  value: EquipData;
  onChange: (d: EquipData) => void;
  inspectionDate: string | null;
  onReadPlate?: (file: File) => Promise<Partial<EquipRow> | null>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const rows = value.rows;
  const patch = (id: string, p: Partial<EquipRow>) =>
    onChange({ rows: rows.map(r => (r.id === id ? { ...r, ...p } : r)) });
  const add = () =>
    onChange({ rows: [...rows, { id: rid(), name: "", brand: "", model: "", serial: "", year: null, notes: "", plate_path: null }] });
  const del = (id: string) => onChange({ rows: rows.filter(r => r.id !== id) });

  async function readPlate(row: EquipRow, file: File) {
    if (!onReadPlate) return;
    setBusyId(row.id); setMsg("");
    try {
      const got = await onReadPlate(file);
      if (got) {
        /* Naming the unit precisely is what drives the service-life figure, so
           a plate that says "tankless" renames the row. */
        const typed = (got as any).equipment_type as string | undefined;
        patch(row.id, {
          name: typed && !row.name ? typed
              : typed && serviceLifeFor({ name: typed }) !== serviceLifeFor({ name: row.name }) ? typed
              : row.name,
          brand: got.brand || row.brand,
          model: got.model || row.model,
          serial: got.serial || row.serial,
          year: got.year ?? row.year,
          plate_path: got.plate_path ?? row.plate_path,
        });
        setMsg(got.year ? `Read from the plate${(got as any).equipment_type ? ` — identified as ${(got as any).equipment_type}` : ""}. Check it against what you saw.` : "Read what it could. No manufacture year was legible, so enter it yourself.");
      } else setMsg("Couldn't read that plate.");
    } catch (e: any) { setMsg(e?.message || "Couldn't read that plate."); }
    setBusyId(null);
  }

  return (
    <div className="eq">
      <style>{EQ_CSS}</style>

      <div className="eq-head">
        <div>
          <span className="eq-t">Equipment & ages</span>
          <span className="eq-s">Photograph a data plate and the make, model and year are read from it.</span>
        </div>
        <button className="eq-add" onClick={add}>+ Add equipment</button>
      </div>

      {msg && <div className="eq-msg">{msg}</div>}

      {rows.map(row => {
        const age = ageOf(row, inspectionDate);
        const band = lifeBand(row, inspectionDate);
        const life = serviceLifeFor(row);
        return (
          <div key={row.id} className="eq-row">
            <div className="eq-r1">
              <input className="eq-name" value={row.name} onChange={e => patch(row.id, { name: e.target.value })}
                placeholder="Furnace, water heater…" list="eq-names" />
              <span className="eq-band" style={{ color: BAND_TONE[band] }}>
                {age !== null ? `${age} yr${age === 1 ? "" : "s"}` : "Age unknown"}
                {life && age !== null ? ` · ${BAND_LABEL[band].toLowerCase()} of ~${life} yrs` : ""}
              </span>
              <PhotoInput size="sm" busy={busyId === row.id}
                onFile={f => readPlate(row, f)}
                label={busyId === row.id ? "Reading plate…" : "data plate"} />
              <button className="eq-del" onClick={() => del(row.id)} aria-label="Remove">✕</button>
            </div>

            <div className="eq-r2">
              <label><span>Brand</span>
                <input value={row.brand} onChange={e => patch(row.id, { brand: e.target.value })} placeholder="Carrier" /></label>
              <label><span>Model</span>
                <input value={row.model} onChange={e => patch(row.id, { model: e.target.value })} placeholder="59SC5A060" /></label>
              <label><span>Serial</span>
                <input value={row.serial} onChange={e => patch(row.id, { serial: e.target.value })} placeholder="1711A12345" /></label>
              <label><span>Year</span>
                <input inputMode="numeric" value={row.year ?? ""} placeholder="2011"
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    patch(row.id, { year: v.length === 4 ? Number(v) : null });
                  }} /></label>
              <label><span>Typical life</span>
                <input inputMode="numeric" value={row.life ?? ""} placeholder={life ? String(life) : "yrs"}
                  title="Worked out from the equipment type — change it if this unit is different"
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                    patch(row.id, { life: v ? Number(v) : null });
                  }} /></label>
            </div>
          </div>
        );
      })}

      <datalist id="eq-names">
        {Object.keys(SERVICE_LIFE).map(n => <option key={n} value={n} />)}
      </datalist>

      {rows.length === 0 && <div className="eq-empty">No equipment listed yet.</div>}

      <p className="eq-note">
        Data-plate photographs are kept for your records only — they are never printed in the client's report.
      </p>
    </div>
  );
}

const EQ_CSS = `
.eq{ border:1px solid var(--line); border-radius:11px; background:var(--surface); padding:15px 17px; margin-bottom:18px; }
.eq-head{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:12px; }
.eq-t{ display:block; font-size:14px; font-weight:700; }
.eq-s{ display:block; font-size:12px; color:var(--muted); margin-top:2px; }
.eq-add{ padding:8px 14px; border:1px solid var(--line-2); border-radius:8px; background:var(--surface);
         color:var(--ink); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; }
.eq-add:hover{ border-color:var(--accent); color:var(--accent); }
.eq-msg{ font-size:12px; color:var(--accent-2); background:var(--accent-tint); border-radius:7px; padding:8px 11px; margin-bottom:11px; }
.eq-row{ border-top:1px solid var(--line); padding:11px 0; }
.eq-r1{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-bottom:8px; }
.eq-name{ flex:1; min-width:150px; padding:8px 10px; border:1px solid var(--line-2); border-radius:7px;
          font:inherit; font-size:13.5px; font-weight:650; background:var(--surface); color:var(--ink); }
.eq-band{ font-size:11.5px; font-weight:650; white-space:nowrap; }
.eq-plate{ padding:7px 12px; border:1px solid var(--line-2); border-radius:7px; background:var(--surface);
           font-size:12px; font-weight:600; color:var(--muted); cursor:pointer; white-space:nowrap; }
.eq-plate:hover{ border-color:var(--accent); color:var(--accent); }
.eq-del{ border:0; background:transparent; color:var(--faint); cursor:pointer; font-size:12px; padding:6px; border-radius:6px; }
.eq-del:hover{ color:var(--danger); background:var(--danger-tint); }
.eq-r2{ display:grid; grid-template-columns:1.1fr 1.1fr 1.1fr .6fr .6fr; gap:8px; }
.eq-r2 label{ display:flex; flex-direction:column; gap:4px; font-size:10.5px; font-weight:600;
              letter-spacing:.03em; text-transform:uppercase; color:var(--faint); }
.eq-r2 input{ padding:7px 9px; border:1px solid var(--line-2); border-radius:7px; font:inherit;
              font-size:13px; background:var(--surface); color:var(--ink); font-weight:400; width:100%; }
.eq-empty{ padding:18px 0; font-size:13px; color:var(--faint); }
.eq-note{ margin:12px 0 0; font-size:11.5px; color:var(--faint); }
@media (max-width:680px){ .eq-r2{ grid-template-columns:1fr 1fr; } }
`;
