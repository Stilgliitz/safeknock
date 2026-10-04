// theme.js
//
// Light and dark themes for the whole app.
//
// <ThemeProvider> wraps the app, remembers the user's choice in AsyncStorage
// and makes the active colours available to every screen through useTheme().
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from './constants/colors';

const STORAGE_KEY = 'safeknock.theme';

const ThemeContext = createContext({
  mode: 'dark',
  isDark: true,
  colors: darkColors,
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('dark');
  const [loaded, setLoaded] = useState(false);

  // Restore the saved choice before showing anything, so the app doesn't
  // flash the wrong theme on launch.
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!cancelled && (saved === 'light' || saved === 'dark')) {
          setModeState(saved);
        }
      })
      .catch(() => {
        // Nothing saved or storage unavailable: keep the default theme
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((nextMode) => {
    setModeState(nextMode);
    AsyncStorage.setItem(STORAGE_KEY, nextMode).catch((error) => {
      console.warn('Could not save the theme choice:', error?.message);
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? darkColors : lightColors,
      setMode,
    }),
    [mode, setMode]
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Returns { mode, isDark, colors, setMode }
export function useTheme() {
  return useContext(ThemeContext);
}
