// src/main.tsx
/**
 * Application entry point that renders the main App component.
 * Imports global styles and initializes the React application.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import "./styles/Card.css";
import "./styles/darkModeOverrides.css";
import "./styles/CustomAreaPanel.css";
import "./styles/DismissableMessage.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
