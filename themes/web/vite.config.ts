import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://tvhome.local/ inside the app; relative paths keep it working from any folder.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "chrome90", assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
});
