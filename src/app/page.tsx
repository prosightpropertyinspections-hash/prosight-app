"use client";
import { useEffect, useMemo, useState } from "react";
import { showConfirm, showAlert } from "@/components/Dialog";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import UserMenu from "@/components/UserMenu";
import Intake from "@/components/Intake";
import { listReports, deleteReport, updateReport } from "@/lib/data";
import type { Report } from "@/lib/types";

function fmtDate(iso: string | null) {
  if (!iso) return "No date set";
  return new Date(iso + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Home() {
  return <AuthGate><Dashboard /></AuthGate>;
}

type Filter = "all" | "draft" | "done";

function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Report | null>(null);
  const [sharing, setSharing] = useState<Report | null>(null);

  async function refresh() {
    setLoading(true);
    try { setReports(await listReports()); } catch (e) {}
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const drafts = reports.filter(r => r.status !== "done").length;
  const done = reports.length - drafts;
  const month = reports.filter(r => {
    const d = new Date(r.created_at), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const donePct = reports.length ? Math.round((done / reports.length) * 100) : 0;

  const filtered = useMemo(() => reports.filter(r => {
    if (filter === "draft" && r.status === "done") return false;
    if (filter === "done" && r.status !== "done") return false;
    if (!q) return true;
    return `${r.address} ${r.client}`.toLowerCase().includes(q.toLowerCase());
  }), [reports, q, filter]);

  /* A report is delivered the moment the client has it, so the control lives
     next to Share rather than buried in the editor. */
  async function setDelivered(r: Report, done: boolean) {
    try {
      await updateReport(r.id, { status: done ? "done" : "draft" } as any);
      setReports(prev => prev.map(x => x.id === r.id ? ({ ...x, status: done ? "done" : "draft" } as Report) : x));
    } catch (e: any) {
      showAlert("Could not update that report: " + (e?.message || e));
    }
  }

  async function del(r: Report) {
    if(await showConfirm({ title:"Delete this report?", body:`${r.address || "This property"} — findings, photographs and grade will be removed. This cannot be undone.`, confirmText:"Delete", danger:true })) {
      await deleteReport(r.id); refresh();
    }
  }

  return (
    <div className="ux">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{__html: UX_CSS }} />

      {/* light bleeding in from the top, so the page has a source */}
      <div className="ux-glow" aria-hidden />

      <header className="ux-bar">
        <div className="ux-wrap ux-bar-in">
          <img className="ux-logo" src="/logo-ondark.svg" alt="ProSight Property Inspections" />
          <span className="ux-rule" />
          <nav className="ux-nav">
            <Link href="/" data-on="1">Reports</Link>
            <Link href="/schedule">Schedule</Link>
          </nav>
          <div style={{ flex: 1 }} />
          <UserMenu dark />
        </div>
      </header>

      <main className="pg-fade ux-wrap ux-main">
        <div className="ux-head">
          <div>
            <div className="ux-kicker">ProSight Report Studio</div>
            <h1 className="ux-title">Inspection reports</h1>
            <p className="ux-sub">Every property you've inspected, with its findings, photographs and grade.</p>
          </div>
          <button className="ux-cta" onClick={() => setShowIntake(true)}>
            <span>Start a new report</span>
          </button>
        </div>

        <section className="ux-stats">
          <div className="ux-cell ux-cell-lead">
            <div className="ux-l">Properties on file</div>
            <div className="ux-v">{reports.length}</div>
            <div className="ux-meter" aria-hidden>
              <i style={{ width: `${donePct}%`, background: "linear-gradient(90deg,#3fd39b,#2fae82)" }} />
              <i style={{ width: `${100 - donePct}%`, background: "linear-gradient(90deg,#f0b429,#d79a1c)" }} />
            </div>
          </div>
          <div className="ux-cell">
            <div className="ux-l">In progress</div>
            <div className="ux-v" style={{ color: "#f0b429" }}>{drafts}</div>
          </div>
          <div className="ux-cell">
            <div className="ux-l">Delivered</div>
            <div className="ux-v" style={{ color: "#3fd39b" }}>{done}</div>
          </div>
          <div className="ux-cell">
            <div className="ux-l">Added this month</div>
            <div className="ux-v">{month}</div>
          </div>
        </section>

        {loading ? (
          <div className="ux-quiet">Loading your reports…</div>
        ) : reports.length === 0 ? (
          <div className="ux-empty">
            <h3>No reports yet</h3>
            <p>Answer a few questions about the property and the section structure is built for you.</p>
            <button className="ux-cta" onClick={() => setShowIntake(true)}><span>Start your first report</span></button>
          </div>
        ) : (
          <>
            <div className="ux-tools">
              <div className="ux-search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                </svg>
                <input placeholder="Search by address or client" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              {([["all", "All"], ["draft", "In progress"], ["done", "Delivered"]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} className="ux-chip" data-on={filter === k ? "1" : "0"} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>

            <div className="ux-list">
              {filtered.map(r => {
                const isDone = r.status === "done";
                const secs = (r as any).section_count || 0;
                const tone = isDone ? "#3fd39b" : "#f0b429";
                return (
                  <article key={r.id} className="ux-row">
                    <span className="ux-rail" style={{ background: `linear-gradient(180deg, ${tone}, ${tone}22)` }} />
                    <Link href={`/report/${r.id}`} className="ux-open">
                      <div className="ux-addr-wrap">
                        <div className="ux-addr">{r.address || "Untitled property"}</div>
                        <div className="ux-meta">
                          {r.client || "No client named"}
                          <span className="ux-dot" />{fmtDate(r.inspection_date)}
                          {secs > 0 && <><span className="ux-dot" />{secs} sections</>}
                        </div>
                      </div>
                      <span className="ux-pill" style={{ color: tone, borderColor: `${tone}44`, background: `${tone}14` }}>
                        <span className="ux-pip" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />
                        {isDone ? "Delivered" : "In progress"}
                      </span>
                    </Link>
                    <div className="ux-acts">
                      <button className={isDone ? "" : "ux-deliver"} onClick={() => setDelivered(r, !isDone)}
                        title={isDone ? "Move back to in progress" : "Mark this report as delivered to the client"}>
                        {isDone ? "Reopen" : "Mark delivered"}
                      </button>
                      <button onClick={() => setSharing(r)}>Share</button>
                      <button onClick={() => setEditing(r)}>Edit</button>
                      <button className="ux-del" onClick={() => del(r)}>Delete</button>
                    </div>
                  </article>
                );
              })}
              {filtered.length === 0 && (
                <div className="ux-quiet" style={{ padding: "34px 0" }}>
                  Nothing matches that. Try a different address, or clear the filter.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {sharing && (
        <ShareLink
          report={sharing}
          delivered={sharing.status === "done"}
          onDeliver={() => setDelivered(sharing, true)}
          onClose={() => setSharing(null)}
        />
      )}
      {editing && <EditDetails report={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {showIntake && <Intake onClose={() => { setShowIntake(false); refresh(); }} />}
    </div>
  );
}

function ShareLink({ report, delivered, onDeliver, onClose }: {
  report: Report; delivered: boolean; onDeliver: () => void; onClose: () => void;
}) {
  const [share, setShare] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [done, setDone] = useState(delivered);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/share", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: report.id }),
        });
        const j = await res.json();
        if (j.share) setShare(j.share); else setErr(j.error || "Could not create the link.");
      } catch (e: any) { setErr(e?.message || "Could not create the link."); }
      setBusy(false);
    })();
  }, [report.id]);

  const link = share ? `${location.origin}/view/${share.code}` : "";
  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500);
  };

  return (
    <div className="ux-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ux-sheet">
        <div className="ux-sheet-h">
          <h2>Share with client</h2>
          <button className="ux-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="ux-sheet-b">
          <p className="ux-note">{report.address || "This property"} — send your client both the link and the password.</p>
          {busy ? <div className="ux-quiet">Preparing the link…</div>
            : err ? <div className="ux-err">{err}</div> : (
            <>
              <label className="ux-f"><span>Link</span>
                <div className="ux-copyrow">
                  <input readOnly value={link} onFocus={e => e.target.select()} />
                  <button onClick={() => copy(link, "link")}>{copied === "link" ? "Copied" : "Copy"}</button>
                </div>
              </label>
              <label className="ux-f"><span>Password</span>
                <div className="ux-copyrow">
                  <input readOnly value={share.password} style={{ fontSize: 17, fontWeight: 700, letterSpacing: 2 }} />
                  <button onClick={() => copy(share.password, "pw")}>{copied === "pw" ? "Copied" : "Copy"}</button>
                </div>
              </label>
              <div className="ux-hint">
                Anyone with both can open this report. {share.views || 0} view{(share.views || 0) === 1 ? "" : "s"} so far.
              </div>

              {/* Marking it delivered here, at the moment the link is sent, is
                  the only point where it is reliably true. */}
              <label className="ux-deliv-row">
                <input type="checkbox" checked={done}
                  onChange={e => { setDone(e.target.checked); if (e.target.checked) onDeliver(); }} />
                <span>
                  <strong>Mark this report as delivered</strong>
                  <em>Moves it out of In progress on your dashboard</em>
                </span>
              </label>
            </>
          )}
        </div>
        <div className="ux-sheet-f">
          <button className="ux-chip" onClick={onClose}>Close</button>
          {share && (
            <button className="ux-cta" onClick={() => copy(`${link}\nPassword: ${share.password}`, "both")}>
              <span>{copied === "both" ? "Copied" : "Copy link and password"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditDetails({ report, onClose, onSaved }: { report: Report; onClose: () => void; onSaved: () => void }) {
  const [address, setAddress] = useState(report.address || "");
  const [client, setClient] = useState(report.client || "");
  const [inspector, setInspector] = useState((report as any).inspector || "");
  const [date, setDate] = useState(report.inspection_date || "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await updateReport(report.id, { address, client, inspector, inspection_date: date || null } as any);
      onSaved();
    } catch (e: any) { showAlert("Could not save: " + (e?.message || e)); setSaving(false); }
  }

  return (
    <div className="ux-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ux-sheet">
        <div className="ux-sheet-h">
          <h2>Report details</h2>
          <button className="ux-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="ux-sheet-b ux-grid">
          <label className="ux-f ux-wide"><span>Property address</span>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="2799 Amazon St, Dearborn, MI 48120" /></label>
          <label className="ux-f"><span>Client name</span>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder="Seth Anderson" /></label>
          <label className="ux-f"><span>Inspector</span>
            <input value={inspector} onChange={e => setInspector(e.target.value)} placeholder="Islam" /></label>
          <label className="ux-f ux-wide"><span>Inspection date</span>
            <input type="date" value={date || ""} onChange={e => setDate(e.target.value)} /></label>
        </div>
        <div className="ux-sheet-f">
          <button className="ux-chip" onClick={onClose}>Cancel</button>
          <button className="ux-cta" disabled={saving} onClick={submit}><span>{saving ? "Saving…" : "Save changes"}</span></button>
        </div>
      </div>
    </div>
  );
}

const UX_CSS = `
.ux{
  --ux-bg:#070d16; --ux-panel:#0f1a2a; --ux-panel-2:#132234; --ux-line:#1d3048;
  --ux-ink:#eaf2fa; --ux-ink-2:#a8bbd0; --ux-faint:#6d8199;
  --ux-blue:#45b0ee; --ux-green:#3fd39b; --ux-amber:#f0b429; --ux-red:#ff6b5e;
  --ux-display:"Sora","Helvetica Neue",sans-serif;
  position:relative; min-height:100vh; background:var(--ux-bg); color:var(--ux-ink);
  overflow-x:clip; width:100%; max-width:100%;
  font-family:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;
}
/* Sized in viewport units, not pixels. A fixed 1200px bloom is wider than a
   phone, which pushes the document past the viewport — the browser then zooms
   out to fit and everything lands squashed on the left. */
.ux-glow{ position:absolute; top:-320px; left:50%; transform:translateX(-50%);
  width:min(1200px, 150vw); height:min(640px, 52vh); pointer-events:none;
  background:radial-gradient(ellipse at 50% 50%, rgba(69,176,238,.16), transparent 66%); filter:blur(30px); }
.ux-wrap{ position:relative; max-width:1120px; margin:0 auto; padding:0 26px; }

.ux-bar{ position:sticky; top:0; z-index:30; background:rgba(7,13,22,.82);
  backdrop-filter:blur(14px); border-bottom:1px solid var(--ux-line); }
.ux-bar-in{ display:flex; align-items:center; gap:20px; height:108px; }
.ux-logo{ height:72px; width:auto; display:block; }
.ux-rule{ width:1px; height:38px; background:var(--ux-line); }
.ux-nav{ display:flex; gap:18px; }
.ux-nav a{ font-size:13.5px; color:var(--ux-ink-2); text-decoration:none; padding:8px 2px; position:relative; }
.ux-nav a:hover{ color:var(--ux-ink); }
.ux-nav a[data-on="1"]{ color:var(--ux-ink); font-weight:600; }
.ux-nav a[data-on="1"]::after{ content:""; position:absolute; left:0; right:0; bottom:0; height:2px;
  border-radius:2px; background:linear-gradient(90deg,var(--ux-blue),transparent); }

.ux-main{ padding-bottom:110px; }
.ux-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap; padding:42px 0 24px; }
.ux-kicker{ font-size:9.5px; letter-spacing:3.4px; text-transform:uppercase; color:var(--ux-blue); margin-bottom:9px; }
.ux-title{ font-family:var(--ux-display); font-size:34px; font-weight:600; letter-spacing:-.9px; margin:0; line-height:1.05; }
.ux-sub{ margin:9px 0 0; font-size:14px; color:var(--ux-ink-2); max-width:48ch; }

.ux-cta{ position:relative; border:0; cursor:pointer; border-radius:11px; padding:1px;
  background:linear-gradient(140deg,var(--ux-blue),#1d6fa8); font:inherit; }
.ux-cta span{ display:block; padding:11px 20px; border-radius:10px; font-size:13.5px; font-weight:600; color:#fff;
  background:linear-gradient(150deg,#1a6fa9,#134d78); }
.ux-cta:hover span{ background:linear-gradient(150deg,#2183c4,#175a8c); }
.ux-cta:disabled{ opacity:.55; cursor:default; }

.ux-stats{ display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; border:1px solid var(--ux-line);
  border-radius:16px; overflow:hidden; margin-bottom:26px;
  background:linear-gradient(160deg,rgba(19,34,52,.9),rgba(11,20,33,.9)); }
.ux-cell{ padding:20px 22px; border-left:1px solid var(--ux-line); }
.ux-cell:first-child{ border-left:0; }
.ux-l{ font-size:11.5px; color:var(--ux-faint); }
.ux-v{ font-family:var(--ux-display); font-size:30px; font-weight:600; line-height:1.15; margin-top:4px; }
.ux-meter{ display:flex; height:5px; border-radius:3px; overflow:hidden; margin-top:13px; background:var(--ux-line); }
.ux-meter i{ display:block; height:100%; }

.ux-tools{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
.ux-search{ position:relative; display:flex; align-items:center; gap:9px; flex:1; min-width:230px; max-width:380px;
  padding:0 13px; border:1px solid var(--ux-line); border-radius:10px; background:var(--ux-panel); color:var(--ux-faint); }
.ux-search input{ flex:1; padding:11px 0; border:0; background:transparent; color:var(--ux-ink); font:inherit; font-size:13.5px; outline:none; }
.ux-search input::placeholder{ color:var(--ux-faint); }
.ux-search:focus-within{ border-color:var(--ux-blue); box-shadow:0 0 0 3px rgba(69,176,238,.14); }
.ux-chip{ padding:9px 15px; border:1px solid var(--ux-line); border-radius:9px; background:var(--ux-panel);
  color:var(--ux-ink-2); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }
.ux-chip:hover{ border-color:#2a4767; color:var(--ux-ink); }
.ux-chip[data-on="1"]{ color:#fff; border-color:rgba(69,176,238,.55);
  background:linear-gradient(150deg,rgba(69,176,238,.24),rgba(69,176,238,.08));
  box-shadow:0 0 18px -6px rgba(69,176,238,.7); }

.ux-list{ display:flex; flex-direction:column; gap:10px; }
.ux-row{ position:relative; display:flex; align-items:center; gap:14px; overflow:hidden;
  border:1px solid var(--ux-line); border-radius:13px;
  background:linear-gradient(150deg,rgba(19,34,52,.72),rgba(11,20,33,.72));
  transition:border-color .16s, transform .16s, box-shadow .16s; }
.ux-row:hover{ border-color:#2a4767; transform:translateY(-1px); box-shadow:0 14px 30px -18px rgba(0,0,0,.9); }
.ux-rail{ width:3px; align-self:stretch; flex-shrink:0; }
.ux-open{ flex:1; min-width:0; display:flex; align-items:center; gap:16px; padding:17px 6px 17px 17px;
  color:inherit; text-decoration:none; }
.ux-addr-wrap{ flex:1; min-width:0; }
.ux-addr{ font-family:var(--ux-display); font-size:17px; font-weight:600; letter-spacing:-.3px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ux-meta{ display:flex; align-items:center; font-size:12.5px; color:var(--ux-ink-2); margin-top:4px; }
.ux-dot{ width:3px; height:3px; border-radius:50%; background:var(--ux-faint); margin:0 8px; flex-shrink:0; }
.ux-pill{ display:inline-flex; align-items:center; gap:7px; font-size:11.5px; font-weight:600;
  padding:5px 12px; border-radius:20px; border:1px solid; white-space:nowrap; }
.ux-pip{ width:6px; height:6px; border-radius:50%; }
.ux-acts{ display:flex; gap:7px; padding-right:15px; flex-shrink:0; }
.ux-acts button{ padding:8px 13px; border:1px solid var(--ux-line); border-radius:9px; background:transparent;
  color:var(--ux-ink-2); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }
.ux-acts button:hover{ border-color:var(--ux-blue); color:var(--ux-blue); }
.ux-acts .ux-deliver{ color:var(--ux-green); border-color:rgba(63,211,155,.32); }
.ux-acts .ux-deliver:hover{ border-color:var(--ux-green); background:rgba(63,211,155,.10); color:var(--ux-green); }
.ux-acts .ux-del{ color:var(--ux-faint); border-color:transparent; }
.ux-acts .ux-del:hover{ color:var(--ux-red); border-color:rgba(255,107,94,.4); }

.ux-empty{ border:1px dashed #23385230; border-radius:16px; padding:68px 24px; text-align:center;
  background:linear-gradient(160deg,rgba(19,34,52,.55),rgba(11,20,33,.55)); }
.ux-empty h3{ font-family:var(--ux-display); font-size:21px; font-weight:600; margin:0 0 7px; }
.ux-empty p{ margin:0 auto 22px; font-size:14px; color:var(--ux-ink-2); max-width:44ch; }
.ux-quiet{ padding:52px 0; text-align:center; color:var(--ux-faint); font-size:13.5px; }

.ux-modal{ position:fixed; inset:0; z-index:60; display:grid; place-items:center; padding:22px;
  background:rgba(4,8,14,.72); backdrop-filter:blur(5px); }
.ux-sheet{ width:100%; max-width:560px; border:1px solid var(--ux-line); border-radius:16px; overflow:hidden;
  background:linear-gradient(160deg,#132234,#0b1421); box-shadow:0 30px 70px -20px rgba(0,0,0,.9); }
.ux-sheet-h{ display:flex; align-items:center; justify-content:space-between; padding:19px 22px; border-bottom:1px solid var(--ux-line); }
.ux-sheet-h h2{ margin:0; font-family:var(--ux-display); font-size:19px; font-weight:600; }
.ux-x{ border:0; background:transparent; color:var(--ux-faint); font-size:15px; cursor:pointer; }
.ux-x:hover{ color:var(--ux-ink); }
.ux-sheet-b{ padding:20px 22px; }
.ux-grid{ display:grid; grid-template-columns:1fr 1fr; gap:15px; }
.ux-wide{ grid-column:1 / -1; }
.ux-f{ display:block; }
.ux-f > span{ display:block; font-size:12.5px; font-weight:600; color:var(--ux-ink-2); margin-bottom:6px; }
.ux-f input{ width:100%; padding:11px 13px; border:1px solid var(--ux-line); border-radius:9px;
  background:var(--ux-panel); color:var(--ux-ink); font:inherit; font-size:13.5px; }
.ux-f input:focus{ outline:none; border-color:var(--ux-blue); box-shadow:0 0 0 3px rgba(69,176,238,.14); }
.ux-f + .ux-f{ margin-top:15px; }
.ux-copyrow{ display:flex; gap:9px; }
.ux-copyrow button{ padding:0 15px; border:1px solid var(--ux-line); border-radius:9px; background:var(--ux-panel);
  color:var(--ux-ink-2); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; }
.ux-copyrow button:hover{ border-color:var(--ux-blue); color:var(--ux-blue); }
.ux-note{ margin:0 0 18px; font-size:13.5px; color:var(--ux-ink-2); }
.ux-hint{ margin-top:16px; padding:12px 14px; border:1px solid var(--ux-line); border-radius:10px;
  background:rgba(69,176,238,.06); font-size:12.5px; color:var(--ux-ink-2); }
.ux-deliv-row{ display:flex; align-items:flex-start; gap:11px; margin-top:13px; padding:13px 15px; cursor:pointer;
  border:1px solid rgba(63,211,155,.28); border-radius:10px; background:rgba(63,211,155,.07); }
.ux-deliv-row input{ width:18px; height:18px; margin-top:1px; accent-color:#3fd39b; flex-shrink:0; }
.ux-deliv-row strong{ display:block; font-size:13.5px; font-weight:600; color:var(--ux-ink); }
.ux-deliv-row em{ display:block; font-style:normal; font-size:12px; color:var(--ux-ink-2); margin-top:2px; }
.ux-err{ padding:13px 15px; border:1px solid rgba(255,107,94,.35); border-radius:10px;
  background:rgba(255,107,94,.08); color:#ff8f85; font-size:13px; }
.ux-sheet-f{ display:flex; gap:10px; justify-content:flex-end; padding:17px 22px; border-top:1px solid var(--ux-line); }

/* Content fades up on arrival. The header is excluded deliberately — a bar that
   re-animates on every navigation draws attention to the navigation itself. */
@keyframes pg-in{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion: no-preference){
  .pg-fade{ animation:pg-in .22s cubic-bezier(.2,.8,.25,1) both; }
}

.ux :focus-visible{ outline:2px solid var(--ux-blue); outline-offset:2px; border-radius:8px; }
/* The shell's palette is namespaced so it cannot leak into components that use
   the app's own --ink / --surface variables — a modal opened from here must
   keep its own colours. */
@media (max-width:860px){
  .ux-stats{ grid-template-columns:1fr 1fr; }
  .ux-cell:nth-child(3){ border-left:0; }
  .ux-cell:nth-child(n+3){ border-top:1px solid var(--ux-line); }
  .ux-row{ flex-wrap:wrap; }
  .ux-acts{ padding:0 15px 15px 20px; }
  .ux-grid{ grid-template-columns:1fr; }
  .ux-bar-in{ height:78px; gap:14px; }
  .ux-logo{ height:48px; }
  .ux-title{ font-size:28px; }
}
@media (max-width:560px){
  .ux-wrap{ padding:0 14px; }
  .ux-bar-in{ height:66px; gap:10px; }
  .ux-logo{ height:40px; }
  .ux-rule{ display:none; }
  .ux-nav{ gap:12px; }
  .ux-head{ padding:22px 0 18px; }
  .ux-title{ font-size:24px; }
  .ux-sub{ font-size:13px; }
  .ux-cta{ width:100%; }
  .ux-cta span{ text-align:center; }
  .ux-stats{ grid-template-columns:1fr 1fr; }
  .ux-cell{ padding:14px 15px; }
  .ux-v{ font-size:24px; }
  .ux-search{ max-width:none; flex:1 1 100%; }
  .ux-open{ flex-wrap:wrap; padding:14px 14px 10px; gap:9px; }
  .ux-addr{ font-size:15.5px; white-space:normal; }
  .ux-meta{ flex-wrap:wrap; font-size:12px; }
  .ux-acts{ width:100%; padding:0 14px 13px; }
  .ux-acts button{ flex:1; }
  .ux-sheet-f{ flex-direction:column-reverse; }
  .ux-sheet-f button{ width:100%; }
}
@media (pointer:coarse){
  .ux-chip, .ux-acts button, .ux-copyrow button{ min-height:46px; }
  .ux-cta span{ padding:14px 22px; }
  .ux-search input, .ux-f input{ font-size:16px; }
}
@media (prefers-reduced-motion: reduce){ .ux *{ transition:none !important; } }
`;
