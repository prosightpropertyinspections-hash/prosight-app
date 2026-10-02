"use client";
import { useEffect } from "react";

/* Registers the service worker so the app can still be installed, but never
   asks anyone to install it. On the tablet, install from the browser menu
   (Chrome: ⋮ → Install app / Add to Home screen; Safari: Share → Add to Home
   Screen). Chrome's own "Install" pop-up is suppressed as well. */
export default function PWA() {
  useEffect(() => {
    try {
      if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    } catch {}
    const quiet = (e: Event) => e.preventDefault();
    window.addEventListener("beforeinstallprompt", quiet);
    return () => window.removeEventListener("beforeinstallprompt", quiet);
  }, []);
  return null;
}
