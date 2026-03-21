import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "crypto";
import { getWhatsAppEnvConfig, sendWhatsAppMessage, WhatsAppSendPayload } from "@/lib/server/whatsapp-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const requestId = randomUUID();

    try {
        const envCheck = getWhatsAppEnvConfig();
        if (!envCheck.valid || !envCheck.config) {
            return NextResponse.json(
                {
                    success: false,
                    requestId,
                    error: "Missing WhatsApp environment configuration",
                    missing: envCheck.missing,
                },
                { status: 500 }
            );
        }

        const body = await request.json();
        const to = typeof body?.to === "string" ? body.to : "";
        const text = typeof body?.text === "string" ? body.text : "";
        const payload = body?.payload as WhatsAppSendPayload | undefined;

        if (!to || (!text && !payload)) {
            return NextResponse.json(
                {
                    success: false,
                    requestId,
                    error: "Either { to, text } or { to, payload } is required",
                },
                { status: 400 }
            );
        }

        const finalPayload: WhatsAppSendPayload = payload
            ? { ...payload, to }
            : {
                  to,
                  type: "text",
                  text: {
                      body: text,
                  },
              };

        // Non-blocking dispatch to reduce serverless latency and avoid request timeout.
        after(async () => {
            const result = await sendWhatsAppMessage(envCheck.config!, finalPayload, {
                timeoutMs: 30_000,
                maxRetries: 2,
                requestId,
            });

            if (!result.success) {
                console.error("[WhatsApp][send route] async dispatch failed", result);
            } else {
                console.log("[WhatsApp][send route] async dispatch sent", {
                    requestId,
                    status: result.status,
                    attempts: result.attempts,
                });
            }
        });

        return NextResponse.json(
            {
                success: true,
                accepted: true,
                requestId,
                message: "WhatsApp dispatch queued",
            },
            { status: 202 }
        );
    } catch (error) {
        const err = error as Error;
        console.error("[WhatsApp][send route] unhandled error", {
            requestId,
            message: err?.message,
            stack: err?.stack,
        });

        return NextResponse.json(
            {
                success: false,
                requestId,
                error: err?.message || "Unexpected error",
            },
            { status: 500 }
        );
    }
}
