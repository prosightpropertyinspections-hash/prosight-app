"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import Intake from "@/components/Intake";
import { listReports, deleteReport, updateReport } from "@/lib/data";
import { createClient } from "@/lib/supabase-browser";
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

  const filtered = useMemo(() => reports.filter(r => {
    if (filter === "draft" && r.status === "done") return false;
    if (filter === "done" && r.status !== "done") return false;
    if (!q) return true;
    return `${r.address} ${r.client}`.toLowerCase().includes(q.toLowerCase());
  }), [reports, q, filter]);

  async function signOut() { await createClient().auth.signOut(); location.reload(); }
  async function del(r: Report) {
    if (confirm(`Delete the report for ${r.address || "this property"}? This can't be undone.`)) {
      await deleteReport(r.id); refresh();
    }
  }

  const donePct = reports.length ? Math.round((done / reports.length) * 100) : 0;

  return (
    <div className="ps-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet" />

      <style>{`
        .ps-root{
          --ps-paper:#f6f8fa; --ps-panel:#ffffff; --ps-navy:#101a26;
          --ps-blue:#2f7fd0; --ps-amber:#c0813a; --ps-green:#2f9d6b;
          --ps-line:#e4e8ee; --ps-line-soft:#eef1f5;
          --ps-ink:#16202b; --ps-ink-2:#475569; --ps-faint:#8a97a6;
          --ps-serif:"Newsreader",Georgia,"Times New Roman",serif;
          background:var(--ps-paper); min-height:100vh; color:var(--ps-ink);
        }
        .ps-wrap{ max-width:1080px; margin:0 auto; padding:0 24px; }

        .ps-bar{ background:var(--ps-panel); border-bottom:1px solid var(--ps-line); position:sticky; top:0; z-index:30; }
        .ps-bar-in{ display:flex; align-items:center; gap:20px; height:112px; }
        .ps-logo{ height:76px; width:auto; display:block; }
        .ps-rule{ width:1px; height:40px; background:var(--ps-line); }
        .ps-navlink{ font-size:13.5px; color:var(--ps-ink-2); text-decoration:none; padding:6px 2px; }
        .ps-navlink[data-on="1"]{ color:var(--ps-ink); font-weight:650; box-shadow:inset 0 -2px 0 var(--ps-navy); }
        .ps-share{ padding:7px 12px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; border:1px solid var(--ps-line); border-radius:8px; background:var(--ps-panel); color:var(--ps-ink); }
        .ps-share:hover{ border-color:var(--ps-blue); color:var(--ps-blue); }
        .sh-field{ margin-bottom:14px; }
        .sh-field > span{ display:block; font-size:12.5px; font-weight:600; color:var(--ps-ink-2); margin-bottom:5px; }
        .sh-row{ display:flex; gap:8px; }
        .sh-row input{ flex:1; min-width:0; padding:9px 11px; border:1px solid var(--ps-line); border-radius:8px; font:inherit; font-size:13.5px; background:var(--ps-panel); color:var(--ps-ink); }
        .sh-pw input{ font-size:17px; font-weight:700; letter-spacing:2px; }
        .sh-note{ padding:12px 14px; background:#f8fafc; border:1px solid var(--ps-line-soft); border-radius:9px; font-size:12.5px; color:var(--ps-ink-2); }
        .ps-edit{ padding:7px 12px; font:inherit; font-size:12.5px; cursor:pointer; border:1px solid var(--ps-line); border-radius:8px; background:var(--ps-panel); color:var(--ps-ink-2); }
        .ps-edit:hover{ border-color:#cdd6e0; color:var(--ps-ink); }
        .ps-modal{ position:fixed; inset:0; background:rgba(16,26,38,.5); z-index:60; display:grid; place-items:center; padding:20px; }
        .ps-sheet{ width:100%; max-width:560px; background:var(--ps-panel); border-radius:14px; box-shadow:0 24px 60px rgba(16,26,38,.28); overflow:hidden; }
        .ps-sheet-h{ display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid var(--ps-line-soft); }
        .ps-sheet-h h2{ margin:0; font-family:var(--ps-serif); font-size:20px; font-weight:500; }
        .ps-x{ border:0; background:transparent; font-size:16px; color:var(--ps-faint); cursor:pointer; }
        .ps-form{ padding:20px 22px; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .ps-f{ display:flex; flex-direction:column; gap:5px; font-size:12.5px; color:var(--ps-ink-2); font-weight:600; }
        .ps-f input{ padding:9px 11px; border:1px solid var(--ps-line); border-radius:8px; font:inherit; font-size:13.5px; color:var(--ps-ink); background:var(--ps-panel); font-weight:400; }
        .ps-wide{ grid-column:1 / -1; }
        .ps-sheet-f{ display:flex; gap:10px; justify-content:flex-end; padding:16px 22px; border-top:1px solid var(--ps-line-soft); }

        .ps-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; padding:34px 0 20px; }
        .ps-title{ font-family:var(--ps-serif); font-size:32px; font-weight:500; letter-spacing:-.015em; margin:0; line-height:1.1; }
        .ps-sub{ margin:6px 0 0; font-size:14px; color:var(--ps-ink-2); max-width:46ch; }

        .ps-action{
          background:var(--ps-navy); color:#fff; border:0; border-radius:9px;
          padding:11px 18px; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer;
        }
        .ps-action:hover{ background:#1b2a3a; }

        /* One panel with internal divisions rather than four floating tiles —
           the counts belong to the same record set, so they read as one object. */
        .ps-overview{
          background:var(--ps-panel); border:1px solid var(--ps-line); border-radius:12px;
          display:grid; grid-template-columns:1.15fr 1fr 1fr 1fr; overflow:hidden; margin-bottom:26px;
        }
        .ps-cell{ padding:18px 22px; border-left:1px solid var(--ps-line-soft); }
        .ps-cell:first-child{ border-left:0; }
        .ps-cell-l{ font-size:12px; color:var(--ps-faint); letter-spacing:.01em; }
        .ps-cell-v{ font-family:var(--ps-serif); font-size:27px; font-weight:500; line-height:1.15; margin-top:3px; }
        .ps-meter{ height:5px; border-radius:3px; background:var(--ps-line-soft); overflow:hidden; margin-top:12px; display:flex; }
        .ps-meter i{ display:block; height:100%; }

        .ps-tools{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
        .ps-search{
          flex:1; min-width:220px; max-width:360px; padding:9px 12px; font:inherit; font-size:13.5px;
          border:1px solid var(--ps-line); border-radius:9px; background:var(--ps-panel); color:var(--ps-ink);
        }
        .ps-search::placeholder{ color:var(--ps-faint); }
        .ps-chip{
          padding:8px 14px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer;
          border-radius:8px; border:1px solid var(--ps-line); background:var(--ps-panel); color:var(--ps-ink-2);
        }
        .ps-chip[data-on="1"]{ background:var(--ps-navy); border-color:var(--ps-navy); color:#fff; }

        .ps-list{ background:var(--ps-panel); border:1px solid var(--ps-line); border-radius:12px; overflow:hidden; }
        .ps-row{ display:flex; align-items:center; gap:16px; border-top:1px solid var(--ps-line-soft); }
        .ps-row:first-child{ border-top:0; }
        .ps-row:hover{ background:#fbfcfd; }
        .ps-rail{ width:3px; align-self:stretch; flex-shrink:0; }
        .ps-link{ flex:1; min-width:0; display:flex; align-items:center; gap:16px; padding:16px 4px 16px 17px; color:inherit; text-decoration:none; }
        .ps-addr{ font-family:var(--ps-serif); font-size:18px; font-weight:500; letter-spacing:-.005em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ps-meta{ font-size:12.5px; color:var(--ps-ink-2); margin-top:2px; }
        .ps-secs{ font-size:12.5px; color:var(--ps-faint); white-space:nowrap; }
        .ps-pill{ font-size:11.5px; font-weight:600; padding:4px 11px; border-radius:20px; white-space:nowrap; }
        .ps-del{
          padding:7px 12px; font:inherit; font-size:12.5px; cursor:pointer; margin-right:16px;
          border:1px solid transparent; border-radius:8px; background:transparent; color:var(--ps-faint);
        }
        .ps-del:hover{ border-color:#e8d2d2; color:#b4453c; background:#fdf6f6; }

        .ps-empty{ background:var(--ps-panel); border:1px dashed #d6dde6; border-radius:12px; padding:64px 24px; text-align:center; }
        .ps-empty h3{ font-family:var(--ps-serif); font-size:21px; font-weight:500; margin:0 0 6px; }
        .ps-empty p{ margin:0 auto 20px; font-size:14px; color:var(--ps-ink-2); max-width:44ch; }

        .ps-root :focus-visible{ outline:2px solid var(--ps-blue); outline-offset:2px; border-radius:6px; }

        @media (max-width:820px){
          .ps-overview{ grid-template-columns:1fr 1fr; }
          .ps-cell:nth-child(3){ border-left:0; }
          .ps-cell:nth-child(n+3){ border-top:1px solid var(--ps-line-soft); }
          .ps-secs{ display:none; }
          .ps-title{ font-size:27px; }
        }
        @media (max-width:560px){
          .ps-logo{ height:50px; }
          .ps-bar-in{ height:80px; gap:12px; }
        }
        @media (prefers-reduced-motion: reduce){ .ps-root *{ transition:none !important; animation:none !important; } }
      `}</style>

      <header className="ps-bar">
        <div className="ps-wrap ps-bar-in">
          <img className="ps-logo" src="/logo.svg" alt="ProSight Property Inspections" />
          <div className="ps-rule" />
          <Link href="/" className="ps-navlink" data-on="1">Reports</Link>
          <Link href="/schedule" className="ps-navlink">Schedule</Link>
          <div style={{ flex: 1 }} />
          <button className="ps-chip" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="ps-wrap" style={{ paddingBottom: 90 }}>
        <div className="ps-head">
          <div>
            <h1 className="ps-title">Inspection reports</h1>
            <p className="ps-sub">Every property you've inspected, with its findings, photos and grade.</p>
          </div>
          <button className="ps-action" onClick={() => setShowIntake(true)}>Start a new report</button>
        </div>

        <div className="ps-overview">
          <div className="ps-cell">
            <div className="ps-cell-l">Properties on file</div>
            <div className="ps-cell-v">{reports.length}</div>
            <div className="ps-meter" aria-hidden>
              <i style={{ width: `${donePct}%`, background: "var(--ps-green)" }} />
              <i style={{ width: `${100 - donePct}%`, background: "var(--ps-amber)" }} />
            </div>
          </div>
          <div className="ps-cell">
            <div className="ps-cell-l">In progress</div>
            <div className="ps-cell-v" style={{ color: "var(--ps-amber)" }}>{drafts}</div>
          </div>
          <div className="ps-cell">
            <div className="ps-cell-l">Delivered</div>
            <div className="ps-cell-v" style={{ color: "var(--ps-green)" }}>{done}</div>
          </div>
          <div className="ps-cell">
            <div className="ps-cell-l">Added this month</div>
            <div className="ps-cell-v">{month}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--ps-faint)" }}>Loading your reports…</div>
        ) : reports.length === 0 ? (
          <div className="ps-empty">
            <h3>No reports yet</h3>
            <p>Answer a few questions about the property and the section structure is built for you.</p>
            <button className="ps-action" onClick={() => setShowIntake(true)}>Start your first report</button>
          </div>
        ) : (
          <>
            <div className="ps-tools">
              <input className="ps-search" placeholder="Search by address or client"
                value={q} onChange={e => setQ(e.target.value)} />
              {([["all", "All"], ["draft", "In progress"], ["done", "Delivered"]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} className="ps-chip" data-on={filter === k ? "1" : "0"} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>

            <div className="ps-list">
              {filtered.map(r => {
                const isDone = r.status === "done";
                const secs = (r as any).section_count || 0;
                return (
                  <div key={r.id} className="ps-row">
                    <div className="ps-rail" style={{ background: isDone ? "var(--ps-green)" : "var(--ps-amber)" }} />
                    <Link href={`/report/${r.id}`} className="ps-link">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ps-addr">{r.address || "Untitled property"}</div>
                        <div className="ps-meta">{r.client || "No client named"} · {fmtDate(r.inspection_date)}</div>
                      </div>
                      {secs > 0 && <div className="ps-secs">{secs} section{secs === 1 ? "" : "s"}</div>}
                      <span className="ps-pill" style={{
                        background: isDone ? "rgba(47,157,107,.12)" : "rgba(192,129,58,.13)",
                        color: isDone ? "var(--ps-green)" : "var(--ps-amber)",
                      }}>{isDone ? "Delivered" : "In progress"}</span>
                    </Link>
                    <button className="ps-share" onClick={() => setSharing(r)}>Share</button>
                    <button className="ps-edit" onClick={() => setEditing(r)}>Edit</button>
                    <button className="ps-del" onClick={() => del(r)}>Delete</button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: 34, textAlign: "center", color: "var(--ps-ink-2)", fontSize: 14 }}>
                  Nothing matches that. Try a different address, or clear the filter.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {sharing && <ShareLink report={sharing} onClose={() => setSharing(null)} />}

      {editing && (
        <EditDetails
          report={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {showIntake && <Intake onClose={() => { setShowIntake(false); refresh(); }} />}
    </div>
  );
}

/* Property details are the one thing that gets typed wrong at the door and
   noticed later, so they stay editable after the report exists. */
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
    } catch (e: any) {
      alert("Could not save: " + (e?.message || e));
      setSaving(false);
    }
  }

  return (
    <div className="ps-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ps-sheet">
        <div className="ps-sheet-h">
          <h2>Report details</h2>
          <button className="ps-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="ps-form">
          <label className="ps-f ps-wide"><span>Property address</span>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="2799 Amazon St, Dearborn, MI 48120" /></label>
          <label className="ps-f"><span>Client name</span>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder="Seth Anderson" /></label>
          <label className="ps-f"><span>Inspector</span>
            <input value={inspector} onChange={e => setInspector(e.target.value)} placeholder="Islam" /></label>
          <label className="ps-f ps-wide"><span>Inspection date</span>
            <input type="date" value={date || ""} onChange={e => setDate(e.target.value)} /></label>
        </div>
        <div className="ps-sheet-f">
          <button className="ps-chip" onClick={onClose}>Cancel</button>
          <button className="ps-action" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* The link and password are wanted at the moment of texting a client, which is
   not usually while the report is open — so it lives on the list too. */
function ShareLink({ report, onClose }: { report: Report; onClose: () => void }) {
  const [share, setShare] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

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
  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text);
    setCopied(what); setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="ps-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ps-sheet">
        <div className="ps-sheet-h">
          <h2>Share with client</h2>
          <button className="ps-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--ps-ink-2)" }}>
            {report.address || "This property"} — send your client both the link and the password.
          </p>

          {busy ? <div style={{ padding: 20, color: "var(--ps-faint)", fontSize: 13.5 }}>Preparing the link…</div>
            : err ? <div style={{ padding: 14, background: "#fdf6f6", border: "1px solid #e8d2d2", borderRadius: 9, color: "#b4453c", fontSize: 13 }}>{err}</div>
            : (
            <>
              <div className="sh-field">
                <span>Link</span>
                <div className="sh-row">
                  <input readOnly value={link} onFocus={e => e.target.select()} />
                  <button className="ps-chip" onClick={() => copy(link, "link")}>{copied === "link" ? "Copied" : "Copy"}</button>
                </div>
              </div>
              <div className="sh-field sh-pw">
                <span>Password</span>
                <div className="sh-row">
                  <input readOnly value={share.password} />
                  <button className="ps-chip" onClick={() => copy(share.password, "pw")}>{copied === "pw" ? "Copied" : "Copy"}</button>
                </div>
              </div>
              <div className="sh-note">
                Anyone with both the link and the password can open this report. {share.views || 0} view{(share.views || 0) === 1 ? "" : "s"} so far.
              </div>
            </>
          )}
        </div>
        <div className="ps-sheet-f">
          <button className="ps-chip" onClick={onClose}>Close</button>
          {share && (
            <button className="ps-action" onClick={() => copy(`${link}\nPassword: ${share.password}`, "both")}>
              {copied === "both" ? "Copied" : "Copy link and password"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
