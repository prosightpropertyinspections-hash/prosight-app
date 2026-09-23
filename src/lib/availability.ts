/* One rule for what counts as a clash, shared by the public booking page and
   the schedule, so the website and the app can never disagree about whether
   a time is free.

   Two bookings clash when their time ranges overlap. A new booking that would
   run into the start of an existing one clashes too, not only one that starts
   inside it: with someone booked at 11:30, a 2-hour job at 10:00 is blocked. */

export const BOOKING_MIN = 120; // length of a website booking, and the default

export type Busy = {
  id?: string;
  starts_at: string;
  duration_min?: number | null;
  status?: string | null;
  client_name?: string | null;
};

/** Bookings that a job starting at `startMs` and lasting `durMin` would overlap. */
export function conflicts<T extends Busy>(startMs: number, durMin: number, list: T[], excludeId?: string): T[] {
  const end = startMs + durMin * 60_000;
  return list.filter(a => {
    if (a.status === "canceled") return false;
    if (excludeId && a.id === excludeId) return false;
    const s = new Date(a.starts_at).getTime();
    const e = s + (a.duration_min || BOOKING_MIN) * 60_000;
    return startMs < e && end > s;
  });
}
