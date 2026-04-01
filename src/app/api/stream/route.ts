import { NextRequest, NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let videoPath = searchParams.get("path");

    if (!videoPath) {
      return new NextResponse("Missing video path", { status: 400 });
    }

    // Attempt to extract the relative firebase storage path if a full URL is provided
    if (videoPath.startsWith("http")) {
      try {
        const url = new URL(videoPath);
        // Identify 'bucket/o/path%2Fto%2Ffilename' format
        const pathPart = url.pathname.split("/o/")[1];
        if (pathPart) {
          videoPath = decodeURIComponent(pathPart.split("?")[0]);
        } else {
            // Cannot reliably extract storage path, redirect to original URL
            // This fallback prevents breaking existing direct URL streams
            return NextResponse.redirect(videoPath, { status: 302 });
        }
      } catch (e) {
        console.warn("Failed to parse incoming HTTP URL path for video streaming.");
      }
    }

    const bucket = adminStorage.bucket();
    const file = bucket.file(videoPath);

    // Verify file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.error(`Video file not found at path: ${videoPath}`);
      return new NextResponse("Video file not found", { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size) || 0;
    const contentType = metadata.contentType || "video/mp4";

    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      // Parse the Range header (e.g., "bytes=0-1048575")
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : size - 1;

      // Define max chunk size (10MB) to optimize network/memory & prevent Edge/Serverless timeouts.
      const CHUNK_SIZE_MAX = 10 * 1024 * 1024;
      if (end - start + 1 > CHUNK_SIZE_MAX) {
        end = start + CHUNK_SIZE_MAX - 1;
      }
      
      // Ensure end doesn't exceed the actual file bounds
      if (end >= size) {
        end = size - 1;
      }

      const contentLength = end - start + 1;

      // Create a native ReadStream directly from Admin SDK Storage pipeline
      const fileStream = file.createReadStream({ start, end });

      // Wrap the Node ReadStream into a standard Web ReadableStream
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => {
            controller.enqueue(chunk);
          });
          fileStream.on("end", () => {
            controller.close();
          });
          fileStream.on("error", (err) => {
            console.error("Streaming error:", err);
            controller.error(err);
          });
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": contentLength.toString(),
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600, must-revalidate",
        },
      });
    } else {
      // Fallback for non-range requests, though HTML5 video usually relies on Range requests out-of-the-box.
      const fileStream = file.createReadStream();
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Length": size.toString(),
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch (error) {
    console.error("Video processing and streaming error:", error);
    return new NextResponse("Internal Server Error processing streaming request", { status: 500 });
  }
}