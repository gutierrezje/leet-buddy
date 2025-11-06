import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'LeetBuddy',
  version: pkg.version,
  description:
    'AI-powered LeetCode interview prep assistant with guided problem-solving and progress tracking',
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  permissions: ['sidePanel', 'storage'],
  content_scripts: [
    {
      js: ['src/content/main.tsx'],
      matches: ['https://leetcode.com/*'],
    },
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
});
