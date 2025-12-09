// Test setup file
// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.NEXTAUTH_SECRET = 'test-jwt-secret-for-testing-only'; // Same as JWT_SECRET for tests
process.env.ESP32_API_KEY = 'test-esp32-api-key';

// Mock console.error to suppress expected errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn((...args) => {
    // Only log unexpected errors
    if (!args[0]?.includes?.('JWT') && !args[0]?.includes?.('verification')) {
      originalError.apply(console, args);
    }
  });
});

afterAll(() => {
  console.error = originalError;
});
