# Sesli Mektup — Proje Rehberi

Bu dosya, projede çalışan Claude Code için kalıcı bağlamdır. Her oturumun başında okunur.

## Ürün özeti

Sesli Mektup, insanların birbirine yalnızca kısa ses kayıtlarıyla, yavaş ve maskesiz biçimde ulaştığı bir telefon uygulamasıdır. Her gün tek bir derin soru yayınlanır. Kullanıcı bu soruya sesle cevap verir ve kaydını ya bir dostuna ya da tanımadığı bir yabancıya gönderir. Mektuplar anında değil, gecikmeli ulaşır ve iletilmeden önce bir moderatör tarafından dinlenir.

## Değişmez ürün ilkeleri

Aşağıdakiler tasarım kararıdır, "iyileştirme" olarak değiştirilmez. Bir özellik bunlarla çelişiyorsa önce bana sor.

- Profil fotoğrafı, takipçi sayısı, beğeni ve "görüldü" bilgisi yoktur.
- Kullanıcılar birbirine yazı gönderemez; tek iletişim biçimi en fazla 180 saniyelik ses kaydıdır.
- Mektuplar gecikmeli ulaşır: gönderimde 60–120 dakika arası rastgele bir teslim zamanı belirlenir.
- Hiçbir mektup moderasyon onayı olmadan alıcıya ulaşmaz.
- Yabancıya mektup göndermeden önce kullanıcının en az bir yabancı mektubunu sonuna kadar dinlemiş olması gerekir ("önce dinle, sonra anlat").
- Yabancılar birbirinin kimliğini asla görmez; arayüzde gönderen yalnızca "Bir yabancı" olarak görünür.
- Uygulama 18 yaş üstü içindir; başlangıçta açık onay alınır.
- Başarı ölçütü ekran süresi değildir. Sonsuz akış, otomatik oynatma zinciri ya da etkileşimi yapay olarak artıran mekanikler eklenmez.

## Teknoloji yığını

- **Mobil:** React Native + Expo, TypeScript, expo-router ile dosya tabanlı yönlendirme.
- **Ses:** Expo'nun ses kütüphanesi (kayıt ve oynatma). Kayıt formatı konuşmaya uygun sıkıştırılmış AAC (m4a), düşük bit hızı.
- **Arka uç:** Supabase (Postgres, Auth, Storage, Edge Functions, zamanlanmış görevler). Proje Avrupa bölgesinde barındırılır.
- **Moderasyon:** Uygulamanın dışında, n8n + Telegram. Uygulama yalnızca yeni mektubu bildiren bir webhook ve kararı işleyen güvenli bir uç sağlar.
- **Bildirimler:** Expo push bildirimleri.
- **Derleme ve dağıtım:** EAS Build; test için TestFlight ve Google Play dahili test.

## Ekranlar

Tıklanabilir prototipteki akış esas alınır:

1. **Kurallar (ilk açılış):** ilkeler, 18 yaş ve kural onayı, destek kaynakları bağlantısı.
2. **Bugün:** günün sorusu, "Bir mektup dinle" kartı, "Cevabını kaydet" düğmesi. Alt menü: Bugün, Posta kutusu, Kurallar.
3. **Dinle:** mektubu oynatma, ilerleme, "Sesle cevap ver", "Bildir".
4. **Kaydet:** alıcı seçimi (Bir yabancıya / Bir dostuma), 3 dakika sınırlı kayıt, baştan al, gönder.
5. **Mektubun yolda:** gecikme ve moderasyon açıklaması.
6. **Posta kutusu:** yoldaki mektuplar ve gelenler.

Prototipte olmayan ama gerekli olanlar: giriş ekranı, dost ekleme (davet kodu ile), gönderen engelleme, hesap ve veri silme.

## Tasarım

- Zemin `#F4EFE6` (kâğıt), yüzey `#FFFDF8`, çizgi `#E3D9C9`, metin `#1F1B16`, ikincil metin `#6B6257`, vurgu `#A0461F`.
- Kayıt ekranı koyu: zemin `#1F1B16`, metin `#F4EFE6`, vurgu `#E9A07A`, kayıt düğmesi `#D9663A`.
- Başlıklar Fraunces (serif), gövde Figtree.
- Dokunma alanları en az 44 px. Tüm arayüz metinleri Türkçedir; kod, değişken ve tablo adları İngilizcedir.

## Veri modeli

Tüm tablolarda Row Level Security açıktır.

- `profiles`: `id` (auth kullanıcısı), `display_name` (yalnızca dostlara görünür), `age_confirmed_at`, `push_token`, `is_banned`, `created_at`.
- `questions`: `id`, `text`, `publish_date` (benzersiz), `intensity` (`light` | `deep`).
- `friendships`: `user_a`, `user_b`, `status` (`pending` | `accepted`), `invite_code`, `created_at`.
- `letters`: `id`, `sender_id`, `recipient_id` (yabancı mektubunda havuzdan çekilene kadar boş), `recipient_type` (`stranger` | `friend`), `question_id`, `reply_to_letter_id`, `audio_path`, `duration_sec` (1–180), `status`, `reject_reason`, `created_at`, `deliver_after`, `approved_at`, `delivered_at`.
- `listens`: `user_id`, `letter_id`, `completed_at`.
- `reports`: `id`, `reporter_id`, `letter_id`, `reason` (`harassment` | `inappropriate` | `personal_info` | `at_risk`), `created_at`, `handled_at`.
- `blocks`: `blocker_id`, `blocked_id`, `created_at`.
- `moderation_decisions`: `id`, `letter_id`, `decision` (`approved` | `rejected`), `reason`, `note`, `decided_by`, `decided_at`. Bu tablo ileride otomatik moderasyonu test etmek için kullanılacak; her karar eksiksiz kaydedilir.

## Mektup yaşam döngüsü

Durumlar: `in_review` → `approved` veya `rejected` → `delivered`.

1. Gönderimde ses özel (private) depolamaya yüklenir, mektup `in_review` durumunda oluşturulur, `deliver_after = now() + rastgele 60–120 dk` atanır ve moderasyon webhook'u tetiklenir.
2. Moderasyon kararı güvenli uç üzerinden gelir; `approved` ya da `rejected` olarak işlenir ve `moderation_decisions` tablosuna yazılır.
3. Birkaç dakikada bir çalışan zamanlanmış görev, `approved` ve `deliver_after` zamanı geçmiş mektupları işler:
   - **Dost mektubu:** doğrudan alıcının posta kutusuna `delivered` olarak düşer ve push bildirimi gönderilir.
   - **Yabancı mektubu:** yabancı havuzuna girer. Bir kullanıcı "Bir mektup dinle"ye bastığında havuzdan uygun bir mektup ona atanır (kendi mektubu, engellediği ya da onu engelleyen biri olamaz). Her yabancı mektubu yalnızca bir kişiye gider.
4. Yabancıya verilen sesli cevap, `reply_to_letter_id` ile özgün gönderene yabancı olarak döner ve aynı döngüden geçer.
5. `rejected` mektuplar iletilmez; gönderene genel ve suçlamayan bir bildirim gösterilir. `at_risk` bildirimi alan ya da moderasyonda kriz belirtisi taşıdığı değerlendirilen mektubun göndericisine destek kaynakları gösterilir.

Havuz boşken dinleme şartı kullanıcıyı engellememelidir; bu durumda şart atlanır ve arayüzde nazikçe açıklanır.

## Güvenlik ve gizlilik kuralları

- Gizli anahtarlar yalnızca `.env` dosyalarındadır ve `.gitignore` içindedir. Supabase `service_role` anahtarı hiçbir zaman mobil uygulamaya girmez.
- Ses dosyaları herkese açık linkle sunulmaz; yalnızca kısa süreli imzalı URL'lerle erişilir.
- Alıcıya dönen sorgular `sender_id` alanını asla içermez; yabancı mektupları kimliği gizleyen bir view ya da RPC üzerinden okunur.
- Moderasyon uç noktası paylaşılan bir gizli anahtarla doğrulanır.
- Kullanıcı hesabını ve tüm ses kayıtlarını uygulama içinden silebilir.
- Bildirme ve engelleme her mektup ekranında erişilebilir olmalıdır (App Store kullanıcı içeriği kuralları).
- Kişisel veri loglara yazılmaz.

## Geliştirme aşamaları

Her aşama ayrı bir oturumda, kendi başına çalışır hâle getirilerek tamamlanır.

1. Proje iskeleti: Expo + TypeScript + expo-router, tasarım değişkenleri, altı ekranın statik hâli.
2. Supabase: giriş (e-posta ile tek kullanımlık kod), şema, RLS politikaları ve migration dosyaları.
3. Ses kaydı ve yükleme: 180 saniye sınırı, özel depolama.
4. Mektup yaşam döngüsü: durumlar, teslim zamanı, zamanlanmış görev.
5. Moderasyon entegrasyonu: webhook ve karar ucu (n8n ve Telegram tarafı ayrıca kurulacak).
6. Posta kutusu, dinleme, dinleme şartı ve yabancı havuzu.
7. Dost ekleme, bildirme, engelleme, hesap silme.
8. Push bildirimleri.
9. Kapalı test derlemesi.

## Çalışma biçimi

- Kod yazmadan önce yapacağın işi kısa bir planla anlat ve onayımı bekle.
- Küçük, gözden geçirilebilir adımlarla ilerle; her aşamanın sonunda neyi nasıl test edeceğimi yaz.
- Bir kararı belirsiz bulursan tahmin etme, sor.
- Yeni bir bağımlılık eklemeden önce neden gerektiğini söyle.
- Değişken ve tablo adları İngilizce, arayüz metinleri Türkçe.

## Alınan kararlar

Aşamalar sırasında onaylanan kararlar. Yeni bir karar alındığında buraya eklenir.

### 1. aşama
- İkonlar ve çizimler `react-native-svg` ile, prototipteki SVG'lerden birebir çizilir.
- Bir mektuba "Sesle cevap ver" ile gelinen kayıt ekranında alıcı seçimi gösterilmez; cevap her zaman özgün gönderene gider.
- Dost mektubunda başlık "Dostundan mektup · {isim}" biçimindedir (isme ek getirilmez).
- Destek kaynakları ayrı bir ekrandır; şimdilik yalnızca "Acil durumda 112" içerir, tam liste ürün sahibinden gelecek.
- Bir mektubu bildirmek, bildiren kullanıcı için o göndereni otomatik olarak engeller ("Bu kişiden yeni mektup almayacaksın"). 7. aşamada böyle uygulanır.
- Web desteği (`react-native-web`) yalnızca geliştirme sırasında kontrol içindir; uygulama web'e çıkmaz.

### 2. aşama
- "Gün" Europe/Istanbul saat dilimine göre değişir (günün sorusu Türkiye saatiyle gece yarısı değişir).
- Akış: Kurallar → Başla → e-posta → 6 haneli kod → Bugün. Onay, giriş tamamlanınca `profiles.age_confirmed_at` alanına yazılır.
- Oturum `@react-native-async-storage/async-storage` ile saklanır.
- Migration'lar `supabase` CLI ile uygulanır (`npx supabase db push`).
- Hesap ekranı gelene kadar (7. aşama) "Çıkış yap" bağlantısı Kurallar sekmesinin altındadır.
- Supabase'in hazır e-posta gönderimi yalnızca geliştirme içindir; kapalı testten (9. aşama) önce özel SMTP ayarlanır.
- `friendships` tablosunda `id` birincil anahtardır ve `user_b` davet kabul edilene kadar boştur; aynı iki kişi arasında tek dostluk olabilir.
- `blocks` tablosuna uygulamadan doğrudan erişim yoktur (engellenen kişinin kimliği istemciye ulaşmamalı); engelleme 7. aşamada mektup üzerinden çalışan bir fonksiyonla yapılır.
- Bir mektup silindiğinde (hesap silme) moderasyon kararı saklanır, yalnızca mektupla bağı kopar (`letter_id` boşalır).
- Kurallar ekranında "Hesabın var mı? Giriş yap" bağlantısı vardır; daha önce onay vermiş kullanıcı kutucuğu tekrar işaretlemez.
- Küçük büyük harfli başlıklar (Eyebrow) Türkçe kurala göre büyütülür (i → İ).

### 3. aşama
- Mektup kaydı (`send_letter`) 3. aşamada oluşturulur; zamanlanmış teslim ve durum geçişleri 4. aşamadadır.
- Ses dosyaları özel `letters` bucket'ında rastgele adla (`{uuid}.m4a`) durur; dosya yolunda kullanıcı kimliği yoktur. En fazla 1 MB, yalnızca m4a.
- Kayıt: m4a/AAC, mono, 32 kbps. 1–180 saniye.
- Kayıt bittikten sonra göndermeden önce dinlemek için "Dinle" düğmesi vardır.
- Kişi başı günde (Europe/Istanbul) en fazla 5 mektup gönderilir.
- Migration'ları ürün sahibi `npm run db:push` ile uygular; Claude sonucu Supabase bağlantısı üzerinden kontrol eder.
- Ürün sahibi bilgisayar başında değilse Claude migration'ı Supabase bağlantısı üzerinden, `supabase_migrations.schema_migrations` tablosuna aynı sürüm numarasını yazarak uygulayabilir (CLI geçmişi bozulmaz).
- `.env` git'e girmez; şablon `.env.example`'dır. `EXPO_PUBLIC_SUPABASE_URL` yalnızca proje adresidir (`https://<ref>.supabase.co`), sonuna yol eklenmez.
- Telefondan test için web derlemesi Hostinger'de `sesli-mektup.sichtbaron.de` adresinde yayınlanır (arama motorlarına kapalı, yalnızca HTTPS). Bu bir test ortamıdır; uygulamanın asıl dağıtımı mağazalar üzerindendir.

### 4. aşama
- Durum geçişlerini bir tetikleyici korur: `in_review` → `approved` | `rejected`, `approved` → `delivered`. `approved_at` ve `delivered_at` alanlarını sunucu doldurur.
- Moderasyon kararı `private.apply_moderation_decision()` ile işlenir (yalnızca sunucu tarafı); karar `moderation_decisions` tablosuna eksiksiz yazılır. 5. aşamaya kadar test onayı SQL editöründen verilir.
- Teslim görevi (`private.deliver_due_letters`, pg_cron) 5 dakikada bir çalışır. Alıcısı belli mektuplar (dost ve cevap) teslim edilir; yabancı mektupları onaylı hâlde havuzda bekler.
- Gönderen sonradan banlanmışsa ya da iki taraf arasında sonradan engelleme oluşmuşsa mektup sessizce teslim edilmez; gönderene "iletilemedi" gösterilmez.
- Gönderenin "Yolda" listesi (`get_my_outgoing_letters`) alıcı bilgisi içermez. Teslim edilen mektup listeden kalkar; "ulaştı" ya da "görüldü" bilgisi yoktur. Reddedilen mektup 7 gün boyunca genel ve suçlamayan bir notla görünür.
- Reddedilen mektupların ses dosyası 30 gün saklanıp silinir; bu temizlik 5. aşamada gelir.
