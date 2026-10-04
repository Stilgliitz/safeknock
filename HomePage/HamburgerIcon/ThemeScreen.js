import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

// The themes the user can pick from
const OPTIONS = [
  {
    mode: 'dark',
    icon: '🌙',
    label: 'Dark',
    description: 'The original SafeKnock look. Easier on the eyes at night.',
  },
  {
    mode: 'light',
    icon: '☀️',
    label: 'Light',
    description: 'A brighter look that is easier to read outdoors.',
  },
];

export default function ThemeScreen() {
  const { colors: COLORS, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 App Theme</Text>
      <Text style={styles.intro}>Choose how SafeKnock looks. The change applies straight away.</Text>

      {OPTIONS.map((option) => {
        const selected = option.mode === mode;

        return (
          <TouchableOpacity
            key={option.mode}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => setMode(option.mode)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label} theme`}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>

            <View style={styles.optionBody}>
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>

            {/* Radio button: filled in for the active theme */}
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.note}>Your choice is saved on this phone.</Text>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  intro: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.card,
    padding: 16,
    marginBottom: 14,
  },
  optionSelected: {
    borderColor: COLORS.primary,
  },
  optionIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  optionBody: {
    flex: 1,
  },
  optionLabel: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: 'bold',
  },
  optionDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  note: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
});
