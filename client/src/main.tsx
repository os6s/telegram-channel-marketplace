import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { LanguageProvider } from "@/contexts/language-context";

// Initialize Telegram Web App early
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);