# SafeKnock

A mobile app that helps households and neighbours stay safe from fake couriers, bogus repair visits and doorstep scams. A group of people who live together share one view of who is expected at the door, and can flag anything suspicious.

Built with React Native and Expo, with Firebase behind it.

## What it does

- **Sign up and log in** with Firebase Authentication
- **Household groups**: create a group or join one with a code, so everyone at the address sees the same information
- **Invite to group**: send the group code through the phone's share sheet, or show it as a QR code
- **Deliveries**: log expected packages and mark them as arrived, synced live between group members
- **Scheduled visits**: log expected visitors (engineers, plumbers and so on) with a date and time, and get a reminder notification on the device that added the visit
- **Awareness map** with three layers:
  - real police-recorded crime within a mile, from the official UK police open data API, drawn as hotspots (bigger and redder where more was recorded)
  - community reports from SafeKnock users as pins, updating live from Firestore
  - a summary card with the totals for the area, and a breakdown by crime type and street when tapped
- **Search this area**: move the map anywhere in England, Wales or Northern Ireland and load the police data for that spot
- **Report suspicious activity** straight from the map. The report's location is rounded to roughly 100 metres before it is saved, so the reporter's exact address is never shared, and each report is tagged with the risk area it falls inside using a point-in-polygon check
- **Light and dark themes**: one switch restyles every screen, the headers, the menu and the map, and the choice is remembered on the phone
- **Settings that do what they say**: switches for notifications, visit reminders and sound are saved on the phone and checked before anything is scheduled or shown. Turning reminders off also cancels the ones already set
- **Help & Support**: common questions, doorstep safety tips, and tap-to-call UK numbers (999, 101, Report Fraud and the Citizens Advice consumer helpline)
- **Profile and group management** screens
- **Stays signed in** between app launches

## AI risk scoring

`functions/` contains Firebase Cloud Functions that use the OpenAI API:

- `scoreSuspiciousActivity` sends a report's description and location to GPT and asks for a red, amber or green rating, a score from 1 to 10 and a short reason. The response is validated, and anything malformed falls back to a safe default instead of crashing.
- `aggregateRiskScores` is a nightly scheduled job that averages the last 30 days of scores per postcode and records the top hotspots.

## Security rules

`firestore.rules` locks the data down to signed-in users:

- A group's deliveries and visits can only be read or changed by people in that group's member list
- Anyone signed in can look a group up by its code (that is how joining works), but groups cannot be listed or searched, and the only change allowed is adding or removing yourself
- You can only edit your own profile; other members of your group can read it so the app can show who is in the group
- Reports can be read by any signed-in user and are always created under your own user id
- Risk data is read-only for the app and written only by the backend

## Tech stack

| Area | Tools |
|---|---|
| App | React Native, Expo SDK 57, JavaScript, React Navigation |
| Backend | Firebase Authentication, Cloud Firestore, Cloud Functions (Node.js) |
| AI | OpenAI API |
| Open data | data.police.uk street-level crime API (no key needed, Open Government Licence v3.0) |
| Device features | react-native-maps, expo-location, expo-notifications, react-native-qrcode-svg |

## Status

Work in progress. The core app (accounts, groups, deliveries, visits, map and reporting) is built. Still to do:

- Connect the map's report form to the `scoreSuspiciousActivity` function, so new reports are scored automatically
- Area alerts by postcode (the listener is written, reverse geocoding is not)
- Push notifications between group members, so reminders reach everyone and not only the person who added the visit

The "recorded crime nearby" level on the map is a simple band based on how many doorstep-related crimes (burglary, robbery, theft from the person, vehicle crime, criminal damage and anti-social behaviour) were recorded within a mile in the latest month. It is a rough guide, not an official rating, and police data is published a couple of months behind.

Known limitation: Expo Go on Android no longer supports `expo-notifications`, so visit reminders are switched off there. They work in Expo Go on iOS and in a development or release build on either platform.

## Running it

You need a current Node.js LTS release and the Expo Go app (SDK 57) on your phone.

1. `npm install`
2. Create your own Firebase project, enable Email/Password sign-in and Cloud Firestore, and put its web config in `firebaseConfig.js`.
3. Publish the security rules and indexes: `npx firebase-tools deploy --only firestore`
4. `npx expo start`, then scan the QR code with Expo Go.

The awareness map reads risk areas from the `area_risk_scores` collection. `import_risks.js` and `import_reports.js` load the sample data in `risks.json` and `awarenessReports.json`; they need a Firebase service account key file, which is not part of this repository.

The Cloud Functions are optional. To deploy them, copy `functions/.env.example` to `functions/.env`, add an OpenAI API key, and run `npx firebase-tools deploy --only functions` (this needs the Firebase Blaze plan).

`.env` files and Firebase admin key files are ignored by Git and must never be committed.
