import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme';
import { auth } from '../firebaseConfig';

export default function SplashScreen({ navigation }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 3500,
      useNativeDriver: true,
    }).start();

    let cancelled = false;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Show the splash for at least 2.5 seconds while Firebase restores any
    // saved session (capped at 5 seconds so a slow restore can't block the app).
    const sessionRestored = Promise.race([auth.authStateReady(), wait(5000)]);

    Promise.all([sessionRestored, wait(2500)])
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        // Users who are already signed in go straight to the home screen.
        navigation.replace(auth.currentUser ? 'HomePage' : 'Login');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Text style={styles.title}>SafeKnock</Text>
        <Text style={styles.tagline}>Your trusted delivery safety assistant</Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

