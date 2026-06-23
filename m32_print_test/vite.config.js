import { defineConfig } from 'vite';

// m32_print_test — 纯静态前端测试工具
export default defineConfig({
  server: {
    port: 5320,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
