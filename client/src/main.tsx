import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize Telegram Web App as early as possible
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  
  // Set viewport height for mobile compatibility
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
}

createRoot(document.getElementById("root")!).render(<App />);
