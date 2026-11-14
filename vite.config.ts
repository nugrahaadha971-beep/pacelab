import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages: ganti sesuai nama repositori (mis. '/pacelab/')
  base: '/pacelab/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // memakai public/manifest.json
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,json}'] },
    }),
  ],
});
