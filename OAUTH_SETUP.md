# OAuth Authentication Setup Guide

## 🔐 Konfigurácia Google OAuth

### 1. Vytvor Google Cloud Project
1. Choď na [Google Cloud Console](https://console.cloud.google.com/)
2. Vytvor nový projekt alebo vyber existujúci
3. Klikni na "APIs & Services" > "Credentials"

### 2. Nastav OAuth Consent Screen
1. Klikni na "OAuth consent screen" v bočnom menu
2. Vyber **External** user type
3. Vyplň základné informácie:
   - **App name**: eBeeHive
   - **User support email**: tvoj email
   - **Developer contact**: tvoj email
4. Scopes: Nepotrebuješ pridávať špeciálne scopes (userinfo.email a userinfo.profile sú default)
5. Test users: Pridaj svoj email pre testovanie
6. Ulož a pokračuj

### 3. Vytvor OAuth 2.0 Client ID
1. Choď na "Credentials" > "Create Credentials" > "OAuth client ID"
2. Application type: **Web application**
3. Name: `eBeeHive Production`
4. Authorized JavaScript origins:
   ```
   https://ebeehive.vercel.app
   http://localhost:3000
   ```
5. Authorized redirect URIs:
   ```
   https://ebeehive.vercel.app/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
6. Klikni "Create"
7. **Skopíruj Client ID a Client Secret** - budeme ich potrebovať

---

## 🐙 Konfigurácia GitHub OAuth

### 1. Vytvor GitHub OAuth App
1. Choď na [GitHub Settings](https://github.com/settings/developers)
2. Klikni na "OAuth Apps" > "New OAuth App"

### 2. Vyplň detaily aplikácie
- **Application name**: eBeeHive
- **Homepage URL**: `https://ebeehive.vercel.app`
- **Application description**: Inteligentný systém monitorovania úľov
- **Authorization callback URL**: 
  ```
  https://ebeehive.vercel.app/api/auth/callback/github
  ```

### 3. Registruj aplikáciu
1. Klikni "Register application"
2. **Skopíruj Client ID**
3. Klikni "Generate a new client secret"
4. **Skopíruj Client Secret** (zobrazí sa len raz!)

### 4. Pre lokálne testovanie
Vytvor druhú OAuth app pre development:
- **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

---

## ⚙️ Konfigurácia Environment Variables

### 1. Vygeneruj NEXTAUTH_SECRET
```bash
# V terminále spusti:
openssl rand -base64 32
```

### 2. Pridaj do Vercel
1. Choď na [Vercel Dashboard](https://vercel.com/dashboard)
2. Vyber projekt `beehive-monitor`
3. Choď do **Settings** > **Environment Variables**
4. Pridaj tieto premenné:

```env
NEXTAUTH_URL=https://ebeehive.vercel.app
NEXTAUTH_SECRET=<vygenerovaný-secret-z-openssl>
GOOGLE_CLIENT_ID=<tvoj-google-client-id>
GOOGLE_CLIENT_SECRET=<tvoj-google-client-secret>
GITHUB_ID=<tvoj-github-client-id>
GITHUB_SECRET=<tvoj-github-client-secret>
```

### 3. Pre lokálny development
Vytvor súbor `.env.local` v root adresári:
```env
MONGODB_URI=mongodb+srv://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<tvoj-secret>
GOOGLE_CLIENT_ID=<tvoj-google-client-id>
GOOGLE_CLIENT_SECRET=<tvoj-google-client-secret>
GITHUB_ID=<tvoj-github-client-id>
GITHUB_SECRET=<tvoj-github-client-secret>
```

**⚠️ DÔLEŽITÉ**: `.env.local` je v `.gitignore` - nikdy ho necommituj!

---

## 🚀 Redeploy na Vercel

Po pridaní environment variables:
1. Choď do Vercel Dashboard
2. Deployments > Latest deployment
3. Klikni na "..." > "Redeploy"
4. Alebo jednoducho pushni do git:
```bash
git add .
git commit -m "Add OAuth authentication"
git push
```

---

## 🧪 Testovanie

### 1. Otvor aplikáciu
```
https://ebeehive.vercel.app/login
```

### 2. Skús sa prihlásiť
- Klikni na "Pokračovať s Google" alebo "Pokračovať s GitHub"
- Udeľ potrebné oprávnenia
- Mal by si byť presmerovaný na Dashboard

### 3. Skontroluj databázu
V MongoDB Atlas by si mal vidieť:
- Kolekciu `users` s tvojim záznamom
- Kolekcie `accounts`, `sessions` (vytvorené NextAuth)

---

## 🐝 Priradenie úľov používateľom

### Cez Admin panel (budeš musieť byť označený ako admin)
1. V MongoDB Atlas nájdi tvojho usera v kolekcii `users`
2. Zmeň `role` z `user` na `admin`
3. Obnov stránku, mali by si vidieť "Admin" tab v navigácii

### Cez API (pre testovanie)
```bash
# Získaj svoje user ID z MongoDB
USER_ID="tvoje-user-id"

# Priradenie úľa HIVE-001 k používateľovi
curl -X POST "https://ebeehive.vercel.app/api/user/hives" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tvoj-session-token>" \
  -d '{"hiveId":"HIVE-001"}'

# Zoznam tvojich úľov
curl "https://ebeehive.vercel.app/api/user/hives" \
  -H "Authorization: Bearer <tvoj-session-token>"
```

---

## 🔒 Bezpečnosť

### Production checklist:
- ✅ HTTPS len (Vercel to má automaticky)
- ✅ Secure cookies (nastavené v NextAuth)
- ✅ CSRF protection (built-in v NextAuth)
- ✅ Environment variables nie sú v git
- ✅ Session expiry (30 dní)
- ✅ OAuth state parameter (automaticky)

### Odporúčania:
1. **Pravidelne rotuj secrets** (každé 3-6 mesiacov)
2. **Monitoruj OAuth usage** v Google/GitHub dashboardoch
3. **Nastav rate limiting** (Vercel má basic built-in)
4. **Povoľ 2FA** na tvojom Google/GitHub účte
5. **Review oprávnení** ktoré OAuth aplikácie žiadajú

---

## 🐛 Troubleshooting

### "Error: Cannot find module 'next-auth'"
```bash
cd /workspaces/dongfeng/beehive-monitor
npm install next-auth @next-auth/mongodb-adapter --legacy-peer-deps
```

### "Error: NEXTAUTH_SECRET is not defined"
Skontroluj že si pridal NEXTAUTH_SECRET do Vercel environment variables a redeployol aplikáciu.

### "Error: Redirect URI mismatch"
Skontroluj že redirect URI v Google/GitHub OAuth nastaveniach presne zodpovedá:
```
https://ebeehive.vercel.app/api/auth/callback/google
https://ebeehive.vercel.app/api/auth/callback/github
```

### "User session not persisting"
1. Vymaž cookies pre ebeehive.vercel.app
2. Skontroluj MongoDB connection (môže byť IP whitelist problém)
3. Skontroluj že `NEXTAUTH_URL` je správne nastavená

### MongoDB IP Whitelist
Ak používaš MongoDB Atlas, uisti sa že máš povolené Vercel IP adresy:
1. MongoDB Atlas > Network Access
2. Pridaj IP: `0.0.0.0/0` (všetky IP - pre production použi Vercel IP list)

---

## 📚 Ďalšie kroky

Po úspešnej konfigurácii OAuth môžeš:
1. **Implementovať role-based access** - Admin, User, Viewer
2. **Notification preferences** - Povoliť/zakázať typy notifikácií
3. **Multi-hive management** - UI pre správu viacerých úľov
4. **Sharing/collaboration** - Zdieľanie úľov s inými používateľmi
5. **API keys** - Pre integráciu s IoT zariadeniami

---

## 🆘 Pomoc

Ak narazíš na problémy:
1. Skontroluj Vercel logs: `https://vercel.com/your-project/deployments`
2. Skontroluj browser console pre JavaScript errors
3. Skontroluj Network tab pre failed API calls
4. MongoDB logs v Atlas Dashboard

Need help? Check:
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Google OAuth Guide](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Guide](https://docs.github.com/en/developers/apps/building-oauth-apps)
