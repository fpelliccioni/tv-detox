import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// Browser preview: lists the photos in public/mock/photo/<folder> (e.g. a link to your own photo
// folder), the way the TV app lists /sdcard/TVHome/<folder>.
const mockPhotos = (): Plugin => ({
  name: "mock-photos",
  configureServer(server) {
    server.middlewares.use("/mock/photos.json", (_req, res) => {
      const base = join(server.config.publicDir, "mock/photo"), out: Record<string, string[]> = {};
      const list = (dir: string) => {
        try { return readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && statSync(join(dir, f)).isFile()).sort(); } catch { return []; }
      };
      out[""] = list(base);
      for (const d of (() => { try { return readdirSync(base); } catch { return []; } })())
        if (statSync(join(base, d)).isDirectory()) out[d] = list(join(base, d));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(out));
    });
    // Discards a photo (POST /mock/discard?path=river/x.jpg): moves it to descartadas/ next to it.
    server.middlewares.use("/mock/discard", (req, res) => {
      const rel = new URL(req.url ?? "", "http://x").searchParams.get("path") ?? "";
      const base = join(server.config.publicDir, "mock/photo");
      if (req.method !== "POST" || !/^([\w.-]+\/)?[\w.-]+\.(jpe?g|png|webp)$/i.test(rel) || rel.includes("..")) {
        res.statusCode = 400;
        return res.end("bad request");
      }
      const file = realpathSync(join(base, rel));
      const dest = join(dirname(file), "descartadas");
      if (!existsSync(dest)) mkdirSync(dest);
      renameSync(file, join(dest, basename(file)));
      res.end("ok");
    });
  },
});

// Served from https://tvhome.local/ inside the app; relative paths keep it working from any folder.
export default defineConfig({
  base: "./",
  plugins: [react(), mockPhotos()],
  build: { target: "chrome90", assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
});
