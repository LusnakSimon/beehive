# eBeeHive Codebase Cleanup — FINAL PROMPT

You are working on a bachelor's thesis beehive monitoring PWA at the root of this repo. The system uses **point-to-point LoRa** (NOT LoRaWAN): an Arduino Pro Mini sensor node transmits JSON via RFM95W to a custom ESP32-C3 gateway, which POSTs to the Vercel API over WiFi. There is NO TTN, NO LoRaWAN protocol, NO LoRaWAN gateway involved.

The goal: strip the app to its honest, working core, fix what's broken, remove what's fake. Work through each section in order. After each section, verify nothing is broken (no dangling imports, no broken routes, no missing references).

**Pages that should remain after cleanup:** Dashboard, History, MyHives, HiveMap, Harvests, Inspection, Settings, Profile, Login
**Pages/features to remove:** All social features, Admin, LoRaWAN, manual data entry, analysis/estimates in History

---

## SECTION 1: REMOVE SOCIAL FEATURES

Delete ALL social/community features entirely.

### Files to DELETE:
**Pages (delete both .jsx and .css for each):**
- `client/src/pages/Friends.jsx` + `.css`
- `client/src/pages/FriendRequests.jsx` + `.css`
- `client/src/pages/Groups.jsx` + `.css`
- `client/src/pages/GroupDetail.jsx` + `.css`
- `client/src/pages/GroupChat.jsx` + `.css`
- `client/src/pages/CreateGroup.jsx` + `.css`
- `client/src/pages/Messages.jsx` + `.css`
- `client/src/pages/Chat.jsx` + `.css`
- `client/src/pages/UserSearch.jsx` + `.css`
- `client/src/pages/Notifications.jsx` + `.css`

**Components:**
- `client/src/components/ChatLayout.css`
- `client/src/components/EditGroupModal.jsx` + `.css`
- `client/src/components/InviteModal.jsx` + `.css`
- `client/src/components/SocialNotificationSettings.jsx` + `.css`

**API routes:**
- `api/conversations/[...path].js`
- `api/friends/[...path].js`
- `api/groups/[...path].js`
- `api/social-notifications/[...path].js`

**Backend routes:**
- `lib/routes/conversations.js`
- `lib/routes/friends.js`
- `lib/routes/groups.js`
- `lib/routes/social-notifications.js`

**Models:**
- `lib/models/Conversation.js`
- `lib/models/FriendRequest.js`
- `lib/models/Friendship.js`
- `lib/models/Group.js`
- `lib/models/GroupMessage.js`
- `lib/models/Message.js`
- `lib/models/Notification.js`

### Files to EDIT:
- **`client/src/App.jsx`** — Remove all Route entries and lazy imports for deleted pages
- **`client/src/components/Navigation.jsx`** — Remove nav links for: Friends, Groups, Messages, UserSearch, Notifications. Keep links for: Dashboard, History, MyHives, HiveMap, Harvests, Inspection, Settings, Profile
- **`client/src/pages/Settings.jsx`** — Remove `import SocialNotificationSettings` and any rendered social notification section
- **`client/src/pages/Profile.jsx`** — Remove friends count, groups list, or any social sections. Keep basic profile info (name, bio, location, avatar)
- **`client/src/pages/ProfileEdit.jsx`** — Remove any social-related fields if present

---

## SECTION 2: REMOVE ADMIN PAGE

### Files to DELETE:
- `client/src/pages/Admin.jsx` + `Admin.css`
- `lib/routes/admin.js`

### Files to EDIT:
- **`client/src/App.jsx`** — Remove Admin route and lazy import
- **`client/src/components/Navigation.jsx`** — Remove Admin nav link

---

## SECTION 3: REMOVE LoRaWAN-SPECIFIC CODE

The system uses point-to-point LoRa with a custom gateway, NOT LoRaWAN.

### Files to DELETE:
- `api/lorawan/webhook.js` (and the `api/lorawan/` directory)
- `client/src/components/LoRaWANSetupGuide.jsx` + `.css`
- `docs/LORAWAN_SETUP.md`
- `docs/LORAWAN_ARCHITECTURE.md`
- `scripts/lorawan-serial-bridge.js`
- `scripts/test-lorawan-e2e.js`
- `tests/__tests__/lorawan.test.js`

### Files to EDIT:
- **`client/src/pages/Settings.jsx`**:
  - Remove all `lorawanConfig` state, functions, and UI (`devEUI`, `appEUI`, `appKey` fields)
  - Remove `import LoRaWANSetupGuide` and its render
  - Remove `showLoRaWANGuide` state
  - Remove `copyLorawanConfig()` and `isLorawanConfigComplete()` functions
  - Remove lorawan localStorage reads/writes from `saveSettings()` and `useEffect`

- **`client/src/pages/MyHives.jsx`**:
  - Remove the `devEUI` field from the hive form entirely
  - Remove `devEUI` from form state initial values, validation, and API submission
  - Remove the "Pre LoRaWAN webhook" hint text and DevEUI input element
  - Keep the device type selector (manual/API) and API key generation — the API key IS used by the real gateway

- **`lib/models/User.js`** — Remove `devEUI` from ownedHives schema if present
- **`lib/models/Reading.js`** — Remove `'LoRaWAN'` from the source enum. Keep: `'WiFi'`, `'API'`, `'Simulator'`
- **`lib/utils/validation.js`** — Remove any LoRaWAN-specific validation
- **`lib/utils/cors.js`** — Remove any LoRaWAN-specific CORS config

- **`arduino/beehive_gateway/beehive_gateway.ino`**:
  - Remove dead encryption code: `AES128 aesCipher;` and `RHEncryptedDriver encDriver(rf95, aesCipher);`
  - Remove any `#include` for encryption/crypto libraries
  - The gateway should only use `rf95` directly

---

## SECTION 4: REMOVE MANUAL DATA ENTRY

Data should only come from the hardware (gateway POSTing to API). Remove the ability for users to manually enter sensor readings through the UI.

### In `client/src/pages/Dashboard.jsx`:
- Find and remove the manual data entry form/modal (likely triggered when hive device type is 'manual')
- Remove any "Pridať manuálne dáta" or similar button
- Remove any manual entry state, handlers, and API calls for manual sensor submission

### In `client/src/pages/MyHives.jsx`:
- Remove the device type selector entirely — all hives use API type
- Or: change it so the default/only option is 'API' (device with API key)
- Remove 'manual' as a device type option

### In `lib/routes/sensor.js`:
- Keep the POST endpoint but it should only accept requests with a valid device API key (or legacy API key)
- Remove the code path that allows authenticated users to POST sensor data directly (the "manual entry" path)
- The source field should only be 'API' for device submissions

---

## SECTION 5: REMOVE ANALYSIS/ESTIMATES FROM HISTORY

### In `client/src/pages/History.jsx`:
- DELETE the `estimateBeePopulation()` function entirely
- DELETE the `getSeasonalInsight()` function entirely
- REMOVE `beeEstimate` and `seasonal` from the `analysis` useMemo
- REMOVE the `insights` array generation (the interpretive text like "aktívny znáškový tok", "nízka teplota - včely môžu byť v klube", etc.)
- REMOVE all UI sections that display: bee estimate, seasonal card, insights list
- KEEP: the `detectAnomalies()` function (Z-score based — this is legitimate statistics)
- KEEP: the `calculateTrend()` function (simple trend analysis — legitimate)
- KEEP: the trend arrows and anomaly cards in the UI
- KEEP: the charts, time range selector, chart type selector, CSV export
- KEEP: the stats display (min/max/avg)

### In `client/src/pages/History.css`:
- Remove `.seasonal-card`, `.seasonal-icon`, `.seasonal-content` and related styles
- Remove any bee-estimate related styles

---

## SECTION 6: FIX INSPECTION PAGE

### In `client/src/pages/Inspection.jsx`:
- REMOVE the `getStatusColor()` function that colors inspections green/yellow/red based on checkbox count (thresholds of 5/3 are arbitrary and not scientifically based)
- REMOVE color-coded status indicators from inspection history cards
- KEEP the inspection form with all checklist items (Pollen, Capped cells, Opened cells, Eggs, Queen seen, Queenbee cell opened, Queenbee cell capped, Inspection needed)
- KEEP the notes field
- KEEP the inspection history list
- KEEP offline support via useOfflineQueue

### In `lib/routes/inspection.js`:
- Remove any `'HIVE-001'` hardcoded fallback — require hiveId parameter

---

## SECTION 7: FIX NOTIFICATION SYSTEM

This is required by the thesis zadanie: "upozornenia pri detekcii anomálií alebo výrazných zmien."

### In `client/src/contexts/NotificationContext.jsx`:

The `checkConditions()` function currently only checks temperature and humidity. Add battery, weight change, and device offline checks.

Add these checks AFTER the existing temperature/humidity checks inside `checkConditions()`:

```javascript
// Battery alert
if (settings.battery && data.battery !== undefined && data.battery !== null && data.battery < 20) {
  alerts.push({
    title: '🔋 Nízka batéria!',
    body: `Batéria úľa ${hiveId}: ${data.battery}%`,
    tag: `battery-low-${hiveId}`
  });
}

// Weight change alert — compare with stored previous reading
const prevKey = `prev-reading-${hiveId}`;
const prevStr = localStorage.getItem(prevKey);
const prev = prevStr ? JSON.parse(prevStr) : null;

if (settings.weight && prev && data.weight != null && prev.weight != null && data.lastUpdate && prev.lastUpdate) {
  const timeDiffHours = (new Date(data.lastUpdate) - new Date(prev.lastUpdate)) / (1000 * 60 * 60);
  if (timeDiffHours > 0 && timeDiffHours <= 4) {
    const weightChange = Math.abs(data.weight - prev.weight);
    const weightChangePerHour = weightChange / timeDiffHours;
    if (weightChangePerHour > 2) {
      const direction = data.weight > prev.weight ? 'nárast' : 'pokles';
      alerts.push({
        title: '⚖️ Výrazná zmena hmotnosti!',
        body: `Úľ ${hiveId}: ${direction} o ${weightChange.toFixed(1)} kg`,
        tag: `weight-change-${hiveId}`
      });
    }
  }
}

// Device offline alert
if (settings.offline && data.lastUpdate) {
  const hoursSince = (Date.now() - new Date(data.lastUpdate).getTime()) / (1000 * 60 * 60);
  if (hoursSince > 1) {
    alerts.push({
      title: '📡 Zariadenie neodpovedá!',
      body: `Úľ ${hiveId}: posledné dáta pred ${Math.floor(hoursSince)}h`,
      tag: `offline-${hiveId}`
    });
  }
}

// Always store current reading for next comparison
localStorage.setItem(prevKey, JSON.stringify({
  weight: data.weight,
  lastUpdate: data.lastUpdate
}));
```

Also add the threshold settings `tempMin`, `tempMax`, `humidityMin`, `humidityMax` to the settings state initialization if they're not already there — the `checkConditions` function references `settings.tempMin` etc. but those come from the Settings page localStorage. Make sure NotificationContext reads from the same localStorage key as Settings.jsx writes to.

---

## SECTION 8: FIX SETTINGS PAGE

### In `client/src/pages/Settings.jsx`:
- Fix humidity defaults: change `humidityMin: 50` → `humidityMin: 40` and `humidityMax: 60` → `humidityMax: 70` to match Dashboard's optimal range display
- Remove all LoRaWAN sections (covered in Section 3)
- Remove SocialNotificationSettings import and section (covered in Section 1)
- The settings page should have these sections only:
  1. Notification settings (temperature, humidity, battery, weight, offline toggles + threshold sliders for temp and humidity)
  2. Refresh interval setting
  3. Save button

---

## SECTION 9: FIX REMAINING INCONSISTENCIES

### HIVE-001 hardcoded fallbacks:
- **`lib/routes/sensor.js` line 76**: Change `const hiveId = url.searchParams.get('hiveId') || 'HIVE-001'` to require hiveId:
  ```javascript
  const hiveId = url.searchParams.get('hiveId');
  if (!hiveId && method === 'GET') {
    return res.status(400).json({ error: 'hiveId parameter is required' });
  }
  ```

- **`lib/models/Reading.js`**: Change hiveId from `default: 'HIVE-001'` to `required: true`

- **`lib/routes/inspection.js`**: Same — remove any HIVE-001 fallback, require hiveId

### Dead Service Worker code:
- **`client/public/sw.js`**: Remove the `periodicsync` event listener that references the non-existent `/api/notifications/check` endpoint

### Source enum cleanup:
- **`lib/models/Reading.js`**: Remove `'Manual'` and `'LoRaWAN'` from source enum. Keep: `'WiFi'`, `'API'`, `'Simulator'`

---

## SECTION 10: CLEANUP AND VERIFY

1. Search entire `client/src/` for imports of any deleted files — fix all broken imports
2. Check `App.jsx` — ensure no routes point to deleted pages, no lazy imports for deleted pages
3. Check `Navigation.jsx` — only these links should remain: Dashboard, History, MyHives, HiveMap, Harvests, Inspection, Settings, Profile (and Login which is handled by auth)
4. Run `cd client && npm run build` — fix ALL build errors before moving on
5. Delete `BEEKEEPING_FEATURES_AUDIT.md` from project root (audit artifact, not part of app)
6. Update `README.md`:
   - Remove all mentions of social features (friends, groups, chat, messaging)
   - Change "LoRaWAN" to "LoRa (point-to-point)" wherever it appears
   - Remove admin panel mention
   - Update feature list to reflect actual remaining features
   - Update tech stack table if needed
7. Check `package.json` — remove any dependencies that were only used by deleted features (unlikely but check)

---

## WHAT SHOULD REMAIN AFTER ALL CLEANUP

**Client pages:** Dashboard, History, MyHives, HiveMap, Harvests, Inspection, Settings, Profile, ProfileEdit, Login
**API routes:** `/api/sensor`, `/api/harvests`, `/api/inspection`, `/api/users`, `/api/auth`, `/api/session`
**Key features:**
- Real-time dashboard with temperature, humidity, weight, battery display
- Historical charts with time range selection and CSV export
- Z-score anomaly detection on historical data
- Trend indicators
- Hive management (CRUD with API key generation)
- Interactive map with hive locations
- Harvest tracking
- Inspection checklists
- Threshold-based notifications (temp, humidity, battery, weight change, device offline)
- OAuth authentication (Google, GitHub)
- PWA capabilities (Service Worker caching, installability)
