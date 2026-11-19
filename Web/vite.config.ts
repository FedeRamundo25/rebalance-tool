import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const buildRevision = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || 'local';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'rebalance-build-revision',
      transformIndexHtml(html) {
        return html.replace('</head>', `  <meta name="rebalance-build" content="${buildRevision}" />\n  </head>`);
      },
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
      '/auth': 'http://localhost:8788',
    },
  },
});
