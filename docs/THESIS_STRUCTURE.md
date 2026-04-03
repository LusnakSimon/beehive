# Inteligentný IoT systém na monitorovanie včelieho úľa
## Intelligent IoT System for Beehive Monitoring

### Navrhovaná štruktúra diplomovej/bakalárskej práce

---

## ÚVOD (Introduction)

- Motivácia: celosvetový úpadok populácie včiel, Colony Collapse Disorder (CCD)
- Význam včelárstva pre poľnohospodárstvo (opeľovanie ~75 % plodín)
- Potreba moderného monitorovania úľov — tradičné metódy sú invazívne a nespoľahlivé
- Cieľ práce: navrhnúť a implementovať kompletný IoT systém pre monitorovanie parametrov úľa
- Stručný prehľad výsledného riešenia (senzorový uzol, gateway, cloud, PWA)

---

## 1. ANALÝZA PROBLEMATIKY (Analysis)

### 1.1 Stav včelárstva a potreba monitorovania
- Štatistiky úpadku včelstiev (EFSA, FAO)
- Colony Collapse Disorder — príčiny a dôsledky
- Význam hmotnosti, teploty a vlhkosti ako kľúčových indikátorov zdravia úľa
- Ekonomický dopad straty včelstiev

### 1.2 Existujúce riešenia monitorovania úľov
- Komerčné systémy: BroodMinder, Arnia, HiveWatch, BEEP
- Open-source projekty: HiveMonitor, Open Source Beehives
- Porovnanie podľa: cena, senzory, komunikácia, energetická efektivita, softvér
- Tabuľka porovnania existujúcich riešení
- Medzery a limitácie existujúcich riešení (cena, uzavretosť, chýbajúca sociálna/komunitná funkcia)

### 1.3 IoT technológie a komunikačné protokoly
- Prehľad IoT architektúr (edge → fog → cloud)
- WiFi vs. LoRa vs. LoRaWAN vs. Sigfox vs. NB-IoT
- Výber LoRa: dosah, spotreba, licencia, cena
- Porovnanie frekvenčných pásiem (868 MHz EU)

### 1.4 Senzorové technológie
- Meranie teploty a vlhkosti: DHT22, AHT10, SHT40 — porovnanie presnosti a spotreby
- Meranie hmotnosti: tenzometre (load cells), Wheatstoneov mostík, HX711 ADC
- Kalibrácia váhového senzora — princípy a výzvy

### 1.5 Mikrokontrolérové platformy
- ESP32 vs. Arduino Pro Mini vs. Raspberry Pi Pico W
- Energetická spotreba v rôznych režimoch (aktívny, deep sleep)
- Výber Arduino Pro Mini 3.3V/8MHz pre uzol (ultra-low power) a ESP32-C3 pre gateway (WiFi)

### 1.6 Cloudové platformy a serverless architektúra
- Vercel serverless functions vs. AWS Lambda vs. Firebase
- MongoDB Atlas ako cloudová databáza
- Výhody serverless: škálovateľnosť, nulová údržba, free tier

### 1.7 Progresívne webové aplikácie (PWA)
- Čo je PWA: Service Worker, Web App Manifest, offline podpora
- PWA vs. natívna aplikácia vs. hybridná aplikácia
- Výhody: multi-platformovosť, inštalovateľnosť, offline funkčnosť

---

## 2. NÁVRH SYSTÉMU (System Design)

### 2.1 Celková architektúra systému
- Trojvrstvová architektúra: senzor → cloud → klient
- Diagram toku dát:
  ```
  Senzorový uzol → LoRa → Gateway → WiFi → Vercel API → MongoDB → PWA
  ```
- Alternatívne dátové cesty: manuálny vstup, simulátor, priame WiFi

### 2.2 Návrh hardvérovej časti

#### 2.2.1 Senzorový uzol (Beehive Node)
- Bloková schéma: MCU + senzory + rádio + napájanie
- Arduino Pro Mini 3.3V/8MHz — dôvody výberu
- SHT40 (I2C) — teplota a vlhkosť
- HX711 + 4× tenzometer — váhová platforma
- RFM95W — LoRa modul 868 MHz
- LiFePO4 batéria + solárny panel
- A1SHB P-channel MOSFET — power gating

#### 2.2.2 Gateway
- ESP32-C3 SuperMini
- RFM95W — LoRa prijímač
- WiFi pripojenie na internet
- Funkcionalita: príjem LoRa → parsovanie JSON → HTTP POST na API

#### 2.2.3 Napájacia stratégia
- LiFePO4: stabilné napätie 3.2-3.3V, dlhá životnosť
- Solárne dopĺňanie
- Energetické režimy: wake → measure → transmit → deep sleep
- MOSFET power gating senzorov
- Cieľová spotreba v deep sleep: ~4-6 µA (po hardvérových modifikáciách)

### 2.3 Návrh komunikačného protokolu
- Formát LoRa paketu: kompaktný JSON `{"t":21.5,"h":55,"w":45.12,"bv":3.25,"bp":40,"n":1}`
- Prečo JSON namiesto binárneho formátu (čitateľnosť, jednoduchosť ladenia)
- Overenie cez API kľúč na strane servera

### 2.4 Návrh serverovej časti
- Vercel serverless functions (Node.js)
- REST API endpointy: `/api/sensor`, `/api/harvests`, `/api/inspection`, ...
- MongoDB schémy: Reading, User, Harvest, Inspection, Group, Conversation, ...
- Autentifikácia: OAuth 2.0 (Google, GitHub) cez NextAuth.js
- Autorizácia: JWT session cookies
- Rate limiting a validácia vstupov
- CORS konfigurácia

### 2.5 Návrh klientskej aplikácie (PWA)
- React + Vite — dôvody výberu
- Komponentová hierarchia a routing (React Router)
- Context API pre stav: AuthContext, HiveContext, NotificationContext, ToastContext
- Lazy loading stránok (code splitting)
- Offline podpora: Service Worker, IndexedDB cache, offline queue
- Responzívny dizajn pre mobilné zariadenia

### 2.6 Dátový model
- ER diagram / schéma MongoDB kolekcií
- Reading: temperature, humidity, weight, battery, hiveId, timestamp, source, metadata
- User: meno, email, ownedHives (s device konfiguráciou), profil
- Harvest, Inspection, Group, Conversation, Message, FriendRequest, Notification...

---

## 3. IMPLEMENTÁCIA (Implementation)

### 3.1 Hardvérová implementácia

#### 3.1.1 Zostavenie senzorového uzla
- Schéma zapojenia (fritzing/KiCad diagram)
- Zapojenie tenzometrov do Wheatstoneovho mostíka (4× 3-vodičové články)
- I2C pripojenie SHT40
- SPI pripojenie RFM95W
- Napájací obvod s MOSFET spínačom

#### 3.1.2 Firmware senzorového uzla
- Iteratívny vývoj: v2_01 až v2_09 (12 verzií)
  - v2_01: test MOSFET power gating
  - v2_02: test batérie a napäťového deliča
  - v2_03–v2_04: test teplotných senzorov (AHT10 → SHT40)
  - v2_05: test HX711 a tenzometrov
  - v2_06: test LoRa komunikácie
  - v2_07: interaktívna kalibrácia váhy
  - v2_08: diagnostika nelinearity + plný TX test
  - v2_09: produkčný firmvér + raw monitor
- Výsledný produkčný firmvér (v2_09_final_node):
  - Cyklus: wake → battery check → MOSFET ON → SHT40 + HX711 → MOSFET OFF → LoRa TX → sleep
  - WDT deep sleep (~15–30 min interval)
  - Ochrana batérie (LOW_BATT, CRIT_BATT prahy)
  - EEPROM persistencia počítadla TX
  - Kalibrácia: CALIBRATION_FACTOR=50.8, TARE_OFFSET=30200
  - Kompilačné makrá: SERIAL_ENABLED, WEIGHT_ENABLED

#### 3.1.3 Kalibrácia váhového senzora
- Princíp kalibrácie: tare offset + known weight → factor
- Riešené problémy:
  - Negatívny surový výstup (polarita E+/E-)
  - Negatívny kalibračný faktor (polarita A+/A-)
  - Nelinearita (diagnostika v2_08: šum, saturácia, gain sweep, hysterézia, creep)
  - Bug sériovej komunikácie (parseFloat → strtod fix)
- Diagnostický tooling: 9-testová sada
- Výsledok: lineárna kalibrácia, R² > 0.99

#### 3.1.4 Hardvérové modifikácie pre nízku spotrebu
- Odstránenie onboard LED
- Bypass napäťového regulátora (LiFePO4 priamo na VCC)
- Merania spotreby pred a po modifikáciách

#### 3.1.5 Gateway implementácia
- ESP32-C3 + RFM95W
- Vlastné SPI piny (MISO-5, MOSI-6, NSS-10, SCK-20, RESET-21)
- Príjem LoRa → parsovanie → HTTP POST
- Automatické reconnect WiFi

### 3.2 Serverová implementácia

#### 3.2.1 API endpointy
- `/api/sensor` — CRUD pre senzorové dáta (POST, GET latest, GET history)
- `/api/harvests` — správa zberov medu (CRUD, štatistiky podľa rokov)
- `/api/inspection` — inšpekcie úľov (checklist, história)
- `/api/users` — správa používateľov, profilov, úľov
- `/api/friends` — priateľstvá, žiadosti
- `/api/groups` — skupiny včelárov, členstvo
- `/api/conversations` — súkromné správy
- `/api/social-notifications` — notifikácie
- `/api/auth` — OAuth prihlásenie/odhlásenie
- `/api/lorawan/webhook` — TTN webhook integrácia

#### 3.2.2 Autentifikácia a bezpečnosť
- OAuth 2.0 flow (Google, GitHub)
- NextAuth.js + MongoDB adapter
- JWT session tokens v httpOnly cookies
- API key autentifikácia pre zariadenia
- Rate limiting ochrany
- Input validácia a sanitizácia

#### 3.2.3 Databáza
- MongoDB Atlas — schéma kolekcií
- Indexy pre optimalizáciu dotazov (timestamp, hiveId)
- Serverless connection pooling

### 3.3 Klientská aplikácia (PWA)

#### 3.3.1 Dashboard
- Real-time zobrazenie: teplota, vlhkosť, hmotnosť, batéria
- 24h sparkline grafy (Recharts)
- Auto-refresh každých 30 sekúnd
- Manuálny vstup dát (pre hive s type='manual')
- Animácie zmien hodnôt

#### 3.3.2 História a grafy
- Interaktívne grafy (6h, 24h, 7d, 30d, 90d, 180d, 365d)
- LineChart s Recharts knižnicou
- Export/filtrovanie dát

#### 3.3.3 Správa úľov (MyHives)
- Pridávanie, editácia, mazanie úľov
- Nastavenie: meno, lokácia, GPS súradnice, farba, obrázok
- Typ zariadenia: manual / API (s generovaním API kľúča)
- DevEUI pre LoRaWAN integráciu
- Viditeľnosť: private / public

#### 3.3.4 Mapa úľov (HiveMap)
- Leaflet + React-Leaflet integrácia
- Zobrazenie všetkých úľov na interaktívnej mape
- Výpočet vzdialeností (Haversinov vzorec)
- Popup s detailami úľa

#### 3.3.5 Zber medu (Harvests)
- Záznamy zberov: množstvo, typ medu, kvalita, vlhkosť, počet rámov
- Ročné štatistiky a porovnanie
- 9 typov medu (kvetový, agátový, lipový, lesný, ...)
- CRUD operácie

#### 3.3.6 Inšpekcie (Inspection)
- Štruktúrovaný checklist: peľ, zaviečkovaný plod, otvorený plod, vajíčka, matka...
- Poznámky
- História inšpekcií
- Offline podpora cez useOfflineQueue

#### 3.3.7 Sociálne funkcie
- **Priateľstvá**: vyhľadávanie, žiadosti, zoznam priateľov
- **Skupiny**: vytváranie, kategórie (10 kategórií), členstvo, skupinový chat
- **Správy**: súkromné konverzácie medzi priateľmi
- **Profily**: meno, bio, lokalita, avatár (Cloudinary upload + kompresia)
- **Používateľské vyhľadávanie**

#### 3.3.8 Notifikácie a upozornenia
- Push notifikácie cez Web Notifications API + Service Worker
- Konfigurovateľné prahy: teplota, vlhkosť, hmotnosť, batéria
- Pripomienka liečby Varroa destructor (VarroaReminder)
- Sociálne notifikácie (správy, žiadosti o priateľstvo, skupinové pozvánky)

#### 3.3.9 PWA funkcie
- Service Worker: caching stratégia, offline fallback
- Web App Manifest: inštalovateľnosť, standalone režim
- IndexedDB caching: senzorové dáta, inšpekcie
- Offline queue: odložené odoslanie pri výpadku siete
- Offline banner v UI

#### 3.3.10 Nastavenia a konfigurácia
- Notifikačné prahy (min/max teplota, vlhkosť)
- LoRaWAN konfigurácia (DevEUI, AppEUI, AppKey)
- Generovanie Arduino kódu pre zariadenie

#### 3.3.11 Administrácia
- Admin panel pre správu systému

### 3.4 Nasadenie (Deployment)
- Vercel: automatický deploy z Git
- MongoDB Atlas: cloudová databáza
- Cloudinary: ukladanie obrázkov
- Docker Compose pre lokálny vývoj

---

## 4. TESTOVANIE (Testing)

### 4.1 Unit testy
- Backend: Jest (auth, CORS, validation, rate limiting, LoRaWAN)
- Frontend: Vitest + React Testing Library (komponenty)

### 4.2 End-to-end testy
- Playwright: login, dashboard, CRUD operácie, navigácia, používateľské toky
- Edge cases, vizuálne testy, real-time testy

### 4.3 Integračné testy
- API integračné testy (supertest)

### 4.4 Testovanie hardvéru
- Iteratívne testovanie: 12 testovacích skečov (v2_01 až v2_09 + diagnostické)
- Kalibračné experimenty: lineárna regresia, R², hysterézia, creep
- Meranie spotreby energie
- Dosah LoRa v reálnych podmienkach

### 4.5 Testovanie v reálnych podmienkach
- Nasadenie systému na skutočnom úli
- Spoľahlivosť prenosu dát
- Výdrž batérie
- Presnosť meraní v porovnaní s referenčnými prístrojmi

---

## 5. VYHODNOTENIE (Evaluation)

### 5.1 Funkčnosť systému
- Splnenie stanovených požiadaviek (teplota, vlhkosť, hmotnosť, vizualizácia)
- Spoľahlivosť zberu a prenosu dát
- Presnosť meraní

### 5.2 Energetická efektivita
- Nameraná spotreba v rôznych režimoch (sleep, aktívny, TX)
- Odhad výdrže batérie
- Efektívnosť solárneho dopĺňania

### 5.3 Používateľská skúsenosť
- Responzívnosť aplikácie (mobilné zariadenia)
- Offline funkčnosť
- Intuitívnosť rozhrania

### 5.4 Porovnanie s existujúcimi riešeniami
- Tabuľka: náš systém vs. BroodMinder vs. Arnia vs. BEEP
- Výhody: cena, otvorenosť, sociálne funkcie, PWA
- Limitácie a obmedzenia

### 5.5 Známe limitácie a návrhy na zlepšenie
- Chýbajúce šifrovanie LoRa (WDT konflikt s Crypto knižnicou)
- Možnosť pridania akustického senzora (zvuková analýza včiel)
- Možnosť LoRaWAN cez TTN (namiesto point-to-point)
- Možnosť AI predikcie (strojové učenie na historických dátach)

---

## ZÁVER (Conclusion)
- Zhrnutie dosiahnutých výsledkov
- Prínos práce pre včelársku komunitu
- Budúce rozšírenia

---

## ZOZNAM POUŽITEJ LITERATÚRY (References)

### Včelárstvo a monitoring včiel

[1] Zacepins, A., Brusbardis, V., Meitalovs, J., & Stalidzans, E. (2015). 
    "Challenges in the development of Precision Beekeeping." 
    *Biosystems Engineering*, 130, 60–71.
    DOI: 10.1016/j.biosystemseng.2014.12.001
    — Prehľad precision beekeeping, senzory, komunikácia

[2] Meitalovs, J., Rivza, A., & Rivza, P. (2009). 
    "Automatic microclimate controlled beehive monitoring system." 
    *Proceedings of the 8th International Scientific Conference Engineering for Rural Development*, 28, 265–271.
    — Raný systém automatického monitorovania úľov

[3] Gil-Lebrero, S., Quiles-Latorre, F. J., Ortiz-López, M., Sánchez-Ruiz, V., 
    Gámiz-López, V., & Luna-Rodríguez, J. J. (2017). 
    "Honey Bee Colony Viability Monitoring System Based on Internet of Things." 
    *Sensors*, 17(1), 55.
    DOI: 10.3390/s17010055
    — IoT monitorovanie životaschopnosti včelích kolónií

[4] Edwards-Murphy, F., Magno, M., Whelan, P. M., O'Halloran, J., & Popovici, E. M. (2016). 
    "b+WSN: Smart beehive with preliminary decision tree analysis for agriculture and honey bee health monitoring." 
    *Computers and Electronics in Agriculture*, 124, 211–219.
    DOI: 10.1016/j.compag.2016.04.008
    — Smart beehive s rozhodovacími stromami

[5] Ochoa, I., Gutierrez, S., & Tabares, M. S. (2022). 
    "Internet of Things: A Survey on Beehive Monitoring Systems." 
    *Applied Sciences*, 12(18), 9035.
    DOI: 10.3390/app12189035
    — Komprehenzívny survey IoT systémov pre monitoring včiel

[6] Terenzi, A., Cecchi, S., Lupi, D., Taponecco, F., & Spinsante, S. (2020). 
    "On the Importance of the Sound Emitted by Honey Bee Hives." 
    *Veterinary Sciences*, 7(4), 168.
    DOI: 10.3390/vetsci7040168
    — Zvuková analýza úľov ako doplnkový parameter

### Colony Collapse Disorder a zdravie včiel

[7] vanEngelsdorp, D., Evans, J. D., Saegerman, C., Mullin, C., Haubruge, E., 
    Nguyen, B. K., ... & Pettis, J. S. (2009). 
    "Colony Collapse Disorder: A Descriptive Study." 
    *PLOS ONE*, 4(8), e6481.
    DOI: 10.1371/journal.pone.0006481
    — Základný popis CCD

[8] Potts, S. G., Biesmeijer, J. C., Kremen, C., Neumann, P., Schweiger, O., 
    & Kunin, W. E. (2010). 
    "Global pollinator declines: trends, impacts and drivers." 
    *Trends in Ecology & Evolution*, 25(6), 345–353.
    DOI: 10.1016/j.tree.2010.01.007
    — Globálny úpadok opeľovačov

### IoT architektúra a komunikácia

[9] Augustin, A., Yi, J., Clausen, T., & Townsley, W. M. (2016). 
    "A Study of LoRa: Long Range & Low Power Networks for the Internet of Things." 
    *Sensors*, 16(9), 1466.
    DOI: 10.3390/s16091466
    — Štúdia LoRa technológie pre IoT

[10] Mekki, K., Bajic, E., Chaxel, F., & Meyer, F. (2019). 
     "A comparative study of LPWAN technologies for large-scale IoT deployment." 
     *ICT Express*, 5(1), 1–7.
     DOI: 10.1016/j.icte.2017.12.005
     — Porovnanie LPWAN: LoRa, Sigfox, NB-IoT

[11] Sinha, R. S., Wei, Y., & Hwang, S. H. (2017). 
     "A survey on LPWA technology: LoRa and NB-IoT." 
     *ICT Express*, 3(1), 14–21.
     DOI: 10.1016/j.icte.2017.03.004
     — Survey LPWA technológií

[12] Semtech Corporation. (2015). 
     "LoRa Modulation Basics." 
     *Application Note AN1200.22*, Semtech.
     — Technická dokumentácia LoRa modulácie

### Senzory a meranie

[13] Sensirion AG. (2020). 
     "SHT4x – Digital Humidity and Temperature Sensor." 
     *Datasheet*, Version 1.1.
     URL: https://sensirion.com/products/catalog/SHT40
     — Datasheet SHT40 senzora

[14] AVIA Semiconductor. (2018). 
     "HX711 – 24-Bit Analog-to-Digital Converter for Weigh Scales." 
     *Datasheet*.
     — Datasheet HX711 ADC pre váhové snímače

[15] HBM (Hottinger Baldwin Messtechnik). (2021). 
     "An Introduction to Measurements using Strain Gauges." 
     Technical publication.
     — Princípy tenzometrie a Wheatstoneovho mostíka

### Mikrokontroléry a embedded systémy

[16] Microchip Technology. (2020). 
     "ATmega328P – 8-bit AVR Microcontroller Datasheet." 
     *Datasheet DS40002061B*.
     — Datasheet MCU Arduino Pro Mini

[17] Espressif Systems. (2021). 
     "ESP32-C3 Series Datasheet." 
     *Version 0.9*.
     URL: https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf
     — Datasheet ESP32-C3 (gateway)

[18] Hope Microelectronics. (2019). 
     "RFM95W/96W/98W – Low Power Long Range LoRa Transceiver Module." 
     *Datasheet*.
     — Datasheet RFM95W LoRa modulu

### Webové technológie a PWA

[19] Tandel, S. S., & Jamadar, A. (2018). 
     "Impact of Progressive Web Apps on Web App Development." 
     *International Journal of Innovative Research in Science, Engineering and Technology*, 7(9), 9439–9444.
     DOI: 10.15680/IJIRSET.2018.0709021
     — Dopad PWA na vývoj webových aplikácií

[20] Biørn-Hansen, A., Majchrzak, T. A., & Grønli, T. M. (2017). 
     "Progressive Web Apps: The Possible Web-native Unifier for Mobile Development." 
     *Proceedings of the 13th International Conference on Web Information Systems and Technologies (WEBIST)*, 344–351.
     DOI: 10.5220/0006353703440351
     — PWA ako možný unifikátor mobilného vývoja

[21] Malavolta, I., Spinellis, D., & Cataldo, P. (2020). 
     "Beyond Web Apps: A Study of Progressive Web Apps." 
     *IEEE Access*, 8, 228657–228672.
     — Štúdia PWA vs. natívne aplikácie

[22] Banks, A., & Porcello, E. (2020). 
     *Learning React: Modern Patterns for Developing React Apps* (2nd ed.). 
     O'Reilly Media.
     — Referencia pre React vývoj

### Cloudové a serverless technológie

[23] Sbarski, P. (2017). 
     *Serverless Architectures on AWS*. 
     Manning Publications.
     — Serverless architektúry

[24] MongoDB, Inc. (2024). 
     "MongoDB Atlas Documentation." 
     URL: https://www.mongodb.com/docs/atlas/
     — Dokumentácia MongoDB Atlas

[25] Vercel, Inc. (2024). 
     "Vercel Documentation – Serverless Functions." 
     URL: https://vercel.com/docs/functions
     — Dokumentácia Vercel serverless funkcií

### Energetická efektivita a batériové systémy

[26] Gomez, C., Oller, J., & Paradells, J. (2012). 
     "Overview and Evaluation of Bluetooth Low Energy: An Emerging Low-Power Wireless Technology." 
     *Sensors*, 12(9), 11734–11753.
     DOI: 10.3390/s120911734
     — Porovnanie nízkoenergetických bezdrôtových technológií

[27] Betzin, C., Wolfenstetter, T., & Zimmermann, J. (2019). 
     "Requirements for Battery-Powered IoT Devices in Smart Agriculture." 
     *Proceedings of the IEEE 5th World Forum on Internet of Things (WF-IoT)*, 889–894.
     DOI: 10.1109/WF-IoT.2019.8767296
     — Požiadavky na batériovo napájané IoT zariadenia v smart agriculture

[28] Georgiou, O., & Raza, U. (2017). 
     "Low Power Wide Area Network Analysis: Can LoRa Scale?" 
     *IEEE Wireless Communications Letters*, 6(2), 162–165.
     DOI: 10.1109/LWC.2016.2647247
     — Škálovateľnosť LoRa sietí

### Bezpečnosť IoT

[29] Ngu, H. H., Gutierrez, M., Metber, V., Shrestha, S., & Ali, Z. (2017). 
     "IoT Middleware: A Survey on Issues and Enabling Technologies." 
     *IEEE Internet of Things Journal*, 4(1), 1–20.
     DOI: 10.1109/JIOT.2016.2615180
     — Bezpečnostné problémy IoT middleware

[30] Butun, I., Österberg, P., & Song, H. (2020). 
     "Security of the Internet of Things: Vulnerabilities, Attacks, and Countermeasures." 
     *IEEE Communications Surveys & Tutorials*, 22(1), 616–644.
     DOI: 10.1109/COMST.2019.2953364
     — Bezpečnosť IoT zariadení

### OAuth a autentifikácia

[31] Hardt, D. (2012). 
     "The OAuth 2.0 Authorization Framework." 
     *RFC 6749*, Internet Engineering Task Force (IETF).
     URL: https://tools.ietf.org/html/rfc6749
     — Špecifikácia OAuth 2.0

### Testovanie softvéru

[32] Meszaros, G. (2007). 
     *xUnit Test Patterns: Refactoring Test Code*. 
     Addison-Wesley.
     — Vzory testovania softvéru

---

## PRÍLOHY (Appendices)

### Príloha A: Schéma zapojenia senzorového uzla
### Príloha B: Schéma zapojenia gateway
### Príloha C: Kompletný zdrojový kód firmvéru (USB/GitHub link)
### Príloha D: Screenshoty webovej aplikácie
### Príloha E: Výsledky kalibrácie a diagnostiky (grafy, tabuľky)
### Príloha F: REST API dokumentácia
### Príloha G: Inštalačná a používateľská príručka
### Príloha H: Merania spotreby energie

---

## POZNÁMKY K ŠTRUKTÚRE

### Odporúčaný rozsah (podľa typu práce):
- **Bakalárska práca**: ~40-60 strán (bez príloh) — zamerať sa na kapitoly 1-3, skrátiť 4-5
- **Diplomová práca**: ~60-80 strán (bez príloh) — pokryť všetko vo väčšom detaile

### Silné stránky projektu na zdôraznenie:
1. **End-to-end riešenie** — od senzora po používateľské rozhranie
2. **PWA** — nie natívna appka, ale plne funkčná offline webová aplikácia
3. **Sociálne funkcie** — unikátne oproti existujúcim riešeniam (priateľstvá, skupiny, chat)
4. **Iteratívny HW vývoj** — 12 testovacích verzií firmvéru, systematické ladenie
5. **Ultra-low power** — MOSFET gating, WDT sleep, hardvérové modifikácie
6. **LoRa komunikácia** — vhodná pre vidiecke prostredie bez WiFi
7. **Serverless architektúra** — škálovateľná, bezúdržbová
8. **Open-source** — kompletný zdrojový kód
