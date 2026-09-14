"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import UserMenu from "@/components/UserMenu";
import Intake, { type IntakePrefill } from "@/components/Intake";
import { createClient } from "@/lib/supabase-browser";

type Appt = {
  id: string;
  client_name: string; phone: string; email: string; address: string;
  service: string; services: string[] | null; fee: number; paid: boolean;
  starts_at: string; duration_min: number;
  status: "scheduled" | "completed" | "canceled" | "rescheduled";
  confirmation_sent_at?: string | null;
  notes: string;
};

const SERVICES = [
  "Full home inspection",
  "Re-inspection",
  "Sewer scope",
  "Radon test",
  "Mold / air quality",
  "Four-point inspection",
  "Wind mitigation",
  "Walk-through consultation",
];

/* Up to three jobs can be booked in one visit. Older rows only have the single
   `service` column, so fall back to it. */
const MAX_SERVICES = 3;
function serviceList(a: Partial<Appt>): string[] {
  if (a.services && a.services.length) return a.services;
  return a.service ? [a.service] : [];
}
const serviceText = (a: Partial<Appt>) => serviceList(a).join(" + ") || "No service set";

/* One place decides what a booking looks like, so the calendar, the day panel
   and the summary can never drift apart. */
const STATUS_TONE: Record<string, string> = {
  scheduled:   "#c0813a",
  completed:   "#2f9d6b",
  canceled:    "#d14343",
  rescheduled: "#5aa9e6",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled:   "Scheduled",
  completed:   "Completed",
  canceled:    "Canceled",
  rescheduled: "Rescheduled",
};
const tone = (a: Partial<Appt>) => STATUS_TONE[a.status || "scheduled"] || STATUS_TONE.scheduled;

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/* Local-time helpers. Appointments are stored as timestamptz; everything shown
   here is the inspector's own clock, so conversions stay local deliberately. */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function SchedulePage() {
  return <AuthGate><Schedule /></AuthGate>;
}

function Schedule() {
  const sb = createClient();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<Partial<Appt> | null>(null);
  const [viewing, setViewing] = useState<Appt | null>(null);
  const [starting, setStarting] = useState<Appt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const from = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1).toISOString();
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 1).toISOString();
    const { data } = await sb.from("appointments").select("*")
      .gte("starts_at", from).lt("starts_at", to).order("starts_at", { ascending: true });
    setAppts((data as Appt[]) || []);
    setLoading(false);
  }, [cursor]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m: Record<string, Appt[]> = {};
    appts.forEach(a => { const k = ymd(new Date(a.starts_at)); (m[k] ||= []).push(a); });
    return m;
  }, [appts]);

  // Calendar grid: whole weeks, Sunday-first, with neighbouring days greyed.
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const now = new Date();
  const upcoming = appts
    .filter(a => new Date(a.starts_at) >= now && a.status === "scheduled")
    .slice(0, 6);

  const monthAppts = appts.filter(a => {
    const d = new Date(a.starts_at);
    return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear() && a.status !== "canceled";
  });
  const booked = monthAppts.reduce((s, a) => s + Number(a.fee || 0), 0);
  const collected = monthAppts.filter(a => a.paid).reduce((s, a) => s + Number(a.fee || 0), 0);

  async function save(a: Partial<Appt>) {
    const { data: { user } } = await sb.auth.getUser();
    const row = {
      client_name: a.client_name || "", phone: a.phone || "", email: a.email || "",
      address: a.address || "",
      services: serviceList(a),
      service: serviceList(a)[0] || SERVICES[0],
      fee: Number(a.fee || 0), paid: !!a.paid,
      starts_at: a.starts_at, duration_min: Number(a.duration_min || 180),
      status: a.status || "scheduled", notes: a.notes || "",
    };
    if (a.id) await sb.from("appointments").update(row).eq("id", a.id);
    else await sb.from("appointments").insert({ ...row, owner: user!.id });
    setEditing(null); setViewing(null); load();
  }
  async function setStatus(a: Appt, status: Appt["status"]) {
    await sb.from("appointments").update({ status }).eq("id", a.id);
    setViewing({ ...a, status });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this appointment?")) return;
    await sb.from("appointments").delete().eq("id", id);
    setEditing(null); setViewing(null); load();
  }

  function newAt(day: Date) {
    const d = new Date(day); d.setHours(9, 0, 0, 0);
    setEditing({ starts_at: d.toISOString(), services: [SERVICES[0]], duration_min: 180, fee: 0, status: "scheduled" });
  }

  const selKey = ymd(selected);
  const selList = byDay[selKey] || [];
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="ps-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{SCHED_CSS}</style>

      <header className="ps-bar">
        <div className="ps-wrap ps-bar-in">
          <Link href="/"><img className="ps-logo" src="/logo-ondark.svg" alt="ProSight Property Inspections" /></Link>
          <div className="ps-rule" />
          <Link href="/" className="ps-navlink">Reports</Link>
          <Link href="/schedule" className="ps-navlink" data-on="1">Schedule</Link>
          <div style={{ flex: 1 }} />
          <button className="ps-chip" onClick={() => newAt(selected)}>New appointment</button>
          <UserMenu dark />
        </div>
      </header>

      <div className="ps-wrap" style={{ paddingBottom: 90 }}>
        <div className="ps-head">
          <div>
            <h1 className="ps-title">Schedule</h1>
            <p className="ps-sub">Bookings, who they're for, what was requested and what it's worth.</p>
          </div>
          <div className="ps-monthnav">
            <button className="ps-chip" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
            <div className="ps-month">{monthLabel}</div>
            <button className="ps-chip" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Next month">›</button>
            <button className="ps-chip" onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(t); }}>Today</button>
          </div>
        </div>

        <div className="ps-overview">
          <div className="ps-cell">
            <div className="ps-cell-l">Booked this month</div>
            <div className="ps-cell-v">{monthAppts.length}</div>
          </div>
          <div className="ps-cell">
            <div className="ps-cell-l">Scheduled value</div>
            <div className="ps-cell-v">{money(booked)}</div>
          </div>
          <div className="ps-cell">
            <div className="ps-cell-l">Collected</div>
            <div className="ps-cell-v" style={{ color: "var(--ps-green)" }}>{money(collected)}</div>
          </div>
          <div className="ps-cell">
            <div className="ps-cell-l">Outstanding</div>
            <div className="ps-cell-v" style={{ color: booked - collected > 0 ? "var(--ps-amber)" : "inherit" }}>{money(booked - collected)}</div>
          </div>
        </div>

        <div className="ps-cols">
          <div className="ps-cal">
            <div className="ps-dow">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="ps-legend">
              {(["scheduled","completed","rescheduled","canceled"] as const).map(k => (
                <span key={k}><i style={{ background: STATUS_TONE[k] }} />{STATUS_LABEL[k]}</span>
              ))}
            </div>
            <div className="ps-grid">
              {grid.map((d, i) => {
                const list = byDay[ymd(d)] || [];
                const out = d.getMonth() !== cursor.getMonth();
                return (
                  <button key={i} className="ps-day" data-out={out ? "1" : "0"}
                    data-sel={sameDay(d, selected) ? "1" : "0"} data-today={sameDay(d, now) ? "1" : "0"}
                    onClick={() => setSelected(new Date(d))} onDoubleClick={() => newAt(d)}>
                    <span className="ps-daynum">{d.getDate()}</span>
                    <span className="ps-dots">
                      {list.slice(0, 3).map(a => (
                        <i key={a.id} style={{ background: tone(a) }} />
                      ))}
                      {list.length > 3 && <em>+{list.length - 3}</em>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="ps-side">
            <div className="ps-panel">
              <div className="ps-panel-h">
                <span>{selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                <button className="ps-chip" onClick={() => newAt(selected)}>Add</button>
              </div>
              {selList.length === 0 ? (
                <div className="ps-none">Nothing booked. Add an appointment for this day.</div>
              ) : selList.map(a => (
                <button key={a.id} className="ps-appt" data-off={a.status === "canceled" ? "1" : "0"} onClick={() => setViewing(a)}>
                  <span className="ps-rail2" style={{ background: tone(a) }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="ps-appt-t">{fmtTime(a.starts_at)} · {a.client_name || "No name"}</span>
                    <span className="ps-appt-s">{serviceText(a)}{a.address ? ` · ${a.address}` : ""}</span>
                  </span>
                  <span className="ps-fee">{money(Number(a.fee || 0))}</span>
                </button>
              ))}
            </div>

            <div className="ps-panel">
              <div className="ps-panel-h"><span>Upcoming</span></div>
              {loading ? <div className="ps-none">Loading…</div>
                : upcoming.length === 0 ? <div className="ps-none">Nothing on the books yet.</div>
                : upcoming.map(a => (
                  <button key={a.id} className="ps-appt" onClick={() => { setSelected(new Date(a.starts_at)); setViewing(a); }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="ps-appt-t">{new Date(a.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtTime(a.starts_at)}</span>
                      <span className="ps-appt-s">{a.client_name || "No name"} · {serviceText(a)}</span>
                    </span>
                    <span className="ps-fee">{money(Number(a.fee || 0))}</span>
                  </button>
                ))}
            </div>
          </aside>
        </div>
      </div>

      {viewing && !editing && (
        <ApptSummary
          a={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => setEditing(viewing)}
          onStatus={st => setStatus(viewing, st)}
          onReschedule={() => { setEditing({ ...viewing, status: "rescheduled" }); }}
          onStart={() => setStarting(viewing)}
          onRefresh={load}
          onDelete={() => remove(viewing.id)}
        />
      )}
      {editing && <ApptModal value={editing} onCancel={() => setEditing(null)} onSave={save} onDelete={remove} />}

      {starting && (
        <Intake
          appointmentId={starting.id}
          prefill={{
            client: starting.client_name,
            addr: starting.address,
            date: ymd(new Date(starting.starts_at)),
            time: new Date(starting.starts_at).toTimeString().slice(0, 5),
          } as IntakePrefill}
          onClose={() => setStarting(null)}
        />
      )}
    </div>
  );
}

function ApptModal({ value, onCancel, onSave, onDelete }: {
  value: Partial<Appt>;
  onCancel: () => void;
  onSave: (a: Partial<Appt>) => void;
  onDelete: (id: string) => void;
}) {
  const [a, setA] = useState<Partial<Appt>>(value);
  const set = (p: Partial<Appt>) => setA(prev => ({ ...prev, ...p }));

  return (
    <div className="ps-modal" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="ps-sheet">
        <div className="ps-sheet-h">
          <h2>{a.id ? "Edit appointment" : "New appointment"}</h2>
          <button className="ps-x" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        <div className="ps-form">
          <label className="ps-f"><span>Client name</span>
            <input value={a.client_name || ""} onChange={e => set({ client_name: e.target.value })} placeholder="Seth Anderson" /></label>
          <label className="ps-f"><span>Phone</span>
            <input value={a.phone || ""} onChange={e => set({ phone: e.target.value })} placeholder="(313) 555-0142" /></label>
          <label className="ps-f"><span>Email</span>
            <input value={a.email || ""} onChange={e => set({ email: e.target.value })} placeholder="seth@example.com" /></label>
          <label className="ps-f ps-wide"><span>Property address</span>
            <input value={a.address || ""} onChange={e => set({ address: e.target.value })} placeholder="2799 Amazon St, Dearborn, MI 48120" /></label>

          <div className="ps-f ps-wide">
            <span>Services requested <em className="ps-hint">pick up to {MAX_SERVICES}</em></span>
            <div className="ps-svc">
              {SERVICES.map(name => {
                const picked = serviceList(a);
                const on = picked.includes(name);
                const full = picked.length >= MAX_SERVICES && !on;
                return (
                  <button key={name} type="button" data-on={on ? "1" : "0"} disabled={full}
                    onClick={() => set({ services: on ? picked.filter(x => x !== name) : [...picked, name] })}>
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="ps-f"><span>Total fee</span>
            <input type="number" min="0" step="5" value={String(a.fee ?? 0)} onChange={e => set({ fee: Number(e.target.value) })} /></label>
          <div className="ps-f"><span>Booked</span>
            <div className="ps-svc-sum">{serviceText(a)}</div></div>

          <div className="ps-f ps-wide"><span>When</span>
            <WhenPicker
              value={a.starts_at ? new Date(a.starts_at) : new Date()}
              duration={a.duration_min ?? 180}
              onChange={(d, dur) => set({ starts_at: d.toISOString(), duration_min: dur })}
            />
          </div>

          <label className="ps-f"><span>Status</span>
            <select value={a.status || "scheduled"} onChange={e => set({ status: e.target.value as Appt["status"] })}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="canceled">Canceled</option>
            </select></label>
          <label className="ps-f ps-check">
            <input type="checkbox" checked={!!a.paid} onChange={e => set({ paid: e.target.checked })} />
            <span>Paid in full</span></label>

          <label className="ps-f ps-wide"><span>Notes</span>
            <textarea rows={3} value={a.notes || ""} onChange={e => set({ notes: e.target.value })}
              placeholder="Gate code, dog on site, agent meeting you there…" /></label>
        </div>

        <div className="ps-sheet-f">
          {a.id ? <button className="ps-danger" onClick={() => onDelete(a.id!)}>Delete</button> : <span />}
          <div style={{ flex: 1 }} />
          <button className="ps-chip" onClick={onCancel}>Cancel</button>
          <button className="ps-action" disabled={!a.starts_at} onClick={() => onSave(a)}>
            {a.id ? "Save changes" : "Add to schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* The browser's own datetime control cannot be styled and looks nothing like
   the rest of the app, so day, time and duration are picked here instead —
   which also suits booking, where times land on the half hour. */
function WhenPicker({ value, duration, onChange }: {
  value: Date; duration: number; onChange: (d: Date, dur: number) => void;
}) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);

  const slots = useMemo(() => {
    const out: { h: number; m: number }[] = [];
    for (let h = 7; h <= 19; h++) { out.push({ h, m: 0 }); if (h !== 19) out.push({ h, m: 30 }); }
    return out;
  }, []);

  const today = new Date();

  function pickDay(d: Date) {
    const next = new Date(d);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(next, duration);
  }
  function pickTime(h: number, m: number) {
    const next = new Date(value);
    next.setHours(h, m, 0, 0);
    onChange(next, duration);
  }

  const DURATIONS = [
    { v: 60, l: "1 hr" }, { v: 90, l: "1½ hr" }, { v: 120, l: "2 hr" },
    { v: 150, l: "2½ hr" }, { v: 180, l: "3 hr" }, { v: 240, l: "4 hr" },
  ];
  const ends = new Date(value.getTime() + duration * 60000);

  return (
    <div className="wp">
      <div className="wp-top">
        <div className="wp-cal">
          <div className="wp-nav">
            <button type="button" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
            <span>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <button type="button" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Next month">›</button>
          </div>
          <div className="wp-dow">{["S","M","T","W","T","F","S"].map((d,i) => <span key={i}>{d}</span>)}</div>
          <div className="wp-days">
            {days.map((d, i) => (
              <button key={i} type="button"
                data-out={d.getMonth() !== month.getMonth() ? "1" : "0"}
                data-on={sameDay(d, value) ? "1" : "0"}
                data-today={sameDay(d, today) ? "1" : "0"}
                onClick={() => pickDay(d)}>{d.getDate()}</button>
            ))}
          </div>
        </div>

        <div className="wp-times">
          <div className="wp-times-h">Start time</div>
          <div className="wp-slots">
            {slots.map(({ h, m }) => {
              const on = value.getHours() === h && value.getMinutes() === m;
              const label = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
              return <button key={`${h}-${m}`} type="button" data-on={on ? "1" : "0"} onClick={() => pickTime(h, m)}>{label}</button>;
            })}
          </div>
        </div>
      </div>

      <div className="wp-dur">
        <span className="wp-dur-l">Duration</span>
        {DURATIONS.map(d => (
          <button key={d.v} type="button" data-on={duration === d.v ? "1" : "0"} onClick={() => onChange(value, d.v)}>{d.l}</button>
        ))}
      </div>

      <div className="wp-sum">
        {value.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} ·{" "}
        {fmtTime(value.toISOString())} to {fmtTime(ends.toISOString())}
      </div>
    </div>
  );
}


/* Opening a booking shows what it is before it shows a form — most of the time
   the question is "what am I doing Tuesday", not "let me retype this". */
function ConfirmText({ a, onSent }: { a: Appt; onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const sent = !!a.confirmation_sent_at;

  async function send() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/sms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: a.id }),
      });
      const raw = await res.text();
      let j: any = {};
      try { j = JSON.parse(raw); } catch { j = { error: `Server error ${res.status}` }; }
      if (j.ok) { setMsg(`Sent to ${j.to}`); onSent(); }
      else setMsg(j.error || "Could not send.");
    } catch (e: any) { setMsg(e?.message || "Could not send."); }
    setBusy(false);
  }

  return (
    <div className="sm-sms">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sm-sms-t">Confirmation text</div>
        <div className="sm-sms-s">
          {msg ? msg
            : sent ? `Sent ${new Date(a.confirmation_sent_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : a.phone ? "Texts the client the date, time and address."
            : "No phone number saved for this client."}
        </div>
      </div>
      <button className="ps-chip" disabled={busy || !a.phone} onClick={send}>
        {busy ? "Sending…" : sent ? "Send again" : "Send text"}
      </button>
    </div>
  );
}

function ApptSummary({ a, onClose, onEdit, onStatus, onReschedule, onStart, onDelete, onRefresh }: {
  a: Appt;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (s: Appt["status"]) => void;
  onReschedule: () => void;
  onStart: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const start = new Date(a.starts_at);
  const end = new Date(start.getTime() + (a.duration_min || 0) * 60000);
  const services = serviceList(a);
  const c = STATUS_TONE[a.status] || STATUS_TONE.scheduled;
  const statusLabel = STATUS_LABEL[a.status] || "Scheduled";

  const Row = ({ l, children }: { l: string; children: React.ReactNode }) => (
    <div className="sm-row"><span className="sm-l">{l}</span><span className="sm-v">{children}</span></div>
  );

  return (
    <div className="ps-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ps-sheet" style={{ maxWidth: 520 }}>
        <div className="ps-sheet-h">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.client_name || "No name"}</h2>
            <div className="sm-when">
              {start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {fmtTime(a.starts_at)} to {fmtTime(end.toISOString())}
            </div>
          </div>
          <button className="ps-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="sm-body">
          <div className="sm-strip">
            <span className="sm-badge" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>{statusLabel}</span>
            <span className="sm-fee">{money(Number(a.fee || 0))}</span>
            <span className="sm-paid" style={{ color: a.paid ? "var(--ps-green)" : "var(--ps-amber)" }}>
              {a.paid ? "Paid in full" : "Payment outstanding"}
            </span>
          </div>

          {services.length > 0 && (
            <Row l="Services">
              <span className="sm-tags">{services.map(x => <em key={x}>{x}</em>)}</span>
            </Row>
          )}
          {a.address && <Row l="Property">{a.address}</Row>}
          {a.phone && <Row l="Phone"><a href={`tel:${a.phone.replace(/[^0-9+]/g, "")}`}>{a.phone}</a></Row>}
          {a.email && <Row l="Email"><a href={`mailto:${a.email}`}>{a.email}</a></Row>}
          <Row l="Duration">{Math.floor((a.duration_min || 0) / 60)} hr{(a.duration_min || 0) % 60 ? ` ${(a.duration_min || 0) % 60} min` : ""}</Row>
          {a.notes && <Row l="Notes"><span style={{ whiteSpace: "pre-wrap" }}>{a.notes}</span></Row>}
          <ConfirmText a={a} onSent={onRefresh} />
        </div>

        <div style={{ padding: "0 22px 14px" }}>
          <button className="sm-start" onClick={onStart}>
            Start inspection
            <span>Creates a report with this client, address and date already filled in</span>
          </button>
        </div>

        <div className="sm-actions">
          {(["completed","canceled","rescheduled"] as Appt["status"][]).map(st => (
            <button key={st} className="sm-act" data-on={a.status === st ? "1" : "0"}
              style={a.status === st ? { background: STATUS_TONE[st], borderColor: STATUS_TONE[st], color: "#fff" } : undefined}
              onClick={() => st === "rescheduled" ? onReschedule() : onStatus(st)}>
              {STATUS_LABEL[st]}
            </button>
          ))}
        </div>

        <div className="ps-sheet-f">
          <button className="ps-danger" onClick={onDelete}>Delete</button>
          <div style={{ flex: 1 }} />
          <button className="ps-chip" onClick={onClose}>Close</button>
          <button className="ps-action" onClick={onEdit}>Edit details</button>
        </div>
      </div>
    </div>
  );
}

const SCHED_CSS = `
.ps-root{
  --ps-paper:#070d16; --ps-panel:#0f1a2a; --ps-panel-2:#132234; --ps-navy:#45b0ee;
  --ps-blue:#45b0ee; --ps-amber:#f0b429; --ps-green:#3fd39b;
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
.ps-navlink{ font-size:13.5px; color:var(--ps-ink-2); text-decoration:none; padding:8px 2px; position:relative; }
.ps-navlink:hover{ color:var(--ps-ink); }
.ps-navlink[data-on="1"]{ color:var(--ps-ink); font-weight:600; }
.ps-navlink[data-on="1"]::after{ content:""; position:absolute; left:0; right:0; bottom:0; height:2px;
  border-radius:2px; background:linear-gradient(90deg,var(--ps-blue),transparent); }

.ps-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:22px; flex-wrap:wrap; padding:42px 0 24px; }
.ps-title{ font-family:var(--ps-serif); font-size:34px; font-weight:600; letter-spacing:-.9px; margin:0; line-height:1.06; }
.ps-sub{ margin:8px 0 0; font-size:14px; color:var(--ps-ink-2); max-width:48ch; }
.ps-monthnav{ display:flex; align-items:center; gap:8px; }
.ps-month{ font-family:var(--ps-serif); font-size:17px; font-weight:600; min-width:10ch; text-align:center; }

.ps-action{ border:0; cursor:pointer; border-radius:11px; padding:11px 20px; font:inherit; font-size:13.5px;
  font-weight:600; color:#fff; background:linear-gradient(150deg,#1a6fa9,#134d78);
  box-shadow:inset 0 1px 0 rgba(234,242,250,.14); }
.ps-action:hover{ background:linear-gradient(150deg,#2183c4,#175a8c); }
.ps-action:disabled{ opacity:.5; cursor:not-allowed; }
.ps-chip{ padding:9px 14px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; border-radius:9px;
  border:1px solid var(--ps-line); background:var(--ps-panel); color:var(--ps-ink-2); }
.ps-chip:hover{ border-color:#2a4767; color:var(--ps-ink); }

.ps-overview{ border:1px solid var(--ps-line); border-radius:16px; display:grid;
  grid-template-columns:repeat(4,1fr); overflow:hidden; margin-bottom:22px;
  background:linear-gradient(160deg,rgba(19,34,52,.9),rgba(11,20,33,.9)); }
.ps-cell{ padding:20px 22px; border-left:1px solid var(--ps-line); }
.ps-cell:first-child{ border-left:0; }
.ps-cell-l{ font-size:11.5px; color:var(--ps-faint); }
.ps-cell-v{ font-family:var(--ps-serif); font-size:29px; font-weight:600; line-height:1.15; margin-top:4px; }

.ps-cols{ display:grid; grid-template-columns:1fr 348px; gap:18px; align-items:start; }
.ps-cal{ border:1px solid var(--ps-line); border-radius:16px; overflow:hidden;
  background:linear-gradient(160deg,rgba(19,34,52,.55),rgba(11,20,33,.55)); }
.ps-dow{ display:grid; grid-template-columns:repeat(7,1fr); border-bottom:1px solid var(--ps-line); }
.ps-dow div{ padding:11px 0; text-align:center; font-size:11px; color:var(--ps-faint); font-weight:600; letter-spacing:.4px; }
.ps-legend{ display:flex; gap:15px; flex-wrap:wrap; padding:10px 16px; border-bottom:1px solid var(--ps-line-soft); }
.ps-legend span{ display:flex; align-items:center; gap:6px; font-size:11px; color:var(--ps-ink-2); }
.ps-legend i{ width:16px; height:4px; border-radius:2px; }
.ps-grid{ display:grid; grid-template-columns:repeat(7,1fr); }
.ps-day{ min-height:92px; border:0; border-right:1px solid var(--ps-line-soft); border-bottom:1px solid var(--ps-line-soft);
  background:transparent; cursor:pointer; text-align:left; padding:9px 10px; font:inherit;
  display:flex; flex-direction:column; gap:6px; transition:background .14s; }
.ps-day:nth-child(7n){ border-right:0; }
.ps-day:hover{ background:rgba(69,176,238,.06); }
.ps-daynum{ font-size:12.5px; color:var(--ps-ink-2); font-weight:600; }
.ps-day[data-out="1"] .ps-daynum{ color:#3c4f66; }
.ps-day[data-sel="1"]{ background:rgba(69,176,238,.10); box-shadow:inset 0 0 0 1px rgba(69,176,238,.55); }
.ps-day[data-today="1"] .ps-daynum{ background:linear-gradient(150deg,#45b0ee,#1d6fa8); color:#fff;
  border-radius:50%; width:22px; height:22px; display:grid; place-items:center; }
.ps-dots{ display:flex; gap:3px; align-items:center; flex-wrap:wrap; }
.ps-dots i{ width:100%; height:4px; border-radius:2px; }
.ps-dots em{ font-size:10px; color:var(--ps-faint); font-style:normal; }

.ps-side{ display:flex; flex-direction:column; gap:14px; }
.ps-panel{ border:1px solid var(--ps-line); border-radius:14px; overflow:hidden;
  background:linear-gradient(160deg,rgba(19,34,52,.72),rgba(11,20,33,.72)); }
.ps-panel-h{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px;
  border-bottom:1px solid var(--ps-line-soft); font-size:13.5px; font-weight:650; }
.ps-none{ padding:22px 16px; font-size:13px; color:var(--ps-faint); }
.ps-appt{ width:100%; display:flex; align-items:center; gap:11px; padding:13px 16px; border:0;
  border-top:1px solid var(--ps-line-soft); background:transparent; cursor:pointer; text-align:left; font:inherit;
  color:var(--ps-ink); transition:background .14s; }
.ps-panel-h + .ps-appt{ border-top:0; }
.ps-appt:hover{ background:rgba(69,176,238,.06); }
.ps-appt[data-off="1"] .ps-appt-t{ text-decoration:line-through; color:var(--ps-faint); }
.ps-appt[data-off="1"] .ps-appt-s, .ps-appt[data-off="1"] .ps-fee{ color:var(--ps-faint); }
.ps-rail2{ width:3px; align-self:stretch; border-radius:2px; flex-shrink:0; }
.ps-appt-t{ display:block; font-size:13px; font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ps-appt-s{ display:block; font-size:12px; color:var(--ps-ink-2); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ps-fee{ font-size:12.5px; font-weight:650; color:var(--ps-ink-2); white-space:nowrap; }

.ps-modal{ position:fixed; inset:0; background:rgba(4,8,14,.72); backdrop-filter:blur(5px);
  z-index:60; display:grid; place-items:center; padding:22px; }
.ps-sheet{ width:100%; max-width:640px; max-height:90vh; overflow:auto; border:1px solid var(--ps-line);
  border-radius:16px; background:linear-gradient(160deg,#132234,#0b1421);
  box-shadow:0 30px 70px -20px rgba(0,0,0,.9); }
.ps-sheet-h{ display:flex; align-items:center; justify-content:space-between; padding:19px 22px;
  border-bottom:1px solid var(--ps-line); position:sticky; top:0;
  background:linear-gradient(160deg,#132234,#101d2e); }
.ps-sheet-h h2{ margin:0; font-family:var(--ps-serif); font-size:19px; font-weight:600; }
.ps-x{ border:0; background:transparent; font-size:15px; color:var(--ps-faint); cursor:pointer; }
.ps-x:hover{ color:var(--ps-ink); }
.ps-form{ padding:20px 22px; display:grid; grid-template-columns:1fr 1fr; gap:15px; }
.ps-f{ display:flex; flex-direction:column; gap:6px; font-size:12.5px; color:var(--ps-ink-2); font-weight:600; }
.ps-f input, .ps-f select, .ps-f textarea{ padding:10px 12px; border:1px solid var(--ps-line); border-radius:9px;
  font:inherit; font-size:13.5px; color:var(--ps-ink); background:var(--ps-panel); font-weight:400; }
.ps-f input:focus, .ps-f select:focus, .ps-f textarea:focus{ outline:none; border-color:var(--ps-blue);
  box-shadow:0 0 0 3px rgba(69,176,238,.14); }
.ps-f textarea{ resize:vertical; }
.ps-wide{ grid-column:1 / -1; }
.ps-check{ flex-direction:row; align-items:center; gap:9px; align-self:end; padding-bottom:10px; }
.ps-check input{ width:16px; height:16px; }
.ps-hint{ font-style:normal; font-weight:400; color:var(--ps-faint); font-size:11.5px; margin-left:6px; }
.ps-svc{ display:flex; flex-wrap:wrap; gap:6px; }
.ps-svc button{ padding:8px 13px; border:1px solid var(--ps-line); border-radius:9px; background:var(--ps-panel);
  font:inherit; font-size:12.5px; color:var(--ps-ink-2); cursor:pointer; }
.ps-svc button:hover:not(:disabled){ border-color:#2a4767; color:var(--ps-ink); }
.ps-svc button[data-on="1"]{ color:#fff; border-color:rgba(69,176,238,.55); font-weight:650;
  background:linear-gradient(150deg,rgba(69,176,238,.26),rgba(69,176,238,.08));
  box-shadow:0 0 18px -6px rgba(69,176,238,.7); }
.ps-svc button:disabled{ opacity:.35; cursor:not-allowed; }
.ps-svc-sum{ padding:10px 12px; border:1px solid var(--ps-line-soft); border-radius:9px;
  background:rgba(69,176,238,.06); font-size:13px; font-weight:400; color:var(--ps-ink-2); }
.ps-sheet-f{ display:flex; align-items:center; gap:10px; padding:17px 22px; border-top:1px solid var(--ps-line);
  position:sticky; bottom:0; background:linear-gradient(160deg,#111e2f,#0b1421); }
.ps-danger{ padding:9px 14px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; border-radius:9px;
  border:1px solid rgba(255,107,94,.35); background:rgba(255,107,94,.08); color:#ff8f85; }

.sm-when{ font-size:12.5px; color:var(--ps-ink-2); margin-top:3px; }
.sm-body{ padding:6px 22px 16px; }
.sm-strip{ display:flex; align-items:center; gap:13px; flex-wrap:wrap; padding:15px 0 4px; }
.sm-badge{ font-size:11.5px; font-weight:650; padding:5px 12px; border-radius:20px; }
.sm-fee{ font-family:var(--ps-serif); font-size:23px; font-weight:600; }
.sm-paid{ font-size:12px; font-weight:600; }
.sm-row{ display:flex; gap:14px; padding:12px 0; border-top:1px solid var(--ps-line-soft); font-size:13.5px; }
.sm-l{ width:84px; flex-shrink:0; color:var(--ps-faint); font-size:12.5px; font-weight:600; padding-top:1px; }
.sm-v{ flex:1; min-width:0; color:var(--ps-ink); }
.sm-v a{ color:var(--ps-blue); text-decoration:none; }
.sm-v a:hover{ text-decoration:underline; }
.sm-tags{ display:flex; flex-wrap:wrap; gap:6px; }
.sm-tags em{ font-style:normal; font-size:12px; font-weight:600; padding:4px 10px; border-radius:7px;
  background:rgba(69,176,238,.10); color:var(--ps-ink-2); }
.sm-actions{ display:grid; grid-template-columns:repeat(3,1fr); gap:9px; padding:4px 22px 18px; }
.sm-act{ padding:12px 8px; border-radius:10px; border:1px solid var(--ps-line); background:var(--ps-panel);
  font:inherit; font-size:13px; font-weight:600; color:var(--ps-ink-2); cursor:pointer; }
.sm-act:hover{ border-color:#2a4767; color:var(--ps-ink); }
.sm-sms{ display:flex; align-items:center; gap:12px; margin-top:15px; padding:13px 15px;
  border:1px solid var(--ps-line-soft); border-radius:11px; background:rgba(69,176,238,.06); }
.sm-sms-t{ font-size:12.5px; font-weight:650; color:var(--ps-ink); }
.sm-sms-s{ font-size:12px; color:var(--ps-ink-2); margin-top:2px; }

.wp{ border:1px solid var(--ps-line); border-radius:12px; overflow:hidden; background:var(--ps-panel); font-weight:400; }
.wp-top{ display:grid; grid-template-columns:1fr 176px; }
.wp-cal{ padding:13px 15px 15px; }
.wp-nav{ display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
.wp-nav span{ font-size:13px; font-weight:650; color:var(--ps-ink); }
.wp-nav button{ width:27px; height:27px; border:1px solid var(--ps-line); border-radius:8px;
  background:transparent; color:var(--ps-ink-2); cursor:pointer; font-size:14px; line-height:1; }
.wp-nav button:hover{ border-color:#2a4767; color:var(--ps-ink); }
.wp-dow{ display:grid; grid-template-columns:repeat(7,1fr); }
.wp-dow span{ text-align:center; font-size:10.5px; color:var(--ps-faint); font-weight:600; padding-bottom:5px; }
.wp-days{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.wp-days button{ aspect-ratio:1; border:0; border-radius:9px; background:transparent; font:inherit;
  font-size:12.5px; color:var(--ps-ink); cursor:pointer; }
.wp-days button:hover{ background:rgba(69,176,238,.10); }
.wp-days button[data-out="1"]{ color:#3c4f66; }
.wp-days button[data-today="1"]{ box-shadow:inset 0 0 0 1px var(--ps-line); }
.wp-days button[data-on="1"]{ background:linear-gradient(150deg,#45b0ee,#1d6fa8); color:#fff; font-weight:650; box-shadow:none; }
.wp-times{ border-left:1px solid var(--ps-line-soft); display:flex; flex-direction:column; min-height:0; }
.wp-times-h{ font-size:11.5px; color:var(--ps-faint); font-weight:600; padding:13px 13px 6px; }
.wp-slots{ display:grid; grid-template-columns:1fr 1fr; gap:5px; padding:0 13px 13px; overflow:auto; max-height:200px; }
.wp-slots button{ padding:7px 4px; border:1px solid var(--ps-line); border-radius:8px; background:transparent;
  font:inherit; font-size:11.5px; color:var(--ps-ink-2); cursor:pointer; white-space:nowrap; }
.wp-slots button:hover{ border-color:#2a4767; color:var(--ps-ink); }
.wp-slots button[data-on="1"]{ background:linear-gradient(150deg,#45b0ee,#1d6fa8); border-color:transparent;
  color:#fff; font-weight:650; }
.wp-dur{ display:flex; align-items:center; gap:7px; flex-wrap:wrap; padding:12px 15px; border-top:1px solid var(--ps-line-soft); }
.wp-dur-l{ font-size:11.5px; color:var(--ps-faint); font-weight:600; margin-right:2px; }
.wp-dur button{ padding:7px 12px; border:1px solid var(--ps-line); border-radius:8px; background:transparent;
  font:inherit; font-size:12px; color:var(--ps-ink-2); cursor:pointer; }
.wp-dur button:hover{ border-color:#2a4767; color:var(--ps-ink); }
.wp-dur button[data-on="1"]{ background:linear-gradient(150deg,#45b0ee,#1d6fa8); border-color:transparent;
  color:#fff; font-weight:650; }
.wp-sum{ padding:11px 15px; background:rgba(69,176,238,.06); border-top:1px solid var(--ps-line-soft);
  font-size:12.5px; color:var(--ps-ink-2); }

.sm-start{ width:100%; text-align:left; border:0; cursor:pointer; border-radius:12px; padding:14px 17px;
  font:inherit; color:#fff; background:linear-gradient(150deg,#1a6fa9,#134d78);
  box-shadow:inset 0 1px 0 rgba(234,242,250,.14); font-size:14.5px; font-weight:650; }
.sm-start:hover{ background:linear-gradient(150deg,#2183c4,#175a8c); }
.sm-start span{ display:block; font-size:11.5px; font-weight:400; color:rgba(234,242,250,.72); margin-top:3px; }

.ps-root :focus-visible{ outline:2px solid var(--ps-blue); outline-offset:2px; border-radius:8px; }
@media (max-width:900px){
  .ps-cols{ grid-template-columns:1fr; }
  .ps-overview{ grid-template-columns:1fr 1fr; }
  .ps-cell:nth-child(3){ border-left:0; }
  .ps-cell:nth-child(n+3){ border-top:1px solid var(--ps-line); }
  .ps-form{ grid-template-columns:1fr; }
  .ps-day{ min-height:66px; }
  .wp-top{ grid-template-columns:1fr; }
  .wp-times{ border-left:0; border-top:1px solid var(--ps-line-soft); }
  .wp-slots{ grid-template-columns:repeat(3,1fr); max-height:150px; }
  .ps-bar-in{ height:78px; gap:14px; }
  .ps-logo{ height:48px; }
}
@media (max-width:560px){
  .ps-wrap{ padding:0 14px; }
  .ps-bar-in{ height:66px; gap:10px; }
  .ps-logo{ height:40px; }
  .ps-rule{ display:none; }
  .ps-head{ padding:22px 0 16px; }
  .ps-title{ font-size:25px; }
  .ps-overview{ grid-template-columns:1fr 1fr; }
  .ps-cell{ padding:14px 15px; }
  .ps-cell-v{ font-size:22px; }
  .ps-day{ min-height:52px; padding:6px; }
  .ps-daynum{ font-size:11px; }
  .ps-legend{ gap:10px; padding:8px 12px; }
  .ps-legend span{ font-size:10px; }
  .ps-monthnav{ width:100%; justify-content:space-between; }
  .sm-actions{ grid-template-columns:1fr; }
  .ps-sheet-f{ flex-wrap:wrap; }
  .ps-sheet-f .ps-action{ flex:1; }
}
@media (pointer:coarse){
  .ps-chip, .sm-act, .ps-danger{ min-height:46px; }
  .ps-action{ min-height:48px; }
  .ps-f input, .ps-f select, .ps-f textarea{ font-size:16px; }
  .wp-days button, .wp-slots button, .wp-dur button{ min-height:44px; }
  .ps-appt{ padding:16px; }
}
@media (prefers-reduced-motion: reduce){ .ps-root *{ transition:none !important; } }
`;
