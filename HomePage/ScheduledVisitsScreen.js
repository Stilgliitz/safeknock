import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, Platform
} from 'react-native';
import {
  doc, getDoc, collection, addDoc,
  onSnapshot, updateDoc, deleteDoc
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useTheme } from '../theme';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import {
  cancelNotification,
  notificationsAvailable,
  remindersEnabled,
  scheduleReminderAt,
} from '../notifications';
import { compareDates, formatDateTime } from '../dateUtils';

export default function ScheduledVisitsScreen() {
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [groupCode, setGroupCode] = useState(null);
  const [allVisits, setAllVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date());
  const [reminderMinutes, setReminderMinutes] = useState(30);

  const [filterStatus, setFilterStatus] = useState('All');
  const [sortDescending, setSortDescending] = useState(false);

  // Whether reminders are switched on in Settings. Checked each time the
  // "add visit" form opens, so a change made in Settings shows up straight away.
  const [remindersOn, setRemindersOn] = useState(notificationsAvailable);

  useEffect(() => {
    if (!modalVisible) return undefined;

    let cancelled = false;
    remindersEnabled().then((enabled) => {
      if (!cancelled) setRemindersOn(enabled);
    });

    return () => {
      cancelled = true;
    };
  }, [modalVisible]);

  // Find the user's group, then listen to that group's visits in real time.
  // There is one listener for the whole screen, and it is removed when the
  // screen closes. Filtering and sorting happen below, on the data it returns.
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
          collection(db, 'groups', code, 'visits'),
          (snapshot) => {
            setAllVisits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadError(null);
            setLoading(false);
          },
          (error) => {
            console.warn('Visits listener failed:', error.message);
            setLoadError(error.message);
            setLoading(false);
          }
        );
      } catch (error) {
        if (cancelled) return;
        console.warn('Failed to load visits:', error.message);
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

  // Apply the chosen filter and sort order to the live data
  const visits = useMemo(() => {
    const filtered = filterStatus === 'All'
      ? allVisits
      : allVisits.filter(item => item.status === filterStatus);

    // Oldest first by visit date. Ties (and dates that can't be read) fall back
    // to when the visit was added, then to its id, so the order is always fully
    // defined. Newest first is the exact reverse, which means the sort button
    // always changes the list when there are two or more visits.
    const oldestFirst = [...filtered].sort((a, b) =>
      compareDates(a.date, b.date)
      || compareDates(a.addedAt, b.addedAt)
      || String(a.id).localeCompare(String(b.id))
    );

    return sortDescending ? oldestFirst.reverse() : oldestFirst;
  }, [allVisits, filterStatus, sortDescending]);

  // Android has no combined date and time picker, so ask for the date first
  // and then the time.
  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      onValueChange: (_event, pickedDay) => {
        DateTimePickerAndroid.open({
          value: pickedDay,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_timeEvent, pickedDateTime) => setDate(pickedDateTime),
        });
      },
    });
  };

  const scheduleReminder = async (visitId, visitTitle, visitDate) => {
    if (!notificationsAvailable) return null;

    try {
      const triggerDate = new Date(visitDate.getTime() - reminderMinutes * 60 * 1000);

      if (triggerDate <= new Date()) return null;

      // Returns null when reminders are switched off in Settings
      const id = await scheduleReminderAt(triggerDate, {
        title: `Upcoming Visit: ${visitTitle}`,
        body: `Scheduled for ${visitDate.toLocaleString()}`,
      });

      if (!id) return null;

      const visitRef = doc(db, 'groups', groupCode, 'visits', visitId);
      await updateDoc(visitRef, { notificationId: id });

      return id;
    } catch (error) {
      console.warn('Error scheduling notification:', error.message);
      return null;
    }
  };

  const handleAddVisit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a visit title');
      return;
    }

    const user = auth.currentUser;
    if (!user || !groupCode) {
      Alert.alert('Error', 'You must be part of a group to schedule a visit');
      return;
    }

    try {
      const visitTitle = title.trim();

      const docRef = await addDoc(collection(db, 'groups', groupCode, 'visits'), {
        title: visitTitle,
        date: date.toISOString(),
        notes: notes.trim(),
        status: 'Upcoming',
        addedBy: user.email,
        addedAt: new Date().toISOString(),
        notificationId: null,
      });

      await scheduleReminder(docRef.id, visitTitle, date);

      setModalVisible(false);
      setTitle('');
      setNotes('');
      setDate(new Date());
      setReminderMinutes(30);
    } catch (error) {
      Alert.alert('Failed to save visit', error.message);
    }
  };

  const markAsCompleted = async (id, notificationId) => {
    try {
      // A completed visit no longer needs its reminder
      await cancelNotification(notificationId);
      const ref = doc(db, 'groups', groupCode, 'visits', id);
      await updateDoc(ref, { status: 'Completed' });
    } catch (error) {
      Alert.alert('Failed to update visit', error.message);
    }
  };

  const deleteVisit = async (id, notificationId) => {
    try {
      await cancelNotification(notificationId);
      const ref = doc(db, 'groups', groupCode, 'visits', id);
      await deleteDoc(ref);
    } catch (error) {
      Alert.alert('Failed to delete visit', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading visits...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningText}>Couldn't load visits.</Text>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (!groupCode) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningText}>You're not part of a group.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter & Sort */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <View>
          <Text style={{ color: COLORS.textSecondary }}>Filter:</Text>
          <View style={{ flexDirection: 'row' }}>
            {['All', 'Upcoming', 'Completed'].map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setFilterStatus(status)}
                style={{
                  backgroundColor: filterStatus === status ? COLORS.primary : COLORS.card,
                  padding: 6,
                  borderRadius: 6,
                  marginRight: 6
                }}
              >
                <Text style={{ color: filterStatus === status ? COLORS.onPrimary : COLORS.textPrimary }}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ color: COLORS.textSecondary }}>Sort:</Text>
          <TouchableOpacity
            onPress={() => setSortDescending(current => !current)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ backgroundColor: COLORS.card, padding: 6, borderRadius: 6, marginTop: 4 }}
          >
            <Text style={{ color: COLORS.textPrimary }}>
              {sortDescending ? '⬇️ Newest First' : '⬆️ Oldest First'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={visits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDate}>{formatDateTime(item.date)}</Text>
            <Text style={styles.cardNotes}>📝 {item.notes}</Text>
            <Text style={styles.cardStatus}>Status: {item.status}</Text>
            {item.status === 'Upcoming' && (
              <>
                <TouchableOpacity onPress={() => markAsCompleted(item.id, item.notificationId)}>
                  <Text style={styles.completeText}>✅ Mark as Completed</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteVisit(item.id, item.notificationId)}>
                  <Text style={styles.deleteText}>🗑️ Delete Visit</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No visits scheduled.</Text>}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>➕ Schedule Visit</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Visit</Text>

            <TextInput
              style={styles.input}
              placeholder="Visit Title"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={COLORS.textSecondary}
            />

            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholderTextColor={COLORS.textSecondary}
            />

            {Platform.OS === 'ios' ? (
              <>
                <Text style={styles.dateSelect}>📆 Date and time:</Text>
                <DateTimePicker
                  value={date}
                  mode="datetime"
                  display="default"
                  themeVariant={isDark ? 'dark' : 'light'}
                  style={styles.iosPicker}
                  onValueChange={(_event, selected) => setDate(selected)}
                />
              </>
            ) : (
              <TouchableOpacity onPress={openAndroidPicker}>
                <Text style={styles.dateSelect}>📆 Select Date: {date.toLocaleString()}</Text>
              </TouchableOpacity>
            )}

            {!notificationsAvailable ? (
              <Text style={styles.reminderNote}>
                Reminder notifications are not available in Expo Go on Android. They work in a full build of the app.
              </Text>
            ) : remindersOn ? (
              <>
                <Text style={{ color: COLORS.textSecondary, marginBottom: 6, marginTop: 10 }}>
                  Reminder time (minutes before):
                </Text>
                <Picker
                  selectedValue={reminderMinutes}
                  onValueChange={setReminderMinutes}
                  style={{ color: COLORS.textPrimary, marginBottom: 12 }}
                  itemStyle={{ color: COLORS.textPrimary }}
                  dropdownIconColor={COLORS.textPrimary}
                >
                  <Picker.Item label="5 minutes" value={5} />
                  <Picker.Item label="15 minutes" value={15} />
                  <Picker.Item label="30 minutes" value={30} />
                  <Picker.Item label="1 hour" value={60} />
                  <Picker.Item label="2 hours" value={120} />
                </Picker>
              </>
            ) : (
              <Text style={styles.reminderNote}>
                Reminders are turned off in Settings, so this visit will be saved without one.
              </Text>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={handleAddVisit}>
              <Text style={styles.saveText}>Save Visit</Text>
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
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  card: { backgroundColor: COLORS.card, padding: 16, borderRadius: 8, marginBottom: 12 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  cardDate: { color: COLORS.textSecondary, marginTop: 4 },
  cardNotes: { color: COLORS.textSecondary, marginTop: 4 },
  cardStatus: { color: COLORS.textSecondary, marginTop: 4 },
  completeText: { color: COLORS.primary, marginTop: 6 },
  deleteText: { color: COLORS.danger, marginTop: 8 },
  addButton: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  addButtonText: { color: COLORS.onPrimary, fontWeight: 'bold', fontSize: 16 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 30 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.background, padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center', marginBottom: 10 },
  input: { backgroundColor: COLORS.card, color: COLORS.textPrimary, padding: 12, borderRadius: 8, marginBottom: 12 },
  saveButton: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  saveText: { color: COLORS.onPrimary, fontWeight: 'bold', fontSize: 16 },
  cancelText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 12 },
  dateSelect: { color: COLORS.textSecondary, marginBottom: 10 },
  iosPicker: { alignSelf: 'flex-start', marginBottom: 10 },
  reminderNote: { color: COLORS.textSecondary, fontSize: 13, marginTop: 10, marginBottom: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 20 },
  loadingText: { color: COLORS.textSecondary, marginTop: 10 },
  warningText: { color: COLORS.textSecondary, fontSize: 16 },
  errorText: { color: COLORS.danger, fontSize: 14, marginTop: 8, textAlign: 'center' },
});
