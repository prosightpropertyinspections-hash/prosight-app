"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AGREEMENT_TITLE } from "@/content/agreement";

/* Public signing page for the inspection agreement. No account needed: the
   link itself is the key. The same page is the signed record afterwards,
   for the client and for the inspector. */

const PHONE = "(313) 266-2268";
const TEL = "tel:+13132662268";
const TZ = "America/Detroit";

type Ag = {
  client_name: string | null; address: string | null; fee: number | null; inspection_at: string | null;
  body: string; status: "sent" | "signed"; signed_at: string | null; signer_name: string | null;
};

const when = (iso: string) => new Date(iso).toLocaleString("en-US",
  { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function AgreePage() {
  const { token } = useParams<{ token: string }>();
  const [ag, setAg] = useState<Ag | null>(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signErr, setSignErr] = useState("");

  async function load() {
    try {
      const r = await fetch(`/api/agreements/view?token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (j.agreement) setAg(j.agreement); else setErr(j.error || "This link is not valid.");
    } catch { setErr("Couldn't load the agreement. Check your connection and try again."); }
  }
  useEffect(() => { load(); }, [token]);

  async function sign() {
    setBusy(true); setSignErr("");
    try {
      const r = await fetch("/api/agreements/sign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, agree }),
      });
      const j = await r.json();
      if (j.ok) { await load(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else setSignErr(j.error || "Could not sign. Please try again.");
    } catch { setSignErr("Could not sign. Check your connection and try again."); }
    setBusy(false);
  }

  const nameOk = name.replace(/\s+/g, " ").trim().length >= 3 && name.trim().includes(" ");
  const signed = ag?.status === "signed";

  return (
    <div className="ag">
      <style dangerouslySetInnerHTML={{ __html: AG_CSS }} />
      <header className="ag-bar noprint">
        <img src="/logo-ondark-tight.svg" alt="ProSight Property Inspections" />
        <a href={TEL}>Questions? {PHONE}</a>
      </header>

      <main className="ag-wrap">
        {err && <div className="ag-card ag-msg">{err}<br /><a href={TEL}>Call {PHONE}</a></div>}
        {!err && !ag && <div className="ag-card ag-msg">Loading your agreement…</div>}

        {ag && <>
          {signed ? (
            <div className="ag-done">
              <span>✓</span>
              <div>
                <strong>Signed by {ag.signer_name}</strong>
                <em>{ag.signed_at ? when(ag.signed_at) : ""}. A copy stays available at this link.</em>
              </div>
              <button className="noprint" onClick={() => window.print()}>Print or save</button>
            </div>
          ) : (
            <div className="ag-lead noprint">
              <h1>Please review and sign</h1>
              <p>Read the agreement below, then sign at the bottom. It must be signed before your inspection.</p>
            </div>
          )}

          <article className="ag-card ag-doc">
            <div className="ag-doc-h">
              <h2>{AGREEMENT_TITLE}</h2>
            </div>
            <dl className="ag-facts">
              <div><dt>Client</dt><dd>{ag.client_name || "—"}</dd></div>
              <div><dt>Property</dt><dd>{ag.address || "—"}</dd></div>
              <div><dt>Inspection</dt><dd>{ag.inspection_at ? when(ag.inspection_at) : "—"}</dd></div>
              <div><dt>Fee</dt><dd>{Number(ag.fee) > 0 ? `$${Number(ag.fee).toLocaleString("en-US")}` : "As quoted"}</dd></div>
            </dl>
            <div className="ag-body">{ag.body}</div>

            {signed && (
              <div className="ag-sigrec">
                <div className="ag-sig">{ag.signer_name}</div>
                <div className="ag-sigmeta">Client · signed electronically {ag.signed_at ? when(ag.signed_at) : ""}</div>
              </div>
            )}
          </article>

          {!signed && (
            <section className="ag-card ag-sign noprint">
              <h2>Sign the agreement</h2>
              <label className="ag-f">
                <span>Type your full name</span>
                <input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" />
              </label>
              {name.trim() && <div className="ag-preview">{name}</div>}
              <label className="ag-check">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                <span>I have read this agreement, I agree to its terms, and I agree that typing my name above is my electronic signature.</span>
              </label>
              {signErr && <div className="ag-err">{signErr}</div>}
              <button className="ag-go" disabled={!nameOk || !agree || busy} onClick={sign}>
                {busy ? "Signing…" : "Sign agreement"}
              </button>
              <p className="ag-fine">Want a large-print copy, or have a question first? Call <a href={TEL}>{PHONE}</a>.</p>
            </section>
          )}
        </>}
      </main>
    </div>
  );
}

const AG_CSS = `
.ag{ --navy:#0d1f33; --ink:#16202b; --ink2:#44536a; --faint:#7d8b9c; --blue:#2196d4; --line:#e3e8ee; --ok:#2f8f68;
  min-height:100vh; background:#f4f7fa; color:var(--ink); overflow-x:clip;
  font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
.ag *{ box-sizing:border-box; }
.ag-bar{ background:var(--navy); display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:12px 24px; padding-top:calc(12px + env(safe-area-inset-top,0px)); }
.ag-bar img{ height:46px; width:auto; display:block; }
.ag-bar a{ color:#fff; font-size:14px; font-weight:600; text-decoration:none; white-space:nowrap; }
.ag-wrap{ max-width:820px; margin:0 auto; padding:28px 20px 60px; }
.ag-card{ background:#fff; border:1px solid var(--line); border-radius:14px; box-shadow:0 14px 34px -28px rgba(13,31,51,.5); }
.ag-msg{ padding:34px; text-align:center; color:var(--ink2); line-height:1.8; }
.ag-msg a{ color:var(--blue); font-weight:600; }
.ag-lead h1{ margin:0; font-family:"Sora","Inter",sans-serif; font-size:28px; letter-spacing:-.5px; }
.ag-lead p{ margin:6px 0 20px; color:var(--ink2); font-size:15px; }
.ag-done{ display:flex; align-items:center; gap:14px; padding:16px 18px; margin-bottom:18px; border-radius:14px;
  background:#e8f5ef; border:1px solid #c5e6d6; }
.ag-done > span{ flex-shrink:0; width:38px; height:38px; border-radius:50%; background:var(--ok); color:#fff; display:grid; place-items:center; font-weight:800; }
.ag-done div{ flex:1; min-width:0; }
.ag-done strong{ display:block; font-size:16px; }
.ag-done em{ display:block; font-style:normal; font-size:13px; color:var(--ink2); margin-top:2px; }
.ag-done button{ flex-shrink:0; padding:10px 16px; border-radius:9px; border:1px solid #b5d9c7; background:#fff; font:inherit; font-size:14px; font-weight:600; cursor:pointer; }
.ag-doc{ padding:28px 30px; }
.ag-doc-h{ display:flex; align-items:center; gap:14px; }
.ag-doc-h h2{ margin:0; font-family:"Sora","Inter",sans-serif; font-size:20px; }
.ag-printlogo{ display:none; height:44px; }
.ag-facts{ display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; margin:18px 0 22px; padding:14px 16px; border-radius:10px; background:#f6f9fb; border:1px solid var(--line); }
.ag-facts div{ min-width:0; }
.ag-facts dt{ font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:var(--faint); }
.ag-facts dd{ margin:2px 0 0; font-size:14.5px; font-weight:600; }
.ag-body{ white-space:pre-wrap; font-size:14px; line-height:1.7; color:var(--ink2); }
.ag-sigrec{ margin-top:28px; padding-top:16px; border-top:1px solid var(--line); }
.ag-sig{ font-family:"Brush Script MT","Segoe Script","Snell Roundhand",cursive; font-size:34px; color:var(--navy); line-height:1.2; }
.ag-sigmeta{ font-size:12.5px; color:var(--faint); margin-top:4px; }
.ag-sign{ margin-top:18px; padding:24px 26px; }
.ag-sign h2{ margin:0 0 14px; font-family:"Sora","Inter",sans-serif; font-size:19px; }
.ag-f span{ display:block; font-size:14px; font-weight:500; margin-bottom:7px; }
.ag-f input{ width:100%; padding:12px 14px; border:1px solid #cfd7e0; border-radius:9px; font:inherit; font-size:16px; }
.ag-f input:focus{ outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(33,150,212,.16); }
.ag-preview{ margin-top:10px; padding:6px 14px 10px; border-bottom:1.5px solid var(--ink); font-family:"Brush Script MT","Segoe Script","Snell Roundhand",cursive; font-size:32px; color:var(--navy); }
.ag-check{ display:flex; gap:11px; align-items:flex-start; margin-top:18px; font-size:14px; line-height:1.5; color:var(--ink2); cursor:pointer; }
.ag-check input{ width:19px; height:19px; margin-top:1px; accent-color:var(--blue); flex-shrink:0; }
.ag-err{ margin-top:14px; padding:11px 14px; border-radius:9px; background:#fdf1ef; border:1px solid #f3c2bd; color:#b3362a; font-size:14px; }
.ag-go{ width:100%; margin-top:18px; padding:15px; border:0; border-radius:10px; background:var(--blue); color:#fff; font:inherit; font-size:16px; font-weight:650; cursor:pointer; }
.ag-go:disabled{ background:#a9cfe6; cursor:not-allowed; }
.ag-fine{ margin:14px 0 0; font-size:13px; color:var(--faint); text-align:center; }
.ag-fine a{ color:var(--blue); }
@media (max-width:620px){
  .ag-bar{ padding:10px 16px; }
  .ag-bar img{ height:38px; }
  .ag-wrap{ padding:20px 14px 48px; }
  .ag-doc{ padding:20px 18px; }
  .ag-sign{ padding:20px 18px; }
  .ag-facts{ grid-template-columns:1fr; }
  .ag-done{ flex-wrap:wrap; }
  .ag-done button{ width:100%; }
}
@media print{
  .noprint{ display:none !important; }
  .ag{ background:#fff; }
  .ag-wrap{ padding:0; max-width:none; }
  .ag-card{ border:0; box-shadow:none; }
  .ag-doc{ padding:0; }
  .ag-printlogo{ display:block; }
  .ag-body{ font-size:11.5px; line-height:1.55; color:#000; }
}
`;
