// The home screen's own labels: Spanish on a Spanish TV, English otherwise.
const es: Record<string, string> = {
  "Settings": "Ajustes", "Add app": "Añadir app", "Theme": "Tema", "Wallpaper": "Fondo de pantalla",
  "TV settings": "Ajustes de la TV", "Move": "Mover", "Replace": "Reemplazar", "Remove from home": "Quitar del inicio",
  "Uninstall": "Desinstalar", "App info": "Info. de la app", "Add an app": "Añadir una app",
  "Every app is already here": "Todas las apps ya están aquí", "Use the arrows to move it, then press OK":
  "Usá las flechas para moverla y apretá OK", "Shortcuts": "Atajos", "Network": "Red", "Bluetooth": "Bluetooth",
  "Sound": "Sonido", "coming soon": "próximamente", "Picture": "Imagen", "On": "Sí", "Off": "No",
};

// ?lang=es forces it, for the browser preview.
const lang = new URLSearchParams(location.search).get("lang") || navigator.language || "";
const spanish = lang.toLowerCase().startsWith("es");
export const t = (en: string) => (spanish ? es[en] ?? en : en);
export const locale = spanish ? "es-AR" : navigator.language || "en";
