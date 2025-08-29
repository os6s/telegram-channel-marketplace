// client/src/lib/tg-fetch-shim.ts
function getInitData(): string | null {
  try {
    // @ts-ignore
    return typeof window !== "undefined"
      ? window?.Telegram?.WebApp?.initData || null
      : null;
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
    // طبّع الطلب أولاً إلى Request واحد آمن
    const req = new Request(input as any, initArg);
    // دعم الروابط النسبية
    const url = new URL(req.url, window.location.href);

    // انسخ الهيدرات ثم أضف initData بالاسم الصحيح (lowercase)
    const headers = new Headers(req.headers);
    const initData = getInitData();
    if (initData && !headers.has("x-telegram-init-data")) {
      headers.set("x-telegram-init-data", initData);
    }

    // أعد استدعاء fetch بالأجزاء نفسها
    const method = req.method || "GET";
    const body =
      method !== "GET" && method !== "HEAD" ? (req as any).body : undefined;

    return origFetch(url.toString(), {
      method,
      headers,
      body,
      // نحافظ على خصائص الطلب الأصلي
      credentials: req.credentials,
      cache: req.cache as RequestCache,
      redirect: req.redirect as RequestRedirect,
      referrer: req.referrer || undefined,
      referrerPolicy: req.referrerPolicy || undefined,
      integrity: (req as any).integrity,
      keepalive: (req as any).keepalive,
      mode: req.mode as RequestMode,
      signal: req.signal,
    });
  };
}