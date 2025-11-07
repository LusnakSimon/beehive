## 🔐 Environment Variables Pre Vercel

Choď na: **Vercel Dashboard → beehive-monitor → Settings → Environment Variables**

Pridaj tieto premenné (každú zvlášť):

### 1. NEXTAUTH_URL
```
https://ebeehive.vercel.app
```

### 2. NEXTAUTH_SECRET
```
6uR5rrTK3GdKO0RsmlpteI6NmtjdkQUGDFBBfQBPsmI=
```

### 3. GOOGLE_CLIENT_ID
```
[Skopíruj z Google Cloud Console]
```

### 4. GOOGLE_CLIENT_SECRET
```
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
```

### 5. GITHUB_ID
```
Ov23ctL2z21e3McpNTwq
```

### 6. GITHUB_SECRET
```
c901672543c21605bc3f88a244d926ddf1d18eed
```

### 7. MONGODB_URI (ak ešte nie je nastavené)
```
[Tvoj MongoDB connection string]
```

---

## ✅ Po pridaní všetkých premenných:

1. Klikni na **Deployments**
2. Vyber posledný deployment
3. Klikni na **"..." → Redeploy**
4. Zaškrtni **"Use existing Build Cache"** (rýchlejšie)
5. Klikni **Redeploy**

Deployment bude hotový za 1-2 minúty a OAuth bude fungovať! 🚀
