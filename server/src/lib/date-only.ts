import { HttpError } from './http-error';

export function parseDateOnly(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(`${fieldName} must use YYYY-MM-DD format`, 400);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(`${fieldName} must be a valid calendar date`, 400);
  }
  return date;
}

export function utcStartOfToday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
