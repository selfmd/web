/**
 * Shared types for the TTYA web package.
 */
/** WebSocket message from client to server */
export interface WSClientMessage {
    type: 'message';
    content: string;
}
/** WebSocket message from server to client */
export type WSServerMessage = {
    type: 'status';
    status: 'pending' | 'approved' | 'rejected';
} | {
    type: 'message';
    content: string;
    sender: 'agent';
} | {
    type: 'error';
    message: string;
};
/** TTYA request sent from web server to agent node via Hyperswarm */
export interface TTYARequest {
    type: 0x07;
    visitorId: string;
    action: 'message' | 'connect' | 'disconnect';
    content?: string;
    metadata: {
        ipHash: string;
        userAgent?: string;
        timestamp: number;
    };
}
/** TTYA response sent from agent node to web server via Hyperswarm */
export interface TTYAResponse {
    type: 0x08;
    visitorId: string;
    action: 'approve' | 'reject' | 'reply';
    content?: string;
    sessionToken?: string;
}
/** Configuration for the TTYA server */
export interface TTYAServerConfig {
    port: number;
    host: string;
    autoApprove: boolean;
    maxPendingVisitors: number;
    maxConnections: number;
    rateLimit: {
        messages: number;
        perSeconds: number;
    };
    messageMaxBytes: number;
    sessionTimeout: number;
    agentFingerprint: string;
    agentEdPublicKey: Uint8Array;
}
/** Default configuration values */
export declare const DEFAULT_CONFIG: Omit<TTYAServerConfig, 'agentFingerprint' | 'agentEdPublicKey'>;
//# sourceMappingURL=types.d.ts.map