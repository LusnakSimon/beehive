const { verifyAuth, requireAuth, requireAdmin, userOwnsHive } = require('../../lib/utils/auth');
const jwt = require('jsonwebtoken');

describe('Auth Utils', () => {
  const SECRET = process.env.JWT_SECRET;

  // Helper to create mock request
  const createMockRequest = (cookie = null, authHeader = null) => ({
    headers: {
      cookie: cookie,
      authorization: authHeader
    }
  });

  // Helper to create mock response
  const createMockResponse = () => {
    const res = {
      statusCode: 200,
      body: null,
      status: jest.fn((code) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn((body) => {
        res.body = body;
        return res;
      })
    };
    return res;
  };

  describe('verifyAuth', () => {
    it('should return authenticated false when no token', () => {
      const req = createMockRequest();
      const result = verifyAuth(req);
      
      expect(result.authenticated).toBe(false);
      expect(result.user).toBe(null);
    });

    it('should authenticate valid token from cookie', () => {
      const userData = { id: 'user123', email: 'test@example.com', role: 'user' };
      const token = jwt.sign({ user: userData }, SECRET);
      const req = createMockRequest(`auth-token=${token}`);
      
      const result = verifyAuth(req);
      
      expect(result.authenticated).toBe(true);
      expect(result.user.id).toBe('user123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should authenticate valid token from Authorization header', () => {
      const userData = { id: 'user456', email: 'test2@example.com' };
      const token = jwt.sign(userData, SECRET);
      const req = createMockRequest(null, `Bearer ${token}`);
      
      const result = verifyAuth(req);
      
      expect(result.authenticated).toBe(true);
      expect(result.user.id).toBe('user456');
    });

    it('should return authenticated false for invalid token', () => {
      const req = createMockRequest('auth-token=invalid-token');
      const result = verifyAuth(req);
      
      expect(result.authenticated).toBe(false);
      expect(result.user).toBe(null);
    });

    it('should return authenticated false for expired token', () => {
      const userData = { id: 'user789' };
      const token = jwt.sign(userData, SECRET, { expiresIn: '-1h' }); // Already expired
      const req = createMockRequest(`auth-token=${token}`);
      
      const result = verifyAuth(req);
      
      expect(result.authenticated).toBe(false);
    });

    it('should prefer cookie over Authorization header', () => {
      const cookieUser = { id: 'cookie-user', email: 'cookie@test.com' };
      const headerUser = { id: 'header-user', email: 'header@test.com' };
      const cookieToken = jwt.sign({ user: cookieUser }, SECRET);
      const headerToken = jwt.sign(headerUser, SECRET);
      
      const req = createMockRequest(`auth-token=${cookieToken}`, `Bearer ${headerToken}`);
      const result = verifyAuth(req);
      
      expect(result.user.id).toBe('cookie-user');
    });
  });

  describe('requireAuth', () => {
    it('should return user when authenticated', () => {
      const userData = { id: 'auth-user', email: 'auth@test.com' };
      const token = jwt.sign({ user: userData }, SECRET);
      const req = createMockRequest(`auth-token=${token}`);
      const res = createMockResponse();
      
      const result = requireAuth(req, res);
      
      expect(result).not.toBe(null);
      expect(result.id).toBe('auth-user');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should send 401 and return null when not authenticated', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      const result = requireAuth(req, res);
      
      expect(result).toBe(null);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Unauthorized'
      }));
    });
  });

  describe('requireAdmin', () => {
    it('should return user when admin', () => {
      const userData = { id: 'admin-user', email: 'admin@test.com', role: 'admin' };
      const token = jwt.sign({ user: userData }, SECRET);
      const req = createMockRequest(`auth-token=${token}`);
      const res = createMockResponse();
      
      const result = requireAdmin(req, res);
      
      expect(result).not.toBe(null);
      expect(result.role).toBe('admin');
    });

    it('should send 403 when user is not admin', () => {
      const userData = { id: 'normal-user', email: 'user@test.com', role: 'user' };
      const token = jwt.sign({ user: userData }, SECRET);
      const req = createMockRequest(`auth-token=${token}`);
      const res = createMockResponse();
      
      const result = requireAdmin(req, res);
      
      expect(result).toBe(null);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Forbidden'
      }));
    });

    it('should send 401 when not authenticated', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      const result = requireAdmin(req, res);
      
      expect(result).toBe(null);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('userOwnsHive', () => {
    it('should return true when user owns hive (string format)', () => {
      const user = {
        id: 'user123',
        ownedHives: ['HIVE-001', 'HIVE-002']
      };
      
      expect(userOwnsHive(user, 'HIVE-001')).toBe(true);
      expect(userOwnsHive(user, 'HIVE-002')).toBe(true);
    });

    it('should return true when user owns hive (object format)', () => {
      const user = {
        id: 'user123',
        ownedHives: [{ id: 'HIVE-001', name: 'Main Hive' }, { id: 'HIVE-002' }]
      };
      
      expect(userOwnsHive(user, 'HIVE-001')).toBe(true);
    });

    it('should return false when user does not own hive', () => {
      const user = {
        id: 'user123',
        ownedHives: ['HIVE-001']
      };
      
      expect(userOwnsHive(user, 'HIVE-999')).toBe(false);
    });

    it('should return true for admin regardless of ownership', () => {
      const adminUser = {
        id: 'admin123',
        role: 'admin',
        ownedHives: []
      };
      
      expect(userOwnsHive(adminUser, 'HIVE-ANY')).toBe(true);
    });

    it('should return false for null user or hiveId', () => {
      expect(userOwnsHive(null, 'HIVE-001')).toBe(false);
      expect(userOwnsHive({ ownedHives: [] }, null)).toBe(false);
      expect(userOwnsHive({ ownedHives: [] }, '')).toBe(false);
    });
  });
});
