import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const url = request.nextUrl.searchParams.get("url");
        const filename = request.nextUrl.searchParams.get("filename") || "downloaded-file";

        if (!url) {
            return new NextResponse("Missing URL parameter", { status: 400 });
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            return new NextResponse(`Failed to fetch file: ${response.statusText}`, { status: response.status });
        }

        const headers = new Headers(response.headers);
        headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
        
        // Return original content-type if available, otherwise default out
        if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/octet-stream");
        }

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error("Download proxy error:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
