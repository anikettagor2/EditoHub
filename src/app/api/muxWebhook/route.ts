import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, data } = body;

        console.log(`[MuxWebhook] Received event: ${type}`);

        if (type === "video.asset.ready") {
            const asset = data;
            const playbackId = asset.playback_ids?.[0]?.id;
            let metadata: Record<string, unknown> = asset.metadata || {};
            if (asset.passthrough) {
                try {
                    metadata = JSON.parse(asset.passthrough);
                } catch {
                    console.warn("[MuxWebhook] Failed to parse passthrough JSON");
                }
            }
            
            const { projectId, revisionId, type: uploadType } = metadata as {
                projectId?: string;
                revisionId?: string;
                type?: string;
            };

            if (playbackId) {
                if (uploadType === "revision" && revisionId) {
                    await adminDb.collection("revisions").doc(revisionId).set({
                        playbackId,
                        hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
                        status: "ready",
                        updatedAt: Date.now(),
                    }, { merge: true });

                    // Persist on both revisionId and upload_id keyed job docs to avoid missing-doc failures.
                    await adminDb.collection("video_jobs").doc(revisionId).set({
                        status: "ready",
                        playbackId,
                        hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
                        updatedAt: Date.now(),
                    }, { merge: true });
                    if (asset.upload_id) {
                        await adminDb.collection("video_jobs").doc(asset.upload_id).set({
                            status: "ready",
                            playbackId,
                            hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
                            updatedAt: Date.now(),
                        }, { merge: true });
                    }
                    
                    console.log(`[MuxWebhook] Updated revision ${revisionId} with playbackId ${playbackId}`);
                } else if (
                    (
                        uploadType === "raw_footage" ||
                        uploadType === "raw" ||
                        uploadType === "brole_footage" ||
                        uploadType === "pm_file" ||
                        uploadType === "delivered_files"
                    ) &&
                    projectId
                ) {
                    // Try finding by projectId first, then by uploadToken
                    let projectRef = adminDb.collection("projects").doc(projectId);
                    let projectSnap = await projectRef.get();
                    
                    if (!projectSnap.exists) {
                        const snap = await adminDb.collection("projects").where("uploadToken", "==", projectId).limit(1).get();
                        if (!snap.empty) {
                            projectRef = snap.docs[0].ref;
                            projectSnap = snap.docs[0];
                        }
                    }

                    if (projectSnap.exists) {
                        const projectData = projectSnap.data();
                        const uploadId = asset.upload_id;
                        
                        if (uploadId) {
                            const fieldName = 
                                (uploadType === "raw_footage" || uploadType === "raw") ? "rawFiles" : 
                                uploadType === "brole_footage" ? "bRoleFiles" : 
                                uploadType === "pm_file" ? "pmFiles" :
                                "deliveredFiles";
                            
                            const files = [...(projectData?.[fieldName] || [])];
                            const fileIndex = files.findIndex((f: any) => f.url === `mux://${uploadId}` || f.storagePath === `mux://${uploadId}`);
                            
                            if (fileIndex !== -1) {
                                files[fileIndex].playbackId = playbackId;
                                // Also update url to the direct stream URL for convenience, 
                                // though the components should preferably use VideoPlayer with playbackId
                                files[fileIndex].url = `https://stream.mux.com/${playbackId}.m3u8`;
                                await projectRef.update({ [fieldName]: files });
                                console.log(`[MuxWebhook] Updated project ${projectSnap.id} ${uploadType} file at index ${fileIndex}`);
                            }
                        }
                    }
                }
            } else {
                console.warn("[MuxWebhook] video.asset.ready without playbackId", {
                    assetId: asset?.id,
                    uploadId: asset?.upload_id,
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: unknown) {
        console.error("[MuxWebhook] Error:", error);
        const message = error instanceof Error ? error.message : "Webhook processing failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
