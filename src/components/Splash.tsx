"use client";
import { useEffect, useState } from "react";

/* Launch screen: the company logo, held two seconds, with the inspector's
   forearm animating as he works the shingles. The motion lives inside the SVG
   itself, so this stays a plain <img> rather than 80KB of paths inlined here. */
export default function Splash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("ps-splash") === "1"; } catch {}
    if (seen) { setPhase("gone"); return; }
    try { sessionStorage.setItem("ps-splash", "1"); } catch {}

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? 400 : 2000;

    const t1 = setTimeout(() => setPhase("out"), hold);
    const t2 = setTimeout(() => setPhase("gone"), hold + 460);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className="sp" data-phase={phase} aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: SP_CSS }} />

      <div className="sp-glow" />

      <div className="sp-logo">
        <img src="/logo-inspect.svg" alt="ProSight Property Inspections" />
        <span className="sp-sheen" />
      </div>

      <div className="sp-bar"><i /></div>
    </div>
  );
}

const SP_CSS = `
.sp{ position:fixed; inset:0; z-index:200; overflow:hidden; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:26px; background:#070d16;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;
  transition:opacity .46s ease, transform .46s ease; }
.sp[data-phase="out"]{ opacity:0; transform:scale(1.02); pointer-events:none; }

.sp-glow{ position:absolute; bottom:-24%; left:50%; transform:translateX(-50%);
  width:min(900px,150vw); height:64%; pointer-events:none;
  background:radial-gradient(ellipse at 50% 60%, rgba(69,176,238,.22), transparent 66%);
  filter:blur(26px); animation:sp-breathe 2.4s ease-out both; }

.sp-logo{ position:relative; overflow:hidden; padding:4px 10px;
  animation:sp-rise .9s cubic-bezier(.2,.75,.25,1) both; }
.sp-logo img{ display:block; width:min(80vw,420px); height:auto; }
.sp-sheen{ position:absolute; top:0; bottom:0; width:32%; left:-40%;
  background:linear-gradient(105deg, transparent, rgba(255,255,255,.26) 48%, transparent);
  animation:sp-sweep 1.3s cubic-bezier(.35,.1,.25,1) .55s both; }

.sp-bar{ width:120px; height:2px; border-radius:2px; overflow:hidden; background:rgba(69,176,238,.16);
  animation:sp-rise .9s cubic-bezier(.2,.75,.25,1) .22s both; }
.sp-bar i{ display:block; height:100%; width:40%; border-radius:2px;
  background:linear-gradient(90deg, transparent, #45b0ee, transparent);
  animation:sp-slide 1.1s ease-in-out infinite; }

@keyframes sp-rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
@keyframes sp-sweep{ from{ left:-40%; } to{ left:112%; } }
@keyframes sp-slide{ 0%{ transform:translateX(-120%); } 100%{ transform:translateX(320%); } }
@keyframes sp-breathe{ from{ opacity:0; transform:translateX(-50%) scale(.9); }
                       to{ opacity:1; transform:translateX(-50%) scale(1); } }

@media (prefers-reduced-motion: reduce){
  .sp *{ animation:none !important; }
  .sp-sheen{ display:none; }
}
@media print{ .sp{ display:none !important; } }
`;
