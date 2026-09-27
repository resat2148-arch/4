import { AuthError } from '@supabase/supabase-js';

export const OTP_LENGTH = 6;
// Matches auth.email.max_frequency in supabase/config.toml.
export const RESEND_COOLDOWN_SEC = 60;

// Loose check; the server sends the code only if the address really exists.
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// User-facing Turkish messages. Never includes the address or the raw server text.
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (
      error.status === 429 ||
      error.code === 'over_email_send_rate_limit' ||
      error.code === 'over_request_rate_limit'
    ) {
      return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
    }
    if (error.code === 'otp_expired' || error.code === 'invalid_credentials' || error.status === 403) {
      return 'Kod hatalı ya da süresi dolmuş. Kontrol edip tekrar dene.';
    }
    if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
      return 'Bu e-posta adresi geçerli görünmüyor.';
    }
  }
  return 'Bir sorun oluştu. İnternet bağlantını kontrol edip tekrar dene.';
}
