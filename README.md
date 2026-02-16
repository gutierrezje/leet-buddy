# LeetBuddy

An extension that allows you to have a convenient way to practice your technical interviews.

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Start development server:

```bash
pnpm dev
```

3. Open Chrome and navigate to `chrome://extensions/`, enable "Developer mode", and load the unpacked extension from the `dist` directory.

4. Build for production:

```bash
pnpm build
```

## Project Structure

- `src/popup/` - Extension popup UI
- `src/content/` - Content scripts
- `manifest.config.ts` - Chrome extension manifest configuration

## Testing

This project uses Vitest for unit tests and Storybook for component testing.

### Running Tests

```bash
# Run unit tests in watch mode (default)
pnpm test

# Run unit tests once
pnpm test:unit

# Run Storybook component tests
pnpm test:stories

# Run all tests (unit + storybook)
pnpm test:run

# Run unit tests with coverage
pnpm test:coverage

# Open Vitest UI
pnpm test:ui
```

### Test Structure

- **Unit Tests**: `**/*.test.ts(x)` - Fast unit tests using happy-dom
- **Storybook Tests**: `**/*.stories.ts(x)` - Browser-based component tests

### Writing Tests

See `/src/test/README.md` for detailed testing guidelines and examples.

### Continuous Integration

All tests run automatically on pull requests via GitHub Actions:

- Linting
- Build verification
- Unit tests with coverage
- Storybook component tests

## Documentation

- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Documentation](https://crxjs.dev/vite-plugin)

## Chrome Extension Development Notes

- Use `manifest.config.ts` to configure your extension
- The CRXJS plugin automatically handles manifest generation
- Content scripts should be placed in `src/content/`
- Popup UI should be placed in `src/popup/`

TODO

- [x] Create error screen for no api key
- [x] prefill api key if already entered
- [x] give option to clear api key from storage
- [x] add logo
- [x] markdown rendering in messages
- [x] hint buttons for pattern & dsa
- [x] handle user navigating to new problem without reopening
- [x] user problem solving history data
  - [x] Use graphql to query for problem tags
  - [x] compact/map problem categories together
  - [x] implement some timing functionality
  - [] Review page to display user stats
- [x] testing with vitest and storybook
- [ ] voice input
- [ ] support for other LLM models
- [ ] cross browser support
- [ ] add ability for text box to grow vert
- [ ] only nav to bottom on user input, maybe push slightly up on ai input
- [ ] handle multiline input properly
- [ ] create a more user friendly response when hitting rate limits
- [ ]

Update 9/30/25: LeetCode has released their own version: Leet 🫡😭

up next:

- [ ] after submit reset internal timer?
- [ ] fix list rendering
- [ ] optimize token usage from hint buttons
-
