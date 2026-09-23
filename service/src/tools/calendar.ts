// US equity session clock (NYSE hours, America/New_York). xStocks trade 24/7
// on OKX, but outside regular hours their price is the last close plus a
// market estimate, so agents need to know which regime a quote belongs to.
// Source: nyse.com/markets/hours-calendars (2026–2027).

const HOLIDAYS: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-01-19": "Martin Luther King Jr. Day",
  "2026-02-16": "Washington's Birthday",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-06-19": "Juneteenth",
  "2026-07-03": "Independence Day (observed)",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving Day",
  "2026-12-25": "Christmas Day",
  "2027-01-01": "New Year's Day",
  "2027-01-18": "Martin Luther King Jr. Day",
  "2027-02-15": "Washington's Birthday",
  "2027-03-26": "Good Friday",
  "2027-05-31": "Memorial Day",
  "2027-06-18": "Juneteenth (observed)",
  "2027-07-05": "Independence Day (observed)",
  "2027-09-06": "Labor Day",
  "2027-11-25": "Thanksgiving Day",
  "2027-12-24": "Christmas Day (observed)",
};

const EARLY_CLOSES = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

const TZ = "America/New_York";
const PRE_OPEN = 4 * 60;
const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const EARLY_CLOSE = 13 * 60;
const POST_CLOSE = 20 * 60;

interface EtClock {
  date: string; // YYYY-MM-DD in New York
  minutes: number; // minutes since local midnight
  weekday: number; // 0 = Sunday
}

function etClock(at: Date): EtClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday,
  };
}

// UTC instant for a New York wall-clock time (handles DST via Intl).
function etToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const seen = etClock(new Date(guess));
  const seenUtc = Date.UTC(
    ...(seen.date.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]),
    Math.floor(seen.minutes / 60),
    seen.minutes % 60,
  );
  return new Date(guess + (guess - seenUtc));
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isTradingDay(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS[date];
}

const closeFor = (date: string) => (EARLY_CLOSES.has(date) ? EARLY_CLOSE : CLOSE);

export type SessionPhase = "pre_market" | "regular" | "post_market" | "closed";

export interface EquitySession {
  phase: SessionPhase;
  reason: string;
  nowNewYork: string;
  nextOpen: string;
  nextClose: string;
  earlyClose: boolean;
}

export function equitySession(at: Date = new Date()): EquitySession {
  const now = etClock(at);
  const trading = isTradingDay(now.date);
  const close = closeFor(now.date);
  const postClose = EARLY_CLOSES.has(now.date) ? 17 * 60 : POST_CLOSE;

  let phase: SessionPhase = "closed";
  let reason: string;
  if (!trading) {
    reason = HOLIDAYS[now.date] ? `holiday: ${HOLIDAYS[now.date]}` : "weekend";
  } else if (now.minutes >= OPEN && now.minutes < close) {
    phase = "regular";
    reason = EARLY_CLOSES.has(now.date) ? "regular session (early close 13:00 ET)" : "regular session";
  } else if (now.minutes >= PRE_OPEN && now.minutes < OPEN) {
    phase = "pre_market";
    reason = "pre-market";
  } else if (now.minutes >= close && now.minutes < postClose) {
    phase = "post_market";
    reason = "after-hours";
  } else {
    reason = "overnight";
  }

  // Next regular open strictly after now, and the close of the current or next session.
  let openDay = now.date;
  if (!(trading && now.minutes < OPEN)) openDay = addDays(openDay, 1);
  while (!isTradingDay(openDay)) openDay = addDays(openDay, 1);
  const closeDay = phase === "regular" ? now.date : openDay;

  return {
    phase,
    reason,
    nowNewYork: `${now.date} ${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")} ET`,
    nextOpen: etToUtc(openDay, OPEN).toISOString(),
    nextClose: etToUtc(closeDay, closeFor(closeDay)).toISOString(),
    earlyClose: EARLY_CLOSES.has(closeDay),
  };
}
