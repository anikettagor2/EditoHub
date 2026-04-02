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
        if (!url.includes("firebasestorage.googleapis.com")) {
            console.log('[API Download] Non-Firebase URL, returning as-is');
            return NextResponse.json({ success: true, url });
        }

        const pathParts = url.split("/o/");
        if (pathParts.length > 1) {
            const encodedPath = pathParts[1].split("?")[0];
            const fullPath = decodeURIComponent(encodedPath);
            console.log('[API Download] Extracted path:', fullPath);

            const file = adminStorage.bucket().file(fullPath);
            const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") : "download";

            // Get file metadata
            const [metadata] = await file.getMetadata().catch(() => [{}]);
            const contentType = (metadata as any)?.contentType || 'application/octet-stream';

            console.log('[API Download] File metadata:', { contentType, size: (metadata as any)?.size });

            // Generate signed URL for reading
            const [signedUrl] = await file.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });

            console.log('[API Download] Signed URL generated, now fetching file content');

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
            headers.set('Cache-Control', 'no-cache');

            return new NextResponse(blob, {
                status: 200,
                headers,
            });
        }

        console.log('[API Download] Invalid storage URL format');
        return NextResponse.json({ success: false, error: "Invalid storage URL" }, { status: 400 });
    } catch (err: any) {
        console.error('[API Download] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
