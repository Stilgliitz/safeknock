import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from './firebaseConfig';  // make sure you export 'db' (Firestore instance) from your firebaseConfig file

// Create or update user profile info in 'users' collection
export async function createUserProfile(uid, profileData) {
  try {
    await setDoc(doc(db, 'users', uid), profileData, { merge: true });
    console.log('User profile created/updated');
  } catch (error) {
    console.error('Error creating user profile:', error);
  }
}

// Fetch user profile by UID
export async function getUserProfile(uid) {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log('No user profile found');
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
}

// Create a new group with a unique join code
export async function createGroup(joinCode, groupData) {
  try {
    await setDoc(doc(db, 'groups', joinCode), groupData);
    console.log('Group created with join code:', joinCode);
  } catch (error) {
    console.error('Error creating group:', error);
  }
}

// Join a group by adding user to group's members array
export async function joinGroup(joinCode, userId) {
  try {
    const groupRef = doc(db, 'groups', joinCode);
    await updateDoc(groupRef, {
      members: arrayUnion(userId)
    });
    console.log('User added to group members');
  } catch (error) {
    console.error('Error joining group:', error);
  }
}
