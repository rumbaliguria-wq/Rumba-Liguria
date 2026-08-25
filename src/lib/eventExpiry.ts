/**
 * Computes the UTC timestamp (ms) at which an event expires.
 * Rule: event_date_iso is the calendar day the event starts (e.g. "2026-04-01" for
 * a Wednesday night party). The event runs into the early hours of the NEXT day,
 * so expiry = NEXT DAY at 05:00 Rome time.
 * e.g. Wednesday 2026-04-01 → Thursday 2026-04-02 at 05:00 Rome → expired after that.
 */
export function getEventExpiryUTC(eventDateIso: string): number {
  const [ey, em, ed] = eventDateIso.split("-").map(Number);
  // Next calendar day at ~03:00 UTC as starting point for binary search
  const approx = Date.UTC(ey, em - 1, ed + 1, 3, 0, 0);
  // Target: "YYYY-MM-DD 05:00" in Rome local time (next day)
  const nextDay = ed + 1;
  const mm = String(em).padStart(2, "0");
  // We need to handle month/year overflow — use Date to get next day properly
  const nextDate = new Date(Date.UTC(ey, em - 1, ed + 1));
  const ny = nextDate.getUTCFullYear();
  const nm = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(nextDate.getUTCDate()).padStart(2, "0");
  const targetRome = `${ny}-${nm}-${nd} 05:00`;

  // Binary search: find the UTC ms where Rome clock = targetRome
  let lo = approx - 4 * 3600000;
  let hi = approx + 4 * 3600000;
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const romeAtMid = new Date(mid)
      .toLocaleString("en-CA", { timeZone: "Europe/Rome", hour12: false })
      .replace(",", "")
      .slice(0, 16);
    if (romeAtMid <= targetRome) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Returns true if the event has expired (past Thursday 05:00 Rome for a Wednesday event) */
export function isEventExpired(eventDateIso: string): boolean {
  return Date.now() > getEventExpiryUTC(eventDateIso);
}

/**
 * Sales close at 00:00 Rome time the day AFTER the event.
 * e.g. Wednesday 2026-04-01 → sales close Thursday 2026-04-02 at 00:00 Rome (midnight).
 */
export function getSaleCloseUTC(eventDateIso: string): number {
  const [ey, em, ed] = eventDateIso.split("-").map(Number);
  const nextDate = new Date(Date.UTC(ey, em - 1, ed + 1));
  const ny = nextDate.getUTCFullYear();
  const nm = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(nextDate.getUTCDate()).padStart(2, "0");
  const targetRome = `${ny}-${nm}-${nd} 00:00`;
  const approx = Date.UTC(ey, em - 1, ed + 1, 0, 0, 0);
  let lo = approx - 4 * 3600000;
  let hi = approx + 4 * 3600000;
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const romeAtMid = new Date(mid)
      .toLocaleString("en-CA", { timeZone: "Europe/Rome", hour12: false })
      .replace(",", "")
      .slice(0, 16);
    if (romeAtMid <= targetRome) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Returns the ISO date string (YYYY-MM-DD) that is "past expiry" threshold.
 * Any event with event_date_iso <= this date AND current time > 05:00 Rome next day
 * should be archived.
 * Since we can't do time-of-day filtering in SQL, we:
 *  - If current Italy time >= 05:00 → archive events from yesterday and before
 *  - If current Italy time < 05:00  → archive events from 2 days ago and before
 * This ensures a Wednesday event is NOT archived at midnight Wednesday→Thursday,
 * but IS archived after Thursday 05:00.
 */
export function getArchiveThresholdDate(): string {
  const now = new Date();
  // Get current hour in Rome timezone
  const romeHour = parseInt(
    now.toLocaleString("en-US", { timeZone: "Europe/Rome", hour: "numeric", hour12: false })
  );
  // Get today's date in Rome timezone
  const todayRome = now.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  const [ty, tm, td] = todayRome.split("-").map(Number);

  if (romeHour >= 5) {
    // After 05:00 → archive events whose date was yesterday or earlier
    const yesterday = new Date(Date.UTC(ty, tm - 1, td - 1));
    return yesterday.toISOString().slice(0, 10);
  } else {
    // Before 05:00 (still "last night") → archive events from 2 days ago or earlier
    // This keeps today's event alive during the night it runs
    const twoDaysAgo = new Date(Date.UTC(ty, tm - 1, td - 2));
    return twoDaysAgo.toISOString().slice(0, 10);
  }
}
