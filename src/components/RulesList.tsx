import { StyleSheet, View } from 'react-native';

import { InfoRow } from '@/components/InfoRow';
import { DELIVERY_WINDOW_TEXT } from '@/constants/letters';
import {
  BanIcon,
  ClockIcon,
  HeadphonesIcon,
  MicIcon,
  ShieldIcon,
} from '@/components/icons';
import { colors } from '@/theme';

const iconProps = { color: colors.accent };

const RULES = [
  { key: 'no-profile', icon: <BanIcon {...iconProps} />, text: 'Fotoğraf, beğeni, takipçi ya da “görüldü” yok.' },
  { key: 'voice-only', icon: <MicIcon {...iconProps} />, text: 'Yazı yok, sadece ses. Her mektup en fazla 3 dakika.' },
  { key: 'slow', icon: <ClockIcon {...iconProps} />, text: `Mektuplar anında değil, ${DELIVERY_WINDOW_TEXT} içinde ulaşır. Acele eden yok.` },
  { key: 'moderated', icon: <HeadphonesIcon {...iconProps} />, text: 'Her mektup, iletilmeden önce bir moderatör tarafından dinlenir.' },
  { key: 'safety', icon: <ShieldIcon {...iconProps} />, text: 'Taciz, cinsel içerik ve telefon ya da adres gibi kişisel bilgi paylaşmak yasak.' },
];

export function RulesList() {
  return (
    <View style={styles.list}>
      {RULES.map((rule) => (
        <InfoRow key={rule.key} icon={rule.icon} text={rule.text} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 18 },
});
