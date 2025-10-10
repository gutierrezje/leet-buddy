# LeetBuddy

An extension that allows you to have a convenient way to practice your technical interviews.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open Chrome and navigate to `chrome://extensions/`, enable "Developer mode", and load the unpacked extension from the `dist` directory.

4. Build for production:

```bash
npm run build
```

## Project Structure

- `src/popup/` - Extension popup UI
- `src/content/` - Content scripts
- `manifest.config.ts` - Chrome extension manifest configuration

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
- [ ] user problem solving history data
  - [x] Use graphql to query for problem tags
  - [x] compact/map problem categories together
  - [x] implement some timing functionality
  - [] Review page to display user stats
- [ ] support for other LLM models
- [ ] persist chat history
- [ ] handle case of user tokens running out
- [ ] handle gating on premium problems if necessary

Update 9/30/25: LeetCode has released their own version: Leet 🫡😭

up next:

- figure out review stats to track
- review stats styling
- have timer auto start on open
- prompt submit on lc submission automatically
-
