/**
 * playoff_view.js - UI for LORB Parallel Playoffs
 * 
 * Provides UI components for:
 * - Viewing playoff bracket
 * - Playing playoff matches (using frozen Season N snapshots)
 * - Status messages about playoff progress
 * 
 * Per spec: Players can access both Season N+1 (regular) and Season N playoffs
 * in the same session via the main menu.
 */

var _playoffRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _playoffRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[PLAYOFF_VIEW] Failed to load RichView: " + e);
}

(function() {
    
    var RichView = _playoffRichView;
    
    // ========== PLAYOFF STATUS ASCII ART ==========
    // Each art piece is an array of 20 lines, 40 chars wide
    // Uses \x01 codes for colors (Synchronet format)
    
    var PLAYOFF_ART = {
        // Champion - trophy celebration
        champion: [
            "                                        ",
            "               \\\\\\|||///               ",
            "                \\\\|||//                ",
            "               .--------.               ",
            "              /   ___    \\              ",
            "             |   (___)    |             ",
            "             |   '   '    |             ",
            "              \\   ###   /              ",
            "               '-------'               ",
            "                  | |                  ",
            "                  | |                  ",
            "                 /| |\\                 ",
            "                /_| |_\\                ",
            "              |_________|              ",
            "                                        ",
            "         \x01y\x01h*** CHAMPION! ***\x01n         ",
            "                                        ",
            "       \x01gYou conquered Season \x01h#N\x01n       ",
            "                                        ",
            "                                        "
        ],
        
        // Eliminated - knocked out
        eliminated: [
            "                                        ",
            "                                        ",
            "              .-~~~~~~~-.              ",
            "            .'           '.            ",
            "           /   X       X   \\           ",
            "          |                 |          ",
            "          |                 |          ",
            "          |     .-----.     |          ",
            "           \\   (       )   /           ",
            "            '.  ~~~~~~~  .'            ",
            "              '---------'              ",
            "                                        ",
            "          \x01r\x01h** ELIMINATED **\x01n          ",
            "                                        ",
            "         You fought bravely but        ",
            "         fell in the playoffs.         ",
            "                                        ",
            "        Better luck next season!       ",
            "                                        ",
            "                                        "
        ],
        
        // Ghost match available - player vs shadow
        ghost_match: [
            "                                        ",
            "        YOU              GHOST         ",
            "                                        ",
            "       .---.            .---.          ",
            "      ( o o )    VS    ( ? ? )         ",
            "       \\ ^ /            \\ ~ /          ",
            "        |||              |||           ",
            "       /|||\\            /|||\\          ",
            "        / \\              / \\           ",
            "                                        ",
            "       \x01y\x01h*** GHOST MATCH ***\x01n          ",
            "                                        ",
            "      \x01rOpponent missed deadline!\x01n      ",
            "                                        ",
            "       Play against their AI to        ",
            "       secure your advancement.        ",
            "                                        ",
            "       \x01gThis match is free!\x01n           ",
            "                                        ",
            "                                        "
        ],
        
        // Waiting for opponent (offline, not past deadline)
        waiting_opponent: [
            "                                        ",
            "                                        ",
            "              .---.                    ",
            "             ( o o )                   ",
            "              \\ ? /                    ",
            "               |||                     ",
            "              /|||\\                    ",
            "               / \\                     ",
            "                                        ",
            "                         ???           ",
            "                        .---.          ",
            "                       ( ? ? )         ",
            "                                        ",
            "        \x01y** WAITING FOR OPPONENT **\x01n    ",
            "                                        ",
            "         Your opponent is offline.     ",
            "         Check back later or wait      ",
            "         for the deadline to pass.     ",
            "                                        ",
            "                                        "
        ],
        
        // Waiting for round to complete
        waiting_round: [
            "                                        ",
            "                                        ",
            "              .---------.              ",
            "             /   12:00   \\             ",
            "            |      |      |            ",
            "            |      *---   |            ",
            "             \\           /             ",
            "              '---------'              ",
            "                                        ",
            "                                        ",
            "         \x01g** ROUND COMPLETE **\x01n         ",
            "                                        ",
            "         You've won your match!        ",
            "                                        ",
            "         Waiting for other games       ",
            "         in this round to finish...    ",
            "                                        ",
            "        Press \x01hB\x01n to view bracket       ",
            "                                        ",
            "                                        "
        ],
        
        // PvP match available
        pvp_ready: [
            "                                        ",
            "        YOU              OPP           ",
            "                                        ",
            "       .---.            .---.          ",
            "      ( o o )    VS    ( o o )         ",
            "       \x01g\\ ^ /\x01n            \x01r\\ ^ /\x01n          ",
            "        |||              |||           ",
            "       /|||\\            /|||\\          ",
            "        / \\              / \\           ",
            "                                        ",
            "        \x01g\x01h*** PVP MATCH! ***\x01n           ",
            "                                        ",
            "        \x01wYour opponent is \x01g\x01hONLINE\x01n       ",
            "                                        ",
            "         Challenge them now for        ",
            "         a real player-vs-player       ",
            "         playoff showdown!             ",
            "                                        ",
            "                                        ",
            "                                        "
        ],
        
        // Not in playoffs
        not_qualified: [
            "                                        ",
            "                                        ",
            "              .---.                    ",
            "             ( . . )                   ",
            "              \\ _ /                    ",
            "               |||                     ",
            "              /|||\\                    ",
            "               / \\                     ",
            "                                        ",
            "                                        ",
            "       \x01y** NOT IN PLAYOFFS **\x01n         ",
            "                                        ",
            "        You didn't qualify for         ",
            "        this season's playoffs.        ",
            "                                        ",
            "         Keep playing to earn          ",
            "         your spot next time!          ",
            "                                        ",
            "                                        ",
            "                                        "
        ]
    };
    
    /**
     * Draw ASCII art into the art zone frame
     */
    function drawPlayoffArt(artFrame, artKey, seasonNumber) {
        if (!artFrame) return;
        
        var art = PLAYOFF_ART[artKey] || PLAYOFF_ART.waiting_round;
        
        // Clear the art zone
        try { artFrame.clear(); } catch (e) {}
        
        // Draw each line
        for (var row = 0; row < art.length && row < 20; row++) {
            var line = art[row];
            // Replace season placeholder
            if (seasonNumber && line.indexOf("#N") !== -1) {
                line = line.replace("#N", String(seasonNumber));
            }
            
            try {
                artFrame.gotoxy(1, row + 1);
                artFrame.putmsg(line);
            } catch (e) {}
        }
        
        try { if (artFrame.cycle) artFrame.cycle(); } catch (e) {}
    }
    
    // ========== HELPERS ==========
    
    function logPlayoffUI(op, status, extra) {
        if (typeof debugLog !== "function") return;
        var msg = "[LORB:PLAYOFF_UI] op=" + op + " status=" + status;
        if (extra) msg += " info=" + extra;
        debugLog(msg);
    }
    
    /**
     * Format a match for display
     */
    function formatMatch(match, showDetails) {
        if (!match) return "---";
        
        var p1Name = match.player1 ? match.player1.name : "BYE";
        var p2Name = match.player2 ? match.player2.name : "BYE";
        
        var status = match.status || "pending";
        var statusColor = "\1w";
        
        switch (status) {
            case "completed":
            case "bye":
                statusColor = "\1n\1g";
                break;
            case "in_progress":
                statusColor = "\1h\1y";
                break;
            case "pending":
                statusColor = "\1n\1w";
                break;
        }
        
        var line = statusColor;
        
        if (status === "completed" || status === "bye") {
            // Show winner highlighted, score in white, loser in light red
            var winnerName = match.winner ? match.winner.name : "?";
            var loserName = match.loser ? match.loser.name : "?";
            
            if (match.score) {
                line += "\1h\1g" + winnerName + " \1h\1w" + match.score.winner + "-" + match.score.loser + " \1h\1r" + loserName + "\1n";
            } else {
                line += "\1h\1g" + winnerName + "\1h\1w def. \1h\1r" + loserName + "\1n";
            }
            
            if (showDetails && match.resolution) {
                line += " \1h\1k(" + match.resolution + ")\1n";
            }
        } else {
            // Pending or in-progress
            line += p1Name + " vs " + p2Name + "\1n";
            
            // Add deadline indicator for pending matches
            if (showDetails && match.status === "pending" && LORB.Playoffs) {
                if (LORB.Playoffs.isMatchPastSoftDeadline(match)) {
                    line += " \1r[PAST DEADLINE]\1n";
                } else {
                    var timeLeft = LORB.Playoffs.getTimeUntilSoftDeadline(match);
                    if (timeLeft > 0) {
                        var daysLeft = Math.ceil(timeLeft / (LORB.Config.DAY_DURATION_MS || 3600000));
                        line += " \1h\1k[" + daysLeft + " day" + (daysLeft !== 1 ? "s" : "") + " left]\1n";
                    }
                }
            }
        }
        
        return line;
    }
    
    /**
     * Format a round name for display
     */
    function formatRoundName(roundName) {
        var names = {
            "finals": "FINALS",
            "semifinals": "SEMI-FINALS",
            "quarterfinals": "QUARTER-FINALS",
            "round_of_16": "ROUND OF 16",
            "round_1": "ROUND 1",
            "round_2": "ROUND 2"
        };
        return names[roundName] || roundName.toUpperCase();
    }
    
    // ========== BRACKET DISPLAY ==========
    
    /**
     * Show the playoff bracket in a simple ASCII format
     */
    function showBracket(bracket, ctx) {
        if (!bracket) {
            showNoBracket();
            return;
        }
        
        if (RichView) {
            showBracketRichView(bracket, ctx);
        } else {
            showBracketLegacy(bracket, ctx);
        }
    }
    
    function showNoBracket() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.header("PLAYOFFS");
            view.blank();
            view.line("\1wNo active playoffs at this time.\1n");
            view.blank();
            view.line("Playoffs begin when a season ends.");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.clear();
            LORB.View.header("PLAYOFFS");
            LORB.View.line("");
            LORB.View.line("No active playoffs at this time.");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function showBracketRichView(bracket, ctx) {
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 3 },
                { name: "content", x: 1, y: 4, width: 80, height: 20 }
            ],
            theme: "lorb"
        });
        
        view.setContentZone("content");
        
        var seasonNum = bracket.seasonNumber || "?";
        var bracketStatus = bracket.status || "active";
        var statusText = bracketStatus === "completed" ? "\1gCOMPLETE\1n" : "\1yIN PROGRESS\1n";
        
        view.line("\1h\1cSEASON " + seasonNum + " PLAYOFFS\1n  [" + statusText + "]");
        view.blank();
        
        // Show champion if bracket is complete
        if (bracket.championName) {
            view.line("\1y\1h*** CHAMPION: " + bracket.championName.toUpperCase() + " ***\1n");
            view.blank();
        }
        
        // Group matches by round
        var rounds = {};
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            var roundName = match.round || "unknown";
            if (!rounds[roundName]) {
                rounds[roundName] = [];
            }
            rounds[roundName].push(match);
        }
        
        // Display rounds in order (finals last)
        var roundOrder = ["round_of_16", "quarterfinals", "semifinals", "finals"];
        
        for (var r = 0; r < roundOrder.length; r++) {
            var roundName = roundOrder[r];
            if (!rounds[roundName]) continue;
            
            var roundMatches = rounds[roundName];
            
            view.line("\1h\1w" + formatRoundName(roundName) + "\1n");
            view.line("\1h\1k\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\1n");
            
            for (var m = 0; m < roundMatches.length; m++) {
                var matchLine = formatMatch(roundMatches[m], true);
                
                // Highlight player's match
                var p1Id = roundMatches[m].player1 ? roundMatches[m].player1.playerId : null;
                var p2Id = roundMatches[m].player2 ? roundMatches[m].player2.playerId : null;
                var playerId = ctx ? (ctx._globalId || ctx.name) : null;
                
                if (playerId && (p1Id === playerId || p2Id === playerId)) {
                    matchLine = "\1y>>> " + matchLine + " <<<\1n";
                }
                
                view.line("  " + matchLine);
            }
            
            view.blank();
        }
        
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey();
        view.close();
    }

    function showBracketLegacy(bracket, ctx) {
        LORB.View.clear();
        LORB.View.header("SEASON " + bracket.seasonNumber + " PLAYOFFS");
        LORB.View.line("");
        
        if (bracket.championName) {
            LORB.View.line("*** CHAMPION: " + bracket.championName + " ***");
            LORB.View.line("");
        }
        
        // Simple list format
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            LORB.View.line(match.round + " - " + formatMatch(match, true));
        }
        
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    // ========== PLAYER STATUS ==========
    
    /**
     * Show the player's playoff status
     */
    function showPlayerStatus(ctx) {
        if (!LORB.Playoffs) {
            logPlayoffUI("showStatus", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        logPlayoffUI("showStatus", "start", "playerId=" + playerId);
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        logPlayoffUI("showStatus", "status", "inPlayoffs=" + status.inPlayoffs + 
            " hasPending=" + status.hasPendingMatch + 
            " eliminated=" + status.eliminated +
            " pendingCount=" + (status.pendingMatches ? status.pendingMatches.length : 0));
        
        if (RichView) {
            return showPlayerStatusRichView(status, ctx, playerId);
        } else {
            return showPlayerStatusLegacy(status, ctx);
        }
    }
    
    function showPlayerStatusRichView(status, ctx, playerId) {
        // Determine art key based on status
        var artKey = "not_qualified";
        var oppOnline = false;
        var isPastDeadline = false;
        var myPlayerId = playerId || ctx._globalId || ctx.name;
        var oppId = null;
        var oppName = null;
        
        if (status.champion) {
            artKey = "champion";
        } else if (status.eliminated) {
            artKey = "eliminated";
        } else if (status.inPlayoffs) {
            if (status.hasPendingMatch && status.pendingMatches[0]) {
                var pending = status.pendingMatches[0];
                oppId = pending.player1.playerId === myPlayerId 
                    ? pending.player2.playerId 
                    : pending.player1.playerId;
                oppName = pending.player1.playerId === myPlayerId
                    ? pending.player2.name
                    : pending.player1.name;
                
                if (LORB.Persist && LORB.Persist.isPlayerOnline) {
                    oppOnline = LORB.Persist.isPlayerOnline(oppId);
                }
                isPastDeadline = LORB.Playoffs && LORB.Playoffs.isMatchPastSoftDeadline 
                    ? LORB.Playoffs.isMatchPastSoftDeadline(pending) : false;
                
                if (oppOnline) {
                    artKey = "pvp_ready";
                } else if (isPastDeadline) {
                    artKey = "ghost_match";
                } else {
                    artKey = "waiting_opponent";
                }
            } else {
                artKey = "waiting_round";
            }
        }
        
        // Create RichView with zones (like hub.js) - 40x20 art on left
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        
        // Draw header
        view.header("YOUR PLAYOFF STATUS");
        
        // Draw art in art zone using getZone() API
        var artFrame = view.getZone("art");
        if (artFrame) {
            drawPlayoffArt(artFrame, artKey, status.seasonNumber);
        }
        
        // Content based on status
        view.blank();
        
        if (!status.inPlayoffs) {
            if (status.seasonNumber) {
                view.line("\1wYou did not qualify for Season " + status.seasonNumber + " playoffs.\1n");
            } else {
                view.line("\1wNo playoffs are currently active.\1n");
            }
            view.blank();
            view.line("Keep playing to qualify for next season!");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
            return null;
        }

        view.line("\1cSeason " + status.seasonNumber + " Playoffs\1n");
        view.blank();
        
        if (status.champion) {
            view.line("\1y\1h*** CONGRATULATIONS! ***\1n");
            view.line("\1gYou are the Season " + status.seasonNumber + " Champion!\1n");
            view.blank();
        } else if (status.eliminated) {
            view.line("\1rYou have been eliminated.\1n");
            view.line("Better luck next season!");
            view.blank();
        } else {
            view.line("\1gYou are still in the tournament!\1n");
            view.line("Current round: \1h" + formatRoundName(status.currentRound) + "\1n");
            view.blank();
            
            if (status.hasPendingMatch) {
                view.line("\1y\1hYou have a playoff match waiting!\1n");
                view.line("Opponent: \1w" + (oppName || "Unknown") + "\1n");
                
                if (oppOnline) {
                    view.line("Status: \1g● Online\1n - PvP match available!");
                } else if (isPastDeadline) {
                    view.line("Status: \1r⚠ PAST DEADLINE\1n - Opponent absent");
                    view.line("\1wYou can play a Ghost Match (vs AI) to advance!\1n");
                } else {
                    view.line("Status: \1y○ Offline\1n - Waiting for opponent");
                }
                view.blank();
            } else {
                // No pending match - waiting for round to complete
                view.line("\1wWaiting for current round to complete...\1n");
                view.blank();
            }
        }
        
        // Menu options
        var menuItems = [];
        
        if (status.hasPendingMatch && !status.eliminated && !status.champion) {
            // Show appropriate menu option based on status
            if (oppOnline) {
                menuItems.push({ text: "Challenge to PvP Match", value: "play", hotkey: "P" });
            } else if (isPastDeadline) {
                menuItems.push({ text: "\1yPlay Ghost Match (vs AI)\1n", value: "play", hotkey: "P" });
            } else {
                menuItems.push({ text: "Play Playoff Match", value: "play", hotkey: "P" });
            }
        }
        
        // Check if there are other matches past soft deadline that this player can force-sim
        // (player has completed their match in the same round and is waiting)
        if (!status.eliminated && !status.champion && !status.hasPendingMatch && LORB.Playoffs) {
            var matchesPastDeadline = LORB.Playoffs.getMatchesPastSoftDeadline();
            var canForceSimAny = false;
            
            for (var i = 0; i < matchesPastDeadline.length; i++) {
                if (LORB.Playoffs.canPlayerForceSimMatch(myPlayerId, matchesPastDeadline[i])) {
                    canForceSimAny = true;
                    break;
                }
            }
            
            if (canForceSimAny) {
                view.line("\1y⚠ Other matches are past their deadline!\1n");
                view.line("\1wYou can force-simulate them to advance the bracket.\1n");
                view.blank();
                menuItems.push({ text: "\1yForce-Simulate Stalled Matches\1n", value: "force_sim", hotkey: "F" });
            }
        }
        
        // Champion Red Bull Challenge option
        if (status.champion && LORB.Playoffs && LORB.Playoffs.canChampionChallenge) {
            var challengeState = LORB.Playoffs.getChampionChallengeState(status.seasonNumber, myPlayerId);
            if (challengeState.redBullDefeated) {
                // Already beaten - show victory marker
                view.line("\1h\1r★ \1gYou have conquered the Red Bull! \1r★\1n");
                view.blank();
            } else if (challengeState.triesRemaining > 0) {
                // Can still challenge
                var triesText = "\1w(" + challengeState.triesRemaining + " " + 
                    (challengeState.triesRemaining === 1 ? "try" : "tries") + " left)\1n";
                menuItems.push({ 
                    text: "\1h\1rChallenge the Red Bull\1n " + triesText, 
                    value: "red_bull_challenge", 
                    hotkey: "R" 
                });
            } else {
                // No tries left
                view.line("\1h\1kNo challenge attempts remaining.\1n");
                view.blank();
            }
        }
        
        menuItems.push({ text: "View Full Bracket", value: "bracket", hotkey: "B" });
        menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
        
        var choice = view.menu(menuItems);
        view.close();
        
        return choice;
    }
    
    function showPlayerStatusLegacy(status, ctx) {
        LORB.View.clear();
        LORB.View.header("YOUR PLAYOFF STATUS");
        LORB.View.line("");
        
        if (!status.inPlayoffs) {
            LORB.View.line("You are not in the playoffs.");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return null;
        }
        
        LORB.View.line("Season " + status.seasonNumber + " Playoffs");
        LORB.View.line("");
        
        var playerId = ctx._globalId || ctx.name;
        var canChallenge = false;
        var challengeState = null;
        
        if (status.champion) {
            LORB.View.line("*** YOU ARE THE CHAMPION! ***");
            
            // Check for Red Bull challenge
            if (LORB.Playoffs && LORB.Playoffs.canChampionChallenge) {
                canChallenge = LORB.Playoffs.canChampionChallenge(status.seasonNumber, playerId);
                challengeState = LORB.Playoffs.getChampionChallengeState(status.seasonNumber, playerId);
                
                LORB.View.line("");
                if (challengeState.redBullDefeated) {
                    LORB.View.line("* You have conquered the Red Bull! *");
                } else if (canChallenge) {
                    LORB.View.line("[R] Challenge the Red Bull (" + challengeState.triesRemaining + " tries)");
                } else {
                    LORB.View.line("No challenge attempts remaining.");
                }
            }
        } else if (status.eliminated) {
            LORB.View.line("You have been eliminated.");
        } else {
            LORB.View.line("You are still in the tournament.");
            if (status.hasPendingMatch) {
                LORB.View.line("");
                LORB.View.line("[P] Play Playoff Match");
            }
        }
        
        LORB.View.line("[B] View Bracket");
        LORB.View.line("[Q] Back");
        LORB.View.line("");
        
        var key = LORB.View.prompt("Choice: ").toUpperCase();
        
        switch (key) {
            case "P": return "play";
            case "B": return "bracket";
            case "R": 
                if (canChallenge) return "red_bull_challenge";
                return "back";
            default: return "back";
        }
    }
    
    // ========== PLAYOFF MATCH FLOW ==========
    
    /**
     * Start a playoff match for the player
     * Uses their Season N snapshot, not current Season N+1 build
     */
    function playPlayoffMatch(ctx) {
        if (!LORB.Playoffs) {
            logPlayoffUI("playMatch", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var pending = LORB.Playoffs.getPlayerPendingMatches(playerId);
        
        if (!pending || pending.length === 0) {
            showNoMatchAvailable();
            return null;
        }
        
        // pending[0] is the oldest pending match (from oldest bracket)
        var match = pending[0];
        
        // Get the correct bracket for this match (may not be the "primary" active bracket)
        var bracketSeasonNumber = match._bracketSeasonNumber;
        var bracket = bracketSeasonNumber 
            ? LORB.Playoffs.loadBracket(bracketSeasonNumber)
            : LORB.Playoffs.getActiveBracketForPlayer(playerId);
        
        if (!bracket) {
            bracket = LORB.Playoffs.getActiveBracket();
        }
        
        if (!bracket) {
            showNoMatchAvailable();
            return null;
        }
        
        logPlayoffUI("playMatch", "bracket", "season=" + bracket.seasonNumber);
        
        // Determine opponent
        var isPlayer1 = match.player1 && match.player1.playerId === playerId;
        var opponent = isPlayer1 ? match.player2 : match.player1;
        
        if (!opponent || opponent.isBye) {
            // Auto-advance for BYE
            logPlayoffUI("playMatch", "bye", "auto_advancing");
            return advanceByeMatch(bracket, match, playerId);
        }
        
        // Load snapshots for both players
        var mySnapshot = LORB.Playoffs.loadSnapshot(bracket.seasonNumber, playerId);
        var oppSnapshot = LORB.Playoffs.loadSnapshot(bracket.seasonNumber, opponent.playerId);
        
        if (!mySnapshot) {
            logPlayoffUI("playMatch", "error", "my_snapshot_missing");
            showSnapshotError();
            return null;
        }
        
        // Check if opponent is online (for PvP vs Ghost decision)
        var oppOnline = false;
        if (LORB.Persist && LORB.Persist.isPlayerOnline) {
            oppOnline = LORB.Persist.isPlayerOnline(opponent.playerId);
        }
        
        // Show pre-match screen
        showPreMatchScreen(match, mySnapshot, oppSnapshot, oppOnline);
        
        var confirm = confirmPlayMatch();
        logPlayoffUI("playMatch", "confirm", "confirmed=" + confirm);
        if (!confirm) {
            logPlayoffUI("playMatch", "cancelled", "user_cancelled");
            return null;
        }
        
        // Determine resolution mode and run match
        var result = null;
        
        logPlayoffUI("playMatch", "mode", "oppOnline=" + oppOnline);
        
        if (oppOnline) {
            // PvP playoff match - use challenge system
            result = runPvpPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, opponent, ctx);
        }
        
        // If PvP failed/declined or opponent offline, use ghost match
        if (!result) {
            logPlayoffUI("playMatch", "ghost", "running ghost match");
            var resolution = LORB.Playoffs.RESOLUTION.GHOST;
            result = runPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, resolution, ctx);
            logPlayoffUI("playMatch", "ghost_result", "result=" + (result ? "ok" : "null"));
        }
        
        if (result) {
            showMatchResult(result, match);
        } else {
            logPlayoffUI("playMatch", "no_result", "match returned null");
        }
        
        return result;
    }
    
    /**
     * Run a PvP playoff match using the challenge system
     * Returns null if PvP was cancelled/failed (caller should fall back to ghost)
     */
    function runPvpPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, opponent, ctx) {
        logPlayoffUI("runPvpPlayoff", "start", "matchId=" + match.id);
        
        // Check if challenge system is available
        if (!LORB.Multiplayer || !LORB.Multiplayer.Challenges || !LORB.Multiplayer.Challenges.sendChallenge) {
            logPlayoffUI("runPvpPlayoff", "error", "challenge_system_unavailable");
            showPvpUnavailable("Challenge system not available.");
            return null;
        }
        
        // Build target player object for challenge system
        var targetPlayer = {
            playerId: opponent.playerId,
            name: oppSnapshot ? oppSnapshot.name : opponent.name,
            globalId: opponent.playerId
        };
        
        // Playoff challenge metadata
        var challengeOptions = {
            mode: "playoff",
            playoffMatchId: match.id,
            playoffRound: match.round,
            seasonNumber: bracket.seasonNumber
        };
        
        var challenge = null;
        var lobbyResult = null;
        
        // Try the negotiation UI if available (handles wager input + waiting)
        if (LORB.Multiplayer.ChallengeNegotiation && LORB.Multiplayer.ChallengeNegotiation.showChallengerWagerInput) {
            // Pass playoff context to negotiation
            var negotiationResult = LORB.Multiplayer.ChallengeNegotiation.showChallengerWagerInput(ctx, targetPlayer, challengeOptions);
            
            if (!negotiationResult || negotiationResult.status === "cancelled") {
                logPlayoffUI("runPvpPlayoff", "cancelled", "user_cancelled_negotiation");
                return null;
            }
            
            challenge = negotiationResult.challenge;
            lobbyResult = negotiationResult;
        } else {
            // Legacy path - send challenge directly
            challenge = LORB.Multiplayer.Challenges.sendChallenge(ctx, targetPlayer, challengeOptions);
            
            if (!challenge) {
                logPlayoffUI("runPvpPlayoff", "error", "challenge_send_failed");
                showPvpUnavailable("Failed to send playoff challenge.");
                return null;
            }
            
            // Show waiting UI
            if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting) {
                LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting(
                    challenge,
                    "Waiting for " + targetPlayer.name + " to accept playoff match..."
                );
            }
            
            // Wait for opponent to accept
            if (LORB.Multiplayer.ChallengeLobby && LORB.Multiplayer.ChallengeLobby.waitForReady) {
                lobbyResult = LORB.Multiplayer.ChallengeLobby.waitForReady(challenge.id, ctx, { tickMs: 1200 });
            } else {
                mswait(5000);
                lobbyResult = { status: "timeout" };
            }
        }
        
        // Handle non-ready outcomes
        if (!lobbyResult || lobbyResult.status !== "ready") {
            var status = lobbyResult ? lobbyResult.status : "error";
            logPlayoffUI("runPvpPlayoff", "not_ready", "status=" + status);
            
            if (status === "declined") {
                showPvpDeclined(targetPlayer.name);
            } else if (status === "timeout") {
                showPvpTimeout(targetPlayer.name);
            }
            // Return null to trigger ghost match fallback
            return null;
        }
        
        // Both players ready - launch the match!
        logPlayoffUI("runPvpPlayoff", "launching", "challengeId=" + challenge.id);
        
        if (!LORB.Multiplayer.Launcher || !LORB.Multiplayer.Launcher.launchLorbMatch) {
            logPlayoffUI("runPvpPlayoff", "error", "launcher_unavailable");
            showPvpUnavailable("Match launcher not available.");
            return null;
        }
        
        // Launch the multiplayer match
        var gameResult = LORB.Multiplayer.Launcher.launchLorbMatch(challenge, ctx, true);
        
        if (!gameResult || !gameResult.completed) {
            logPlayoffUI("runPvpPlayoff", "error", "match_incomplete");
            return null;
        }
        
        // Record the result to the playoff bracket
        var winnerId = gameResult.iWon ? (ctx._globalId || ctx.name) : opponent.playerId;
        var loserId = gameResult.iWon ? opponent.playerId : (ctx._globalId || ctx.name);
        
        var finalizeResult = LORB.Playoffs.finalizeMatch(bracket.seasonNumber, match.id, {
            winnerId: winnerId,
            loserId: loserId,
            winnerScore: gameResult.iWon ? gameResult.score.teamA : gameResult.score.teamB,
            loserScore: gameResult.iWon ? gameResult.score.teamB : gameResult.score.teamA,
            resolution: LORB.Playoffs.RESOLUTION.PVP
        });
        
        logPlayoffUI("runPvpPlayoff", "finalized", "winnerId=" + winnerId + " result=" + (finalizeResult ? "ok" : "failed"));
        
        return {
            winner: winnerId,
            score: gameResult.score,
            resolution: "pvp",
            iWon: gameResult.iWon
        };
    }
    
    // ========== CHAMPION RED BULL CHALLENGE ==========
    
    /**
     * Launch the Champion's Red Bull Challenge (Jordan + Red Bull)
     * 
     * Flow:
     * 1. Show Jordan intro with rich view art
     * 2. Play Jordan match (using jordan difficulty)
     * 3. If lose: Show Jordan trash talk, use one try
     * 4. If win: Show Jordan reaction, proceed to Red Bull
     * 5. Show Red Bull intro with "CHALLENGER!" figlet
     * 6. Play Red Bull match (using red_bull difficulty)
     * 7. Record result (win or lose)
     */
    function launchChampionChallenge(ctx) {
        if (!LORB.Playoffs) {
            logPlayoffUI("championChallenge", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        
        // Get the status to find which bracket they're champion of
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        if (!status.champion) {
            logPlayoffUI("championChallenge", "error", "not_champion");
            return null;
        }
        
        var seasonNumber = status.seasonNumber;
        
        // Check if they can still challenge
        if (!LORB.Playoffs.canChampionChallenge(seasonNumber, playerId)) {
            showNoTriesRemaining();
            return null;
        }
        
        var challengeState = LORB.Playoffs.getChampionChallengeState(seasonNumber, playerId);
        
        logPlayoffUI("championChallenge", "start", "season=" + seasonNumber + 
            " triesUsed=" + challengeState.triesUsed + " jordanDefeated=" + challengeState.jordanDefeated);
        
        // Show confirmation before starting
        if (!confirmChallengeStart(seasonNumber, challengeState)) {
            logPlayoffUI("championChallenge", "cancelled", "user_declined");
            return null;
        }
        
        // ===== JORDAN MATCH =====
        var jordanResult = runJordanMatch(ctx, seasonNumber);
        
        if (!jordanResult || jordanResult.quit) {
            // User quit - don't count as a try
            logPlayoffUI("championChallenge", "quit", "jordan_match_quit");
            return null;
        }
        
        if (!jordanResult.won) {
            // Lost to Jordan - record try and show trash talk
            LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
                beatJordan: false,
                beatRedBull: false
            });
            showJordanTrashTalk(ctx);
            logPlayoffUI("championChallenge", "jordan_loss", "recorded attempt");
            return { phase: "jordan", won: false };
        }
        
        // Beat Jordan! Show victory reaction
        showJordanDefeat(ctx);
        
        logPlayoffUI("championChallenge", "jordan_victory", "proceeding to red bull");
        
        // ===== RED BULL MATCH =====
        var redBullResult = runRedBullMatch(ctx, seasonNumber);
        
        if (!redBullResult || redBullResult.quit) {
            // Quit Red Bull match - still record Jordan victory
            LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
                beatJordan: true,
                beatRedBull: false
            });
            logPlayoffUI("championChallenge", "quit", "red_bull_match_quit");
            return { phase: "red_bull", won: false, beatJordan: true };
        }
        
        // Record the full attempt
        LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
            beatJordan: true,
            beatRedBull: redBullResult.won
        });
        
        if (redBullResult.won) {
            // ULTIMATE VICTORY!
            showRedBullVictory(ctx, seasonNumber);
            updateHallOfFameDefeatedJordan(seasonNumber, playerId);
            logPlayoffUI("championChallenge", "red_bull_victory", "LEGENDARY!");
        } else {
            // Lost to Red Bull
            showRedBullDefeat(ctx);
            logPlayoffUI("championChallenge", "red_bull_loss", "recorded attempt");
        }
        
        return {
            phase: "red_bull",
            beatJordan: true,
            won: redBullResult.won
        };
    }
    
    function confirmChallengeStart(seasonNumber, challengeState) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("CHALLENGE THE RED BULL");
            LORB.View.line("");
            LORB.View.line("Season " + seasonNumber + " Champion Challenge");
            LORB.View.line("");
            LORB.View.line("You have " + challengeState.triesRemaining + " tries remaining.");
            LORB.View.line("");
            LORB.View.line("First you must defeat Jordan & Pippen.");
            LORB.View.line("Then face the Red Bull: Satan & Iceman.");
            LORB.View.line("");
            var choice = LORB.View.prompt("Begin challenge? (Y/N): ").toUpperCase();
            return choice === "Y";
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "content", x: 1, y: 5, width: 80, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("CHALLENGE THE RED BULL");
        
        view.blank();
        view.line("\1cSeason " + seasonNumber + " Champion Challenge\1n");
        view.blank();
        view.line("\1wTries remaining: \1h\1y" + challengeState.triesRemaining + "\1n");
        view.blank();
        view.line("\1wFirst, you must defeat \1h\1rMichael Jordan & Scottie Pippen\1n");
        view.line("\1wThen face the \1h\1rRed Bull: Satan & Iceman\1n");
        view.blank();
        view.line("\1yThis will use one of your challenge attempts.\1n");
        view.blank();
        
        var choice = view.menu([
            { text: "\1h\1rBegin the Challenge\1n", value: "start", hotkey: "Y" },
            { text: "Not yet", value: "cancel", hotkey: "N" }
        ]);
        
        view.close();
        return choice === "start";
    }
    
    function showNoTriesRemaining() {
        if (!RichView) {
            LORB.View.warn("You have no challenge attempts remaining for this season.");
            console.getkey();
            return;
        }
        
        var view = new RichView({ theme: "lorb" });
        view.setContentZone("content");
        view.line("\1rYou have used all your challenge attempts.\1n");
        view.blank();
        view.line("\1wWin another championship to challenge again!\1n");
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey();
        view.close();
    }
    
    /**
     * Run the Jordan match with rich view intro
     */
    function runJordanMatch(ctx, seasonNumber) {
        // Show Jordan intro screen with art
        showJordanIntro(ctx);
        
        // Use the RedBullChallenge module if available
        if (LORB.Locations && LORB.Locations.RedBullChallenge && LORB.Locations.RedBullChallenge.launchJordanChallenge) {
            var result = LORB.Locations.RedBullChallenge.launchJordanChallenge(ctx, { skipIntro: true, skipOutro: true });
            return result;
        }
        
        // Fallback: simulate the match
        logPlayoffUI("jordanMatch", "fallback", "using simulation");
        return simulateBossMatch("jordan");
    }
    
    /**
     * Run the Red Bull match with rich view intro
     */
    function runRedBullMatch(ctx, seasonNumber) {
        // Show Red Bull intro screen with CHALLENGER! figlet
        showRedBullIntro(ctx);
        
        // Use the RedBullChallenge module if available
        if (LORB.Locations && LORB.Locations.RedBullChallenge && LORB.Locations.RedBullChallenge.launchRedBullChallenge) {
            var result = LORB.Locations.RedBullChallenge.launchRedBullChallenge(ctx, { skipIntro: true, skipOutro: true });
            return result;
        }
        
        // Fallback: simulate the match
        logPlayoffUI("redBullMatch", "fallback", "using simulation");
        return simulateBossMatch("red_bull");
    }
    
    function simulateBossMatch(bossType) {
        // Simple fallback simulation
        var difficulty = bossType === "red_bull" ? 2.0 : 1.5;
        var winChance = Math.max(0.1, 0.5 - (difficulty * 0.15));
        var won = Math.random() < winChance;
        
        return {
            completed: true,
            won: won,
            quit: false
        };
    }
    
    /**
     * Show Jordan intro with character art
     */
    function showJordanIntro(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("VS MICHAEL JORDAN");
            LORB.View.line("");
            LORB.View.line("His Airness awaits.");
            LORB.View.line("Six rings. Ten scoring titles. Legend incarnate.");
            LORB.View.line("");
            LORB.View.line("Press any key to begin...");
            console.getkey();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art_left", x: 1, y: 5, width: 40, height: 20 },
                { name: "art_right", x: 41, y: 5, width: 40, height: 20 }
            ]
        });
        
        // Draw Jordan on left, Pippen on right
        var leftZone = view.getZone("art_left");
        var rightZone = view.getZone("art_right");
        
        if (leftZone) {
            drawBossArt(leftZone, "michael_jordan");
        }
        if (rightZone) {
            drawBossArt(rightZone, "scottie_pippen");
        }
        
        // Header - red figlet style
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.clear();
            headerZone.gotoxy(1, 1);
            headerZone.putmsg("\1h\1r   __ __  ____    _  ___  ___   ___   ___   _  __\r\n");
            headerZone.putmsg("\1h\1r  / // / / __/   | |/ / / / /  / _ | / _ \\ | |/ /\r\n");
            headerZone.putmsg("\1h\1r / _  / _\\ \\    | _ / /_/ /  / __ |/  __/ |   / \r\n");
            headerZone.putmsg("\1h\1r/_//_/ /___/   |_/_/\\____/  /_/ |_/_/ \\_\\|_|\\_\\ \r\n");
        }
        
        view.render();
        mswait(1500);
        console.getkey();
        view.close();
    }
    
    /**
     * Show Red Bull intro with CHALLENGER! figlet banner
     */
    function showRedBullIntro(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("VS THE RED BULL");
            LORB.View.line("");
            LORB.View.line("The court grows cold.");
            LORB.View.line("Flames lick the baseline.");
            LORB.View.line("The GOAT awaits...");
            LORB.View.line("");
            LORB.View.line("Press any key to begin...");
            console.getkey();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art_left", x: 1, y: 5, width: 40, height: 20 },
                { name: "art_right", x: 41, y: 5, width: 40, height: 20 }
            ]
        });
        
        // Draw Devil on left, Iceman on right
        var leftZone = view.getZone("art_left");
        var rightZone = view.getZone("art_right");
        
        if (leftZone) {
            drawBossArt(leftZone, "devil", "assets/lorb/bosses/");
        }
        if (rightZone) {
            drawBossArt(rightZone, "iceman", "assets/lorb/bosses/");
        }
        
        // Header - "CHALLENGER!" in red figlet
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.clear();
            headerZone.gotoxy(1, 1);
            headerZone.putmsg("\1h\1r  ___ _  _   _   _    _    ___ _  _  ___ ___ ___ _ \r\n");
            headerZone.putmsg("\1h\1r / __| || | /_\\ | |  | |  | __| \\| |/ __| __| _ \\ |\r\n");
            headerZone.putmsg("\1h\1r| (__| __ |/ _ \\| |__| |__| _|| .` | (_ | _||   /_|\r\n");
            headerZone.putmsg("\1h\1r \\___|_||_/_/ \\_\\____|____|___|_|\\_|\\___|___|_|_(_)\r\n");
        }
        
        view.render();
        mswait(1500);
        console.getkey();
        view.close();
    }
    
    /**
     * Draw boss character art to a frame
     */
    function drawBossArt(frame, characterName, basePath) {
        basePath = basePath || "assets/characters/";
        var artPath = "/sbbs/xtrn/nba_jam/" + basePath + characterName + ".bin";
        
        try {
            if (file_exists(artPath)) {
                var Graphic = load({}, "graphic.js");
                var graphic = new Graphic(40, 20);
                graphic.load(artPath);
                graphic.draw(frame.x, frame.y);
            } else {
                // Fallback text
                frame.gotoxy(1, 10);
                frame.putmsg("\1h\1w  [" + characterName.toUpperCase() + "]\1n");
            }
        } catch (e) {
            logPlayoffUI("drawBossArt", "error", "failed to load " + artPath + ": " + e);
            frame.gotoxy(1, 10);
            frame.putmsg("\1h\1w  [" + characterName.toUpperCase() + "]\1n");
        }
    }
    
    /**
     * Show Jordan trash talk after losing
     */
    function showJordanTrashTalk(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("DEFEATED");
            LORB.View.line("");
            LORB.View.line("Jordan laughs as you walk off the court.");
            LORB.View.line("\"That's why I'm the GOAT, kid.\"");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("DEFEATED BY JORDAN");
        
        var artZone = view.getZone("art");
        if (artZone) {
            drawBossArt(artZone, "michael_jordan");
        }
        
        view.blank();
        view.line("\1rJordan laughs as you walk off.\1n");
        view.blank();
        view.line("\1w\"That's why I'm the GOAT, kid.\"\1n");
        view.blank();
        view.line("\1w\"Come back when you've got six rings.\"\1n");
        view.blank();
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey();
        view.close();
    }
    
    /**
     * Show Jordan's reaction after being beaten
     */
    function showJordanDefeat(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("JORDAN DEFEATED!");
            LORB.View.line("");
            LORB.View.line("Pippen steps forward...");
            LORB.View.line("\"Mike won't speak to the media after this.\"");
            LORB.View.line("");
            LORB.View.line("But darker forces await...");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("JORDAN DEFEATED!");
        
        var artZone = view.getZone("art");
        if (artZone) {
            drawBossArt(artZone, "scottie_pippen");
        }
        
        view.blank();
        view.line("\1gPippen steps forward...\1n");
        view.blank();
        view.line("\1w\"Mike won't speak to the media\1n");
        view.line("\1wafter this one.\"\1n");
        view.blank();
        view.line("\1rBut darker forces await...\1n");
        view.blank();
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey();
        view.close();
    }
    
    /**
     * Show Red Bull victory celebration
     */
    function showRedBullVictory(ctx, seasonNumber) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("LEGENDARY VICTORY!");
            LORB.View.line("");
            LORB.View.line("Hell freezes over.");
            LORB.View.line("The GOAT has been slain.");
            LORB.View.line("");
            LORB.View.line("You are the TRUE champion of Rim City!");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "content", x: 1, y: 5, width: 80, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        
        // Golden header
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.clear();
            headerZone.gotoxy(1, 1);
            headerZone.putmsg("\1h\1y _    ___ ___ ___ _  _ ___    _   _____   __\r\n");
            headerZone.putmsg("\1h\1y| |  | __/ __| __| \\| |   \\  /_\\ | _ \\ \\ / /\r\n");
            headerZone.putmsg("\1h\1y| |__| _| (_ | _|| .` | |) |/ _ \\|   /\\ V / \r\n");
            headerZone.putmsg("\1h\1y|____|___\\___|___|_|\\_|___//_/ \\_\\_|_\\ |_|  \r\n");
        }
        
        view.blank();
        view.blank();
        view.line("\1h\1y           ★ ★ ★  HELL FREEZES OVER  ★ ★ ★\1n");
        view.blank();
        view.line("\1h\1r           The GOAT has been slain!\1n");
        view.blank();
        view.line("\1h\1g    You are the TRUE champion of Rim City!\1n");
        view.blank();
        view.line("\1cSeason " + seasonNumber + " will remember your legend.\1n");
        view.blank();
        view.blank();
        view.line("\1h\1y    Your name now glows in the Hall of Fame!\1n");
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey();
        view.close();
    }
    
    /**
     * Show Red Bull defeat
     */
    function showRedBullDefeat(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("DEFEATED");
            LORB.View.line("");
            LORB.View.line("Satan laughs as Iceman shatters your hopes.");
            LORB.View.line("The GOAT remains supreme.");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("DEFEATED BY THE RED BULL");
        
        var artZone = view.getZone("art");
        if (artZone) {
            drawBossArt(artZone, "devil", "assets/lorb/bosses/");
        }
        
        view.blank();
        view.line("\1rSatan laughs as Iceman\1n");
        view.line("\1rshatters your hopes.\1n");
        view.blank();
        view.line("\1wThe GOAT remains supreme.\1n");
        view.blank();
        view.line("\1yMaybe next time, mortal...\1n");
        view.blank();
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey();
        view.close();
    }
    
    /**
     * Update Hall of Fame to show Jordan/Red Bull victory
     */
    function updateHallOfFameDefeatedJordan(seasonNumber, playerId) {
        // Update the hallOfFame entry for this season to set defeatedJordan = true
        if (!LORB.SharedState) return;
        
        try {
            var state = LORB.SharedState.get();
            if (!state || !state.hallOfFame) return;
            
            for (var i = 0; i < state.hallOfFame.length; i++) {
                var entry = state.hallOfFame[i];
                if (entry.seasonNumber === seasonNumber && entry.championId === playerId) {
                    entry.defeatedJordan = true;
                    entry.defeatedRedBull = true;
                    entry.redBullVictoryDate = new Date().toISOString();
                    break;
                }
            }
            
            LORB.SharedState.save();
            logPlayoffUI("updateHallOfFame", "ok", "season=" + seasonNumber + " playerId=" + playerId);
        } catch (e) {
            logPlayoffUI("updateHallOfFame", "error", e);
        }
    }

    function showPvpUnavailable(reason) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1y" + reason + "\1n");
            view.line("\1wFalling back to Ghost Match...\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(reason);
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey();
        }
    }
    
    function showPvpDeclined(oppName) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1r" + oppName + " declined the playoff match.\1n");
            view.line("\1wFalling back to Ghost Match...\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(oppName + " declined the playoff match.");
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey();
        }
    }
    
    function showPvpTimeout(oppName) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1y" + oppName + " did not respond in time.\1n");
            view.line("\1wFalling back to Ghost Match...\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(oppName + " did not respond in time.");
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey();
        }
    }
    
    function showNoMatchAvailable() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1wNo playoff match available.\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.line("No playoff match available.");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function showSnapshotError() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1rError: Could not load your playoff snapshot.\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn("Error: Could not load your playoff snapshot.");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function advanceByeMatch(bracket, match, playerId) {
        // Auto-advance the player
        var result = LORB.Playoffs.finalizeMatch(bracket.seasonNumber, match.id, {
            winnerId: playerId,
            loserId: null,
            winnerScore: 0,
            loserScore: 0,
            resolution: "bye"
        });
        
        if (result) {
            if (RichView) {
                var view = new RichView({ theme: "lorb" });
                view.setContentZone("content");
                view.line("\1gYou advance with a BYE!\1n");
                view.blank();
                view.line("\1h\1kPress any key...\1n");
                view.render();
                console.getkey();
                view.close();
            } else {
                LORB.View.line("You advance with a BYE!");
                LORB.View.line("Press any key...");
                console.getkey();
            }
        }
        
        return result;
    }
    
    function showPreMatchScreen(match, mySnapshot, oppSnapshot, oppOnline) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            view.header("PLAYOFF MATCH");
            view.blank();
            view.line("\1h" + formatRoundName(match.round) + "\1n");
            view.blank();
            
            view.line("\1wYou:\1n " + mySnapshot.name);
            view.line("  Stats: SPD " + mySnapshot.stats.speed + " / 3PT " + mySnapshot.stats.threePt + " / PWR " + mySnapshot.stats.power);
            view.blank();
            
            var oppName = oppSnapshot ? oppSnapshot.name : (match.player2 ? match.player2.name : "Unknown");
            view.line("\1wOpponent:\1n " + oppName + (oppOnline ? " \1g(ONLINE)\1n" : " \1h\1k(OFFLINE)\1n"));
            if (oppSnapshot) {
                view.line("  Stats: SPD " + oppSnapshot.stats.speed + " / 3PT " + oppSnapshot.stats.threePt + " / PWR " + oppSnapshot.stats.power);
            }
            view.blank();
            
            if (!oppOnline) {
                view.line("\1yOpponent is offline - this will be a Ghost Match.\1n");
                view.line("\1yYou will play against an AI using their frozen stats.\1n");
            } else {
                view.line("\1gOpponent is online - PvP match will be initiated!\1n");
                view.line("\1gThey will receive a playoff challenge to accept.\1n");
            }
            view.blank();
            
            view.close();
        } else {
            LORB.View.clear();
            LORB.View.header("PLAYOFF MATCH - " + formatRoundName(match.round));
            LORB.View.line("");
            LORB.View.line("You: " + mySnapshot.name);
            var oppName = oppSnapshot ? oppSnapshot.name : "Unknown";
            LORB.View.line("Opponent: " + oppName + (oppOnline ? " (ONLINE)" : " (OFFLINE)"));
            LORB.View.line("");
        }
    }
    
    function confirmPlayMatch() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            var choice = view.menu([
                { text: "Start Match", value: "yes", hotkey: "Y" },
                { text: "Cancel", value: "no", hotkey: "N" }
            ]);
            
            view.close();
            return choice === "yes";
        } else {
            return LORB.View.confirm("Start match? (Y/N) ");
        }
    }
    
    /**
     * Run the actual playoff match
     */
    function runPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, resolution, ctx) {
        logPlayoffUI("runMatch", "start", "resolution=" + resolution + " matchId=" + match.id);
        
        // Convert snapshots to game player format
        var myPlayer = snapshotToPlayer(mySnapshot, true);
        var oppPlayer = snapshotToPlayer(oppSnapshot || match.player2, false);
        
        logPlayoffUI("runMatch", "players", "me=" + myPlayer.name + " opp=" + oppPlayer.name);
        
        // Get teammate from snapshot
        var myTeammate = getTeammateFromSnapshot(mySnapshot);
        var oppTeammate = getTeammateFromSnapshot(oppSnapshot);
        
        // Build teams
        var teamA = [myPlayer];
        if (myTeammate) teamA.push(myTeammate);
        
        var teamB = [oppPlayer];
        if (oppTeammate) teamB.push(oppTeammate);
        
        logPlayoffUI("runMatch", "teams", "teamA=" + teamA.length + " teamB=" + teamB.length);
        
        // Try to use real game engine
        var hasEngine = (typeof runExternalGame === "function");
        logPlayoffUI("runMatch", "engine_check", "hasEngine=" + hasEngine);
        
        if (hasEngine) {
            try {
                logPlayoffUI("runMatch", "launching", "calling runExternalGame");
                var gameResult = runExternalGame({
                    teamA: {
                        name: mySnapshot.name + "'s Team",
                        players: teamA
                    },
                    teamB: {
                        name: (oppSnapshot ? oppSnapshot.name : "Opponent") + "'s Team",
                        players: teamB
                    },
                    options: {
                        mode: "play",
                        humanTeam: "teamA",
                        humanPlayerIndex: 0,
                        gameTime: 120,
                        showMatchupScreen: true,
                        showGameOverScreen: true
                    },
                    lorbContext: {
                        matchType: "playoff",
                        matchId: match.id,
                        resolution: resolution
                    }
                });
                
                logPlayoffUI("runMatch", "returned", "result=" + JSON.stringify(gameResult ? {
                    winner: gameResult.winner,
                    scoreA: gameResult.score ? gameResult.score.teamA : undefined,
                    scoreB: gameResult.score ? gameResult.score.teamB : undefined,
                    completed: gameResult.completed
                } : null));
                
                if (gameResult && gameResult.completed && gameResult.score) {
                    var iWon = gameResult.score.teamA > gameResult.score.teamB;
                    var winnerId = iWon ? mySnapshot.playerId : (oppSnapshot ? oppSnapshot.playerId : match.player2.playerId);
                    var loserId = iWon ? (oppSnapshot ? oppSnapshot.playerId : match.player2.playerId) : mySnapshot.playerId;
                    
                    logPlayoffUI("runMatch", "finalizing", "winner=" + winnerId + " score=" + 
                        gameResult.score.teamA + "-" + gameResult.score.teamB);
                    
                    // Finalize through standard path
                    return LORB.Playoffs.finalizeMatch(bracket.seasonNumber, match.id, {
                        winnerId: winnerId,
                        loserId: loserId,
                        winnerScore: iWon ? gameResult.score.teamA : gameResult.score.teamB,
                        loserScore: iWon ? gameResult.score.teamB : gameResult.score.teamA,
                        resolution: resolution
                    });
                } else {
                    logPlayoffUI("runMatch", "no_result", "gameResult incomplete or invalid");
                }
            } catch (e) {
                logPlayoffUI("runMatch", "engine_error", e.toString());
            }
        }
        
        // Fallback: CPU simulation
        logPlayoffUI("runMatch", "fallback_sim", "using cpu sim");
        return LORB.Playoffs.simulateMatchCPU(bracket, match.id);
    }
    
    /**
     * Convert a snapshot to game player format
     */
    function snapshotToPlayer(snapshot, isHuman) {
        if (!snapshot) {
            return {
                name: "Unknown",
                shortNick: "UNK",
                speed: 5, threePt: 5, dunks: 5, power: 5, defense: 5, blocks: 5,
                skin: "lightgray",
                jersey: 0,
                isHuman: isHuman
            };
        }
        
        var stats = snapshot.stats || {};
        
        return {
            name: snapshot.name || "Player",
            shortNick: snapshot.nickname || null,
            speed: stats.speed || 5,
            threePt: stats.threePt || stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: "lightgray",  // Could be stored in snapshot.appearance
            jersey: 1,
            isHuman: isHuman,
            lorbId: snapshot.playerId,
            lorbData: {
                isLorbPlayer: true,
                name: snapshot.name,
                level: snapshot.level || 1
            }
        };
    }
    
    /**
     * Get teammate player from snapshot
     */
    function getTeammateFromSnapshot(snapshot) {
        if (!snapshot || !snapshot.teammateData) {
            return null;
        }
        
        var tm = snapshot.teammateData;
        var stats = tm.stats || {};
        
        return {
            name: tm.name || "Teammate",
            shortNick: tm.shortNick || null,
            speed: stats.speed || 5,
            threePt: stats.threePt || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: tm.skin || "barney",
            jersey: 0,
            isHuman: false
        };
    }
    
    function showMatchResult(result, match) {
        if (!result) return;
        
        // Find the updated match in the result bracket
        var updatedMatch = null;
        if (result.matches) {
            for (var i = 0; i < result.matches.length; i++) {
                if (result.matches[i].id === match.id) {
                    updatedMatch = result.matches[i];
                    break;
                }
            }
        }
        
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            view.header("MATCH COMPLETE");
            view.blank();
            
            if (updatedMatch && updatedMatch.winner) {
                view.line("\1h\1w" + updatedMatch.winner.name + " WINS!\1n");
                if (updatedMatch.score) {
                    view.line("Final Score: " + updatedMatch.score.winner + " - " + updatedMatch.score.loser);
                }
            }
            
            view.blank();
            
            if (result.championPlayerId) {
                view.line("\1y\1h*** PLAYOFFS COMPLETE ***\1n");
                view.line("\1gSeason Champion: " + result.championName + "\1n");
            } else {
                view.line("You advance to the next round!");
            }
            
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.clear();
            LORB.View.header("MATCH COMPLETE");
            LORB.View.line("");
            
            if (updatedMatch && updatedMatch.winner) {
                LORB.View.line(updatedMatch.winner.name + " WINS!");
            }
            
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    // ========== HUB INTEGRATION ==========
    
    /**
     * Get a status summary line for the hub menu
     * Returns null if no playoffs or player not involved
     */
    function getHubStatusLine(ctx) {
        if (!LORB.Playoffs) return null;
        
        var playerId = ctx._globalId || ctx.name;
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        
        if (!status.inPlayoffs) {
            // Check if playoffs exist at all
            var bracket = LORB.Playoffs.getActiveBracket();
            if (bracket) {
                return "\1h\1kSeason " + bracket.seasonNumber + " Playoffs in progress\1n";
            }
            return null;
        }
        
        if (status.champion) {
            return "\1y\1h*** Season " + status.seasonNumber + " Champion! ***\1n";
        }
        
        if (status.eliminated) {
            // Use a muted color - caller can override with city theme if desired
            return "\1n\1bEliminated from Season " + status.seasonNumber + " Playoffs\1n";
        }
        
        if (status.hasPendingMatch) {
            return "\1y\1hPlayoff Match Ready! (Season " + status.seasonNumber + ")\1n";
        }
        
        return "\1gIn Season " + status.seasonNumber + " Playoffs - " + formatRoundName(status.currentRound) + "\1n";
    }
    
    /**
     * Check if player has an actionable playoff match
     */
    function hasPlayoffAction(ctx) {
        if (!LORB.Playoffs) return false;
        
        var playerId = ctx._globalId || ctx.name;
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        
        return status.inPlayoffs && status.hasPendingMatch && !status.eliminated && !status.champion;
    }
    
    // ========== MAIN ENTRY POINT ==========
    
    /**
     * Main playoff menu (called from hub or tournaments)
     */
    function run(ctx) {
        logPlayoffUI("run", "start");
        
        while (true) {
            var choice = showPlayerStatus(ctx);
            
            switch (choice) {
                case "play":
                    playPlayoffMatch(ctx);
                    break;
                    
                case "bracket":
                    // Show the bracket for the player's oldest active playoff
                    var playerId = ctx._globalId || ctx.name;
                    var bracket = LORB.Playoffs ? LORB.Playoffs.getActiveBracketForPlayer(playerId) : null;
                    if (!bracket) {
                        bracket = LORB.Playoffs ? LORB.Playoffs.getActiveBracket() : null;
                    }
                    showBracket(bracket, ctx);
                    break;
                    
                case "force_sim":
                    forceSimulateStalledMatches(ctx);
                    break;
                    
                case "red_bull_challenge":
                    launchChampionChallenge(ctx);
                    break;
                    
                case "back":
                case null:
                    return;
                    
                default:
                    return;
            }
        }
    }
    
    /**
     * Force-simulate matches that are past their soft deadline
     * This allows a waiting player to advance the bracket
     */
    function forceSimulateStalledMatches(ctx) {
        if (!LORB.Playoffs) {
            showError("Playoffs system not available.");
            return;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var matchesPastDeadline = LORB.Playoffs.getMatchesPastSoftDeadline();
        
        // Filter to matches this player can force-sim
        var simulatable = [];
        for (var i = 0; i < matchesPastDeadline.length; i++) {
            if (LORB.Playoffs.canPlayerForceSimMatch(playerId, matchesPastDeadline[i])) {
                simulatable.push(matchesPastDeadline[i]);
            }
        }
        
        if (simulatable.length === 0) {
            showInfo("No matches can be force-simulated at this time.");
            return;
        }
        
        // Show confirmation
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            view.header("FORCE-SIMULATE MATCHES");
            view.blank();
            view.line("\1yThe following matches are past their deadline:\1n");
            view.blank();
            
            for (var j = 0; j < simulatable.length; j++) {
                var m = simulatable[j];
                var p1Name = m.player1 ? m.player1.name : "BYE";
                var p2Name = m.player2 ? m.player2.name : "BYE";
                view.line("  \1w" + formatRoundName(m.round) + ":\1n " + p1Name + " vs " + p2Name);
            }
            
            view.blank();
            view.line("\1rForce-simulating will use CPU simulation to determine winners.\1n");
            view.line("\1wThis allows the bracket to advance so you can continue.\1n");
            view.blank();
            
            var choice = view.menu([
                { text: "Simulate All Stalled Matches", value: "yes", hotkey: "Y" },
                { text: "Cancel", value: "no", hotkey: "N" }
            ]);
            
            view.close();
            
            if (choice !== "yes") return;
        } else {
            LORB.View.clear();
            LORB.View.header("FORCE-SIMULATE MATCHES");
            LORB.View.line("");
            LORB.View.line(simulatable.length + " match(es) can be force-simulated.");
            LORB.View.line("");
            if (!LORB.View.confirm("Force-simulate all stalled matches? (Y/N) ")) {
                return;
            }
        }
        
        // Simulate each match (may be from different brackets)
        var simulated = 0;
        
        for (var k = 0; k < simulatable.length; k++) {
            var match = simulatable[k];
            logPlayoffUI("forceSim", "simulating", "match=" + match.id + " season=" + match._bracketSeasonNumber);
            
            // Get the correct bracket for this match
            var bracket = match._bracketSeasonNumber 
                ? LORB.Playoffs.loadBracket(match._bracketSeasonNumber)
                : LORB.Playoffs.getActiveBracket();
            
            if (bracket) {
                LORB.Playoffs.simulateMatchCPU(bracket, match.id);
                simulated++;
            }
        }
        
        // Show result
        if (RichView) {
            var resultView = new RichView({ theme: "lorb" });
            resultView.setContentZone("content");
            resultView.line("\1g" + simulated + " match(es) have been simulated!\1n");
            resultView.blank();
            resultView.line("\1wThe bracket has been updated.\1n");
            resultView.blank();
            resultView.line("\1h\1kPress any key...\1n");
            resultView.render();
            console.getkey();
            resultView.close();
        } else {
            LORB.View.line(simulated + " match(es) have been simulated!");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function showError(message) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1r" + message + "\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(message);
            console.getkey();
        }
    }
    
    function showInfo(message) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1w" + message + "\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.line(message);
            console.getkey();
        }
    }
    
    // ========== EXPORTS ==========
    
    if (!LORB.UI) LORB.UI = {};
    LORB.UI.PlayoffView = {
        run: run,
        showBracket: showBracket,
        showPlayerStatus: showPlayerStatus,
        playPlayoffMatch: playPlayoffMatch,
        forceSimulateStalledMatches: forceSimulateStalledMatches,
        getHubStatusLine: getHubStatusLine,
        hasPlayoffAction: hasPlayoffAction,
        formatRoundName: formatRoundName
    };
    
})();
