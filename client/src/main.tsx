// client/src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./ErrorBoundary";
import "./bootstrap";

// اطبع أي أخطاء عامة بدل ما تبقى الشاشة فاضية
window.addEventListener("error", (e) => console.log("GlobalError:", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.log("Unhandled:", (e as any).reason));

// تهيئة Telegram WebApp مبكراً
if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
  try {
    (window as any).Telegram.WebApp.ready();
    (window as any).Telegram.WebApp.expand();
  } catch {}
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover"
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);