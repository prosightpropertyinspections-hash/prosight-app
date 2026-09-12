import type { Report, Finding } from "@/lib/types";

export interface AreaFinding { area: string; f: Finding; }

export function gradeFromCounts(priority:number, monitor:number): string {
  // Matches ProSight's real reports: any priority pulls to C or lower; monitors nudge down; clean = A.
  if (priority === 0 && monitor === 0) return "A";
  if (priority === 0 && monitor <= 2) return "B";
  if (priority === 0) return "B";           // several monitors, still no priority
  if (priority === 1 && monitor <= 2) return "C";
  if (priority === 1) return "C";
  if (priority === 2) return "D";
  return "F";                                // 3+ priority items
}

export function sectionCounts(section:{findings?:Finding[]}){
  const f = section.findings || [];
  return {
    priority: f.filter(x=>x.severity==="priority").length,
    monitor:  f.filter(x=>x.severity==="monitor").length,
    satisfactory: f.filter(x=>x.severity==="satisfactory").length,
  };
}

export function buildModel(report:Report){
  const withF = (report.sections||[]).filter(s => (s.findings?.length||0) > 0);
  const allF: AreaFinding[] = [];
  withF.forEach(s => (s.findings||[]).forEach(f => allF.push({ area:s.name, f })));

  const cP = allF.filter(x=>x.f.severity==="priority").length;
  const cM = allF.filter(x=>x.f.severity==="monitor").length;
  const cS = allF.filter(x=>x.f.severity==="satisfactory").length;

  // Overall grade = worst-leaning average of section grades, but simplest robust proxy:
  // grade from total priority/monitor across the home.
  const overall = gradeFromCounts(cP, cM);

  const priority = allF.filter(x=>x.f.severity==="priority");
  const monitor  = allF.filter(x=>x.f.severity==="monitor");

  const graded = withF.map(s=>{
    const c = sectionCounts(s);
    return { section:s, counts:c, grade: gradeFromCounts(c.priority, c.monitor) };
  });

  return { withF, allF, cP, cM, cS, overall, priority, monitor, graded };
}

export const GRADE_DESC: Record<string,string> = {
  A:"Excellent — no action required",
  B:"Good — minor maintenance",
  C:"Fair — repairs recommended",
  D:"Marginal — several priority items",
  F:"Poor — significant repairs needed",
};

export function coverImage(report:Report, urls:Record<string,string>, allF:AreaFinding[]):string|null{
  if (report.cover_photo && urls[report.cover_photo]) return urls[report.cover_photo];
  const first = allF.find(x=>x.f.photo_path && urls[x.f.photo_path!]);
  return first ? urls[first.f.photo_path!] : null;
}
