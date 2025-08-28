// client/src/lib/tg-fetch-shim.ts
function getInitData(): string | null {
  try {
    // @ts-ignore
    return typeof window !== "undefined" ? window?.Telegram?.WebApp?.initData || null : null;
  } catch {
    return null;
  }
}

export function installTgFetchShim() {
  if (typeof window === "undefined") return;
  if ((window as any).__tgFetchShimInstalled) return;
  (window as any).__tgFetchShimInstalled = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, initArg?: RequestInit) => {
    try {
      const init: RequestInit = initArg ?? {};

      // حوّل إلى URL مطلق
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      const url = new URL(urlStr, window.location.href);

      // ⛔️ لا تلمس أي شيء خارج نفس النطاق — دعه يمر كما هو (مهم لTonConnect/bridges)
      const isSameOrigin = url.origin === window.location.origin;
      if (!isSameOrigin) {
        return origFetch(input as any, initArg);
      }

      // ✅ لنفس النطاق فقط: أضف init-data والكوكيز
      const merged = new Headers();

      // انسخ هيدرز Request إن وُجد
      if (typeof input === "object" && input instanceof Request) {
        try { (input.headers as Headers)?.forEach((v, k) => merged.set(k, v)); } catch {}
      }
      // ثم هيدرز init
      if (init.headers) {
        try {
          new Headers(init.headers as any).forEach((v, k) => merged.set(k, v));
        } catch {
          try {
            Object.entries(init.headers as Record<string, string>).forEach(([k, v]) => merged.set(k, String(v)));
          } catch {}
        }
      }

      const initData = getInitData();
      if (initData && !merged.has("x-telegram-init-data")) {
        merged.set("x-telegram-init-data", initData);
      }

      const nextInit: RequestInit = {
        ...init,
        headers: merged,
        credentials: init.credentials ?? "include",
        // لا نغيّر mode — خليه كما هو
      };

      return origFetch(url.toString(), nextInit);
    } catch {
      return origFetch(input as any, initArg);
    }
  };
}