import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async () => {
  const plugins = [react(), runtimeErrorOverlay()];

  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    const [{ cartographer }, { devBanner }] = await Promise.all([
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);
    plugins.push(cartographer(), devBanner());
  }

  if (process.env.ANALYZE === "true") {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(
      visualizer({
        filename: "stats/bundle-report.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
      }),
    );
  }

  const rootDir = path.resolve(import.meta.dirname, "apps", "client");

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
    root: rootDir,
    base: process.env.PAGES_BUILD === "1" ? "/Adaptive-Stock-Trading/" : "/",
    build: {
      outDir: path.resolve(rootDir, "dist"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
