import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { authErrorMessage, OTP_LENGTH, RESEND_COOLDOWN_SEC } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

export default function VerifyScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cooldown = useCountdown(RESEND_COOLDOWN_SEC);
  const lastTried = useRef<string | null>(null);

  const verify = async (token: string) => {
    if (token.length !== OTP_LENGTH || verifying) return;
    lastTried.current = token;
    setVerifying(true);
    setError(null);
    setNotice(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    // On success the auth state changes and the root layout moves on; this screen unmounts.
    if (verifyError) {
      setError(authErrorMessage(verifyError));
      setVerifying(false);
    }
  };

  const onChangeCode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    // Submit automatically once all digits are in (e.g. pasted or autofilled),
    // but not again for a code that has already failed.
    if (digits.length === OTP_LENGTH && digits !== lastTried.current) verify(digits);
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    cooldown.restart();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (otpError) setError(authErrorMessage(otpError));
    else setNotice('Yeni bir kod gönderdik.');
  };

  return (
    <Screen topGap={4}>
      <BackButton />
      <View style={styles.intro}>
        <Eyebrow>Giriş</Eyebrow>
        <Heading size={34}>Kodu gir</Heading>
        <Body size={16} color={colors.textSecondary} lineHeight={1.5}>
          <Body size={16} weight="semibold" color={colors.text}>
            {email}
          </Body>{' '}
          adresine 6 haneli bir kod gönderdik. Gelmediyse gereksiz klasörüne de bak.
        </Body>
      </View>

      <View style={styles.form}>
        <TextField
          value={code}
          onChangeText={onChangeCode}
          placeholder="••••••"
          accessibilityLabel="Giriş kodu"
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={OTP_LENGTH}
          style={styles.codeInput}
          autoFocus
        />
        {error ? (
          <Body size={14} color={colors.accent} accessibilityLiveRegion="polite">
            {error}
          </Body>
        ) : null}
        {notice ? (
          <Body size={14} color={colors.textSecondary} accessibilityLiveRegion="polite">
            {notice}
          </Body>
        ) : null}
        <Button
          label={verifying ? 'Kontrol ediliyor…' : 'Giriş yap'}
          disabled={code.length !== OTP_LENGTH || verifying}
          onPress={() => verify(code)}
        />
        <Button
          label={
            cooldown.remaining > 0
              ? `Kodu tekrar gönder (${formatDuration(cooldown.remaining)})`
              : 'Kodu tekrar gönder'
          }
          variant="link"
          disabled={cooldown.remaining > 0}
          onPress={resend}
          style={cooldown.remaining > 0 ? styles.linkDisabled : undefined}
        />
      </View>
    </Screen>
  );
}

// Counts down once a second from `seconds`; restart() begins again.
function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return { remaining, restart: () => setRemaining(seconds) };
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  form: { gap: 16 },
  codeInput: {
    textAlign: 'center',
    fontFamily: fonts.sansSemiBold,
    fontSize: 28,
    letterSpacing: 10,
  },
  // A disabled link keeps its transparent background instead of the filled disabled style.
  linkDisabled: { backgroundColor: 'transparent' },
});
