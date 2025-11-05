import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@wagmi/core', 'viem'],
          appkit: ['@reown/appkit', '@reown/appkit-adapter-wagmi'],
          farcaster: ['@farcaster/miniapp-sdk', '@farcaster/miniapp-wagmi-connector'],
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
