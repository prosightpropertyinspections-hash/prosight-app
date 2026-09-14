"use client";
import { useEffect, useState } from "react";

/* Launch screen: the company logo held for three seconds with the inspector's
   arm working. No fades — it is simply there, then it is gone. Once per
   session; a splash on every navigation is an obstacle, not branding. */
export default function Splash() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("ps-splash") === "1"; } catch {}
    if (seen) { setShow(false); return; }
    try { sessionStorage.setItem("ps-splash", "1"); } catch {}

    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch {}
    const t = setTimeout(() => setShow(false), reduce ? 600 : 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="sp" aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: SP_CSS }} />
      <div className="sp-glow" />
      <div className="sp-logo">
        <img src="/logo-inspect.svg" alt="ProSight Property Inspections" />
      </div>
      <div className="sp-bar"><i /></div>
    </div>
  );
}

const SP_CSS = `
.sp{ position:fixed; inset:0; z-index:200; overflow:hidden; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:26px; background:#070d16;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif; }

.sp-glow{ position:absolute; bottom:-24%; left:50%; transform:translateX(-50%);
  width:min(900px,150vw); height:64%; pointer-events:none;
  background:radial-gradient(ellipse at 50% 60%, rgba(69,176,238,.22), transparent 66%);
  filter:blur(26px); }

.sp-logo{ position:relative; }
.sp-logo img{ display:block; width:min(80vw,420px); height:auto; }

/* The only motion besides the inspector himself: a slider that shows the app
   is loading rather than frozen. */
.sp-bar{ width:120px; height:2px; border-radius:2px; overflow:hidden; background:rgba(69,176,238,.16); }
.sp-bar i{ display:block; height:100%; width:40%; border-radius:2px;
  background:linear-gradient(90deg, transparent, #45b0ee, transparent);
  animation:sp-slide 1.1s ease-in-out infinite; }

@keyframes sp-slide{ 0%{ transform:translateX(-120%); } 100%{ transform:translateX(320%); } }

@media (prefers-reduced-motion: reduce){ .sp *{ animation:none !important; } }
@media print{ .sp{ display:none !important; } }
`;
