import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import "./index.css";

// HashRouter (e não BrowserRouter): dentro do Apps Script o app roda numa URL
// fixa terminada em /exec, que não aceita caminhos próprios — a navegação
// precisa acontecer depois do "#".
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
);
