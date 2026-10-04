const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const serviceAccount = require(path.join(__dirname, "safeknock-a6558-firebase-adminsdk-fbsvc-bb7fca6403.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Load your JSON data file (replace 'risks.json' with your filename)
const risks = JSON.parse(fs.readFileSync(path.join(__dirname, "risks.json"), "utf8"));

async function importRiskScores() {
  try {
    let batch = db.batch();
    let counter = 0;

    risks.forEach((risk) => {
      if (!risk.id) {
        console.warn("⚠ Skipping risk entry with missing id:", risk);
        return;
      }
      const docRef = db.collection("area_risk_scores").doc(risk.id);
      batch.set(docRef, risk);

      counter++;
      // Commit batch every 500 writes
      if (counter % 500 === 0) {
        batch.commit();
        batch = db.batch();
      }
    });

    await batch.commit();
    console.log(`✅ Successfully imported ${counter} risk areas.`);
  } catch (error) {
    console.error("❌ Error importing risk scores:", error);
  }
}

importRiskScores();
