// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://bible-commentary-app.pages.dev', // Replace with actual production URL if different
  // Default static output
  output: 'static',
  server: {
    allowedHosts: ['dev.4thewordofgod.com']
  }
});