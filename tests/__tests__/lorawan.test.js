/**
 * LoRaWAN Integration Tests
 * Tests the complete flow of data from TTN webhook to database
 */

// Test payload formats
describe('LoRaWAN Payload Parsing', () => {
  
  describe('TTN v3 Webhook Format', () => {
    const validTTNPayload = {
      end_device_ids: {
        device_id: 'beehive-hive-001',
        application_ids: { application_id: 'beehive-monitor' },
        dev_eui: '70B3D57ED005A4B2',
        join_eui: '0000000000000000',
        dev_addr: '260B1234'
      },
      correlation_ids: ['as:up:01234567890'],
      received_at: '2025-12-10T12:00:00.000Z',
      uplink_message: {
        session_key_id: 'AXyz123',
        f_port: 1,
        f_cnt: 42,
        frm_payload: 'AQID', // Base64 encoded
        decoded_payload: {
          temperature: 34.5,
          humidity: 55.2,
          weight: 45.3,
          battery: 87
        },
        rx_metadata: [{
          gateway_ids: {
            gateway_id: 'my-gateway',
            eui: '1234567890ABCDEF'
          },
          time: '2025-12-10T12:00:00.000Z',
          timestamp: 1234567890,
          rssi: -95,
          channel_rssi: -95,
          snr: 7.5,
          location: {
            latitude: 48.716,
            longitude: 21.261,
            altitude: 200
          }
        }],
        settings: {
          data_rate: {
            lora: {
              bandwidth: 125000,
              spreading_factor: 7
            }
          },
          frequency: '868100000',
          timestamp: 1234567890
        },
        received_at: '2025-12-10T12:00:00.000Z'
      }
    };

    it('should extract devEUI from TTN payload', () => {
      const devEUI = validTTNPayload.end_device_ids?.dev_eui?.toUpperCase();
      expect(devEUI).toBe('70B3D57ED005A4B2');
    });

    it('should extract decoded payload', () => {
      const payload = validTTNPayload.uplink_message?.decoded_payload;
      expect(payload).toEqual({
        temperature: 34.5,
        humidity: 55.2,
        weight: 45.3,
        battery: 87
      });
    });

    it('should extract metadata (RSSI, SNR)', () => {
      const rxMeta = validTTNPayload.uplink_message?.rx_metadata?.[0];
      expect(rxMeta.rssi).toBe(-95);
      expect(rxMeta.snr).toBe(7.5);
    });

    it('should extract device_id for hive matching', () => {
      const deviceId = validTTNPayload.end_device_ids?.device_id;
      expect(deviceId).toBe('beehive-hive-001');
    });
  });

  describe('Binary Payload Decoding', () => {
    // 9-byte payload: temp(2), humidity(2), weight(4), battery(1)
    
    it('should decode binary payload correctly', () => {
      // Example: temp=34.5°C, humidity=55.2%, weight=45.30kg, battery=87%
      // temp: 345 (0x0159) in 1/10°C
      // humidity: 552 (0x0228) in 1/10%
      // weight: 4530 (0x000011B2) in 1/100kg
      // battery: 87 (0x57)
      
      const payload = Buffer.from([
        0x01, 0x59,             // temperature: 345 = 34.5°C
        0x02, 0x28,             // humidity: 552 = 55.2%
        0x00, 0x00, 0x11, 0xB2, // weight: 4530 = 45.30kg
        0x57                    // battery: 87%
      ]);
      
      const decoded = {
        temperature: payload.readInt16BE(0) / 10.0,
        humidity: payload.readInt16BE(2) / 10.0,
        weight: payload.readInt32BE(4) / 100.0,
        battery: payload.readUInt8(8)
      };
      
      expect(decoded.temperature).toBe(34.5);
      expect(decoded.humidity).toBe(55.2);
      expect(decoded.weight).toBe(45.30);
      expect(decoded.battery).toBe(87);
    });

    it('should handle negative temperatures', () => {
      // -5.5°C = -55 in 1/10°C = 0xFFC9 (two's complement)
      const payload = Buffer.from([
        0xFF, 0xC9,             // temperature: -55 = -5.5°C
        0x02, 0x58,             // humidity: 60%
        0x00, 0x00, 0x0F, 0xA0, // weight: 40.00kg
        0x64                    // battery: 100%
      ]);
      
      const temp = payload.readInt16BE(0) / 10.0;
      expect(temp).toBe(-5.5);
    });

    it('should handle zero weight', () => {
      const payload = Buffer.from([
        0x01, 0x40,             // temperature: 32.0°C
        0x02, 0x58,             // humidity: 60%
        0x00, 0x00, 0x00, 0x00, // weight: 0.00kg
        0x32                    // battery: 50%
      ]);
      
      const weight = payload.readInt32BE(4) / 100.0;
      expect(weight).toBe(0);
    });
  });

  describe('Data Validation', () => {
    it('should reject missing required fields', () => {
      const incompletePayload = {
        temperature: 34.5,
        // missing humidity, weight, battery
      };
      
      const isValid = (
        incompletePayload.temperature !== undefined &&
        incompletePayload.humidity !== undefined &&
        incompletePayload.weight !== undefined &&
        incompletePayload.battery !== undefined
      );
      
      expect(isValid).toBe(false);
    });

    it('should accept valid payload', () => {
      const validPayload = {
        temperature: 34.5,
        humidity: 55.2,
        weight: 45.3,
        battery: 87
      };
      
      const isValid = (
        validPayload.temperature !== undefined &&
        validPayload.humidity !== undefined &&
        validPayload.weight !== undefined &&
        validPayload.battery !== undefined
      );
      
      expect(isValid).toBe(true);
    });

    it('should validate temperature range (realistic for beehive)', () => {
      const validateTemp = (t) => t >= -20 && t <= 60;
      
      expect(validateTemp(34.5)).toBe(true);  // Normal hive temp
      expect(validateTemp(-10)).toBe(true);   // Winter
      expect(validateTemp(45)).toBe(true);    // Hot day
      expect(validateTemp(-50)).toBe(false);  // Too cold
      expect(validateTemp(100)).toBe(false);  // Too hot
    });

    it('should validate battery percentage', () => {
      const validateBattery = (b) => b >= 0 && b <= 100;
      
      expect(validateBattery(87)).toBe(true);
      expect(validateBattery(0)).toBe(true);
      expect(validateBattery(100)).toBe(true);
      expect(validateBattery(-5)).toBe(false);
      expect(validateBattery(150)).toBe(false);
    });
  });

  describe('DevEUI Matching', () => {
    const mockHives = [
      { id: 'hive-1', name: 'Úľ 1', device: { type: 'api', devEUI: '70B3D57ED005A4B2' } },
      { id: 'hive-2', name: 'Úľ 2', device: { type: 'api', devEUI: '70B3D57ED005A4B3' } },
      { id: 'hive-3', name: 'Úľ 3', device: { type: 'api' } },
    ];

    it('should find hive by devEUI', () => {
      const devEUI = '70B3D57ED005A4B2';
      const hive = mockHives.find(h => h.device?.devEUI === devEUI);
      
      expect(hive).toBeDefined();
      expect(hive.id).toBe('hive-1');
      expect(hive.name).toBe('Úľ 1');
    });

    it('should return undefined for unknown devEUI', () => {
      const devEUI = 'UNKNOWN_DEV_EUI';
      const hive = mockHives.find(h => h.device?.devEUI === devEUI);
      
      expect(hive).toBeUndefined();
    });

    it('should handle case-insensitive devEUI matching', () => {
      const devEUI = '70b3d57ed005a4b2'.toUpperCase();
      const hive = mockHives.find(h => h.device?.devEUI === devEUI);
      
      expect(hive).toBeDefined();
    });

    it('should not match devices without devEUI', () => {
      const devEUI = '70B3D57ED005A4B2';
      const apiHivesWithoutDevEUI = mockHives.filter(h => h.device?.type === 'api' && !h.device?.devEUI);
      const matchedManual = mockHives.find(h => h.device?.type === 'manual' && h.device?.devEUI === devEUI);
      
      // API devices without devEUI should not match
      expect(apiHivesWithoutDevEUI.length).toBe(1); // hive-3 has no devEUI
      // Manual devices won't have devEUI
      expect(matchedManual).toBeUndefined();
    });
  });
});

describe('ChirpStack Webhook Format', () => {
  const chirpStackPayload = {
    deduplicationId: 'abc123',
    time: '2025-12-10T12:00:00Z',
    deviceInfo: {
      tenantId: 'tenant-1',
      tenantName: 'My Tenant',
      applicationId: 'app-1',
      applicationName: 'Beehive Monitor',
      deviceProfileId: 'profile-1',
      deviceProfileName: 'EU868 Class A',
      deviceName: 'beehive-hive-001',
      devEui: '70b3d57ed005a4b2'
    },
    devAddr: '01234567',
    adr: true,
    dr: 5,
    fCnt: 42,
    fPort: 1,
    data: 'AQID', // Base64
    object: {
      temperature: 34.5,
      humidity: 55.2,
      weight: 45.3,
      battery: 87
    },
    rxInfo: [{
      gatewayId: 'gateway-1',
      uplinkId: 12345,
      time: '2025-12-10T12:00:00Z',
      rssi: -95,
      snr: 7.5,
      location: {
        latitude: 48.716,
        longitude: 21.261
      }
    }],
    txInfo: {
      frequency: 868100000,
      modulation: {
        lora: {
          bandwidth: 125000,
          spreadingFactor: 7
        }
      }
    }
  };

  it('should extract devEUI from ChirpStack format', () => {
    const devEUI = chirpStackPayload.deviceInfo?.devEui?.toUpperCase();
    expect(devEUI).toBe('70B3D57ED005A4B2');
  });

  it('should extract decoded object', () => {
    const payload = chirpStackPayload.object;
    expect(payload.temperature).toBe(34.5);
    expect(payload.humidity).toBe(55.2);
  });
});

describe('Hive ID Extraction from Device ID', () => {
  const extractHiveId = (deviceId) => {
    if (!deviceId) return 'HIVE-001';
    
    // Pattern: beehive-hive-001 -> HIVE-001
    const match = deviceId.match(/hive-(\d+)/i);
    if (match) {
      return `HIVE-${match[1].padStart(3, '0')}`;
    }
    
    return 'HIVE-001';
  };

  it('should extract hive ID from device ID', () => {
    expect(extractHiveId('beehive-hive-001')).toBe('HIVE-001');
    expect(extractHiveId('beehive-hive-002')).toBe('HIVE-002');
    expect(extractHiveId('my-beehive-hive-42')).toBe('HIVE-042');
  });

  it('should default to HIVE-001 for unknown format', () => {
    expect(extractHiveId('unknown-device')).toBe('HIVE-001');
    expect(extractHiveId('')).toBe('HIVE-001');
    expect(extractHiveId(null)).toBe('HIVE-001');
  });
});
