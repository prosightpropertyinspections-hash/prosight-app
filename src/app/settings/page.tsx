"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import UserMenu from "@/components/UserMenu";
import { createClient } from "@/lib/supabase-browser";
import { loadProfile, saveProfile, DEFAULT_PROFILE, type Profile } from "@/lib/profile";
import { THEME_LIST } from "@/lib/themes";

export default function SettingsPage() {
  return <AuthGate><Settings /></AuthGate>;
}

/* Defined at module scope on purpose. A component declared inside Settings is a
   new component type on every render, so React unmounts the input and remounts
   it after each keystroke — which is how a text box ends up losing focus after
   one character. */
function Field({ k, label, hint, placeholder, wide, value, onChange }: {
  k: keyof Profile; label: string; hint?: string; placeholder?: string; wide?: boolean;
  value: string; onChange: (k: keyof Profile, v: string) => void;
}) {
  return (
    <label className={wide ? "st-f st-wide" : "st-f"}>
      <span>{label}</span>
      <input value={value} onChange={e => onChange(k, e.target.value)} placeholder={placeholder} />
      {hint ? <em>{hint}</em> : null}
    </label>
  );
}


function Settings() {
  const sb = createClient();
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => { setP(await loadProfile(sb)); setLoading(false); })();
  }, []);

  const set = (k: keyof Profile, v: string) => { setP(prev => ({ ...prev, [k]: v })); setSaved(false); };

  async function submit() {
    setSaving(true);
    try { await saveProfile(sb, p); setSaved(true); }
    catch (e: any) { alert("Could not save: " + (e?.message || e)); }
    setSaving(false);
  }

  return (
    <div className="ps-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet" />
      <style>{ST_CSS}</style>

      <header className="ps-bar">
        <div className="ps-wrap ps-bar-in">
          <Link href="/"><img className="ps-logo" src="/logo.svg" alt="ProSight Property Inspections" /></Link>
          <div className="ps-rule" />
          <Link href="/" className="ps-navlink">Reports</Link>
          <Link href="/schedule" className="ps-navlink">Schedule</Link>
          <div style={{ flex: 1 }} />
          <UserMenu />
        </div>
      </header>

      <div className="ps-wrap" style={{ paddingBottom: 90 }}>
        <div className="ps-head">
          <div>
            <h1 className="ps-title">Settings</h1>
            <p className="ps-sub">These details appear on every report you produce. Change them once here.</p>
          </div>
          <button className="ps-action" disabled={saving || loading} onClick={submit}>
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
        </div>

        {loading ? <div style={{ padding: 50, color: "var(--ps-faint)" }}>Loading…</div> : (
          <>
            <section className="st-card">
              <div className="st-h">
                <h2>Business</h2>
                <p>Printed on the cover, the footer of every page, and the closing note.</p>
              </div>
              <div className="st-grid">
                <Field k="company_name" label="Trading name" placeholder="ProSight Property Inspections" wide value={p.company_name} onChange={set} />
                <Field k="legal_name" label="Legal entity" placeholder="Adjusterflow LLC"
                  hint="Shown alongside the trading name on the report's closing note" value={p.legal_name} onChange={set} />
                <Field k="phone" label="Phone" placeholder="(313) 555-0142" value={p.phone} onChange={set} />
                <Field k="email" label="Email" placeholder="reports@prosightpropertyinspections.com" value={p.email} onChange={set} />
                <Field k="website" label="Website" placeholder="prosightpropertyinspections.com" value={p.website} onChange={set} />
                <Field k="address" label="Business address" placeholder="Dearborn Heights, Michigan" wide value={p.address} onChange={set} />
              </div>
            </section>

            <section className="st-card" id="inspector">
              <div className="st-h">
                <h2>Inspector</h2>
                <p>Used as the default on new reports and on the signature line of the scope page.</p>
              </div>
              <div className="st-grid">
                <Field k="inspector_name" label="Inspector name" placeholder="Islam" value={p.inspector_name} onChange={set} />
                <Field k="internachi_id" label="InterNACHI ID" placeholder="NACHI26020705" value={p.internachi_id} onChange={set} />
                <Field k="license_no" label="State licence number" placeholder="Optional" value={p.license_no} onChange={set} />
                <label className="st-f">
                  <span>Default report theme</span>
                  <select value={p.default_theme} onChange={e => set("default_theme", e.target.value)}>
                    {THEME_LIST.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <em>Applied to new reports; each report can still be changed</em>
                </label>
                <label className="st-f st-wide">
                  <span>Standards note</span>
                  <textarea rows={3} value={p.standards_note}
                    onChange={e => set("standards_note", e.target.value)}
                    placeholder="Optional extra line for the scope page — certifications, insurance, association membership" />
                </label>
              </div>
            </section>

            <div className="st-foot">
              <button className="ps-action" disabled={saving} onClick={submit}>
                {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
              </button>
              <span className="st-note">Existing reports pick these up the next time they are opened.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const ST_CSS = `
.ps-root{
  --ps-paper:#f6f8fa; --ps-panel:#ffffff; --ps-navy:#101a26;
  --ps-blue:#2f7fd0; --ps-line:#e4e8ee; --ps-line-soft:#eef1f5;
  --ps-ink:#16202b; --ps-ink-2:#475569; --ps-faint:#8a97a6;
  --ps-serif:"Newsreader",Georgia,serif;
  background:var(--ps-paper); min-height:100vh; color:var(--ps-ink);
}
.ps-wrap{ max-width:1080px; margin:0 auto; padding:0 24px; }
.ps-bar{ background:var(--ps-panel); border-bottom:1px solid var(--ps-line); position:sticky; top:0; z-index:30; }
.ps-bar-in{ display:flex; align-items:center; gap:20px; height:112px; }
.ps-logo{ height:76px; width:auto; display:block; }
.ps-rule{ width:1px; height:40px; background:var(--ps-line); }
.ps-navlink{ font-size:13.5px; color:var(--ps-ink-2); text-decoration:none; padding:6px 2px; }
.ps-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; padding:34px 0 20px; }
.ps-title{ font-family:var(--ps-serif); font-size:32px; font-weight:500; letter-spacing:-.015em; margin:0; line-height:1.1; }
.ps-sub{ margin:6px 0 0; font-size:14px; color:var(--ps-ink-2); max-width:52ch; }
.ps-action{ background:var(--ps-navy); color:#fff; border:0; border-radius:9px; padding:11px 18px;
            font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; white-space:nowrap; }
.ps-action:disabled{ opacity:.55; cursor:default; }

.st-card{ background:var(--ps-panel); border:1px solid var(--ps-line); border-radius:12px; margin-bottom:18px; overflow:hidden; }
.st-h{ padding:18px 22px; border-bottom:1px solid var(--ps-line-soft); }
.st-h h2{ margin:0; font-family:var(--ps-serif); font-size:20px; font-weight:500; }
.st-h p{ margin:4px 0 0; font-size:13px; color:var(--ps-ink-2); }
.st-grid{ padding:20px 22px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.st-f{ display:flex; flex-direction:column; gap:5px; }
.st-f > span{ font-size:12.5px; font-weight:600; color:var(--ps-ink-2); }
.st-f input, .st-f select, .st-f textarea{ padding:10px 12px; border:1px solid var(--ps-line); border-radius:8px;
  font:inherit; font-size:13.5px; color:var(--ps-ink); background:var(--ps-panel); }
.st-f textarea{ resize:vertical; }
.st-f em{ font-style:normal; font-size:11.5px; color:var(--ps-faint); }
.st-wide{ grid-column:1 / -1; }
.st-foot{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.st-note{ font-size:12.5px; color:var(--ps-faint); }
.ps-root :focus-visible{ outline:2px solid var(--ps-blue); outline-offset:2px; border-radius:6px; }
@media (max-width:760px){ .st-grid{ grid-template-columns:1fr; } .ps-bar-in{ height:80px; } .ps-logo{ height:50px; } }
`;
