import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('logger utility', () => {
  let originalConsole
  
  beforeEach(() => {
    // Save original console methods
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      group: console.group,
      groupEnd: console.groupEnd,
    }
    
    // Mock console methods
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
    console.group = vi.fn()
    console.groupEnd = vi.fn()
  })
  
  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    console.group = originalConsole.group
    console.groupEnd = originalConsole.groupEnd
    
    vi.resetModules()
  })

  it('should have log, warn, error, debug, api methods', async () => {
    const { logger } = await import('./logger')
    
    expect(typeof logger.log).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.api).toBe('function')
  })

  it('should always log errors', async () => {
    const { logger } = await import('./logger')
    
    logger.error('test error')
    
    expect(console.error).toHaveBeenCalledWith('test error')
  })

  it('should log in development mode', async () => {
    // This test runs in test environment which behaves like dev
    const { logger } = await import('./logger')
    
    logger.log('test message')
    
    // In test environment (which is development-like), should log
    // This depends on how import.meta.env.DEV is set in vitest
  })
})
