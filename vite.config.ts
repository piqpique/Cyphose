import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Cyphose',
        short_name: 'Cyphose',
        lang: 'fr',
        display: 'standalone',
        start_url: './',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [],
      },
    }),
  ],
});
