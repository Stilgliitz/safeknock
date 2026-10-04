import React, { useEffect, useState, useMemo } from 'react';
import { Modal, FlatList, ScrollView, Share } from 'react-native';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { auth, db } from '../../firebaseConfig';
import { 
  doc, getDoc, updateDoc, 
  arrayRemove, deleteField 
} from 'firebase/firestore';
import { useTheme } from '../../theme';

// The QR code is an extra. If it can't be drawn on a particular phone, hide it
// rather than letting the error take down the whole Group Info page.
class QrBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('The QR code could not be drawn:', error?.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function GroupInfoScreen({ navigation }) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [groupCode, setGroupCode] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [memberEmails, setMemberEmails] = useState([]);
  const [loadError, setLoadError] = useState(null);


  useEffect(() => {
    fetchGroupInfo();
  }, []);

  const fetchGroupInfo = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const user = auth.currentUser;
      if (!user) return;

      const uid = user.uid;
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || !userSnap.data().groupCode) {
        setGroupCode(null);
        setGroupData(null);
        return;
      }

      const code = userSnap.data().groupCode;
      setGroupCode(code);

      const groupRef = doc(db, 'groups', code);
      const groupSnap = await getDoc(groupRef);

      if (groupSnap.exists()) {
        setGroupData(groupSnap.data());
      }
    } catch (error) {
      console.warn('Failed to fetch group info:', error.message);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberEmails = async () => {
  if (!groupData?.members?.length) return;

  const promises = groupData.members.map(async (uid) => {
    // One member's profile failing to load shouldn't hide the whole list
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      return (userSnap.exists() && userSnap.data().email) || 'Unknown User';
    } catch (error) {
      return 'Unknown User';
    }
  });

  const emails = await Promise.all(promises);
  setMemberEmails(emails);
  setShowMembers(true);
};


  // Open the phone's share sheet (Messages, WhatsApp, email, copy...) with an
  // invitation that includes the group code.
  const handleShareInvite = async () => {
    try {
      await Share.share({
        message:
          `Join my household on SafeKnock. Open the app, tap "Join A Group" and enter this code: ${groupCode}`,
      });
    } catch (error) {
      Alert.alert('Could not share the invite', error.message);
    }
  };

  const handleLeaveGroup = async () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const uid = auth.currentUser.uid;
              const userRef = doc(db, 'users', uid);
              const groupRef = doc(db, 'groups', groupCode);

              // Remove user from group's members array
              await updateDoc(groupRef, {
                members: arrayRemove(uid),
              });

              // Remove groupCode field from user doc
              await updateDoc(userRef, {
                groupCode: deleteField(),
              });

              Alert.alert('Left Group', 'You have left the group successfully.');
              setGroupCode(null);
              setGroupData(null);
              // This screen lives in the drawer, which has no replace(), so
              // open the group screen on top instead.
              navigation.navigate('GroupEntryScreen');
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading group info...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningText}>Couldn't load your group.</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity onPress={fetchGroupInfo}>
          <Text style={styles.linkText}>🔁 Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!groupCode) {
    return (
      <View style={styles.center}>
        <Text style={styles.warningText}>You're not in a group yet.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('GroupEntryScreen')}>
          <Text style={styles.linkText}>🔁 Click here to join or create one</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const createdAt = groupData?.createdAt ? new Date(groupData.createdAt).toLocaleString() : 'Unknown';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Group Info</Text>
      <Text style={styles.infoText}>📛 Group Code: <Text style={styles.code}>{groupCode}</Text></Text>
      <TouchableOpacity onPress={fetchMemberEmails}>
  <Text style={[styles.infoText, { textDecorationLine: 'underline' }]}>
    👥 Members: {groupData?.members?.length || 0}
  </Text>
</TouchableOpacity>

 <Modal
  visible={showMembers}
  transparent
  animationType="slide"
  onRequestClose={() => setShowMembers(false)}
 >
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <Text style={styles.title}>Group Members</Text>
      <FlatList
        data={memberEmails}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.infoText}>• {item}</Text>
        )}
      />
      <TouchableOpacity style={styles.closeButton} onPress={() => setShowMembers(false)}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
      <Text style={styles.infoText}>🕒 Created: {createdAt}</Text>

      {/* Invite someone to the group */}
      <View style={styles.inviteCard}>
        <Text style={styles.inviteTitle}>Invite someone</Text>
        <Text style={styles.inviteText}>
          Anyone who joins with your group code shares your packages and visits.
        </Text>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
          <Text style={styles.shareButtonText}>📨 Share invite</Text>
        </TouchableOpacity>

        <QrBoundary>
          {/* A QR code needs dark squares on white to scan, in both themes */}
          <View style={styles.qrBox}>
            <QRCode value={`SafeKnock group code: ${groupCode}`} size={150} />
          </View>
          <Text style={styles.inviteHint}>
            Scanning this with a phone camera shows the code to type in.
          </Text>
        </QrBoundary>
      </View>

      <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
        <Text style={styles.leaveButtonText}>🚪 Leave Group</Text>
      </TouchableOpacity>
    </ScrollView>

  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  code: {
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  inviteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 18,
    marginTop: 14,
    alignItems: 'center',
  },
  inviteTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  inviteText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  shareButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 14,
  },
  shareButtonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 18,
  },
  inviteHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.onPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
    fontSize: 16,
  },
  warningText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 14,
  },
  linkText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  leaveButton: {
    marginTop: 30,
    backgroundColor: COLORS.dangerButton, // red for leave
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },

  modalContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: COLORS.overlay,
},
modalContent: {
  backgroundColor: COLORS.background,
  padding: 20,
  borderRadius: 10,
  width: '80%',
  maxHeight: '70%',
  alignItems: 'center',
},

});
