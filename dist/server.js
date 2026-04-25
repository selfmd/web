/**
 * TTYA Fastify HTTP + WebSocket server.
 *
 * Serves the visitor chat UI and manages WebSocket connections.
 * Bridges visitor messages to the Hyperswarm network via TTYABridge.
 */
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { createHash } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { ApprovalQueue } from './approval.js';
import { TTYABridge } from './bridge.js';
import { getChatHTML } from './static-content.js';
import { DEFAULT_CONFIG } from './types.js';
function hashIP(ip) {
    return createHash('sha256').update(ip).digest('hex');
}
function sendWS(ws, msg) {
    try {
        ws.send(JSON.stringify(msg));
    }
    catch {
        // connection may be closed
    }
}
export class TTYAServer {
    config;
    app = null;
    bridge;
    queue;
    connectionCount = 0;
    rateLimitMap = new Map(); // visitorId -> last message timestamp
    cleanupTimer = null;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.bridge = new TTYABridge(this.config.agentEdPublicKey);
        this.queue = new ApprovalQueue({
            maxPending: this.config.maxPendingVisitors,
            autoApprove: this.config.autoApprove,
            sessionTimeout: this.config.sessionTimeout,
        });
    }
    /**
     * Start the HTTP/WS server and connect to the Hyperswarm network.
     * Returns the shareable URL.
     */
    async start() {
        const app = Fastify({ logger: false });
        this.app = app;
        // Register WebSocket support
        await app.register(websocket);
        // Set up bridge response handler
        this.bridge.onAgentResponse((response) => {
            this.handleAgentResponse(response);
        });
        // Connect bridge to Hyperswarm
        await this.bridge.connect();
        // --- Routes ---
        const fingerprint = this.config.agentFingerprint;
        // GET / -> redirect to /talk/:fingerprint
        app.get('/', async (_req, reply) => {
            return reply.redirect(`/talk/${fingerprint}`);
        });
        // GET /talk/:fingerprint -> serve chat HTML
        app.get('/talk/:fingerprint', async (req, reply) => {
            const fp = req.params.fingerprint;
            reply.type('text/html');
            return getChatHTML(fp);
        });
        // WebSocket /ws/:fingerprint
        app.get('/ws/:fingerprint', { websocket: true }, (socket, req) => {
            const fp = req.params.fingerprint;
            // Enforce max connections
            if (this.connectionCount >= this.config.maxConnections) {
                sendWS(socket, { type: 'error', message: 'Server is at capacity' });
                socket.close();
                return;
            }
            this.connectionCount++;
            const visitorId = createId();
            const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '0.0.0.0';
            const ipHash = hashIP(ip);
            // Check if IP is blocked
            if (this.queue.isBlocked(ipHash)) {
                sendWS(socket, { type: 'status', status: 'rejected' });
                socket.close();
                this.connectionCount--;
                return;
            }
            let firstMessageHandled = false;
            socket.on('message', (raw) => {
                const data = typeof raw === 'string' ? raw : raw.toString('utf-8');
                // Parse message
                let clientMsg;
                try {
                    clientMsg = JSON.parse(data);
                }
                catch {
                    sendWS(socket, { type: 'error', message: 'Invalid message format' });
                    return;
                }
                if (clientMsg.type !== 'message' || typeof clientMsg.content !== 'string') {
                    sendWS(socket, { type: 'error', message: 'Invalid message type' });
                    return;
                }
                // Check message size
                const contentBytes = Buffer.byteLength(clientMsg.content, 'utf-8');
                if (contentBytes > this.config.messageMaxBytes) {
                    sendWS(socket, { type: 'error', message: 'Message too large' });
                    return;
                }
                // Rate limiting (per visitor, in-memory)
                const now = Date.now();
                const lastMsg = this.rateLimitMap.get(visitorId) || 0;
                const minInterval = this.config.rateLimit.perSeconds * 1000 / this.config.rateLimit.messages;
                if (now - lastMsg < minInterval) {
                    sendWS(socket, { type: 'error', message: 'Rate limited. Please wait a moment.' });
                    return;
                }
                this.rateLimitMap.set(visitorId, now);
                // First message: add to approval queue
                if (!firstMessageHandled) {
                    firstMessageHandled = true;
                    const session = this.queue.addVisitor(visitorId, clientMsg.content, ipHash, socket);
                    if (!session) {
                        sendWS(socket, { type: 'error', message: 'Unable to process request' });
                        socket.close();
                        this.connectionCount--;
                        return;
                    }
                    // Send TTYARequest to agent
                    const request = {
                        type: 0x07,
                        visitorId,
                        action: 'message',
                        content: clientMsg.content,
                        metadata: {
                            ipHash,
                            userAgent: req.headers['user-agent'],
                            timestamp: now,
                        },
                    };
                    this.bridge.sendToAgent(request);
                    // If auto-approve, mark as approved immediately
                    if (this.config.autoApprove) {
                        sendWS(socket, { type: 'status', status: 'approved' });
                    }
                    else {
                        sendWS(socket, { type: 'status', status: 'pending' });
                    }
                    return;
                }
                // Subsequent messages: only if approved
                if (!this.queue.isApproved(visitorId)) {
                    sendWS(socket, { type: 'error', message: 'Waiting for approval' });
                    return;
                }
                this.queue.touch(visitorId);
                // Forward to agent
                const request = {
                    type: 0x07,
                    visitorId,
                    action: 'message',
                    content: clientMsg.content,
                    metadata: {
                        ipHash,
                        timestamp: now,
                    },
                };
                this.bridge.sendToAgent(request);
            });
            socket.on('close', () => {
                this.connectionCount--;
                this.rateLimitMap.delete(visitorId);
                // Notify agent of disconnect
                const request = {
                    type: 0x07,
                    visitorId,
                    action: 'disconnect',
                    metadata: {
                        ipHash,
                        timestamp: Date.now(),
                    },
                };
                this.bridge.sendToAgent(request);
                this.queue.remove(visitorId);
            });
            socket.on('error', () => {
                // handled by close
            });
        });
        // Start periodic cleanup
        this.cleanupTimer = setInterval(() => {
            this.queue.cleanup();
        }, 60000);
        // Listen
        const address = await app.listen({ port: this.config.port, host: this.config.host });
        const url = `${address}/talk/${fingerprint}`;
        return url;
    }
    /**
     * Stop the server and disconnect from Hyperswarm.
     */
    async stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        if (this.app) {
            await this.app.close();
            this.app = null;
        }
        await this.bridge.disconnect();
    }
    /**
     * Handle a response from the agent node.
     */
    handleAgentResponse(response) {
        const session = this.queue.getSession(response.visitorId);
        if (!session)
            return;
        const ws = session.websocket;
        switch (response.action) {
            case 'approve': {
                try {
                    this.queue.approve(response.visitorId);
                }
                catch {
                    // already approved or invalid state
                    break;
                }
                sendWS(ws, { type: 'status', status: 'approved' });
                break;
            }
            case 'reject': {
                try {
                    this.queue.reject(response.visitorId);
                }
                catch {
                    // invalid state
                }
                sendWS(ws, { type: 'status', status: 'rejected' });
                try {
                    ws.close();
                }
                catch {
                    // ignore
                }
                break;
            }
            case 'reply': {
                if (response.content) {
                    sendWS(ws, { type: 'message', content: response.content, sender: 'agent' });
                }
                break;
            }
        }
    }
    /** Access to the approval queue for external management (CLI/MCP) */
    get approvalQueue() {
        return this.queue;
    }
    /** Whether the bridge has an active connection to the agent */
    get isBridgeConnected() {
        return this.bridge.isConnected;
    }
}
//# sourceMappingURL=server.js.map