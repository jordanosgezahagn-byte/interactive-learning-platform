import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  resolve: {
    alias: {
      '@php-wasm/php-8-4-asyncify': fileURLToPath(new URL('./node_modules/@php-wasm/web-8-4/asyncify/php_8_4.js', import.meta.url)),
    },
  },
  assetsInclude: [/\.dat$/, /\.so$/, /\.la$/],
  optimizeDeps: {
    include: ['@php-wasm/universal'],
    exclude: ['@php-wasm/php-8-4-asyncify'],
  },
})
