// Adds an apartment icon next to the house icon on the "Home Buyer" card.
// Run from the prosight-app folder:  node add-condo-icon.js
const fs = require("fs");
const path = "src/app/book/page.tsx";
if (!fs.existsSync(path)) { console.error("Run this from the prosight-app folder (could not find " + path + ")."); process.exit(1); }
let s = fs.readFileSync(path, "utf8");

if (s.includes("bk-ico2")) { console.log("Already added. Nothing to do."); process.exit(0); }

const oldIcon = '<span className="bk-ico"><Icon name={p.icon} /></span>';
if (!s.includes(oldIcon)) { console.error("Could not find the icon line in page.tsx. No changes made."); process.exit(1); }

const condoSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" /><path d="M15 9h3a1 1 0 0 1 1 1v11" /><path d="M3 21h18" /><path d="M9 7h2M9 11h2M9 15h2" /></svg>';
const newIcon =
`<span className={\`bk-ico\${p.k === "buyer" ? " bk-ico2" : ""}\`}>
                          <Icon name={p.icon} />
                          {p.k === "buyer" ? <><i aria-hidden="true" />${condoSvg}</> : null}
                        </span>`;
s = s.replace(oldIcon, newIcon);

const css = `
/* Home Buyer shows both a house and an apartment: either can be bought */
.bk-ico2{ display:inline-flex; align-items:center; justify-content:center; gap:10px; width:auto; padding:0 16px; }
.bk-ico2 i{ width:1px; height:22px; background:currentColor; opacity:.28; }
@media (max-width:620px){ .bk-ico2{ width:auto; min-width:48px; padding:0 10px; gap:7px; } .bk-ico2 svg{ width:21px; height:21px; flex-shrink:0; } .bk-ico2 i{ height:18px; } .bk-types button:has(.bk-ico2){ grid-template-columns:auto 1fr; } }
`;
const start = s.indexOf("const BK_CSS = `");
const end = start < 0 ? -1 : s.indexOf("`;", start + 16);
if (end < 0) { console.error("Could not find the styles block. No changes made."); process.exit(1); }
s = s.slice(0, end) + css + s.slice(end);

fs.writeFileSync(path, s, "utf8");
console.log("Done. Apartment icon added next to the house on Home Buyer.");
