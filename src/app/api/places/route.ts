import { NextRequest, NextResponse } from "next/server";

/* Address suggestions for the booking form, via Google Places (New).
   The key stays on the server. Suggestions are limited to Southeast Michigan,
   which is also where the business inspects, so nobody books a house in Ohio.

   GET ?q=25457 andov&s=<session>   → { suggestions: [{ id, main, sub }] }
   GET ?id=<placeId>&s=<session>    → { street, city, state, zip }
   Without GOOGLE_MAPS_API_KEY it returns nothing and the form works as before. */

const KEY = process.env.GOOGLE_MAPS_API_KEY;

// Roughly Wayne, Oakland, Macomb and Washtenaw counties, with some margin.
const AREA = { rectangle: { low: { latitude: 41.95, longitude: -84.25 }, high: { latitude: 42.95, longitude: -82.4 } } };

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ suggestions: [], error: "GOOGLE_MAPS_API_KEY is not set on the server." });
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const id = req.nextUrl.searchParams.get("id") || "";
  const s = (req.nextUrl.searchParams.get("s") || "").slice(0, 64);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(s)) return NextResponse.json({ error: "bad session" }, { status: 400 });

  try {
    if (id) {
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
      const r = await fetch(`https://places.googleapis.com/v1/places/${id}?sessionToken=${encodeURIComponent(s)}`, {
        headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "addressComponents" },
      });
      const j = await r.json();
      const comps: any[] = j.addressComponents || [];
      const get = (t: string, short = false) => {
        const c = comps.find(c => (c.types || []).includes(t));
        return c ? (short ? c.shortText : c.longText) || "" : "";
      };
      const street = [get("street_number"), get("route", true)].filter(Boolean).join(" ");
      const city = get("locality") || get("sublocality") || get("postal_town") || get("administrative_area_level_3");
      return NextResponse.json({ street, city, state: get("administrative_area_level_1", true), zip: get("postal_code") });
    }

    if (q.length < 3 || q.length > 100) return NextResponse.json({ suggestions: [] });
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
      body: JSON.stringify({
        input: q, sessionToken: s, includedRegionCodes: ["us"], locationRestriction: AREA,
        includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      }),
    });
    const j = await r.json();
    if (!r.ok) return NextResponse.json({ suggestions: [], error: j?.error?.message || `Google returned ${r.status}` });
    const suggestions = (j.suggestions || [])
      .map((x: any) => x.placePrediction)
      .filter(Boolean)
      .slice(0, 5)
      .map((p: any) => ({
        id: p.placeId,
        main: p.structuredFormat?.mainText?.text || p.text?.text || "",
        sub: p.structuredFormat?.secondaryText?.text || "",
      }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
