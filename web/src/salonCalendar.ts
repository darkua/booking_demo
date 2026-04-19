import { DateTime } from 'luxon';

const DEFAULT_ZONE = 'Europe/Berlin';

/** Must match API `BOOKING_TIMEZONE` so the grid matches server booking rules. */
export function getSalonZone(): string {
  const raw = import.meta.env.VITE_BOOKING_TIMEZONE;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_ZONE;
}

/** Start of each of the next 3 local calendar days in the salon zone (same rule as API). */
export function salonThreeDayStarts(): DateTime[] {
  const zone = getSalonZone();
  const today0 = DateTime.now().setZone(zone).startOf('day');
  return [0, 1, 2].map((off) => today0.plus({ days: off }));
}

export function formatSalonWindowSubtitle(): string {
  const days = salonThreeDayStarts();
  const z = getSalonZone();
  return `${days[0].toISODate()} · ${days[1].toISODate()} · ${days[2].toISODate()} (${z})`;
}

export function bookingInSalonCell(
  startIso: string,
  dayColumn: DateTime,
  hour: number,
): boolean {
  const zone = getSalonZone();
  const z = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(zone);
  if (!z.isValid) return false;
  return z.startOf('day').equals(dayColumn.startOf('day')) && z.hour === hour;
}

export function formatBookingTimeInSalon(startIso: string): string {
  const z = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(getSalonZone());
  return z.isValid ? z.toFormat('HH:mm') : '—';
}
