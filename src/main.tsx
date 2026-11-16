import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./global.css";
import { NuqsAdapter } from "nuqs/adapters/react";
import { App } from "./components/App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("no #root in index.html");
createRoot(root).render(
  <StrictMode>
    <NuqsAdapter>
      <App />
    </NuqsAdapter>
  </StrictMode>,
);
