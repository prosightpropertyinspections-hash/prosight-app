"use client";
import { useEffect, useState } from "react";

/* The sewer camera recording. It lives wherever the inspector uploads it
   (YouTube, Google Drive, Dropbox…); the report just links to it from the
   top of the Sewer Scope section. */

export const isSewer = (name: string) => /sewer/i.test(String(name || ""));

/** Accepts what people paste ("youtu.be/abc", "www.dropbox.com/…") and returns
    a full https URL, or "" if it isn't a web address at all. */
export function normalizeVideoUrl(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return "";
    return u.toString();
  } catch { return ""; }
}

/** Short, readable form for print: "youtu.be/abc123" rather than the full URL. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    const s = (u.hostname.replace(/^www\./, "") + u.pathname + u.search).replace(/\/$/, "");
    return s.length > 60 ? s.slice(0, 57) + "…" : s;
  } catch { return url; }
}

/* Editor field. Saves when you leave the box or press Enter, not on every
   keystroke, and refuses anything that isn't a web address. */
export function SewerVideoPanel({ value, onSave }: { value: string; onSave: (url: string) => Promise<void> | void }) {
  const [v, setV] = useState(value || "");
  const [state, setState] = useState<"" | "saved" | "bad">("");
  useEffect(() => { setV(value || ""); }, [value]);

  async function commit() {
    const url = normalizeVideoUrl(v);
    if (v.trim() && !url) { setState("bad"); return; }
    if (url === (value || "")) { setState(""); return; }
    setV(url);
    await onSave(url);
    setState("saved");
    setTimeout(() => setState(""), 1800);
  }

  return (
    <div style={{ border: "1px solid var(--line, #d8dde3)", borderRadius: 12, padding: "14px 15px", margin: "0 0 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Sewer scope video</strong>
        <span style={{ fontSize: 11.5, color: state === "bad" ? "#d14343" : "var(--faint, #7d8b9c)" }}>
          {state === "bad" ? "That isn't a web link" : state === "saved" ? "Saved" : "Shown to the client at the top of this section"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="inp"
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--line, #d8dde3)", font: "inherit", fontSize: 14 }}
          inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          placeholder="Paste the YouTube, Google Drive or Dropbox link"
          value={v}
          onChange={e => { setV(e.target.value); setState(""); }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
        {normalizeVideoUrl(v) && (
          <a href={normalizeVideoUrl(v)} target="_blank" rel="noopener noreferrer"
            style={{ display: "grid", placeItems: "center", padding: "0 14px", borderRadius: 9, border: "1px solid var(--line, #d8dde3)",
              fontSize: 13, fontWeight: 600, textDecoration: "none", color: "inherit", whiteSpace: "nowrap" }}>
            Test
          </a>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--faint, #7d8b9c)", marginTop: 7 }}>
        Make sure the link is shared as "anyone with the link can view," or the client won't be able to open it.
      </div>
    </div>
  );
}
