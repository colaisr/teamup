/**
 * Browser: если NEXT_PUBLIC_API_BASE_URL не задан — дергаем /api через Next rewrite
 * на бекенд (избегаем прямых cross-origin запросов и части проблем CORS/local).
 */
function resolveApiBase(): string {
  if (typeof window === "undefined") {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/$/, "");
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "";
  }
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim().length > 0) return String(fromEnv).replace(/\/$/, "");
  return "";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("teamup_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem("teamup_token");
  else localStorage.setItem("teamup_token", token);
}

/** Поясняет ошибки сети для пользователя (RU). */
export function explainApiError(error: unknown): string {
  if (!(error instanceof Error)) return "Произошла ошибка. Попробуйте ещё раз.";
  const m = error.message || "";
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(m)) {
    return "Нет связи с API: запустите бекенд (uvicorn на порту 8000) или перезапустите frontend после изменения next.config.";
  }
  return m.length > 200 ? `${m.slice(0, 200)}…` : m;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined)
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = resolveApiBase();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text();
    }
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim().length > 0) {
        throw new Error(detail);
      }
    }
    if (typeof payload === "string" && payload.trim().length > 0) {
      throw new Error(payload);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

