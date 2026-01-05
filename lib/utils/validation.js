/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitize string for use in MongoDB regex (prevent ReDoS)
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate MongoDB ObjectId format
 * @param {string} id
 * @returns {boolean}
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Basic email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate hive ID format (HIVE-XXX)
 * @param {string} hiveId
 * @returns {boolean}
 */
function isValidHiveId(hiveId) {
  if (!hiveId || typeof hiveId !== 'string') return false;
  return /^HIVE-\d{3,}$/.test(hiveId);
}

/**
 * Validate and sanitize sensor reading data
 * @param {object} data
 * @returns {{ valid: boolean, data?: object, errors?: string[] }}
 */
function validateSensorReading(data) {
  const errors = [];
  
  if (data.temperature === undefined || data.temperature === null) {
    errors.push('Temperature is required');
  } else if (typeof data.temperature !== 'number' || data.temperature < -50 || data.temperature > 100) {
    errors.push('Temperature must be a number between -50 and 100');
  }
  
  if (data.humidity === undefined || data.humidity === null) {
    errors.push('Humidity is required');
  } else if (typeof data.humidity !== 'number' || data.humidity < 0 || data.humidity > 100) {
    errors.push('Humidity must be a number between 0 and 100');
  }
  
  if (data.weight === undefined || data.weight === null) {
    errors.push('Weight is required');
  } else if (typeof data.weight !== 'number' || data.weight < 0 || data.weight > 200000) {
    errors.push('Weight must be a number between 0 and 200000 (grams)');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // Sanitize and normalize
  return {
    valid: true,
    data: {
      temperature: Number(data.temperature),
      humidity: Number(data.humidity),
      weight: Number(data.weight),
      battery: data.battery !== undefined ? Math.min(100, Math.max(0, Number(data.battery))) : 100,
      hiveId: data.hiveId && isValidHiveId(data.hiveId) ? data.hiveId : 'HIVE-001'
    }
  };
}

/**
 * Validate inspection checklist
 * @param {object} checklist
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateInspectionChecklist(checklist) {
  if (!checklist || typeof checklist !== 'object') {
    return { valid: false, errors: ['Checklist is required and must be an object'] };
  }
  
  // All fields should be boolean if present
  const booleanFields = ['queenSeen', 'eggs', 'larvae', 'brood', 'pollen', 'honey', 'inspectionNeeded'];
  for (const field of booleanFields) {
    if (checklist[field] !== undefined && typeof checklist[field] !== 'boolean') {
      return { valid: false, errors: [`${field} must be a boolean`] };
    }
  }
  
  return { valid: true };
}

/**
 * Sanitize user input string (prevent XSS, trim whitespace)
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '');   // Remove any remaining angle brackets
}

/**
 * Validate coordinates
 * @param {object} coords - { lat, lng }
 * @returns {boolean}
 */
function isValidCoordinates(coords) {
  if (!coords || typeof coords !== 'object') return false;
  const { lat, lng } = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Validate hex string (for devEUI, etc.)
 * @param {string} hex
 * @param {number} expectedLength
 * @returns {boolean}
 */
function isValidHex(hex, expectedLength) {
  if (!hex || typeof hex !== 'string') return false;
  const regex = new RegExp(`^[0-9A-Fa-f]{${expectedLength}}$`);
  return regex.test(hex);
}

module.exports = {
  escapeRegex,
  isValidObjectId,
  isValidEmail,
  isValidHiveId,
  validateSensorReading,
  validateInspectionChecklist,
  sanitizeString,
  isValidCoordinates,
  isValidHex
};
