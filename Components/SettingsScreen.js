import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import {
  cancelAllNotifications,
  notificationsAvailable,
  requestNotificationPermission,
} from '../notifications';
import { DEFAULT_SETTINGS, getSettings, saveSetting } from '../settings';
import { useTheme } from '../theme';

export default function SettingsScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Load the saved choices when the screen opens
  useEffect(() => {
    let cancelled = false;

    getSettings().then((saved) => {
      if (!cancelled) setSettings(saved);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update the switch straight away, then save the choice on the phone
  const update = async (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));

    try {
      await saveSetting(key, value);
    } catch (error) {
      console.warn(`Failed to save ${key}:`, error?.message);
    }
  };

  const toggleNotifications = async (value) => {
    if (value) {
      // Turning notifications on only means something if the phone allows them
      const granted = await requestNotificationPermission();

      if (!granted) {
        Alert.alert(
          'Notifications are blocked',
          'Allow notifications for this app in your phone settings, then switch this on again.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    } else {
      // Nothing should arrive after this is switched off
      await cancelAllNotifications();
    }

    update('notifications', value);
  };

  const toggleReminders = async (value) => {
    if (!value) await cancelAllNotifications();
    update('reminders', value);
  };

  const switchColors = { false: COLORS.border, true: COLORS.primary };
  const notificationsOn = notificationsAvailable && settings.notifications;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>⚙️ App Settings</Text>

      <Text style={styles.sectionTitle}>Notifications</Text>

      {!notificationsAvailable && (
        <Text style={styles.notice}>
          Notifications are not available in Expo Go on Android. They work in a full build of the app.
        </Text>
      )}

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>🔔 Notifications</Text>
          <Text style={styles.description}>
            Allow SafeKnock to send notifications on this phone. Switching this off also cancels reminders already set.
          </Text>
        </View>
        <Switch
          value={notificationsOn}
          onValueChange={toggleNotifications}
          disabled={!notificationsAvailable}
          trackColor={switchColors}
          accessibilityLabel="Notifications"
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>🔁 Visit reminders</Text>
          <Text style={styles.description}>
            Remind me before a scheduled visit. Switching this off also cancels reminders already set.
          </Text>
        </View>
        <Switch
          value={notificationsOn && settings.reminders}
          onValueChange={toggleReminders}
          disabled={!notificationsOn}
          trackColor={switchColors}
          accessibilityLabel="Visit reminders"
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>🔊 Sound</Text>
          <Text style={styles.description}>
            {Platform.OS === 'android'
              ? 'Play a sound with notifications. On Android, your phone\'s own notification settings can override this.'
              : 'Play a sound with notifications.'}
          </Text>
        </View>
        <Switch
          value={notificationsOn && settings.sound}
          onValueChange={(value) => update('sound', value)}
          disabled={!notificationsOn}
          trackColor={switchColors}
          accessibilityLabel="Sound"
        />
      </View>

      <Text style={styles.sectionTitle}>Appearance</Text>

      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('App Theme')}
        accessibilityRole="button"
      >
        <View style={styles.rowText}>
          <Text style={styles.label}>🎨 Theme</Text>
          <Text style={styles.description}>Switch between the dark and light look.</Text>
        </View>
        <Text style={styles.value}>{isDark ? 'Dark' : 'Light'}  ›</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>These settings are saved on this phone.</Text>
    </ScrollView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 4,
  },
  notice: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  rowText: {
    flex: 1,
    paddingRight: 14,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  value: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  footnote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
