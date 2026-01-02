import { useState } from 'react'
import './LoRaWANSetupGuide.css'

const TTN_PAYLOAD_FORMATTER = `// TTN Payload Formatter (Uplink)
// Paste this in TTN Console → Applications → Your App → Payload Formatters → Uplink

function decodeUplink(input) {
  var data = {};
  var bytes = input.bytes;
  
  if (bytes.length >= 9) {
    // Temperature: 2 bytes, signed, divide by 10
    data.temperature = ((bytes[0] << 8) | bytes[1]);
    if (data.temperature > 32767) data.temperature -= 65536;
    data.temperature /= 10.0;
    
    // Humidity: 2 bytes, unsigned, divide by 10
    data.humidity = ((bytes[2] << 8) | bytes[3]) / 10.0;
    
    // Weight: 4 bytes, signed, divide by 100
    data.weight = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
    if (data.weight > 2147483647) data.weight -= 4294967296;
    data.weight /= 100.0;
    
    // Battery: 1 byte, 0-100%
    data.battery = bytes[8];
  }
  
  return {
    data: data,
    warnings: [],
    errors: []
  };
}`

const WEBHOOK_URL = 'https://ebeehive.vercel.app/api/lorawan/webhook'

export default function LoRaWANSetupGuide({ devEUI, onClose }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [copied, setCopied] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      // Send a test payload to the webhook
      const response = await fetch('/api/lorawan/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          end_device_ids: {
            dev_eui: devEUI,
            device_id: 'test-device'
          },
          uplink_message: {
            decoded_payload: {
              temperature: 25.0,
              humidity: 50.0,
              weight: 30.0,
              battery: 100
            },
            rx_metadata: [{ rssi: -80, snr: 10 }],
            received_at: new Date().toISOString()
          }
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setTestResult({
          success: true,
          message: `✅ Spojenie funguje! Dáta boli uložené do úľa "${data.hiveName}"`
        })
      } else {
        setTestResult({
          success: false,
          message: `⚠️ ${data.message || 'Zariadenie nebolo nájdené. Skontroluj DevEUI.'}`
        })
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: '❌ Chyba pripojenia. Skontroluj internetové pripojenie.'
      })
    } finally {
      setTesting(false)
    }
  }

  const steps = [
    {
      title: '1. Zaregistruj zariadenie na TTN',
      content: (
        <>
          <ol>
            <li>Choď na <a href="https://console.thethingsnetwork.org" target="_blank" rel="noopener noreferrer">console.thethingsnetwork.org</a></li>
            <li>Vytvor novú aplikáciu (ak ešte nemáš)</li>
            <li>Klikni na "Register end device"</li>
            <li>Vyber "Enter end device specifics manually"</li>
            <li>Nastav:
              <ul>
                <li><strong>Frequency plan:</strong> Europe 863-870 MHz (SF9 for RX2)</li>
                <li><strong>LoRaWAN version:</strong> MAC V1.0.2</li>
                <li><strong>DevEUI:</strong> <code>{devEUI || 'XXXXXXXXXXXXXXXX'}</code></li>
                <li><strong>AppEUI/JoinEUI:</strong> 0000000000000000</li>
                <li><strong>AppKey:</strong> (vygeneruj náhodný)</li>
              </ul>
            </li>
          </ol>
          <div className="copy-box">
            <span>DevEUI:</span>
            <code>{devEUI || 'Najprv zadaj DevEUI'}</code>
            {devEUI && (
              <button onClick={() => copyToClipboard(devEUI, 'devEUI')}>
                {copied === 'devEUI' ? '✓' : '📋'}
              </button>
            )}
          </div>
        </>
      )
    },
    {
      title: '2. Nastav Payload Formatter',
      content: (
        <>
          <p>V TTN konzole choď do:</p>
          <p><strong>Applications → Tvoja App → Payload Formatters → Uplink</strong></p>
          <p>Vyber "Custom JavaScript formatter" a vlož tento kód:</p>
          <div className="code-block">
            <pre>{TTN_PAYLOAD_FORMATTER}</pre>
            <button 
              className="copy-btn"
              onClick={() => copyToClipboard(TTN_PAYLOAD_FORMATTER, 'formatter')}
            >
              {copied === 'formatter' ? '✓ Skopírované!' : '📋 Kopírovať kód'}
            </button>
          </div>
        </>
      )
    },
    {
      title: '3. Pridaj Webhook',
      content: (
        <>
          <p>V TTN konzole choď do:</p>
          <p><strong>Applications → Tvoja App → Integrations → Webhooks</strong></p>
          <ol>
            <li>Klikni "+ Add webhook"</li>
            <li>Vyber "Custom webhook"</li>
            <li>Nastav:
              <ul>
                <li><strong>Webhook ID:</strong> beehive-webhook</li>
                <li><strong>Webhook format:</strong> JSON</li>
                <li><strong>Base URL:</strong></li>
              </ul>
            </li>
          </ol>
          <div className="copy-box large">
            <code>{WEBHOOK_URL}</code>
            <button onClick={() => copyToClipboard(WEBHOOK_URL, 'webhook')}>
              {copied === 'webhook' ? '✓' : '📋'}
            </button>
          </div>
          <ol start="4">
            <li>V sekcii "Enabled messages" zaškrtni <strong>"Uplink message"</strong></li>
            <li>Klikni "Create webhook"</li>
          </ol>
        </>
      )
    },
    {
      title: '4. Nahraj firmvér na ESP32',
      content: (
        <>
          <p>Stiahni a uprav Arduino kód:</p>
          <ol>
            <li>Otvor <code>arduino/beehive_node/beehive_node.ino</code></li>
            <li>Vyplň DevEUI, AppEUI a AppKey z TTN konzoly</li>
            <li>Nahraj na ESP32 cez Arduino IDE</li>
            <li>Otvor Serial Monitor (115200 baud) a skontroluj pripojenie</li>
          </ol>
          <p style={{marginTop: '1rem'}}>Pre gateway zariadenie:</p>
          <ol>
            <li>Otvor <code>arduino/beehive_gateway/beehive_gateway.ino</code></li>
            <li>Nastav WiFi credentials a API endpoint</li>
            <li>Nahraj na ESP32 gateway</li>
          </ol>
          <div className="info-box">
            <p>💡 <strong>Tip:</strong> Pri prvom spustení môže trvať 1-2 minúty kým sa zariadenie pripojí k LoRaWAN sieti (OTAA join).</p>
          </div>
        </>
      )
    },
    {
      title: '5. Otestuj pripojenie',
      content: (
        <>
          <p>Klikni na tlačidlo nižšie pre otestovanie či je všetko správne nastavené:</p>
          
          <button 
            className={`test-btn ${testing ? 'testing' : ''}`}
            onClick={testConnection}
            disabled={testing || !devEUI}
          >
            {testing ? '⏳ Testujem...' : '🧪 Otestovať pripojenie'}
          </button>
          
          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'warning'}`}>
              {testResult.message}
            </div>
          )}
          
          {!devEUI && (
            <div className="test-result warning">
              ⚠️ Najprv zadaj DevEUI pri vytváraní úľa
            </div>
          )}
        </>
      )
    }
  ]

  return (
    <div className="lorawan-guide-overlay" onClick={onClose}>
      <div className="lorawan-guide" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        
        <h2>📡 Nastavenie LoRaWAN</h2>
        
        <div className="steps-nav">
          {steps.map((_, i) => (
            <button
              key={i}
              className={`step-dot ${currentStep === i + 1 ? 'active' : ''} ${currentStep > i + 1 ? 'completed' : ''}`}
              onClick={() => setCurrentStep(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        
        <div className="step-content">
          <h3>{steps[currentStep - 1].title}</h3>
          {steps[currentStep - 1].content}
        </div>
        
        <div className="guide-nav">
          <button 
            className="btn-secondary"
            onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
            disabled={currentStep === 1}
          >
            ← Späť
          </button>
          
          {currentStep < steps.length ? (
            <button 
              className="btn-primary"
              onClick={() => setCurrentStep(s => s + 1)}
            >
              Ďalej →
            </button>
          ) : (
            <button 
              className="btn-primary"
              onClick={onClose}
            >
              ✓ Hotovo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
