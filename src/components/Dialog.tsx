"use client";
import { useEffect, useState } from "react";

/* In-app confirm and alert.

   The native dialogs are prefixed with the browser's own name — "prosight...
   says" — which on a client-facing tablet reads like a system warning rather
   than part of the app. These are promise-based so call sites keep the shape
   they already had: `if (await showConfirm(...))`. */

type Req = {
  id: number;
  kind: "confirm" | "alert";
  title: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
};

let seq = 0;
const listeners = new Set<(r: Req) => void>();

function push(r: Omit<Req, "id">) {
  const req = { ...r, id: ++seq };
  // No host mounted (a stray call during SSR): fail open rather than hang.
  if (!listeners.size) { r.resolve(r.kind === "alert"); return; }
  listeners.forEach(fn => fn(req));
}

export function showConfirm(opts: {
  title: string; body?: string; confirmText?: string; cancelText?: string; danger?: boolean;
}): Promise<boolean> {
  return new Promise(resolve => push({ kind: "confirm", ...opts, resolve }));
}

export function showAlert(title: string, body?: string): Promise<boolean> {
  return new Promise(resolve => push({ kind: "alert", title, body, resolve }));
}

export default function DialogHost() {
  const [queue, setQueue] = useState<Req[]>([]);
  const [closing, setClosing] = useState(false);
  const current = queue[0];

  useEffect(() => {
    const fn = (r: Req) => setQueue(q => [...q, r]);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => {
    if (!current) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(current.kind === "alert");
      if (e.key === "Enter") finish(true);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [current]);

  function finish(v: boolean) {
    if (!current || closing) return;
    setClosing(true);
    // let the fade play out before the answer lands
    setTimeout(() => {
      current.resolve(v);
      setQueue(q => q.slice(1));
      setClosing(false);
    }, 150);
  }

  if (!current) return null;

  return (
    <div className="dlg" data-closing={closing ? "1" : "0"}
      onMouseDown={e => { if (e.target === e.currentTarget) finish(current.kind === "alert"); }}>
      <style dangerouslySetInnerHTML={{ __html: DLG_CSS }} />
      <div className="dlg-sheet" role="alertdialog" aria-modal="true">
        <div className="dlg-body">
          <h2>{current.title}</h2>
          {current.body ? <p>{current.body}</p> : null}
        </div>
        <div className="dlg-foot">
          {current.kind === "confirm" && (
            <button className="dlg-ghost" onClick={() => finish(false)}>
              {current.cancelText || "Cancel"}
            </button>
          )}
          <button className={current.danger ? "dlg-go dlg-danger" : "dlg-go"} autoFocus
            onClick={() => finish(true)}>
            {current.confirmText || (current.kind === "alert" ? "OK" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

const DLG_CSS = `
.dlg{ position:fixed; inset:0; z-index:300; display:grid; place-items:center; padding:22px;
  background:rgba(4,8,14,.66); backdrop-filter:blur(4px);
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;
  animation:dlg-in .16s ease both; }
.dlg[data-closing="1"]{ animation:dlg-out .15s ease both; }

.dlg-sheet{ width:100%; max-width:420px; border:1px solid #1d3048; border-radius:15px; overflow:hidden;
  background:linear-gradient(160deg,#132234,#0b1421); box-shadow:0 28px 64px -20px rgba(0,0,0,.9);
  animation:dlg-rise .2s cubic-bezier(.2,.8,.25,1) both; }
.dlg[data-closing="1"] .dlg-sheet{ animation:dlg-sink .15s ease both; }

.dlg-body{ padding:24px 24px 18px; }
.dlg-body h2{ margin:0; font-size:17px; font-weight:650; color:#eaf2fa; line-height:1.35; }
.dlg-body p{ margin:8px 0 0; font-size:13.5px; line-height:1.65; color:#a8bbd0; }
.dlg-foot{ display:flex; gap:10px; justify-content:flex-end; padding:14px 22px 20px; }
.dlg-ghost{ padding:11px 18px; border:1px solid #1d3048; border-radius:10px; background:transparent;
  color:#a8bbd0; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; }
.dlg-ghost:hover{ border-color:#2a4767; color:#eaf2fa; }
.dlg-go{ padding:11px 20px; border:0; border-radius:10px; color:#fff; font:inherit; font-size:13.5px;
  font-weight:650; cursor:pointer; background:linear-gradient(150deg,#1a6fa9,#134d78);
  box-shadow:inset 0 1px 0 rgba(234,242,250,.14); }
.dlg-go:hover{ background:linear-gradient(150deg,#2183c4,#175a8c); }
.dlg-danger{ background:linear-gradient(150deg,#c4463c,#94332c); }
.dlg-danger:hover{ background:linear-gradient(150deg,#d8544a,#a83b33); }

@keyframes dlg-in{ from{ opacity:0; } to{ opacity:1; } }
@keyframes dlg-out{ from{ opacity:1; } to{ opacity:0; } }
@keyframes dlg-rise{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
@keyframes dlg-sink{ from{ opacity:1; } to{ opacity:0; transform:translateY(6px) scale(.99); } }

@media (pointer:coarse){ .dlg-ghost, .dlg-go{ min-height:48px; } }
@media (prefers-reduced-motion: reduce){ .dlg, .dlg-sheet{ animation:none !important; } }
@media print{ .dlg{ display:none !important; } }
`;
