
// Firestore Data Models

export type UserRole = 'admin' | 'manager' | 'editor' | 'client' | 'guest' | 'sales_executive' | 'project_manager';

export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
    createdAt: number; // Timestamp
    phoneNumber?: string; // For guests
    customRates?: Record<string, number>; // Custom video rates for this specific client
    allowedFormats?: Record<string, boolean>; // Which video formats are visible
    initialPassword?: string; // Temp password for new users
    createdBy?: string; // UID of sales exec or admin who created this user
    managedBy?: string; // UID of sales exec managing this client
    payLater?: boolean; // New feature: allows client to skip immediate payment
}

export type ProjectStatus = 'active' | 'in_review' | 'approved' | 'completed' | 'archived' | 'pending_assignment';

export interface Project {
    id: string;
    name: string;
    clientId: string; // ID of the client who owns this project
    clientName: string; // Deprecated in favor of 'brand' maybe?
    brand?: string;
    description?: string;
    deadline?: string;
    duration?: number;
    videoType?: string;
    budget?: number;
    totalCost?: number; // Calculated cost
    amountPaid?: number; // Upfront + Final
    paymentStatus?: string; // 'half_paid', 'full_paid'
    assignedEditorId?: string;
    footageLink?: string; // Link to cloud storage
    rawFiles?: { name: string; url: string; size?: number; type?: string; uploadedAt?: number }[]; // Raw video files uploaded by client
    thumbnailUrl?: string; // Cover image
    status: ProjectStatus;
    createdAt: number;
    updatedAt: number;
    members: string[]; // Array of User UIDs (admin, manager, editor, client)
    currentRevisionId?: string; // ID of the latest active revision
    ownerId?: string;
    assignmentStatus?: ProjectAssignmentStatus;
    downloadUnlockRequested?: boolean; // true when a payLater client requests download unlock from PM
    downloadsUnlocked?: boolean;       // true when PM has explicitly approved downloads for this project
    isPayLaterRequest?: boolean;       // true for projects submitted via the Pay Later workflow
}

export type ProjectAssignmentStatus = 'pending' | 'accepted' | 'rejected';

export type RevisionStatus = 'active' | 'approved' | 'changes_requested' | 'archived';

export interface Revision {
    id: string;
    projectId: string;
    version: number; // 1, 2, 3...
    videoUrl: string; // Storage URL
    thumbnailUrl?: string; // Specific frame or generated thumb
    description?: string;
    status: RevisionStatus;
    uploadedBy: string; // User UID
    createdAt: number;
    downloadCount?: number; // Track downloads by client for limits
}

export type CommentStatus = 'open' | 'resolved';

export interface Comment {
    id: string;
    projectId: string; // Denormalized for queries
    revisionId: string;
    userId: string;
    userName: string;
    userAvatar?: string | null;
    userRole: UserRole;
    content: string;
    timestamp: number; // Video timestamp in seconds (float)
    createdAt: number; // Message timestamp
    status: CommentStatus;
    replies?: CommentReply[];
    attachments?: string[]; // URLs
}

export interface CommentReply {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    userRole: UserRole;
    content: string;
    createdAt: number;
}

export interface GuestSession {
    id: string; // Distinct ID, maybe stored in cookie/localStorage
    name: string;
    phoneNumber: string;
    email?: string;
    projectId: string;
    firstSeenAt: number;
}

export interface ClientInput {
    id: string;
    projectId: string;
    revisionId: string; // Linked to a specific round
    type: 'file' | 'link' | 'voice';
    url: string;
    name: string; // Filename or link title
    uploadedBy: string; // User UID
    createdAt: number;
    description?: string;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'comment' | 'mention' | 'revision' | 'approval' | 'assigned';
    title: string;
    message: string;
    link: string;
    read: boolean;
    createdAt: number;
}

export interface InvoiceItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface Invoice {
    id: string;
    invoiceNumber: string; // e.g. INV-2024-001
    projectId?: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientAddress?: string;
    items: InvoiceItem[];
    subtotal: number;
    tax?: number; // e.g. 18%
    total: number;
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    issueDate: number; // timestamp
    dueDate: number; // timestamp
    notes?: string;
    createdAt: number;
    updatedAt: number;
}
