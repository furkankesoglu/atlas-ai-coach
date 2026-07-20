# ATLAS AI Coach v3

ATLAS AI Coach; günlük check-in, Push/Pull/Legs antrenmanı, beslenme-makro takibi, ilerleme fotoğrafları, günlük geçmiş ve yapay zekâ sohbetini tek panelde birleştiren Next.js uygulamasıdır.

## Yerel çalıştırma

```bash
npm install
npm run dev
```

Ardından `http://localhost:3000` adresini açın.

## Supabase üyelik ve bulut senkronizasyonu

1. Supabase üzerinde yeni bir proje oluşturun.
2. `supabase/schema.sql` dosyasının tamamını Supabase SQL Editor içinde çalıştırın.
3. `.env.example` dosyasını `.env.local` adıyla kopyalayın.
4. Supabase Project Settings > API bölümünden Project URL ve publishable/anon key değerlerini ekleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJE.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ANAHTAR
```

5. Geliştirme sunucusunu yeniden başlatın.

Bu değişkenler yoksa uygulama yerel modda ve localStorage ile çalışmaya devam eder. Değişkenler eklendiğinde giriş/kayıt ekranı açılır ve her kullanıcının verileri `atlas_user_state` tablosunda kendisine özel RLS kurallarıyla saklanır.

## OpenAI

`.env.local` içine sunucu tarafı anahtarı ekleyin:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

API anahtarı istemci koduna veya `NEXT_PUBLIC_` değişkenine konulmamalıdır.

## Notlar

- Fotoğraflar bu MVP sürümünde uygulama durumuyla birlikte saklanır. Çok sayıda/yüksek çözünürlüklü fotoğraf için sonraki aşamada Supabase Storage kullanılmalıdır.
- Sağlık verileri hassas kabul edilmelidir. Üretim yayını öncesinde açık rıza, gizlilik metni, veri silme ve yedekleme akışları eklenmelidir.
