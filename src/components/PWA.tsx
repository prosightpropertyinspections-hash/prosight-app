"use client";
import { useEffect, useState } from "react";

/* Registers the service worker and offers an install button on Android/desktop.
   iOS gives no install prompt, so there it shows the Share-sheet instruction
   instead of a button that would do nothing. */
export default function PWA() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try {
      if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    } catch {}

    let standalone = false;
    try {
      standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true;
    } catch {}
    if (standalone) return;                       // already installed

    // Throws on Android when site data is blocked, which would otherwise take
    // the whole page down with a client-side exception.
    try { if (localStorage.getItem("ps-install-dismissed") === "1") return; } catch {}

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    if (isIos) { setIos(true); setShow(true); return; }

    const onPrompt = (e: any) => { e.preventDefault(); setPrompt(e); setShow(true); };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem("ps-install-dismissed", "1"); } catch {}
    setShow(false);
  }

  async function install() {
    if (!prompt) return;
    try {
      prompt.prompt();
      await prompt.userChoice;
    } catch {}
    setPrompt(null); setShow(false);
  }

  if (!show) return null;

  return (
    <div className="pwa">
      <style>{PWA_CSS}</style>
      <img src="/icons/icon-192.png" alt="" />
      <div className="pwa-t">
        <strong>Install ProSight Studio</strong>
        <span>{ios
          ? "Tap Share, then Add to Home Screen."
          : "Add it to your home screen and it opens like an app, full screen."}</span>
      </div>
      {!ios && <button className="pwa-go" onClick={install}>Install</button>}
      <button className="pwa-x" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}

const PWA_CSS = `
.pwa{ position:fixed; left:16px; right:16px; bottom:16px; z-index:90; margin:0 auto; max-width:460px;
  display:flex; align-items:center; gap:13px; padding:13px 15px; border-radius:15px;
  border:1px solid #1d3048; background:linear-gradient(160deg,#132234,#0b1421);
  box-shadow:0 22px 50px -18px rgba(0,0,0,.9); color:#eaf2fa;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif; }
.pwa img{ width:42px; height:42px; border-radius:11px; flex-shrink:0; }
.pwa-t{ flex:1; min-width:0; }
.pwa-t strong{ display:block; font-size:14px; font-weight:650; }
.pwa-t span{ display:block; font-size:12px; color:#a8bbd0; margin-top:2px; }
.pwa-go{ border:0; border-radius:10px; padding:11px 17px; font:inherit; font-size:13px; font-weight:650;
  color:#fff; cursor:pointer; background:linear-gradient(150deg,#1a6fa9,#134d78); white-space:nowrap; }
.pwa-x{ border:0; background:transparent; color:#6d8199; cursor:pointer; font-size:13px; padding:6px; }
@media print{ .pwa{ display:none !important; } }
`;
