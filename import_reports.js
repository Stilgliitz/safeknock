const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'safeknock-a6558-firebase-adminsdk-fbsvc-bb7fca6403.json')); // update filename if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function importReports() {
  try {
    const reports = JSON.parse(fs.readFileSync(path.join(__dirname, 'awarenessReports.json'), 'utf8'));
    const batch = db.batch();

    reports.forEach(report => {
      if (!report.id) {
        throw new Error("Each report must have a unique 'id' field.");
      }
      
      // Convert Firestore timestampValue strings into actual Timestamp objects
      if (report.timestamp && report.timestamp.timestampValue) {
        report.timestamp = admin.firestore.Timestamp.fromDate(new Date(report.timestamp.timestampValue));
      }
      
      const docRef = db.collection('awarenessReports').doc(report.id);
      batch.set(docRef, report);
    });

    await batch.commit();
    console.log('✅ Awareness reports imported successfully!');
  } catch (error) {
    console.error('❌ Error importing awareness reports:', error);
  }
}

importReports();
