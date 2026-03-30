import { NextRequest, NextResponse } from "next/server";

/**
 * Video Proxy Route — /api/video?url=<encoded-firebase-url>
 *
 * Serves Firebase Storage videos from our own domain to avoid CORS issues.
 * Properly forwards HTTP Range headers so browsers can:
 *   1. Seek without downloading the full file
 *   2. Start playback without waiting for full download
 *   3. Cache segments locally
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const encodedUrl = searchParams.get("url");

    if (!encodedUrl) {
        return new NextResponse("Missing url parameter", { status: 400 });
    }

    let videoUrl: string;
    try {
        videoUrl = decodeURIComponent(encodedUrl);
    } catch {
        return new NextResponse("Invalid url parameter", { status: 400 });
    }

    // Only allow Firebase Storage URLs for security
    const isFirebaseStorage =
        videoUrl.includes("firebasestorage.googleapis.com") ||
        videoUrl.includes("firebasestorage.app") ||
        videoUrl.startsWith("https://storage.googleapis.com");

    if (!isFirebaseStorage) {
        return new NextResponse("URL not allowed", { status: 403 });
    }

    // Forward the Range header from the browser for byte-range support
    const rangeHeader = request.headers.get("range");
    const requestHeaders: HeadersInit = {
        "Accept": "*/*",
        "User-Agent": "EditoHub-VideoProxy/1.0",
    };
    if (rangeHeader) {
        requestHeaders["Range"] = rangeHeader;
    }

    try {
        const upstream = await fetch(videoUrl, {
            headers: requestHeaders,
            // Important: stream the response, don't buffer in memory
            cache: "no-store",
        });

        if (!upstream.ok && upstream.status !== 206) {
            return new NextResponse(`Upstream error: ${upstream.status}`, {
                status: upstream.status,
            });
        }

        // Build response headers
        const responseHeaders: HeadersInit = {
            // Cache aggressively — video content doesn't change
            "Cache-Control": "public, max-age=86400, immutable",
            // CORS open — browser fetches from our domain but still show correct content type
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Content-Type",
            "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length",
        };

        // Forward content headers from upstream
        const contentType = upstream.headers.get("content-type");
        const contentLength = upstream.headers.get("content-length");
        const contentRange = upstream.headers.get("content-range");
        const acceptRanges = upstream.headers.get("accept-ranges");

        if (contentType) responseHeaders["Content-Type"] = contentType;
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        if (contentRange) responseHeaders["Content-Range"] = contentRange;
        if (acceptRanges) responseHeaders["Accept-Ranges"] = acceptRanges;

        // Use 206 partial content for range requests
        const status = upstream.status === 206 ? 206 : 200;

        return new NextResponse(upstream.body, {
            status,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error("[VideoProxy] Error fetching upstream:", error);
        return new NextResponse("Failed to fetch video", { status: 502 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Content-Type",
            "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length",
        },
    });
}
