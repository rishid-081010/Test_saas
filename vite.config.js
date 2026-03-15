import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/webhook': {
        target: 'https://elevyx2x.app.n8n.cloud',
        changeOrigin: true,
      },
    },
  },
})
