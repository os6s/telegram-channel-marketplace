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
    // لا نعدل OPTIONS
    const method = (initArg?.method || (input as any)?.method || "GET").toUpperCase();
    if (method === "OPTIONS") return origFetch(input as any, initArg);

    // استخرج الـ URL للفلترة فقط
    let urlStr: string;
    if (typeof input === "string") urlStr = input;
    else if (input instanceof URL) urlStr = input.toString();
    else urlStr = (input as Request).url;

    const url = new URL(urlStr, window.location.href);

    // نضيف الهيدر فقط لطلبات نفس الدومين وتحت /api/
    const sameOrigin = url.origin === window.location.origin;
    const isApi = url.pathname.startsWith("/api/");
    if (!sameOrigin || !isApi) {
      return origFetch(input as any, initArg);
    }

    // كوّن Headers جديدة بناءً على initArg فقط
    const headers = new Headers(initArg?.headers || undefined);
    const initData = getInitData();
    if (initData && !headers.has("x-telegram-init-data")) {
      headers.set("x-telegram-init-data", initData); // اسم الهيدر بالحروف الصغيرة
    }

    // استدعِ fetch بالأصل نفسه مع headers المعدلة. لا نحول URL ولا ننسخ الجسم.
    return origFetch(input as any, { ...initArg, headers });
  };
}