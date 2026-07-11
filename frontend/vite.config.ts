/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        codeSplitting: {
          groups: [
            { name: "react-core", test: /node_modules[\\/]react(?:-dom)?[\\/]/ },
            {
              name: "state-vendor",
              test: /node_modules[\\/](?:zustand|i18next|react-i18next)[\\/]/,
            },
            { name: "motion-vendor", test: /node_modules[\\/]framer-motion[\\/]/ },
            {
              name: "icons-vendor",
              test: /node_modules[\\/]@tabler[\\/]icons-react[\\/]/,
            },
          ],
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
