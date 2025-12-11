import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-onboarding",
    "@storybook/addon-docs"
  ],
  "framework": "@storybook/react-vite",
  async viteFinal(config) {
    // Remove @crxjs/vite-plugin to prevent conflicts with Storybook HMR
    if (config.plugins) {
      config.plugins = config.plugins.filter(
        (plugin) => {
          if (plugin && typeof plugin === 'object' && 'name' in plugin) {
            return plugin.name !== 'crx';
          }
          return true;
        }
      );
    }
    return config;
  },
};
export default config;