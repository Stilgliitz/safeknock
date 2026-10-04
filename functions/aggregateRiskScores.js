// This file uses the 1st gen (v1) Cloud Functions API. From firebase-functions
// v6 the plain "firebase-functions" import means the 2nd gen API, which has no
// functions.pubsub.schedule, so v1 has to be imported explicitly.
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Aggregate reports into risk scores by postcode
 * Runs daily on a schedule (default: midnight UTC).
 */
exports.aggregateRiskScores = functions.pubsub
  .schedule("0 0 * * *") // every midnight UTC
  .timeZone("UTC")
  .onRun(async () => {
    const DAYS = 30; // decay window
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS);

    try {
      // Pull reports within window
      const snapshot = await db
        .collection("awarenessReports")
        .where("timestamp", ">=", cutoff)
        .get();

      if (snapshot.empty) {
        console.log("No recent reports found.");
        return null;
      }

      // --- Group reports by postcode ---
      const buckets = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const postcode = data.location?.postcode || "UNKNOWN";
        if (!buckets[postcode]) buckets[postcode] = [];
        buckets[postcode].push(data.numericScore || 1);
      });

      // --- Compute aggregates and update riskAggregates ---
      for (const [postcode, scores] of Object.entries(buckets)) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Map avg → color band
        let riskColor = "green";
        if (avg >= 7) riskColor = "red";
        else if (avg >= 4) riskColor = "amber";

        const aggregateDoc = {
          postcode,
          averageScore: parseFloat(avg.toFixed(2)),
          riskColor,
          reportsCount: scores.length,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db
          .collection("riskAggregates")
          .doc(postcode)
          .set(aggregateDoc);

        console.log(`Updated risk for ${postcode}: ${riskColor} (${avg})`);
      }

      // --- Generate hotspot stickers (top 5 postcodes with most reports) ---
      const sorted = Object.entries(buckets)
        .map(([postcode, scores]) => ({ postcode, reportsCount: scores.length }))
        .sort((a, b) => b.reportsCount - a.reportsCount);

      const topHotspots = sorted.slice(0, 5);

      const hotspotPromises = topHotspots.map(h =>
        db.collection("hotspots").doc(h.postcode).set({
          postcode: h.postcode,
          reportsCount: h.reportsCount,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        })
      );

      await Promise.all(hotspotPromises);
      console.log("Hotspots updated:", topHotspots.map(h => h.postcode));

      return null;
    } catch (error) {
      console.error("Error aggregating risk scores:", error);
      // Rethrow so the failed run is recorded in the Cloud Functions logs
      throw error;
    }
  });
