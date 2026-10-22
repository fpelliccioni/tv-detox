import { createContext, useContext, useEffect, useRef, useState } from "react";
import { App, bridge } from "../bridge";
import { locale } from "../i18n";

// What a header can do besides showing the time: the Terminal theme opens apps and changes theme.
export type Home = { apps: App[]; open: (pkg: string) => void; setTheme: (name: string) => void; themes: string[] };
export const HomeContext = createContext<Home>({ apps: [], open: () => {}, setTheme: () => {}, themes: [] });

export function useNow(every = 5000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

const hhmm = (d: Date, pad = false) => {
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  return `${pad ? String(h).padStart(2, "0") : h}:${m}`;
};
const dateText = (d: Date) => {
  const s = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
};

// One of the theme's phrases, a new one each time the home screen comes back.
export function usePhrase(phrases?: string[]) {
  const pick = () => (phrases?.length ? phrases[(Math.random() * phrases.length) | 0] : "");
  const [p, setP] = useState(pick);
  useEffect(() => {
    const again = () => document.visibilityState === "visible" && setP(pick());
    document.addEventListener("visibilitychange", again);
    window.addEventListener("tvhome-resume", again);
    return () => { document.removeEventListener("visibilitychange", again); window.removeEventListener("tvhome-resume", again); };
  }, [phrases]); // eslint-disable-line react-hooks/exhaustive-deps
  return p;
}

export function BigClock({ phrases, date = true }: { phrases?: string[]; date?: boolean }) {
  const now = useNow();
  const phrase = usePhrase(phrases);
  return (
    <div className="clock big">
      {date && <div className="date">{dateText(now)}</div>}
      <div className="time">{hhmm(now)}</div>
      {phrase && <div className="phrase">{phrase}</div>}
    </div>
  );
}

export function SmallClock() {
  const now = useNow();
  return (
    <div className="clock small">
      <span className="time">{hhmm(now)}</span>
      <span className="date">{dateText(now)}</span>
    </div>
  );
}

export function CenterClock() {
  const now = useNow();
  return <div className="clock center"><div className="time">{hhmm(now)}</div></div>;
}

export function Scoreboard({ phrases }: { phrases?: string[] }) {
  const now = useNow(1000);
  const phrase = usePhrase(phrases);
  return (
    <div className="clock board">
      <div className="date">{dateText(now)}</div>
      <div className="panel">
        <span className="team">LOCAL</span>
        <span className="time">{hhmm(now, true).replace(":", now.getSeconds() % 2 ? " " : ":")}</span>
        <span className="team">VISITA</span>
      </div>
      {phrase && <div className="phrase">{phrase}</div>}
    </div>
  );
}

// The Commodore 64 start-up screen, then the time where you'd type, with the blinking cursor.
export function C64Screen() {
  const now = useNow();
  return (
    <div className="c64screen">
      <p className="center">**** COMMODORE 64 BASIC V2 ****</p>
      <p className="center">64K RAM SYSTEM  38911 BASIC BYTES FREE</p>
      <p>&nbsp;</p>
      <p>READY.</p>
      <p>PRINT TI$</p>
      <p className="c64time">{hhmm(now, true)}<span className="cursor" /></p>
    </div>
  );
}

// ---- Terminal: a console to type commands into with the TV's keyboard. ----
// The commands only drive the home screen (open apps, change theme, show the system); nothing runs a shell.

const PROMPT = "tv@home:~$ ";
const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ago = (ms: number) => {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return `${d ? d + "d " : ""}${h % 24}h ${m % 60}m`;
};

function neofetch(apps: number, theme: string) {
  const d = bridge.device();
  return [
    `   .--.      tv@${d.device}`,
    `  |o_o |     OS: Android ${d.android} (API ${d.sdk})`,
    `  |:_/ |     Host: ${d.model}`,
    ` //   \\ \\    CPU: ${d.cpu}`,
    `(|     | )   RAM: ${d.ramUsed} / ${d.ramTotal} MB`,
    `/'\\_   _/\`\\   Uptime: ${ago(d.uptime)}`,
    `\\___)=(___/   Apps: ${apps}  Theme: ${theme}`,
  ];
}

export function Terminal() {
  const home = useContext(HomeContext);
  const [lines, setLines] = useState<string[]>(() => [
    `Último acceso: ${new Date().toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    PROMPT + "neofetch",
    ...neofetch(home.apps.length, "Terminal"),
    "Flecha arriba para llegar al prompt, OK para escribir, 'help' para ver los comandos.",
  ]);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const print = (...l: string[]) => setLines((x) => [...x, ...l].slice(-14));

  const openApp = (q: string) => {
    const n = Number(q);
    let app = Number.isInteger(n) && n >= 1 ? home.apps[n - 1] : undefined;
    const s = strip(q);
    app ??= home.apps.find((a) => strip(a.label) === s) ?? home.apps.find((a) => strip(a.label).startsWith(s)) ?? home.apps.find((a) => strip(a.label).includes(s));
    if (!app) return false;
    print(`abriendo ${app.pkg}...`);
    setTimeout(() => home.open(app!.pkg), 300);
    return true;
  };

  const run = (line: string) => {
    const [cmd0, ...rest] = line.split(/\s+/);
    const cmd = cmd0.toLowerCase(), arg = rest.join(" ");
    switch (cmd) {
      case "help": case "ayuda": case "?":
        return print("ls             lista las apps", "open <app|n>   abre una app (o escribí su nombre)",
          "theme [nombre] lista o cambia el tema", "neofetch       info del sistema",
          "date  uptime  whoami  echo  clear", "settings  wifi  matrix");
      case "ls": case "apps": case "dir": {
        const out: string[] = [];
        home.apps.forEach((a, i) => {
          const cell = `${String(i + 1).padStart(2)} ${a.label.length > 15 ? a.label.slice(0, 14) + "…" : a.label}`.padEnd(20);
          if (i % 4 === 0) out.push(cell); else out[out.length - 1] += cell;
        });
        return print(...out);
      }
      case "open": case "abrir": case "run": case "start":
        if (!arg) return print("uso: open <nombre o número de 'ls'>");
        return openApp(arg) || print(`open: no encuentro '${arg}'. Probá 'ls'.`);
      case "theme": case "tema": case "themes": {
        if (!arg) return print("temas: " + home.themes.join(" "));
        const t = home.themes.find((n) => strip(n) === strip(arg));
        if (!t) return print(`theme: no existe '${arg}'`);
        print(`cambiando a ${t}...`);
        return setTimeout(() => home.setTheme(t), 400);
      }
      case "matrix":
        print("wake up, neo...");
        return setTimeout(() => home.setTheme("Matrix"), 600);
      case "neofetch": case "info": case "uname":
        return print(...neofetch(home.apps.length, "Terminal"));
      case "date": case "fecha":
        return print(new Date().toLocaleString(locale, { dateStyle: "full", timeStyle: "medium" }));
      case "uptime":
        return print("encendida hace " + ago(bridge.device().uptime));
      case "whoami":
        return print("root", "(mentira, sos un usuario sin privilegios. pero con estilo)");
      case "sudo": case "su":
        return print("[sudo] contraseña para tv:", "Permiso denegado. Este incidente será reportado.");
      case "echo":
        return print(arg);
      case "clear": case "cls": case "exit":
        return setLines([]);
      case "settings": case "ajustes":
        return bridge.settings("tv");
      case "wifi": case "red": case "ifconfig":
        return bridge.settings("network");
      case "hack":
        return print("conectando al mainframe..... [OK]", "bypass del firewall......... [OK]", "descargando internet......... 3%", "mejor mirá una peli.");
      case "rm":
        return print("rm: buen intento.");
      default:
        if (!openApp(line)) print(`${cmd}: comando no encontrado. Probá 'help'.`);
    }
  };

  return (
    <div className="term" onClick={() => input.current?.focus()}>
      <div className="term-title"><i /><i /><i /><span>tv@home: ~ — bash</span></div>
      <div className="term-out">{lines.map((l, i) => <div key={i}>{l || " "}</div>)}</div>
      <form className="term-in" onSubmit={(e) => { e.preventDefault(); const v = value.trim(); setValue(""); if (v) { print(PROMPT + v); run(v); } }}>
        <span>{PROMPT}</span>
        <input ref={input} data-nav="" value={value} onChange={(e) => setValue(e.target.value)} placeholder="escribí 'help' y OK"
          autoCapitalize="off" autoComplete="off" spellCheck={false} enterKeyHint="go" />
      </form>
    </div>
  );
}
