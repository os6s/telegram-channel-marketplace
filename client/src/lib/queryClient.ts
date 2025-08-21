// client/src/lib/queryClient.ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";

/* ------------ API base resolution (cached) ------------ */
let API_BASE_CACHE: string | null = null;
let API_BASE_LOADING: Promise<string> | null = null;

function joinBase(base: string, path: string) {
  if (!base) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (base.endsWith("/") && path.startsWith("/")) return base.slice(0, -1) + path;
  if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
  return base + path;
}

async function getApiBase(): Promise<string> {
  if (API_BASE_CACHE !== null) return API_BASE_CACHE;

  // 1) Vite env
  const viteBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (viteBase !== undefined) {
    API_BASE_CACHE = viteBase || "";
    return API_BASE_CACHE;
  }

  // 2) window-injected
  if (typeof window !== "undefined" && (window as any).__API_BASE__) {
    API_BASE_CACHE = String((window as any).__API_BASE__ || "");
    return API_BASE_CACHE;
  }

  // 3) /api/config مرة واحدة
  if (!API_BASE_LOADING) {
    API_BASE_LOADING = (async () => {
      try {
        const res = await fetch("/api/config", { credentials: "include" });
        if (!res.ok) throw new Error("config fetch failed");
        const j = await res.json();
        API_BASE_CACHE = j?.API_BASE_URL || "";
      } catch {
        API_BASE_CACHE = ""; // نفس الأصل
      } finally {
        API_BASE_LOADING = null;
      }
      return API_BASE_CACHE;
    })();
  }
  return API_BASE_LOADING!;
}

/* ------------ Telegram initData helper ------------ */
function getInitData(): string | null {
  try {
    // متاح فقط داخل Telegram WebApp
    // @ts-ignore
    const raw = typeof window !== "undefined" ? window?.Telegram?.WebApp?.initData : null;
    if (!raw || typeof raw !== "string" || raw.length === 0) return null;
    return raw;
  } catch {
    return null;
  }
}

/* ------------ helpers ------------ */
async function fetchJson(method: string, url: string, data?: unknown) {
  const base = await getApiBase();
  const fullUrl = joinBase(base, url);

  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";

  const initData = getInitData();
  if (initData) headers["x-telegram-init-data"] = initData;

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // حاول قراءة JSON دائمًا
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // ليس JSON
  }

  if (!res.ok) {
    // ابنِ رسالة خطأ تشمل issues إن وجدت
    let msg =
      (payload && (payload.error || payload.message)) ||
      res.statusText ||
      `HTTP ${res.status}`;
    if (payload?.issues) {
      try {
        msg += ` :: ${JSON.stringify(payload.issues)}`;
      } catch {}
    }
    const err: any = new Error(`${res.status}: ${msg}`);
    if (payload?.issues) err.issues = payload.issues;
    throw err;
  }

  // نجاح
  return payload ?? {};
}

/* ------------ public API ------------ */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<any> {
  return fetchJson(method, url, data);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const base = await getApiBase();
    const url = joinBase(base, queryKey.join("/") as string);

    const initData = getInitData();
    const headers: Record<string, string> = {};
    if (initData) headers["x-telegram-init-data"] = initData;

    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    if (!res.ok) {
      let msg =
        (payload && (payload.error || payload.message)) ||
        res.statusText ||
        `HTTP ${res.status}`;
      if (payload?.issues) {
        try {
          msg += ` :: ${JSON.stringify(payload.issues)}`;
        } catch {}
      }
      throw new Error(`${res.status}: ${msg}`);
    }

    return (payload ?? {}) as T;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: { retry: false },
  },
});