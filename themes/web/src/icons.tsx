// Thin line icons, drawn in the current text colour.
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Play = () => <svg viewBox="0 0 24 24" {...P}><path d="M7 5l11 7-11 7z" /></svg>;
export const Gear = () => (
  <svg viewBox="0 0 24 24" {...P}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
);
export const Plus = () => <svg viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>;
export const Hdmi = () => <svg viewBox="0 0 24 24" {...P}><path d="M3 9h18v4l-2.5 3h-13L3 13z M8 12.5h8" /></svg>;
export const Bluetooth = () => <svg viewBox="0 0 24 24" {...P}><path d="M7 8l10 8-5 4V4l5 4-10 8" /></svg>;
export const Sound = () => <svg viewBox="0 0 24 24" {...P}><path d="M4 9.5h4l4.5-4v13L8 14.5H4z M16 9a4 4 0 010 6 M18.5 6.5a7.5 7.5 0 010 11" /></svg>;
export const Picture = () => <svg viewBox="0 0 24 24" {...P}><path d="M3 5h18v11.5H3z M12 16.5V20 M8 20h8" /></svg>;

export function Wifi({ bars = 3, type }: { bars?: number; type: string }) {
  if (type === "ethernet")
    return <svg viewBox="0 0 24 24" {...P}><path d="M4 6h16v10.5h-4v3H8v-3H4z M8.5 6v4 M12 6v4 M15.5 6v4" /></svg>;
  const arc = (r: number, on: boolean) => (
    <path d={`M${12 - r * 0.7} ${19.5 - r * 0.7}a${r} ${r} 0 0 1 ${r * 1.4} 0`} opacity={on ? 1 : 0.3} />
  );
  return (
    <svg viewBox="0 0 24 24" {...P}>
      {arc(13.5, bars >= 3)}{arc(9.2, bars >= 2)}{arc(5, bars >= 1)}
      <circle cx="12" cy="19.5" r="0.6" fill="currentColor" />
      {type === "offline" && <path d="M5 4.5l14 16" />}
    </svg>
  );
}
