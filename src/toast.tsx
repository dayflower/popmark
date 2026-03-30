import React from "react";
import ReactDOM from "react-dom/client";
import ToastApp from "./ToastApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastApp />
  </React.StrictMode>,
);
