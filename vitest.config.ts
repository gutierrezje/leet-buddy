import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Shared base configuration (inherited by both projects)
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.*',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.stories.tsx', // Exclude stories from coverage
        '**/*.stories.ts',
        '**/*.stories.jsx',
        '**/*.stories.js',
      ],
    },
    // Define projects array inside test object
    projects: [
      // Project 1: Unit Tests
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['**/*.test.ts', '**/*.test.tsx'],
          exclude: ['**/*.stories.tsx', '**/*.stories.ts', 'node_modules/**'],
        },
      },
      // Project 2: Storybook Tests
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
