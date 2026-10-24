// Condo bookings are saved with the service "Condo inspection" instead of "Full home inspection".
// Run from the prosight-app folder:  node condo-service-name.js
const fs = require("fs");
const path = "src/app/api/book/route.ts";
if (!fs.existsSync(path)) { console.error("Run this from the prosight-app folder."); process.exit(1); }
let s = fs.readFileSync(path, "utf8");
if (s.includes("savedServices")) { console.log("Already done. Nothing to do."); process.exit(0); }

const a = /service: services\[0\] \|\| "Full home inspection",\r?\n(\s*)services: services\.length \? services : \["Full home inspection"\],/;
if (!a.test(s)) { console.error("Could not find the services lines in route.ts. No changes made."); process.exit(1); }
s = s.replace(a, (m, indent) => `service: savedServices[0],\n${indent}services: savedServices,`);

const b = /(\r?\n)(\s*)const row: any = \{/;
if (!b.test(s)) { console.error("Could not find where the booking row is built. No changes made."); process.exit(1); }
s = s.replace(b, (m, nl, indent) =>
`${nl}${indent}// A condo is saved as "Condo inspection" so it reads correctly in the schedule. The price was already worked out above.` +
`${nl}${indent}const savedServices = (services.length ? services : ["Full home inspection"])` +
`${nl}${indent}  .map(s => (b.property_type === "condo" && s === "Full home inspection" ? "Condo inspection" : s));` +
`${nl}${indent}const row: any = {`);

fs.writeFileSync(path, s, "utf8");
console.log('Done. Condo bookings now save as "Condo inspection".');
