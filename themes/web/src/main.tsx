import { createRoot } from "react-dom/client";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/700.css";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./nav";
import "./styles.css";
import Home from "./App";

createRoot(document.getElementById("root")!).render(<Home />);
