# Sesli Mektup

İnsanların birbirine yalnızca kısa ses kayıtlarıyla, yavaş ve maskesiz biçimde ulaştığı telefon uygulaması. Ürün ilkeleri, veri modeli ve geliştirme aşamaları için [CLAUDE.md](CLAUDE.md) dosyasına bakın.

## Gereksinimler

- Node.js 20 veya üstü
- Telefonda **Expo Go** uygulaması (App Store / Google Play)

## Supabase kurulumu (bir kez)

1. [supabase.com](https://supabase.com) üzerinde yeni proje açın. Bölge: **Central EU (Frankfurt)**. Veritabanı şifresini bir şifre yöneticisine kaydedin.
2. **Project Settings → API** sayfasından proje adresini ve **publishable** (ya da eski adıyla *anon*) anahtarı alın. `.env.example` dosyasını `.env` olarak kopyalayıp bu iki değeri yazın. `service_role` / `secret` anahtarı bu dosyaya **asla** yazılmaz; uygulama böyle bir anahtarla açılmayı reddeder.
3. Terminalde projeyi bağlayıp şemayı yükleyin:
   ```bash
   npx supabase login
   npx supabase link --project-ref <proje-ref>   # adresteki https://<proje-ref>.supabase.co
   npm run db:seed                               # migration'lar + örnek sorular
   ```
   Sonraki şema değişikliklerinde `npm run db:push` yeterlidir (örnek soruları tekrar eklemez).
4. **Authentication → Emails → Templates** altında **Magic Link** ve **Confirm signup** şablonlarının konusunu `Sesli Mektup giriş kodun`, içeriğini `supabase/templates/otp.html` dosyasındaki metin yapın. Şablonda `{{ .Token }}` olmalı; yoksa e-postada kod yerine link gider.
5. **Authentication → Sign In / Providers → Email** altında e-posta ile girişin açık olduğunu, kod uzunluğunun **6**, kod süresinin **600** saniye olduğunu kontrol edin.

Not: Supabase'in hazır e-posta gönderimi saatte yalnızca birkaç e-postaya izin verir; geliştirme için yeterlidir. Kapalı testten önce özel SMTP ayarlanacak.

## Çalıştırma

```bash
npm install
npm start          # QR kodu Expo Go ile okutun
npm run web        # tarayıcıda açar (yalnızca geliştirme sırasında kontrol için)
npm run typecheck  # TypeScript kontrolü
```

Ses kaydı için gerçek bir telefon gerekir (iOS simülatöründe mikrofon yoktur). Expo Go'da mikrofon izni penceresi Expo'nun metnini gösterir; uygulamanın Türkçe izin metni kendi derlemelerimizde (EAS) görünür.

## Veritabanı

```
supabase/migrations/   şema ve RLS politikaları (sırayla uygulanır)
supabase/seed.sql      örnek sorular (dün, bugün ve sonraki 5 gün)
supabase/tests/        pgTAP ile RLS testleri
supabase/templates/    giriş kodu e-postası
```

Ses dosyaları özel `letters` bucket'ında `{uuid}.m4a` adıyla durur (en fazla 1 MB). Mektuplar yalnızca `send_letter` fonksiyonuyla oluşturulur; durum ve 60–120 dakikalık teslim zamanını sunucu belirler.

```bash
npm run db:push    # yeni migration'ları bağlı projeye uygular
npm run db:types   # src/lib/database.types.ts dosyasını yeniden üretir
npm run db:test    # RLS testleri (Docker gerekir: önce `npx supabase start`)
```

## Klasör yapısı

```
src/app/            ekranlar (expo-router, dosya tabanlı yönlendirme)
  onboarding.tsx    Kurallar – ilk açılış, 18+ ve kural onayı
  sign-in.tsx       e-posta ile giriş
  verify.tsx        6 haneli kod
  (tabs)/           alt menülü ekranlar: Bugün, Posta kutusu, Kurallar
  listen/[id].tsx   Dinle
  record.tsx        Kaydet
  on-the-way.tsx    Mektubun yolda
  support.tsx       Destek kaynakları
src/components/     ortak arayüz bileşenleri
src/theme/          renkler, yazı tipleri, ölçüler
src/lib/            Supabase istemcisi, veritabanı tipleri, mektup yükleme/gönderme
src/hooks/          günün sorusu, ses kaydı (useLetterRecorder)
src/state/auth.tsx  oturum ve 18+ onayı; hangi ekranların açık olduğunu belirler
src/data/mock.ts    henüz veritabanına bağlanmamış ekranların örnek verisi
```
