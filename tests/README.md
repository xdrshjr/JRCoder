# Testing Guide

## Overview

This document describes the testing strategy and practices for OpenJRAgent.

## Test Structure

```
tests/
├── setup.ts                    # Jest setup file
├── utils/
│   └── test-helpers.ts        # Test utility functions
├── unit/                       # Unit tests
│   ├── core/
│   │   └── errors.test.ts
│   ├── config/
│   │   └── validator.test.ts
│   └── storage/
│       └── file-storage.test.ts
├── integration/                # Integration tests
│   └── test-helpers.test.ts
├── e2e/                        # End-to-end tests
│   └── scenarios.test.ts
└── performance/                # Performance tests
    └── benchmarks.test.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- tests/unit/core/errors.test.ts
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="ConfigValidator"
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual functions and classes in isolation.

**Location**: `tests/unit/`

**Example**:
```typescript
describe('ConfigValidator', () => {
  it('should validate correct config', () => {
    const config = TestHelpers.createTestConfig();
    const result = ConfigValidator.validate(config);

    expect(result.valid).toBe(true);
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

**Location**: `tests/integration/`

**Example**:
```typescript
describe('Test Helpers', () => {
  it('should create mock client with responses', async () => {
    const client = TestHelpers.createMockLLMClient(responses);
    const result = await client.chat({ messages: [] });

    expect(result.content).toBe('Response 1');
  });
});
```

### End-to-End Tests

E2E tests simulate complete user scenarios from start to finish.

**Location**: `tests/e2e/`

**Example**:
```typescript
describe('E2E Scenarios', () => {
  it('should complete file read and write task', async () => {
    await fs.writeFile(inputPath, content);
    const readContent = await fs.readFile(inputPath, 'utf8');
    await fs.writeFile(outputPath, readContent);

    expect(outputContent).toBe(content);
  });
});
```

### Performance Tests

Performance tests ensure the system meets performance requirements.

**Location**: `tests/performance/`

**Example**:
```typescript
describe('Performance Tests', () => {
  it('should handle 100 file operations efficiently', async () => {
    const startTime = Date.now();
    // ... perform operations
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000);
  });
});
```

## Test Helpers

The `TestHelpers` class provides utility functions for testing:

### createMockLLMClient
Creates a mock LLM client with predefined responses.

```typescript
const responses = [
  TestHelpers.createMockLLMResponse('Response 1'),
  TestHelpers.createMockLLMResponse('Response 2')
];
const client = TestHelpers.createMockLLMClient(responses);
```

### createMockTool
Creates a mock tool for testing.

```typescript
const tool = TestHelpers.createMockTool('test_tool', {
  success: true,
  data: { value: 42 }
});
```

### createTestConfig
Creates a test configuration with optional overrides.

```typescript
const config = TestHelpers.createTestConfig({
  agent: { maxIterations: 10 }
});
```

### createTestLogger
Creates a test logger that doesn't output anything.

```typescript
const logger = TestHelpers.createTestLogger();
logger.info('test message');
expect(logger.info).toHaveBeenCalled();
```

### waitFor
Waits for a condition to be true.

```typescript
await TestHelpers.waitFor(() => value === true, 1000);
```

### createTempDir / cleanupTempDir
Creates and cleans up temporary directories.

```typescript
const tempDir = await TestHelpers.createTempDir();
// ... use tempDir
await TestHelpers.cleanupTempDir(tempDir);
```

## Best Practices

### 1. Test Isolation
Each test should be independent and not rely on other tests.

```typescript
beforeEach(async () => {
  tempDir = await TestHelpers.createTempDir();
});

afterEach(async () => {
  await TestHelpers.cleanupTempDir(tempDir);
});
```

### 2. Use Descriptive Names
Test names should clearly describe what is being tested.

```typescript
// Good
it('should validate correct config', () => { ... });

// Bad
it('test1', () => { ... });
```

### 3. Arrange-Act-Assert Pattern
Structure tests with clear setup, execution, and verification phases.

```typescript
it('should handle file operations', async () => {
  // Arrange
  const filePath = path.join(tempDir, 'test.txt');
  const content = 'Hello World';

  // Act
  await fs.writeFile(filePath, content);
  const result = await fs.readFile(filePath, 'utf8');

  // Assert
  expect(result).toBe(content);
});
```

### 4. Mock External Dependencies
Use mocks for external services and dependencies.

```typescript
const mockLLM = TestHelpers.createMockLLMClient([
  TestHelpers.createMockLLMResponse('Response')
]);
```

### 5. Test Error Cases
Always test both success and failure scenarios.

```typescript
it('should handle file not found error', async () => {
  await expect(
    fs.readFile('nonexistent.txt', 'utf8')
  ).rejects.toThrow();
});
```

### 6. Use Test Fixtures
Create reusable test data and configurations.

```typescript
const testConfig = TestHelpers.createTestConfig({
  agent: { maxIterations: 5 }
});
```

## Coverage Requirements

The project maintains the following coverage thresholds:

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Continuous Integration

Tests run automatically on:
- Every commit
- Pull requests
- Before deployment

CI configuration ensures:
- All tests pass
- Coverage thresholds are met
- No linting errors

## Debugging Tests

### Run single test in debug mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests/unit/core/errors.test.ts
```

### Use VS Code debugger
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Common Issues

### Tests timeout
Increase timeout in jest.config.js or individual tests:
```typescript
jest.setTimeout(30000); // 30 seconds
```

### Mock not working
Ensure mocks are cleared between tests:
```typescript
afterEach(() => {
  jest.clearAllMocks();
});
```

### File system errors
Always clean up temporary files:
```typescript
afterEach(async () => {
  await TestHelpers.cleanupTempDir(tempDir);
});
```

## Writing New Tests

1. Determine test category (unit/integration/e2e/performance)
2. Create test file in appropriate directory
3. Import TestHelpers and required modules
4. Write test cases following best practices
5. Run tests and verify coverage
6. Update this documentation if needed

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)
