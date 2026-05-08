import type { DataTableTimeValue } from "../types";

const DEFAULT_LOCALE = "zh-CN";

export function toDate(value: DataTableTimeValue): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDataTableDateTime(value: DataTableTimeValue, locale = DEFAULT_LOCALE) {
  const date = toDate(value);
  if (!date) return null;

  const now = new Date();
  const isSameYear = date.getFullYear() === now.getFullYear();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    year: isSameYear ? undefined : "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value: DataTableTimeValue, locale = DEFAULT_LOCALE) {
  const date = toDate(value);
  if (!date) return null;

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absMs < 45_000) return formatter.format(0, "second");

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (absMs < hour) return formatter.format(Math.round(diffMs / minute), "minute");
  if (absMs < day) return formatter.format(Math.round(diffMs / hour), "hour");
  if (absMs < month) return formatter.format(Math.round(diffMs / day), "day");
  if (absMs < year) return formatter.format(Math.round(diffMs / month), "month");
  return formatter.format(Math.round(diffMs / year), "year");
}

export function formatExactDateTime(value: DataTableTimeValue, locale = DEFAULT_LOCALE) {
  const date = toDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
