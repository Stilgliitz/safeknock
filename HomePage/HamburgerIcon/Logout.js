import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig'; // adjust path if needed
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';

export default function LogoutButton() {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const navigation = useNavigation();

  const handleLogout = async () => {
    // Leave the signed-in screens first, so their live Firestore listeners are
    // removed before the session ends. Resetting (rather than replacing one
    // screen) also clears the history, so the back button on the login screen
    // can't return to signed-in screens.
    const rootNavigation = navigation.getParent() ?? navigation;
    rootNavigation.reset({ index: 0, routes: [{ name: 'Login' }] });

    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Logout failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.message}>Sign out of SafeKnock on this device?</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
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
  message: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  logoutButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
