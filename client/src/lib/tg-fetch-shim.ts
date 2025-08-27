function getInitData(): string | null {
  try {
    // @ts-ignore
    return typeof window !== "undefined" ? window?.Telegram?.WebApp?.initData || null : null;
  } catch { return null; }
}

export function installTgFetchShim() {
  if (typeof window === "undefined") return;
  if ((window as any).__tgFetchShimInstalled) return;
  (window as any).__tgFetchShimInstalled = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, initArg?: RequestInit) => {
    try {
      const init: RequestInit = initArg ?? {};

      // حدد URL الأصلي
      const urlStr =
        typeof input === "string" ? input :
        input instanceof URL ? input.toString() :
        (input as Request).url;

      const url = new URL(urlStr, window.location.href);
      const isSameOrigin = url.origin === window.location.origin;

      // فقط API؟
      const isApi = isSameOrigin && /^\/api(\/|$)/.test(url.pathname);

      // دمج الهيدرز
      const merged = new Headers();
      if (typeof input === "object" && input instanceof Request) {
        try { (input.headers as Headers)?.forEach((v, k) => merged.set(k, v)); } catch {}
      }
      if (init.headers) {
        try {
          const h2 = new Headers(init.headers as any);
          h2.forEach((v, k) => merged.set(k, v));
        } catch {
          try {
            Object.entries(init.headers as Record<string, string>).forEach(([k, v]) =>
              merged.set(k, String(v))
            );
          } catch {}
        }
      }

      // أضف initData فقط لطلبات /api/*
      if (isApi) {
        const initData = getInitData();
        if (initData && !merged.has("x-telegram-init-data")) {
          merged.set("x-telegram-init-data", initData);
        }
        // اختياري: أرسل اسم المستخدم إن وجد
        try {
          // @ts-ignore
          const uname = window?.Telegram?.WebApp?.user?.username;
          if (uname && !merged.has("x-telegram-username")) merged.set("x-telegram-username", uname);
        } catch {}
      } else {
        // لطلبات cross-origin/غير API لا ترسل أي توكنات
        try { merged.delete("cookie"); } catch {}
        try { merged.delete("Cookie"); } catch {}
        try { merged.delete("authorization"); } catch {}
        try { merged.delete("Authorization"); } catch {}
      }

      const nextInit: RequestInit = {
        ...init,
        headers: merged,
        credentials: init.credentials ?? (isSameOrigin ? "include" : "omit"),
        // لا نغيّر mode (iOS حساس)
      };

      const resp = await origFetch(url.toString(), nextInit);

      // ديبگ مفيد لو صار 4xx/5xx
      if (resp.status >= 400) {
        console.warn("[tg-fetch-shim] HTTP", resp.status, url.toString());
      }
      return resp;
    } catch {
      return origFetch(input as any, initArg);
    }
  };
}