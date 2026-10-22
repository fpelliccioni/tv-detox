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
    // Moves a photo out of the slideshow (POST /mock/move?path=river/x.jpg&to=descartadas): into
    // descartadas/ (thrown out) or mejorar/ (to be improved, then put back) next to it.
    server.middlewares.use("/mock/move", (req, res) => {
      const params = new URL(req.url ?? "", "http://x").searchParams;
      const rel = params.get("path") ?? "", to = params.get("to") ?? "";
      if (to !== "descartadas" && to !== "mejorar") {
        res.statusCode = 400;
        return res.end("bad folder");
      }
      const base = join(server.config.publicDir, "mock/photo");
      if (req.method !== "POST" || !/^([\w.-]+\/)?[\w.-]+\.(jpe?g|png|webp)$/i.test(rel) || rel.includes("..")) {
        res.statusCode = 400;
        return res.end("bad request");
      }
      const file = realpathSync(join(base, rel));
      const dest = join(dirname(file), to);
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
