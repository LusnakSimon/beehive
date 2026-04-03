# Beehive Node v2.0 - Pro Mini + LiFePO4 + Solar

## Hardware

| Component | Description |
|-----------|-------------|
| MCU | Arduino Pro Mini 3.3V/8MHz |
| Battery | LiFePO4 3.2V (range 2.5V–3.65V) |
| Charger | TP5000 solar MPPT |
| Temp/Hum | SHT40 (I²C 0x44) |
| Load Cell | HX711 + 4× 50kg three-wire cells |
| Radio | RFM95 LoRa 868MHz |
| Power Switch | A1SHB P-channel MOSFET (high-side) |
| Voltage Sense | 54k/20k resistor divider |

## Pin Assignments - Pro Mini 3.3V/8MHz

```
Pin     Function        Notes
────────────────────────────────────────────────
D2      RFM95 DIO0      INT0 (hardware interrupt)
D4      MOSFET Gate     P-FET: LOW=ON, HIGH=OFF
D5      HX711 DT        Data out
D6      HX711 SCK       Clock
D9      RFM95 RST       Reset
D10     RFM95 CS        NSS / SS
D11     RFM95 MOSI      Hardware SPI
D12     RFM95 MISO      Hardware SPI
D13     RFM95 SCK       Hardware SPI
A0      Battery ADC     54k/20k divider
A4      I2C SDA         SHT40
A5      I2C SCL         SHT40
────────────────────────────────────────────────
Free: D3(INT1), D7, D8, A1–A3, A6, A7
```

## Power Architecture

```
                      LiFePO4 (3.2V nom)
                             │
        ┌────────────────────┼──────────────────────┐
        │                    │                      │
   TP5000 Solar         Pro Mini VCC            A1SHB MOSFET
   Charger IN        (regulator bypassed)     (high-side switch)
                         │     │
                        [54k]   │
                         │     │
                    A0 ──┤     │
                         │     │
                        [20k]  │
                         │     │
                        GND   GND

   MOSFET DRAIN ──→ Sensor VCC rail ──→ SHT40, HX711
   RFM95 ──→ powered directly from VBAT (built-in sleep ~1µA)
   I2C pullups: 10kΩ from SDA/SCL to MOSFET drain
```

### Battery Voltage Sensing

**IMPORTANT: A0 connects to the MIDPOINT between the two resistors, NOT to GND.**

```
   VBAT ──────[54k]──────┬──────[20k]────── GND
                         │
                         └── A0 (Pro Mini analog pin)

   Schematic:

   VBAT ─────┐
             [54k]
              │
              ├───── A0 (midpoint, ~0.87V @ 3.2V battery)
              │
             [20k]
              │
             GND
```

- Vout = VBAT × R2/(R1+R2) = VBAT × 20/(54+20) = VBAT × 0.2703
- Ratio = (R1+R2)/R2 = (54+20)/20 = 3.7
- Using `analogReference(INTERNAL)` (1.1V on ATmega328P):
  - At 3.65V (full):  0.986V on A0 ✓ (within 1.1V)
  - At 3.20V (nom):   0.865V on A0 ✓
  - At 2.80V (empty): 0.757V on A0 ✓
  - Resolution: 1.1V/1024 × 3.7 ≈ 3.97mV per step
- Total divider current: 3.2V / 74kΩ = **43µA** (constant drain, acceptable)

### A1SHB P-Channel MOSFET Wiring (SOT-23)

**⚠ VERIFY YOUR PINOUT — SOT-23 pinout varies by manufacturer!**

Most common A1SHB / SI2301 SOT-23 pinout (viewed from top, marking side up):
```
         ┌──────────┐
  Pin 1 ─┤  A1SHB   ├─ Pin 3
         │          │
  Pin 2 ─┤          │
         └──────────┘

  Pin 1 = GATE
  Pin 2 = SOURCE
  Pin 3 = DRAIN
```

**⚠ Some A1SHB variants swap Gate/Source! Check YOUR specific part's datasheet.**

To verify: use a multimeter in diode mode:
- Body diode: Source → Drain (should read ~0.4-0.7V forward)
- Drain → Source (should read OL/open)
- Gate to either: should read OL/open both directions

Circuit wiring:
```
   VBAT ──┬───────── Source (pin 2 on most A1SHB)
          │
         [10k]       (pullup: keeps MOSFET OFF during MCU boot)
          │
          ├───────── Gate (pin 1 on most A1SHB) ◄── D4 (MCU)

                     Drain (pin 3) ──→ Sensor VCC rail
```

- `digitalWrite(D4, LOW)`  → Vgs = 0 - 3.2V = **-3.2V** → MOSFET **ON** → Sensors powered
- `digitalWrite(D4, HIGH)` → Vgs = 3.2V - 3.2V = **0V** → MOSFET **OFF** → Sensors off
- 10k pullup: Gate → VBAT, ensures MOSFET stays OFF when MCU pin is floating (boot/reset)

### Troubleshooting: Battery Terminal Gets Hot

If your battery terminal gets hot and the Pro Mini doesn't turn on, you have a **hard short
circuit** somewhere. The voltage divider (74kΩ) draws only 43µA and absolutely cannot cause
this. The short is in the power wiring.

**Debug steps (disconnect battery first!):**

1. **Disconnect everything** from the Pro Mini — remove all wires
2. **Multimeter continuity test**: probe between the VBAT wire and GND wire
   - Should read **OL (open)** — if it beeps, you have a short
3. Reconnect **only the Pro Mini** (VBAT → VCC, GND → GND)
   - Measure current: should be ~5-15mA (or ~5mA in idle)
   - If battery gets hot again → Pro Mini is damaged or wired wrong
4. Add **only the voltage divider** (54k → A0 → 20k → GND)
   - Should add only ~43µA (unmeasurable difference)
5. Add **only the MOSFET** circuit (with nothing on drain)
   - Should add negligible current (leakage only)
6. Connect sensors one at a time to the MOSFET drain

**Common wiring mistakes that cause shorts:**
- VBAT wire touching GND rail on breadboard
- Solder bridge between VCC and GND on Pro Mini headers
- Wrong Pro Mini pin (e.g., connecting to RAW through damaged regulator)
- Breadboard internal short (old/worn breadboards can have bent clips)

## Test Progression

Each test is a standalone Arduino sketch in its own folder.
Upload one at a time, verify, then move to the next.

| # | Sketch | What to test | Prerequisites |
|---|--------|-------------|---------------|
| 1 | `v2_01_mosfet_test` | MOSFET on/off toggling | MCU + MOSFET only |
| 2 | `v2_02_battery_test` | Battery voltage reading | MCU + voltage divider |
| 3 | `v2_03_aht10_test` | ~~AHT10 test~~ (removed) | — |
| 4 | `v2_04_sht40_test` | SHT40 via MOSFET power | + SHT40 connected |
| 5 | `v2_05_hx711_test` | HX711 via MOSFET power | + HX711 connected |
| 6 | `v2_06_lora_test` | RFM95 init + TX | + RFM95 connected |
| 7 | `v2_07_calibration` | HX711 weight calibration | All sensors connected |
| 8 | `v2_08_full_tx_test` | All sensors → JSON → LoRa | All hardware connected |
| 9 | `v2_09_final_node` | Full node + sleep + power opt | Production firmware |

## Hardware Mods for Low Power (Step 9)

These mods reduce Pro Mini sleep current from ~5mA to ~5µA:

1. **Remove power LED** – Desolder or cut the trace to the onboard LED
2. **Remove voltage regulator** – Desolder the MIC5205 (since VBAT goes direct to VCC)
3. **Optional: remove pin 13 LED** – If you need D13 for SPI SCK without LED load

After mods, expected sleep current: **~4–6µA** (MCU only, sensors off via MOSFET)

## Libraries Required

Install via Arduino Library Manager:

- `Adafruit SHT4x` (SHT40 temp/humidity)
- `HX711` by Bogdan Necula / Rob Tillaart
- `RadioHead` by Mike McCauley (RH_RF95)

## LiFePO4 Battery Percentage

LiFePO4 has a very flat discharge curve (~3.2V for 80% of capacity).
Simple linear mapping is inaccurate. The firmware uses a lookup table:

| Voltage | % (approx) |
|---------|-------------|
| 3.40V+  | 100% |
| 3.35V   | 90% |
| 3.33V   | 80% |
| 3.30V   | 60% |
| 3.25V   | 40% |
| 3.20V   | 20% |
| 3.10V   | 10% |
| 2.80V   | 0% (cutoff) |
