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

/* ------------ Telegram helpers ------------ */
function getInitData(): string | null {
  try {
    // @ts-ignore
    const raw = typeof window !== "undefined" ? window?.Telegram?.WebApp?.initData : null;
    if (!raw || typeof raw !== "string" || raw.length === 0) return null;
    return raw;
  } catch {
    return null;
  }
}

function getTGUsername(): string | null {
  try {
    // @ts-ignore
    const u = typeof window !== "undefined" ? window?.Telegram?.WebApp?.user?.username : null;
    return typeof u === "string" && u ? u : null;
  } catch {
    return null;
  }
}

/* ------------ fetch helper ------------ */
async function fetchJson(method: string, url: string, data?: unknown, signal?: AbortSignal) {
  const base = await getApiBase();
  const fullUrl = joinBase(base, url);

  console.log("[fetchJson] →", fullUrl); // ✅ log URL

  const headers: Record<string, string> = { Accept: "application/json" };
  if (data) headers["Content-Type"] = "application/json";

  const initData = getInitData();
  if (initData) headers["x-telegram-init-data"] = initData;

  const uname = getTGUsername();
  if (uname) headers["x-telegram-username"] = uname;

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal,
  });

  let payload: any = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    let msg =
      (payload && (payload.error || payload.message)) ||
      res.statusText ||
      `HTTP ${res.status}`;
    if (payload?.issues) {
      try { msg += ` :: ${JSON.stringify(payload.issues)}`; } catch {}
    }
    const err: any = new Error(`${res.status}: ${msg}`);
    if (payload?.issues) err.issues = payload.issues;
    throw err;
  }

  return payload ?? {};
}

/* ------------ public API ------------ */
export async function apiRequest(method: string, url: string, data?: unknown): Promise<any> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20_000);
  try {
    return await fetchJson(method, url, data, ac.signal);
  } finally {
    clearTimeout(t);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey, signal }) => {
    const base = await getApiBase();

    const first = (queryKey as any)[0];
    let path = Array.isArray(queryKey) ? (queryKey as any[]).join("/") : String(queryKey);
    if (typeof first === "string" && (first.startsWith("/") || /^https?:\/\//i.test(first))) {
      path = first;
    }

    const url = joinBase(base, path);
    console.log("[getQueryFn] →", url); // ✅ log URL

    const headers: Record<string, string> = { Accept: "application/json" };
    const initData = getInitData();
    if (initData) headers["x-telegram-init-data"] = initData;

    const uname = getTGUsername();
    if (uname) headers["x-telegram-username"] = uname;

    const res = await fetch(url, { credentials: "include", headers, signal });

    let payload: any = null;
    const text = await res.text();
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

    if (on401 === "returnNull" && res.status === 401) return null as T;

    if (!res.ok) {
      let msg =
        (payload && (payload.error || payload.message)) ||
        res.statusText ||
        `HTTP ${res.status}`;
      if (payload?.issues) {
        try { msg += ` :: ${JSON.stringify(payload.issues)}`; } catch {}
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