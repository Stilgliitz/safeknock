import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useTheme } from '../../theme';

export default function ProfileScreen() {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const user = auth.currentUser;

  // 🔄 On mount: load data from Firestore
  useEffect(() => {
    if (user) {
      setEmail(user.email);
      const docRef = doc(db, 'users', user.uid);
      getDoc(docRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.fullName) {
              setFullName(data.fullName);
            }
          }
        })
        .catch((error) => {
          console.warn('Error loading user profile:', error.message);
        })
        .finally(() => {
          setLoading(false);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        });
    } else {
      // Not signed in: stop the spinner instead of loading forever
      setLoading(false);
      fadeAnim.setValue(1);
    }
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation', 'Please enter your full name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please sign in again to update your profile');
      return;
    }

    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { fullName: fullName.trim() }, { merge: true });
      Alert.alert('Success', 'Profile updated!');
    } catch (error) {
      console.warn('Error saving profile:', error.message);
      Alert.alert('Error', error.message || 'Something went wrong');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>👤 Your Profile</Text>

      <Text style={styles.label}>Email (read-only)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: COLORS.card }]}
        value={email}
        editable={false}
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Enter your full name"
        placeholderTextColor={COLORS.textSecondary}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save Changes</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
