import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { App as AppInfo, bridge, iconUrl, Input, Net, onEvent, onTV } from "./bridge";
import { Config, DEFAULT_APPS, load, merge, save } from "./config";
import { t } from "./i18n";
import { Bluetooth, Gear, Hdmi, Picture, Play, Plus, Sound, Wifi } from "./icons";
import { focusFirst, setNavHook } from "./nav";
import { WALLPAPERS } from "./themes/backgrounds";
import { HomeContext } from "./themes/headers";
import { THEMES, themeByName } from "./themes";

const STORE = "com.android.vending";
const QUICK: [string, string, () => ReactNode][] = [
  ["bluetooth", "Bluetooth", () => <Bluetooth />], ["sound", "Sound", () => <Sound />], ["picture", "Picture", () => <Picture />],
];

// Anything you can land on with the remote. "activate" is a short OK, "longpress" a held one (nav.ts).
function Focusable(p: {
  k: string; className?: string; first?: boolean; children?: ReactNode; style?: React.CSSProperties;
  onActivate?: () => void; onLongPress?: () => void; onFocus?: () => void; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(p);
  cb.current = p;
  useEffect(() => {
    const el = ref.current!;
    const a = () => cb.current.onActivate?.(), l = () => cb.current.onLongPress?.();
    el.addEventListener("activate", a);
    el.addEventListener("longpress", l);
    return () => { el.removeEventListener("activate", a); el.removeEventListener("longpress", l); };
  }, []);
  return (
    <div ref={ref} tabIndex={0} data-nav="" data-key={p.k} data-nav-first={p.first ? "" : undefined} aria-label={p.label}
      className={p.className} style={p.style} onClick={() => p.onActivate?.()} onFocus={p.onFocus}
      onContextMenu={(e) => { e.preventDefault(); p.onLongPress?.(); }}>
      {p.children}
    </div>
  );
}

function Tile({ k, label, banner, icon, first, moving, onActivate, onLongPress }: {
  k: string; label: string; banner?: string; icon?: ReactNode; first?: boolean; moving?: boolean;
  onActivate: () => void; onLongPress?: () => void;
}) {
  return (
    <div className="cell">
      <Focusable k={k} first={first} label={label} onActivate={onActivate} onLongPress={onLongPress}
        className={`tile ${banner ? "banner" : "glass"} ${moving ? "moving" : ""}`}>
        {banner ? <img src={banner} alt="" /> : <div className="glass-in">{icon}<span>{label}</span></div>}
      </Focusable>
      {banner && <div className="caption">{label}</div>}
    </div>
  );
}

type Item = { label: string; swatch?: string; icon?: string; check?: boolean; note?: string; disabled?: boolean; run: () => void };
type Menu =
  | { kind: "dropdown"; anchor: string; items: Item[] }
  | { kind: "panel"; title: string; items: Item[]; start?: number; preview?: (i: number) => void; cancel?: () => void };

function Dropdown({ menu, scale }: { menu: Extract<Menu, { kind: "dropdown" }>; scale: number }) {
  const el = document.querySelector<HTMLElement>(`[data-key="${CSS.escape(menu.anchor)}"]`);
  const r = el?.getBoundingClientRect();
  const left = r ? r.left / scale : 96, below = r ? r.bottom / scale + 56 : 600;
  const h = menu.items.length * 68 + 20;
  const top = below + h > 1060 ? (r ? r.top / scale : 600) - h - 16 : below;
  return (
    <div className="dropdown" data-nav-scope="" style={{ left, top, minWidth: Math.max(320, r ? r.width / scale : 0) }}>
      {menu.items.map((it, i) => (
        <Focusable key={i} k={`dd${i}`} first={i === 0} className="dd-item" onActivate={it.run}>
          {it.label}{it.check !== undefined && <span className="check">{it.check ? t("On") : t("Off")}</span>}
        </Focusable>
      ))}
    </div>
  );
}

function Panel({ menu }: { menu: Extract<Menu, { kind: "panel" }> }) {
  return (
    <div className={`panel-wrap ${menu.preview ? "previewing" : ""}`}>
      <div className="side-panel" data-nav-scope="">
        <h2>{menu.title}</h2>
        <div className="list">
          {menu.items.map((it, i) => {
            const inner = <>
              {it.swatch && <span className="swatch" style={{ background: it.swatch }} />}
              {it.icon !== undefined && <img className="p-icon" src={it.icon} alt="" />}
              <span className="p-label">{it.label}</span>
              {it.note && <span className="p-note">{it.note}</span>}
            </>;
            // Not ready yet: listed, but the remote skips it.
            if (it.disabled) return <div key={i} className="p-item disabled">{inner}</div>;
            return (
              <Focusable key={i} k={`p${i}`} first={i === (menu.start ?? 0)} className="p-item" onActivate={it.run}
                onFocus={() => menu.preview?.(i)}>{inner}</Focusable>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [config, setConfig] = useState<Config>(() => merge(load(), bridge.config()));
  const [apps, setApps] = useState<AppInfo[]>(() => bridge.apps());
  const [inputs, setInputs] = useState<Input[]>(() => bridge.inputs());
  const [net, setNet] = useState<Net>(() => bridge.network());
  const [menu, setMenu] = useState<Menu | null>(null);
  const [preview, setPreview] = useState<{ theme?: string; wallpaper?: number } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  // The page is 1920x1080, scaled to fit (on a TV that's the whole screen; in a browser, the window).
  const fit = () => Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const [scale, setScale] = useState(fit);
  const lastFocus = useRef<string | null>(null);

  // Left alone, the screen clears to just the photos (themes with a slideshow). The first key only
  // brings everything back; it doesn't move or open anything.
  const IDLE_MS = 20000;
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  idleRef.current = idle;
  useEffect(() => {
    let timer = 0;
    const arm = () => { clearTimeout(timer); timer = window.setTimeout(() => setIdle(true), IDLE_MS); };
    // The preview's review keys ([ ] d e) work on the photos and leave the screen as it is.
    const DEBUG = ["[", "]", "d", "e"];
    const wake = (e: Event) => {
      if (!onTV && e instanceof KeyboardEvent && DEBUG.includes(e.key) && !(e.target instanceof HTMLInputElement)) return;
      if (idleRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIdle(false);
      }
      arm();
    };
    const keys = ["keydown", "keyup"];
    keys.forEach((k) => window.addEventListener(k, wake, true)); // capture: before nav.ts sees it
    window.addEventListener("mousemove", arm);
    const offEvent = onEvent((name) => {
      if (name === "back" || name === "menu" || name === "resume") { setIdle(false); arm(); }
    });
    arm();
    return () => { clearTimeout(timer); keys.forEach((k) => window.removeEventListener(k, wake, true)); window.removeEventListener("mousemove", arm); offEvent(); };
  }, []);

  useEffect(() => save(config), [config]);
  useEffect(() => {
    const r = () => setScale(fit());
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  const theme = themeByName(preview?.theme ?? config.theme);
  const wallpaper = preview?.wallpaper ?? config.wallpaper;
  const perRow = theme.perRow ?? 6;
  const byPkg = useMemo(() => new Map(apps.map((a) => [a.pkg, a])), [apps]);

  // The top rows: your list, or the default one topped up with TV apps you installed.
  const row = useMemo(() => {
    if (config.apps) return config.apps.filter((p) => byPkg.has(p));
    const out = DEFAULT_APPS.filter((p) => byPkg.has(p));
    for (const a of apps) {
      if (out.length >= perRow) break;
      if (a.tv && a.user && a.pkg !== STORE && !out.includes(a.pkg)) out.push(a.pkg);
    }
    return out;
  }, [config.apps, apps, byPkg, perRow]);

  const update = (c: Partial<Config>) => setConfig((x) => ({ ...x, ...c }));
  const saveRow = (r: string[]) => update({ apps: r });

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const el = lastFocus.current && document.querySelector<HTMLElement>(`[data-key="${CSS.escape(lastFocus.current)}"]`);
      if (el) el.focus({ preventScroll: true }); else focusFirst();
    });
  }, []);
  const open = (m: Menu) => {
    lastFocus.current = (document.activeElement as HTMLElement | null)?.dataset.key ?? lastFocus.current;
    setMenu(m);
  };
  const close = () => { setMenu(null); setPreview(null); restoreFocus(); };

  // Native events: apps installed or removed, network, Back and Menu keys, settings from adb.
  useEffect(() => onEvent((name) => {
    if (name === "apps") setApps(bridge.apps());
    else if (name === "network") setNet(bridge.network());
    else if (name === "resume") { setApps(bridge.apps()); setInputs(bridge.inputs()); setNet(bridge.network()); window.dispatchEvent(new Event("tvhome-resume")); }
    else if (name === "config") setConfig((c) => merge(c, bridge.config()));
    else if (name === "back") {
      if (moving) { setMoving(null); return; }
      if (menu) { if (menu.kind === "panel") menu.cancel?.(); close(); }
    } else if (name === "menu") {
      const k = (document.activeElement as HTMLElement | null)?.dataset.key;
      if (k && row.includes(k) && !menu) editMenu(k);
    }
  }));

  // First focus, and again whenever a menu opens or closes.
  useLayoutEffect(() => { if (menu) requestAnimationFrame(focusFirst); }, [menu]);
  useEffect(() => { requestAnimationFrame(() => { if (!document.activeElement || document.activeElement === document.body) focusFirst(); }); }, [theme.id]);

  // Move mode: the arrows move the app through the grid; OK or Back puts it down.
  useEffect(() => {
    if (!moving) return setNavHook(null);
    setNavHook((dir) => {
      const from = row.indexOf(moving);
      const step = dir === "left" ? -1 : dir === "right" ? 1 : dir === "up" ? -perRow : perRow;
      const to = from + step;
      if (from >= 0 && to >= 0 && to < row.length) {
        const r = [...row];
        r.splice(to, 0, r.splice(from, 1)[0]);
        saveRow(r);
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-key="${CSS.escape(moving)}"]`)?.focus());
      }
      return true;
    });
    return () => setNavHook(null);
  }, [moving, row, perRow]); // eslint-disable-line react-hooks/exhaustive-deps

  function editMenu(pkg: string) {
    const a = byPkg.get(pkg);
    const index = row.indexOf(pkg);
    open({
      kind: "dropdown", anchor: pkg, items: [
        { label: t("Move"), run: () => { setMenu(null); setMoving(pkg); restoreFocus(); } },
        { label: t("Replace"), run: () => addMenu(index) },
        { label: t("Remove from home"), run: () => { saveRow(row.filter((p) => p !== pkg)); close(); } },
        a?.user ? { label: t("Uninstall"), run: () => { close(); bridge.uninstall(pkg); } }
          : { label: t("App info"), run: () => { close(); bridge.appInfo(pkg); } },
      ],
    });
  }

  function addMenu(replace = -1) {
    const rest = apps.filter((a) => !row.includes(a.pkg));
    if (!rest.length) return open({ kind: "panel", title: t("Every app is already here"), items: [] });
    setMenu({
      kind: "panel", title: replace >= 0 ? `${t("Replace")} ${byPkg.get(row[replace])?.label ?? ""}` : t("Add an app"),
      items: rest.map((a) => ({
        label: a.label, icon: iconUrl(a.pkg, false),
        run: () => {
          const r = [...row];
          if (replace >= 0) r[replace] = a.pkg; else r.push(a.pkg);
          saveRow(r);
          lastFocus.current = a.pkg;
          close();
        },
      })),
    });
  }

  function settingsMenu() {
    const items: Item[] = [{
      label: t("Theme"), run: () => setMenu({
        kind: "panel", title: t("Theme"), start: THEMES.findIndex((x) => x.name === config.theme),
        items: THEMES.map((x) => ({ label: x.name, swatch: x.swatch, disabled: !x.ready, note: x.ready ? undefined : t("coming soon"),
          run: () => { update({ theme: x.name }); close(); } })),
        preview: (i) => setPreview({ theme: THEMES[i].name }), cancel: () => setPreview(null),
      }),
    }];
    if (theme.id === "clasico")
      items.push({
        label: t("Wallpaper"), run: () => setMenu({
          kind: "panel", title: t("Wallpaper"), start: config.wallpaper,
          items: WALLPAPERS.map(([name, c], i) => ({ label: name, swatch: `linear-gradient(135deg,${c[3]},${c[1]},${c[4]})`, run: () => { update({ wallpaper: i }); close(); } })),
          preview: (i) => setPreview({ wallpaper: i }), cancel: () => setPreview(null),
        }),
      });
    items.push({
      label: t("Shortcuts"), run: () => setMenu({
        kind: "panel", title: t("Shortcuts"),
        items: QUICK.map(([k, label]) => ({
          label: `${t(label)}: ${config.quick.includes(k) ? t("On") : t("Off")}`,
          run: () => { update({ quick: config.quick.includes(k) ? config.quick.filter((q) => q !== k) : [...config.quick, k] }); close(); },
        })),
      }),
    });
    items.push({ label: t("TV settings"), run: () => { close(); bridge.settings("tv"); } });
    open({ kind: "dropdown", anchor: "settings", items });
  }

  // Geometry, at 1920x1080.
  const tileW = (1728 - 36 * (perRow - 1)) / perRow, tileH = (tileW * 9) / 16, rowStep = tileH + 78;
  const rows = Math.max(1, Math.ceil(row.length / perRow));
  const baseTop = theme.gridTop ?? 600;
  const gridTop = Math.max(baseTop === 600 ? 400 : baseTop, baseTop - (rows - 1) * rowStep);
  const store = byPkg.has(STORE) && !row.includes(STORE);
  const bottom: ReactNode[] = [];
  if (store) bottom.push(<Tile key="store" k={STORE} label="Play Store" icon={<Play />} onActivate={() => bridge.open(STORE)} />);
  for (const i of inputs.slice(0, perRow - 2 - (store ? 1 : 0)))
    bottom.push(<Tile key={i.id} k={i.id} label={i.label} icon={<Hdmi />} onActivate={() => bridge.openInput(i.id)} />);
  bottom.push(<Tile key="settings" k="settings" label={t("Settings")} icon={<Gear />} onActivate={settingsMenu} />);
  bottom.push(<Tile key="add" k="add" label={t("Add app")} icon={<Plus />} onActivate={() => addMenu()} />);

  const home = useMemo(() => ({
    apps, open: bridge.open, themes: THEMES.map((x) => x.name),
    setTheme: (name: string) => { update({ theme: name }); setPreview(null); },
  }), [apps]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HomeContext.Provider value={home}>
      <div className={`stage theme-${theme.id} ${idle && !menu && !moving ? "idle" : ""}`} style={{ transform: `translate(${(window.innerWidth - 1920 * scale) / 2}px, ${(window.innerHeight - 1080 * scale) / 2}px) scale(${scale})`, ["--per-row" as string]: perRow }}>
        <div className="backdrop" key={theme.id + (theme.id === "clasico" ? wallpaper : "")}>{theme.background(wallpaper)}</div>
        <div className="page">
          <div className="header" key={theme.id}>{theme.header}</div>
          <div className="top-icons">
            {QUICK.filter(([k]) => config.quick.includes(k)).map(([k, label, icon]) => (
              <Focusable key={k} k={`quick:${k}`} label={t(label)} className="icon-btn" onActivate={() => bridge.settings(k as "sound")}>{icon()}</Focusable>
            ))}
            <Focusable k="network" label={t("Network")} className="icon-btn" onActivate={() => bridge.settings("network")}>
              <Wifi type={net.type} bars={net.bars} />
            </Focusable>
          </div>
          {moving && <div className="move-hint" style={{ top: gridTop - 64 }}>{t("Use the arrows to move it, then press OK")}</div>}
          <div className="grid" style={{ marginTop: gridTop, gridTemplateColumns: `repeat(${perRow}, ${tileW}px)`, rowGap: rowStep - tileH }}>
            {row.map((pkg, i) => {
              const a = byPkg.get(pkg)!;
              return (
                <Tile key={pkg} k={pkg} first={i === 0} label={a.label} moving={moving === pkg}
                  banner={a.banner ? iconUrl(pkg, true) || undefined : undefined}
                  icon={a.banner ? undefined : <img className="app-icon" src={iconUrl(pkg, false)} alt="" />}
                  onActivate={() => (moving ? setMoving(null) : bridge.open(pkg))} onLongPress={() => editMenu(pkg)} />
              );
            })}
          </div>
          <div className="grid bottom" style={{ gridTemplateColumns: `repeat(${perRow}, ${tileW}px)` }}>{bottom}</div>
        </div>
        {menu?.kind === "dropdown" && <Dropdown menu={menu} scale={scale} />}
        {menu?.kind === "panel" && <Panel menu={menu} />}
      </div>
    </HomeContext.Provider>
  );
}
