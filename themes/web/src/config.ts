// What the home screen remembers, kept in the WebView's localStorage. install.sh (and adb) can set
// it too, with am start --es apps "pkg1,pkg2" / --es theme River / --es quick "bluetooth,sound".

export type Config = {
  apps: string[] | null; // the top rows, in order; null: the default list topped up with your TV apps
  theme: string;
  wallpaper: number; // Clásico only
  quick: string[]; // settings shortcuts by the clock: bluetooth, sound, picture
  stamp?: string; // the last settings applied from adb, so a replayed start doesn't undo later changes
};

// The theme a fresh install starts with (River TV sets this to "River").
export const DEFAULT_THEME = "Clásico";

// Same as apps.txt in the original: the first apps, if they're installed.
export const DEFAULT_APPS = [
  "com.google.android.youtube.tv", "com.netflix.ninja", "com.amazon.amazonvideo.livingroom",
  "com.disney.disneyplus", "com.hulu.livingroomplus", "com.wbd.stream",
];

const KEY = "tvhome";

export function load(): Config {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { apps: c.apps ?? null, theme: c.theme ?? DEFAULT_THEME, wallpaper: c.wallpaper ?? 0, quick: c.quick ?? [], stamp: c.stamp };
  } catch {
    return { apps: null, theme: DEFAULT_THEME, wallpaper: 0, quick: [] };
  }
}

export function save(c: Config) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode: keep it for this session */ }
}

// Settings passed from adb, applied once (the stamp stops a replayed start from applying them again).
export function merge(c: Config, extra: Record<string, string> | null): Config {
  if (!extra || (extra.stamp && extra.stamp === c.stamp)) return c;
  const n = { ...c, stamp: extra.stamp ?? c.stamp };
  const list = (s: string) => s.replace(/"/g, "").split(/[,\s]+/).filter(Boolean);
  if (extra.apps !== undefined) n.apps = !extra.apps || extra.apps === "auto" ? null : list(extra.apps);
  if (extra.quick !== undefined) n.quick = extra.quick === "none" ? [] : list(extra.quick);
  if (extra.theme) n.theme = extra.theme;
  if (extra.wallpaper) n.wallpaper = Number(extra.wallpaper) || 0;
  return n;
}
