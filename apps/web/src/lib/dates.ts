// Every date the app shows or decides on is in South African time. The
// database stores timestamps in UTC and calendar dates (journal.date,
// statement dates) as UTC midnight, so the browser's or server's own time
// zone must never decide which day or hour is displayed - always go through
// these helpers (or pass APP_TIME_ZONE to Intl).
export const APP_TIME_ZONE = "Africa/Johannesburg";

const dateFormat = new Intl.DateTimeFormat("en-ZA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-ZA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const yearFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
});

/** "08/10/2026" - the date in South African time. */
export const formatDate = (date: Date | string | number) => dateFormat.format(new Date(date));

/** "8 Oct 2026, 14:35" - the date and time in South African time. */
export const formatDateTime = (date: Date | string | number) =>
  dateTimeFormat.format(new Date(date));

/** "2026-10-08" - the calendar day in South African time, for comparing days. */
export const dayKey = (date: Date | string | number) => dayKeyFormat.format(new Date(date));

/** The current year in South African time. */
export const currentYear = () => Number(yearFormat.format(new Date()));
