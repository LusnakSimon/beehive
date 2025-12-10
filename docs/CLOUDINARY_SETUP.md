# Cloudinary Setup Guide

File uploads v aplikácii používajú **Cloudinary** na serverless platformách (Vercel) a lokálny storage pri vývoji.

## Prečo Cloudinary?

- ✅ **Serverless kompatibilita** - Vercel funkcie nemôžu zapisovať do `/public`
- ✅ **CDN hosting** - Rýchle doručovanie súborov
- ✅ **Automatická optimalizácia** - Obrázky sa automaticky komprimujú
- ✅ **Free tier** - 25GB storage a 25GB bandwidth mesačne zadarmo

## Nastavenie

### 1. Vytvor Cloudinary účet

1. Choď na [cloudinary.com](https://cloudinary.com/)
2. Zaregistruj sa (Free plan je dostačujúci)
3. Po prihlásení nájdeš Dashboard s credentials

### 2. Získaj API credentials

Na Cloudinary Dashboard nájdeš:
- **Cloud Name** (napr. `dxxxxxx`)
- **API Key** (napr. `123456789012345`)
- **API Secret** (klikni na "Reveal" pre zobrazenie)

### 3. Pridaj do .env

Lokálny `.env` súbor:
```env
CLOUDINARY_CLOUD_NAME=tvoj-cloud-name
CLOUDINARY_API_KEY=tvoj-api-key
CLOUDINARY_API_SECRET=tvoj-api-secret
```

### 4. Pridaj do Vercel Environment Variables

1. Choď do Vercel Dashboard → Project Settings → Environment Variables
2. Pridaj tieto 3 premenné pre **Production**, **Preview** a **Development**:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 5. Redeploy Vercel

Po pridaní environment variables je potrebné redeploy:
```bash
git push origin main
```
alebo v Vercel Dashboard klikni na "Redeploy"

## Ako to funguje?

### Lokálny vývoj (bez Cloudinary)
- Súbory sa ukladajú do `public/uploads/`
- Prístupné cez `/uploads/chat/` alebo `/uploads/groups/`
- Žiadna dodatočná konfigurácia potrebná

### Production (Vercel s Cloudinary)
- Automaticky detekuje serverless prostredie
- Nahrané súbory idú priamo do Cloudinary
- Vracia CDN URLs (napr. `https://res.cloudinary.com/...`)
- Optimalizované a rýchle doručovanie

### Production (Vercel BEZ Cloudinary)
- File upload bude vypnutý
- Skupiny a chat fungujú, ale nemôžeš nahrávať súbory
- V konzole sa zobrazí warning

## Testovanie

### Otestuj lokálne
1. Spusti aplikáciu: `npm run dev`
2. Vytvor skupinu s obrázkom
3. Pošli súbor v chate
4. Skontroluj `public/uploads/`

### Otestuj na Vercel
1. Uisti sa že máš Cloudinary credentials v Vercel
2. Deploynuť aplikáciu
3. Vytvor skupinu s obrázkom
4. Pošli súbor v chate
5. Skontroluj Network tab - URLs by mali byť z Cloudinary

## Troubleshooting

### "File upload not available" chyba na Vercel
- ✅ Skontroluj či máš všetky 3 Cloudinary premenné v Vercel
- ✅ Redeployni aplikáciu po pridaní premenných
- ✅ Skontroluj či názvy premenných sú správne

### Súbory sa neukladajú
- ✅ Skontroluj Cloudinary Dashboard → Media Library
- ✅ Pozri Vercel Logs pre error messages
- ✅ Overiť API credentials

### Obrázky sa nezobrazujú
- ✅ Skontroluj URL v databáze (mali by byť Cloudinary URLs)
- ✅ Skontroluj browser Network tab
- ✅ Pozri CORS nastavenia v Cloudinary (defaultne by malo fungovať)

## Limity Free Tier

- 25 GB storage
- 25 GB monthly bandwidth
- 25,000 transformácií mesačne

Pre väčšinu projektov je to dostačujúce. Môžeš upgradnúť later ak potrebuješ viac.

## Ďalšie info

- [Cloudinary Docs](https://cloudinary.com/documentation)
- [Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [Multer Storage Cloudinary](https://github.com/affanshahid/multer-storage-cloudinary)
