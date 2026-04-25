/**
 * TTYA Fastify HTTP + WebSocket server.
 *
 * Serves the visitor chat UI and manages WebSocket connections.
 * Bridges visitor messages to the Hyperswarm network via TTYABridge.
 */
import { ApprovalQueue } from './approval.js';
import type { TTYAServerConfig } from './types.js';
export declare class TTYAServer {
    private config;
    private app;
    private bridge;
    private queue;
    private connectionCount;
    private rateLimitMap;
    private cleanupTimer;
    constructor(config: Partial<TTYAServerConfig> & Pick<TTYAServerConfig, 'agentFingerprint' | 'agentEdPublicKey'>);
    /**
     * Start the HTTP/WS server and connect to the Hyperswarm network.
     * Returns the shareable URL.
     */
    start(): Promise<string>;
    /**
     * Stop the server and disconnect from Hyperswarm.
     */
    stop(): Promise<void>;
    /**
     * Handle a response from the agent node.
     */
    private handleAgentResponse;
    /** Access to the approval queue for external management (CLI/MCP) */
    get approvalQueue(): ApprovalQueue;
    /** Whether the bridge has an active connection to the agent */
    get isBridgeConnected(): boolean;
}
//# sourceMappingURL=server.d.ts.map