// policeData.js
//
// Street-level crime from the official UK police open data API
// (https://data.police.uk/docs/). It is free and needs no API key.
//
// Things to know about the data:
// - It is published monthly, a couple of months behind.
// - Each crime's location is an approximate point on or near a street, not the
//   exact address.
// - A request by latitude and longitude returns crimes within one mile.
// - It covers England, Wales and Northern Ireland.

const API_URL = 'https://data.police.uk/api/crimes-street/all-crime';
const REQUEST_TIMEOUT_MS = 15000;
const CACHE_MINUTES = 60;

// The API returns crimes within one mile of the point asked for
export const SEARCH_RADIUS_METRES = 1609;

// The crime types most relevant to doorstep and household safety
export const DOORSTEP_CATEGORIES = {
  'burglary': 'Burglary',
  'robbery': 'Robbery',
  'theft-from-the-person': 'Theft from the person',
  'vehicle-crime': 'Vehicle crime',
  'criminal-damage-arson': 'Criminal damage and arson',
  'anti-social-behaviour': 'Anti-social behaviour',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "2026-08" -> "August 2026"
export function formatMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!match) return 'the latest month';
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

// A simple band for the number of doorstep-related crimes recorded within a
// mile in one month. It is a rough guide for the summary card, not an official
// rating: a busy town centre will always score higher than a quiet village.
export function crimeLevel(total) {
  if (total >= 150) return 'high';
  if (total >= 50) return 'medium';
  return 'low';
}

// Distance between two { latitude, longitude } points (haversine formula)
export function distanceInMetres(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

// Turn the API's list of individual crimes into what the map needs:
// totals per category, and "hotspots" (crimes grouped by the street point the
// police attached them to), busiest first.
export function summariseCrimes(crimes) {
  const counts = {};
  const hotspotsById = {};
  let total = 0;
  let month = null;

  for (const crime of Array.isArray(crimes) ? crimes : []) {
    if (!crime) continue;
    if (!month && crime.month) month = crime.month;
    if (!DOORSTEP_CATEGORIES[crime.category]) continue;

    const latitude = parseFloat(crime.location && crime.location.latitude);
    const longitude = parseFloat(crime.location && crime.location.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) continue;

    total += 1;
    counts[crime.category] = (counts[crime.category] || 0) + 1;

    const street = (crime.location && crime.location.street) || {};
    const id = street.id != null ? String(street.id) : `${latitude},${longitude}`;

    if (!hotspotsById[id]) {
      hotspotsById[id] = {
        id,
        latitude,
        longitude,
        street: street.name || 'Unnamed location',
        count: 0,
        counts: {},
      };
    }
    hotspotsById[id].count += 1;
    hotspotsById[id].counts[crime.category] = (hotspotsById[id].counts[crime.category] || 0) + 1;
  }

  const hotspots = Object.values(hotspotsById).sort((a, b) => b.count - a.count);

  // Categories as a list, most common first, ready to display
  const categories = Object.keys(counts)
    .map((key) => ({ key, label: DOORSTEP_CATEGORIES[key], count: counts[key] }))
    .sort((a, b) => b.count - a.count);

  return { month, total, counts, categories, hotspots, level: crimeLevel(total) };
}

const cache = new Map();

// Fetch and summarise the latest month of crime within a mile of a point.
// Results are kept in memory for an hour so reopening the map is instant.
export async function fetchNearbyCrime(latitude, longitude) {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_MINUTES * 60 * 1000) {
    return cached.summary;
  }

  // Give up if the API hasn't answered in time, instead of waiting forever
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}?lat=${latitude}&lng=${longitude}`, {
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new Error('There is too much data for this area in one request.');
    }
    if (response.status === 429) {
      throw new Error('The police data service is busy. Try again in a moment.');
    }
    if (!response.ok) {
      throw new Error(`The police data service returned an error (${response.status}).`);
    }

    const crimes = await response.json();
    if (!Array.isArray(crimes)) {
      throw new Error('The police data service returned something unexpected.');
    }

    const summary = summariseCrimes(crimes);
    cache.set(key, { savedAt: Date.now(), summary });
    return summary;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The police data service took too long to respond.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
