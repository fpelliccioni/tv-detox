// Moving with the remote's arrows. Everything you can land on has data-nav; the arrows pick the
// nearest one in that direction, measured on screen, so any layout a theme draws just works.
// While a menu is open, only its items count (data-nav-scope on the menu).
//
// OK is handled here too, not by the browser: a short press activates ("activate" event), holding
// it for half a second is a long press ("longpress" event), like the original home screen.

type Dir = "up" | "down" | "left" | "right";
const DIRS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const LONG = 500;

export type NavHook = (dir: Dir) => boolean; // return true to take the key (move mode)
let hook: NavHook | null = null;
export const setNavHook = (h: NavHook | null) => void (hook = h);

function scope(): ParentNode {
  const menus = document.querySelectorAll("[data-nav-scope]");
  return menus.length ? menus[menus.length - 1] : document;
}

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

export function items(): HTMLElement[] {
  return Array.from(scope().querySelectorAll<HTMLElement>("[data-nav]")).filter(visible);
}

export function focusFirst() {
  const preferred = scope().querySelector<HTMLElement>("[data-nav-first]");
  (preferred && visible(preferred) ? preferred : items()[0])?.focus({ preventScroll: true });
}

function move(dir: Dir) {
  const all = items();
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !all.includes(cur)) return focusFirst();
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of all) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    // Must be in that direction; then closest along it, with sideways distance counting double.
    const along = dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
    const side = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
    if (along <= 4) continue;
    const score = along + side * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

let downAt = 0, longFired = false, downOn: Element | null = null;

window.addEventListener("keydown", (e) => {
  const typing = e.target instanceof HTMLInputElement;
  const dir = DIRS[e.key];
  if (dir) {
    // In a text box, left and right edit the text; up and down still leave it.
    if (typing && (dir === "left" || dir === "right")) return;
    e.preventDefault();
    if (hook && hook(dir)) return;
    move(dir);
    return;
  }
  if (e.key === "Enter" && !typing) {
    e.preventDefault();
    if (e.repeat) {
      if (!longFired && downOn && Date.now() - downAt >= LONG) {
        longFired = true;
        downOn.dispatchEvent(new CustomEvent("longpress"));
      }
      return;
    }
    downAt = Date.now();
    longFired = false;
    downOn = document.activeElement;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key !== "Enter" || e.target instanceof HTMLInputElement) return;
  e.preventDefault();
  const el = downOn;
  downOn = null;
  // Only the key-up of an OK that went down on the same item opens it (an app that closed on
  // key-down can hand us the key-up).
  if (!longFired && el && el === document.activeElement) el.dispatchEvent(new CustomEvent("activate"));
});
