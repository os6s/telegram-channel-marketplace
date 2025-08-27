// client/src/lib/tg-fetch-shim.ts
function getInitData(): string | null {
  try {
    // @ts-ignore
    return window?.Telegram?.WebApp?.initData || null;
  } catch {
    return null;
  }
}

export function installTgFetchShim() {
  if (typeof window === "undefined") return;
  if ((window as any).__tgFetchShimInstalled) return;
  (window as any).__tgFetchShimInstalled = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    try {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      const url = new URL(urlStr, window.location.href);
      const isSameOrigin = url.origin === window.location.origin;

      // نبني الهيدرز مع x-telegram-init-data لطلبات نفس الدومين فقط
      const headers = new Headers(init.headers || undefined);
      if (isSameOrigin) {
        const initData = getInitData();
        if (initData && !headers.has("x-telegram-init-data")) {
          headers.set("x-telegram-init-data", initData);
        }
      } else {
        // لطلبات cross-origin (جسور TonConnect) لا نرسل أي كوكيز/اعتمادات
        headers.delete("cookie");
        headers.delete("Cookie");
        headers.delete("authorization");
        headers.delete("Authorization");
      }

      const nextInit: RequestInit = {
        ...init,
        headers,
        // Same-origin: نسمح بالكوكيز لو احتجناها للـ API
        // Cross-origin: نمنعها حتى لا تفشل CORS
        credentials: isSameOrigin ? "include" : "omit",
        mode: "cors",
      };

      return origFetch(url.toString(), nextInit);
    } catch {
      // لو صار parsing error نرجع للسلوك الافتراضي
      return origFetch(input as any, init);
    }
  };
}