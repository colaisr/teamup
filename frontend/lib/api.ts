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
const API_ERROR_CODE_PROP = "apiErrorCode";

/** FastAPI may return `detail: { code, message }` for stable client handling. */
export type ApiErrorWithCode = Error & { readonly apiErrorCode?: string };

function throwHttpDetail(detail: unknown, httpStatus: number): never {
  if (typeof detail === "string" && detail.trim().length > 0) {
    throw new Error(detail.trim());
  }
  if (
    detail &&
    typeof detail === "object" &&
    !Array.isArray(detail) &&
    "message" in detail &&
    typeof (detail as { message: unknown }).message === "string"
  ) {
    const msg = ((detail as { message: string }).message || "").trim() || `HTTP ${httpStatus}`;
    const codeRaw = (detail as { code?: unknown }).code;
    const code = typeof codeRaw === "string" ? codeRaw : undefined;
    const err = new Error(msg) as ApiErrorWithCode;
    if (code) Object.defineProperty(err, API_ERROR_CODE_PROP, { value: code, enumerable: true });
    throw err;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first && typeof (first as { msg: unknown }).msg === "string") {
      throw new Error((first as { msg: string }).msg);
    }
  }
  throw new Error(`HTTP ${httpStatus}`);
}

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
  const raw = await res.text().catch(() => "");

  if (!res.ok) {
    let payload: unknown = null;
    if (raw.trim()) {
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        payload = raw;
      }
    }
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      throwHttpDetail(detail, res.status);
    }
    if (typeof payload === "string" && payload.trim().length > 0) {
      const s = payload.length > 400 ? `${payload.slice(0, 400)}…` : payload;
      throw new Error(s);
    }
    throw new Error(`HTTP ${res.status}`);
  }

  if (res.status === 204 || raw.trim().length === 0) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Не удалось разобрать ответ сервера (HTTP ${res.status})`);
  }
}

