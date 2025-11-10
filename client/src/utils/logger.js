/**
 * Logger utility for development and production
 * Automatically disables console.log in production builds
 */

const isDevelopment = import.meta.env.DEV

export const logger = {
  /**
   * Log informational messages (only in development)
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  /**
   * Log warning messages (only in development)
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },

  /**
   * Log error messages (always logged, even in production)
   */
  error: (...args) => {
    console.error(...args)
  },

  /**
   * Log debug messages with timestamp (only in development)
   */
  debug: (...args) => {
    if (isDevelopment) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}]`, ...args)
    }
  },

  /**
   * Log API requests (only in development)
   */
  api: (method, url, data) => {
    if (isDevelopment) {
      console.group(`🌐 API ${method} ${url}`)
      if (data) console.log('Data:', data)
      console.groupEnd()
    }
  },

  /**
   * Log API responses (only in development)
   */
  apiResponse: (method, url, response) => {
    if (isDevelopment) {
      console.group(`✅ API Response ${method} ${url}`)
      console.log('Response:', response)
      console.groupEnd()
    }
  },

  /**
   * Log API errors (always logged)
   */
  apiError: (method, url, error) => {
    console.group(`❌ API Error ${method} ${url}`)
    console.error('Error:', error)
    console.groupEnd()
  }
}

export default logger
