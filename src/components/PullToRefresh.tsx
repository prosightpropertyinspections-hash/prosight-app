"use client";
import { useEffect, useRef, useState } from "react";

/* Pull to refresh, using the company mark instead of the browser's spinner.

   The app sets overscroll-behavior:none to stop the white rubber-band flash,
   which also kills the native gesture — so this replaces it rather than
   competing with it. */

const TRIGGER = 72;   // px of pull before it fires
const MAX = 108;      // px the indicator will travel

/* The window is not always what scrolls: the report editor scrolls an inner
   pane, and the section strip scrolls sideways. The gesture must arm only when
   whatever is actually under the finger is already at its top. */
function scrollerAtTop(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;
  while (el && el !== document.body && el !== document.documentElement) {
    const st = el.scrollTop;
    if (el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return st <= 0;
    }
    el = el.parentElement;
  }
  return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
}

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) return;
      armed.current = scrollerAtTop(e.target);
      start.current = armed.current ? e.touches[0].clientY : null;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed.current || start.current === null || busy) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0) { setPull(0); return; }
      // resistance, so the pull feels physical rather than linear
      setPull(Math.min(MAX, dy * 0.5));
    };

    const onEnd = () => {
      if (!armed.current) return;
      armed.current = false;
      start.current = null;
      setPull(p => {
        if (p >= TRIGGER) {
          setBusy(true);
          setTimeout(() => location.reload(), 420);
          return TRIGGER;
        }
        return 0;
      });
    };

    // capture phase: a component that stops propagation on its own touch
    // handlers must not be able to swallow the gesture
    const opts = { passive: true, capture: true } as AddEventListenerOptions;
    window.addEventListener("touchstart", onStart, opts);
    window.addEventListener("touchmove", onMove, opts);
    window.addEventListener("touchend", onEnd, opts);
    window.addEventListener("touchcancel", onEnd, opts);
    return () => {
      window.removeEventListener("touchstart", onStart, opts);
      window.removeEventListener("touchmove", onMove, opts);
      window.removeEventListener("touchend", onEnd, opts);
      window.removeEventListener("touchcancel", onEnd, opts);
    };
  }, [busy]);

  if (pull <= 0 && !busy) return null;

  const ready = pull >= TRIGGER;
  const progress = Math.min(1, pull / TRIGGER);

  return (
    <div className="ptr" style={{ transform: `translateY(${pull}px)`, opacity: Math.min(1, progress * 1.5) }}>
      <style dangerouslySetInnerHTML={{ __html: PTR_CSS }} />
      <div className="ptr-disc" data-busy={busy ? "1" : "0"} data-ready={ready ? "1" : "0"}>
        <img src="/logo-mark.svg" alt=""
          style={busy ? undefined : { transform: `rotate(${progress * 240}deg)` }} />
      </div>
    </div>
  );
}

const PTR_CSS = `
.ptr{ position:fixed; top:-54px; left:0; right:0; z-index:150; display:grid; place-items:center;
  pointer-events:none; }
.ptr-disc{ width:48px; height:48px; border-radius:50%; background:#0f1a2a; border:1px solid #1d3048;
  box-shadow:0 12px 26px -10px rgba(0,0,0,.9); display:grid; place-items:center; overflow:hidden; }
.ptr-disc img{ width:30px; height:auto; display:block; transition:transform .06s linear; }
.ptr-disc[data-ready="1"]{ border-color:#45b0ee; box-shadow:0 0 20px -4px rgba(69,176,238,.85); }
.ptr-disc[data-busy="1"]{ border-color:#45b0ee; }
.ptr-disc[data-busy="1"] img{ animation:ptr-spin .8s linear infinite; }

@keyframes ptr-spin{ to{ transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce){ .ptr-disc img{ animation:none !important; } }
@media print{ .ptr{ display:none !important; } }
`;
