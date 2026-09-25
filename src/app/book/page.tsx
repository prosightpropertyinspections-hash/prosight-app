"use client";
import { useEffect, useMemo, useState } from "react";
import { ADDON_PRICES, INSPECTION_TIERS, inspectionTier, quote, money } from "@/lib/pricing";

/* Public booking. Linked from the marketing site, no account needed.
   Six short steps with a visible progress bar: a stranger abandons a wall of
   fields, but finishes short screens that each ask one thing.
   Submits to /api/book with the same fields as before, so bookings land in
   the schedule exactly as they always have. */

const PHONE = "(313) 266-2268";
const TEL = "tel:+13132662268";
const SITE = "https://prosightpropertyinspections.com";

const STEPS = ["Service", "Property", "Price", "Add-ons", "Schedule", "Contact", "Confirm"];
const PRICE_STEP = 2;
const LAST = STEPS.length - 1;

type PrimaryKey = "buyer" | "listing" | "testing" | "reinspect";
const PRIMARY: { k: PrimaryKey; t: string; d: string; svc: string | null; icon: string; price?: string }[] = [
  { k: "buyer", t: "Home Buyer", d: "Every major system inspected before you close, with the full report the same day.", svc: "Full home inspection", icon: "house", price: "From $420" },
  { k: "listing", t: "Pre-Listing", d: "Find what a buyer's inspector will, before your home goes on the market.", svc: "Full home inspection", icon: "sign", price: "From $420" },
  { k: "testing", t: "Testing Only", d: "Sewer scope, radon or mold testing without a full home inspection.", svc: null, icon: "flask", price: "Sewer $150 · Radon $200" },
  { k: "reinspect", t: "Re-Inspection", d: "Verify that repairs were done after an earlier inspection.", svc: "Re-inspection", icon: "check" },
];

const ADDONS = [
  { k: "Sewer scope", d: "Camera survey of the main line out to the street." },
  { k: "Radon test", d: "48-hour continuous monitor, placed and collected by us." },
  { k: "Mold / air quality", d: "Air or surface sampling where moisture is suspected." },
];

const FOUNDATIONS = ["Basement", "Crawlspace", "Slab", "Not sure"];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const label12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
};

const digits = (s: string) => s.replace(/\D/g, "");

function Icon({ name }: { name: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "house") return <svg viewBox="0 0 24 24" {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9.5 20v-6h5v6" /></svg>;
  if (name === "sign") return <svg viewBox="0 0 24 24" {...p}><path d="M5 21V3" /><path d="M5 5h13v8H5" /><path d="M9 9h5" /></svg>;
  if (name === "flask") return <svg viewBox="0 0 24 24" {...p}><path d="M9 3h6" /><path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7 15h10" /></svg>;
  return <svg viewBox="0 0 24 24" {...p}><path d="M20 6L9 17l-5-5" /></svg>;
}

export default function BookPage() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const [primary, setPrimary] = useState<PrimaryKey | "">("");
  const [addons, setAddons] = useState<string[]>([]);
  const [prop, setProp] = useState({ street: "", unit: "", city: "", zip: "", sqft: "", year: "", foundation: "" });
  const setP = (v: Partial<typeof prop>) => setProp(o => ({ ...o, ...v }));
  const [c, setC] = useState({ name: "", phone: "", email: "", notes: "", consent: false });
  const setCt = (v: Partial<typeof c>) => setC(o => ({ ...o, ...v }));

  // the next fourteen working days, Sundays dropped
  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 1; out.length < 14 && i < 30; i++) {
      const n = new Date(d); n.setDate(d.getDate() + i);
      if (n.getDay() !== 0) out.push(n);
    }
    return out;
  }, []);
  const [day, setDay] = useState<string>(() => ymd(days[0]));
  const [time, setTime] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [slotCfg, setSlotCfg] = useState({ open: 8, close: 17, slot: 30 });
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => { setTime(""); }, [day]);

  useEffect(() => {
    if (step !== 4) return;
    let live = true;
    setSlotsLoading(true);
    fetch(`/api/book?day=${day}`)
      .then(r => r.json())
      .then(j => {
        if (!live) return;
        setTaken(j.taken || []);
        if (j.open) setSlotCfg({ open: j.open, close: j.close, slot: j.slot });
      })
      .catch(() => live && setTaken([]))
      .finally(() => live && setSlotsLoading(false));
    return () => { live = false; };
  }, [day, step]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step, done]);

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

  const primaryDef = PRIMARY.find(p => p.k === primary);
  const fullInspection = primary === "buyer" || primary === "listing";
  const sqftNum = Number(prop.sqft) || 0;
  const tier = inspectionTier(sqftNum);

  const address = [prop.street.trim() + (prop.unit.trim() ? `, ${prop.unit.trim()}` : ""), prop.city.trim(), `MI ${prop.zip.trim()}`]
    .filter(Boolean).join(", ");

  const phoneOk = !c.phone.trim() || digits(c.phone).length >= 10;
  const emailOk = !c.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim());

  const valid = [
    !!primary,
    !!prop.street.trim() && !!prop.city.trim() && /^\d{5}$/.test(prop.zip.trim()) && (!fullInspection || sqftNum >= 200),
    true,
    primary !== "testing" || addons.length > 0,
    !!time,
    !!c.name.trim() && (!!c.phone.trim() || !!c.email.trim()) && phoneOk && emailOk,
    true,
  ];

  const hint = [
    "Choose the type of inspection to continue.",
    fullInspection && !(sqftNum >= 200) && prop.street.trim() && prop.city.trim() && /^\d{5}$/.test(prop.zip.trim())
      ? "Enter the square footage to continue."
      : "Enter the street, city and a 5-digit ZIP.",
    "",
    "Choose at least one test.",
    "Pick a time to continue.",
    !phoneOk ? "That phone number looks too short." : !emailOk ? "That email doesn't look right." : "Add your name and a phone number or email.",
    "",
  ];

  /* The price step only applies to a full inspection; testing and
     re-inspections go straight from the property to the add-ons. */
  const visible = STEPS.map((_, i) => i).filter(i => i !== PRICE_STEP || fullInspection);
  const nextOf = (i: number) => visible[visible.indexOf(i) + 1] ?? i;
  const prevOf = (i: number) => visible[visible.indexOf(i) - 1] ?? i;

  function go(n: number) {
    setErr("");
    setStep(n);
    setReached(r => Math.max(r, n));
  }

  function toggleAddon(k: string) {
    setAddons(v => v.includes(k) ? v.filter(x => x !== k) : [...v, k]);
  }

  const services = [
    ...(primaryDef?.svc ? [primaryDef.svc] : []),
    ...addons,
  ];

  const priced = quote(services, sqftNum);

  const propDetails = [
    prop.sqft.trim() && `${prop.sqft.trim()} sq ft`,
    prop.year.trim() && `built ${prop.year.trim()}`,
    prop.foundation && prop.foundation !== "Not sure" && `${prop.foundation} foundation`,
  ].filter(Boolean).join(" · ");

  const prettyWhen = time
    ? new Date(`${day}T${time}:00`).toLocaleString("en-US",
        { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  async function submit() {
    setErr(""); setBusy(true);
    const notes = [
      primaryDef ? `Booked online: ${primaryDef.t}` : "",
      propDetails ? `Property: ${propDetails}` : "",
      c.notes.trim(),
    ].filter(Boolean).join("\n");
    try {
      const res = await fetch("/api/book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.name, phone: c.phone, email: c.email, address,
          notes, services, sqft: sqftNum, starts_at: `${day}T${time}:00`, sms_consent: c.consent,
        }),
      });
      const j = await res.json();
      if (j.ok) setDone(true);
      else {
        setErr(j.error || "Something went wrong. Please call us instead.");
        if (res.status === 409) { setTaken(t => [...t, time]); setTime(""); go(4); }
      }
    } catch {
      setErr("Couldn't reach the server. Please check your connection.");
    }
    setBusy(false);
  }

  const aside = [
    { h: "Not sure which?", b: ["Buying a home: Home Buyer.", "Selling: Pre-Listing.", "Just need a sewer, radon or mold test: Testing Only."], f: `Or call ${PHONE} and we'll help you choose.` },
    { h: "Why we need this", b: ["Plan the right amount of time", "Bring the right equipment", "Route to the property", "Prepare for your inspection"], f: "Square footage sets your price, shown on the next step. A close estimate is fine; the listing usually shows it." },
    { h: "How pricing works", b: ["Priced by the home's square footage", "Thermal imaging is always included", "Sewer and radon testing are priced separately"], f: `Questions about your price? Call ${PHONE}.` },
    { h: "Why add testing?", b: ["Sewer lines fail underground, out of sight", "Radon is common in Southeast Michigan", "Mold hides behind finishes"], f: "Testing on the same visit saves a second trip." },
    { h: "About your visit", b: ["Most inspections take about two hours", "You're welcome to attend, and encouraged", "Your digital report arrives the same day"], f: "Times are Michigan time." },
    { h: "Your details", b: ["Used only to confirm this booking", "Never shared or sold", "One text, only if you ask for it"], f: "" },
    { h: "What happens next", b: ["We confirm your time by text or email", "Nothing is charged now", "Change anything with a quick call"], f: "" },
  ][step];

  return (
    <div className="bk">
      <style dangerouslySetInnerHTML={{ __html: BK_CSS }} />

      <header className="bk-bar">
        <a className="bk-home" href={SITE}>
          <img src="/logo-ondark-tight.svg" alt="ProSight Property Inspections" />
        </a>
        <a className="bk-call" href={TEL}>
          <span className="bk-need">Need help?</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
          <span>Call {PHONE}</span>
        </a>
      </header>

      {!done && (
        <nav className="bk-steps" aria-label="Booking steps">
          <ol>
            {visible.map((i, pos) => {
              const s = STEPS[i];
              const state = i < step ? "done" : i === step ? "on" : "off";
              const can = i <= reached && i !== step;
              return (
                <li key={s} data-state={state}>
                  <button type="button" disabled={!can} onClick={() => can && go(i)}>
                    <i>{state === "done" ? "✓" : pos + 1}</i>
                    <span>{s}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="bk-mstep">
            <span>Step {visible.indexOf(step) + 1} of {visible.length}</span>
            <strong>{STEPS[step]}</strong>
            <div className="bk-mbar"><b style={{ width: `${((visible.indexOf(step) + 1) / visible.length) * 100}%` }} /></div>
          </div>
        </nav>
      )}

      <main className="bk-wrap">
        {done ? (
          <div className="bk-done">
            <div className="bk-tick">✓</div>
            <h1>Request received</h1>
            <p>
              Thank you, {c.name.trim().split(" ")[0]}. We have your request for <strong>{prettyWhen}</strong> at {address}.
              We'll confirm it shortly{c.phone.trim() ? " by text" : " by email"}.
            </p>
            <p className="bk-small">
              Nothing has been charged. If you need to change anything, call <a href={TEL}>{PHONE}</a>.
            </p>
            <a className="bk-go" href={SITE}>Back to the website</a>
          </div>
        ) : (
          <>
            <h1 className="bk-title">
              {step === 0 && "What type of inspection do you need?"}
              {step === 1 && "Property information"}
              {step === 2 && "Your inspection price"}
              {step === 3 && (primary === "testing" ? "Which tests do you need?" : "Add testing to the same visit")}
              {step === 4 && "Pick a date and time"}
              {step === 5 && "Your contact details"}
              {step === 6 && "Review and confirm"}
            </h1>
            <p className="bk-sub">
              {step === 0 && "Choose one. You can add sewer, radon or mold testing on the next steps."}
              {step === 1 && "Tell us about the property to be inspected."}
              {step === 2 && "Based on the square footage you entered. You can add sewer or radon testing next."}
              {step === 3 && (primary === "testing" ? "Choose one or more." : "Optional. Skip this step if you only need the inspection.")}
              {step === 4 && "Available times are shown. Most inspections take about two hours."}
              {step === 5 && "So we can confirm your booking."}
              {step === 6 && "Check everything below. Nothing is charged now."}
            </p>

            <div className="bk-grid">
              <div className="bk-main">
                {step === 0 && (
                  <div className="bk-types">
                    {PRIMARY.map(p => (
                      <button key={p.k} type="button" data-on={primary === p.k ? "1" : "0"}
                        onClick={() => { setPrimary(p.k); if (p.k === "reinspect") setAddons([]); }}>
                        <span className="bk-ico"><Icon name={p.icon} /></span>
                        <strong>{p.t}</strong>
                        <em>{p.d}</em>
                        {p.price && <span className="bk-from">{p.price}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {step === 1 && (
                  <section className="bk-card">
                    <h2>Property address</h2>
                    <div className="bk-form">
                      <label><span>Street address <b>*</b></span>
                        <input autoComplete="address-line1" value={prop.street} onChange={e => setP({ street: e.target.value })}
                          placeholder="2422 Forrister Dr" /></label>
                      <label><span>Address line 2</span>
                        <input autoComplete="address-line2" value={prop.unit} onChange={e => setP({ unit: e.target.value })}
                          placeholder="Apt, suite, unit (optional)" /></label>
                      <div className="bk-three">
                        <label><span>City <b>*</b></span>
                          <input autoComplete="address-level2" value={prop.city} onChange={e => setP({ city: e.target.value })}
                            placeholder="Dearborn" /></label>
                        <label><span>State</span>
                          <input value="Michigan" readOnly tabIndex={-1} className="bk-ro" /></label>
                        <label><span>ZIP <b>*</b></span>
                          <input autoComplete="postal-code" inputMode="numeric" maxLength={5} value={prop.zip}
                            onChange={e => setP({ zip: digits(e.target.value).slice(0, 5) })} placeholder="48127" /></label>
                      </div>
                    </div>
                    <h2 className="bk-h2b">Property details</h2>
                    <div className="bk-form">
                      <div className="bk-two">
                        <label><span>Square feet {fullInspection ? <b>*</b> : null}</span>
                          <input inputMode="numeric" value={prop.sqft} onChange={e => setP({ sqft: digits(e.target.value).slice(0, 6) })}
                            placeholder="1,800" /></label>
                        <label><span>Year built</span>
                          <input inputMode="numeric" maxLength={4} value={prop.year} onChange={e => setP({ year: digits(e.target.value).slice(0, 4) })}
                            placeholder="1956" /></label>
                      </div>
                      <div>
                        <span className="bk-lbl">Foundation</span>
                        <div className="bk-chips">
                          {FOUNDATIONS.map(fd => (
                            <button key={fd} type="button" data-on={prop.foundation === fd ? "1" : "0"}
                              onClick={() => setP({ foundation: prop.foundation === fd ? "" : fd })}>{fd}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {step === 2 && tier && (
                  <section className="bk-card">
                    <h2>{primary === "listing" ? "Pre-listing (seller) inspection" : "Home buyer inspection"}</h2>
                    <div className="bk-quote">
                      <div className="bk-quote-top">
                        <span>Your price</span>
                        <strong>{money(tier.price)}</strong>
                        <em>{Number(prop.sqft).toLocaleString("en-US")} sq ft · {tier.label}</em>
                      </div>
                      <ul className="bk-incl-list">
                        <li>Every major system: roof, structure, electrical, plumbing, heating and cooling</li>
                        <li>Thermal imaging included</li>
                        <li>Digital report with photos, the same day</li>
                        <li>About two hours on site, and you're welcome to attend</li>
                      </ul>
                    </div>
                    <div className="bk-tiers">
                      {INSPECTION_TIERS.map(tr => (
                        <div key={tr.label} data-on={tr === tier ? "1" : "0"}>
                          <span>{tr.label}</span><strong>{money(tr.price)}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <div className="bk-adds">
                    {fullInspection && (
                      <div className="bk-add bk-incl">
                        <span className="bk-box" data-on="1">✓</span>
                        <div><strong>Thermal imaging</strong><em>Infrared scan for hidden moisture and heat loss.</em></div>
                        <span className="bk-tag">Included</span>
                      </div>
                    )}
                    {ADDONS.map(a => (
                      <button key={a.k} type="button" className="bk-add" data-on={addons.includes(a.k) ? "1" : "0"}
                        onClick={() => toggleAddon(a.k)}>
                        <span className="bk-box" data-on={addons.includes(a.k) ? "1" : "0"}>✓</span>
                        <div><strong>{a.k}</strong><em>{a.d}</em></div>
                        <span className="bk-tag bk-tagp">{ADDON_PRICES[a.k] != null ? money(ADDON_PRICES[a.k] as number) : "Quoted"}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 4 && (
                  <section className="bk-card">
                    <h2>{new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
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
                    <div className="bk-slots" data-loading={slotsLoading ? "1" : "0"}>
                      {slots.map(s => {
                        const gone = taken.includes(s);
                        return (
                          <button key={s} type="button" disabled={gone || slotsLoading}
                            data-on={time === s ? "1" : "0"} onClick={() => setTime(s)}>
                            {label12(s)}
                          </button>
                        );
                      })}
                    </div>
                    {!slotsLoading && slots.every(s => taken.includes(s)) && (
                      <div className="bk-hint">Nothing free that day. Try another date.</div>
                    )}
                  </section>
                )}

                {step === 5 && (
                  <section className="bk-card">
                    <h2>Contact information</h2>
                    <div className="bk-form">
                      <label><span>Full name <b>*</b></span>
                        <input autoComplete="name" value={c.name} onChange={e => setCt({ name: e.target.value })} placeholder="Seth Anderson" /></label>
                      <div className="bk-two">
                        <label><span>Mobile phone</span>
                          <input autoComplete="tel" inputMode="tel" value={c.phone} onChange={e => setCt({ phone: e.target.value })}
                            placeholder="(313) 555-0142" /></label>
                        <label><span>Email</span>
                          <input autoComplete="email" inputMode="email" value={c.email} onChange={e => setCt({ email: e.target.value })}
                            placeholder="you@email.com" /></label>
                      </div>
                      <p className="bk-note">A phone number or an email is required.</p>
                      <label><span>Access notes</span>
                        <textarea rows={3} value={c.notes} onChange={e => setCt({ notes: e.target.value })}
                          placeholder="Vacant, lockbox on the door, dog in the yard, agent's name…" /></label>
                      <label className="bk-check">
                        <input type="checkbox" checked={c.consent} onChange={e => setCt({ consent: e.target.checked })} />
                        <span>
                          Text me a confirmation of this appointment.
                          <em>One message with the date, time and address. Reply STOP to opt out. Message and data rates may apply.</em>
                        </span>
                      </label>
                    </div>
                  </section>
                )}

                {step === 6 && (
                  <div className="bk-review">
                    <section>
                      <header><h2>Service</h2><button type="button" onClick={() => go(0)}>Edit</button></header>
                      <p><strong>{primaryDef?.t}</strong>{fullInspection ? " · thermal imaging included" : ""}</p>
                      {addons.length > 0 && <p>{addons.join(", ")}</p>}
                      {addons.length === 0 && primary !== "testing" && primary !== "reinspect" && (
                        <p className="bk-muted">No add-on testing. <button type="button" className="bk-link" onClick={() => go(3)}>Add some</button></p>
                      )}
                    </section>
                    <section>
                      <header><h2>Property</h2><button type="button" onClick={() => go(1)}>Edit</button></header>
                      <p><strong>{address}</strong></p>
                      {propDetails && <p>{propDetails}</p>}
                    </section>
                    <section>
                      <header><h2>Appointment</h2><button type="button" onClick={() => go(4)}>Edit</button></header>
                      <p><strong>{prettyWhen}</strong></p>
                      <p className="bk-muted">About two hours on site</p>
                    </section>
                    <section className="bk-bill">
                      <header><h2>Price</h2></header>
                      {priced.lines.map(l => (
                        <div key={l.label} className="bk-line"><span>{l.label}</span><span>{l.price != null ? money(l.price) : "Quoted"}</span></div>
                      ))}
                      {fullInspection && <div className="bk-line bk-incl2"><span>Thermal imaging</span><span>Included</span></div>}
                      <div className="bk-line bk-total"><span>Total{priced.quoted ? " (plus quoted items)" : ""}</span><span>{money(priced.total)}</span></div>
                      <p className="bk-muted">Nothing is charged now.</p>
                    </section>
                    <section>
                      <header><h2>Contact</h2><button type="button" onClick={() => go(5)}>Edit</button></header>
                      <p><strong>{c.name}</strong></p>
                      {c.phone && <p>{c.phone}</p>}
                      {c.email && <p>{c.email}</p>}
                      {c.notes && <p className="bk-muted">{c.notes}</p>}
                      {c.consent && <p className="bk-muted">Text confirmation requested</p>}
                    </section>
                  </div>
                )}

                {err ? <div className="bk-err">{err}</div> : null}

                <div className="bk-nav">
                  {step > 0
                    ? <button type="button" className="bk-ghost" onClick={() => go(prevOf(step))}>← Back</button>
                    : <a className="bk-ghost" href={SITE}>← Website</a>}
                  <div className="bk-navr">
                    {!valid[step] && <span className="bk-why">{hint[step]}</span>}
                    {step < LAST
                      ? <button type="button" className="bk-go" disabled={!valid[step]} onClick={() => go(nextOf(step))}>
                          {step === 3 && primary !== "testing" && addons.length === 0 ? "Skip" : "Continue"} →
                        </button>
                      : <button type="button" className="bk-go" disabled={busy} onClick={submit}>
                          {busy ? "Sending…" : "Request this time"}
                        </button>}
                  </div>
                </div>
              </div>

              <aside className="bk-aside">
                <h3>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
                  {aside.h}
                </h3>
                <ul>{aside.b.map(x => <li key={x}>{x}</li>)}</ul>
                {aside.f && <p>{aside.f}</p>}
                {step > PRICE_STEP && step < LAST && priced.total > 0 && (
                  <div className="bk-est">
                    {priced.lines.filter(l => l.price != null).map(l => (
                      <div key={l.label} className="bk-line"><span>{l.label}</span><span>{money(l.price as number)}</span></div>
                    ))}
                    <div className="bk-line bk-total"><span>Estimated total</span><span>{money(priced.total)}</span></div>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>

      <footer className="bk-foot">
        ProSight Property Inspections · AdjusterFlow LLC · Dearborn Heights, Michigan · InterNACHI NACHI26020705
      </footer>
    </div>
  );
}

const BK_CSS = `
.bk{ --navy:#0d1f33; --ink:#16202b; --ink2:#44536a; --faint:#7d8b9c; --blue:#2196d4; --blued:#1a7ab0;
  --line:#e3e8ee; --tint:#f4f7fa; --ok:#2f8f68;
  min-height:100vh; display:flex; flex-direction:column; background:var(--tint); color:var(--ink); overflow-x:clip;
  font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
.bk *{ box-sizing:border-box; }

.bk-bar{ background:var(--navy); display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:12px 28px; padding-top:calc(12px + env(safe-area-inset-top,0px)); }
.bk-home img{ height:58px; width:auto; display:block; }
.bk-call{ display:flex; align-items:center; gap:8px; color:#fff; text-decoration:none; font-size:14.5px; font-weight:600; white-space:nowrap; }
.bk-call .bk-need{ color:rgba(255,255,255,.62); font-weight:500; margin-right:4px; }
.bk-call svg{ width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.7; }

.bk-steps{ background:#fff; border-bottom:1px solid var(--line); }
.bk-steps ol{ list-style:none; margin:0 auto; padding:16px 24px; max-width:1060px; display:flex; align-items:center; gap:6px; }
.bk-steps li{ flex:1; display:flex; align-items:center; gap:6px; min-width:0; }
.bk-steps li + li::before{ content:""; flex:0 0 22px; height:2px; background:var(--line); border-radius:2px; }
.bk-steps li[data-state="done"] + li::before, .bk-steps li[data-state="on"]::before{ background:var(--blue); }
.bk-steps button{ display:flex; align-items:center; gap:9px; border:0; background:none; padding:4px; font:inherit; color:var(--faint);
  font-size:14px; font-weight:500; cursor:default; min-width:0; }
.bk-steps button:not(:disabled){ cursor:pointer; }
.bk-steps button:not(:disabled):hover span{ color:var(--blue); }
.bk-steps i{ flex-shrink:0; width:30px; height:30px; border-radius:50%; display:grid; place-items:center; font-style:normal;
  font-size:13px; font-weight:700; background:#e9edf2; color:var(--faint); }
.bk-steps li[data-state="on"] i{ background:var(--navy); color:#fff; box-shadow:0 0 0 4px rgba(33,150,212,.18); }
.bk-steps li[data-state="on"] span{ color:var(--navy); font-weight:700; }
.bk-steps li[data-state="done"] i{ background:var(--ok); color:#fff; }
.bk-steps li[data-state="done"] span{ color:var(--ok); }
.bk-steps span{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bk-mstep{ display:none; }

.bk-wrap{ flex:1; width:100%; max-width:1060px; margin:0 auto; padding:40px 24px 64px; }
.bk-title{ margin:0; font-family:"Sora","Inter",sans-serif; font-size:32px; font-weight:700; letter-spacing:-.7px; line-height:1.15; color:var(--ink); }
.bk-sub{ margin:8px 0 26px; font-size:15.5px; color:var(--ink2); }

.bk-grid{ display:grid; grid-template-columns:minmax(0,1fr) 290px; gap:28px; align-items:start; }

.bk-main{ min-width:0; }
.bk-card{ background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden;
  box-shadow:0 14px 34px -28px rgba(13,31,51,.5); }
.bk-card h2{ margin:0; padding:14px 20px; background:var(--navy); color:#fff; font-family:"Sora","Inter",sans-serif;
  font-size:16.5px; font-weight:600; }
.bk-card h2.bk-h2b{ background:#f7f9fb; color:var(--ink); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.bk-card h2 em{ font-style:normal; font-family:"Inter",sans-serif; font-size:12px; font-weight:500; color:var(--faint); margin-left:6px; }
.bk-card > .bk-form, .bk-card > .bk-days, .bk-card > .bk-slots, .bk-card > .bk-hint{ margin:20px; }
.bk-card > .bk-days{ margin-bottom:0; }

.bk-types{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.bk-types button{ position:relative; text-align:center; padding:30px 22px 26px; background:#fff; border:1.5px solid var(--line);
  border-radius:12px; font:inherit; color:var(--ink); cursor:pointer; transition:border-color .15s, box-shadow .15s, transform .15s; }
.bk-types button:hover{ border-color:#b9d9ee; transform:translateY(-2px); box-shadow:0 14px 30px -24px rgba(13,31,51,.55); }
.bk-types button[data-on="1"]{ border-color:var(--blue); box-shadow:0 0 0 3px rgba(33,150,212,.16); }
.bk-types button[data-on="1"]::after{ content:"✓"; position:absolute; top:12px; right:12px; width:24px; height:24px; border-radius:50%;
  background:var(--blue); color:#fff; font-size:13px; font-weight:700; display:grid; place-items:center; }
.bk-ico{ display:inline-grid; place-items:center; width:54px; height:54px; border-radius:14px; background:#eef6fc; color:var(--blue); margin-bottom:14px; }
.bk-ico svg{ width:28px; height:28px; }
.bk-types strong{ display:block; font-family:"Sora","Inter",sans-serif; font-size:19px; font-weight:600; margin-bottom:6px; }
.bk-types em{ display:block; font-style:normal; font-size:14px; color:var(--ink2); line-height:1.55; }

.bk-form{ display:grid; gap:16px; }
.bk-form label{ display:block; }
.bk-form label > span, .bk-lbl{ display:block; font-size:14px; font-weight:500; color:var(--ink); margin-bottom:7px; }
.bk-form b{ color:#d33; font-weight:600; }
.bk-form input, .bk-form textarea{ width:100%; padding:11px 13px; border:1px solid #cfd7e0; border-radius:8px; background:#fff;
  color:var(--ink); font:inherit; font-size:15px; transition:border-color .15s, box-shadow .15s; }
.bk-form input::placeholder, .bk-form textarea::placeholder{ color:#a3aebb; }
.bk-form input:focus, .bk-form textarea:focus{ outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(33,150,212,.16); }
.bk-form .bk-ro{ background:#f3f5f8; color:var(--ink2); }
.bk-form textarea{ resize:vertical; }
.bk-two{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.bk-three{ display:grid; grid-template-columns:1.4fr 1fr .8fr; gap:14px; }
.bk-note{ margin:-8px 0 0; font-size:12.5px; color:var(--faint); }

.bk-chips{ display:flex; flex-wrap:wrap; gap:8px; }
.bk-chips button{ padding:9px 16px; border:1px solid #cfd7e0; border-radius:999px; background:#fff; font:inherit; font-size:14px;
  color:var(--ink2); cursor:pointer; }
.bk-chips button[data-on="1"]{ border-color:var(--blue); background:#eef6fc; color:var(--blued); font-weight:600; }

.bk-quote{ margin:20px; display:grid; grid-template-columns:auto 1fr; gap:22px; align-items:center; }
.bk-quote-top{ padding:20px 26px; border-radius:12px; background:#eef6fc; border:1px solid #cfe5f3; text-align:center; min-width:190px; }
.bk-quote-top span{ display:block; font-size:12px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:var(--blued); }
.bk-quote-top strong{ display:block; font-family:"Sora","Inter",sans-serif; font-size:44px; font-weight:700; line-height:1.15; color:var(--navy); margin:4px 0; }
.bk-quote-top em{ display:block; font-style:normal; font-size:12.5px; color:var(--ink2); }
.bk-incl-list{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }
.bk-incl-list li{ position:relative; padding-left:28px; font-size:14.5px; color:var(--ink2); line-height:1.45; }
.bk-incl-list li::before{ content:"✓"; position:absolute; left:0; top:0; width:19px; height:19px; border-radius:50%; background:#e3f3ec;
  color:var(--ok); font-size:11px; font-weight:800; display:grid; place-items:center; }
.bk-tiers{ margin:0 20px 20px; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.bk-tiers div{ display:flex; justify-content:space-between; padding:10px 14px; font-size:14px; color:var(--faint); }
.bk-tiers div + div{ border-top:1px solid var(--line); }
.bk-tiers div[data-on="1"]{ background:#f5fafe; color:var(--ink); font-weight:600; box-shadow:inset 3px 0 0 var(--blue); }
.bk-tiers strong{ font-weight:600; }
/* Browser autofill paints fields gray; keep them white. */
.bk-form input:-webkit-autofill{ -webkit-box-shadow:0 0 0 40px #fff inset; -webkit-text-fill-color:var(--ink); }
.bk-from{ display:inline-block; margin-top:12px; padding:5px 12px; border-radius:999px; background:#eef6fc; color:var(--blued);
  font-size:13px; font-weight:700; }
.bk-price{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-radius:10px;
  border:1px dashed #cfd7e0; background:#f9fbfc; font-size:14px; color:var(--ink2); }
.bk-price[data-on="1"]{ border:1px solid #b9d9ee; border-style:solid; background:#eef6fc; color:var(--ink); }
.bk-price em{ display:block; font-style:normal; font-size:12.5px; color:var(--faint); margin-top:2px; }
.bk-price strong{ font-family:"Sora","Inter",sans-serif; font-size:24px; color:var(--blued); }
.bk-tagp{ color:var(--blued) !important; background:#eef6fc !important; font-size:13px !important; }
.bk-line{ display:flex; justify-content:space-between; gap:12px; font-size:14.5px; color:var(--ink2); padding:5px 0; }
.bk-line span:last-child{ font-weight:600; color:var(--ink); white-space:nowrap; }
.bk-incl2 span:last-child{ color:var(--ok); }
.bk-total{ border-top:1px solid var(--line); margin-top:6px; padding-top:10px; font-weight:700; color:var(--ink); font-size:15.5px; }
.bk-total span:last-child{ font-size:18px; color:var(--blued); }
.bk-bill .bk-muted{ margin-top:8px !important; }
.bk-est{ margin-top:14px; padding-top:12px; border-top:1px solid var(--line); }
.bk-est .bk-line{ font-size:13px; padding:3px 0; }
.bk-est .bk-total{ font-size:14px; }
.bk-est .bk-total span:last-child{ font-size:16px; }
.bk-adds{ display:grid; gap:12px; }
.bk-add{ display:flex; align-items:flex-start; gap:14px; width:100%; text-align:left; padding:18px 20px; background:#fff;
  border:1.5px solid var(--line); border-radius:12px; font:inherit; color:var(--ink); cursor:pointer; }
.bk-add[data-on="1"]{ border-color:var(--blue); background:#f5fafe; }
.bk-add strong{ display:block; font-size:16px; font-weight:600; }
.bk-add em{ display:block; font-style:normal; font-size:14px; color:var(--ink2); margin-top:3px; line-height:1.5; }
.bk-add > div{ flex:1; }
.bk-box{ flex-shrink:0; width:22px; height:22px; margin-top:1px; border-radius:6px; border:1.5px solid #bfc9d4; display:grid; place-items:center;
  font-size:13px; font-weight:800; color:transparent; }
.bk-box[data-on="1"]{ background:var(--blue); border-color:var(--blue); color:#fff; }
.bk-incl{ cursor:default; background:#f7fbf9; border-color:#cfe6db; }
.bk-incl .bk-box{ background:var(--ok); border-color:var(--ok); }
.bk-tag{ flex-shrink:0; align-self:center; font-size:12px; font-weight:700; color:var(--ok); background:#e3f3ec; padding:4px 10px; border-radius:999px; }

.bk-days{ display:flex; flex-wrap:wrap; gap:8px; }
.bk-days button{ flex:0 0 auto; width:64px; padding:10px 0; border:1px solid #cfd7e0; border-radius:10px; background:#fff;
  font:inherit; color:var(--ink); cursor:pointer; text-align:center; }
.bk-days em{ display:block; font-style:normal; font-size:11px; color:var(--faint); text-transform:uppercase; letter-spacing:.6px; }
.bk-days strong{ display:block; font-size:20px; font-weight:700; line-height:1.35; }
.bk-days i{ display:block; font-style:normal; font-size:11px; color:var(--faint); }
.bk-days button[data-on="1"]{ border-color:var(--navy); background:var(--navy); color:#fff; }
.bk-days button[data-on="1"] em, .bk-days button[data-on="1"] i{ color:rgba(255,255,255,.7); }

.bk-slots{ display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:8px; }
.bk-slots[data-loading="1"]{ opacity:.5; }
.bk-slots button{ padding:12px 6px; border:1px solid #cfd7e0; border-radius:8px; background:#fff; font:inherit; font-size:14px;
  font-weight:600; color:var(--ink); cursor:pointer; }
.bk-slots button:hover:not(:disabled):not([data-on="1"]){ border-color:var(--blue); color:var(--blued); }
.bk-slots button[data-on="1"]{ background:var(--blue); border-color:var(--blue); color:#fff; }
.bk-slots button:disabled{ background:#f3f5f8; color:#b7c0ca; text-decoration:line-through; cursor:not-allowed; }

.bk-check{ display:flex !important; gap:11px; align-items:flex-start; padding:14px; border-radius:10px; border:1px solid var(--line);
  background:#f9fbfc; cursor:pointer; }
.bk-check input{ width:18px; height:18px; margin-top:2px; accent-color:var(--blue); flex-shrink:0; }
.bk-check > span{ margin:0 !important; font-size:14px; line-height:1.5; }
.bk-check em{ display:block; font-style:normal; font-size:12px; color:var(--faint); margin-top:4px; }

.bk-review{ display:grid; gap:12px; }
.bk-review section{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:16px 20px; }
.bk-review header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.bk-review h2{ margin:0; font-size:12px; letter-spacing:1.6px; text-transform:uppercase; color:var(--faint); font-weight:700; }
.bk-review header button, .bk-link{ border:0; background:none; padding:0; font:inherit; font-size:14px; font-weight:600; color:var(--blue); cursor:pointer; }
.bk-review p{ margin:3px 0 0; font-size:15px; color:var(--ink2); line-height:1.5; }
.bk-review p strong{ color:var(--ink); font-weight:600; }
.bk-muted{ color:var(--faint) !important; font-size:14px !important; }

.bk-hint{ font-size:13.5px; color:var(--faint); }
.bk-err{ margin-top:16px; padding:12px 14px; border-radius:9px; font-size:14px; border:1px solid #f3c2bd; background:#fdf1ef; color:#b3362a; }

.bk-nav{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:22px; }
.bk-navr{ display:flex; align-items:center; gap:14px; margin-left:auto; }
.bk-why{ font-size:13px; color:var(--faint); text-align:right; }
.bk-ghost{ padding:13px 18px; border:1px solid #cfd7e0; border-radius:9px; background:#fff; color:var(--ink2); font:inherit;
  font-size:15px; font-weight:600; cursor:pointer; text-decoration:none; white-space:nowrap; }
.bk-go{ display:inline-block; padding:13px 28px; border:0; border-radius:9px; background:var(--blue); color:#fff; font:inherit;
  font-size:15.5px; font-weight:650; cursor:pointer; text-decoration:none; white-space:nowrap; transition:background .15s; }
.bk-go:hover:not(:disabled){ background:var(--blued); }
.bk-go:disabled{ background:#a9cfe6; cursor:not-allowed; }

.bk-aside{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:18px 20px; position:sticky; top:20px; }
.bk-aside h3{ display:flex; align-items:center; gap:8px; margin:0 0 10px; font-size:15px; font-weight:600; }
.bk-aside h3 svg{ width:18px; height:18px; fill:none; stroke:var(--ink2); stroke-width:1.7; stroke-linecap:round; }
.bk-aside ul{ margin:0; padding-left:20px; display:grid; gap:5px; font-size:14px; color:var(--ink2); }
.bk-aside p{ margin:12px 0 0; font-size:13px; color:var(--faint); line-height:1.55; }

.bk-done{ max-width:560px; margin:10px auto 0; text-align:center; background:#fff; border:1px solid var(--line); border-radius:14px;
  padding:44px 30px; box-shadow:0 14px 34px -28px rgba(13,31,51,.5); }
.bk-tick{ width:62px; height:62px; margin:0 auto 18px; border-radius:50%; display:grid; place-items:center; background:#e3f3ec;
  color:var(--ok); font-size:28px; font-weight:700; }
.bk-done h1{ margin:0 0 10px; font-family:"Sora","Inter",sans-serif; font-size:28px; font-weight:700; }
.bk-done p{ margin:0 auto 14px; font-size:15.5px; line-height:1.7; color:var(--ink2); }
.bk-small{ font-size:14px !important; color:var(--faint) !important; }
.bk-small a{ color:var(--blue); }

.bk-foot{ padding:22px; text-align:center; font-size:12.5px; color:var(--faint); border-top:1px solid var(--line); background:#fff;
  padding-bottom:calc(22px + env(safe-area-inset-bottom,0px)); }

.bk :focus-visible{ outline:2px solid var(--blue); outline-offset:2px; }

@media (max-width:980px){
  .bk-steps ol{ display:none; }
  .bk-mstep{ display:grid; grid-template-columns:auto 1fr; align-items:baseline; gap:4px 10px; padding:12px 20px 14px; max-width:1060px; margin:0 auto; }
  .bk-mstep span{ font-size:12.5px; color:var(--faint); font-weight:600; }
  .bk-mstep strong{ font-size:14.5px; color:var(--navy); }
  .bk-mbar{ grid-column:1 / -1; height:4px; border-radius:4px; background:#e9edf2; overflow:hidden; margin-top:6px; }
  .bk-mbar b{ display:block; height:100%; background:var(--blue); border-radius:4px; transition:width .25s; }
  .bk-grid{ grid-template-columns:minmax(0,1fr); gap:20px; }
  .bk-aside{ position:static; }
}
@media (max-width:620px){
  .bk-bar{ padding:10px 16px; padding-top:calc(10px + env(safe-area-inset-top,0px)); }
  .bk-home img{ height:46px; }
  .bk-call .bk-need{ display:none; }
  .bk-call{ font-size:14px; }
  .bk-wrap{ padding:24px 16px 48px; }
  .bk-title{ font-size:25px; }
  .bk-sub{ font-size:14.5px; margin-bottom:20px; }
  .bk-types{ grid-template-columns:1fr; gap:10px; }
  .bk-types button{ display:grid; grid-template-columns:48px 1fr; column-gap:14px; text-align:left; padding:16px 44px 16px 16px; align-items:center; }
  .bk-types button:hover{ transform:none; }
  .bk-quote{ grid-template-columns:1fr; margin:16px; gap:16px; }
  .bk-tiers{ margin:0 16px 16px; }
  .bk-from{ grid-column:2; justify-self:start; margin-top:8px; font-size:12px; }
  .bk-ico{ grid-row:1 / 4; width:48px; height:48px; margin:0; align-self:center; }
  .bk-ico svg{ width:24px; height:24px; }
  .bk-types strong{ font-size:17px; margin:0 0 2px; }
  .bk-types em{ font-size:13.5px; }
  .bk-types button[data-on="1"]::after{ top:50%; margin-top:-12px; }
  .bk-two{ grid-template-columns:1fr; }
  .bk-three{ grid-template-columns:1fr 1fr; }
  .bk-three label:first-child{ grid-column:1 / -1; }
  .bk-card > .bk-form, .bk-card > .bk-days, .bk-card > .bk-slots, .bk-card > .bk-hint{ margin:16px; }
  .bk-card > .bk-days{ margin-bottom:0; }
  .bk-slots{ grid-template-columns:repeat(3,minmax(0,1fr)); }
  .bk-days{ flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
  .bk-days::-webkit-scrollbar{ display:none; }
  .bk-nav{ flex-wrap:wrap; }
  .bk-navr{ width:100%; flex-direction:column-reverse; align-items:stretch; gap:8px; margin:0; order:-1; }
  .bk-why{ text-align:center; }
  .bk-go{ width:100%; text-align:center; padding:15px; }
  .bk-ghost{ width:100%; text-align:center; }
  .bk-foot{ font-size:11.5px; }
}
@media (pointer:coarse){
  .bk-form input, .bk-form textarea{ font-size:16px; }
  .bk-go, .bk-ghost, .bk-slots button{ min-height:48px; }
}
`;
