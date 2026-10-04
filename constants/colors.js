// Colour palettes for the two app themes. Screens read the active palette
// through useTheme() (see theme.js) instead of importing a fixed set of colours.

export const darkColors = {
  background: '#101820',
  primary: '#F2AA4C',
  onPrimary: '#101820',      // text and icons on top of the primary colour
  textPrimary: '#FFFFFF',
  textSecondary: '#D3D3D3',
  card: '#2A2E43',           // cards, inputs and secondary buttons
  header: '#0F172A',
  headerText: '#FFFFFF',
  drawer: '#1E293B',
  border: '#1E293B',
  overlay: '#000000aa',      // dimmed backdrop behind pop-ups
  danger: '#FF4C4C',         // warning and error text
  dangerButton: '#C62828',   // background of destructive buttons (white text on top)
  success: '#3EC70B',
};

export const lightColors = {
  background: '#F5F7FA',
  primary: '#A04A08',        // a deeper orange, so it stays readable on a light background
  onPrimary: '#FFFFFF',
  textPrimary: '#101820',
  textSecondary: '#52606D',
  card: '#E4E9F0',
  header: '#FFFFFF',
  headerText: '#101820',
  drawer: '#FFFFFF',
  border: '#D5DCE5',
  overlay: '#00000088',
  danger: '#C62828',
  dangerButton: '#C62828',
  success: '#2E7D32',
};

// The dark palette is the default look of the app
const COLORS = darkColors;

export default COLORS;
