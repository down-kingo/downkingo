/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "src/main.tsx",
        "bindings/**",
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — loaded on every page, small and stable
          "react-core": ["react", "react-dom"],
          // State & i18n — loaded on every page but separate from React for caching
          "state-vendor": ["zustand", "i18next", "react-i18next"],
          // Framer Motion — heavy (~66KB gzip), isolated so lazy pages don't pay upfront
          "motion-vendor": ["framer-motion"],
          // Icons — tree-shaken but still heavy, separate chunk for better caching
          "icons-vendor": ["@tabler/icons-react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // Remove console.log in production builds
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
