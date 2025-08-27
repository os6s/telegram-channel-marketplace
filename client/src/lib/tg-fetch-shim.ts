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

      const headers = new Headers(init.headers || undefined);

      if (isSameOrigin) {
        // Telegram auth header only for same-origin API calls
        const initData = getInitData();
        if (initData && !headers.has("x-telegram-init-data")) {
          headers.set("x-telegram-init-data", initData);
        }
      } else {
        // For cross-origin (e.g., Tonkeeper bridge) strip credentials-ish headers
        headers.delete("cookie");
        headers.delete("Cookie");
        headers.delete("authorization");
        headers.delete("Authorization");
      }

      const nextInit: RequestInit = {
        ...init,
        headers,
        credentials: isSameOrigin ? "include" : "omit",
        // preserve caller's mode (don’t break things unintentionally)
        mode: init.mode,
      };

      return origFetch(url.toString(), nextInit);
    } catch {
      // Fallback to original if URL parsing fails
      return origFetch(input as any, init);
    }
  };
}