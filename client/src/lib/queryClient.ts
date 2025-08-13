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

  // 1) Vite env (لو معيّن)
  const viteBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (viteBase !== undefined) {
    API_BASE_CACHE = viteBase || "";
    return API_BASE_CACHE;
  }

  // 2) نافذة المتصفح (لو تم حقنها مستقبلاً)
  if (typeof window !== "undefined" && (window as any).__API_BASE__) {
    API_BASE_CACHE = String((window as any).__API_BASE__ || "");
    return API_BASE_CACHE;
  }

  // 3) /api/config مرّة واحدة فقط
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

/* ------------ helpers ------------ */
async function fetchJson(method: string, url: string, data?: unknown) {
  const base = await getApiBase();
  const fullUrl = joinBase(base, url);
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    // حاول تقرأ JSON للخطأ وإلا نص
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j?.error || j?.message || msg;
    } catch {
      try { msg = (await res.text()) || msg; } catch {}
    }
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.json();
}

/* ------------ public API ------------ */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<any> {
  return fetchJson(method, url, data); // يرجّع JSON مباشرة
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const base = await getApiBase();
    const url = joinBase(base, queryKey.join("/") as string);
    const res = await fetch(url, { credentials: "include" });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        msg = j?.error || j?.message || msg;
      } catch {
        try { msg = (await res.text()) || msg; } catch {}
      }
      throw new Error(`${res.status}: ${msg}`);
    }
    return res.json() as Promise<T>;
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