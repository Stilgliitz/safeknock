import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, Animated 
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useTheme } from '../theme';
import { createUserProfile } from '../firebaseHelpers';

export default function SignUpScreen({ navigation }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  // States for inputs and loading
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animated value for fade effect: starts at 0 (fully transparent)
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // On mount, run fade-in animation from 0 to 1 opacity
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSignUp = () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill out all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    // Trim the email: a trailing space from autofill makes Firebase reject it.
    const cleanEmail = email.trim();

    createUserWithEmailAndPassword(auth, cleanEmail, password)
      .then(async (userCredential) => {
        const uid = userCredential.user.uid;
        try {
          await createUserProfile(uid, {
            email: cleanEmail,
            createdAt: new Date().toISOString(),
          });
          Alert.alert('Success', 'Account created!');
          navigation.replace('HomePage');
        } catch (error) {
          Alert.alert('Profile creation failed', error.message);
        } finally {
          setLoading(false);
        }
      })
      .catch((error) => {
        setLoading(false);
        Alert.alert('Signup failed', error.message);
      });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.primary, marginTop: 15, fontSize: 16 }}>
          Creating your account...
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Create an Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor={COLORS.textSecondary}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor={COLORS.textSecondary}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholderTextColor={COLORS.textSecondary}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.replace('Login')}>
        <Text style={styles.linkText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex:1,
    justifyContent:'center',
    paddingHorizontal:20,
    backgroundColor:COLORS.background,
  },
  title: {
    fontSize:24,
    fontWeight:'bold',
    marginBottom:20,
    textAlign:'center',
    color: COLORS.primary,
  },
  input: {
    height: 50,
    borderColor: COLORS.textSecondary,
    borderWidth:1,
    borderRadius:5,
    paddingHorizontal:10,
    marginBottom:15,
    color: COLORS.textPrimary,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});
