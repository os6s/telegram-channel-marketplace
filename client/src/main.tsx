import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// (Optional) catch silent runtime errors in Telegram
window.addEventListener("error", e => console.log("GlobalError:", e.error || e.message));
window.addEventListener("unhandledrejection", e => console.log("Unhandled:", e.reason));

// Initialize Telegram Web App early
if (typeof window !== "undefined" && window.Telegram?.WebApp) {
  try {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  } catch {}
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover"
    );
  }
}

createRoot(document.getElementById("root")!).render(<App />);