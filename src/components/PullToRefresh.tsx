"use client";
import { useEffect, useRef, useState } from "react";

/* Pull to refresh, using the company mark instead of the browser's spinner.

   The app sets overscroll-behavior:none to stop the white rubber-band flash,
   which also disables the native gesture — so this replaces it rather than
   competing with it. It only arms at the very top of the page, so a pull in the
   middle of a long report still scrolls normally. */

const TRIGGER = 76;   // px of pull before it fires
const MAX = 110;      // px the indicator will travel

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    const atTop = () =>
      (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) return;
      armed.current = atTop();
      start.current = armed.current ? e.touches[0].clientY : null;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed.current || start.current === null || busy) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0) { setPull(0); return; }
      if (!atTop()) { armed.current = false; setPull(0); return; }
      // resistance: the pull slows the further it goes, so it feels physical
      setPull(Math.min(MAX, dy * 0.5));
    };

    const onEnd = () => {
      if (!armed.current) return;
      armed.current = false;
      start.current = null;
      setPull(p => {
        if (p >= TRIGGER) {
          setBusy(true);
          setTimeout(() => location.reload(), 380);
          return TRIGGER;
        }
        return 0;
      });
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [busy]);

  if (pull <= 0 && !busy) return null;

  const ready = pull >= TRIGGER;
  const progress = Math.min(1, pull / TRIGGER);

  return (
    <div className="ptr" style={{ transform: `translateY(${pull}px)`, opacity: Math.min(1, progress * 1.4) }}>
      <style dangerouslySetInnerHTML={{ __html: PTR_CSS }} />
      <div className="ptr-disc" data-busy={busy ? "1" : "0"} data-ready={ready ? "1" : "0"}
        style={busy ? undefined : { transform: `rotate(${progress * 300}deg)` }}>
        <img src="/icons/icon-192.png" alt="" />
      </div>
    </div>
  );
}

const PTR_CSS = `
.ptr{ position:fixed; top:-52px; left:0; right:0; z-index:150; display:grid; place-items:center;
  pointer-events:none; transition:opacity .16s ease; }
.ptr-disc{ width:44px; height:44px; border-radius:50%; overflow:hidden; background:#0f1a2a;
  border:1px solid #1d3048; box-shadow:0 10px 24px -10px rgba(0,0,0,.85);
  display:grid; place-items:center; }
.ptr-disc img{ width:100%; height:100%; object-fit:cover; display:block; }
.ptr-disc[data-ready="1"]{ border-color:#45b0ee; box-shadow:0 0 18px -4px rgba(69,176,238,.8); }
.ptr-disc[data-busy="1"]{ border-color:#45b0ee; animation:ptr-spin .75s linear infinite; }

@keyframes ptr-spin{ to{ transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce){ .ptr-disc{ animation:none !important; } }
@media print{ .ptr{ display:none !important; } }
`;
