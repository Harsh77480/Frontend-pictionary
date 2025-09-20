import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SocketProvider } from "./contexts/SocketContext";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </React.StrictMode>
);
