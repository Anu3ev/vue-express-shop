import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    license: { fileName: 'licenses.txt' },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5500',
      '/catalogData': 'http://127.0.0.1:5500',
    },
  },
  test: {
    include: ['test/cart.test.js', 'test/frontend.test.js'],
    environment: 'node',
  },
});
