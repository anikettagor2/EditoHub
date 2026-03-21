import { NextResponse } from "next/server";
import { getWhatsAppEnvConfig } from "@/lib/server/whatsapp-client";

export const runtime = "nodejs";

export async function GET() {
    try {
        const envCheck = getWhatsAppEnvConfig();
        if (!envCheck.valid || !envCheck.config) {
            return NextResponse.json(
                {
                    success: false,
                    reachable: false,
                    error: "Missing WhatsApp environment variables",
                    missing: envCheck.missing,
                },
                { status: 500 }
            );
        }

        const baseUrl = envCheck.config.apiUrl || "https://graph.facebook.com/v21.0";
        const parsed = new URL(baseUrl);
        if (parsed.protocol !== "https:") {
            return NextResponse.json(
                {
                    success: false,
                    reachable: false,
                    error: "WHATSAPP_API_URL must use HTTPS",
                },
                { status: 400 }
            );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        const endpoint = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/${envCheck.config.phoneNumberId}`;
        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${envCheck.config.token}`,
                "Content-Type": "application/json",
            },
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const rawBody = await response.text();
        let parsedBody: unknown = rawBody;
        try {
            parsedBody = JSON.parse(rawBody);
        } catch {
            // keep raw string
        }

        if (!response.ok) {
            console.error("[WhatsApp][test endpoint] non-OK response", {
                status: response.status,
                body: parsedBody,
                endpoint,
            });
        }

        return NextResponse.json(
            {
                success: response.ok,
                reachable: response.ok,
                status: response.status,
                endpoint,
                response: parsedBody,
                hint: response.ok
                    ? "Connectivity to graph.facebook.com looks good"
                    : "If this fails only in production, ensure host allows outbound HTTPS to graph.facebook.com",
            },
            { status: response.ok ? 200 : 502 }
        );
    } catch (error) {
        const err = error as Error;
        console.error("[WhatsApp][test endpoint] request failed", {
            message: err?.message,
            stack: err?.stack,
        });

        return NextResponse.json(
            {
                success: false,
                reachable: false,
                error: err?.message || "Unexpected connectivity error",
            },
            { status: 500 }
        );
    }
}
