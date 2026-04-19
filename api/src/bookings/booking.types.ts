export type BookingFile = {
  id: string;
  /** E.164, e.g. +4915901600682 */
  phoneE164: string;
  clientName: string;
  start: string;
  services: string[];
  durationMinutes: number;
  confirmed: boolean;
  /** Soft delete: excluded from availability / overlap; kept on disk for history */
  canceled: boolean;
};
