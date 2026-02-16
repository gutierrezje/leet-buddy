# LeetBuddy

A Chrome extension that provides an AI-powered interview coach for LeetCode practice. Get hints, guidance, and track your solving progress without getting direct answers.

## Quick Start

### Development Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start development server:
   ```bash
   pnpm dev
   ```

3. Load extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` directory

4. Configure API key:
   - Click the extension icon and go to Options
   - Enter your Google Gemini API key
   - The key is validated on save

### Production Build

```bash
pnpm build
```

The built extension will be in the `dist` directory.

## Project Structure

```
src/
├── background/     - Background service worker (API validation, lifecycle)
├── content/        - Content scripts (LeetCode page integration)
├── sidepanel/      - Main side panel UI (chat, review, stopwatch)
├── popup/          - Extension popup (minimal, redirects to sidepanel)
├── options/        - Options page (API key configuration)
├── shared/         - Shared utilities, types, and business logic
│   ├── submissions.ts - Submission storage with v2 history support
│   ├── types/      - TypeScript types and message protocols
│   └── utils/      - Shared utilities
├── components/ui/  - Reusable UI components (shadcn/ui based)
└── test/           - Test utilities and setup
```

## Testing

This project uses Vitest for unit tests and Storybook for component testing.

### Running Tests

```bash
# Run unit tests in watch mode (default)
pnpm test

# Run unit tests once (single run)
pnpm test:unit

# Run Storybook component tests (single run)
pnpm test:stories

# Run all test projects once (unit + storybook, single run)
pnpm test:run

# Run unit tests with coverage report
pnpm test:coverage

# Open Vitest UI (interactive test runner)
pnpm test:ui
```

### Test Structure

- **Unit Tests** (`**/*.test.ts(x)`): Fast tests using happy-dom for React components and Node.js environment for pure logic
- **Storybook Tests** (`**/*.stories.ts(x)`): Visual component tests that run in a real browser environment

### Writing Tests

See `/src/test/README.md` for detailed testing guidelines and examples.

### Continuous Integration

All tests run automatically on pull requests via GitHub Actions:

- Linting (`pnpm lint`)
- Build verification (`pnpm build`)
- Unit tests with coverage (`pnpm test:coverage`)
- Storybook component tests (`pnpm test:stories`)

## Extension QA Checklist

Before submitting changes, manually verify:

### Core Flows
- [ ] **Problem Detection**: Navigate to a LeetCode problem → Side panel opens with problem title
- [ ] **Chat Session**: Send a message → Receive AI response without direct answers
- [ ] **Hint System**: Click hint buttons (DSA/Pattern/Complexity/Example) → Get specific hints
- [ ] **Manual Timing**: Start solving → Stop timer → Save modal appears with elapsed time
- [ ] **Auto Submission**: Submit solution on LeetCode → Auto-detect and show save modal
- [ ] **Review Stats**: Go to Review tab → See submission history and topic heatmap

### Edge Cases
- [ ] **Problem Switching**: Navigate to new problem → Chat resets, timer resets
- [ ] **Problem Cleared**: Navigate away from LeetCode → Panel shows empty state
- [ ] **No API Key**: Remove API key → Show error screen with options link
- [ ] **API Key Validation**: Enter API key → Background validates with Google API (check console logs)
- [ ] **Multiple Attempts**: Submit same problem multiple times → All attempts saved in history

### Build & Deploy
- [ ] **Dev Build**: `pnpm dev` runs without errors
- [ ] **Prod Build**: `pnpm build` completes successfully
- [ ] **Lint**: `pnpm lint` shows 0 errors and 0 warnings
- [ ] **Tests**: `pnpm test:run` shows all tests passing
- [ ] **Extension Load**: Load `dist` in Chrome → No console errors

## Architecture Highlights

### State Management
- **Custom Hooks**: Focused hooks for API key, problem context, chat session, and submission flow
- **Type-Safe State Machines**: Discriminated unions with `useReducer` for chat and submission states
- **Composition Pattern**: App.tsx is composition-only with no business logic

### Storage
- **Submission History v2**: Per-problem history with backward-compatible v1→v2 migration
- **Chrome Storage API**: All persistence via `chrome.storage.local`
- **Write Safety**: Per-slug queues prevent concurrent write conflicts

### Messaging
- **Runtime Protocol**: Type-safe messages between content script, sidepanel, and background
- **Type Guards**: Runtime validation for all message types
- **Event-Driven**: Chrome runtime messages for cross-context communication

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite with CRXJS plugin for HMR
- **Styling**: Tailwind CSS 4 with shadcn/ui components
- **AI**: Google Gemini 2.5 Flash via @google/generative-ai
- **Testing**: Vitest (unit) + Storybook (component)
- **Linting**: ESLint + Prettier

## Documentation

- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Documentation](https://crxjs.dev/vite-plugin)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)

## Development Notes

- Use `manifest.config.ts` to configure extension metadata
- CRXJS handles manifest generation and HMR automatically
- Content scripts inject into LeetCode pages at document_idle
- Side panel opens on extension icon click (uses Chrome Side Panel API)
