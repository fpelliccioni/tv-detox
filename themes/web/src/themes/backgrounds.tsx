import { useEffect, useRef, useState } from "react";
import { bridge, onTV, photoUrl } from "../bridge";
import leon from "../assets/river/leon-clasico.svg";

// Backgrounds are drawn at 1920x1080 and scaled with the page.

// Classic's wallpapers, the same 14 as the original: a gradient top to bottom, a glow from the top
// left and one from the bottom right.
export const WALLPAPERS: [string, string[]][] = [
  ["Dusk", ["#15100F", "#0A0809", "#050405", "rgba(255,128,72,.21)", "rgba(170,60,140,.18)"]],
  ["Midnight", ["#0E1220", "#080A13", "#040509", "rgba(74,108,255,.22)", "rgba(90,60,200,.18)"]],
  ["Plum", ["#170E19", "#0C070D", "#050306", "rgba(192,80,180,.22)", "rgba(100,64,210,.18)"]],
  ["Forest", ["#0C150F", "#070C09", "#030604", "rgba(80,180,120,.19)", "rgba(40,150,130,.16)"]],
  ["Graphite", ["#151617", "#0B0C0D", "#050506", "rgba(255,255,255,.11)", "rgba(160,180,200,.09)"]],
  ["Ocean", ["#0A1517", "#060C0E", "#030607", "rgba(38,180,200,.2)", "rgba(42,100,192,.18)"]],
  ["Ember", ["#190D08", "#0D0605", "#060303", "rgba(255,90,36,.25)", "rgba(200,40,60,.2)"]],
  ["Sunset", ["#8C3A5E", "#5E2348", "#22101E", "rgba(255,138,76,.63)", "rgba(224,69,122,.5)"]],
  ["Lagoon", ["#14588E", "#15366E", "#0A1632", "rgba(48,200,224,.56)", "rgba(122,76,224,.5)"]],
  ["Aurora", ["#0F4048", "#0F2E3A", "#08141C", "rgba(56,224,160,.56)", "rgba(160,80,240,.56)"]],
  ["Coral", ["#C0604E", "#8A3456", "#2E1230", "rgba(255,176,112,.56)", "rgba(224,64,144,.44)"]],
  ["Iris", ["#5A3CAE", "#3A2A84", "#16123A", "rgba(192,128,255,.56)", "rgba(74,124,255,.5)"]],
  ["Meadow", ["#2E6E4C", "#1C4A40", "#0A201E", "rgba(168,224,112,.56)", "rgba(48,168,168,.38)"]],
  ["Gold", ["#B07624", "#86401E", "#2A1410", "rgba(255,208,96,.56)", "rgba(255,80,64,.44)"]],
];

export function gradient([a, b, c, glow1, glow2]: string[]) {
  return `radial-gradient(1250px at 8% -12%, ${glow1}, transparent 70%),` +
    `radial-gradient(1000px at 100% 110%, ${glow2}, transparent 70%), linear-gradient(${a}, ${b}, ${c})`;
}

export const Wallpaper = ({ index }: { index: number }) => (
  <div className="bg" style={{ background: gradient((WALLPAPERS[index] ?? WALLPAPERS[0])[1]) }} />
);

// One photo (Foto), or folders going by every 12 seconds in random order, crossfading (River). Darker at the bottom, so the apps stay readable. Nothing shows without photos.
export function Photos({ folders, every = 12000, fallback }: { folders: string[]; every?: number; fallback?: string }) {
  const [list, setList] = useState(() => {
    if (!folders.length) return bridge.photos("").filter((n) => /^fondo\./i.test(n));
    // Browser preview: ?solo=lbdt shows only that folder, to review it.
    const solo = !onTV && new URLSearchParams(location.search).get("solo");
    if (solo) folders = [solo];
    // Every photo from every folder, shuffled (a new order each time the home screen starts).
    const out = folders.flatMap((f) => bridge.photos(f).map((n) => `${f}/${n}`));
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  });
  const [i, setI] = useState(0);
  // Photos that aren't wide enough to fill the screen (by name), learned as they load.
  const [whole, setWhole] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), every);
    return () => clearInterval(id);
  }, [list, every, i]); // a manual step restarts the 12 seconds
  // Browser preview: [ and ] step through the photos, to review them.
  useEffect(() => {
    if (onTV) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "]") setI((n) => (n + 1) % list.length);
      if (e.key === "[") setI((n) => (n - 1 + list.length) % list.length);
      // d: discard this photo, e: set it aside to be improved. Either way it leaves the slideshow
      // (moved on the computer to descartadas/ or mejorar/) and the next one shows.
      const to = e.key === "d" ? "descartadas" : e.key === "e" ? "mejorar" : null;
      if (to && list.length) {
        const gone = list[i];
        fetch(`./mock/move?path=${encodeURIComponent(gone)}&to=${to}`, { method: "POST" }).then((r) => {
          if (!r.ok) return;
          setList((l) => l.filter((p) => p !== gone));
          setI((n) => (list.length > 1 ? n % (list.length - 1) : 0));
        });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [list, i]);
  if (!list.length) return fallback ? <div className="bg" style={{ background: fallback }} /> : null;
  return (
    <div className="bg photos">
      {list.map((p, n) => (
        // Photos far from 16:9 (square, portrait) are shown whole, over a blurred copy of themselves,
        // instead of being cropped to fill the screen.
        <div key={p} className={`photo ${n === i ? "on" : ""} ${whole[p] ? "whole" : ""}`}>
          {Math.abs(n - i) <= 1 && <>
            <img className="fill" src={photoUrl(p)} alt="" />
            <img className="main" src={photoUrl(p)} alt=""
              onLoad={(e) => { const im = e.currentTarget; const w = im.naturalWidth / im.naturalHeight < 1.45;
                if (w !== !!whole[p]) setWhole((x) => ({ ...x, [p]: w })); }} />
          </>}
        </div>
      ))}
      <div className="shade" />
      {!onTV && <div className="photo-name">{i + 1}/{list.length} · {list[i]}</div>}
    </div>
  );
}

// River's shirt: the red sash from the left shoulder to the right hip (seen from the front: top
// right to bottom left), at 59.88 degrees like the club's 2022 identity, wide, edged in white.
const SASH_ANGLE = 59.88, SASH_TOP = 1180, SASH_WIDTH = 560; // where it starts on the top edge, and how wide it is across
const run = 1080 / Math.tan((SASH_ANGLE * Math.PI) / 180); // how far left it goes from top to bottom
const sash = `${SASH_TOP},0 ${SASH_TOP + SASH_WIDTH},0 ${SASH_TOP + SASH_WIDTH - run},1080 ${SASH_TOP - run},1080`;
export const Sash = () => (
  <svg className="bg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sashShade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff2a3a" />
        <stop offset="1" stopColor="#b8000f" />
      </linearGradient>
    </defs>
    <polygon points={sash} fill="url(#sashShade)" opacity=".93" />
    <polygon points={sash} fill="none" stroke="#fff" strokeWidth="10" opacity=".85" />
  </svg>
);

// River's badge: the classic lion, top right across from the clock. Left alone, it stays on as a
// small corner mark over the photos, like a TV channel's logo. (The 14 is in assets, unused for now.)
export const RiverBadges = () => (
  <div className="bg river-badges">
    <img className="river-leon" src={leon} alt="" />
  </div>
);

// A mowed pitch at night: bands, the halfway line, the centre circle.
export const Pitch = () => (
  <svg className="bg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1f6b3b" /><stop offset=".6" stopColor="#134a28" /><stop offset="1" stopColor="#082414" />
      </linearGradient>
      <radialGradient id="flood" cx=".1" cy="-.1" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#grass)" />
    {Array.from({ length: 6 }, (_, i) => <rect key={i} x={i * 320} width="160" height="1080" fill="#fff" opacity=".05" />)}
    <g fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="5">
      <line x1="960" y1="0" x2="960" y2="1080" /><circle cx="960" cy="540" r="185" /><circle cx="960" cy="540" r="6" fill="#fff" />
      <rect x="-5" y="300" width="250" height="480" /><rect x="1675" y="300" width="250" height="480" />
    </g>
    <rect width="1920" height="1080" fill="url(#flood)" />
  </svg>
);

// 80s synthwave: a striped sun on the horizon and a grid scrolling towards you.
export const Synthwave = () => (
  <div className="bg synth">
    <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a0630" /><stop offset=".6" stopColor="#3b0b4f" /><stop offset="1" stopColor="#6b1460" /></linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe14d" /><stop offset=".55" stopColor="#ff8a3d" /><stop offset="1" stopColor="#ff2e97" /></linearGradient>
        <mask id="cuts"><rect width="1920" height="1080" fill="#fff" />{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="0" y={470 + i * 26} width="1920" height={4 + i * 3} fill="#000" />)}</mask>
      </defs>
      <rect width="1920" height="600" fill="url(#sky)" />
      <circle cx="1380" cy="600" r="290" fill="url(#sun)" mask="url(#cuts)" />
    </svg>
    <div className="synth-floor"><div className="synth-grid" /></div>
  </div>
);

// Celeste y blanco, the Sun of May, and a few things from home.
export const Argentina = () => (
  <svg className="bg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="arg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5d9fdb" /><stop offset=".5" stopColor="#3478b8" /><stop offset="1" stopColor="#123c66" />
      </linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#arg)" />
    <rect y="360" width="1920" height="360" fill="#fff" opacity=".16" />
    <g transform="translate(1500 300)" fill="#f6b40e">
      {Array.from({ length: 32 }, (_, i) => (
        <polygon key={i} points={i % 2 ? "-9,-92 0,-190 9,-92" : "-12,-92 0,-230 12,-92"} transform={`rotate(${i * 11.25})`} opacity=".75" />
      ))}
      <circle r="92" opacity=".95" />
      <circle r="92" fill="none" stroke="#b37c00" strokeWidth="5" />
      <g fill="#8a5a00" opacity=".7"><circle cx="-30" cy="-15" r="9" /><circle cx="30" cy="-15" r="9" /><path d="M-35 30q35 28 70 0" fill="none" stroke="#8a5a00" strokeWidth="7" strokeLinecap="round" /></g>
    </g>
    {[["🧉", 1080, 150], ["🥩", 1820, 140], ["🥟", 1150, 470], ["⚽", 1820, 520], ["🍷", 960, 330], ["🏆", 1720, 760], ["🎸", 1330, 640], ["🧉", 820, 120]].map(([e, x, y], i) => (
      <text key={i} x={x} y={y} fontSize="84" opacity=".55">{e}</text>
    ))}
  </svg>
);

// Columns of green code raining down, like the Matrix. About 20 frames a second; the WebView stops
// it whenever the home screen isn't showing.
export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext("2d")!;
    const W = (cv.width = 1920), H = (cv.height = 1080), cell = 26;
    const glyphs = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>{}=+*";
    const cols = Math.ceil(W / cell);
    const drops = Array.from({ length: cols }, () => -Math.random() * 40);
    g.font = `${cell - 2}px monospace`;
    let last = 0, raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 50) return;
      last = t;
      g.fillStyle = "rgba(0,0,0,0.09)"; // fade what's there: that's the trail
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * cell;
        g.fillStyle = "#d4ffdc";
        g.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * cell, y);
        g.fillStyle = "#00ff41";
        g.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * cell, y - cell);
        drops[i] += 0.55;
        if (y > H && Math.random() > 0.975) drops[i] = -Math.random() * 10;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="bg matrix" />;
}
