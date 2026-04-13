import { NextRequest, NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
    const { url, fileName } = await req.json();
    console.log('[API Download] Request received:', { url, fileName });

    if (!url) {
        console.log('[API Download] No URL provided');
        return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });
    }

    try {
        // Only Firebase Storage URLs are supported for downloads
        if (!url.includes("firebasestorage.googleapis.com")) {
            console.warn('[API Download] Non-Firebase URL provided, rejecting');
            return NextResponse.json(
                { success: false, error: "Only Firebase Storage downloads are supported" },
                { status: 400 }
            );
        }

        const pathParts = url.split("/o/");
        if (pathParts.length > 1) {
            const encodedPath = pathParts[1].split("?")[0];
            const fullPath = decodeURIComponent(encodedPath);
            console.log('[API Download] Extracted path:', fullPath);

            const file = adminStorage.bucket().file(fullPath);
            const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") : "video.mp4";

            // Get file metadata
            const [metadata] = await file.getMetadata().catch(() => [{}]);
            const contentType = (metadata as any)?.contentType || 'video/mp4';

            console.log('[API Download] File metadata:', { contentType, size: (metadata as any)?.size });

            // Generate signed URL for reading (1 hour expiration)
            const [signedUrl] = await file.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + 60 * 60 * 1000,
            });

            console.log('[API Download] Signed URL generated, fetching file content');

            // Fetch the file content
            const response = await fetch(signedUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status}`);
            }

            const blob = await response.blob();
            console.log('[API Download] File fetched successfully, size:', blob.size);

            // Return the file with forced download headers
            const headers = new Headers();
            headers.set('Content-Type', contentType);
            headers.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
            headers.set('Content-Length', blob.size.toString());
            headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

            return new NextResponse(blob, {
                status: 200,
                headers,
            });
        }

        console.log('[API Download] Invalid Firebase URL format');
        return NextResponse.json({ success: false, error: "Invalid Firebase URL format" }, { status: 400 });

    } catch (err: any) {
        console.error('[API Download] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
