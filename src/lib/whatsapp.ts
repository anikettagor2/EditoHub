
const AISENSY_API_KEY = process.env.EDITOHUB_AISENSY_API_KEY;
const AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

import { db } from "@/lib/firebaseAdmin";
import { Project, User } from "@/types/schema";

/**
 * Sends a WhatsApp notification via AiSensy
 * @param phoneNumber 10-digit phone number
 * @param clientName Name of the client
 * @param projectName Name of the project
 * @param status New status of the project
 */
export async function sendWhatsAppNotification(
    phoneNumber: string,
    clientName: string,
    projectName: string,
    status: string
) {
    // Basic sanitization: remove all non-digits
    const sanitized = phoneNumber.replace(/\D/g, '');

    // If it starts with 91 and has 12 digits, it's already full. 
    // If it's 10 digits, prepend 91.
    let finalPhone = sanitized;
    if (sanitized.length === 10) {
        finalPhone = `91${sanitized}`;
    } else if (sanitized.length === 12 && sanitized.startsWith('91')) {
        finalPhone = sanitized;
    } else {
        console.warn(`[WhatsApp] Invalid phone format: ${phoneNumber}. Expected 10 digits (without 91) or 12 digits (with 91).`);
        return { success: false, error: "Invalid phone format. Please provide a 10-digit number." };
    }

    if (!AISENSY_API_KEY) {
        console.error("[WhatsApp] AISENSY_API_KEY is missing in environment variables.");
        return { success: false, error: "Service configuration error" };
    }

    // Map status to user-friendly labels if needed
    const statusLabels: Record<string, string> = {
        'active': 'In Production',
        'in_review': 'Ready for Review',
        'approved': 'Approved',
        'completed': 'Completed',
        'pending_assignment': 'Pending Assignment'
    };

    const displayStatus = statusLabels[status] || status;

    const payload = {
        apiKey: AISENSY_API_KEY,
        campaignName: "editohub", // Matches your AiSensy dashboard
        destination: finalPhone,
        userName: clientName,
        templateParams: [
            clientName,
            projectName,
            displayStatus
        ],
        source: "API"
    };

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            console.log(`[WhatsApp] Attempt ${attempts}: Sending ${status} notification to ${finalPhone}...`);

            const response = await fetch(AISENSY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(`[WhatsApp] AiSensy API Error (Attempt ${attempts}):`, JSON.stringify(data, null, 2));
                return { success: false, error: data.message || "AiSensy API error" };
            }

            console.log(`[WhatsApp] Notification accepted by AiSensy:`, JSON.stringify(data, null, 2));
            return { success: true, data };

        } catch (error: any) {
            console.error(`[WhatsApp] Network Error (Attempt ${attempts}):`, error.message);

            // If it's a network error (like ENOTFOUND), retry after a short delay
            if (attempts < maxAttempts) {
                const delay = attempts * 1000;
                console.log(`[WhatsApp] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                return { success: false, error: `Network failed after ${maxAttempts} attempts: ${error.message}` };
            }
        }
    }

    return { success: false, error: "Exceeded max retry attempts" };
}

/**
 * Higher level helper to notify a client based on projectId
 */
export async function notifyClientOfStatusUpdate(projectId: string, status: string) {
    try {
        // 1. Fetch Project
        const projectSnap = await db.collection('projects').doc(projectId).get();
        if (!projectSnap.exists) return { success: false, error: "Project not found" };
        const project = projectSnap.data() as Project;

        // 2. Fetch Client
        if (!project.clientId) return { success: false, error: "No client assigned to project" };
        const clientSnap = await db.collection('users').doc(project.clientId).get();
        if (!clientSnap.exists) return { success: false, error: "Client not found" };
        const client = clientSnap.data() as User;

        if (!client.phoneNumber) {
            console.warn(`[WhatsApp] Client ${client.displayName} has no phone number.`);
            return { success: false, error: "Client has no phone number" };
        }

        // 3. Send Notification
        return await sendWhatsAppNotification(
            client.phoneNumber,
            client.displayName || "Client",
            project.name,
            status
        );

    } catch (error: any) {
        console.error("[WhatsApp] Helper Error:", error);
        return { success: false, error: error.message };
    }
}
