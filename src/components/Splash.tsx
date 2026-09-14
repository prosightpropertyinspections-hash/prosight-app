"use client";
import { useEffect, useState } from "react";

/* Launch screen. Shown once per session — a splash on every navigation would be
   an obstacle, not branding. The logo is the real mark rather than a generated
   icon, so what opens matches what was installed. */
export default function Splash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("ps-splash") === "1"; } catch {}
    if (seen) { setPhase("gone"); return; }
    try { sessionStorage.setItem("ps-splash", "1"); } catch {}

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? 260 : 1150;

    const t1 = setTimeout(() => setPhase("out"), hold);
    const t2 = setTimeout(() => setPhase("gone"), hold + 420);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className="sp" data-phase={phase} aria-hidden>
      <style>{SP_CSS}</style>

      {/* light rising from below, the same bloom the app uses */}
      <div className="sp-glow" />

      <div className="sp-mark">
        <img src="/logo-mark.svg" alt="" />
        {/* a single sweep across the mark, once */}
        <span className="sp-sheen" />
      </div>

      <div className="sp-word">
        <img src="/logo-ondark.svg" alt="ProSight Property Inspections" />
      </div>

      <div className="sp-name">Report Studio</div>

      <div className="sp-bar"><i /></div>
    </div>
  );
}

const SP_CSS = `
.sp{ position:fixed; inset:0; z-index:200; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:18px; background:#070d16;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;
  transition:opacity .4s ease, transform .4s ease; }
.sp[data-phase="out"]{ opacity:0; transform:scale(1.02); pointer-events:none; }

.sp-glow{ position:absolute; bottom:-22%; left:50%; transform:translateX(-50%);
  width:150%; max-width:900px; height:62%;
  background:radial-gradient(ellipse at 50% 60%, rgba(69,176,238,.24), transparent 66%);
  filter:blur(26px); animation:sp-breathe 2.6s ease-out both; }

.sp-mark{ position:relative; overflow:hidden; padding:2px 6px;
  animation:sp-rise .82s cubic-bezier(.2,.75,.25,1) both; }
.sp-mark img{ display:block; width:min(62vw,260px); height:auto;
  filter:drop-shadow(0 10px 26px rgba(0,0,0,.55)); }
.sp-word{ animation:sp-rise .82s cubic-bezier(.2,.75,.25,1) .12s both; }
.sp-word img{ display:block; width:min(56vw,230px); height:auto; opacity:.95; }

.sp-sheen{ position:absolute; top:0; bottom:0; width:38%; left:-45%;
  background:linear-gradient(105deg, transparent, rgba(255,255,255,.34) 48%, transparent);
  animation:sp-sweep 1.15s cubic-bezier(.35,.1,.25,1) .34s both; }

.sp-name{ font-size:11px; letter-spacing:5px; text-transform:uppercase; color:#7f93a9;
  animation:sp-rise .82s cubic-bezier(.2,.75,.25,1) .2s both; }

.sp-bar{ width:112px; height:2px; border-radius:2px; overflow:hidden; background:rgba(69,176,238,.16);
  animation:sp-rise .82s cubic-bezier(.2,.75,.25,1) .24s both; }
.sp-bar i{ display:block; height:100%; width:40%; border-radius:2px;
  background:linear-gradient(90deg, transparent, #45b0ee, transparent);
  animation:sp-slide 1.05s ease-in-out infinite; }

@keyframes sp-rise{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:none; } }
@keyframes sp-sweep{ from{ left:-45%; } to{ left:115%; } }
@keyframes sp-slide{ 0%{ transform:translateX(-120%); } 100%{ transform:translateX(320%); } }
@keyframes sp-breathe{ from{ opacity:0; transform:translateX(-50%) scale(.9); }
                       to{ opacity:1; transform:translateX(-50%) scale(1); } }

@media (prefers-reduced-motion: reduce){
  .sp-glow, .sp-mark, .sp-name, .sp-bar, .sp-sheen, .sp-bar i{ animation:none !important; }
  .sp-sheen{ display:none; }
}
@media print{ .sp{ display:none !important; } }
`;
