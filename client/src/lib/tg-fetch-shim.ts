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

function mergeHeaders(a?: HeadersInit, b?: HeadersInit): Headers {
  const h = new Headers();
  if (a) new Headers(a).forEach((v, k) => h.set(k, v));
  if (b) new Headers(b).forEach((v, k) => h.set(k, v));
  return h;
}

export function installTgFetchShim() {
  if (typeof window === "undefined") return;
  if ((window as any).__tgFetchShimInstalled) return;
  (window as any).__tgFetchShimInstalled = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, initArg?: RequestInit) => {
    const method = (initArg?.method || (input as any)?.method || "GET").toUpperCase();
    if (method === "OPTIONS") return origFetch(input as any, initArg);

    // استخرج URL للفلترة فقط
    let urlStr: string;
    if (typeof input === "string") urlStr = input;
    else if (input instanceof URL) urlStr = input.toString();
    else urlStr = (input as Request).url;

    const url = new URL(urlStr, window.location.href);
    const sameOrigin = url.origin === window.location.origin;
    const isApi = url.pathname.startsWith("/api/");
    if (!sameOrigin || !isApi) return origFetch(input as any, initArg);

    // أضف init-data فقط إن وُجد
    const initData = getInitData();
    if (!initData) return origFetch(input as any, initArg);

    if (input instanceof Request) {
      // دمج هيدرات طلب أصلي مع initArg ثم إضافة هيدر التليجرام
      const merged = mergeHeaders(input.headers, initArg?.headers);
      if (!merged.has("x-telegram-init-data")) merged.set("x-telegram-init-data", initData);

      // أنشئ Request جديد يحافظ على body وباقي الخصائص
      const newReq = new Request(input, { ...initArg, headers: merged });
      return origFetch(newReq);
    }

    // input ليس Request: ابنِ هيدرات جديدة فقط
    const merged = mergeHeaders(initArg?.headers);
    if (!merged.has("x-telegram-init-data")) merged.set("x-telegram-init-data", initData);

    return origFetch(input as any, { ...(initArg || {}), headers: merged });
  };
}