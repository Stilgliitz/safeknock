// settings.js
//
// The choices on the Settings screen, saved on the phone with AsyncStorage.
// The Settings screen writes them, and notifications.js reads them before it
// schedules or shows anything, so each switch really changes what the app does.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'safeknock.settings';

export const DEFAULT_SETTINGS = {
  notifications: true, // master switch: nothing is scheduled or shown when off
  reminders: true,     // reminders before scheduled visits
  sound: true,         // play a sound with notifications
};

// Kept in memory after the first read, so checking a setting is instant
let cached = null;

// Returns { notifications, reminders, sound }
export async function getSettings() {
  if (cached) return cached;

  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    cached = { ...DEFAULT_SETTINGS, ...(saved ? JSON.parse(saved) : {}) };
    return cached;
  } catch (error) {
    // Nothing readable saved: use the defaults, and try again next time
    console.warn('Could not load settings:', error?.message);
    return { ...DEFAULT_SETTINGS };
  }
}

// Save one setting. Returns the full, updated settings.
export async function saveSetting(key, value) {
  const next = { ...(await getSettings()), [key]: value };
  cached = next;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
