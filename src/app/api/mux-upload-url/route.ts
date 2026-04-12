import Mux from "@mux/mux-node";
import { NextRequest, NextResponse } from "next/server";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
});

export async function POST(request: NextRequest) {
    try {
        if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
            console.error("[Mux] Missing API credentials in environment variables");
            return NextResponse.json({ error: "Server configuration error: Missing Mux credentials" }, { status: 500 });
        }

        const { projectId, revisionId, type } = await request.json();
        const origin = request.headers.get("origin");
        // Ensure origin is never null/empty for Mux cors_origin
        const finalOrigin = origin && origin !== 'null' ? origin : "*";

        console.log(`[Mux] Creating Direct Upload:`, {
            projectId,
            revisionId,
            type,
            origin: finalOrigin,
            userAgent: request.headers.get("user-agent")
        });

        const upload = await mux.video.uploads.create({
            new_asset_settings: {
                playback_policy: ["public"],
                passthrough: JSON.stringify({
                    projectId,
                    revisionId,
                    type: type || "revision",
                }),
            },
            cors_origin: finalOrigin,
        });

        return NextResponse.json({
            uploadUrl: upload.url,
            uploadId: upload.id,
            origin: origin, // Return for debugging
        });
    } catch (error: any) {
        console.error("[Mux] Create Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
