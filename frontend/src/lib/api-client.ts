export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

const API_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 10000,
};

const DEBUG_MODE = process.env.NODE_ENV !== "production";

class APIClient {
  public baseURL: string;
  public token: string | null;
  private activeRequests = 0;
  private queue: (() => void)[] = [];
  private maxConcurrent = 2;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("@EstoqueApp:token");
    }
  }

  log(...args: any[]) {
    if (DEBUG_MODE) {
      // console.log("[API Client]", ...args);
    }
  }

  getToken(): string | null {
    if (typeof window !== "undefined" && !this.token) {
      this.token = localStorage.getItem("@EstoqueApp:token");
    }
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token || null;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("@EstoqueApp:token", token);
      } else {
        localStorage.removeItem("@EstoqueApp:token");
      }
    }
  }

  async fetchWithRetry(
    url: string,
    options: RequestInit & { skipAuthRedirect?: boolean } = {},
    retries = API_CONFIG.maxRetries
  ): Promise<any> {
    // Global Concurrency Queue Logic
    if (this.activeRequests >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.activeRequests++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    try {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
      };

      const hasBody = options.body !== undefined && options.body !== null;
      const contentTypeAlreadySet = Object.keys(headers).some(
        (key) => key.toLowerCase() === "content-type"
      );
      const isFormLikeBody =
        typeof FormData !== "undefined" && options.body instanceof FormData;

      // Most service calls send JSON.stringify(body). Without this header,
      // Express may not parse req.body and endpoints return 400 for missing fields.
      if (hasBody && !contentTypeAlreadySet && !isFormLikeBody) {
        headers["Content-Type"] = "application/json";
      }

      const token = this.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let backendMessage = "";
        try {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const errorJson = await response.json();
            backendMessage = errorJson?.error || errorJson?.message || "";
          } else {
            backendMessage = (await response.text())?.trim() || "";
          }
        } catch (_) {
          backendMessage = "";
        }

        const fallback = `HTTP ${response.status}: ${response.statusText}`;
        const error: any = new Error(
          backendMessage ? `${fallback} - ${backendMessage}` : fallback
        );
        error.status = response.status;
        error.backendMessage = backendMessage;

        // Auto logout on 401
        if (response.status === 401 && !options.skipAuthRedirect) {
          this.setToken(null);
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }

        throw error;
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error: any) {
      const status = Number(error?.status || 0);
      const isAuthOrClientError =
        (status >= 400 && status < 500 && status !== 408) && status !== 429;

      if (retries > 0 && !isAuthOrClientError && error.name !== "AbortError") {
        const isRateLimit = status === 429;
        const backoffFactor = isRateLimit ? Math.pow(2, API_CONFIG.maxRetries - retries + 1) : 1;
        const delay = API_CONFIG.retryDelay * backoffFactor;

        this.log(
          `Retry... (${API_CONFIG.maxRetries - retries + 1}/${
            API_CONFIG.maxRetries
          }) - Delay: ${delay}ms ${isRateLimit ? '[Rate Limit]' : ''}`
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      this.activeRequests--;
      const nextRequest = this.queue.shift();
      if (nextRequest) nextRequest();
    }
  }
}

export const api = new APIClient();
