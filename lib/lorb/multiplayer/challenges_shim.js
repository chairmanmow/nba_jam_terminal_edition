/**
 * challenges_shim.js - Backward-compatible shim for LORB.Multiplayer.Challenges
 * 
 * This provides the same API as the old challenges_pubsub.js but delegates to 
 * ctx._networkService where possible. This allows gradual migration of code
 * that still uses the old Challenges module.
 * 
 * ARCHITECTURE:
 * - Most methods require ctx._networkService to be set
 * - Stateless - just wraps calls to the service instance
 * - Eventually, callers should be updated to use ctx._networkService directly
 */
(function() {
    // NOTE: Do not use "use strict" - it breaks 'this' reference to global scope
    
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    // Local reference for use within IIFE
    var LORB = this.LORB;
    
    var CHALLENGE_TTL_MS = 5 * 60 * 1000;  // 5 minutes
    
    function nowMs() {
        return Date.now ? Date.now() : (new Date()).getTime();
    }
    
    function logInfo(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:Challenges:Shim] " + msg);
        }
    }
    
    function getGlobalIdFromCtx(ctx) {
        if (!ctx || !ctx._user || !LORB.Persist || !LORB.Persist.getGlobalPlayerId) return null;
        return LORB.Persist.getGlobalPlayerId(ctx._user);
    }
    
    function getService(ctx) {
        return ctx && ctx._networkService ? ctx._networkService : null;
    }
    
    function buildPlayerRefFromCtx(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        
        var activeTeammate = null;
        if (ctx && ctx.activeTeammate) {
            if (typeof ctx.activeTeammate === "object") {
                activeTeammate = ctx.activeTeammate;
            } else if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getContact) {
                var contact = LORB.Util.Contacts.getContact(ctx, ctx.activeTeammate);
                if (contact && contact.status === "signed") {
                    activeTeammate = {
                        id: contact.id,
                        name: contact.name,
                        skin: contact.skin || "brown",
                        jersey: contact.jersey,
                        stats: contact.stats || null
                    };
                }
            }
        }
        
        return {
            globalId: gid,
            name: (ctx && (ctx.name || ctx.nickname || ctx.userHandle)) ||
                  (ctx && ctx._user && (ctx._user.alias || ctx._user.name)) || "Player",
            bbsName: (ctx && ctx._bbsName) || (typeof system !== "undefined" ? (system.name || null) : null),
            appearance: (ctx && ctx.appearance) ? ctx.appearance : null,
            activeTeammate: activeTeammate,
            cash: (ctx && ctx.cash) || 0,
            rep: (ctx && ctx.rep) || 0
        };
    }
    
    function buildPlayerRef(player) {
        if (!player) return { globalId: null };
        return {
            globalId: player.globalId || player._globalId || player.id || null,
            name: player.name || player.nickname || player.userHandle || "Player",
            bbsName: player.bbsName || player._bbsName || null,
            appearance: player.appearance || null,
            activeTeammate: player.activeTeammate || null,
            cash: player.cash || 0,
            rep: player.rep || 0
        };
    }
    
    // =========================================================
    // Challenge CRUD
    // =========================================================
    
    function createChallenge(ctx, targetPlayer, meta, wagerOffer) {
        var svc = getService(ctx);
        if (!svc || !svc.isActive()) {
            logInfo("createChallenge: no active service");
            return null;
        }
        
        var fromRef = buildPlayerRefFromCtx(ctx);
        var toRef = buildPlayerRef(targetPlayer);
        if (!fromRef.globalId || !toRef.globalId) {
            logInfo("createChallenge: missing globalId");
            return null;
        }
        
        var ts = nowMs();
        var id = "ch_" + fromRef.globalId + "_" + toRef.globalId + "_" + ts + "_" + Math.floor(Math.random() * 1000);
        
        // Build wager object if provided
        var wager = null;
        if (wagerOffer && (wagerOffer.cash > 0 || wagerOffer.rep > 0)) {
            var absoluteMax = calculateAbsoluteMax(ctx, targetPlayer);
            wager = createWagerObject(wagerOffer, absoluteMax, "from");
        }
        
        var challenge = {
            id: id,
            from: fromRef,
            to: toRef,
            status: "pending",
            createdAt: ts,
            updatedAt: ts,
            expiresAt: ts + CHALLENGE_TTL_MS,
            lobby: { ready: {}, lastPing: {} },
            meta: meta || {},
            wager: wager
        };
        
        // Use service's internal write
        if (svc._fireAndForgetWrite && svc._client) {
            var fromPath = "rimcity.challenges." + fromRef.globalId + "." + id;
            var toPath = "rimcity.challenges." + toRef.globalId + "." + id;
            svc._fireAndForgetWrite(fromPath, challenge);
            svc._fireAndForgetWrite(toPath, challenge);
            
            // Cache locally
            svc._challengeCache[id] = challenge;
            
            // Subscribe to target's bucket
            try {
                svc._client.subscribe("nba_jam", "rimcity.challenges." + toRef.globalId);
                // Track for cleanup on disconnect
                if (LORB.JsonClientHelper && LORB.JsonClientHelper.trackSubscription) {
                    LORB.JsonClientHelper.trackSubscription("nba_jam", "rimcity.challenges." + toRef.globalId);
                }
            } catch (e) {}
            
            logInfo("created challenge: " + id);
            return challenge;
        }
        
        return null;
    }
    
    function getChallenge(id, ctx) {
        var svc = getService(ctx);
        if (!svc) return null;
        svc.cycle();
        return svc._challengeCache[id] || null;
    }
    
    function listIncoming(ctx) {
        var svc = getService(ctx);
        if (!svc) return [];
        svc.cycle();
        return svc.getIncomingChallenges() || [];
    }
    
    function listOutgoing(ctx) {
        var svc = getService(ctx);
        if (!svc) return [];
        svc.cycle();
        return svc.getOutgoingChallenges() || [];
    }
    
    function updateChallenge(ctx, id, updater) {
        var svc = getService(ctx);
        if (!svc || !svc.isActive()) return null;
        
        var ch = svc._challengeCache[id];
        if (!ch) return null;
        
        var updated = updater(ch) || ch;
        updated.updatedAt = nowMs();
        
        // Write to both buckets
        if (svc._fireAndForgetWrite) {
            if (ch.from && ch.from.globalId) {
                svc._fireAndForgetWrite("rimcity.challenges." + ch.from.globalId + "." + id, updated);
            }
            if (ch.to && ch.to.globalId) {
                svc._fireAndForgetWrite("rimcity.challenges." + ch.to.globalId + "." + id, updated);
            }
            svc._challengeCache[id] = updated;
            return updated;
        }
        return null;
    }
    
    function markAccepted(id, ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        return updateChallenge(ctx, id, function(ch) {
            ch.status = "accepted";
            if (gid) {
                if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
                ch.lobby.ready[gid] = true;
                ch.lobby.lastPing[gid] = nowMs();
            }
            return ch;
        });
    }
    
    function markDeclined(id, ctx) {
        return updateChallenge(ctx, id, function(ch) {
            ch.status = "declined";
            return ch;
        });
    }
    
    function markCancelled(id, ctx) {
        return updateChallenge(ctx, id, function(ch) {
            ch.status = "cancelled";
            return ch;
        });
    }
    
    function markReady(id, ctx, ready) {
        var gid = getGlobalIdFromCtx(ctx);
        return updateChallenge(ctx, id, function(ch) {
            if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
            if (gid) {
                ch.lobby.ready[gid] = !!ready;
                ch.lobby.lastPing[gid] = nowMs();
            }
            return ch;
        });
    }
    
    function isOtherReady(ch, myGid) {
        if (!ch || !ch.lobby || !ch.lobby.ready) return false;
        
        var otherId = (ch.from && ch.from.globalId === myGid) 
            ? (ch.to && ch.to.globalId) 
            : (ch.from && ch.from.globalId);
        if (!otherId) return false;
        if (!ch.lobby.ready[otherId]) return false;
        
        // Check staleness (90 seconds)
        if (ch.lobby.lastPing && ch.lobby.lastPing[otherId]) {
            var age = nowMs() - ch.lobby.lastPing[otherId];
            if (age >= 90000) return false;
        }
        return true;
    }
    
    // =========================================================
    // Wager negotiation
    // =========================================================
    
    function calculateAbsoluteMax(fromCtx, toPlayer) {
        var fromCash = fromCtx.cash || 0;
        var fromRep = fromCtx.rep || 0;
        var toCash = toPlayer.cash || 0;
        var toRep = toPlayer.rep || 0;
        
        return {
            cash: Math.min(fromCash, toCash),
            rep: Math.min(fromRep, toRep)
        };
    }
    
    function createWagerObject(initialOffer, absoluteMax, proposedBy) {
        var cash = Math.min(initialOffer.cash || 0, absoluteMax.cash);
        var rep = Math.min(initialOffer.rep || 0, absoluteMax.rep);
        
        return {
            cash: cash,
            rep: rep,
            absoluteMax: absoluteMax,
            ceiling: { cash: cash, rep: rep, locked: false },
            proposedBy: proposedBy || "from",
            revision: 1,
            history: [{ cash: cash, rep: rep, by: proposedBy || "from", at: nowMs() }]
        };
    }
    
    function applyCounterOffer(wager, offer, by) {
        if (!wager) return null;
        
        var newCash = Math.min(offer.cash || 0, wager.absoluteMax.cash);
        var newRep = Math.min(offer.rep || 0, wager.absoluteMax.rep);
        
        if (wager.ceiling.locked) {
            newCash = Math.min(newCash, wager.ceiling.cash);
            newRep = Math.min(newRep, wager.ceiling.rep);
        } else {
            wager.ceiling.cash = Math.max(wager.ceiling.cash, newCash);
            wager.ceiling.rep = Math.max(wager.ceiling.rep, newRep);
            wager.ceiling.locked = true;
        }
        
        wager.cash = newCash;
        wager.rep = newRep;
        wager.proposedBy = by;
        wager.revision = (wager.revision || 1) + 1;
        wager.history = wager.history || [];
        wager.history.push({ cash: newCash, rep: newRep, by: by, at: nowMs() });
        
        return wager;
    }
    
    function submitCounterOffer(id, ctx, offer) {
        var ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        var gid = getGlobalIdFromCtx(ctx);
        var myRole = (ch.from && ch.from.globalId === gid) ? "from" : "to";
        
        if (!ch.wager) {
            var absoluteMax = calculateAbsoluteMax(ctx, myRole === "from" ? ch.to : ch.from);
            ch.wager = createWagerObject(offer, absoluteMax, myRole);
        } else {
            applyCounterOffer(ch.wager, offer, myRole);
        }
        
        ch.status = "negotiating";
        
        return updateChallenge(ctx, id, function() { return ch; });
    }
    
    function acceptWager(id, ctx) {
        return updateChallenge(ctx, id, function(ch) {
            ch.status = "accepted";
            return ch;
        });
    }
    
    function isMyTurnToRespond(ch, myGlobalId) {
        if (!ch || !ch.wager) return false;
        var myRole = (ch.from && ch.from.globalId === myGlobalId) ? "from" : "to";
        return ch.wager.proposedBy !== myRole;
    }
    
    function getWagerDetails(ch) {
        if (!ch || !ch.wager) return null;
        return {
            cash: ch.wager.cash,
            rep: ch.wager.rep,
            ceiling: ch.wager.ceiling,
            absoluteMax: ch.wager.absoluteMax,
            proposedBy: ch.wager.proposedBy,
            revision: ch.wager.revision,
            ceilingLocked: ch.wager.ceiling && ch.wager.ceiling.locked,
            history: ch.wager.history || []
        };
    }
    
    // =========================================================
    // Presence
    // =========================================================
    
    function setPresence(ctx) {
        var svc = getService(ctx);
        if (!svc) return false;
        // Service handles presence automatically on start
        return svc.isActive();
    }
    
    function clearPresence(ctx) {
        var svc = getService(ctx);
        if (!svc) return false;
        // Service handles presence cleanup on stop
        return true;
    }
    
    function getOnlinePlayers(ctx) {
        var svc = getService(ctx);
        if (!svc) return {};
        svc.cycle();
        return svc.getOnlinePlayers() || {};
    }
    
    function isPlayerOnline(globalId, ctx) {
        var svc = getService(ctx);
        if (!svc) return false;
        return svc.isPlayerOnline(globalId);
    }
    
    // =========================================================
    // Service lifecycle (these are no-ops - service managed by lorb.js)
    // =========================================================
    
    function cycle() {
        // No-op - individual views should call ctx._networkService.cycle()
    }
    
    function disconnect() {
        // No-op - service managed by lorb.js
    }
    
    // =========================================================
    // Export
    // =========================================================
    
    this.LORB.Multiplayer.Challenges = {
        // Challenge CRUD
        createChallenge: createChallenge,
        sendChallenge: createChallenge,  // Alias
        getChallenge: getChallenge,
        listIncoming: listIncoming,
        listOutgoing: listOutgoing,
        getIncomingChallenges: listIncoming,
        getSentChallenges: listOutgoing,
        
        // Challenge lifecycle
        markAccepted: markAccepted,
        markDeclined: markDeclined,
        markCancelled: markCancelled,
        markReady: markReady,
        isOtherReady: isOtherReady,
        acceptChallenge: markAccepted,
        declineChallenge: markDeclined,
        cancelChallenge: markCancelled,
        
        // Wager negotiation
        calculateAbsoluteMax: calculateAbsoluteMax,
        createWagerObject: createWagerObject,
        applyCounterOffer: applyCounterOffer,
        submitCounterOffer: submitCounterOffer,
        acceptWager: acceptWager,
        isMyTurnToRespond: isMyTurnToRespond,
        getWagerDetails: getWagerDetails,
        
        // Presence
        setPresence: setPresence,
        clearPresence: clearPresence,
        getOnlinePlayers: getOnlinePlayers,
        isPlayerOnline: isPlayerOnline,
        
        // Service (no-ops)
        cycle: cycle,
        disconnect: disconnect,
        
        // Helpers
        buildPlayerRef: buildPlayerRef,
        buildPlayerRefFromCtx: buildPlayerRefFromCtx
    };
    
})();
