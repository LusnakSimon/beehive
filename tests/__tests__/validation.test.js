const {
  escapeRegex,
  isValidObjectId,
  isValidEmail,
  isValidHiveId,
  validateSensorReading,
  validateInspectionChecklist,
  sanitizeString,
  isValidCoordinates,
  isValidHex
} = require('../../lib/utils/validation');

describe('Validation Utils', () => {
  describe('escapeRegex', () => {
    it('should escape special regex characters', () => {
      expect(escapeRegex('test.*+?^${}()|[]\\name')).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\name');
    });

    it('should return empty string for non-string input', () => {
      expect(escapeRegex(null)).toBe('');
      expect(escapeRegex(undefined)).toBe('');
      expect(escapeRegex(123)).toBe('');
    });

    it('should handle normal strings without escaping', () => {
      expect(escapeRegex('hello world')).toBe('hello world');
    });
  });

  describe('isValidObjectId', () => {
    it('should return true for valid ObjectId', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
      expect(isValidObjectId('000000000000000000000000')).toBe(true);
      expect(isValidObjectId('ffffffffffffffffffffffff')).toBe(true);
    });

    it('should return false for invalid ObjectId', () => {
      expect(isValidObjectId('')).toBe(false);
      expect(isValidObjectId(null)).toBe(false);
      expect(isValidObjectId(undefined)).toBe(false);
      expect(isValidObjectId('123')).toBe(false);
      expect(isValidObjectId('507f1f77bcf86cd79943901')).toBe(false); // 23 chars
      expect(isValidObjectId('507f1f77bcf86cd7994390111')).toBe(false); // 25 chars
      expect(isValidObjectId('507f1f77bcf86cd79943901g')).toBe(false); // invalid char
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('noat.com')).toBe(false);
    });
  });

  describe('isValidHiveId', () => {
    it('should return true for valid hive IDs', () => {
      expect(isValidHiveId('HIVE-001')).toBe(true);
      expect(isValidHiveId('HIVE-123')).toBe(true);
      expect(isValidHiveId('HIVE-9999')).toBe(true);
    });

    it('should return false for invalid hive IDs', () => {
      expect(isValidHiveId('')).toBe(false);
      expect(isValidHiveId(null)).toBe(false);
      expect(isValidHiveId('HIVE-01')).toBe(false); // too short
      expect(isValidHiveId('hive-001')).toBe(false); // lowercase
      expect(isValidHiveId('HIVE001')).toBe(false); // missing dash
      expect(isValidHiveId('BEEHIVE-001')).toBe(false); // wrong prefix
    });
  });

  describe('validateSensorReading', () => {
    it('should validate correct sensor readings', () => {
      const result = validateSensorReading({
        temperature: 35.5,
        humidity: 60,
        weight: 45.2,
        battery: 85
      });
      
      expect(result.valid).toBe(true);
      expect(result.data.temperature).toBe(35.5);
      expect(result.data.humidity).toBe(60);
      expect(result.data.weight).toBe(45.2);
      expect(result.data.battery).toBe(85);
    });

    it('should provide default battery value', () => {
      const result = validateSensorReading({
        temperature: 35,
        humidity: 60,
        weight: 45
      });
      
      expect(result.valid).toBe(true);
      expect(result.data.battery).toBe(100);
    });

    it('should clamp battery values', () => {
      const result = validateSensorReading({
        temperature: 35,
        humidity: 60,
        weight: 45,
        battery: 150
      });
      
      expect(result.valid).toBe(true);
      expect(result.data.battery).toBe(100);
    });

    it('should reject missing required fields', () => {
      expect(validateSensorReading({}).valid).toBe(false);
      expect(validateSensorReading({ temperature: 35 }).valid).toBe(false);
      expect(validateSensorReading({ temperature: 35, humidity: 60 }).valid).toBe(false);
    });

    it('should reject out-of-range values', () => {
      expect(validateSensorReading({ temperature: -100, humidity: 60, weight: 45 }).valid).toBe(false);
      expect(validateSensorReading({ temperature: 35, humidity: 150, weight: 45 }).valid).toBe(false);
      expect(validateSensorReading({ temperature: 35, humidity: 60, weight: 600 }).valid).toBe(false);
    });
  });

  describe('validateInspectionChecklist', () => {
    it('should validate correct checklists', () => {
      expect(validateInspectionChecklist({ queenSeen: true, eggs: false }).valid).toBe(true);
      expect(validateInspectionChecklist({}).valid).toBe(true);
    });

    it('should reject invalid checklists', () => {
      expect(validateInspectionChecklist(null).valid).toBe(false);
      expect(validateInspectionChecklist('string').valid).toBe(false);
      expect(validateInspectionChecklist({ queenSeen: 'yes' }).valid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeString('<p>Hello</p>')).toBe('Hello');
    });

    it('should truncate to max length', () => {
      expect(sanitizeString('hello', 3)).toBe('hel');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });
  });

  describe('isValidCoordinates', () => {
    it('should validate correct coordinates', () => {
      expect(isValidCoordinates({ lat: 48.716, lng: 21.261 })).toBe(true);
      expect(isValidCoordinates({ lat: 0, lng: 0 })).toBe(true);
      expect(isValidCoordinates({ lat: -90, lng: -180 })).toBe(true);
      expect(isValidCoordinates({ lat: 90, lng: 180 })).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(isValidCoordinates(null)).toBe(false);
      expect(isValidCoordinates({})).toBe(false);
      expect(isValidCoordinates({ lat: 91, lng: 0 })).toBe(false);
      expect(isValidCoordinates({ lat: 0, lng: 181 })).toBe(false);
      expect(isValidCoordinates({ lat: 'string', lng: 0 })).toBe(false);
    });
  });

  describe('isValidHex', () => {
    it('should validate correct hex strings', () => {
      expect(isValidHex('70B3D57ED005A4B2', 16)).toBe(true);
      expect(isValidHex('aabbccdd', 8)).toBe(true);
    });

    it('should reject invalid hex strings', () => {
      expect(isValidHex('', 16)).toBe(false);
      expect(isValidHex(null, 16)).toBe(false);
      expect(isValidHex('70B3D57ED005A4B', 16)).toBe(false); // too short
      expect(isValidHex('70B3D57ED005A4B2G', 17)).toBe(false); // invalid char
    });
  });
});
