# ScriptPal Frontend Testing Guide

This document provides comprehensive information about testing the ScriptPal frontend JavaScript code.

## Overview

The testing setup includes:
- **Jest** - JavaScript testing framework
- **jsdom** - DOM simulation for browser environment
- **@testing-library/jest-dom** - Custom Jest matchers for DOM testing
- **jest-fetch-mock** - Mock fetch requests
- **ESLint** - Code linting and quality checks
- **Prettier** - Code formatting

## Getting Started

### Installation

```bash
cd public
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

### Linting and Formatting

```bash
# Check linting issues
npm run lint:check

# Fix linting issues automatically
npm run lint

# Check code formatting
npm run format:check

# Format code automatically
npm run format

# Run all quality checks
npm run quality
```

## Test Structure

### File Organization

```
js/
├── __tests__/                 # Test files
│   ├── classes/              # Tests for class modules
│   ├── core/                 # Tests for core modules
│   ├── widgets/              # Tests for widget modules
│   ├── managers/             # Tests for manager modules
│   ├── test-utils.js         # Test utilities
│   └── *.test.js             # Other test files
├── classes/                  # Source files
├── core/                     # Source files
└── ...
```

### Test File Naming

- `*.test.js` - Test files
- `*.spec.js` - Alternative test file naming
- `__tests__/` - Test directory

## Writing Tests

### Basic Test Structure

```javascript
import { MyClass } from '../MyClass.js';

describe('MyClass', () => {
    let instance;

    beforeEach(() => {
        instance = new MyClass();
    });

    afterEach(() => {
        // Cleanup
    });

    describe('methodName', () => {
        it('should do something', () => {
            // Arrange
            const input = 'test';
            
            // Act
            const result = instance.methodName(input);
            
            // Assert
            expect(result).toBe('expected');
        });
    });
});
```

### Testing Async Code

```javascript
describe('async method', () => {
    it('should handle async operations', async () => {
        const result = await instance.asyncMethod();
        expect(result).toBeDefined();
    });

    it('should handle errors', async () => {
        await expect(instance.errorMethod()).rejects.toThrow('Error message');
    });
});
```

### Testing DOM Manipulation

```javascript
import { createMockElement, setupDOM } from './test-utils.js';

describe('DOM manipulation', () => {
    beforeEach(() => {
        setupDOM('<div id="test"></div>');
    });

    afterEach(() => {
        cleanupDOM();
    });

    it('should manipulate DOM elements', () => {
        const element = document.getElementById('test');
        expect(element).toBeInTheDocument();
    });
});
```

### Testing API Calls

```javascript
import { mockApiResponse, mockApiError } from './test-utils.js';

describe('API calls', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    it('should make successful API call', async () => {
        mockApiResponse({ data: 'test' });
        
        const result = await api.getData();
        
        expect(result).toEqual({ data: 'test' });
        expect(fetch).toHaveBeenCalledWith('/api/data');
    });

    it('should handle API errors', async () => {
        mockApiError('API Error', 500);
        
        await expect(api.getData()).rejects.toThrow('API Error');
    });
});
```

## Test Utilities

The `test-utils.js` file provides helpful utilities:

### DOM Utilities
- `createMockElement()` - Create mock DOM elements
- `createMockEvent()` - Create mock events
- `setupDOM()` - Set up DOM for testing
- `cleanupDOM()` - Clean up DOM after testing

### API Utilities
- `mockApiResponse()` - Mock successful API responses
- `mockApiError()` - Mock API errors
- `mockLocalStorage()` - Mock localStorage data
- `mockSessionStorage()` - Mock sessionStorage data

### Assertion Utilities
- `expectElementAttributes()` - Assert element attributes
- `expectElementClasses()` - Assert element classes
- `expectElementContent()` - Assert element content
- `expectFunctionCall()` - Assert function calls
- `expectAsyncResolve()` - Assert async resolution
- `expectAsyncReject()` - Assert async rejection

### Mock Utilities
- `createMock()` - Create mock functions
- `createSpy()` - Create spy functions
- `createDelayedMock()` - Create delayed mocks
- `waitForCondition()` - Wait for conditions

## Mocking

### Global Mocks

The following are automatically mocked in `jest.setup.js`:
- `fetch` - HTTP requests
- `localStorage` - Browser storage
- `sessionStorage` - Browser storage
- `window.location` - Browser location
- `window.history` - Browser history
- `ResizeObserver` - Resize observation
- `IntersectionObserver` - Intersection observation
- `MutationObserver` - DOM mutation observation
- `requestAnimationFrame` - Animation frames
- `getComputedStyle` - CSS computed styles
- `matchMedia` - Media queries
- `crypto` - Cryptographic functions

### Module Mocking

```javascript
// Mock entire module
jest.mock('../MyModule.js');

// Mock specific functions
jest.mock('../MyModule.js', () => ({
    function1: jest.fn(),
    function2: jest.fn()
}));

// Mock with implementation
jest.mock('../MyModule.js', () => ({
    MyClass: jest.fn().mockImplementation(() => ({
        method: jest.fn().mockReturnValue('mocked')
    }))
}));
```

## Coverage

### Coverage Thresholds

The project has the following coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Coverage Reports

Coverage reports are generated in multiple formats:
- **Text** - Console output
- **LCOV** - For CI integration
- **HTML** - For detailed browser viewing

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML coverage report
open coverage/lcov-report/index.html
```

## Best Practices

### Test Organization
1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain what is being tested
3. **Follow AAA pattern** - Arrange, Act, Assert
4. **Keep tests focused** - one concept per test
5. **Use proper setup/teardown** with `beforeEach`/`afterEach`

### Test Data
1. **Use factories** for creating test data
2. **Keep test data minimal** - only what's needed
3. **Use meaningful names** for test variables
4. **Avoid hardcoded values** when possible

### Assertions
1. **Use specific matchers** - `toBe()` vs `toEqual()`
2. **Test both positive and negative cases**
3. **Assert on behavior, not implementation**
4. **Use async matchers** for async code

### Mocking
1. **Mock external dependencies** - APIs, DOM, etc.
2. **Don't mock what you're testing**
3. **Use spies for verification** - `toHaveBeenCalledWith()`
4. **Reset mocks between tests**

### Performance
1. **Use `beforeEach`/`afterEach`** for setup/cleanup
2. **Avoid unnecessary async operations**
3. **Use `jest.useFakeTimers()`** for time-based tests
4. **Clean up event listeners** and observers

## Common Patterns

### Testing Event Handlers

```javascript
it('should handle click events', () => {
    const handler = jest.fn();
    const element = createMockElement('button');
    
    element.addEventListener('click', handler);
    element.click();
    
    expect(handler).toHaveBeenCalled();
});
```

### Testing State Changes

```javascript
it('should update state correctly', () => {
    const initialState = { count: 0 };
    const newState = { count: 1 };
    
    instance.setState(newState);
    
    expect(instance.getState()).toEqual(newState);
});
```

### Testing Error Handling

```javascript
it('should handle errors gracefully', () => {
    const errorHandler = jest.fn();
    instance.onError = errorHandler;
    
    instance.triggerError();
    
    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
});
```

## Troubleshooting

### Common Issues

1. **Module not found** - Check import paths and file extensions
2. **Async test timeouts** - Increase timeout or fix async logic
3. **Mock not working** - Ensure mocks are set up before imports
4. **DOM not available** - Check jsdom setup in jest.config.js
5. **Coverage not generated** - Check file patterns in jest.config.js

### Debugging Tests

```javascript
// Add debug output
console.log('Debug info:', variable);

// Use debugger
debugger;

// Check mock calls
console.log('Mock calls:', mockFunction.mock.calls);
```

### Performance Issues

1. **Slow tests** - Check for unnecessary async operations
2. **Memory leaks** - Ensure proper cleanup in `afterEach`
3. **Timeout errors** - Increase timeout or fix async logic

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd public && npm ci
      - run: cd public && npm run test:ci
```

### Pre-commit Hooks

The project uses Husky for pre-commit hooks:

```bash
# Install husky
npm run prepare

# Hooks run automatically on commit
git commit -m "feat: add new feature"
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
