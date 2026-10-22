import { createRoot } from "react-dom/client";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/700.css";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./fonts/river.css";
// Candidates for River's lettering, compared in the browser preview.
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/saira-condensed/700.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/anton/400.css";
import "@fontsource/archivo-black/400.css";
import "./nav";
import "./styles.css";
import Home from "./App";
import { loadMock, onTV } from "./bridge";

(onTV ? Promise.resolve() : loadMock()).then(() => createRoot(document.getElementById("root")!).render(<Home />));
