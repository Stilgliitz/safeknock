/**
 * Cloud Functions for SafeKnock.
 *
 * Each function lives in its own file and is exported from here, because this
 * is the file Firebase loads when deploying.
 *
 * Configuration: the OpenAI key is read from the OPENAI_API_KEY environment
 * variable. Copy .env.example to .env in this folder and add your key; the
 * Firebase CLI loads that file when deploying or running the emulator.
 */
const admin = require("firebase-admin");

admin.initializeApp();

const {scoreSuspiciousActivity} = require("./scoreSuspiciousActivity");
const {aggregateRiskScores} = require("./aggregateRiskScores");

exports.scoreSuspiciousActivity = scoreSuspiciousActivity;
exports.aggregateRiskScores = aggregateRiskScores;
