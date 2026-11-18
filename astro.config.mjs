// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

const SITE = 'https://vozcaballa.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  adapter: cloudflare(),
});