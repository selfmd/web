/**
 * Shared types for the TTYA web package.
 */
/** Default configuration values */
export const DEFAULT_CONFIG = {
    port: 3000,
    host: '0.0.0.0',
    autoApprove: false,
    maxPendingVisitors: 10,
    maxConnections: 100,
    rateLimit: {
        messages: 1,
        perSeconds: 3,
    },
    messageMaxBytes: 4096,
    sessionTimeout: 3600000, // 1 hour
};
//# sourceMappingURL=types.js.map