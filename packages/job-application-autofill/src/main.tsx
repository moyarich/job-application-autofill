import React from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "./router";
import "./styles.css";
import "./modern.css";
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
