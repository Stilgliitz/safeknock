import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { useTheme } from '../../theme';

const ISSUES_URL = 'https://github.com/Stilgliitz/safeknock/issues';
const REPORT_FRAUD_URL = 'https://www.reportfraud.police.uk/';

// Questions people are likely to have, with answers that match how the app works
const FAQS = [
  {
    question: 'How do I set up my household?',
    answer:
      'On the home screen tap "Join A Group", then "Create a Group". You get a six-character code. ' +
      'Everyone who joins with that code shares the same packages and visits lists.',
  },
  {
    question: 'How do I invite someone to my group?',
    answer:
      'Open Group Info from the menu and tap "Share invite" to send your group code. ' +
      'They create an account, tap "Join A Group" on the home screen and enter the code.',
  },
  {
    question: 'How do I leave or change group?',
    answer:
      'Open Group Info and tap "Leave Group". If you join or create another group, ' +
      'you are moved across automatically, so there is no need to leave first.',
  },
  {
    question: 'Why didn\'t I get a visit reminder?',
    answer:
      'A reminder is set on the phone that added the visit, not on every phone in the group. ' +
      'Check that Notifications and Visit reminders are both on in Settings, and that notifications ' +
      'are allowed for the app in your phone\'s own settings. A reminder is only set if its time is ' +
      'still in the future when you save the visit. Reminders are not available in Expo Go on Android.',
  },
  {
    question: 'What do the circles and pins on the map show?',
    answer:
      'Circles are doorstep-related crimes (burglary, robbery, theft from the person, vehicle crime, ' +
      'criminal damage and anti-social behaviour) recorded by the police in the latest published month, ' +
      'grouped by street. Bigger, redder circles mean more recorded crimes. Pins are reports made by ' +
      'SafeKnock users in the last 30 days. ' +
      'Tap the card at the top of the map for a breakdown by type of crime.',
  },
  {
    question: 'Where does the crime data come from?',
    answer:
      'From data.police.uk, the official police open data service for England, Wales and Northern Ireland. ' +
      'It is published monthly, usually a couple of months behind, and each crime is placed at an ' +
      'approximate point on a street, not at the exact address.',
  },
  {
    question: 'What happens to my location?',
    answer:
      'Your location is used to centre the map and is sent to the police data service to look up crime ' +
      'within a mile. SafeKnock only saves it when you submit a report, rounded to roughly 100 metres. ' +
      'Other SafeKnock users can see the report on the map, without your name or email.',
  },
];

const SAFETY_TIPS = [
  'Not sure who it is? You don\'t have to open the door.',
  'Ask for ID and check it by calling the company on a number you find yourself, not one the caller gives you.',
  'A genuine caller will be happy to wait, or to come back another time.',
  'Never hand over cash, bank cards or PINs on the doorstep.',
  'Check the Scheduled Visits list. If a caller isn\'t on it, ask your household before letting them in.',
];

// UK numbers. Tapping a row opens the phone's dialler.
const CONTACTS = [
  {
    name: 'Emergency',
    number: '999',
    detail: 'A crime is happening now, or someone is in danger.',
  },
  {
    name: 'Police (non-emergency)',
    number: '101',
    detail: 'Report something that has already happened, or suspicious callers in your area.',
  },
  {
    name: 'Report Fraud',
    number: '0300 123 2040',
    detail: 'Scams and doorstep fraud in England, Wales and Northern Ireland. In Scotland, call 101.',
  },
  {
    name: 'Citizens Advice consumer helpline',
    number: '0808 223 1133',
    detail: 'Rogue traders and pressure selling. They pass reports on to Trading Standards.',
  },
];

export default function HelpSupportScreen() {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  // Which question is open (null when they are all closed)
  const [openQuestion, setOpenQuestion] = useState(null);

  // Open a phone number or web page. If the phone can't (for example a tablet
  // with no dialler), show the details so they can still be used.
  const open = async (url, fallback) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Couldn\'t open that', fallback);
    }
  };

  const call = (contact) => {
    open(`tel:${contact.number.replace(/\s/g, '')}`, `${contact.name}: ${contact.number}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>❓ Help & Support</Text>

      <Text style={styles.sectionTitle}>Common questions</Text>

      {FAQS.map((faq, index) => {
        const isOpen = openQuestion === index;

        return (
          <View key={faq.question} style={styles.card}>
            <TouchableOpacity
              style={styles.questionRow}
              onPress={() => setOpenQuestion(isOpen ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={styles.question}>{faq.question}</Text>
              <Text style={styles.chevron}>{isOpen ? '−' : '+'}</Text>
            </TouchableOpacity>

            {isOpen && <Text style={styles.answer}>{faq.answer}</Text>}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>At the door</Text>

      <View style={styles.card}>
        {SAFETY_TIPS.map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Who to call</Text>

      {CONTACTS.map((contact) => (
        <TouchableOpacity
          key={contact.number}
          style={styles.card}
          onPress={() => call(contact)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${contact.name} on ${contact.number}`}
        >
          <View style={styles.contactRow}>
            <Text style={styles.contactName}>{contact.name}</Text>
            <Text style={styles.contactNumber}>📞 {contact.number}</Text>
          </View>
          <Text style={styles.contactDetail}>{contact.detail}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={() => open(REPORT_FRAUD_URL, REPORT_FRAUD_URL)} accessibilityRole="link">
        <Text style={styles.link}>Report fraud online at reportfraud.police.uk</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Problems with the app</Text>

      <TouchableOpacity onPress={() => open(ISSUES_URL, ISSUES_URL)} accessibilityRole="link">
        <Text style={styles.link}>Report a problem or suggest an improvement on GitHub</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>
        SafeKnock helps your household stay aware. It does not replace the emergency services: if someone is in danger, call 999.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 10,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 26,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  question: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
    paddingRight: 12,
  },
  chevron: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  answer: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    color: COLORS.primary,
    fontSize: 15,
    marginRight: 8,
  },
  tipText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
    paddingRight: 12,
  },
  contactNumber: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  contactDetail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  link: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  footnote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 30,
  },
});
