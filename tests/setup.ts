/**
 * Test Setup File
 *
 * Runs before all tests to configure the test environment.
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
process.env.FIREBASE_PRIVATE_KEY = 'test-key';
process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test hooks
beforeAll(async () => {
  // Setup code that runs once before all tests
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  // Cleanup code that runs once after all tests
  console.log('✓ Test suite completed');
});

beforeEach(() => {
  // Setup that runs before each test
});

afterEach(() => {
  // Cleanup that runs after each test
});
