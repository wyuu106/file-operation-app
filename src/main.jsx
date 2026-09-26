import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/common.css";
import "./styles/App.css";
import "./styles/HomeView.css";
import "./styles/FileSelection.css";
import "./styles/HistoryView.css";
import "./styles/TemplateEditor.css";
import "./styles/RenamePreview.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
