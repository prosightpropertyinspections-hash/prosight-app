"use client";
import { useEffect, useState } from "react";

/* Launch screen: the company wordmark, held two seconds, with a walking
   inspector drawn as SVG so the limbs are real elements that can be animated.
   Shown once per session — a splash on every navigation is an obstacle. */
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

      <div className="sp-word">
        <img src="/logo-ondark.svg" alt="ProSight Property Inspections" />
        <span className="sp-sheen" />
      </div>

      {/* The inspector: every limb is its own group with its own pivot, so the
          walk is real rotation rather than a sprite flip. */}
      <svg className="sp-walk" viewBox="0 0 120 150" role="img">
        <g className="w-shadow"><ellipse cx="60" cy="142" rx="26" ry="4" /></g>

        <g className="w-body">
          {/* far arm and leg first, so the near side overlaps them */}
          <g className="w-arm-b"><rect x="55" y="62" width="7" height="30" rx="3.5" /></g>
          <g className="w-leg-b"><rect x="55" y="98" width="8" height="36" rx="4" /></g>

          <rect className="w-torso" x="48" y="52" width="24" height="48" rx="9" />
          <circle className="w-head" cx="60" cy="38" r="14" />
          <path className="w-hat" d="M43 34 Q60 16 77 34 Z" />

          <g className="w-leg-f"><rect x="58" y="98" width="8" height="36" rx="4" /></g>

          {/* the near arm carries the clipboard */}
          <g className="w-arm-f">
            <rect x="60" y="62" width="7" height="28" rx="3.5" />
            <rect className="w-board" x="55" y="86" width="19" height="24" rx="2.5" />
            <rect className="w-clip" x="61" y="83" width="7" height="5" rx="1.5" />
          </g>
        </g>
      </svg>

      <div className="sp-name">Report Studio</div>
      <div className="sp-bar"><i /></div>
    </div>
  );
}

const SP_CSS = `
.sp{ position:fixed; inset:0; z-index:200; overflow:hidden; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:14px; background:#070d16;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;
  transition:opacity .46s ease, transform .46s ease; }
.sp[data-phase="out"]{ opacity:0; transform:scale(1.02); pointer-events:none; }

.sp-glow{ position:absolute; bottom:-22%; left:50%; transform:translateX(-50%);
  width:min(900px,150vw); height:62%; pointer-events:none;
  background:radial-gradient(ellipse at 50% 60%, rgba(69,176,238,.24), transparent 66%);
  filter:blur(26px); animation:sp-breathe 2.4s ease-out both; }

.sp-word{ position:relative; overflow:hidden; padding:2px 8px;
  animation:sp-rise .85s cubic-bezier(.2,.75,.25,1) both; }
.sp-word img{ display:block; width:min(72vw,320px); height:auto; }
.sp-sheen{ position:absolute; top:0; bottom:0; width:34%; left:-42%;
  background:linear-gradient(105deg, transparent, rgba(255,255,255,.32) 48%, transparent);
  animation:sp-sweep 1.25s cubic-bezier(.35,.1,.25,1) .5s both; }

/* ---- the inspector ---- */
.sp-walk{ width:96px; height:120px; overflow:visible;
  animation:sp-rise .85s cubic-bezier(.2,.75,.25,1) .1s both; }
.sp-walk g, .sp-walk rect, .sp-walk circle, .sp-walk path{ transform-box:fill-box; }

.w-torso, .w-arm-f rect, .w-leg-f rect{ fill:#eaf2fa; }
.w-head{ fill:#eaf2fa; }
.w-hat{ fill:#45b0ee; }
.w-board{ fill:#45b0ee; }
.w-clip{ fill:#0b1421; }
.w-arm-b rect, .w-leg-b rect{ fill:#8fa8c0; }          /* far limbs sit back in tone */
.w-shadow ellipse{ fill:rgba(69,176,238,.18); animation:w-shadow .62s ease-in-out infinite; }

/* a light bob, so the walk carries weight */
.w-body{ transform-origin:50% 100%; animation:w-bob .62s ease-in-out infinite; }

/* limbs pivot at the shoulder and hip, front and back in opposition */
.w-arm-f{ transform-origin:50% 6%; animation:w-swingA .62s ease-in-out infinite; }
.w-arm-b{ transform-origin:50% 6%; animation:w-swingB .62s ease-in-out infinite; }
.w-leg-f{ transform-origin:50% 4%;  animation:w-swingB .62s ease-in-out infinite; }
.w-leg-b{ transform-origin:50% 4%;  animation:w-swingA .62s ease-in-out infinite; }

@keyframes w-swingA{ 0%,100%{ transform:rotate(19deg); } 50%{ transform:rotate(-19deg); } }
@keyframes w-swingB{ 0%,100%{ transform:rotate(-19deg); } 50%{ transform:rotate(19deg); } }
@keyframes w-bob{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-3px); } }
@keyframes w-shadow{ 0%,100%{ transform:scaleX(1); opacity:.55; } 50%{ transform:scaleX(.86); opacity:.4; } }

.sp-name{ font-size:11px; letter-spacing:5px; text-transform:uppercase; color:#7f93a9;
  animation:sp-rise .85s cubic-bezier(.2,.75,.25,1) .2s both; }
.sp-bar{ width:112px; height:2px; border-radius:2px; overflow:hidden; background:rgba(69,176,238,.16);
  animation:sp-rise .85s cubic-bezier(.2,.75,.25,1) .26s both; }
.sp-bar i{ display:block; height:100%; width:40%; border-radius:2px;
  background:linear-gradient(90deg, transparent, #45b0ee, transparent);
  animation:sp-slide 1.1s ease-in-out infinite; }

@keyframes sp-rise{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:none; } }
@keyframes sp-sweep{ from{ left:-42%; } to{ left:112%; } }
@keyframes sp-slide{ 0%{ transform:translateX(-120%); } 100%{ transform:translateX(320%); } }
@keyframes sp-breathe{ from{ opacity:0; transform:translateX(-50%) scale(.9); }
                       to{ opacity:1; transform:translateX(-50%) scale(1); } }

@media (prefers-reduced-motion: reduce){
  .sp * { animation:none !important; }
  .sp-sheen{ display:none; }
}
@media print{ .sp{ display:none !important; } }
`;
