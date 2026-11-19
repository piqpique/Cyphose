import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const build = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Cyphose',
        short_name: 'Cyphose',
        lang: 'fr',
        display: 'standalone',
        start_url: './',
        background_color: '#101314',
        theme_color: '#101314',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      // Polices de la charte comprises : l'app reste à la charte en mode avion.
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
    }),
  ],
});
