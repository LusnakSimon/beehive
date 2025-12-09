const { getAllowedOrigins, setCorsHeaders, setPublicCorsHeaders } = require('../../lib/utils/cors');

describe('CORS Utils', () => {
  describe('getAllowedOrigins', () => {
    it('should include production origins', () => {
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('https://sbeehive.vercel.app');
      expect(origins).toContain('https://ebeehive.vercel.app');
    });

    it('should include localhost in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const origins = getAllowedOrigins();
      
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://localhost:5173');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('setCorsHeaders', () => {
    const createMockReqRes = (origin = null) => {
      const req = {
        method: 'GET',
        headers: { origin }
      };
      const res = {
        headers: {},
        statusCode: 200,
        setHeader: jest.fn((key, value) => {
          res.headers[key] = value;
        }),
        status: jest.fn((code) => {
          res.statusCode = code;
          return res;
        }),
        end: jest.fn()
      };
      return { req, res };
    };

    it('should set CORS headers for allowed origin', () => {
      const { req, res } = createMockReqRes('https://sbeehive.vercel.app');
      
      setCorsHeaders(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://sbeehive.vercel.app');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    it('should handle OPTIONS preflight request', () => {
      const { req, res } = createMockReqRes('https://sbeehive.vercel.app');
      req.method = 'OPTIONS';
      
      const handled = setCorsHeaders(req, res);
      
      expect(handled).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });

    it('should return false for non-OPTIONS requests', () => {
      const { req, res } = createMockReqRes('https://sbeehive.vercel.app');
      
      const handled = setCorsHeaders(req, res);
      
      expect(handled).toBe(false);
    });
  });

  describe('setPublicCorsHeaders', () => {
    it('should set wildcard origin for public endpoints', () => {
      const req = { method: 'GET', headers: {} };
      const res = {
        headers: {},
        setHeader: jest.fn((key, value) => {
          res.headers[key] = value;
        }),
        status: jest.fn(() => res),
        end: jest.fn()
      };
      
      setPublicCorsHeaders(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should handle OPTIONS for public endpoints', () => {
      const req = { method: 'OPTIONS', headers: {} };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn(() => res),
        end: jest.fn()
      };
      
      const handled = setPublicCorsHeaders(req, res);
      
      expect(handled).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
