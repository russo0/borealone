export const PROPERTY_TIMEZONE = 'Europe/Stockholm';

export function propertyToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PROPERTY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isStayDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function stayNights(checkIn, checkOut) {
  if (!isStayDate(checkIn) || !isStayDate(checkOut) || checkOut <= checkIn) return 0;
  return Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86400000);
}

export function validStayDates(checkIn, checkOut, today = propertyToday()) {
  return isStayDate(checkIn) && checkIn >= today && stayNights(checkIn, checkOut) > 0;
}

export function dateLabel(value, locale = 'en-GB', options = {}) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: PROPERTY_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', ...options
  }).format(new Date(`${value}T12:00:00Z`));
}
