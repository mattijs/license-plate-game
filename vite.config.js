import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 7519,
    host: '0.0.0.0',
  },
  appType: 'spa',
})
