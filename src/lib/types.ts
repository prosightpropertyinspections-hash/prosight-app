export type Severity = "priority" | "monitor" | "satisfactory";

export interface Annotation { x:number; y:number; rx:number; ry:number; color:string; label:string; }

export interface Finding {
  id: string; section_id: string; report_id: string;
  title: string; note: string; ai_text: string;
  severity: Severity; photo_path: string | null;
  annotations: Annotation[]; sort_order: number;
}

export interface Section {
  id: string; report_id: string;
  name: string; subtitle: string; grp: string; sort_order: number;
  findings?: Finding[];
}

export interface Report {
  id: string; owner: string; status: "draft" | "done";
  client: string; address: string; inspection_date: string | null;
  inspection_time: string; property_type: string; inspector: string;
  nachi_id: string; report_no: string;
  rooms: Record<string, number>;
  systems: Record<string, boolean>;
  garage: string; extras: string[];
  theme: string; cover_photo: string | null; overall_grade: string | null;
  created_at: string; updated_at: string;
  sections?: Section[];
}
