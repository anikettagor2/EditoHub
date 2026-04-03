import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const commentId = body?.commentId;

    if (!commentId || typeof commentId !== "string") {
      return NextResponse.json({ success: false, message: "Missing commentId" }, { status: 400 });
    }

    await adminDb.collection("comments").doc(commentId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /comments/delete] Error deleting comment:", error);
    return NextResponse.json({ success: false, message: "Failed to delete comment" }, { status: 500 });
  }
}
