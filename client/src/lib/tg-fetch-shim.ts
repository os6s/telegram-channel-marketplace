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
    const init: RequestInit = initArg ?? {};
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    const url = new URL(urlStr, window.location.href);

    // لا نمنع أي نطاق. فقط نضيف هيدر initData إذا موجود.
    const headers = new Headers(init.headers || {});
    const initData = getInitData();
    if (initData && !headers.has("X-Telegram-Init-Data")) {
      headers.set("X-Telegram-Init-Data", initData);
    }

    return origFetch(url.toString(), { ...init, headers });
  };
}