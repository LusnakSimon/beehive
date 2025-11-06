# 🔔 Push Notifikácie

Systém push notifikácií pre Beehive Monitor.

## 🎯 Funkcie

Aplikácia upozorní užívateľa na:

1. **🌡️ Teplota mimo rozsahu**
   - Teplota pod minimom (default 30°C)
   - Teplota nad maximom (default 36°C)

2. **💧 Vlhkosť mimo rozsahu**
   - Vlhkosť pod minimom (default 50%)
   - Vlhkosť nad maximom (default 60%)

3. **🔋 Nízka batéria**
   - Batéria pod 20%

4. **⚖️ Zmena hmotnosti**
   - Zmena > 2kg za hodinu
   - Možné príčiny: rojenie alebo krádež

5. **📡 Zariadenie offline**
   - Žiadne dáta viac ako 60 minút

## 📱 Ako použiť

### 1. Povoliť notifikácie

1. Otvor **Nastavenia** (⚙️)
2. Prejdi na sekciu **🔔 Notifikácie**
3. Zapni **"Povoliť notifikácie"**
4. Potvrď povolenie v prehliadači

### 2. Vybrať typy notifikácií

Zaklikni ktoré typy upozornení chceš dostávať:
- ✅ Teplota mimo rozsahu
- ✅ Vlhkosť mimo rozsahu  
- ✅ Nízka batéria
- ✅ Zmena hmotnosti
- ✅ Zariadenie offline

### 3. Otestovať

Klikni na **"🔔 Otestovať notifikáciu"** pre odoslanie testovacej notifikácie.

## 🔧 Technické detaily

### Frontend
- **Service Worker** (`/sw.js`) - spracováva push notifikácie
- **NotificationContext** - globálny stav notifikácií
- **NotificationSettings** - UI komponent pre nastavenia

### Backend
- **API endpoint**: `POST /api/notifications/check?hiveId=HIVE-001`
- Kontroluje podmienky a vracia zoznam alertov
- Používa optimálne rozsahy z nastavení

### Podmienky

```javascript
{
  temperature: tempMin, tempMax,  // z localStorage
  humidity: humidityMin, humidityMax,  // z localStorage
  battery: < 20%,
  weight: > 2kg za hodinu,
  offline: > 60 minút
}
```

## 🌐 Podporované prehliadače

- ✅ Chrome/Edge (Android, Desktop)
- ✅ Firefox (Android, Desktop)
- ✅ Safari (iOS 16.4+, macOS)
- ❌ iOS Safari < 16.4

## 🔐 Oprávnenia

Aplikácia potrebuje povolenie pre:
- **Notifications** - zobrazovanie notifikácií
- **Service Worker** - background processing

## 📊 Ako to funguje

1. **Registrácia Service Workera**
   ```javascript
   navigator.serviceWorker.register('/sw.js')
   ```

2. **Žiadosť o povolenie**
   ```javascript
   Notification.requestPermission()
   ```

3. **Kontrola podmienok** (periodicky alebo on-demand)
   ```javascript
   fetch('/api/notifications/check?hiveId=HIVE-001')
   ```

4. **Zobrazenie notifikácie**
   ```javascript
   registration.showNotification(title, options)
   ```

## 🐛 Troubleshooting

**Problém**: Notifikácie nefungujú
- **Riešenie**: Skontroluj či je Service Worker zaregistrovaný v DevTools → Application → Service Workers

**Problém**: Permission "denied"
- **Riešenie**: Resetuj povolenia v prehliadači a povoľ znovu

**Problém**: iOS Safari < 16.4
- **Riešenie**: Updatuj iOS na 16.4+ alebo použi iný prehliadač

**Problém**: Notifikácie sa nezobrazujú na pozadí
- **Riešenie**: Mobilné prehliadače majú obmedzenia, fungujeswhen app is open

## 📝 Príklad API Response

```json
{
  "alerts": [
    {
      "title": "🔥 HIVE-001 - Vysoká teplota",
      "body": "Teplota 38°C je nad maximom (36°C)",
      "tag": "temperature-high",
      "type": "temperature"
    },
    {
      "title": "🔋 HIVE-001 - Nízka batéria",
      "body": "Batéria na 15%, nabite zariadenie",
      "tag": "battery-low",
      "type": "battery"
    }
  ],
  "latest": {
    "temperature": 38,
    "humidity": 55,
    "weight": 45.2,
    "battery": 15,
    "timestamp": "2025-11-06T15:30:00.000Z"
  }
}
```

## 🚀 Budúce vylepšenia

- [ ] Periodic Background Sync (automatická kontrola každých 15 minút)
- [ ] Vlastné prahy pre každý úľ
- [ ] Email notifikácie
- [ ] SMS notifikácie (cez Twilio)
- [ ] Notifikačná história
- [ ] Quiet hours (nočný režim)
