import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { doc, getDoc, collection, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useTheme } from '../theme';
import { compareDates, formatDateTime } from '../dateUtils';

export default function MyPackagesScreen() {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [groupCode, setGroupCode] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackageNotes, setNewPackageNotes] = useState('');
  const [newStatus, setNewStatus] = useState('Pending');
  const [filter, setFilter] = useState('All');

  // Find the user's group, then listen to that group's packages in real time.
  // The listener is removed when the screen closes so it doesn't keep running.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;

        const code = userSnap.exists() ? userSnap.data().groupCode : null;
        if (!code) {
          setLoading(false);
          return;
        }

        setGroupCode(code);

        unsubscribe = onSnapshot(
          collection(db, 'groups', code, 'packages'),
          (snapshot) => {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            setPackages(data);
            setLoadError(null);
            setLoading(false);
          },
          (error) => {
            console.warn('Packages listener failed:', error.message);
            setLoadError(error.message);
            setLoading(false);
          }
        );
      } catch (error) {
        if (cancelled) return;
        console.warn('Failed to load packages:', error.message);
        setLoadError(error.message);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleAddPackage = async () => {
    if (!newPackageName.trim()) return;

    const user = auth.currentUser;
    if (!user || !groupCode) return;

    try {
      const packageRef = collection(db, 'groups', groupCode, 'packages');

      await addDoc(packageRef, {
        packageName: newPackageName.trim(),
        notes: newPackageNotes.trim(),
        status: newStatus,
        addedByUid: user.uid,
        addedByEmail: user.email,
        date: new Date().toISOString(),
      });

      setNewPackageName('');
      setNewPackageNotes('');
      setNewStatus('Pending');
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Failed to save package', error.message);
    }
  };

  const markAsDelivered = async (id) => {
    try {
      const ref = doc(db, 'groups', groupCode, 'packages', id);
      await updateDoc(ref, {
        status: 'Delivered',
      });
    } catch (error) {
      Alert.alert('Failed to update package', error.message);
    }
  };

  const filtered = packages
    .filter(pkg => filter === 'All' || pkg.status === filter)
    .sort((a, b) => compareDates(b.date, a.date)); // newest first

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 10 }}>Loading packages...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningText}>Couldn't load packages.</Text>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (!groupCode) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningText}>You're not part of a group.</Text>
        <Text style={styles.linkText}>Join a group to track your packages.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Row */}
      <View style={styles.filterRow}>
        {['All', 'Pending', 'Delivered'].map(status => (
          <TouchableOpacity key={status} onPress={() => setFilter(status)}>
            <Text style={[
              styles.filterText,
              filter === status && styles.filterTextActive
            ]}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.packageName}</Text>
            <Text style={styles.cardStatus}>📌 Status: {item.status}</Text>
            <Text style={styles.cardDate}>🕒 Added: {formatDateTime(item.date)}</Text>
            <Text style={styles.cardNotes}>📝 Notes: {item.notes || 'None'}</Text>
            <Text style={styles.cardAdded}>👤 Added by: {item.addedByEmail || 'N/A'}</Text>

            {item.status !== 'Delivered' && (
              <TouchableOpacity onPress={() => markAsDelivered(item.id)}>
                <Text style={styles.markDelivered}>✅ Mark as Delivered</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No packages found</Text>}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>➕ Add Package</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add a Package</Text>
            <TextInput
              style={styles.input}
              placeholder="Package name"
              placeholderTextColor={COLORS.textSecondary}
              value={newPackageName}
              onChangeText={setNewPackageName}
            />
            <TextInput
              style={styles.input}
              placeholder="Optional notes"
              placeholderTextColor={COLORS.textSecondary}
              value={newPackageNotes}
              onChangeText={setNewPackageNotes}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddPackage}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
    gap: 12,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  filterTextActive: {
    fontWeight: 'bold',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardStatus: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  cardDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  cardNotes: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  cardAdded: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  markDelivered: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  empty: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 30,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  addButtonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: COLORS.overlay,
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  warningText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    marginTop: 8,
    textAlign: 'center',
  },
  linkText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginTop: 8,
  },
});
