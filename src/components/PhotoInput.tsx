"use client";
import { useRef } from "react";

/* Two buttons rather than one file input.
   On Android, accept="image/*" alone opens a chooser whose contents depend on
   the handset, and capture="environment" jumps straight to the camera with no
   way back to the gallery. Offering both explicitly means the inspector always
   gets what they tapped — and both targets are sized for a gloved thumb on a
   tablet rather than a mouse pointer. */
export function PhotoInput({
  onFile, busy, size = "md", label,
}: {
  onFile: (file: File) => void;
  busy?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const camRef = useRef<HTMLInputElement | null>(null);
  const libRef = useRef<HTMLInputElement | null>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";   // so the same file can be picked twice
    if (f) onFile(f);
  };

  return (
    <div className={`pi pi-${size}`}>
      <style>{PI_CSS}</style>

      <button type="button" className="pi-btn pi-cam" disabled={busy}
        onClick={() => camRef.current?.click()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <span>{busy ? "Working…" : "Camera"}</span>
      </button>

      <button type="button" className="pi-btn" disabled={busy}
        onClick={() => libRef.current?.click()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span>Album</span>
      </button>

      {label ? <span className="pi-label">{label}</span> : null}

      {/* capture= forces the camera; its absence opens the gallery */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={libRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

const PI_CSS = `
.pi{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.pi-btn{ display:inline-flex; align-items:center; justify-content:center; gap:7px;
  border:1px solid var(--line-2); border-radius:10px; background:var(--surface); color:var(--ink);
  font:inherit; font-weight:600; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.pi-btn svg{ width:16px; height:16px; flex-shrink:0; }
.pi-btn:active{ transform:scale(.97); }
.pi-btn:disabled{ opacity:.5; cursor:not-allowed; }
.pi-cam{ border-color:var(--accent); color:var(--accent); }
.pi-label{ font-size:12px; color:var(--faint); }

/* 44px is the smallest target a thumb hits reliably; the small size is only for
   dense rows and still clears 38px. */
.pi-sm .pi-btn{ min-height:38px; padding:0 12px; font-size:12.5px; }
.pi-md .pi-btn{ min-height:44px; padding:0 15px; font-size:13.5px; }
.pi-lg .pi-btn{ min-height:52px; padding:0 20px; font-size:14.5px; flex:1; }

@media (pointer:coarse){
  .pi-sm .pi-btn{ min-height:44px; padding:0 14px; }
  .pi-md .pi-btn{ min-height:48px; }
  .pi-btn svg{ width:18px; height:18px; }
}
`;

/* Empty-photo target. Big enough to hit while holding a tablet one-handed. */
export function PhotoDrop({ onFile, busy }: { onFile: (f: File) => void; busy?: boolean }) {
  return (
    <div className="pd">
      <style>{PD_CSS}</style>
      <div className="pd-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
        </svg>
        <span>No photo yet</span>
      </div>
      <PhotoInput onFile={onFile} busy={busy} size="sm" />
    </div>
  );
}

const PD_CSS = `
.pd{ display:flex; flex-direction:column; gap:8px; }
.pd-box{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;
  border:1px dashed var(--line-2); border-radius:9px; color:var(--faint); padding:14px 8px; }
.pd-box svg{ width:22px; height:22px; }
.pd-box span{ font-size:11px; }
`;
