/**
 * shared-state.js - LORB Shared World State
 * 
 * Manages the global shared state that all players see:
 * - gameDay: The current world day (used for city rotation)
 * - seasonStart: Timestamp when current season began
 * - seasonChampions: History of Red Bull defeats
 * 
 * All players share the same gameDay, which rotates through 30 NBA cities.
 * Day advancement is time-based using DAY_DURATION_MS from config.
 */
(function () {
    // JSONClient should already be loaded by persist.js
    if (typeof JSONClient === "undefined") {
        load("json-client.js");
    }
    
    // Lock constants
    var LOCK_READ = 1;
    var LOCK_WRITE = 2;
    
    // Database path
    var DB_SCOPE = "nba_jam";
    var SHARED_STATE_PATH = "lorb.sharedState";
    
    // Connection (reuse from persist if available)
    var client = null;
    var connected = false;
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function logState(op, status, extra) {
        if (typeof debugLog !== "function") return;
        var msg = "[LORB:SHARED_STATE] op=" + op + " status=" + status;
        if (extra !== undefined && extra !== null) {
            msg += " info=" + extra;
        }
        debugLog(msg);
    }
    
    /**
     * Get config value with fallback
     */
    function getConfig(key, fallback) {
        if (LORB.Config && typeof LORB.Config[key] !== "undefined") {
            return LORB.Config[key];
        }
        return fallback;
    }
    
    /**
     * Ensure connection to JSON-DB
     */
    function ensureConnection() {
        // Try to reuse connection from LORB.Persist
        if (LORB.Persist && LORB.Persist.getServerConfig) {
            if (!connected || !client) {
                try {
                    var config = LORB.Persist.getServerConfig();
                    client = new JSONClient(config.addr, config.port);
                    connected = client.connected;
                } catch (e) {
                    logState("connect", "error", e);
                    connected = false;
                }
            }
        }
        return connected;
    }
    
    /**
     * Calculate what gameDay it should be based on a reference timestamp.
     * Uses the same day calculation logic as hub.js but relative to seasonStart.
     */
    function calculateGameDayFromTimestamp(seasonStartMs, currentMs) {
        var dayDuration = getConfig("DAY_DURATION_MS", 86400000);
        var resetHour = getConfig("DAILY_RESET_HOUR_UTC", 0);
        
        if (dayDuration === 86400000) {
            // Standard 24-hour day - align to reset hour
            var resetOffsetMs = resetHour * 3600000;
            var adjustedStart = seasonStartMs - resetOffsetMs;
            var adjustedCurrent = currentMs - resetOffsetMs;
            var startDay = Math.floor(adjustedStart / dayDuration);
            var currentDay = Math.floor(adjustedCurrent / dayDuration);
            return Math.max(1, (currentDay - startDay) + 1);
        } else {
            // Custom day duration - simple division
            var elapsed = currentMs - seasonStartMs;
            return Math.max(1, Math.floor(elapsed / dayDuration) + 1);
        }
    }
    
    /**
     * Get time remaining until next day reset (in ms)
     */
    function timeUntilNextDay(currentMs) {
        var dayDuration = getConfig("DAY_DURATION_MS", 86400000);
        var resetHour = getConfig("DAILY_RESET_HOUR_UTC", 0);
        
        if (dayDuration === 86400000) {
            // Standard 24-hour day
            var resetOffsetMs = resetHour * 3600000;
            var adjustedTime = currentMs - resetOffsetMs;
            var dayProgress = adjustedTime % dayDuration;
            if (dayProgress < 0) dayProgress += dayDuration;
            return dayDuration - dayProgress;
        } else {
            // Custom day duration
            var dayProgress = currentMs % dayDuration;
            return dayDuration - dayProgress;
        }
    }
    
    /**
     * Read shared state from JSON-DB
     */
    function readState() {
        if (!ensureConnection()) {
            logState("read", "no_connection");
            return null;
        }
        
        try {
            var data = client.read(DB_SCOPE, SHARED_STATE_PATH, LOCK_READ);
            logState("read", "ok", data ? "hasData" : "empty");
            return data;
        } catch (e) {
            logState("read", "error", e);
            return null;
        }
    }
    
    /**
     * Write shared state to JSON-DB
     */
    function writeState(state) {
        if (!ensureConnection()) {
            logState("write", "no_connection");
            return false;
        }
        
        try {
            client.write(DB_SCOPE, SHARED_STATE_PATH, state, LOCK_WRITE);
            logState("write", "ok");
            return true;
        } catch (e) {
            logState("write", "error", e);
            return false;
        }
    }
    
    /**
     * Initialize shared state if it doesn't exist.
     * Called on first access - sets seasonStart to now, gameDay to 1.
     */
    function initialize() {
        var existing = readState();
        if (existing && existing.seasonStart) {
            logState("initialize", "exists", "seasonStart=" + existing.seasonStart);
            return existing;
        }
        
        var now = nowMs();
        var initialState = {
            seasonStart: now,
            seasonNumber: 1,
            lastUpdated: now,
            seasonChampions: []
        };
        
        if (writeState(initialState)) {
            logState("initialize", "created", "seasonStart=" + now);
            return initialState;
        }
        
        logState("initialize", "failed");
        return null;
    }
    
    /**
     * Get the current shared state, initializing if needed.
     */
    function get() {
        var state = readState();
        if (!state || !state.seasonStart) {
            state = initialize();
        }
        return state;
    }
    
    /**
     * Get the current game day number.
     * This is computed from (now - seasonStart) / DAY_DURATION_MS.
     */
    function getGameDay() {
        var state = get();
        if (!state || !state.seasonStart) {
            logState("getGameDay", "no_state", "defaulting to 1");
            return 1;
        }
        
        var now = nowMs();
        var gameDay = calculateGameDayFromTimestamp(state.seasonStart, now);
        logState("getGameDay", "ok", "day=" + gameDay);
        return gameDay;
    }
    
    /**
     * Get full state info including computed values.
     */
    function getInfo() {
        var state = get();
        if (!state) {
            return {
                gameDay: 1,
                seasonNumber: 1,
                seasonStart: nowMs(),
                timeUntilNextDay: 0,
                seasonChampions: []
            };
        }
        
        var now = nowMs();
        var gameDay = calculateGameDayFromTimestamp(state.seasonStart, now);
        
        return {
            gameDay: gameDay,
            seasonNumber: state.seasonNumber || 1,
            seasonStart: state.seasonStart,
            timeUntilNextDay: timeUntilNextDay(now),
            seasonChampions: state.seasonChampions || [],
            lastUpdated: state.lastUpdated
        };
    }
    
    /**
     * Reset the season (called when Red Bull is defeated).
     * Records the champion and starts a new season from day 1.
     */
    function resetSeason(championInfo) {
        var state = get() || {};
        var now = nowMs();
        
        // Record the champion
        var champions = state.seasonChampions || [];
        champions.push({
            seasonNumber: state.seasonNumber || 1,
            championName: championInfo.name || "Unknown",
            championId: championInfo.globalId || null,
            defeatedOnDay: calculateGameDayFromTimestamp(state.seasonStart || now, now),
            timestamp: now
        });
        
        // Start new season
        var newState = {
            seasonStart: now,
            seasonNumber: (state.seasonNumber || 1) + 1,
            lastUpdated: now,
            seasonChampions: champions
        };
        
        if (writeState(newState)) {
            logState("resetSeason", "ok", "newSeason=" + newState.seasonNumber);
            return newState;
        }
        
        logState("resetSeason", "failed");
        return null;
    }
    
    /**
     * Manually force day advancement (for testing/sysop use).
     * Moves seasonStart back by one day duration.
     */
    function forceAdvanceDay() {
        var state = get();
        if (!state) return false;
        
        var dayDuration = getConfig("DAY_DURATION_MS", 86400000);
        state.seasonStart -= dayDuration;
        state.lastUpdated = nowMs();
        
        return writeState(state);
    }
    
    // Export to LORB namespace
    if (!LORB.Util) LORB.Util = {};
    LORB.SharedState = {
        get: get,
        getGameDay: getGameDay,
        getInfo: getInfo,
        initialize: initialize,
        resetSeason: resetSeason,
        forceAdvanceDay: forceAdvanceDay,
        timeUntilNextDay: timeUntilNextDay,
        calculateGameDayFromTimestamp: calculateGameDayFromTimestamp
    };
    
})();
