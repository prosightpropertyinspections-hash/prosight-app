"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { loadProfile, avatarUrl } from "@/lib/profile";

/* Account menu. Business details live behind this rather than in a settings
   page nobody finds, because they are entered once and then forgotten. */
export default function UserMenu({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      setEmail(user?.email || "");
      try {
        const p = await loadProfile(sb);
        setPhoto(await avatarUrl(sb, p.avatar_path));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function signOut() {
    await createClient().auth.signOut();
    location.href = "/";
  }

  const initial = (email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="um" data-dark={dark ? "1" : "0"} ref={ref}>
      <style dangerouslySetInnerHTML={{__html: UM_CSS }} />

      <button className="um-btn" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        title={email || "Account"}>
        <span className="um-av">{photo ? <img src={photo} alt="" /> : initial}</span>
        {!compact && <span className="um-car" aria-hidden>▾</span>}
      </button>

      {open && (
        <div className="um-pop" role="menu">
          <div className="um-who">
            <span className="um-av um-av-lg">{photo ? <img src={photo} alt="" /> : initial}</span>
            <span className="um-mail">{email || "Signed in"}</span>
          </div>

          <Link href="/settings" className="um-item" role="menuitem" onClick={() => setOpen(false)}>
            <span className="um-i-t">Business settings</span>
            <span className="um-i-s">Company name, address, contact details</span>
          </Link>

          <Link href="/settings#inspector" className="um-item" role="menuitem" onClick={() => setOpen(false)}>
            <span className="um-i-t">Inspector details</span>
            <span className="um-i-s">Name, InterNACHI ID, licence</span>
          </Link>

          <div className="um-sep" />

          <button className="um-item um-out" role="menuitem" onClick={signOut}>
            <span className="um-i-t">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

const UM_CSS = `
.um{ position:relative; }
/* Dark variant for the dark shell — same component, different surface. */
.um[data-dark="1"] .um-btn{ background:#0f1a2a; border-color:#1d3048; }
.um[data-dark="1"] .um-btn:hover{ border-color:#2a4767; }
.um[data-dark="1"] .um-av{ background:linear-gradient(150deg,#45b0ee,#1d6fa8); }
.um[data-dark="1"] .um-pop{ background:linear-gradient(160deg,#132234,#0b1421); border-color:#1d3048;
  box-shadow:0 26px 60px -18px rgba(0,0,0,.9); }
.um[data-dark="1"] .um-who{ border-bottom-color:#1d3048; }
.um[data-dark="1"] .um-mail{ color:#a8bbd0; }
.um[data-dark="1"] .um-item:hover{ background:rgba(69,176,238,.08); }
.um[data-dark="1"] .um-i-t{ color:#eaf2fa; }
.um[data-dark="1"] .um-i-s{ color:#6d8199; }
.um[data-dark="1"] .um-sep{ background:#1d3048; }
.um[data-dark="1"] .um-out .um-i-t{ color:#ff8f85; }
.um[data-dark="1"] .um-car{ color:#6d8199; }
.um-btn{ display:flex; align-items:center; gap:6px; padding:4px 8px 4px 4px; border:1px solid #e4e8ee;
         border-radius:999px; background:#fff; cursor:pointer; font:inherit; }
.um-btn:hover{ border-color:#cdd6e0; }
.um-av{ width:30px; height:30px; border-radius:50%; background:#101a26; color:#fff; display:grid;
        place-items:center; font-size:13px; font-weight:700; flex-shrink:0; overflow:hidden; }
.um-av img{ width:100%; height:100%; object-fit:cover; display:block; }
.um-av-lg{ width:36px; height:36px; font-size:15px; }
.um-car{ font-size:10px; color:#8a97a6; }
.um-pop{ position:absolute; right:0; top:calc(100% + 8px); width:262px; background:#fff;
         border:1px solid #e4e8ee; border-radius:12px; box-shadow:0 18px 44px -14px rgba(16,26,38,.3);
         overflow:hidden; z-index:60; }
.um-who{ display:flex; align-items:center; gap:10px; padding:13px 15px; border-bottom:1px solid #eef1f5; }
.um-mail{ font-size:12.5px; color:#475569; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.um-item{ display:block; width:100%; text-align:left; padding:11px 15px; border:0; background:transparent;
          cursor:pointer; text-decoration:none; color:inherit; font:inherit; }
.um-item:hover{ background:#f6f8fa; }
.um-i-t{ display:block; font-size:13.5px; font-weight:600; color:#16202b; }
.um-i-s{ display:block; font-size:11.5px; color:#8a97a6; margin-top:1px; }
.um-sep{ height:1px; background:#eef1f5; }
.um-out .um-i-t{ color:#b4453c; }
`;
