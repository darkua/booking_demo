import { DateTime } from 'luxon';
import type { BookingFile } from './booking.types';

export function bookingTimeZone(configured?: string): string {
  return configured?.trim() || 'Europe/Berlin';
}

/** Booking calendar day must be one of today, tomorrow, or the day after (in `zone`). */
export function isStartWithinNextThreeCalendarDays(
  startIso: string,
  zone: string,
): boolean {
  const zStart = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(zone);
  if (!zStart.isValid) return false;
  const today0 = DateTime.now().setZone(zone).startOf('day');
  const lastAllowedDay = today0.plus({ days: 2 }).startOf('day');
  const bookingDay = zStart.startOf('day');
  return bookingDay >= today0 && bookingDay <= lastAllowedDay;
}

/** For logs when a booking time is rejected or when debugging model output. */
export function bookingWindowDiagnostics(startIso: string, zone: string) {
  const zStart = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(zone);
  const today0 = DateTime.now().setZone(zone).startOf('day');
  const lastAllowedDay = today0.plus({ days: 2 }).startOf('day');
  const bookingDay = zStart.isValid ? zStart.startOf('day') : null;
  const inWindow =
    zStart.isValid && bookingDay
      ? bookingDay >= today0 && bookingDay <= lastAllowedDay
      : false;
  return {
    startIsoRaw: startIso,
    salonZone: zone,
    parseValid: zStart.isValid,
    parseError: zStart.isValid
      ? undefined
      : [zStart.invalidReason, zStart.invalidExplanation].filter(Boolean).join(' — ') ||
        zStart.toString(),
    instantInSalonZone: zStart.isValid ? zStart.toISO() : undefined,
    bookingCalendarDay: bookingDay?.toISODate(),
    allowedCalendarDaysInclusive: `${today0.toISODate()} … ${lastAllowedDay.toISODate()}`,
    salonNow: DateTime.now().setZone(zone).toISO(),
    inWindow,
  };
}

/** Template vars for Meta WA appointment template: 1=name, 2=salon, 3=services, 4=day, 5=hour. */
export function formatAppointmentTemplateVars(
  booking: Pick<BookingFile, 'clientName' | 'services' | 'start'>,
  zone: string,
  salonName: string,
): { '1': string; '2': string; '3': string; '4': string; '5': string } {
  const z = DateTime.fromISO(booking.start, { zone: 'utc' }).setZone(zone);
  const services = booking.services.join(', ');
  return {
    '1': booking.clientName,
    '2': salonName,
    '3': services,
    '4': z.toFormat('cccc, d LLL'),
    '5': z.toFormat('HH:mm'),
  };
}

/** UTC ISO range covering the next 3 local calendar days [startOfToday, startOfToday+3) */
export function nextThreeLocalDaysUtcRangeIso(zone: string): { from: string; to: string } {
  const z = DateTime.now().setZone(zone).startOf('day');
  const fromUtc = z.toUTC();
  const toUtc = z.plus({ days: 3 }).toUTC();
  return { from: fromUtc.toISO()!, to: toUtc.toISO()! };
}

/**
 * Injected into LLM system prompts so the model never guesses "today" or past years.
 * Lists the three bookable calendar dates explicitly (salon local days).
 */
export function formatSalonNowAndBookingDaysPrompt(zone: string): string {
  const now = DateTime.now().setZone(zone);
  const d0 = now.startOf('day');
  const d1 = d0.plus({ days: 1 });
  const d2 = d0.plus({ days: 2 });
  return [
    `AUTHORITATIVE CLOCK (do not invent dates/years — use only this): now = ${now.toISO()} | salon timezone = ${zone}`,
    `Today's date in ${zone}: ${d0.toISODate()} (${d0.toFormat('cccc')}).`,
    `Bookable days ONLY (create_booking start must fall on one of these local calendar dates):`,
    `  1) ${d0.toISODate()} — ${d0.toFormat('cccc d MMM yyyy')} (today)`,
    `  2) ${d1.toISODate()} — ${d1.toFormat('cccc d MMM yyyy')} (tomorrow)`,
    `  3) ${d2.toISODate()} — ${d2.toFormat('cccc d MMM yyyy')} (day after tomorrow)`,
    `For create_booking "start", use a full ISO8601 instant on one of those days (example same-day 2pm local: ${d0.set({ hour: 14, minute: 0, second: 0, millisecond: 0 }).toISO()}). Never use past years.`,
  ].join('\n');
}
