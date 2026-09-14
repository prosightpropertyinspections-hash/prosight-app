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
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{ST_CSS}</style>

      <header className="ps-bar">
        <div className="ps-wrap ps-bar-in">
          <Link href="/"><img className="ps-logo" src="/logo-ondark.svg" alt="ProSight Property Inspections" /></Link>
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
  --ps-paper:#070d16; --ps-panel:#0f1a2a; --ps-navy:#45b0ee; --ps-blue:#45b0ee;
  --ps-line:#1d3048; --ps-line-soft:#16273c;
  --ps-ink:#eaf2fa; --ps-ink-2:#a8bbd0; --ps-faint:#6d8199;
  --ps-serif:"Sora","Helvetica Neue",sans-serif;
  background:var(--ps-paper); min-height:100vh; color:var(--ps-ink);
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;
}
.ps-wrap{ max-width:1080px; margin:0 auto; padding:0 26px; }
.ps-bar{ background:rgba(7,13,22,.82); backdrop-filter:blur(14px);
  border-bottom:1px solid var(--ps-line); position:sticky; top:0; z-index:30; }
.ps-bar-in{ display:flex; align-items:center; gap:20px; height:108px; }
.ps-logo{ height:72px; width:auto; display:block; }
.ps-rule{ width:1px; height:38px; background:var(--ps-line); }
.ps-navlink{ font-size:13.5px; color:var(--ps-ink-2); text-decoration:none; padding:8px 2px; }
.ps-navlink:hover{ color:var(--ps-ink); }
.ps-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; padding:42px 0 22px; }
.ps-title{ font-family:var(--ps-serif); font-size:34px; font-weight:600; letter-spacing:-.9px; margin:0; line-height:1.06; }
.ps-sub{ margin:8px 0 0; font-size:14px; color:var(--ps-ink-2); max-width:52ch; }
.ps-action{ border:0; border-radius:11px; padding:12px 20px; font:inherit; font-size:13.5px; font-weight:600;
  color:#fff; cursor:pointer; background:linear-gradient(150deg,#1a6fa9,#134d78);
  box-shadow:inset 0 1px 0 rgba(234,242,250,.14); white-space:nowrap; }
.ps-action:hover:not(:disabled){ background:linear-gradient(150deg,#2183c4,#175a8c); }
.ps-action:disabled{ opacity:.55; cursor:default; }

.st-card{ border:1px solid var(--ps-line); border-radius:16px; margin-bottom:18px; overflow:hidden;
  background:linear-gradient(160deg,rgba(19,34,52,.78),rgba(11,20,33,.78)); }
.st-h{ padding:19px 22px; border-bottom:1px solid var(--ps-line-soft); }
.st-h h2{ margin:0; font-family:var(--ps-serif); font-size:19px; font-weight:600; }
.st-h p{ margin:5px 0 0; font-size:13px; color:var(--ps-ink-2); }
.st-grid{ padding:20px 22px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.st-f{ display:flex; flex-direction:column; gap:6px; }
.st-f > span{ font-size:12.5px; font-weight:600; color:var(--ps-ink-2); }
.st-f input, .st-f select, .st-f textarea{ padding:11px 13px; border:1px solid var(--ps-line); border-radius:9px;
  font:inherit; font-size:13.5px; color:var(--ps-ink); background:var(--ps-panel); }
.st-f input:focus, .st-f select:focus, .st-f textarea:focus{ outline:none; border-color:var(--ps-blue);
  box-shadow:0 0 0 3px rgba(69,176,238,.14); }
.st-f textarea{ resize:vertical; }
.st-f em{ font-style:normal; font-size:11.5px; color:var(--ps-faint); }
.st-wide{ grid-column:1 / -1; }
.st-foot{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.st-note{ font-size:12.5px; color:var(--ps-faint); }
.ps-root :focus-visible{ outline:2px solid var(--ps-blue); outline-offset:2px; border-radius:8px; }
@media (pointer:coarse){
  .st-f input, .st-f select, .st-f textarea{ font-size:16px; min-height:48px; }
  .ps-action{ min-height:48px; }
}
@media (max-width:760px){
  .st-grid{ grid-template-columns:1fr; padding:16px; }
  .ps-wrap{ padding:0 16px; }
  .ps-bar-in{ height:74px; gap:12px; }
  .ps-logo{ height:44px; }
  .ps-title{ font-size:26px; }
  .ps-head{ padding:26px 0 18px; }
}
`;
