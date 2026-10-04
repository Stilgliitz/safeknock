import React, { useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import MainDrawerNavigator from './navigation/MainDrawerNavigator';
import GroupEntryScreen from './HomePage/GroupEntryScreen';
import MyPackagesScreen from './HomePage/MyPackagesScreen';
import ScheduledVisitsScreen from './HomePage/ScheduledVisitsScreen';
import {
  configureNotificationHandler,
  notificationsAvailable,
  requestNotificationPermission,
} from './notifications';
import { getSettings } from './settings';
import { ThemeProvider, useTheme } from './theme';

const Stack = createNativeStackNavigator();

// 🔔 Notification handler so alerts show while app is open
configureNotificationHandler();

// Everything inside the theme provider, so it can read the active colours
function Root() {
  const { colors, isDark } = useTheme();

  // Give React Navigation the same colours as the rest of the app, so headers
  // and the gaps between screens match the chosen theme.
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.header,
        text: colors.headerText,
        border: colors.border,
        notification: colors.primary,
      },
    };
  }, [colors, isDark]);

  // A header with a back button for the screens opened from the home page
  const headerOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.header },
    headerTintColor: colors.headerText,
    headerBackTitle: 'Home',
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {/* Light icons on the dark theme, dark icons on the light theme */}
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="HomePage" component={MainDrawerNavigator} />
        <Stack.Screen
          name="GroupEntryScreen"
          component={GroupEntryScreen}
          options={{ ...headerOptions, title: 'Groups' }}
        />
        <Stack.Screen
          name="MyPackagesScreen"
          component={MyPackagesScreen}
          options={{ ...headerOptions, title: 'My Packages' }}
        />
        <Stack.Screen
          name="ScheduledVisitsScreen"
          component={ScheduledVisitsScreen}
          options={{ ...headerOptions, title: 'Scheduled Visits' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {

  useEffect(() => {
    // Reminders are local notifications, so ask for permission up front.
    // Skipped where notifications cannot run at all (Expo Go on Android), and
    // when the user has switched notifications off in Settings.
    if (!notificationsAvailable) return undefined;

    let cancelled = false;

    const askForPermission = async () => {
      const settings = await getSettings();
      if (cancelled || !settings.notifications) return;

      const granted = await requestNotificationPermission();
      if (!granted && !cancelled) {
        Alert.alert('Notifications Disabled', 'Reminders won’t work unless you allow notifications.');
      }
    };

    askForPermission();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
