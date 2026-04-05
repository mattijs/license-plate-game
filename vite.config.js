import { defineConfig } from 'vite'

export default defineConfig({
  base: '/license-plate-game/',
  server: {
    port: 7519,
    host: '0.0.0.0',
  },
  build: {
    target: 'es2022',
  },
  appType: 'spa',
})
