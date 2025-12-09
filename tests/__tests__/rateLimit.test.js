const { checkRateLimit, getClientIP, LIMITS } = require('../../lib/utils/rateLimit');

describe('Rate Limit Utils', () => {
  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-key-1', 'api');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(LIMITS.api.max - 1);
    });

    it('should track request count', () => {
      const key = 'test-key-count-' + Date.now();
      
      checkRateLimit(key, 'api');
      checkRateLimit(key, 'api');
      const result = checkRateLimit(key, 'api');
      
      expect(result.remaining).toBe(LIMITS.api.max - 3);
    });

    it('should block after max requests', () => {
      const key = 'test-key-block-' + Date.now();
      
      // Use auth limit which is smaller (10 per 15 min)
      for (let i = 0; i < LIMITS.auth.max; i++) {
        checkRateLimit(key, 'auth');
      }
      
      const result = checkRateLimit(key, 'auth');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should use default api limit for unknown type', () => {
      const key = 'test-key-unknown-' + Date.now();
      const result = checkRateLimit(key, 'unknown-type');
      
      expect(result.remaining).toBe(LIMITS.api.max - 1);
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
      };
      
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip', () => {
      const req = {
        headers: { 'x-real-ip': '192.168.1.2' }
      };
      
      expect(getClientIP(req)).toBe('192.168.1.2');
    });

    it('should return unknown for missing IP', () => {
      const req = { headers: {} };
      
      expect(getClientIP(req)).toBe('unknown');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '192.168.1.2'
        }
      };
      
      expect(getClientIP(req)).toBe('192.168.1.1');
    });
  });

  describe('LIMITS config', () => {
    it('should have expected limit types', () => {
      expect(LIMITS.auth).toBeDefined();
      expect(LIMITS.api).toBeDefined();
      expect(LIMITS.sensor).toBeDefined();
      expect(LIMITS.friendRequest).toBeDefined();
      expect(LIMITS.message).toBeDefined();
      expect(LIMITS.search).toBeDefined();
    });

    it('should have reasonable limits', () => {
      expect(LIMITS.auth.max).toBeLessThan(LIMITS.api.max);
      expect(LIMITS.friendRequest.max).toBeLessThan(LIMITS.message.max);
    });
  });
});
