import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export default function HomePage({ navigation }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SafeKnock</Text>
      <Text style={styles.subtitle}>Your Home Safety Companion</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('GroupEntryScreen')}
      >
        <Text style={styles.buttonText}>👥 Join A Group</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('MyPackagesScreen')}
      >
        <Text style={styles.buttonText}>📦 My Packages</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ScheduledVisitsScreen')}
      >
        <Text style={styles.buttonText}>🛠️ Scheduled Visits</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('AwarenessMap')}
      >
        <Text style={styles.buttonText}>🗺️ Awareness Map</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.buttonSecondary}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.buttonTextSecondary}>⚙️ Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonSecondary: {
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  buttonTextSecondary: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
