# Sesli Mektup

İnsanların birbirine yalnızca kısa ses kayıtlarıyla, yavaş ve maskesiz biçimde ulaştığı telefon uygulaması. Ürün ilkeleri, veri modeli ve geliştirme aşamaları için [CLAUDE.md](CLAUDE.md) dosyasına bakın.

## Gereksinimler

- Node.js 20 veya üstü
- Telefonda **Expo Go** uygulaması (App Store / Google Play)

## Çalıştırma

```bash
npm install
npm start          # QR kodu Expo Go ile okutun
npm run web        # tarayıcıda açar (yalnızca geliştirme sırasında kontrol için)
npm run typecheck  # TypeScript kontrolü
```

## Klasör yapısı

```
src/app/            ekranlar (expo-router, dosya tabanlı yönlendirme)
  onboarding.tsx    Kurallar – ilk açılış, 18+ ve kural onayı
  (tabs)/           alt menülü ekranlar: Bugün, Posta kutusu, Kurallar
  listen/[id].tsx   Dinle
  record.tsx        Kaydet
  on-the-way.tsx    Mektubun yolda
  support.tsx       Destek kaynakları
src/components/     ortak arayüz bileşenleri
src/theme/          renkler, yazı tipleri, ölçüler
src/data/mock.ts    1. aşamanın statik örnek verisi
```
