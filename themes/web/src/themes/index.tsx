import { ReactNode } from "react";
import { Argentina, MatrixRain, Photos, Pitch, RiverBadges, Sash, Synthwave, Wallpaper } from "./backgrounds";
import { BigClock, C64Screen, CenterClock, Scoreboard, SmallClock, Terminal } from "./headers";

// A theme is the whole look: a class on the page (colours, shapes and fonts live in styles.css,
// under .theme-<id>), a background, and what sits above the apps (clock, scoreboard, terminal...).
export type Theme = {
  id: string;
  name: string;
  background: (wallpaper: number) => ReactNode;
  header: ReactNode;
  perRow?: number; // apps per row (default 6)
  gridTop?: number; // where the apps start, out of 1080 (default 600)
  swatch: string; // the dot in the theme list
  ready?: boolean; // can be picked; the others are listed as coming soon
};

const RIVER = ["Vamos River, vamos River", "El más grande sigue siendo River", "Los Borrachos del Tablón",
  "Monumental, la casa del más grande", "Madrid, 9 de diciembre de 2018", "Siempre de River"];
const ARG = ["Che, ¿unos mates?", "Hoy hay asado", "¡Vamos Argentina! ★★★", "Dale que va",
  "Empanadas de carne, cortadas a cuchillo", "Domingo, fútbol y fernet", "Mate amargo y a laburar"];
const NERD = ["wake up, neo...", "follow the white rabbit", "there is no spoon", "$ sudo make me a sandwich",
  "it works on my machine", "// TODO: go outside", "git push --force  # yolo"];

export const THEMES: Theme[] = [
  { id: "clasico", name: "Clásico", ready: true, background: (w) => <Wallpaper index={w} />, header: <BigClock />, swatch: "linear-gradient(135deg,#ff8048,#15100f,#aa3c8c)" },
  { id: "cine", name: "Cine", background: () => <div className="bg cine" />, header: <SmallClock />, perRow: 5, gridTop: 200, swatch: "linear-gradient(135deg,#000 40%,#e50914)" },
  { id: "minimal", name: "Minimal", background: () => <div className="bg minimal" />, header: <CenterClock />, swatch: "#2a2b2e" },
  { id: "estadio", name: "Estadio", background: () => <Pitch />, header: <Scoreboard />, swatch: "linear-gradient(135deg,#1f6b3b,#082414)" },
  { id: "foto", name: "Foto", background: () => <Photos folders={[]} fallback="linear-gradient(#14243a,#050a12)" />, header: <BigClock />, swatch: "linear-gradient(135deg,#4a6cff,#26b4c8)" },
  { id: "retro", name: "Retro", background: () => <Synthwave />, header: <BigClock />, swatch: "linear-gradient(135deg,#ff2e97,#ffe14d)" },
  {
    id: "river", name: "River", ready: true,
    background: () => <><div className="bg river" /><Photos folders={["river", "hinchada"]} /><Sash /><RiverBadges /></>,
    header: <BigClock phrases={RIVER} />, swatch: "linear-gradient(135deg,#fff 35%,#e30613 35%,#e30613 65%,#fff 65%)",
  },
  { id: "argentina", name: "Argentina", background: () => <Argentina />, header: <BigClock phrases={ARG} />, swatch: "linear-gradient(#74acdf 33%,#fff 33%,#fff 66%,#74acdf 66%)" },
  { id: "matrix", name: "Matrix", background: () => <MatrixRain />, header: <BigClock phrases={NERD} />, swatch: "#00ff41" },
  { id: "c64", name: "C64", background: () => <div className="bg c64" />, header: <C64Screen />, swatch: "linear-gradient(135deg,#6c5eb5 30%,#352879 30%)" },
  { id: "terminal", name: "Terminal", background: () => <div className="bg terminal" />, header: <Terminal />, swatch: "#0a0f0a" },
];

export const themeByName = (name: string) => THEMES.find((t) => t.name === name) ?? THEMES[0];
