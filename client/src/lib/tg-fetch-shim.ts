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

  window.fetch = (input: RequestInfo | URL, initArg?: RequestInit) => {
    try {
      const init: RequestInit = initArg ?? {};

      // 1) حدد الـ URL وكونه same-origin أو لا
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      const url = new URL(urlStr, window.location.href);
      const isSameOrigin = url.origin === window.location.origin;

      // 2) جهّز الهيدرز بشكل دفاعي (يدعم object/Headers)
      const merged = new Headers();
      // أولوية: headers من Request إن وُجد
      if (typeof input === "object" && input instanceof Request) {
        try {
          (input.headers as Headers)?.forEach((v, k) => merged.set(k, v));
        } catch {}
      }
      // ثم headers القادمين من init
      if (init.headers) {
        try {
          const h2 = new Headers(init.headers as any);
          h2.forEach((v, k) => merged.set(k, v));
        } catch {
          // لو init.headers كان object عادي
          try {
            Object.entries(init.headers as Record<string, string>).forEach(([k, v]) =>
              merged.set(k, String(v))
            );
          } catch {}
        }
      }

      // 3) أضف initData لطلبات نفس الدومين فقط
      if (isSameOrigin) {
        const initData = getInitData();
        if (initData && !merged.has("x-telegram-init-data")) {
          merged.set("x-telegram-init-data", initData);
        }
      } else {
        // 4) لطلبات الـ bridge (cross-origin) لا نرسل كوكيز/توكنات
        try { merged.delete("cookie"); } catch {}
        try { merged.delete("Cookie"); } catch {}
        try { merged.delete("authorization"); } catch {}
        try { merged.delete("Authorization"); } catch {}
      }

      // 5) جهّز init النهائي—لا نغيّر mode (iOS/Safari حساس)
      const nextInit: RequestInit = {
        ...init,
        headers: merged,
        credentials:
          init.credentials ??
          (isSameOrigin ? "include" : "omit"),
        // اترك mode كما هو (لا نفرض "cors")
      };

      return origFetch(url.toString(), nextInit);
    } catch {
      // fallback لو صار parsing error
      return origFetch(input as any, initArg);
    }
  };
}