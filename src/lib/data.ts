"use client";
import { createClient } from "@/lib/supabase-browser";
import type { Report, Section } from "@/lib/types";

const sb = () => createClient();

export async function listReports(): Promise<Report[]> {
  const { data, error } = await sb().from("reports").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Report[];
}

export async function getReport(id: string): Promise<Report | null> {
  const { data: rep } = await sb().from("reports").select("*").eq("id", id).single();
  if (!rep) return null;
  const { data: secs } = await sb().from("sections").select("*").eq("report_id", id).order("sort_order");
  const { data: finds } = await sb().from("findings").select("*").eq("report_id", id).order("sort_order");
  (secs || []).forEach((s: any) => { s.findings = (finds || []).filter((f: any) => f.section_id === s.id); });
  (rep as any).sections = secs || [];
  return rep as Report;
}

export async function createReportWithSections(report: Partial<Report>, sections: Partial<Section>[]) {
  const { data: { user } } = await sb().auth.getUser();
  if (!user) throw new Error("not signed in");
  const { data: rep, error } = await sb().from("reports")
    .insert({ ...report, owner: user.id }).select().single();
  if (error) throw error;
  if (sections.length) {
    const rows = sections.map((s, i) => ({ ...s, report_id: rep.id, owner: user.id, sort_order: i }));
    await sb().from("sections").insert(rows);
  }
  return rep as Report;
}

export async function deleteReport(id: string) {
  await sb().from("reports").delete().eq("id", id);
}

export async function updateReport(id: string, patch: Partial<Report>) {
  await sb().from("reports").update(patch).eq("id", id);
}
