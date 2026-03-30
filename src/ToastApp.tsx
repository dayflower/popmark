import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

function ToastApp() {
  const [visible, setVisible] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") ?? "success";
  const message = params.get("message") ?? "Copied to clipboard \u2713";

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), 1500);
    const closeTimer = setTimeout(() => {
      getCurrentWindow().close();
    }, 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, []);

  return (
    <div className="flex items-center justify-center h-screen w-screen">
      <div
        className={`px-5 py-3 rounded-full text-white text-sm font-medium shadow-lg transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        } ${status === "success" ? "bg-green-600" : "bg-red-600"}`}
      >
        {message}
      </div>
    </div>
  );
}

export default ToastApp;
