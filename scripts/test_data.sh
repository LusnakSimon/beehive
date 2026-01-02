#!/bin/bash

# Test script na simuláciu ESP32 dát

API_KEY="beehive-secret-key-2024"
SERVER="http://localhost:5000"

echo "🐝 Beehive Monitor - Test Data Generator"
echo "========================================"
echo ""

# Generovanie náhodných dát
generate_data() {
  TEMP=$(awk -v min=28 -v max=38 'BEGIN{srand(); print min+rand()*(max-min)}')
  HUMIDITY=$(awk -v min=45 -v max=65 'BEGIN{srand(); print min+rand()*(max-min)}')
  WEIGHT=$(awk -v min=45 -v max=55 'BEGIN{srand(); print min+rand()*(max-min)}')
  BATTERY=$(shuf -i 70-100 -n 1)
  
  echo "📊 Odosielam: T=${TEMP}°C, H=${HUMIDITY}%, W=${WEIGHT}kg, B=${BATTERY}%"
  
  curl -X POST "${SERVER}/api/sensor" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d "{
      \"temperature\": ${TEMP},
      \"humidity\": ${HUMIDITY},
      \"weight\": ${WEIGHT},
      \"battery\": ${BATTERY},
      \"hiveId\": \"HIVE-001\"
    }" \
    -s | jq .
  
  echo ""
}

# Generovanie historických dát
echo "Generujem historické dáta..."
for i in {1..20}; do
  generate_data
  sleep 0.5
done

echo "✅ Test dokončený!"
echo ""
echo "Teraz môžete otvoriť http://localhost:3000"
