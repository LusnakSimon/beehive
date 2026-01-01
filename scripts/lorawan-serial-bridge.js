/*
 * lorawan-serial-bridge.js
 * Reads serial lines from an attached LoRa RX gateway (Arduino/ESP with RFM95)
 * and forwards received payloads to the app webhook: /api/lorawan/webhook
 *
 * Usage:
 * 1) Install dependencies in project root: npm install serialport@10 axios readline
 * 2) Run: node scripts/lorawan-serial-bridge.js --port COM3 --baud 115200 --url http://localhost:3000/api/lorawan/webhook
 *
 * The gateway sketch should output lines in the form (see provided Arduino snippet):
 * RX_HEX: 7b226465764575494... | RSSI: -42 | SNR: 7.5 | GW: gateway-1
 * Where the hex is the raw payload bytes encoded as hex. The bridge will convert to base64
 * and POST an object similar to a TTN webhook so the backend can parse it.
 */

const { SerialPort } = require('serialport')
const Readline = require('@serialport/parser-readline')
const axios = require('axios')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const argv = yargs(hideBin(process.argv))
  .option('port', { type: 'string', demandOption: true, describe: 'Serial port (COMx or /dev/ttyUSB0)' })
  .option('baud', { type: 'number', default: 115200, describe: 'Baud rate' })
  .option('url', { type: 'string', default: 'http://localhost:3000/api/lorawan/webhook', describe: 'Webhook URL' })
  .option('gateway', { type: 'string', default: 'serial-gateway', describe: 'Gateway ID to include in metadata' })
  .argv

const portPath = argv.port
const baudRate = argv.baud
const webhookUrl = argv.url
const gatewayId = argv.gateway

console.log(`Opening serial ${portPath} @ ${baudRate} -> ${webhookUrl}`)

const port = new SerialPort({ path: portPath, baudRate })
const parser = port.pipe(new Readline({ delimiter: '\n' }))

parser.on('data', async (line) => {
  try {
    line = line.trim()
    if (!line) return

    // Example line produced by Arduino snippet:
    // RX_HEX: 7b226465764575494... | RSSI: -42 | SNR: 7.5 | GW: gateway-1

    const hexMatch = line.match(/RX_HEX:\s*([0-9A-Fa-f]+)(?:\s*\|)?/) || line.match(/RX_BASE64:\s*([A-Za-z0-9+\/=]+)/)

    let payloadBytes = null
    if (hexMatch) {
      const hex = hexMatch[1]
      payloadBytes = Buffer.from(hex, 'hex')
    } else {
      const base64Match = line.match(/RX_BASE64:\s*([A-Za-z0-9+\/=]+)/)
      if (base64Match) payloadBytes = Buffer.from(base64Match[1], 'base64')
    }

    if (!payloadBytes) {
      console.log('Unrecognized line (no payload):', line)
      return
    }

    const rssiMatch = line.match(/RSSI:\s*(-?\d+)/)
    const snrMatch = line.match(/SNR:\s*([+-]?\d+(?:\.\d+)?)/)
    const gwMatch = line.match(/GW:\s*([\w-]+)/)

    const rssi = rssiMatch ? parseInt(rssiMatch[1], 10) : null
    const snr = snrMatch ? parseFloat(snrMatch[1]) : null
    const gw = gwMatch ? gwMatch[1] : gatewayId

    const frm_payload = payloadBytes.toString('base64')

    // Try to interpret payload as UTF-8 text (the node sends: 
    // T=21.23C H=45.1% W=123456 HX=1 #42)
    const payloadText = payloadBytes.toString('utf8')
    let decoded_payload = null

    // Match pattern: T=##.#C H=##.#% W=<number> HX=<0|1> #<counter>
    const textMatch = payloadText.match(/T=([+-]?\d+(?:\.\d+)?)C\s*H=([+-]?\d+(?:\.\d+)?)%?\s*W=([+-]?\d+)\s*HX=([01])\s*#(\d+)/i)
    if (textMatch) {
      decoded_payload = {
        temperature: parseFloat(textMatch[1]),
        humidity: parseFloat(textMatch[2]),
        weight_raw: parseInt(textMatch[3], 10),
        hx_ok: !!parseInt(textMatch[4], 10),
        counter: parseInt(textMatch[5], 10)
      }
    } else {
      // Try JSON payloads if node ever sends JSON
      try {
        const json = JSON.parse(payloadText)
        if (json && typeof json === 'object') decoded_payload = json
      } catch (e) {
        // not JSON
      }
    }

    // Build a minimal TTN-style webhook payload. Include both raw frm_payload and
    // human-friendly payload_text and decoded_payload when available so server can
    // accept either binary or decoded forms.
    const body = {
      uplink_message: {
        frm_payload,
        payload_text: payloadText,
        decoded_payload: decoded_payload,
        rx_metadata: [
          {
            rssi,
            snr,
            gateway_ids: { gateway_id: gw }
          }
        ],
        received_at: new Date().toISOString(),
        settings: {
          frequency: null,
          data_rate: {
            lora: { spreading_factor: null }
          }
        }
      },
      end_device_ids: {
        device_id: gw,
        dev_eui: null
      }
    }

    console.log('Forwarding payload -> webhook, bytes:', payloadBytes.length, 'RSSI:', rssi, 'SNR:', snr)

    try {
      const resp = await axios.post(webhookUrl, body, { timeout: 5000 })
      console.log('Webhook response:', resp.status)
    } catch (err) {
      console.error('Webhook POST failed:', err.message)
    }
  } catch (err) {
    console.error('Error parsing serial line:', err)
  }
})

port.on('open', () => console.log('Serial port opened'))
port.on('error', (err) => console.error('Serial port error:', err.message))

process.on('SIGINT', () => { console.log('Closing...'); port.close(() => process.exit(0)) })
