import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://contract.test'),
    'import.meta.env.VITE_WS_URL': JSON.stringify('ws://contract.test/ws'),
  },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], restoreMocks: true },
});
