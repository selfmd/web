/**
 * Hyperswarm bridge for TTYA.
 *
 * Connects the web server to the agent node via the Hyperswarm P2P network.
 * Derives a TTYA-specific topic from the agent's Ed25519 public key,
 * joins it, and forwards messages between WebSocket visitors and the agent.
 */
import type { TTYARequest, TTYAResponse } from './types.js';
export declare class TTYABridge {
    private agentEdPublicKey;
    private swarm;
    private agentConnection;
    private responseHandler;
    private pendingRequests;
    private receiveBuffer;
    constructor(agentEdPublicKey: Uint8Array);
    /**
     * Derive the TTYA topic from the agent's Ed25519 public key.
     * topic = hkdf(sha256, agentEdPublicKey, "networkselfmd-ttya-v1", "", 32)
     */
    private deriveTopic;
    /**
     * Join the Hyperswarm topic and wait for the agent node to connect.
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Hyperswarm.
     */
    disconnect(): Promise<void>;
    /**
     * Send a TTYARequest to the connected agent.
     * If agent is not connected yet, the request is queued.
     */
    sendToAgent(request: TTYARequest): void;
    /**
     * Register handler for TTYAResponse messages from the agent.
     */
    onAgentResponse(handler: (response: TTYAResponse) => void): void;
    /** Whether we have an active connection to the agent node */
    get isConnected(): boolean;
    private writeRequest;
    private processReceiveBuffer;
}
//# sourceMappingURL=bridge.d.ts.map