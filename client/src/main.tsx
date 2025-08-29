// client/src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./ErrorBoundary";
import "./bootstrap";
import { installTgFetchShim } from "@/lib/tg-fetch-shim";
import { installRemoteLogger } from "@/lib/remote-logger";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

// ===== 0) Utilities =====
function reportError(error: any, context: string) {
  console.error(`[${context}]`, error);
  // Optionally POST to your backend:
  // fetch("/api/log-client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, error: String(error) }) });
}

// Install fetch shim & remote logger ASAP
installTgFetchShim();
installRemoteLogger();

window.addEventListener("error", (e) => reportError(e.error || e.message, "GlobalError"));
window.addEventListener("unhandledrejection", (e) => reportError((e as any).reason, "UnhandledPromise"));

// ===== 1) Telegram Mini App boot =====
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();

    const applyTheme = (themeParams: any) => {
      document.body.dataset.tgTheme = themeParams?.theme || "light";
    };
    applyTheme(tg.themeParams);
    tg.onEvent("themeChanged", () => applyTheme(tg.themeParams));

    if (tg.initDataUnsafe) {
      console.log("Telegram initDataUnsafe:", tg.initDataUnsafe);
    }

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover"
      );
    }
  } catch (err) {
    reportError(err, "TelegramWebAppInit");
  }
} else {
  console.warn("Telegram.WebApp is not available — likely running outside Telegram.");
}

// ===== 2) TonConnect UI Provider config =====
const manifestUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/tonconnect-manifest.json`
    : "/tonconnect-manifest.json";

// Map Vite env to UI network
const APP_NET =
  (import.meta as any)?.env?.VITE_TON_NETWORK === "TESTNET" ? "TESTNET" : "MAINNET";

// Deep-link back to your bot (use /startapp, not ?startapp)
const TWA_RETURN_URL = "https://t.me/giftspremarketbot/startapp";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      returnStrategy="twa"
      actionsConfiguration={{ twaReturnUrl: TWA_RETURN_URL }}
      walletsListConfiguration={{ network: APP_NET }}
    >
      <App />
    </TonConnectUIProvider>
  </ErrorBoundary>
);