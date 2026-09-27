// Light "paper" palette used by every screen except recording.
export const colors = {
  paper: '#F4EFE6',
  surface: '#FFFDF8',
  line: '#E3D9C9',
  lineStrong: '#D9CFBF',
  lineDashed: '#C9BCA8',
  muted: '#EAE2D4',
  text: '#1F1B16',
  textSecondary: '#6B6257',
  accent: '#A0461F',
  onAccent: '#FFFDF8',
  scrim: 'rgba(31, 27, 22, 0.5)',
} as const;

// Dark palette for the recording screen.
export const darkColors = {
  background: '#1F1B16',
  text: '#F4EFE6',
  textSoft: '#E6DDCF',
  textSecondary: '#B5AA99',
  accent: '#E9A07A',
  record: '#D9663A',
  line: '#4A423A',
  lineStrong: '#6E6458',
} as const;
