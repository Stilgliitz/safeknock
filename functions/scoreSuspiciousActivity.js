// This file uses the 1st gen (v1) Cloud Functions API. From firebase-functions
// v6 the plain "firebase-functions" import means the 2nd gen API, which has a
// different handler signature, so v1 has to be imported explicitly.
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { OpenAI } = require("openai");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// The OpenAI client is created the first time it is needed, not when this file
// loads. A missing key then gives a clear error when the function is called,
// instead of stopping every function in the project from deploying.
let openaiClient = null;

function getOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "OPENAI_API_KEY is not configured for Cloud Functions."
      );
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

exports.scoreSuspiciousActivity = functions.https.onCall(async (data, context) => {
  // Only signed-in users can submit a report, and it is always saved under the
  // caller's own id (never an id sent by the client).
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in to submit a report."
    );
  }

  const userId = context.auth.uid;
  const { description, location } = data || {};

  if (!description || !location) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required data"
    );
  }

  const prompt = `
You are an AI safety analyst for a neighborhood awareness app.
Given the following report, assign both a color-coded risk ("red", "amber", "green")
and a numeric score (1–10).
Also provide a short reasoning (1–2 sentences).

Respond ONLY in strict JSON like:
{
  "riskScore": "amber",
  "numericScore": 5,
  "explanation": "Short reasoning."
}

Report:
Description: ${description}
Location: ${location.streetName || ""}, ${location.postcode || ""}
  `;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a safety analyst AI for a neighborhood awareness app." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      // Ask the API for a JSON object so the reply isn't wrapped in markdown
      response_format: { type: "json_object" }
    });

    let response;
    const raw = completion.choices[0].message.content;

    try {
      response = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse AI response, using fallback.", err, raw);
      response = { riskScore: "green", numericScore: 1, explanation: "Defaulted to green due to parsing issue." };
    }

    // --- Safety net cleanups ---
    const mapping = { red: 9, amber: 5, green: 1 };

    // normalize riskScore
    let risk = String(response.riskScore || "green").toLowerCase();
    if (!["red", "amber", "green"].includes(risk)) risk = "green";

    // numeric validation
    let numeric = parseInt(response.numericScore, 10);
    if (isNaN(numeric) || numeric < 1 || numeric > 10) {
      numeric = mapping[risk];
    }

    const explanation = response.explanation || "No explanation provided.";

    const newReport = {
      userId,
      location,
      description,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      aiRiskScore: risk,
      numericScore: numeric,
      aiExplanation: explanation,
      aiRawResponse: raw // useful for debugging, can remove in prod
    };

    const ref = await db.collection("awarenessReports").add(newReport);

    return { success: true, id: ref.id, ai: { riskScore: risk, numericScore: numeric, explanation } };
  } catch (error) {
    // Pass deliberate errors (such as the missing key above) through unchanged
    if (error instanceof functions.https.HttpsError) throw error;

    console.error("AI scoring error:", error);
    throw new functions.https.HttpsError("internal", "Failed to score suspicious activity.");
  }
});
