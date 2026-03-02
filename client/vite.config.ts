import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import firefoxManifest from "./manifest.firefox.json";

const targetBrowser = process.env.TARGET_BROWSER || "chrome";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    crx({
      manifest: targetBrowser === "firefox" ? firefoxManifest : manifest,
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, "src/dashboard/index.html"),
        blocked: resolve(__dirname, "src/blocked/index.html"),
      },
    },
  },
});
