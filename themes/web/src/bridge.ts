// The native side (android/…/MainActivity.java, window.Android). In a desktop browser, a stand-in
// with a few made-up apps, so the page can be designed with `npm run dev`.

export type App = { pkg: string; label: string; banner: boolean; user: boolean; tv: boolean };
export type Input = { id: string; label: string };
export type Net = { type: "wifi" | "ethernet" | "offline"; bars?: number };
export type Device = { model: string; device: string; android: string; sdk: number; cpu: string; ramUsed: number; ramTotal: number; uptime: number };

type Native = {
  apps(): string; config(): string | null; open(pkg: string): void; settings(which: string): void;
  uninstall(pkg: string): void; appInfo(pkg: string): void; inputs(): string; openInput(id: string): void;
  network(): string; photos(folder: string): string; device(): string;
};

const native = (window as unknown as { Android?: Native }).Android;
export const onTV = !!native;

// The preview uses a copy of a real TV's apps when there is one (public/mock, made from the TV and
// never committed), else these few.
let mock: { apps: App[]; inputs: Input[]; config?: Record<string, string> } | null = null;
export async function loadMock() {
  try { const r = await fetch("./mock/apps.json"); if (r.ok) mock = await r.json(); } catch { /* no copy: the made-up apps */ }
}

const fake: App[] = [
  ["com.google.android.youtube.tv", "YouTube"], ["com.netflix.ninja", "Netflix"],
  ["com.amazon.amazonvideo.livingroom", "Prime Video"], ["com.wbd.stream", "Max"],
  ["com.disney.disneyplus", "Disney+"], ["org.smarttube.stable", "SmartTube"], ["com.spotify.tv.android", "Spotify"],
].map(([pkg, label]) => ({ pkg, label, banner: false, user: true, tv: true }));

const log = (...a: unknown[]) => console.log("[bridge]", ...a);

export const bridge = {
  apps: (): App[] => (native ? JSON.parse(native.apps()) : mock?.apps ?? fake),
  config: (): Record<string, string> | null => {
    if (!native) { const c = mock?.config ?? null; if (mock) mock.config = undefined; return c; }
    const c = native.config();
    return c ? JSON.parse(c) : null;
  },
  open: (pkg: string) => (native ? native.open(pkg) : log("open", pkg)),
  settings: (which: "tv" | "network" | "bluetooth" | "sound" | "picture") => (native ? native.settings(which) : log("settings", which)),
  uninstall: (pkg: string) => (native ? native.uninstall(pkg) : log("uninstall", pkg)),
  appInfo: (pkg: string) => (native ? native.appInfo(pkg) : log("appInfo", pkg)),
  inputs: (): Input[] => (native ? JSON.parse(native.inputs()) : mock?.inputs ?? [{ id: "hdmi1", label: "HDMI 1" }]),
  openInput: (id: string) => (native ? native.openInput(id) : log("input", id)),
  network: (): Net => (native ? JSON.parse(native.network()) : { type: "wifi", bars: 3 }),
  photos: (folder: string): string[] => (native ? JSON.parse(native.photos(folder)) : []),
  device: (): Device =>
    native ? JSON.parse(native.device())
      : { model: "Browser", device: "dev", android: "-", sdk: 0, cpu: navigator.platform, ramUsed: 0, ramTotal: 0, uptime: performance.now() },
};

// Icons and photos are served by the app at https://tvhome.local/.
export const iconUrl = (pkg: string, banner: boolean) =>
  native ? `/icon/${pkg}${banner ? "?banner=1" : ""}` : mock ? `./mock/icons/${pkg}${banner ? ".banner" : ""}.png` : "";
export const photoUrl = (path: string) => `/photo/${path}`;

// Events from the native side: apps changed, network changed, back/menu keys, resume/pause, settings from adb.
type Handler = (name: string) => void;
const handlers = new Set<Handler>();
(window as unknown as { tvhomeEvent: Handler }).tvhomeEvent = (name) => handlers.forEach((h) => h(name));
export function onEvent(h: Handler) {
  handlers.add(h);
  return () => void handlers.delete(h);
}
// In a browser, Escape stands in for the remote's Back key and "m" for Menu.
if (!native)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") handlers.forEach((h) => h("back"));
    if (e.key === "m" && !(e.target instanceof HTMLInputElement)) handlers.forEach((h) => h("menu"));
  });
