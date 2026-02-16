# Testing Guide

This project uses [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/react) for component testing.

## Running Tests

```bash
# Run unit tests in watch mode (recommended during development)
pnpm test

# Run unit tests once
pnpm test:unit

# Run Storybook component tests
pnpm test:stories

# Run all tests (unit + storybook)
pnpm test:run

# Run tests with UI
pnpm test:ui

# Run unit tests with coverage report
pnpm test:coverage
```

## Writing Tests

### Test File Location

Place test files next to the components they test with a `.test.tsx` extension:

```
src/
  components/
    MyComponent.tsx
    MyComponent.test.tsx
```

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);

    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Testing User Interactions

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<MyComponent onClick={handleClick} />);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Available Test Utilities

### Custom Render

The `render` function from `@/test/test-utils` wraps components with any necessary providers.

### Chrome API Mocks

The test setup automatically mocks the Chrome extension API. See [setup.ts](./setup.ts) for available mocks.

### Common Queries

- `getByText()` - Find element by text content
- `getByRole()` - Find element by ARIA role (preferred)
- `getByLabelText()` - Find form elements by label
- `getByTestId()` - Find by data-testid attribute (use sparingly)
- `queryBy*()` - Same as `getBy*()` but returns null instead of throwing
- `findBy*()` - Async version for elements that appear later

### User Event

Use `@testing-library/user-event` for simulating user interactions:

- `user.click(element)` - Click element
- `user.type(element, 'text')` - Type in input
- `user.hover(element)` - Hover over element

## Best Practices

1. **Query by role when possible** - Most accessible and resilient
2. **Avoid implementation details** - Don't test internal state or class names
3. **Test user behavior** - Focus on what users see and do
4. **One assertion per test** - Keeps tests focused and readable
5. **Use descriptive test names** - Clearly state what's being tested
6. **Mock external dependencies** - Keep tests isolated and fast

## Example Tests

See the following files for examples:

- [ChatMessage.test.tsx](../sidepanel/components/ChatMessage.test.tsx) - Component unit tests
- [App.test.tsx](../sidepanel/App.test.tsx) - Component integration tests with message handling
- [messaging.test.ts](../shared/types/messaging.test.ts) - Type guard unit tests

## Known Limitations & Technical Debt

### Content Script Testing

**Issue**: `src/content/main.tsx` is not directly testable because:

- Functions are not exported
- Side effects occur on module import (MutationObserver, DOM manipulation)
- Tightly coupled to Chrome APIs

**Current State**: `src/content/navigation.test.ts` simulates navigation logic with local variables rather than testing actual production code. Tests verify INTENDED behavior but won't catch regressions if `main.tsx` diverges.

**Planned Solution** (tracked as technical debt):

1. Extract core logic to `src/content/navigationLogic.ts`:
   - `computeSlugTransition(currentSlug, newSlug, lastEmitted)` → `{ isReEntry, shouldSkip }`
   - `shouldClearCache(isReEntry)` → boolean
   - `buildMessage(problem, isReEntry)` → RuntimeMessage
2. Export and test these pure functions directly
3. Keep `main.tsx` as thin orchestration layer

**Impact**: Medium - Current tests catch most logic bugs, but production code can drift unnoticed.

**Priority**: Low - Address when main.tsx requires significant changes or when bugs occur in navigation logic.
