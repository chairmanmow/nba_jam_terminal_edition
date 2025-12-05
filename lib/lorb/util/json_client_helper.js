/**
 * json_client_helper.js - Shared JSONClient connector with backoff/short timeouts.
 *
 * Provides a single shared client for ephemeral operations (presence, challenges).
 * Callers are responsible for LOCK_READ/LOCK_WRITE usage around read/write/remove.
 * All timeouts are kept short to avoid stalling the BBS.
 *
 * Usage:
 *   var JCH = LORB.JsonClientHelper;
 *   var client = JCH.ensureClient();
 *   client.read(scope, path);
 *   JCH.disconnect();
 *
 * Supports test injection via LORB._JsonClientMock.
 */
(function () {
    if (!this.LORB) this.LORB = {};
    
    var DEFAULT_ADDR = "localhost";
    var DEFAULT_PORT = 10088;
    var DEFAULT_SCOPE = "lorb";
    var DEFAULT_BACKOFF_MS = 10000;
    var DEFAULT_TIMEOUT_MS = 30000;
    
    var client = null;
    var backoffUntil = 0;
    var currentCfg = null;
    
    function nowMs() { return Date.now ? Date.now() : (time() * 1000); }
    
    function logInfo(msg) { if (typeof debugLog === "function") debugLog("[LORB:JsonClient] " + msg); }
    function logWarn(msg) { if (typeof debugLog === "function") debugLog("[LORB:JsonClient][WARN] " + msg); }
    
    function resolveConfig() {
        var cfg = (typeof LORB !== "undefined" && LORB.Config && LORB.Config.JSON_CLIENT) || {};
        var serverCfg = (typeof LORB !== "undefined" && LORB.Persist && LORB.Persist.getServerConfig)
            ? (LORB.Persist.getServerConfig() || {})
            : {};
        return {
            addr: cfg.addr || serverCfg.addr || DEFAULT_ADDR,
            port: cfg.port || serverCfg.port || DEFAULT_PORT,
            scope: cfg.scope || serverCfg.scope || DEFAULT_SCOPE,
            timeoutMs: (cfg.timeoutMs !== undefined ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS),
            backoffMs: (cfg.backoffMs !== undefined ? cfg.backoffMs : DEFAULT_BACKOFF_MS)
        };
    }
    
    function ensureClient(opts) {
        opts = opts || {};
        var now = nowMs();
        if (!opts.force && backoffUntil && now < backoffUntil) return null;
        
        currentCfg = resolveConfig();

        // Short-circuit when live challenges are disabled to avoid JSON service timeouts.
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.ENABLE_LIVE_CHALLENGES === false) {
            backoffUntil = now + (currentCfg.backoffMs || DEFAULT_BACKOFF_MS);
            return null;
        }
        
        // Allow tests to inject a mock
        if (typeof LORB !== "undefined" && LORB._JsonClientMock) {
            return LORB._JsonClientMock;
        }
        
        if (client && client.connected) return client;
        
        if (typeof JSONClient === "undefined") {
            try { load("/sbbs/exec/load/json-client.js"); } catch (e) {
                logWarn("load failed: " + e);
                backoffUntil = now + currentCfg.backoffMs;
                return null;
            }
        }
        
        try {
            client = new JSONClient(currentCfg.addr, currentCfg.port);
            if (client && client.settings) {
                client.settings.TIMEOUT = currentCfg.timeoutMs;
                client.settings.SOCK_TIMEOUT = currentCfg.timeoutMs;
                client.settings.PING_TIMEOUT = currentCfg.timeoutMs;
                client.settings.PING_INTERVAL = 30000;
            }
            if (client && client.connected) {
                logInfo("connected addr=" + currentCfg.addr + " port=" + currentCfg.port + " timeoutMs=" + currentCfg.timeoutMs);
                backoffUntil = 0;
                return client;
            }
        } catch (e) {
            logWarn("connect failed addr=" + currentCfg.addr + " port=" + currentCfg.port + " err=" + e);
        }
        backoffUntil = now + currentCfg.backoffMs;
        client = null;
        return null;
    }
    
    function disconnect() {
        if (client) {
            try { client.disconnect(); } catch (e) {}
        }
        client = null;
    }
    
    function markFailure() {
        var cfg = currentCfg || resolveConfig();
        backoffUntil = nowMs() + (cfg.backoffMs || DEFAULT_BACKOFF_MS);
        disconnect();
    }
    
    this.LORB.JsonClientHelper = {
        ensureClient: ensureClient,
        disconnect: disconnect,
        markFailure: markFailure
    };
})();
