import type { Report, Section } from "@/lib/types";

export const ROOM_DEFS = [
  {k:"bedroom",l:"Bedrooms",s:"One section each"},{k:"bathroom",l:"Bathrooms",s:"Full and half"},
  {k:"kitchen",l:"Kitchens",s:""},{k:"living",l:"Living rooms",s:""},
  {k:"family",l:"Family / rec rooms",s:""},{k:"dining",l:"Dining rooms",s:""},
  {k:"laundry",l:"Laundry rooms",s:""},{k:"office",l:"Offices / dens",s:""},
];
export const SYS_DEFS = [
  {k:"roofing",l:"Roofing system",s:"Main dwelling roof"},{k:"exterior",l:"Exterior & siding",s:"Cladding, foundation, grading"},
  {k:"basement",l:"Basement / foundation",s:""},{k:"crawlspace",l:"Crawlspace",s:"Access, framing, moisture"},
  {k:"mechanical",l:"Utility / mechanical",s:"HVAC, water heater, panel"},
  {k:"ac",l:"A/C condenser",s:"Exterior unit"},{k:"deck",l:"Deck / porch",s:""},{k:"sewer",l:"Sewer scope",s:"Camera inspection"},
];

export function buildSkeleton(d: Pick<Report,"rooms"|"systems"|"garage"|"extras">): Partial<Section>[] {
  const a: Partial<Section>[] = [];
  const g = (name: string, grp: string) => a.push({ name, grp, subtitle: "" });
  const rep = (key: string, base: string, grp: string) => {
    const n = d.rooms[key] || 0;
    for (let i = 1; i <= n; i++) g(n > 1 ? `${base} ${i}` : base, grp);
  };
  if (d.systems.roofing) g("Roofing System", "Exterior");
  if (d.systems.exterior) g("Exterior & Siding", "Exterior");
  if (d.systems.deck) g("Deck / Porch", "Exterior");
  if (d.systems.basement) g("Basement", "Structure");
  if (d.systems.crawlspace) g("Crawlspace", "Structure");
  if (d.systems.mechanical) g("Utility / Mechanical Room", "Systems");
  rep("kitchen","Interior — Kitchen","Interior"); rep("living","Interior — Living Room","Interior");
  rep("family","Interior — Family Room","Interior"); rep("dining","Interior — Dining Room","Interior");
  rep("laundry","Laundry Room","Interior"); rep("bathroom","Interior — Bathroom","Interior");
  rep("bedroom","Interior — Bedroom","Interior"); rep("office","Interior — Office","Interior");
  if (d.garage === "attached") g("Attached Garage", "Structure");
  if (d.garage === "detached") g("Detached Garage", "Structure");
  if (d.systems.ac) g("Air-Conditioning Condenser", "Systems");
  (d.extras || []).forEach(e => g(e, "Custom"));
  if (d.systems.sewer) g("Sewer Scope Inspection", "Systems");
  return a;
}
