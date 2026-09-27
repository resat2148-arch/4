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
