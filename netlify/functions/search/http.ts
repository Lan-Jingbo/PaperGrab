declare const Netlify:
  | {
      env: {
        get(key: string): string | undefined;
      };
    }
  | undefined;

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = windowlessSetTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function windowlessSetTimeout(callback: () => void, timeoutMs: number) {
  return setTimeout(callback, timeoutMs);
}

export function readEnv(key: string) {
  return typeof Netlify !== "undefined" ? Netlify?.env.get(key) : undefined;
}

export function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}
