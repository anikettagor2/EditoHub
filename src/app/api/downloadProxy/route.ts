import { NextRequest, NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const url = searchParams.get("url");
    const fileName = searchParams.get("fileName");

    if (!url) {
        return new NextResponse("No URL provided", { status: 400 });
    }

    try {
        if (!url.includes("firebasestorage.googleapis.com")) {
            // Redirect directly if not firebase storage
            return NextResponse.redirect(url);
        }

        const pathParts = url.split("/o/");
        if (pathParts.length > 1) {
            const encodedPath = pathParts[1].split("?")[0];
            const fullPath = decodeURIComponent(encodedPath);

            const file = adminStorage.bucket().file(fullPath);
            const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") : "download";

            // Generate signed URL that directly FORCES the browser to download it as an attachment
            const [signedUrl] = await file.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
                promptSaveAs: safeFileName, // This populates responseDisposition: "attachment; filename="...""
            });

            // Redirect the user to this signed URL. Since it has attachment disposition, 
            // the browser will start a download natively rather than rendering the video.
            return NextResponse.redirect(signedUrl);
        }

        return new NextResponse("Invalid storage URL", { status: 400 });
    } catch (err: any) {
        console.error('[API Proxy Download] Error:', err);
        return new NextResponse(err.message, { status: 500 });
    }
}
