
// Firestore Data Models

export type UserRole = 'admin' | 'manager' | 'editor' | 'client' | 'guest';

export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
    createdAt: number; // Timestamp
    phoneNumber?: string; // For guests
}

export type ProjectStatus = 'active' | 'in_review' | 'approved' | 'completed' | 'archived' | 'pending_assignment';

export interface Project {
    id: string;
    name: string;
    clientName: string; // Deprecated in favor of 'brand' maybe?
    brand?: string;
    description?: string;
    deadline?: string;
    duration?: number;
    budget?: number;
    totalCost?: number; // Calculated cost
    amountPaid?: number; // Upfront + Final
    paymentStatus?: string; // 'half_paid', 'full_paid'
    assignedEditorId?: string;
    footageLink?: string; // Link to cloud storage
    thumbnailUrl?: string; // Cover image
    status: ProjectStatus;
    createdAt: number;
    updatedAt: number;
    members: string[]; // Array of User UIDs (admin, manager, editor, client)
    currentRevisionId?: string; // ID of the latest active revision
    ownerId?: string;
    assignmentStatus?: ProjectAssignmentStatus;
}

export type ProjectAssignmentStatus = 'pending' | 'accepted' | 'rejected';

export type RevisionStatus = 'active' | 'approved' | 'changes_requested';

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
}

export type CommentStatus = 'open' | 'resolved';

export interface Comment {
    id: string;
    projectId: string; // Denormalized for queries
    revisionId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
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
