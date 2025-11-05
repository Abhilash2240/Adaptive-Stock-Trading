import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps", "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "packages", "shared", "src"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "apps", "client"),
  base: process.env.PAGES_BUILD === "1" ? "/Adaptive-Stock-Trading/" : "/",
  build: {
    outDir:
      process.env.PAGES_BUILD === "1"
        ? path.resolve(import.meta.dirname, "apps", "client", "dist")
        : path.resolve(import.meta.dirname, "apps", "server", "dist", "public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // Increase limit to 1000 KB for large UI libraries
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
