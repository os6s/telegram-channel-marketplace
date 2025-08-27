// client/src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./ErrorBoundary";
import "./bootstrap";
import { installTgFetchShim } from "@/lib/tg-fetch-shim";
import { installRemoteLogger } from "@/lib/remote-logger"; // يرسل لوغات الآيفون/الموبايل للسيرفر

// ========== 1) Error logging (مثلاً Sentry أو fallback للباك) ==========
function reportError(error: any, context: string) {
  console.error(`[${context}]`, error);

  // TODO: إذا عندك خدمة لوجينگ (Sentry, Logtail, إلخ)
  // fetch("/api/log-client-error", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ context, error: String(error) }),
  // });
}

// ثبّت الشِم قبل أي fetch يصير
installTgFetchShim();

// فعّل الراصد عن بُعد لكل console/error
installRemoteLogger();

// اطبع أو أرسل أي أخطاء عامة بدل ما تبقى الشاشة فاضية
window.addEventListener("error", (e) => reportError(e.error || e.message, "GlobalError"));
window.addEventListener("unhandledrejection", (e) => reportError((e as any).reason, "UnhandledPromise"));

// ========== 2) Telegram MiniApp Integration ==========
const tg = (window as any).Telegram?.WebApp;

if (tg) {
  try {
    tg.ready(); // يلغي شاشة التحميل الافتراضية
    tg.expand(); // يخلي الواجهة تاخذ الطول الكامل

    // ========== 3) Theme Sync ==========
    const applyTheme = (themeParams: any) => {
      document.body.dataset.tgTheme = themeParams?.theme || "light";
    };
    applyTheme(tg.themeParams);
    tg.onEvent("themeChanged", () => applyTheme(tg.themeParams));

    // ========== 5) Security: Save initData ==========
    if (tg.initDataUnsafe) {
      console.log("Telegram initDataUnsafe:", tg.initDataUnsafe);
      // تقدر ترسلها للباك للتحقق من هوية المستخدم
      // fetch("/api/auth/telegram", { method: "POST", body: JSON.stringify(tg.initDataUnsafe) })
    }
  } catch (err) {
    reportError(err, "TelegramWebAppInit");
  }

  // ========== 4) Fix viewport ==========
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover"
    );
  }
} else {
  console.warn("Telegram.WebApp غير متاح — احتمال تشغّل التطبيق خارج تيليجرام (dev mode)");
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);