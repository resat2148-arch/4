import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme';

type Weight = 'regular' | 'medium' | 'semibold';

const sansByWeight: Record<Weight, string> = {
  regular: fonts.sans,
  medium: fonts.sansMedium,
  semibold: fonts.sansSemiBold,
};

type HeadingProps = TextProps & {
  size?: number;
  weight?: 'regular' | 'semibold';
  color?: string;
};

// Fraunces serif, used for titles and questions.
export function Heading({
  size = 34,
  weight = 'regular',
  color = colors.text,
  style,
  ...rest
}: HeadingProps) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          fontFamily: weight === 'semibold' ? fonts.serifSemiBold : fonts.serif,
          fontSize: size,
          lineHeight: Math.round(size * 1.15),
          color,
        },
        style,
      ]}
      {...rest}
    />
  );
}

type BodyProps = TextProps & {
  size?: number;
  weight?: Weight;
  color?: string;
  lineHeight?: number;
};

// Figtree sans, used for all running text.
export function Body({
  size = 15,
  weight = 'regular',
  color = colors.text,
  lineHeight = 1.45,
  style,
  ...rest
}: BodyProps) {
  return (
    <Text
      style={[
        {
          fontFamily: sansByWeight[weight],
          fontSize: size,
          lineHeight: Math.round(size * lineHeight),
          color,
        },
        style,
      ]}
      {...rest}
    />
  );
}

// Turkish uppercase: i -> İ (ı -> I is already right). textTransform and
// toUpperCase() are not locale-aware, so "Giriş" would otherwise become "GIRIŞ".
export function toTurkishUpperCase(value: string): string {
  return value.replace(/i/g, 'İ').toUpperCase();
}

// Small uppercase label above a section ("Bugünün sorusu").
export function Eyebrow({
  color = colors.accent,
  style,
  children,
  ...rest
}: Omit<TextProps, 'children'> & { color?: string; children: string }) {
  return (
    <Text style={[styles.eyebrow, { color }, style]} {...rest}>
      {toTurkishUpperCase(children)}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 1.56,
  },
});
