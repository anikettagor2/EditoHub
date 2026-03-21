import { randomUUID } from "crypto";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export type WhatsAppSendPayload = {
    messaging_product?: "whatsapp";
    recipient_type?: "individual";
    to: string;
    type?: "text" | string;
    text?: {
        body: string;
        preview_url?: boolean;
    };
    [key: string]: unknown;
};

export type WhatsAppClientConfig = {
    token: string;
    phoneNumberId: string;
    apiUrl?: string;
};

export type WhatsAppSendResult = {
    success: boolean;
    status?: number;
    data?: unknown;
    error?: string;
    requestId: string;
    attempts: number;
};

function ensureHttpsUrl(value: string): URL {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
        throw new Error("WHATSAPP_API_URL must use HTTPS");
    }
    return parsed;
}

function buildMessagesEndpoint(config: WhatsAppClientConfig): string {
    const base = ensureHttpsUrl(config.apiUrl || "https://graph.facebook.com/v21.0");
    const normalizedPath = base.pathname.endsWith("/") ? base.pathname.slice(0, -1) : base.pathname;
    const messagesPath = `${normalizedPath}/${config.phoneNumberId}/messages`;
    return `${base.origin}${messagesPath}`;
}

function redactBearer(token: string): string {
    if (!token) return "";
    if (token.length < 10) return "***";
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

async function safeReadBody(response: Response): Promise<string> {
    try {
        return await response.text();
    } catch {
        return "<failed to read response body>";
    }
}

async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

export async function sendWhatsAppMessage(
    config: WhatsAppClientConfig,
    payload: WhatsAppSendPayload,
    options?: {
        timeoutMs?: number;
        maxRetries?: number;
        requestId?: string;
    }
): Promise<WhatsAppSendResult> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const requestId = options?.requestId ?? randomUUID();

    const endpoint = buildMessagesEndpoint(config);
    let lastError = "Unknown error";

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const response = await fetchWithTimeout(
                endpoint,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${config.token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        type: "text",
                        ...payload,
                    }),
                },
                timeoutMs
            );

            const rawBody = await safeReadBody(response);
            const parsedBody = (() => {
                try {
                    return JSON.parse(rawBody);
                } catch {
                    return rawBody;
                }
            })();

            if (response.ok) {
                return {
                    success: true,
                    status: response.status,
                    data: parsedBody,
                    requestId,
                    attempts: attempt + 1,
                };
            }

            console.error("[WhatsApp] API non-OK response", {
                requestId,
                attempt: attempt + 1,
                status: response.status,
                body: parsedBody,
                endpoint,
            });

            lastError = `HTTP ${response.status}`;
            const shouldRetry = response.status >= 500 || response.status === 429;
            if (!shouldRetry || attempt >= maxRetries) {
                return {
                    success: false,
                    status: response.status,
                    data: parsedBody,
                    error: lastError,
                    requestId,
                    attempts: attempt + 1,
                };
            }
        } catch (error) {
            const errorObject = error as Error;
            lastError = errorObject?.message || "Request failed";

            console.error("[WhatsApp] Request error", {
                requestId,
                attempt: attempt + 1,
                endpoint,
                token: redactBearer(config.token),
                stack: errorObject?.stack,
            });

            const isAbort = (error as any)?.name === "AbortError";
            if (attempt >= maxRetries) {
                return {
                    success: false,
                    error: isAbort ? "Request aborted due to timeout" : lastError,
                    requestId,
                    attempts: attempt + 1,
                };
            }
        }

        const backoffMs = 500 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    return {
        success: false,
        error: lastError,
        requestId,
        attempts: maxRetries + 1,
    };
}

export function getWhatsAppEnvConfig(): { valid: boolean; missing: string[]; config?: WhatsAppClientConfig } {
    const token = process.env.WHATSAPP_TOKEN || "";
    const phoneNumberId = process.env.PHONE_NUMBER_ID || "";
    const apiUrl = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v21.0";

    const missing: string[] = [];
    if (!token) missing.push("WHATSAPP_TOKEN");
    if (!phoneNumberId) missing.push("PHONE_NUMBER_ID");
    if (!apiUrl) missing.push("WHATSAPP_API_URL");

    if (missing.length > 0) {
        return { valid: false, missing };
    }

    return {
        valid: true,
        missing: [],
        config: {
            token,
            phoneNumberId,
            apiUrl,
        },
    };
}
