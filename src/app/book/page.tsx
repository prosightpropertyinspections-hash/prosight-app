"use client";
import { useEffect, useMemo, useState } from "react";

/* Public booking. Linked from the marketing site, no account needed.
   Four steps rather than one long form: a stranger abandons a wall of fields,
   but will finish four short screens with visible progress. */

const SERVICES = [
  { k: "Full home inspection", d: "Structure, roof, systems, interior" },
  { k: "Sewer scope",          d: "Camera survey of the main line" },
  { k: "Radon test",           d: "48-hour continuous monitor" },
  { k: "Mold / air quality",   d: "Sampling where moisture is suspected" },
  { k: "Thermal imaging",      d: "Infrared scan for moisture and heat loss" },
  { k: "Re-inspection",        d: "Verifying repairs after a first visit" },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const label12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
};

export default function BookPage() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [doneId, setDoneId] = useState("");

  const [services, setServices] = useState<string[]>(["Full home inspection"]);
  const [day, setDay] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d);
  });
  const [time, setTime] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [slotCfg, setSlotCfg] = useState({ open: 8, close: 17, slot: 30 });

  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", notes: "", consent: false });
  const set = (p: Partial<typeof f>) => setF(v => ({ ...v, ...p }));

  // the next fourteen days, Sundays dropped
  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 1; out.length < 14 && i < 30; i++) {
      const n = new Date(d); n.setDate(d.getDate() + i);
      if (n.getDay() !== 0) out.push(n);
    }
    return out;
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    setTime("");
    fetch(`/api/book?day=${day}`)
      .then(r => r.json())
      .then(j => {
        setTaken(j.taken || []);
        if (j.open) setSlotCfg({ open: j.open, close: j.close, slot: j.slot });
      })
      .catch(() => setTaken([]));
  }, [day, step]);

  const slots = useMemo(() => {
    const out: string[] = [];
    for (let h = slotCfg.open; h <= slotCfg.close; h++) {
      for (let m = 0; m < 60; m += slotCfg.slot) {
        if (h === slotCfg.close && m > 0) break;
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return out;
  }, [slotCfg]);

  function toggle(s: string) {
    setServices(v => v.includes(s) ? v.filter(x => x !== s) : v.length < 3 ? [...v, s] : v);
  }

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, phone: f.phone, email: f.email, address: f.address,
          notes: f.notes, services, starts_at: `${day}T${time}:00`, sms_consent: f.consent,
        }),
      });
      const j = await res.json();
      if (j.ok) { setDoneId(j.id); setStep(4); }
      else setErr(j.error || "Something went wrong. Please call us instead.");
    } catch {
      setErr("Couldn't reach the server. Please check your connection.");
    }
    setBusy(false);
  }

  const canNext =
    step === 0 ? services.length > 0 :
    step === 1 ? !!time :
    step === 2 ? !!f.name.trim() && !!f.address.trim() && (!!f.phone.trim() || !!f.email.trim()) :
    true;

  const prettyWhen = time
    ? new Date(`${day}T${time}:00`).toLocaleString("en-US",
        { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div className="bk">
      <style dangerouslySetInnerHTML={{ __html: BK_CSS }} />

      <header className="bk-bar">
        <a className="bk-home" href="https://prosightpropertyinspections.com">
          <img src="/logo-ondark.svg" alt="ProSight Property Inspections" />
        </a>
        <a className="bk-call" href="tel:+13132662268">(313) 266-2268</a>
      </header>

      <main className="bk-wrap">
        {step < 4 ? (
          <>
            <div className="bk-head">
              <div className="bk-kicker">Schedule an inspection</div>
              <h1>
                {step === 0 && "What do you need?"}
                {step === 1 && "Pick a time"}
                {step === 2 && "Where and who"}
                {step === 3 && "Check and send"}
              </h1>
              <p>
                {step === 0 && "Choose the inspection, and any extras you'd like on the same visit."}
                {step === 1 && "Times shown are available. Most inspections take about three hours."}
                {step === 2 && "So we can confirm, and know where we're going."}
                {step === 3 && "Nothing is charged now. We'll confirm the booking with you first."}
              </p>
            </div>

            <div className="bk-steps">
              {[0, 1, 2, 3].map(i => <span key={i} data-on={i <= step ? "1" : "0"} />)}
            </div>

            <div className="bk-card">
              {step === 0 && (
                <div className="bk-svc">
                  {SERVICES.map(s => (
                    <button key={s.k} type="button" data-on={services.includes(s.k) ? "1" : "0"}
                      onClick={() => toggle(s.k)}>
                      <strong>{s.k}</strong>
                      <em>{s.d}</em>
                    </button>
                  ))}
                  <div className="bk-hint">Up to three services in one visit.</div>
                </div>
              )}

              {step === 1 && (
                <>
                  <div className="bk-days">
                    {days.map(d => {
                      const k = ymd(d);
                      return (
                        <button key={k} type="button" data-on={k === day ? "1" : "0"} onClick={() => setDay(k)}>
                          <em>{d.toLocaleDateString("en-US", { weekday: "short" })}</em>
                          <strong>{d.getDate()}</strong>
                          <i>{d.toLocaleDateString("en-US", { month: "short" })}</i>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bk-slots">
                    {slots.map(s => {
                      const gone = taken.includes(s);
                      return (
                        <button key={s} type="button" disabled={gone}
                          data-on={time === s ? "1" : "0"} onClick={() => setTime(s)}>
                          {label12(s)}
                        </button>
                      );
                    })}
                  </div>
                  {slots.every(s => taken.includes(s)) && (
                    <div className="bk-hint">Nothing free that day — try another.</div>
                  )}
                </>
              )}

              {step === 2 && (
                <div className="bk-form">
                  <label><span>Property address *</span>
                    <input value={f.address} onChange={e => set({ address: e.target.value })}
                      placeholder="2422 Forrister Dr, Adrian, MI 49221" /></label>
                  <label><span>Your name *</span>
                    <input value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Seth Anderson" /></label>
                  <div className="bk-two">
                    <label><span>Mobile</span>
                      <input inputMode="tel" value={f.phone} onChange={e => set({ phone: e.target.value })}
                        placeholder="(313) 555-0142" /></label>
                    <label><span>Email</span>
                      <input inputMode="email" value={f.email} onChange={e => set({ email: e.target.value })}
                        placeholder="you@email.com" /></label>
                  </div>
                  <label><span>Anything we should know</span>
                    <textarea rows={3} value={f.notes} onChange={e => set({ notes: e.target.value })}
                      placeholder="Vacant, lockbox on the door, dog in the yard…" /></label>

                  <label className="bk-check">
                    <input type="checkbox" checked={f.consent}
                      onChange={e => set({ consent: e.target.checked })} />
                    <span>
                      Text me a confirmation of this appointment.
                      <em>One message with the date, time and address. Reply STOP to opt out. Message and data rates may apply.</em>
                    </span>
                  </label>
                </div>
              )}

              {step === 3 && (
                <div className="bk-review">
                  <div><span>Service</span><strong>{services.join(", ")}</strong></div>
                  <div><span>When</span><strong>{prettyWhen}</strong></div>
                  <div><span>Property</span><strong>{f.address}</strong></div>
                  <div><span>Name</span><strong>{f.name}</strong></div>
                  {f.phone && <div><span>Mobile</span><strong>{f.phone}</strong></div>}
                  {f.email && <div><span>Email</span><strong>{f.email}</strong></div>}
                  {f.notes && <div><span>Notes</span><strong>{f.notes}</strong></div>}
                </div>
              )}

              {err ? <div className="bk-err">{err}</div> : null}
            </div>

            <div className="bk-nav">
              {step > 0 && <button className="bk-ghost" onClick={() => { setErr(""); setStep(step - 1); }}>Back</button>}
              {step < 3
                ? <button className="bk-go" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</button>
                : <button className="bk-go" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Request this time"}</button>}
            </div>
          </>
        ) : (
          <div className="bk-done">
            <div className="bk-tick">✓</div>
            <h1>Request received</h1>
            <p>
              Thank you, {f.name.split(" ")[0]}. We have your request for <strong>{prettyWhen}</strong> at {f.address}.
              We'll confirm it shortly{f.phone ? " by text" : " by email"}.
            </p>
            <p className="bk-small">
              Nothing has been charged. If you need to change anything, call <a href="tel:+13132662268">(313) 266-2268</a>.
            </p>
            <a className="bk-go bk-back" href="https://prosightpropertyinspections.com">Back to the website</a>
          </div>
        )}
      </main>

      <footer className="bk-foot">
        ProSight Property Inspections · Adjusterflow LLC · Dearborn Heights, Michigan · InterNACHI NACHI26020705
      </footer>
    </div>
  );
}

const BK_CSS = `
.bk{ min-height:100vh; background:#070d16; color:#eaf2fa; overflow-x:clip;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif; }
.bk-bar{ display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:16px 22px; border-bottom:1px solid #16273c; background:rgba(7,13,22,.9); }
.bk-home img{ height:44px; width:auto; display:block; }
.bk-call{ color:#45b0ee; text-decoration:none; font-size:14px; font-weight:600; white-space:nowrap; }

.bk-wrap{ max-width:660px; margin:0 auto; padding:34px 20px 70px; }
.bk-kicker{ font-size:9.5px; letter-spacing:3.2px; text-transform:uppercase; color:#45b0ee; margin-bottom:9px; }
.bk-head h1{ margin:0; font-family:"Sora","Helvetica Neue",sans-serif; font-size:30px; font-weight:600;
  letter-spacing:-.7px; line-height:1.14; }
.bk-head p{ margin:9px 0 0; font-size:14.5px; color:#a8bbd0; line-height:1.6; }

.bk-steps{ display:flex; gap:6px; margin:22px 0 16px; }
.bk-steps span{ flex:1; height:3px; border-radius:2px; background:#16273c; }
.bk-steps span[data-on="1"]{ background:#45b0ee; }

.bk-card{ border:1px solid #1d3048; border-radius:16px; padding:20px;
  background:linear-gradient(165deg,#132234,#0b1421); }

.bk-svc{ display:grid; gap:9px; }
.bk-svc button{ text-align:left; padding:15px 16px; border:1px solid #1d3048; border-radius:12px;
  background:rgba(15,26,42,.55); color:#eaf2fa; font:inherit; cursor:pointer; }
.bk-svc button strong{ display:block; font-size:14.5px; font-weight:650; }
.bk-svc button em{ display:block; font-style:normal; font-size:12.5px; color:#8ea3ba; margin-top:3px; }
.bk-svc button[data-on="1"]{ border-color:#45b0ee; background:rgba(69,176,238,.10); }

.bk-days{ display:flex; gap:8px; overflow-x:auto; padding-bottom:12px; margin-bottom:6px;
  scrollbar-width:none; }
.bk-days::-webkit-scrollbar{ display:none; }
.bk-days button{ flex:0 0 auto; width:62px; padding:10px 0; border:1px solid #1d3048; border-radius:11px;
  background:rgba(15,26,42,.55); color:#eaf2fa; font:inherit; cursor:pointer; text-align:center; }
.bk-days button em{ display:block; font-style:normal; font-size:10.5px; color:#8ea3ba; text-transform:uppercase; letter-spacing:.8px; }
.bk-days button strong{ display:block; font-size:19px; font-weight:650; line-height:1.35; }
.bk-days button i{ display:block; font-style:normal; font-size:10.5px; color:#8ea3ba; }
.bk-days button[data-on="1"]{ border-color:#45b0ee; background:rgba(69,176,238,.12); }

.bk-slots{ display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:8px; }
.bk-slots button{ padding:12px 6px; border:1px solid #1d3048; border-radius:10px;
  background:rgba(15,26,42,.55); color:#eaf2fa; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; }
.bk-slots button[data-on="1"]{ border-color:#45b0ee; background:rgba(69,176,238,.14); color:#fff; }
.bk-slots button:disabled{ opacity:.26; cursor:not-allowed; text-decoration:line-through; }

.bk-form{ display:grid; gap:14px; }
.bk-form label{ display:block; }
.bk-form label > span{ display:block; font-size:12.5px; font-weight:600; color:#a8bbd0; margin-bottom:6px; }
.bk-form input, .bk-form textarea{ width:100%; padding:12px 14px; border:1px solid #1d3048; border-radius:10px;
  background:#0f1a2a; color:#eaf2fa; font:inherit; font-size:14px; }
.bk-form input:focus, .bk-form textarea:focus{ outline:none; border-color:#45b0ee;
  box-shadow:0 0 0 3px rgba(69,176,238,.14); }
.bk-form textarea{ resize:vertical; }
.bk-two{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }

.bk-check{ display:flex; gap:11px; align-items:flex-start; padding:13px 14px; border-radius:11px;
  border:1px solid #1d3048; background:rgba(15,26,42,.45); cursor:pointer; }
.bk-check input{ width:18px; height:18px; margin-top:1px; accent-color:#45b0ee; flex-shrink:0; }
.bk-check > span{ font-size:13.5px; color:#eaf2fa; line-height:1.5; }
.bk-check em{ display:block; font-style:normal; font-size:11.5px; color:#7f93a9; margin-top:4px; line-height:1.55; }

.bk-review{ display:grid; gap:1px; background:#1d3048; border:1px solid #1d3048; border-radius:11px; overflow:hidden; }
.bk-review > div{ display:flex; justify-content:space-between; gap:16px; padding:12px 14px;
  background:#0f1a2a; font-size:13.5px; }
.bk-review span{ color:#8ea3ba; flex-shrink:0; }
.bk-review strong{ font-weight:600; text-align:right; }

.bk-hint{ font-size:12px; color:#7f93a9; margin-top:10px; }
.bk-err{ margin-top:14px; padding:11px 13px; border-radius:9px; font-size:13px;
  border:1px solid rgba(255,107,94,.32); background:rgba(255,107,94,.08); color:#ff9a91; }

.bk-nav{ display:flex; gap:10px; justify-content:flex-end; margin-top:18px; }
.bk-ghost{ padding:13px 20px; border:1px solid #1d3048; border-radius:11px; background:transparent;
  color:#a8bbd0; font:inherit; font-size:14px; font-weight:600; cursor:pointer; }
.bk-go{ padding:13px 24px; border:0; border-radius:11px; color:#fff; font:inherit; font-size:14px;
  font-weight:650; cursor:pointer; text-decoration:none; display:inline-block;
  background:linear-gradient(150deg,#1a6fa9,#134d78); box-shadow:inset 0 1px 0 rgba(234,242,250,.14); }
.bk-go:hover:not(:disabled){ background:linear-gradient(150deg,#2183c4,#175a8c); }
.bk-go:disabled{ opacity:.45; cursor:not-allowed; }

.bk-done{ text-align:center; padding:26px 0; }
.bk-tick{ width:58px; height:58px; margin:0 auto 20px; border-radius:50%; display:grid; place-items:center;
  background:rgba(63,211,155,.12); border:1px solid rgba(63,211,155,.4); color:#3fd39b; font-size:26px; }
.bk-done h1{ margin:0 0 10px; font-family:"Sora",sans-serif; font-size:27px; font-weight:600; }
.bk-done p{ margin:0 auto 14px; max-width:44ch; font-size:14.5px; line-height:1.7; color:#a8bbd0; }
.bk-small{ font-size:13px !important; color:#7f93a9 !important; }
.bk-small a{ color:#45b0ee; }
.bk-back{ margin-top:8px; }

.bk-foot{ padding:20px; text-align:center; font-size:11.5px; color:#41566e; border-top:1px solid #16273c; }

.bk :focus-visible{ outline:2px solid #45b0ee; outline-offset:2px; border-radius:8px; }
@media (pointer:coarse){
  .bk-form input, .bk-form textarea{ font-size:16px; }
  .bk-go, .bk-ghost, .bk-slots button{ min-height:50px; }
}
@media (max-width:520px){
  .bk-head h1{ font-size:25px; }
  .bk-two{ grid-template-columns:1fr; }
  .bk-nav{ flex-direction:column-reverse; }
  .bk-nav button{ width:100%; }
}
`;
