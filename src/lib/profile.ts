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
  avatar_path: string;
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
  avatar_path: "",
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
    avatar_path: s(raw?.avatar_path),
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

/* The avatar lives in the same private bucket as inspection photos, so it is
   read through a signed URL rather than a public one. */
export async function avatarUrl(sb: any, path: string): Promise<string | null> {
  if (!path) return null;
  try {
    const { data } = await sb.storage.from("inspection-photos").createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  } catch { return null; }
}

export async function uploadAvatar(sb: any, file: File): Promise<string> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("not signed in");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `avatars/${user.id}-${Date.now()}.${ext || "jpg"}`;
  const { error } = await sb.storage.from("inspection-photos")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}
