// Phones: stack the apartment icon under the house icon on Home Buyer so the text lines up with the other cards.
// Run from the prosight-app folder:  node stack-condo-icon.js
const fs = require("fs");
const path = "src/app/book/page.tsx";
if (!fs.existsSync(path)) { console.error("Run this from the prosight-app folder."); process.exit(1); }
let s = fs.readFileSync(path, "utf8");
if (s.includes("/* bk-ico2 stacked */")) { console.log("Already done. Nothing to do."); process.exit(0); }
const old = "@media (max-width:620px){ .bk-ico2{ width:auto; min-width:48px; padding:0 10px; gap:7px; } .bk-ico2 svg{ width:21px; height:21px; flex-shrink:0; } .bk-ico2 i{ height:18px; } .bk-types button:has(.bk-ico2){ grid-template-columns:auto 1fr; } }";
if (!s.includes(old)) { console.error("Could not find the earlier icon styles. Run add-condo-icon.js first. No changes made."); process.exit(1); }
const neu = "/* bk-ico2 stacked */\n@media (max-width:620px){ .bk-ico2{ flex-direction:column; width:48px; min-width:0; height:auto; padding:9px 0; gap:6px; } .bk-ico2 svg{ width:22px; height:22px; flex-shrink:0; } .bk-ico2 i{ width:18px; height:1px; } }";
s = s.replace(old, neu);
fs.writeFileSync(path, s, "utf8");
console.log("Done. On phones the apartment icon now sits under the house icon.");
