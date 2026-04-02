import { NextRequest, NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
    const { url, fileName } = await req.json();
    if (!url) return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });

    try {
        if (!url.includes("firebasestorage.googleapis.com")) {
            return NextResponse.json({ success: true, url });
        }
        const pathParts = url.split("/o/");
        if (pathParts.length > 1) {
            const encodedPath = pathParts[1].split("?")[0];
            const fullPath = decodeURIComponent(encodedPath);
            const file = adminStorage.bucket().file(fullPath);
            const safeFileName = fileName ? fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_") : "download";
            const [signedUrl] = await file.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + 60 * 60 * 1000,
                promptSaveAs: safeFileName,
                responseDisposition: `attachment; filename=\"${safeFileName}\"`
            });
            return NextResponse.json({ success: true, url: signedUrl });
        }
        return NextResponse.json({ success: false, error: "Invalid storage URL" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
