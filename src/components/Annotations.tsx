"use client";
import { useId, useRef, useState } from "react";

/* Shapes are stored as fractions of the ORIGINAL image (0..1), never pixels,
   so the same record renders correctly at thumbnail size, in the report, and
   in the PDF.
   circle/box: (x,y) is the centre, rx/ry are half-width/half-height.
   arrow:      (x,y) is the tail, (x2,y2) is the point. */
export type ShapeKind = "circle" | "box" | "arrow";
export type Shape = {
  id: string;
  type: ShapeKind;
  x: number; y: number;
  x2?: number; y2?: number;
  rx?: number; ry?: number;
  color: string;
  label?: string;
};

export const ANNOTATION_COLORS = [
  { name: "Red",    value: "#e5342b" },
  { name: "Orange", value: "#f08c1a" },
  { name: "Yellow", value: "#f2c318" },
  { name: "Green",  value: "#25a35a" },
  { name: "Blue",   value: "#2b7fe5" },
  { name: "White",  value: "#ffffff" },
];

/* The report crops photos to a fixed box (full content width by 240px) via
   object-fit:cover. Keeping that exact shape is deliberate — the photo size in
   the report does not change — but it means the overlay has to be cropped the
   same way, which is what coverBox() below computes. */
export const REPORT_PHOTO_ASPECT = (8.5 * 96 - 108) / 240;

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

function isShape(a: any): a is Shape {
  return a && typeof a.x === "number" && typeof a.y === "number";
}

export function normalizeShapes(raw: any): Shape[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isShape).map((a: any, i: number) => ({
    id: a.id || `s${i}_${Math.random().toString(36).slice(2, 8)}`,
    type: (["circle", "box", "arrow"].includes(a.type) ? a.type : "circle") as ShapeKind,
    x: a.x, y: a.y,
    x2: typeof a.x2 === "number" ? a.x2 : undefined,
    y2: typeof a.y2 === "number" ? a.y2 : undefined,
    rx: typeof a.rx === "number" ? a.rx : undefined,
    ry: typeof a.ry === "number" ? a.ry : undefined,
    color: typeof a.color === "string" ? a.color : ANNOTATION_COLORS[0].value,
    label: typeof a.label === "string" ? a.label : undefined,
  }));
}

/* Where the full image sits relative to a cover-cropped container, in percent.
   object-fit:cover scales by the larger ratio and centres the overflow, so the
   image rect is bigger than the box and hangs off both sides (or top/bottom).
   Reproducing that here lets the overlay sit on the image rect rather than the
   box, so a circle stays glued to what it was drawn around. */
function coverBox(imgAspect: number | null, boxAspect: number) {
  if (!imgAspect || !isFinite(imgAspect) || imgAspect <= 0) {
    return { left: "0%", top: "0%", width: "100%", height: "100%" };
  }
  if (imgAspect > boxAspect) {
    const r = imgAspect / boxAspect;              // wider than the box: crop sides
    return { left: pct(-(r - 1) / 2), top: "0%", width: pct(r), height: "100%" };
  }
  const r = boxAspect / imgAspect;                // taller than the box: crop top/bottom
  return { left: "0%", top: pct(-(r - 1) / 2), width: "100%", height: pct(r) };
}

/* Fraction of the original image still visible after the cover crop. Used by
   the editor to grey out what the report will not show. */
export function visibleFraction(imgAspect: number | null, boxAspect: number) {
  if (!imgAspect || !isFinite(imgAspect) || imgAspect <= 0) return { w: 1, h: 1 };
  return imgAspect > boxAspect
    ? { w: boxAspect / imgAspect, h: 1 }
    : { w: 1, h: imgAspect / boxAspect };
}

export function AnnotationOverlay({
  shapes, strokeWidth = 3, fontSize = 12, selectedId, onSelect,
}: {
  shapes: Shape[];
  strokeWidth?: number;
  fontSize?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const uid = useId().replace(/[:]/g, "");
  if (!shapes.length) return null;

  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }} aria-hidden>
      <defs>
        {shapes.filter(s => s.type === "arrow").map(s => (
          <marker key={s.id} id={`ah-${uid}-${s.id}`} viewBox="0 0 10 10" refX="8.5" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={s.color} />
          </marker>
        ))}
      </defs>

      {shapes.map(s => {
        const sel = selectedId === s.id;
        const common = {
          fill: "none", stroke: s.color, strokeWidth,
          style: { pointerEvents: (onSelect ? "auto" : "none") as any, cursor: onSelect ? "pointer" : "default" },
          onPointerDown: onSelect ? (e: React.PointerEvent) => { e.stopPropagation(); onSelect(s.id); } : undefined,
        };
        const halo = { fill: "none", stroke: "rgba(0,0,0,.45)", strokeWidth: strokeWidth + 2, pointerEvents: "none" as any };

        let body: React.ReactNode = null;
        let labelY = s.y;

        if (s.type === "circle") {
          const rx = s.rx ?? 0.08, ry = s.ry ?? 0.08;
          labelY = s.y - ry;
          body = (<>
            <ellipse cx={pct(s.x)} cy={pct(s.y)} rx={pct(rx)} ry={pct(ry)} {...halo} />
            <ellipse cx={pct(s.x)} cy={pct(s.y)} rx={pct(rx)} ry={pct(ry)} {...common} />
          </>);
        } else if (s.type === "box") {
          const rx = s.rx ?? 0.08, ry = s.ry ?? 0.08;
          labelY = s.y - ry;
          const r = { x: pct(s.x - rx), y: pct(s.y - ry), width: pct(rx * 2), height: pct(ry * 2) };
          body = (<><rect {...r} {...halo} /><rect {...r} {...common} /></>);
        } else {
          const x2 = s.x2 ?? s.x, y2 = s.y2 ?? s.y;
          const l = { x1: pct(s.x), y1: pct(s.y), x2: pct(x2), y2: pct(y2) };
          body = (<>
            <line {...l} {...halo} strokeLinecap="round" />
            <line {...l} {...common} strokeLinecap="round" markerEnd={`url(#ah-${uid}-${s.id})`} />
          </>);
        }

        return (
          <g key={s.id}>
            {body}
            {sel && <ellipse cx={pct(s.x)} cy={pct(s.y)} rx="6" ry="6" fill={s.color} stroke="#fff" strokeWidth="2" />}
            {s.label ? (
              <text x={pct(s.x)} y={pct(labelY)} dy={-strokeWidth - 5} textAnchor="middle"
                fontSize={fontSize} fontWeight={700} fill={s.color}
                stroke="rgba(0,0,0,.55)" strokeWidth={3} paintOrder="stroke"
                style={{ pointerEvents: "none" }}>{s.label}</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* A cover-cropped photo with its annotations locked to the image, not the box.
   The rendered size is identical to a plain object-fit:cover image. */
export function AnnotatedPhoto({
  src, shapes, aspect, height, radius = 0, strokeWidth = 2.5, fontSize = 11, style,
}: {
  src: string;
  shapes: Shape[];
  aspect?: number;
  height?: number;
  radius?: number;
  strokeWidth?: number;
  fontSize?: number;
  style?: React.CSSProperties;
}) {
  const [nat, setNat] = useState<number | null>(null);
  const boxAspect = aspect ?? REPORT_PHOTO_ASPECT;
  const rect = coverBox(nat, boxAspect);

  return (
    <div style={{
      position: "relative", width: "100%", overflow: "hidden", borderRadius: radius,
      ...(height ? { height } : { aspectRatio: `${boxAspect}` }),
      ...style,
    }}>
      <div style={{ position: "absolute", ...rect }}>
        <img src={src} alt=""
          onLoad={e => {
            const im = e.currentTarget;
            if (im.naturalWidth && im.naturalHeight) setNat(im.naturalWidth / im.naturalHeight);
          }}
          style={{ width: "100%", height: "100%", display: "block", objectFit: "fill" }} />
        <AnnotationOverlay shapes={shapes} strokeWidth={strokeWidth} fontSize={fontSize} />
      </div>
    </div>
  );
}

export function AnnotationEditor({
  src, initial, onSave, onClose,
}: {
  src: string;
  initial: Shape[];
  onSave: (shapes: Shape[]) => void;
  onClose: () => void;
}) {
  const [shapes, setShapes] = useState<Shape[]>(initial);
  const [tool, setTool] = useState<ShapeKind>("circle");
  const [color, setColor] = useState(ANNOTATION_COLORS[0].value);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nat, setNat] = useState<number | null>(null);
  const [guides, setGuides] = useState(true);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const selShape = shapes.find(s => s.id === selected) || null;
  const vis = visibleFraction(nat, REPORT_PHOTO_ASPECT);

  function frac(e: React.PointerEvent) {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }
  function down(e: React.PointerEvent) {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(null);
    startRef.current = frac(e);
  }
  function move(e: React.PointerEvent) {
    const st = startRef.current;
    if (!st) return;
    const p = frac(e);
    setDraft(tool === "arrow"
      ? { id: "draft", type: "arrow", x: st.x, y: st.y, x2: p.x, y2: p.y, color }
      : { id: "draft", type: tool, x: (st.x + p.x) / 2, y: (st.y + p.y) / 2, rx: Math.abs(p.x - st.x) / 2, ry: Math.abs(p.y - st.y) / 2, color });
  }
  function up() {
    const d = draft;
    startRef.current = null;
    setDraft(null);
    if (!d) return;
    const tiny = d.type === "arrow"
      ? Math.hypot(d.x2! - d.x, d.y2! - d.y) < 0.03
      : (d.rx! < 0.015 || d.ry! < 0.015);
    if (tiny) return;
    const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setShapes(prev => [...prev, { ...d, id }]);
    setSelected(id);
  }
  function patchSel(patch: Partial<Shape>) {
    if (!selected) return;
    setShapes(prev => prev.map(s => s.id === selected ? { ...s, ...patch } : s));
  }
  function delSel() {
    if (!selected) return;
    setShapes(prev => prev.filter(s => s.id !== selected));
    setSelected(null);
  }

  const btn = (on: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${on ? "#c98a4b" : "#2c333c"}`,
    background: on ? "#1c2530" : "transparent",
    color: on ? "#fff" : "#9aa4b2",
  });

  const dim = "rgba(6,9,14,.62)";
  const sideW = pct((1 - vis.w) / 2);
  const bandH = pct((1 - vis.h) / 2);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,12,18,.9)", zIndex: 80, display: "flex", flexDirection: "column" }}
      onKeyDown={e => { if (e.key === "Delete" || e.key === "Backspace") delSel(); if (e.key === "Escape") onClose(); }}
      tabIndex={-1}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 16px", background: "#0d1420", color: "#fff" }}>
        <strong style={{ fontSize: 14 }}>Annotate photo</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {(["circle", "box", "arrow"] as ShapeKind[]).map(t => (
            <button key={t} style={btn(tool === t)} onClick={() => setTool(t)}>
              {t === "circle" ? "Circle" : t === "box" ? "Box" : "Arrow"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, marginLeft: 8 }}>
          {ANNOTATION_COLORS.map(c => (
            <button key={c.value} title={c.name}
              onClick={() => { setColor(c.value); if (selected) patchSel({ color: c.value }); }}
              style={{
                width: 24, height: 24, borderRadius: "50%", cursor: "pointer", background: c.value,
                border: color === c.value ? "3px solid #fff" : "1px solid rgba(255,255,255,.35)",
              }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button style={btn(guides)} onClick={() => setGuides(g => !g)} title="Dim the parts the report will crop off">Crop guide</button>
        <button style={btn(false)} onClick={() => { setShapes([]); setSelected(null); }}>Clear all</button>
        <button style={btn(false)} onClick={onClose}>Cancel</button>
        <button style={{ background: "#2f9d6b", color: "#fff", border: 0, padding: "8px 16px", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
          onClick={() => onSave(shapes)}>Save annotations</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", padding: 18 }}>
        <div ref={wrapRef}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", lineHeight: 0, touchAction: "none", cursor: "crosshair", userSelect: "none" }}>
          <img src={src} alt="" draggable={false}
            onLoad={e => {
              const im = e.currentTarget;
              if (im.naturalWidth && im.naturalHeight) setNat(im.naturalWidth / im.naturalHeight);
            }}
            style={{ display: "block", maxWidth: "100%", maxHeight: "68vh", width: "auto", height: "auto" }} />

          {/* The report crops photos to a fixed shape. Anything drawn in the dimmed
              area would not appear there, so it is shown rather than discovered later. */}
          {guides && (vis.w < 0.999 || vis.h < 0.999) && (
            <>
              {vis.w < 0.999 && <>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: sideW, background: dim, pointerEvents: "none" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: sideW, background: dim, pointerEvents: "none" }} />
              </>}
              {vis.h < 0.999 && <>
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bandH, background: dim, pointerEvents: "none" }} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bandH, background: dim, pointerEvents: "none" }} />
              </>}
              <div style={{
                position: "absolute",
                left: sideW, right: sideW, top: bandH, bottom: bandH,
                outline: "1px dashed rgba(255,255,255,.55)", pointerEvents: "none",
              }} />
            </>
          )}

          <AnnotationOverlay shapes={draft ? [...shapes, draft] : shapes} strokeWidth={3} fontSize={13}
            selectedId={selected} onSelect={id => setSelected(id)} />
        </div>
      </div>

      <div style={{ padding: "12px 16px", background: "#0d1420", color: "#fff", display: "flex", gap: 10, alignItems: "center", minHeight: 54 }}>
        {selShape ? (
          <>
            <span style={{ fontSize: 12.5, color: "#9aa4b2" }}>Label</span>
            <input autoFocus value={selShape.label || ""} onChange={e => patchSel({ label: e.target.value })}
              placeholder="Optional — e.g. Missing shingles"
              style={{ flex: 1, maxWidth: 380, padding: "7px 10px", borderRadius: 7, border: "1px solid #2c333c", background: "#121a26", color: "#fff", font: "inherit", fontSize: 13 }} />
            <button style={btn(false)} onClick={() => setSelected(null)}>Done</button>
            <button style={{ ...btn(false), color: "#ff8b84", borderColor: "#5a2c2c" }} onClick={delSel}>Delete shape</button>
          </>
        ) : (
          <span style={{ fontSize: 12.5, color: "#6d7a8a" }}>
            Drag to draw · click a shape to label or delete it · dimmed edges are cropped off in the report
          </span>
        )}
      </div>
    </div>
  );
}
