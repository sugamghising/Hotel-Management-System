import { afterAll, beforeAll, beforeEach } from 'vitest';
import { userService } from '../src/api/user/user.service';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});

beforeEach(() => {
  // Clear user store before each test
  userService._clear();
});
