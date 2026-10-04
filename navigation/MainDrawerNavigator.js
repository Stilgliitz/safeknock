import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import HomePage from '../HomePage/HomePage';
import SettingsScreen from '../Components/SettingsScreen';
import GroupInfoScreen from '../HomePage/HamburgerIcon/GroupInfoScreen';
import HelpSupportScreen from '../HomePage/HamburgerIcon/HelpSupportScreen';
import ProfileScreen from '../HomePage/HamburgerIcon/ProfileScreen';
import ThemeScreen from '../HomePage/HamburgerIcon/ThemeScreen';
import Logout from '../HomePage/HamburgerIcon/Logout';
import AwarenessMap from '../HomePage/HamburgerIcon/AwarenessMap';
import { useTheme } from '../theme';

const Drawer = createDrawerNavigator();

export default function MainDrawerNavigator() {
  const { colors } = useTheme();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: true,
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: colors.drawer,
          width: 240,
        },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textSecondary,
        headerTintColor: colors.headerText,
        headerStyle: {
          backgroundColor: colors.header,
        },
      }}
    >
      {/* The order here is the order of the menu: main features first, then
          the account pages, then settings and help, with Logout last. */}
      <Drawer.Screen name="Home" component={HomePage} />
      <Drawer.Screen
        name="AwarenessMap"
        component={AwarenessMap}
        options={{ title: 'Awareness Map' }}
      />
      <Drawer.Screen name="Group Info" component={GroupInfoScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="App Theme" component={ThemeScreen} />
      <Drawer.Screen name="Help & Support" component={HelpSupportScreen} />
      <Drawer.Screen name="Logout" component={Logout} />
    </Drawer.Navigator>
  );
}
