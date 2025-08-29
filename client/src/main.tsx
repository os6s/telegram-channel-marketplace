// client/src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./ErrorBoundary";
import "./bootstrap";
import { installTgFetchShim } from "@/lib/tg-fetch-shim";
import { installRemoteLogger } from "@/lib/remote-logger";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

// ---- utils ----
function reportError(error: any, context: string) {
  console.error(`[${context}]`, error);
}
installTgFetchShim();
installRemoteLogger();
window.addEventListener("error", (e) => reportError(e.error || e.message, "GlobalError"));
window.addEventListener("unhandledrejection", (e) => reportError((e as any).reason, "UnhandledPromise"));

// ---- Telegram Mini App boot ----
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    const applyTheme = (themeParams: any) => { document.body.dataset.tgTheme = themeParams?.theme || "light"; };
    applyTheme(tg.themeParams);
    tg.onEvent("themeChanged", () => applyTheme(tg.themeParams));
    if (tg.initDataUnsafe) console.log("Telegram initDataUnsafe:", tg.initDataUnsafe);
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) viewport.setAttribute("content","width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover");
  } catch (err) {
    reportError(err, "TelegramWebAppInit");
  }
} else {
  console.warn("Telegram.WebApp is not available — likely outside Telegram.");
}

// ---- TonConnect UI Provider (official flow) ----
const manifestUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/tonconnect-manifest.json`
    : "/tonconnect-manifest.json";

// 'MAINNET' | 'TESTNET'
const APP_NET = (import.meta as any)?.env?.VITE_TON_NETWORK === "TESTNET" ? "TESTNET" : "MAINNET";

// Use /app for TWA return URL
const TWA_RETURN_URL = "https://t.me/giftspremarketbot/app";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      returnStrategy="twa"
      actionsConfiguration={{ twaReturnUrl: TWA_RETURN_URL }}
      walletsListConfiguration={{ network: APP_NET }}
      // optional hardening:
      // restoreConnection={true}
      // uiPreferences={{ theme: THEME.DARK }}
    >
      <App />
    </TonConnectUIProvider>
  </ErrorBoundary>
);