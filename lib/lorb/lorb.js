// xtrn/lorb/lorb.js
load("sbbsdefs.js");
(function () {
    // ROOT is the directory where lorb.js lives (relative to main script exec_dir)
    var ROOT = js.exec_dir + "lib/lorb/";
    
    load(ROOT + "boot.js");           // creates global LORB and loads modules
    
    // Optional: load opponent display for ANSI art viewing
    try {
        load(ROOT + "get_random_opponent.js");
        load(js.exec_dir + "lib/lorb_shared/opponent-display.js");
    } catch (e) {
        // Opponent display not critical
    }

    // ========== INITIALIZE SHARED STATE ==========
    // Ensure the shared world state exists (creates if first run)
    LORB.SharedState.initialize();
    
    // Get current shared game day and city
    var sharedInfo = LORB.SharedState.getInfo();
    var currentCity = LORB.Cities.getToday();
    
    // ========== SEASON CHECK ==========
    // Check if playoffs should trigger (Day >= SEASON_LENGTH_DAYS)
    var seasonLength = LORB.Config.SEASON_LENGTH_DAYS || 30;
    var daysRemaining = seasonLength - sharedInfo.gameDay;
    var playoffsTriggered = false;
    
    if (LORB.Season && LORB.Season.isSeasonComplete && LORB.Season.isSeasonComplete()) {
        // Season has ended - trigger playoffs!
        // This is a rare event - only the first player to log in after day 30 triggers it
        playoffsTriggered = true;
        
        // Log the event
        if (typeof log === "function") {
            log(LOG_INFO, "[LORB:SEASON] Season " + LORB.Season.getSeasonNumber() + " complete - triggering playoffs!");
        }
    }

    // ========== MAIN ENTRY POINT ==========
    
    // Try to load existing character
    var ctx = LORB.Persist.load(user);
    
    if (!ctx || !ctx.archetype) {
        // New player - run character creation
        ctx = LORB.CharacterCreation.run(user, system);
        if (!ctx) {
            // User quit during creation - clean up and exit
            LORB.Persist.disconnect();
            return;
        }
        
        // Set joinedTimestamp for new players
        ctx.joinedTimestamp = Date.now();
        ctx.joinedOnDay = sharedInfo.gameDay;
        ctx.joinedInCity = currentCity.id;
    } else {
        // Existing player - welcome back
        ctx._user = user;  // Re-attach user object (not persisted)
        
        // Ensure joinedTimestamp exists for legacy players
        if (!ctx.joinedTimestamp) {
            ctx.joinedTimestamp = Date.now();
            ctx.joinedOnDay = sharedInfo.gameDay;
            ctx.joinedInCity = currentCity.id;
        }
        
        // Initialize daily resources based on time elapsed
        // This is the ONLY place day advancement should happen - purely timestamp-based
        LORB.Locations.Hub.initDailyResources(ctx);
        
        // Clear any stale betting data from previous day (games are now watched live)
        var currentGameDay = sharedInfo.gameDay;
        if (ctx.dailyBetting && ctx.dailyBetting.day !== currentGameDay) {
            ctx.dailyBetting = null;
        }
        
        // Get city color for display
        var cityColor = LORB.Cities.getTeamColorCode(currentCity);
        
        LORB.View.clear();
        LORB.View.header("LEGEND OF THE RED BULL");
        LORB.View.line("");
        LORB.View.line("\1cWelcome back, \1h" + (ctx.name || ctx.userHandle) + "\1n\1c.\1n");
        LORB.View.line("");
        LORB.View.line("Today is " + cityColor + "Day " + currentGameDay + "/" + seasonLength + "\1n in " + cityColor + currentCity.cityName + "\1n.");
        LORB.View.line("\1n\1wThe " + currentCity.teamName + " are in town.\1n");
        
        // Show banked days info if applicable
        if (ctx._daysPassed && ctx._daysPassed > 0) {
            LORB.View.line("");
            if (ctx._effectiveDays === ctx._daysPassed) {
                LORB.View.line("\1y" + ctx._daysPassed + " day(s) have passed - resources refreshed!\1n");
            } else {
                LORB.View.line("\1y" + ctx._daysPassed + " day(s) passed, " + ctx._effectiveDays + " banked.\1n");
            }
            // Clear the temp flags after showing
            delete ctx._daysPassed;
            delete ctx._effectiveDays;
        }
        
        LORB.View.line("");
        LORB.View.line("Record: \1g" + (ctx.wins || 0) + "W\1n - \1r" + (ctx.losses || 0) + "L\1n");
        LORB.View.line("Rep: \1c" + (ctx.rep || 0) + "\1n  |  Cash: \1y$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to enter " + currentCity.cityName + "...\1n");
        console.getkey();
    }

    // Daily resources already initialized above for returning players
    // For new players, initialize now
    if (!ctx.lastPlayedTimestamp) {
        LORB.Locations.Hub.initDailyResources(ctx);
    }
    
    // Start background challenge service (non-UI) for live challenges
    if (LORB.Multiplayer && LORB.Multiplayer.ChallengeService) {
        LORB.Multiplayer.ChallengeService.start(ctx);
    }
    
    // Reset day stats for tracking
    ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };

    // ========== PLAYOFF TRIGGER ==========
    // If playoffs were triggered, run the full end-of-season flow
    if (playoffsTriggered && LORB.Season && LORB.Season.runEndOfSeason) {
        LORB.View.clear();
        LORB.View.header("END OF SEASON " + LORB.Season.getSeasonNumber());
        LORB.View.line("");
        LORB.View.line("\1h\1yThe regular season has ended!\1n");
        LORB.View.line("\1wThe playoffs are about to begin...\1n");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to watch the playoffs unfold...\1n");
        console.getkey();
        
        // Run the playoff bracket
        var seasonResults = LORB.Season.runEndOfSeason();
        
        // Display results
        LORB.View.clear();
        LORB.View.header("SEASON " + seasonResults.seasonNumber + " RESULTS");
        LORB.View.line("");
        LORB.View.line("\1h\1cPLAYOFF CHAMPION:\1n");
        LORB.View.line("\1h\1y" + (seasonResults.champion.name || seasonResults.champion.displayName) + "\1n");
        LORB.View.line("");
        
        // Jordan challenge result
        if (seasonResults.jordanResult) {
            LORB.View.line("\1h\1rJORDAN CHALLENGE:\1n");
            if (seasonResults.jordanResult.championWon) {
                LORB.View.line("\1h\1g" + seasonResults.champion.name + " DEFEATED THE RED BULL!\1n");
                LORB.View.line("\1w" + seasonResults.jordanResult.lore + "\1n");
            } else {
                LORB.View.line("\1h\1r" + LORB.Config.JORDAN_BOSS.NAME + " remains undefeated.\1n");
                LORB.View.line("\1w" + seasonResults.jordanResult.lore + "\1n");
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1cA new season begins...\1n");
        LORB.View.line("\1wAll stats have been reset. Your meta-progression carries on.\1n");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to start Season " + (seasonResults.seasonNumber + 1) + "...\1n");
        console.getkey();
        
        // Refresh shared info after reset
        sharedInfo = LORB.SharedState.getInfo();
        currentCity = LORB.Cities.getToday();
        
        // Player needs to start fresh - reset their in-memory stats
        // (the persistent reset was handled in runEndOfSeason)
        ctx.level = 1;
        ctx.xp = 0;
        ctx.rep = 0;
        ctx.wins = 0;
        ctx.losses = 0;
        ctx.gamesPlayed = 0;
        ctx.winStreak = 0;
        ctx.cash = 1000 + (ctx.meta && ctx.meta.startingCashBonus ? ctx.meta.startingCashBonus : 0);
        ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };
        
        // Clear romance
        ctx.romance = null;
    } else if (daysRemaining <= 3 && daysRemaining > 0) {
        // Warn players that playoffs are approaching
        LORB.View.line("");
        LORB.View.line("\1h\1y*** PLAYOFFS IN " + daysRemaining + " DAY" + (daysRemaining === 1 ? "" : "S") + "! ***\1n");
        LORB.View.line("\1wBuild your REP score to qualify!\1n");
    }

    // Set presence (mark as online)
    LORB.Persist.setPresence(user);
    
    // Start heartbeat to keep presence alive
    var presenceInterval = js.setInterval(function() {
        LORB.Persist.setPresence(user);
    }, 30000);  // Every 30 seconds

    // Run the main hub loop
    var hubResult = LORB.Locations.Hub.run(ctx);
    
    // Stop heartbeat
    js.clearInterval(presenceInterval);
    
    // Clear presence (mark as offline)
    LORB.Persist.clearPresence(user);
    if (LORB.Multiplayer && LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.clearForPlayer) {
        LORB.Multiplayer.Challenges.clearForPlayer(ctx);
    }
    if (LORB.Multiplayer && LORB.Multiplayer.ChallengeService) {
        LORB.Multiplayer.ChallengeService.stop();
    }
    
    // Handle exit - don't save if character was reset
    if (hubResult === "reset") {
        LORB.View.close();
        LORB.Persist.disconnect();
        return;
    }
    
    // Save on exit
    LORB.Persist.save(ctx);
    LORB.Persist.disconnect();
    
    // Close the LORB view frame
    LORB.View.close();
    
    // Farewell message with city name
    var exitCity = LORB.Cities.getToday();
    console.print("\r\nSee you next time in " + exitCity.cityName + "...\r\n");
    mswait(1500);
})();
