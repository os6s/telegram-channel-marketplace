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

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers((init && init.headers) || undefined);
    const initData = getInitData();
    if (initData && !headers.has("x-telegram-init-data")) {
      headers.set("x-telegram-init-data", initData);
    }
    // نضمن الكوكيز إذا استعملتوها لاحقاً
    const nextInit: RequestInit = { ...init, headers, credentials: "include" };
    return origFetch(input, nextInit);
  };
}