/* Business and inspector details. One row per user, read by the report so a
   change here reaches every report rather than being retyped per job. */
export type Profile = {
  company_name: string;
  legal_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  inspector_name: string;
  internachi_id: string;
  license_no: string;
  default_theme: string;
  standards_note: string;
};

export const DEFAULT_PROFILE: Profile = {
  company_name: "ProSight Property Inspections",
  legal_name: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  inspector_name: "",
  internachi_id: "",
  license_no: "",
  default_theme: "estate",
  standards_note: "",
};

export function normalizeProfile(raw: any): Profile {
  const s = (v: any, d = "") => (typeof v === "string" && v.trim() ? v : d);
  return {
    company_name: s(raw?.company_name, DEFAULT_PROFILE.company_name),
    legal_name: s(raw?.legal_name),
    address: s(raw?.address),
    phone: s(raw?.phone),
    email: s(raw?.email),
    website: s(raw?.website),
    inspector_name: s(raw?.inspector_name),
    internachi_id: s(raw?.internachi_id),
    license_no: s(raw?.license_no),
    default_theme: s(raw?.default_theme, "estate"),
    standards_note: s(raw?.standards_note),
  };
}

export async function loadProfile(sb: any): Promise<Profile> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return DEFAULT_PROFILE;
  const { data } = await sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return normalizeProfile(data);
}

export async function saveProfile(sb: any, p: Profile) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await sb.from("profiles")
    .upsert({ ...p, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
