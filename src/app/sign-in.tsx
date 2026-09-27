import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Body, Eyebrow, Heading } from '@/components/Typography';
import { authErrorMessage, isPlausibleEmail } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = email.trim().toLowerCase();
  const canSend = isPlausibleEmail(trimmed) && !sending;

  const sendCode = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (otpError) {
      setError(authErrorMessage(otpError));
      return;
    }
    router.push({ pathname: '/verify', params: { email: trimmed } });
  };

  return (
    <Screen topGap={4}>
      <BackButton />
      <View style={styles.intro}>
        <Eyebrow>Giriş</Eyebrow>
        <Heading size={34}>E-posta adresin</Heading>
        <Body size={16} color={colors.textSecondary} lineHeight={1.5}>
          Sana 6 haneli bir giriş kodu göndereceğiz. Şifre yok. E-posta adresin kimseye gösterilmez.
        </Body>
      </View>

      <View style={styles.form}>
        <TextField
          value={email}
          onChangeText={setEmail}
          placeholder="ornek@eposta.com"
          accessibilityLabel="E-posta adresi"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          inputMode="email"
          returnKeyType="send"
          onSubmitEditing={sendCode}
          autoFocus
        />
        {error ? (
          <Body size={14} color={colors.accent} accessibilityLiveRegion="polite">
            {error}
          </Body>
        ) : null}
        <Button label={sending ? 'Gönderiliyor…' : 'Kodu gönder'} disabled={!canSend} onPress={sendCode} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  form: { gap: 16 },
});
