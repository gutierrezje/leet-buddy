# Testing Guide

This project uses [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/react) for component testing.

## Running Tests

```bash
# Run tests in watch mode (recommended during development)
pnpm test

# Run tests once
pnpm test:run

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
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
- [ChatMessage.test.tsx](../sidepanel/components/ChatMessage.test.tsx)
- [EmptyState.test.tsx](../sidepanel/components/EmptyState.test.tsx)
- [ApiKeyError.test.tsx](../sidepanel/components/ApiKeyError.test.tsx)
