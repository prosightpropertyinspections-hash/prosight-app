"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

/* Sign in only. Accounts are created in Supabase by hand — this is a private
   tool for one firm, and a public sign-up form on it is an open door. */

/* Supabase returns its own wording, which reads like a database talking to a
   developer. Anything not recognised falls back to something a person can act on. */
function friendly(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Check both and try again.";
  if (m.includes("email not confirmed")) return "This account hasn't been confirmed yet. Check your email for the link.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts just now. Wait a minute and try again.";
  if (m.includes("network") || m.includes("fetch")) return "Can't reach the server. Check your connection and try again.";
  if (m.includes("user not found")) return "No account found for that email.";
  return "Something went wrong signing in. Try again in a moment.";
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (!email.trim() || !pw || busy) return;
    setErr(""); setNote(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) { setErr(friendly(error.message)); setBusy(false); }
    // on success the auth listener swaps the tree; leave busy set so the button
    // cannot be pressed twice during the handover
  }

  async function reset() {
    if (!email.trim()) { setErr("Enter your email first, then tap Forgot password."); return; }
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== "undefined" ? `${location.origin}/` : undefined,
    });
    setBusy(false);
    if (error) setErr(friendly(error.message));
    else setNote("If that email has an account, a reset link is on its way.");
  }

  if (!ready) {
    return (
      <div className="ag ag-wait">
        <style dangerouslySetInnerHTML={{ __html: AG_CSS }} />
        <div className="ag-glow" />
        <img className="ag-wait-mark" src="/logo-ondark.svg" alt="" />
      </div>
    );
  }
  if (session) return <>{children}</>;

  return (
    <div className="ag">
      <style dangerouslySetInnerHTML={{ __html: AG_CSS }} />
      <div className="ag-glow" />

      <div className="ag-card">
        <div className="ag-brand">
          <img src="/logo-ondark.svg" alt="ProSight Property Inspections" />
        </div>

        <div className="ag-kicker">Report Studio</div>
        <h1>Sign in</h1>
        <p className="ag-sub">Your inspections, reports and schedule.</p>

        <label className="ag-f">
          <span>Email</span>
          <input type="email" autoComplete="username" inputMode="email" autoFocus
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="you@company.com" />
        </label>

        <label className="ag-f">
          <span>Password</span>
          <div className="ag-pw">
            <input type={show ? "text" : "password"} autoComplete="current-password"
              value={pw} onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="••••••••" />
            <button type="button" onClick={() => setShow(s => !s)}
              aria-label={show ? "Hide password" : "Show password"}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {err ? <div className="ag-err">{err}</div> : null}
        {note ? <div className="ag-note">{note}</div> : null}

        <button className="ag-go" disabled={busy || !email.trim() || !pw} onClick={submit}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button className="ag-link" type="button" onClick={reset} disabled={busy}>
          Forgot password
        </button>

        <div className="ag-foot">
          Accounts are issued by ProSight Property Inspections.
        </div>
      </div>

      <div className="ag-legal">
        Adjusterflow LLC · Dearborn Heights, Michigan · InterNACHI certified
      </div>
    </div>
  );
}

const AG_CSS = `
.ag{ position:relative; min-height:100vh; display:grid; place-items:center; padding:24px;
  background:#070d16; color:#eaf2fa; overflow-x:clip;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif; }
.ag-wait{ place-items:center; }
.ag-wait-mark{ position:relative; width:min(60vw,240px); opacity:.22; animation:ag-pulse 1.5s ease-in-out infinite; }

.ag-glow{ position:absolute; top:-18%; left:50%; transform:translateX(-50%);
  width:min(1000px,150vw); height:64%; pointer-events:none;
  background:radial-gradient(ellipse at 50% 40%, rgba(69,176,238,.20), transparent 68%); filter:blur(30px); }

.ag-card{ position:relative; width:100%; max-width:416px; padding:34px 34px 26px;
  border:1px solid #1d3048; border-radius:18px;
  background:linear-gradient(165deg,#132234,#0b1421);
  box-shadow:0 34px 80px -28px rgba(0,0,0,.95), inset 0 1px 0 rgba(234,242,250,.06);
  animation:ag-rise .5s cubic-bezier(.2,.8,.25,1) both; }

.ag-brand{ padding-bottom:22px; margin-bottom:22px; border-bottom:1px solid #16273c; }
.ag-brand img{ display:block; width:min(62%,190px); height:auto; }

.ag-kicker{ font-size:9px; letter-spacing:3.4px; text-transform:uppercase; color:#45b0ee; margin-bottom:8px; }
.ag-card h1{ margin:0; font-family:"Sora","Helvetica Neue",sans-serif; font-size:23px; font-weight:600;
  letter-spacing:-.4px; }
.ag-sub{ margin:6px 0 22px; font-size:13.5px; color:#a8bbd0; }

.ag-f{ display:block; margin-bottom:14px; }
.ag-f > span{ display:block; font-size:12.5px; font-weight:600; color:#a8bbd0; margin-bottom:6px; }
.ag-f input{ width:100%; padding:12px 14px; border:1px solid #1d3048; border-radius:10px;
  background:#0f1a2a; color:#eaf2fa; font:inherit; font-size:14px; }
.ag-f input::placeholder{ color:#5d7189; }
.ag-f input:focus{ outline:none; border-color:#45b0ee; box-shadow:0 0 0 3px rgba(69,176,238,.14); }

.ag-pw{ position:relative; }
.ag-pw input{ padding-right:74px; }
.ag-pw button{ position:absolute; right:6px; top:50%; transform:translateY(-50%);
  border:0; background:transparent; color:#7f93a9; font:inherit; font-size:12.5px; font-weight:600;
  cursor:pointer; padding:8px 10px; border-radius:7px; }
.ag-pw button:hover{ color:#eaf2fa; }

.ag-err{ margin:2px 0 14px; padding:11px 13px; border-radius:9px; font-size:13px; line-height:1.55;
  border:1px solid rgba(255,107,94,.32); background:rgba(255,107,94,.08); color:#ff9a91; }
.ag-note{ margin:2px 0 14px; padding:11px 13px; border-radius:9px; font-size:13px; line-height:1.55;
  border:1px solid rgba(63,211,155,.3); background:rgba(63,211,155,.08); color:#6fdcb2; }

.ag-go{ width:100%; margin-top:4px; padding:13px 20px; border:0; border-radius:11px; color:#fff;
  font:inherit; font-size:14px; font-weight:650; cursor:pointer;
  background:linear-gradient(150deg,#1a6fa9,#134d78); box-shadow:inset 0 1px 0 rgba(234,242,250,.14); }
.ag-go:hover:not(:disabled){ background:linear-gradient(150deg,#2183c4,#175a8c); }
.ag-go:disabled{ opacity:.45; cursor:not-allowed; }

.ag-link{ display:block; width:100%; margin-top:12px; border:0; background:transparent; cursor:pointer;
  color:#7f93a9; font:inherit; font-size:12.5px; font-weight:600; }
.ag-link:hover:not(:disabled){ color:#45b0ee; }

.ag-foot{ margin-top:22px; padding-top:16px; border-top:1px solid #16273c;
  font-size:11.5px; color:#5d7189; text-align:center; }
.ag-legal{ position:relative; margin-top:20px; font-size:11px; color:#41566e; text-align:center; }

@keyframes ag-rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
@keyframes ag-pulse{ 0%,100%{ opacity:.18; } 50%{ opacity:.32; } }

@media (pointer:coarse){
  .ag-f input{ font-size:16px; min-height:50px; }
  .ag-go{ min-height:52px; }
  .ag-pw button{ min-height:44px; }
}
@media (max-width:420px){
  .ag-card{ padding:26px 22px 20px; border-radius:15px; }
  .ag-card h1{ font-size:21px; }
}
@media (prefers-reduced-motion: reduce){ .ag-card, .ag-wait-mark{ animation:none !important; } }
`;
