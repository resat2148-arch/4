import { StyleSheet, View } from 'react-native';

type WaveformProps = {
  count: number;
  // Number of bars drawn in the "active" color (played or recorded so far).
  filled: number;
  activeColor: string;
  inactiveColor: string;
  height: number;
  barHeight: (index: number) => number;
  // Recording shows flat placeholder bars until audio exists.
  flatInactive?: boolean;
};

// Decorative bars; hidden from screen readers.
export function Waveform({
  count,
  filled,
  activeColor,
  inactiveColor,
  height,
  barHeight,
  flatInactive = false,
}: WaveformProps) {
  return (
    <View
      style={[styles.row, { height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => {
        const active = i < filled;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: !active && flatInactive ? 4 : barHeight(i),
                backgroundColor: active ? activeColor : inactiveColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: { width: 4, borderRadius: 2 },
});
