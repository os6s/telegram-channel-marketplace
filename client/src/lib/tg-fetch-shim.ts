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

      const headers = new Headers(init.headers || undefined);
      if (isSameOrigin) {
        const initData = getInitData();
        if (initData && !headers.has("x-telegram-init-data")) {
          headers.set("x-telegram-init-data", initData);
        }
      } else {
        // امنع الكوكيز/التوكينات للـ bridges الخارجية
        headers.delete("cookie");
        headers.delete("Cookie");
        headers.delete("authorization");
        headers.delete("Authorization");
      }

      return origFetch(url.toString(), {
        ...init,
        headers,
        credentials: isSameOrigin ? "include" : "omit",
        mode: "cors",
      });
    } catch {
      return origFetch(input as any, init);
    }
  };
}