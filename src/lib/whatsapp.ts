
const AISENSY_API_KEY = process.env.AISENSY_API_KEY;
const AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

import { adminDb } from "@/lib/firebase/admin";
import { Project, User } from "@/types/schema";

// Configuration for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Helper to delay execution
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validates and formats phone number for Indian numbers
 */
function formatPhoneNumber(phoneNumber: string): { valid: boolean; formatted: string; error?: string } {
    if (!phoneNumber) {
        return { valid: false, formatted: '', error: "Phone number is required" };
    }

    const sanitized = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (sanitized.length === 10) {
        // Indian mobile without country code
        return { valid: true, formatted: `91${sanitized}` };
    } else if (sanitized.length === 12 && sanitized.startsWith('91')) {
        // Indian mobile with country code
        return { valid: true, formatted: sanitized };
    } else if (sanitized.length === 11 && sanitized.startsWith('0')) {
        // Indian mobile with leading 0
        return { valid: true, formatted: `91${sanitized.slice(1)}` };
    } else if (sanitized.length === 13 && sanitized.startsWith('091')) {
        // Indian mobile with 0 + country code
        return { valid: true, formatted: sanitized.slice(1) };
    }
    
    return { valid: false, formatted: '', error: `Invalid phone format: ${phoneNumber}` };
}

/**
 * Sends a WhatsApp notification via AiSensy with retry logic
 */
export async function sendWhatsAppNotification(
    phoneNumber: string,
    params: string[],
    campaignName: string,
    retryCount = 0
): Promise<{ success: boolean; error?: string; data?: any }> {
    console.log(`[WhatsApp] Attempting send to ${phoneNumber} via campaign "${campaignName}" (attempt ${retryCount + 1})`);

    // Validate phone number
    const phoneResult = formatPhoneNumber(phoneNumber);
    if (!phoneResult.valid) {
        console.warn(`[WhatsApp] ${phoneResult.error}`);
        return { success: false, error: phoneResult.error };
    }

    // Check API key
    if (!AISENSY_API_KEY) {
        console.error("[WhatsApp] AISENSY_API_KEY is missing from environment variables");
        return { success: false, error: "WhatsApp service not configured. Please add AISENSY_API_KEY to environment." };
    }

    const payload = {
        apiKey: AISENSY_API_KEY,
        campaignName: campaignName,
        destination: phoneResult.formatted,
        userName: phoneResult.formatted,
        templateParams: params,
        source: "EditoHub-API"
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(AISENSY_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        
        if (!response.ok) {
            console.error("[WhatsApp] AiSensy Error:", data);
            
            // Retry on certain errors
            if (retryCount < MAX_RETRIES && (response.status >= 500 || response.status === 429)) {
                console.log(`[WhatsApp] Retrying in ${RETRY_DELAY}ms...`);
                await delay(RETRY_DELAY * (retryCount + 1)); // Exponential backoff
                return sendWhatsAppNotification(phoneNumber, params, campaignName, retryCount + 1);
            }
            
            return { success: false, error: data.message || `Request failed with status ${response.status}` };
        }
        
        console.log("[WhatsApp] Success:", data);
        return { success: true, data };
        
    } catch (error: any) {
        console.error("[WhatsApp] Network Error:", error);
        
        // Retry on network errors
        if (retryCount < MAX_RETRIES && (error.name === 'AbortError' || error.code === 'ECONNRESET')) {
            console.log(`[WhatsApp] Network error, retrying in ${RETRY_DELAY}ms...`);
            await delay(RETRY_DELAY * (retryCount + 1));
            return sendWhatsAppNotification(phoneNumber, params, campaignName, retryCount + 1);
        }
        
        return { success: false, error: error.message || "Network error occurred" };
    }
}

export type WhatsAppTrigger =
    | 'PROJECT_RECEIVED'      // Sent when client uploads project
    | 'EDITOR_ASSIGNED'      // Sent when PM assigns editor
    | 'EDITOR_ACCEPTED'      // Sent when editor accepts
    | 'PROPOSAL_UPLOADED'    // Sent when editor uploads proposal
    | 'PROJECT_COMPLETED';    // Sent when project is marked as completed

/**
 * Higher level helper to notify a client based on project events
 */
export async function notifyClient(projectId: string, trigger: WhatsAppTrigger, extraData?: any) {
    try {
        const projectSnap = await adminDb.collection('projects').doc(projectId).get();
        if (!projectSnap.exists) return { success: false, error: "Project not found" };
        const project = projectSnap.data() as Project;

        if (!project.clientId) return { success: false, error: "No client assigned" };
        const clientSnap = await adminDb.collection('users').doc(project.clientId).get();
        if (!clientSnap.exists) return { success: false, error: "Client not found" };
        const client = clientSnap.data() as User;

        if (!client.phoneNumber) return { success: false, error: "No phone number" };

        let params: string[] = [];
        let campaignName = "editohub";

        // Fetch custom templates if any
        let customTemplates: any = {};
        try {
            const settingsSnap = await adminDb.collection('settings').doc('whatsapp').get();
            if (settingsSnap.exists) {
                customTemplates = settingsSnap.data() || {};
            }
        } catch (err) {
            console.error("[WhatsApp] Failed to fetch custom templates, using defaults.");
        }

        const getMessage = (key: WhatsAppTrigger, defaultMsg: string) => {
            let msg = customTemplates[key] || defaultMsg;
            if (key === 'PROPOSAL_UPLOADED') {
                msg = msg.replace('{{reviewLink}}', extraData?.reviewLink || 'Dashboard');
            }
            return msg;
        };

        switch (trigger) {
            case 'PROJECT_RECEIVED':
                params = [
                    client.displayName || "Client",
                    project.name,
                    getMessage('PROJECT_RECEIVED', "We have received your request. We're currently finding the best editor for you.")
                ];
                break;
            case 'EDITOR_ASSIGNED':
                params = [
                    client.displayName || "Client",
                    project.name,
                    getMessage('EDITOR_ASSIGNED', "A specialist editor has been assigned and is reviewing your requirements.")
                ];
                break;
            case 'EDITOR_ACCEPTED':
                params = [
                    client.displayName || "Client",
                    project.name,
                    getMessage('EDITOR_ACCEPTED', "Production has officially started! We'll notify you once the first draft is ready.")
                ];
                break;
            case 'PROPOSAL_UPLOADED':
                params = [
                    client.displayName || "Client",
                    project.name,
                    getMessage('PROPOSAL_UPLOADED', `A new draft is ready for review! View it here: ${extraData?.reviewLink || 'Dashboard'}`)
                ];
                break;
            case 'PROJECT_COMPLETED':
                params = [
                    client.displayName || "Client",
                    project.name,
                    getMessage('PROJECT_COMPLETED', "Congratulations! Your project is now complete and all files are ready for final download. Thank you for choosing EditoHub!")
                ];
                break;
        }

        // Use the campaign name "editohub" if specifically requested or if custom campaigns aren't set up
        // For now, using specialized names as per typical professional setup
        return await sendWhatsAppNotification(client.phoneNumber, params, campaignName);

    } catch (error: any) {
        console.error("[WhatsApp] Helper Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * @deprecated Use notifyClient instead
 */
export async function notifyClientOfStatusUpdate(projectId: string, status: string) {
    // Keep for backward compatibility but redirect to notifyClient if it matches
    const triggerMap: Record<string, WhatsAppTrigger> = {
        'pending_assignment': 'PROJECT_RECEIVED',
        'active': 'EDITOR_ACCEPTED',
        'completed': 'PROJECT_COMPLETED',
    };

    if (triggerMap[status]) {
        return notifyClient(projectId, triggerMap[status]);
    }

    return { success: true }; // Skip if no mapping
}
