/* Website prices. One table used by the booking page to show prices and by
   the server to record the fee, so the customer sees exactly what is saved. */

export const INSPECTION_TIERS = [
  { max: 1250, price: 420, label: "Up to 1,250 sq ft" },
  { max: 1750, price: 480, label: "1,251 to 1,750 sq ft" },
  { max: 2500, price: 520, label: "1,751 to 2,500 sq ft" },
  { max: Infinity, price: 560, label: "Over 2,500 sq ft" },
];

/** Fixed add-on prices. null = quoted separately. */
export const ADDON_PRICES: Record<string, number | null> = {
  "Sewer scope": 150,
  "Radon test": 200,
  "Mold / air quality": null,
};

export const FULL_INSPECTION = "Full home inspection";

export function inspectionTier(sqft: number) {
  if (!sqft || sqft <= 0) return null;
  return INSPECTION_TIERS.find(t => sqft <= t.max) || null;
}

export type QuoteLine = { label: string; price: number | null };

export function quote(services: string[], sqft: number) {
  const lines: QuoteLine[] = services.map(s => {
    if (s === FULL_INSPECTION) {
      const t = inspectionTier(sqft);
      return { label: "Home inspection", price: t ? t.price : null };
    }
    return { label: s, price: s in ADDON_PRICES ? ADDON_PRICES[s] : null };
  });
  const total = lines.reduce((n, l) => n + (l.price || 0), 0);
  return { lines, total, quoted: lines.some(l => l.price === null) };
}

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
