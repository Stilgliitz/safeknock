import React, { useRef, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useTheme } from '../theme';

export default function GroupEntryScreen({ navigation }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [mode, setMode] = useState(null); // 'create' or 'join'
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  // A ref (not just state) so a quick double tap can't start a second request
  // before the screen has re-rendered with the button disabled.
  const busyRef = useRef(false);

  const startWork = () => {
    busyRef.current = true;
    setLoading(true);
  };

  const stopWork = () => {
    busyRef.current = false;
    setLoading(false);
  };

  // 🔑 Generates a 6-character alphanumeric code
  const generateGroupCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // The group the user belongs to right now (null if they are not in one)
  const getCurrentGroupCode = async (uid) => {
    const userSnap = await getDoc(doc(db, 'users', uid));
    return userSnap.exists() ? userSnap.data().groupCode || null : null;
  };

  // 🚪 After moving to a new group, take the user out of their old one so they
  // don't stay listed as a member of a group they have moved on from.
  const leavePreviousGroup = async (uid, previousCode, newCode) => {
    if (!previousCode || previousCode === newCode) return;

    try {
      await updateDoc(doc(db, 'groups', previousCode), {
        members: arrayRemove(uid),
      });
    } catch (error) {
      // The old group may have been deleted. Nothing to clean up in that case.
      console.warn('Could not leave previous group:', error.message);
    }
  };

  // Go back to a fresh home screen so every screen reloads the new group.
  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'HomePage' }] });
  };

  // 🔨 Create new group in Firestore and update user profile
  const handleCreateGroup = async () => {
    const user = auth.currentUser;
    if (!user || busyRef.current) return;

    const code = generateGroupCode();
    const uid = user.uid;

    try {
      startWork();
      const groupRef = doc(db, 'groups', code);
      const userRef = doc(db, 'users', uid);
      const previousCode = await getCurrentGroupCode(uid);

      // Create the group
      await setDoc(groupRef, {
        createdBy: uid,
        createdAt: new Date().toISOString(),
        members: [uid],
      });

      // ✅ Save the groupCode on the user profile.
      // setDoc with merge also works when the profile document doesn't exist yet.
      await setDoc(userRef, { groupCode: code }, { merge: true });

      await leavePreviousGroup(uid, previousCode, code);

      Alert.alert('Success', `Group created! Code: ${code}`);
      goHome();
    } catch (error) {
      Alert.alert('Error', error.message);
      stopWork();
    }
  };

  // 🧠 Join an existing group and update user profile
const handleJoinGroup = async () => {
  const code = joinCode.trim().toUpperCase();

  if (!code) {
    Alert.alert('Error', 'Please enter a group code');
    return;
  }

  const user = auth.currentUser;
  if (!user || busyRef.current) return;

  const uid = user.uid;
  const groupRef = doc(db, 'groups', code);
  const userRef = doc(db, 'users', uid);

  try {
    startWork();
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      Alert.alert('Invalid Code', 'No group found with that code');
      stopWork();
      return;
    }

    const previousCode = await getCurrentGroupCode(uid);

    await updateDoc(groupRef, {
      members: arrayUnion(uid),
    });

    // 🔑 Sync group code to the user's profile.
    // setDoc with merge also works when the profile document doesn't exist yet.
    await setDoc(userRef, { groupCode: code }, { merge: true });

    await leavePreviousGroup(uid, previousCode, code);

    Alert.alert('Joined', 'You have joined the group!');
    goHome();
  } catch (error) {
    Alert.alert('Error', error.message);
    stopWork();
  }
};


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Group Access</Text>

      {!mode && (
        <>
          <TouchableOpacity style={styles.button} onPress={() => setMode('create')}>
            <Text style={styles.buttonText}>➕ Create a Group</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => setMode('join')}>
            <Text style={styles.buttonText}>🔑 Join a Group</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'create' && (
        <>
          <Text style={styles.subtitle}>You’ll get a unique group code</Text>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreateGroup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Now'}</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'join' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter group code"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            placeholderTextColor={COLORS.textSecondary}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleJoinGroup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Joining...' : 'Join Group'}</Text>
          </TouchableOpacity>
        </>
      )}

      {mode && !loading && (
        <TouchableOpacity style={styles.cancel} onPress={() => setMode(null)}>
          <Text style={styles.cancelText}>⬅️ Cancel</Text>
        </TouchableOpacity>
      )}
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
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancel: {
    marginTop: 20,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
