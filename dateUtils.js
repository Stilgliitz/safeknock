// dateUtils.js
//
// Helpers for reading dates out of Firestore documents. The app saves dates as
// ISO text, but older documents may hold a Firestore timestamp or text that
// can't be parsed, and one unreadable date is enough to break a plain
// `new Date(a) - new Date(b)` sort for the whole list.

// Returns a Date, or null when the value can't be read as a date.
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // Firestore Timestamp
  if (typeof value.toDate === 'function') return value.toDate();

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Text for showing a date and time on screen
export function formatDateTime(value, fallback = 'Date not set') {
  const date = toDate(value);
  return date ? date.toLocaleString() : fallback;
}

// Milliseconds since 1970. Unreadable dates count as "later than everything".
function toTime(value) {
  const date = toDate(value);
  return date ? date.getTime() : Infinity;
}

// Compare two dates for Array.sort, oldest first. Returns 0 when they are equal
// or when neither can be read, so callers can fall through to a tie-breaker.
export function compareDates(a, b) {
  const difference = toTime(a) - toTime(b);
  return Number.isNaN(difference) ? 0 : difference;
}
