# CampusCuts Testing Guide

Comprehensive testing strategy for CampusCuts.

---

## 📋 Testing Stack

### Backend
- **Jest**: Unit and integration testing
- **Supertest**: API endpoint testing
- **ts-jest**: TypeScript support

### Frontend
- **Vitest**: Fast unit testing
- **React Testing Library**: Component testing
- **@testing-library/jest-dom**: DOM matchers

### E2E
- **Playwright**: Cross-browser E2E testing

---

## 🧪 Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- dynamic-pricing.test.ts

# Watch mode
npm test -- --watch
```

### Frontend Tests

```bash
cd web-app

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- AdminWalletConnect.test.tsx

# Watch mode
npm test -- --watch

# UI mode
npm run test:ui
```

### E2E Tests

```bash
cd e2e

# Install browsers (first time only)
npx playwright install

# Run all E2E tests
npx playwright test

# Run specific browser
npx playwright test --project=chromium

# Run in headed mode
npx playwright test --headed

# Debug mode
npx playwright test --debug

# View test report
npx playwright show-report
```

---

## 📂 Test Structure

```
CampusCuts/
├─ backend/
│  ├─ src/
│  │  ├─ tests/
│  │  │  ├─ setup.ts               # Global test setup
│  │  │  ├─ services/
│  │  │  │  ├─ dynamic-pricing.test.ts
│  │  │  │  ├─ custodial-signer.test.ts
│  │  │  │  └─ blockchain-query.test.ts
│  │  │  ├─ controllers/
│  │  │  │  ├─ auth.test.ts
│  │  │  │  └─ booking.test.ts
│  │  │  └─ integration/
│  │  │     ├─ booking-flow.test.ts
│  │  │     └─ payment-flow.test.ts
│  └─ jest.config.js
│
├─ web-app/
│  ├─ src/
│  │  ├─ tests/
│  │  │  ├─ setup.ts
│  │  │  ├─ components/
│  │  │  │  ├─ AdminWalletConnect.test.tsx
│  │  │  │  └─ BookingCard.test.tsx
│  │  │  ├─ hooks/
│  │  │  │  └─ useBlockchainAuth.test.ts
│  │  │  └─ utils/
│  │  │     └─ formatters.test.ts
│  └─ vitest.config.ts
│
└─ e2e/
   ├─ tests/
   │  ├─ booking-flow.spec.ts
   │  ├─ admin-dashboard.spec.ts
   │  └─ wallet-connection.spec.ts
   └─ playwright.config.ts
```

---

## ✅ Test Coverage Goals

### Minimum Coverage Requirements

- **Overall:** 70%
- **Services:** 80%
- **Controllers:** 75%
- **Components:** 60%
- **Utils:** 90%

### Priority Areas (Must Have 90%+)

- Payment processing
- Custodial wallet key management
- Smart contract interactions
- Authentication flows
- Escrow logic

---

## 🔍 Types of Tests

### 1. Unit Tests

Test individual functions/methods in isolation.

**Example:**

```typescript
// dynamic-pricing.test.ts
describe('calculatePrice', () => {
  it('should calculate higher price for 5-star barber', () => {
    const input = { barber_rating: 5.0, ... };
    const result = service.calculatePrice(input);
    expect(result.recommended_price).toBeGreaterThan(basePrice);
  });
});
```

### 2. Integration Tests

Test multiple components working together.

**Example:**

```typescript
// booking-flow.test.ts
describe('Complete Booking Flow', () => {
  it('should create booking and lock funds in escrow', async () => {
    // Create user
    const user = await createTestUser();
    
    // Make booking request
    const response = await request(app)
      .post('/api/bookings-blockchain')
      .send({ ... });
    
    // Verify blockchain state
    expect(await getEscrowBalance()).toBe(expectedAmount);
  });
});
```

### 3. Component Tests

Test React components with user interactions.

**Example:**

```typescript
// AdminWalletConnect.test.tsx
it('should connect to Petra wallet', async () => {
  render(<AdminWalletConnect />);
  
  fireEvent.click(screen.getByText('Petra'));
  
  await waitFor(() => {
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });
});
```

### 4. E2E Tests

Test complete user journeys across the full stack.

**Example:**

```typescript
// booking-flow.spec.ts
test('student can book and pay for service', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Find Barber');
  await page.click('.barber-card:first-child');
  await page.click('button:has-text("Book Now")');
  // ... complete payment flow
  await expect(page.locator('.success')).toBeVisible();
});
```

---

## 🎯 Testing Best Practices

### DO ✅

- **Write tests first** (TDD when possible)
- **Test behavior, not implementation**
- **Use descriptive test names**
- **Keep tests isolated** (no shared state)
- **Mock external dependencies**
- **Test edge cases and errors**
- **Maintain test fixtures**

### DON'T ❌

- **Test implementation details**
- **Write flaky tests**
- **Skip error cases**
- **Ignore test failures**
- **Mix unit and integration tests**
- **Hard-code test data everywhere**

---

## 🔧 Mocking Strategies

### Backend Mocks

```typescript
// Mock Redis
jest.mock('../config/redis', () => ({
  redisGet: jest.fn().mockResolvedValue(null),
  redisSet: jest.fn().mockResolvedValue('OK'),
}));

// Mock Aptos SDK
jest.mock('aptos', () => ({
  AptosClient: jest.fn().mockImplementation(() => ({
    getAccount: jest.fn().mockResolvedValue({ ... }),
  })),
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_123' }),
    },
  }));
});
```

### Frontend Mocks

```typescript
// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockData, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isLoading: false }),
}));

// Mock window.aptos (Petra wallet)
global.window = {
  ...global.window,
  aptos: {
    connect: vi.fn().mockResolvedValue({ address: '0x123' }),
    signAndSubmitTransaction: vi.fn(),
  },
};
```

---

## 📊 Coverage Reports

### View Coverage

```bash
# Backend
cd backend
npm run test:coverage
open coverage/index.html

# Frontend
cd web-app
npm run test:coverage
open coverage/index.html
```

### CI/CD Integration

```yaml
# .github/workflows/ci-cd.yml
- name: Run backend tests with coverage
  run: |
    cd backend
    npm run test:coverage
    
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./backend/coverage/lcov.info,./web-app/coverage/lcov.info
```

---

## 🐛 Debugging Tests

### Jest/Vitest Debugging

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Then open chrome://inspect in Chrome
```

### Playwright Debugging

```bash
# Debug mode (opens browser)
npx playwright test --debug

# Step through test
npx playwright test --debug --headed

# Generate test
npx playwright codegen http://localhost:3000
```

---

## 📝 Writing Your First Test

### 1. Create Test File

```bash
# Backend
touch backend/src/tests/services/my-service.test.ts

# Frontend
touch web-app/src/tests/components/MyComponent.test.tsx
```

### 2. Write Test

```typescript
import { describe, it, expect } from 'vitest';
import MyComponent from '../../components/MyComponent';
import { render, screen } from '@testing-library/react';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 3. Run Test

```bash
npm test -- MyComponent.test.tsx
```

---

## 🚀 Continuous Testing

### Watch Mode

Keep tests running while developing:

```bash
# Backend
cd backend && npm test -- --watch

# Frontend
cd web-app && npm test -- --watch
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Run tests before committing
npm test --passWithNoTests
```

---

## 📈 Test Metrics

Track these metrics:

- **Code Coverage:** Aim for 70%+
- **Test Count:** Add tests for every feature
- **Test Duration:** Keep under 5 minutes
- **Flakiness Rate:** Keep under 1%
- **Mutation Score:** Aim for 60%+

---

## 🆘 Troubleshooting

### Common Issues

**Tests timing out:**
```typescript
// Increase timeout
jest.setTimeout(10000);

// Or per test
it('slow test', async () => { ... }, 10000);
```

**Module not found:**
```typescript
// Add to jest.config.js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

**React Testing Library errors:**
```typescript
// Wrap async updates in act()
await act(async () => {
  fireEvent.click(button);
});
```

---

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)

---

## ✨ Next Steps

1. Write tests for critical paths first
2. Achieve 70% coverage baseline
3. Add E2E tests for main flows
4. Integrate with CI/CD
5. Set up automated test runs
6. Monitor test metrics
7. Iterate and improve!

---

**Happy Testing! 🧪**

