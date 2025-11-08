# 🗺️ Hive Map Feature

Táto vetva pridáva funkcionalitu mapy úľov s GPS lokalizáciou a vzdialenosťami medzi nimi.

## 🎯 Funkcie

### Pre používateľov:
- **GPS Súradnice**: Pridaj GPS polohu k svojim úľom (manuálne alebo automaticky)
- **Mapa úľov**: Zobraz všetky svoje úle na interaktívnej mape
- **Viditeľnosť**: Nastav či má byť úľ súkromný (len ty) alebo verejný (všetci užívatelia)
- **Vzdialenosti**: Zobraz vzdialenosti medzi úľmi (tvoje aj verejné ostatných)
- **Filter pohľadu**: Zapni/vypni zobrazenie vzdialeností čiarou na mape
- **Detaily**: Klikni na úľ pre zobrazenie detailov (názov, majiteľ, lokácia)

### Implementované zmeny:

#### Backend (`lib/models/User.js`)
```javascript
ownedHives: [{
  id: String,          // HIVE-001
  name: String,        // Záhradný úľ
  location: String,    // Záhrada A
  color: String,       // #fbbf24
  coordinates: {
    lat: Number,       // 48.716
    lng: Number        // 21.261
  },
  visibility: String   // 'private' | 'public'
}]
```

#### API Endpointy (`lib/routes/users.js`)
- `GET /api/users/hives/map` - Získaj všetky úle s GPS (podľa visibility)
- `PATCH /api/users/me/hives/:hiveId` - Aktualizuj detaily úľa (GPS, visibility, farba, názov)
- `POST /api/users/me/hives` - Vytvor úľ s voliteľnými GPS súradnicami

#### Frontend
- **HiveMap.jsx** - Nová stránka s mapou (React Leaflet)
- **Settings.jsx** - Rozšírený formulár pre GPS a visibility
- **Navigation** - Pridané tlačidlo "🗺️ Mapa"

## 🔧 Technické detaily

### Použité knižnice:
- `leaflet` v1.9.4 - Open-source mapová knižnica
- `react-leaflet` v4.2.1 - React komponenty pre Leaflet
- OpenStreetMap - Mapové dlaždice (bezplatné)

### Vzorec vzdialenosti:
Haversine formula pre výpočet vzdialenosti medzi GPS súradnicami:
```javascript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Polomer Zeme v km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

## 📱 Použitie

### 1. Pridaj GPS k úľu
V **Nastaveniach**:
1. Vytvor nový úľ alebo uprav existujúci
2. Klikni "📍 Použiť moju aktuálnu polohu" (potrebné povoliť geolokáciu)
3. Alebo zadaj súradnice manuálne (Latitude, Longitude)
4. Vyber viditeľnosť:
   - 🔒 **Súkromný** - len ty vidíš úľ na mape
   - 🌍 **Verejný** - všetci užívatelia vidia úľ

### 2. Zobraz mapu
1. Prejdi na **🗺️ Mapa** v navigácii
2. Uvidíš všetky svoje úle + verejné úle ostatných
3. Klikni na marker pre detaily
4. Klikni na úľ v bočnom paneli pre zobrazenie vzdialeností

### 3. Analyzuj vzdialenosti
- Vyber úľ kliknutím na marker
- V bočnom paneli uvidíš zoznam vzdialeností k ostatným úľom
- Zapni "Zobraziť vzdialenosti" pre čiary na mape

## 🎨 Design

### Markery:
- **Tvoje úle**: Biely okraj, emoji 🐝
- **Verejné úle**: Sivý okraj, emoji 🐝
- **Farba**: Podľa farby úľa nastavenej v Settings

### Vzdialenosti:
- Menej ako 1 km: Zobrazené v metroch (napr. "450 m")
- Viac ako 1 km: Zobrazené v kilometroch (napr. "2.35 km")

## 🔐 Privacy a bezpečnosť

### Čo je chránené:
- Súkromné úle sa **nezobrazujú** iným užívateľom
- Meno majiteľa súkromného úľa je **skryté** ("Anonymous")
- GPS súradnice sú **voliteľné** - môžeš mať úle bez GPS

### Čo je verejné:
- Verejné úle sú viditeľné všetkým prihláseným užívateľom
- Zobrazuje sa meno majiteľa verejného úľa
- GPS súradnice sú prístupné cez API endpoint

## 🚀 Budúce vylepšenia

Možné rozšírenia:
- [ ] Clustering markerov pri priblížení
- [ ] Heatmapa hustoty úľov
- [ ] Filter podľa typu úľa
- [ ] Notifikácie o úľoch v okolí
- [ ] Export GPS do KML/GPX
- [ ] Offline mapa (PWA cache)
- [ ] Zdieľanie lokácie úľa cez link
- [ ] Radius search (nájdi úle do 5km)

## 📊 Štatistiky na mape

Hlavička zobrazuje:
- **X mojich úľov** - počet tvojich úľov s GPS
- **X verejných úľov** - počet verejných úľov ostatných užívateľov

## ⚙️ Konfigurácia

### Environment Variables
Nie sú potrebné nové premenné - používa existujúci JWT a MongoDB.

### Database Migration
Pri prvom použití starých užívateľov:
- Existujúce úle nemajú `coordinates` ani `visibility`
- Automaticky sa nastavia ako súkromné
- GPS je `undefined` - úle sa nezobrazia na mape kým nepridáš súradnice

## 🐛 Debugging

### Úle sa nezobrazujú na mape:
1. Skontroluj či má úľ GPS súradnice v nastaveniach
2. Skontroluj konzolu prehliadača (F12) pre chyby Leaflet
3. Overiť `GET /api/users/hives/map` odpoveď

### Geolokácia nefunguje:
1. Povol geolokáciu v prehliadači (chrome://settings/content/location)
2. Funguje len cez HTTPS (production) alebo localhost (development)
3. Safari potrebuje explicitné povolenie pre každú stránku

## 📝 Testovanie

1. Vytvor úľ s GPS súradnicami
2. Nastav viditeľnosť na verejný
3. Odhlásiť/prihlásiť ako iný užívateľ
4. Skontroluj či vidíš prvý úľ na mape
5. Klikni na marker - over detaily
6. Vytvor druhý úľ s inými súradnicami
7. Skontroluj výpočet vzdialenosti

## 📄 Licencia

Súčasť beehive-monitor projektu.
