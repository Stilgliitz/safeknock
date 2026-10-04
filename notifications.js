// notifications.js
//
// One safe place to load and use expo-notifications.
//
// Expo Go on Android no longer includes push notification support, and from
// Expo SDK 55 onwards simply importing expo-notifications there throws an
// error and crashes the app. Loading the library through this file means the
// rest of the app keeps working: local reminders are switched off in that one
// environment and work everywhere else (Expo Go on iOS, development builds
// and release builds).
import { LogBox, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { getSettings } from './settings';

let Notifications = null;

if (!(Platform.OS === 'android' && isRunningInExpoGo())) {
  // Expo Go prints this notice every time the library loads. SafeKnock only
  // uses local notifications, which are supported, so hide the on-screen toast.
  LogBox.ignoreLogs([
    '`expo-notifications` functionality is not fully supported in Expo Go',
  ]);

  try {
    // Loaded with require (not import) so a failure can be caught here.
    Notifications = require('expo-notifications');
  } catch (error) {
    console.warn('Notifications are unavailable:', error?.message);
  }
}

// True when reminders can be scheduled on this device.
export const notificationsAvailable = Notifications !== null;

// Show notifications as a banner even while the app is open, following the
// switches on the Settings screen.
export function configureNotificationHandler() {
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const settings = await getSettings();
      const show = settings.notifications;

      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show && settings.sound,
        shouldSetBadge: false,
      };
    },
  });
}

// Ask for permission to show notifications. Resolves to true when allowed.
export async function requestNotificationPermission() {
  if (!Notifications) return false;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn('Could not check notification permission:', error?.message);
    return false;
  }
}

// True when visit reminders can be scheduled: the device supports them and
// both switches on the Settings screen are on.
export async function remindersEnabled() {
  if (!Notifications) return false;

  const settings = await getSettings();
  return settings.notifications && settings.reminders;
}

// Schedule a visit reminder for a specific date and time.
// Returns the notification id, or null when reminders are unavailable or
// switched off in Settings.
export async function scheduleReminderAt(date, content) {
  if (!(await remindersEnabled())) return null;

  const settings = await getSettings();

  return Notifications.scheduleNotificationAsync({
    // On Android 8 and later the phone's own notification settings decide the
    // sound, so this flag mainly affects iOS.
    content: { ...content, sound: settings.sound },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

// Show a local notification straight away.
// Returns null when notifications are unavailable or switched off in Settings.
export async function showNotificationNow(content) {
  if (!Notifications) return null;

  const settings = await getSettings();
  if (!settings.notifications) return null;

  return Notifications.scheduleNotificationAsync({
    content: { ...content, sound: settings.sound },
    trigger: null,
  });
}

// Cancel a scheduled notification. Safe to call with a missing or unknown id.
export async function cancelNotification(id) {
  if (!Notifications || !id) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.warn('Could not cancel notification:', error?.message);
  }
}

// Cancel every reminder scheduled on this phone. Used when notifications or
// reminders are switched off in Settings.
export async function cancelAllNotifications() {
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('Could not cancel notifications:', error?.message);
  }
}
