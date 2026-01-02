# 🛠️ Local Development Setup

Pre lokálne testovanie map funkcionality potrebuješ MongoDB pripojenie.

## Možnosť 1: MongoDB Atlas (Odporúčané)

1. **Vytvor `.env` súbor** v root adresári:
```bash
cp .env.example .env
```

2. **Pridaj MongoDB Atlas URI** do `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/beehive?retryWrites=true&w=majority
JWT_SECRET=your-secret-key-here
NEXTAUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_URL=http://localhost:5173
```

3. **Spusti development server**:
```bash
npm run dev
```

## Možnosť 2: Lokálny MongoDB

1. **Nainštaluj MongoDB lokálne**:
```bash
# Ubuntu/Debian
sudo apt install mongodb

# MacOS
brew install mongodb-community
```

2. **Spusti MongoDB**:
```bash
mongod --dbpath ~/data/db
```

3. **Vytvor `.env`** s local URI:
```env
MONGODB_URI=mongodb://localhost:27017/beehive
JWT_SECRET=dev-secret-key
NEXTAUTH_SECRET=dev-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_URL=http://localhost:5173
```

## Možnosť 3: Testovanie s Production API

Ak nechceš nastavovať lokálnu databázu, môžeš testovať priamo na production:

**URL:** https://ebeehive.vercel.app

Tam je už všetko nastavené a funkčné.

## 🧪 Overenie fungovania

Po nastavení:

1. Otvor http://localhost:5173
2. Prihlás sa cez Google/GitHub
3. Prejdi do Settings → Pridaj úľ s GPS
4. Prejdi na Mapu → Mali by sa zobraziť úle

## 🔍 Debugging

Ak mapa nezobrazuje úle, skontroluj browser console (F12):

```javascript
// Mali by si vidieť:
📍 Map API response: { success: true, hives: [...] }
📍 Hives received: X

// Ak vidíš:
❌ Map API error: 401 Unauthorized
// → Nie si prihlásený

❌ Map API error: 500 
// → MongoDB nie je pripojená (skontroluj MONGODB_URI)

⚠️ User's hive "..." has no valid coordinates: undefined
// → Úľ nemá GPS súradnice (pridaj ich v Settings)
```

## 📝 Poznámky

- Vercel production používa MongoDB Atlas (nastavené v Vercel env vars)
- Local development potrebuje vlastné MongoDB pripojenie
- `.env` súbor je v `.gitignore` - každý developer musí vytvoriť vlastný
- OAuth vyžaduje nastavenie redirect URLs v Google/GitHub console
