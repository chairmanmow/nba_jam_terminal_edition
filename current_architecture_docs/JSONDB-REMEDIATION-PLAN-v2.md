# JSON-DB Remediation Plan v2
**Date:** December 21, 2025  
**Branch:** `jsondb_architecture_audit`  
**Prerequisite:** Review [JSONDB-ARCHITECTURE-AUDIT-v2.md](JSONDB-ARCHITECTURE-AUDIT-v2.md)

---

## Overview

This plan converts LORB from a **polling-based** JSONClient architecture to the correct **subscription-based** architecture as demonstrated by `json-chat.js`.

### Scope

| Component | Current State | Target State | Priority |
|-----------|---------------|--------------|----------|
| challenges_pubsub.js | Polls with blocking reads | Subscription-based | **CRITICAL** |
| config.js | USE_SUBSCRIPTIONS=false | USE_SUBSCRIPTIONS=true | **CRITICAL** |
| lorb_multiplayer_launcher.js | Polling loop with 30s timeout | Subscription-based sync | **HIGH** |
| json_client_helper.js | Blocking version check | Non-blocking or startup-only | **MEDIUM** |
| Various locations | Exit-only saves | Checkpoint saves | **HIGH** |

---

## Phase 1: Enable Subscription Mode

### Step 1.1: Update config.js

**File:** `lib/lorb/config.js`

**Change:**
```javascript
// BEFORE
USE_SUBSCRIPTIONS: false

// AFTER
USE_SUBSCRIPTIONS: true
```

**Rationale:** This is the master switch. With `true`, the code paths that call `pollOnDemand()` will be skipped in favor of subscription-based updates.

**Risk:** Low - the subscription code paths already exist, they're just disabled.

---

## Phase 2: Fix challenges_pubsub.js

This is the core refactor. The goal is to match JSONChat's pattern.

### Step 2.1: Set Callback on Connect

**File:** `lib/lorb/multiplayer/challenges_pubsub.js`

**Location:** Inside `ensureClient()` function (around line 220)

**Current:**
```javascript
client = new JSONClient(addr, port);
client.callback = handleUpdate;
client.settings.TIMEOUT = -1;
```

**Change:** Ensure callback is always set. The current code looks correct, but verify it's actually being hit.

### Step 2.2: Subscribe on Connect

**Location:** Inside `subscribeForPlayer()` function (around line 265)

**Current:**
```javascript
function subscribeForPlayer(ctx) {
    if (!client || !client.connected) return false;
    
    var gid = getGlobalIdFromCtx(ctx);
    if (!gid) return false;
    
    myGlobalId = gid;
    
    if (!useSubscriptions()) {
        logInfo("subscriptions DISABLED...");
        subscribed = false;
        return true;
    }
    
    if (subscribed) return true;
    
    try {
        client.subscribe(DB_SCOPE, bucketPath(gid));
        client.subscribe(DB_SCOPE, PRESENCE_ROOT);
        subscribed = true;
        processPackets();
        return true;
    } catch (e) {
        logWarn("subscribe failed: " + e);
        return false;
    }
}
```

**Change:** With `USE_SUBSCRIPTIONS=true`, this should work. No code change needed here.

### Step 2.3: Make cycle() Non-Blocking

**Location:** `cycle()` function (around line 435)

**Current:**
```javascript
function cycle() {
    if (!client || !client.connected) return;
    
    var now = nowMs();
    if (now - lastCycleTime < CYCLE_INTERVAL_MS) return;
    lastCycleTime = now;
    
    processPackets();  // Good - just drains queue
    
    if (myGlobalId && myPresenceData && (now - lastHeartbeatTime) >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatTime = now;
        myPresenceData.timestamp = now;
        writePresence(myGlobalId, myPresenceData);  // Good - fire-and-forget
        
        // BAD: This triggers blocking reads!
        if (!useSubscriptions()) {
            lastPollTime = 0;
            pollOnDemand({ _user: { number: 0 } });
        }
    }
}
```

**Change:**
```javascript
function cycle() {
    if (!client || !client.connected) return;
    
    var now = nowMs();
    if (now - lastCycleTime < CYCLE_INTERVAL_MS) return;
    lastCycleTime = now;
    
    // ONLY drain already-received packets - NO network operations
    processPackets();
    
    // Drain updates array if callback wasn't set
    while (client.updates && client.updates.length) {
        try {
            handleUpdate(client.updates.shift());
        } catch (e) {
            logWarn("handleUpdate error: " + e);
        }
    }
    
    // Heartbeat for presence (fire-and-forget write only)
    if (myGlobalId && myPresenceData && (now - lastHeartbeatTime) >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatTime = now;
        myPresenceData.timestamp = now;
        writePresence(myGlobalId, myPresenceData);
        // NO pollOnDemand() - data comes via subscription
    }
}
```

### Step 2.4: Remove pollOnDemand() Calls from listIncoming/listOutgoing

**Location:** `listIncoming()` function (around line 656)

**Current:**
```javascript
function listIncoming(ctx) {
    var c = ensureClient(ctx);
    if (!c) return [];
    subscribeForPlayer(ctx);
    
    if (!useSubscriptions()) {
        pollOnDemand(ctx);  // BLOCKING!
    } else {
        cycle();
    }
    // ... return from cache ...
}
```

**Change:**
```javascript
function listIncoming(ctx) {
    var c = ensureClient(ctx);
    if (!c) return [];
    subscribeForPlayer(ctx);  // Ensures we're subscribed
    
    // Just call cycle to process any pending updates (non-blocking)
    cycle();
    
    // Return from cache - data arrives via subscription
    var gid = getGlobalIdFromCtx(ctx);
    if (!gid) return [];
    
    var ts = nowMs();
    var incoming = [];
    
    for (var id in challengeCache) {
        // ... existing filter logic ...
    }
    
    return incoming;
}
```

**Apply same change to:** `listOutgoing()`, `getOnlinePlayers()`, `isPlayerOnline()`

### Step 2.5: Remove or Deprecate pollOnDemand()

**Option A (Recommended):** Comment out the function and add deprecation notice

```javascript
/**
 * DEPRECATED: This function used blocking reads which froze the input loop.
 * With USE_SUBSCRIPTIONS=true, data arrives via callbacks - no polling needed.
 * 
 * Keeping this code for reference only. Do not call.
 */
/*
function pollOnDemand(ctx) {
    // ... old code ...
}
*/
```

**Option B:** Delete entirely (cleaner but makes rollback harder)

### Step 2.6: Fix pollChallenge() for Waiting Loops

The `pollChallenge()` function is used in waiting loops (e.g., waiting for opponent to accept). This needs special handling since we legitimately need to wait for data.

**Current:** Uses blocking reads

**Change:** Use subscription + sleep loop

```javascript
function pollChallenge(challengeId, ctx) {
    ensureClient(ctx);
    subscribeForPlayer(ctx);
    
    // Just return from cache - data arrives via subscription
    cycle();  // Process any pending updates
    return challengeCache[challengeId] || null;
}
```

The waiting loop in the caller should look like:
```javascript
while (!otherReady && !timedOut) {
    mswait(200);  // Sleep briefly
    Challenges.cycle();  // Process incoming subscription updates
    var ch = Challenges.getChallenge(challengeId, ctx);
    if (ch && isOtherReady(ch, myGid)) {
        otherReady = true;
    }
}
```

---

## Phase 3: Fix lorb_multiplayer_launcher.js

### Step 3.1: Set Timeout on Client Creation

**Location:** `createClient()` function (line 124)

**Current:**
```javascript
var client = new JSONClient(serverConfig.addr || "localhost", serverConfig.port || 10088);
if (!client.connected) {
    throw new Error("Failed to connect");
}
return client;
```

**Change:**
```javascript
var client = new JSONClient(serverConfig.addr || "localhost", serverConfig.port || 10088);

// Set fire-and-forget mode - we'll use subscriptions for waiting
if (client && client.settings) {
    client.settings.TIMEOUT = -1;
}

if (!client.connected) {
    throw new Error("Failed to connect");
}
return client;
```

### Step 3.2: Refactor showSynchronizedCountdown()

**Location:** `showSynchronizedCountdown()` function (around line 240)

**Current pattern:**
```javascript
while (!bothReady && !timedOut) {
    mswait(500);
    syncData = client.read("nba_jam", syncPath, 1);  // BLOCKING!
    // ... check if ready ...
}
```

**New pattern:**
```javascript
// Subscribe to sync path
client.subscribe("nba_jam", syncPath);

// Write my ready signal (fire-and-forget)
client.write("nba_jam", syncPath, myReadyData, 2);

// Local cache for sync data
var syncCache = { players: {} };
syncCache.players[myGlobalId] = myReadyData;

while (!bothReady && !timedOut) {
    mswait(100);  // Brief sleep
    
    // Process any incoming subscription updates (non-blocking)
    client.cycle();
    while (client.updates && client.updates.length) {
        var pkt = client.updates.shift();
        if (pkt.location && pkt.location.indexOf(syncPath) === 0) {
            // Merge update into local cache
            if (pkt.data) {
                if (pkt.data.players) {
                    for (var pid in pkt.data.players) {
                        syncCache.players[pid] = pkt.data.players[pid];
                    }
                } else if (pkt.oper === "WRITE" && pkt.data.ready !== undefined) {
                    // Direct player update
                    var parts = pkt.location.split(".");
                    var playerId = parts[parts.length - 1];
                    syncCache.players[playerId] = pkt.data;
                }
            }
        }
    }
    
    // Check if both players are ready
    var readyCount = 0;
    for (var pid in syncCache.players) {
        if (syncCache.players[pid] && syncCache.players[pid].ready) {
            readyCount++;
        }
    }
    bothReady = (readyCount >= 2);
}

// Cleanup
client.unsubscribe("nba_jam", syncPath);
```

---

## Phase 4: Fix json_client_helper.js

### Step 4.1: Make Version Check Non-Blocking

**Location:** `checkVersionCompatibility()` function (around line 67)

**Current:**
```javascript
var serverInfo = jsonClient.read(scope, VERSION_PATH, 1);  // BLOCKING!
```

**Option A (Recommended):** Write-only, trust the system
```javascript
function checkVersionCompatibility(jsonClient, scope, serverName) {
    if (VERSION_CHECK_DONE) return VERSION_MISMATCH_ERROR === null;
    
    var localVersion = getLocalVersion();
    
    // Just publish our version - don't block to read server's
    // If there's a mismatch, gameplay will fail and user will know
    try {
        jsonClient.write(scope, VERSION_PATH, {
            commit: localVersion,
            publishedAt: nowMs(),
            publishedBy: system.qwk_id || system.name || "unknown"
        }, 2);  // LOCK_WRITE, fire-and-forget
    } catch (e) {
        logWarn("Version publish failed: " + e);
    }
    
    VERSION_CHECK_DONE = true;
    return true;
}
```

**Option B:** Do the check once at LORB startup (before input loop starts)

Move the version check to `LORB.boot()` or `lorb.js` initialization, before entering the hub. A brief block at startup is acceptable.

---

## Phase 5: Add Checkpoint Saves (Data Integrity)

### Step 5.1: Save After Baby Creation

**File:** `lib/lorb/locations/doctor.js`

**Location:** After `addBabyToContext()` call

**Add:**
```javascript
LORB.Data.BabyBallers.addBabyToContext(ctx, baby);

// Checkpoint save - baby creation is significant
if (LORB.Persist && LORB.Persist.save) {
    try {
        LORB.Persist.save(ctx);
        debugLog("[DOCTOR] Checkpoint save after baby creation");
    } catch (e) {
        debugLog("[DOCTOR] Checkpoint save failed: " + e);
    }
}
```

### Step 5.2: Save After Game Completion

**File:** `lib/lorb/locations/courts.js`

**Location:** After game rewards are applied

**Add similar checkpoint save**

### Step 5.3: Save After Game in Arena

**File:** `lib/lorb/locations/arena.js`

**Location:** After match results processed

**Add similar checkpoint save**

### Step 5.4: Hub Auto-Save

**File:** `lib/lorb/locations/hub.js`

**Location:** In `runRichView()` main loop

**Add:**
```javascript
var lastAutoSave = Date.now();
var AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes

// Inside the while(true) loop, near the top:
if (Date.now() - lastAutoSave > AUTO_SAVE_INTERVAL_MS) {
    if (LORB.Persist && LORB.Persist.save) {
        try {
            LORB.Persist.save(ctx);
            debugLog("[HUB] Auto-save triggered");
        } catch (e) {}
    }
    lastAutoSave = Date.now();
}
```

---

## Implementation Order

### Day 1: Enable Subscriptions + Fix Core

1. Change `USE_SUBSCRIPTIONS = true` in config.js
2. Modify `cycle()` to remove `pollOnDemand()` call
3. Modify `listIncoming()`/`listOutgoing()` to remove `pollOnDemand()` calls
4. Test: Enter hub, verify no blocking, verify challenges still work

### Day 2: Fix Multiplayer Launcher

5. Set `TIMEOUT = -1` in `createClient()`
6. Refactor `showSynchronizedCountdown()` to use subscriptions
7. Test: Two players, challenge flow, verify sync works

### Day 3: Fix Version Check + Add Saves

8. Make version check non-blocking
9. Add checkpoint saves to doctor.js, courts.js, arena.js
10. Add auto-save to hub.js
11. Test: Force-quit scenarios, verify data persists

### Day 4: Testing + Polish

12. Full integration testing with multiple users
13. Monitor debug logs for any blocking
14. Clean up deprecated code

---

## Rollback Plan

If subscriptions prove unstable:

1. Set `USE_SUBSCRIPTIONS = false` in config.js
2. Reduce poll frequency: `POLL_COOLDOWN_MS = 5000` (5 seconds)
3. Keep `TIMEOUT = 500` for minimal blocking
4. This is worse but still functional

---

## Validation Checklist

### After Phase 1-2:

- [ ] `grep -n "pollOnDemand" lib/lorb/multiplayer/challenges_pubsub.js` shows no active calls
- [ ] Debug log shows `subscribed to rimcity.challenges.*` on connect
- [ ] Debug log shows `handleUpdate` calls when challenges arrive
- [ ] No debug log entries with `op=pollOnDemand`

### After Phase 3:

- [ ] `lorb_multiplayer_launcher.js` has `TIMEOUT = -1` set
- [ ] Multiplayer sync uses subscribe/cycle pattern
- [ ] Two players can sync and start game

### After Phase 4-5:

- [ ] Version check doesn't block (or only at startup)
- [ ] Baby creation survives force-quit
- [ ] Game results survive force-quit
- [ ] Auto-save fires every 5 minutes in hub

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `lib/lorb/config.js` | `USE_SUBSCRIPTIONS: true` |
| `lib/lorb/multiplayer/challenges_pubsub.js` | Remove polling, subscription-only |
| `lib/lorb/multiplayer/lorb_multiplayer_launcher.js` | `TIMEOUT=-1`, subscription-based sync |
| `lib/lorb/util/json_client_helper.js` | Non-blocking version check |
| `lib/lorb/locations/doctor.js` | Checkpoint save |
| `lib/lorb/locations/courts.js` | Checkpoint save |
| `lib/lorb/locations/arena.js` | Checkpoint save |
| `lib/lorb/locations/hub.js` | Auto-save timer |

---

## Appendix: Quick Reference

### JSONClient Methods That Block

| Method | Blocks? | Notes |
|--------|---------|-------|
| `read()` | **ALWAYS** | Never use in loops |
| `write()` | If TIMEOUT >= 0 | Use TIMEOUT=-1 |
| `push()` | If TIMEOUT >= 0 | Use TIMEOUT=-1 |
| `subscribe()` | If TIMEOUT >= 0 | One-time at connect |
| `cycle()` | **NEVER** | Safe to call frequently |

### JSONClient Methods That Are Safe

| Method | Notes |
|--------|-------|
| `cycle()` | Just drains socket, dispatches to callback |
| `write(..., 2)` with TIMEOUT=-1 | Fire-and-forget |
| `updates.shift()` | Just array access |

### The Pattern To Follow

```javascript
// On connect:
client.callback = handleUpdate;
client.settings.TIMEOUT = -1;
client.subscribe(scope, path);

// In input loop:
client.cycle();  // Non-blocking

// To send data:
client.write(scope, path, data, 2);  // Fire-and-forget

// To read data:
// DON'T - use cached data from subscription updates
return cache[key];
```
