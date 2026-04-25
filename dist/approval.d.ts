/**
 * Visitor approval queue for TTYA.
 *
 * Manages the state machine for visitor sessions:
 *   pending -> approved | rejected | blocked
 */
import type { WebSocket } from '@fastify/websocket';
export interface VisitorSession {
    visitorId: string;
    status: 'pending' | 'approved' | 'rejected' | 'blocked';
    firstMessage: string;
    ipHash: string;
    timestamp: number;
    sessionToken?: string;
    websocket: WebSocket;
    lastMessageAt: number;
}
export interface ApprovalQueueConfig {
    maxPending: number;
    autoApprove: boolean;
    sessionTimeout: number;
}
export declare class ApprovalQueue {
    private sessions;
    private blockedIps;
    private config;
    constructor(config: ApprovalQueueConfig);
    /**
     * Register a new visitor. Returns the session if added, null if queue is full or IP is blocked.
     */
    addVisitor(visitorId: string, firstMessage: string, ipHash: string, ws: WebSocket): VisitorSession | null;
    /**
     * Approve a pending visitor. Returns the session token.
     */
    approve(visitorId: string): string;
    /**
     * Reject a pending visitor.
     */
    reject(visitorId: string): void;
    /**
     * Block an IP hash. All current sessions from that IP are also rejected.
     */
    block(ipHash: string): void;
    isApproved(visitorId: string): boolean;
    isBlocked(ipHash: string): boolean;
    getSession(visitorId: string): VisitorSession | undefined;
    getPending(): VisitorSession[];
    /**
     * Update the lastMessageAt timestamp for a visitor.
     */
    touch(visitorId: string): void;
    /**
     * Remove expired sessions (older than sessionTimeout).
     */
    cleanup(): void;
    /**
     * Remove a specific visitor session.
     */
    remove(visitorId: string): void;
    /**
     * Total active sessions count.
     */
    get size(): number;
}
//# sourceMappingURL=approval.d.ts.map