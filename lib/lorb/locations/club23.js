/**
 * club23.js - Club 23
 * 
 * The social hub of Rim City.
 * Rest, listen for rumors, and bet on AI vs AI games.
 * 
 * Uses RichView with dynamic content updates based on menu selection.
 */

var _club23RichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _club23RichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[CLUB23] Failed to load RichView: " + e);
}

// Load BinLoader for .bin art files
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[CLUB23] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var RichView = _club23RichView;
    
    // Art file paths
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/club23_header.bin";
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/club23_art.bin";
    var ART_HEADER_W = 80, ART_HEADER_H = 4;
    var ART_SIDE_W = 40, ART_SIDE_H = 20;
    
    // Rumor pool
    var RUMORS = [
        "\"I heard the Red Bull only plays when the moon is full...\"",
        "\"Court 9? The Rimkeeper doesn't let just anyone ball there.\"",
        "\"Some kid from Courtline Ave just dropped 50 on a Dunk District regular.\"",
        "\"They say Cloudwalkers are the only sneakers that work in the Court of Airness.\"",
        "\"The Arc? Pure shooters only. No dunkers allowed.\"",
        "\"I saw someone drink a Mystery Mix and play for three days straight.\"",
        "\"Fadeaway Prophet taught me the mid-range. Changed my life.\"",
        "\"Don't mess with Neon Gator. That dude brings chaos wherever he goes.\"",
        "\"The Red Bull? Six rings, man. Six rings forged into a spirit.\"",
        "\"Sole Collector's got cursed sneakers. Don't buy from him.\"",
        "\"Rep is everything in this city. Build yours or stay a nobody.\"",
        "\"I lost $500 betting on a sure thing. There are no sure things.\"",
        "\"The gym on 5th? Coach there trained legends.\"",
        "\"You want to face the Red Bull? You gotta earn it first.\"",
        "\"Rim City never sleeps. The courts are always open.\""
    ];
    
    // Rest flavor text
    var REST_LINES = [
        "You grab a booth and rest your legs.",
        "The bartender slides you a water. \"On the house.\"",
        "You close your eyes for a moment. The crowd noise fades.",
        "A comfortable exhaustion settles over you.",
        "The bass thumps low as you recover your strength."
    ];
    
    // Menu item descriptions for hover effect
    var MENU_INFO = {
        rest: {
            title: "Rest & Recover",
            lines: [
                "Take a load off in a corner booth.",
                "Recover some street turns.",
                "",
                "Once per day."
            ]
        },
        rumors: {
            title: "Listen for Rumors",
            lines: [
                "The regulars always have something",
                "to say. Lean in and listen.",
                "",
                "Learn about Rim City's secrets."
            ]
        },
        bet: {
            title: "Bet on a Game",
            lines: [
                "Street games run all night.",
                "Put some cash on the line.",
                "",
                "Minimum bet: $50"
            ]
        },
        leave: {
            title: "Leave Club 23",
            lines: [
                "Head back out into Rim City.",
                "",
                "The night is still young..."
            ]
        }
    };
    
    /**
     * Load art into zones (if .bin files exist)
     */
    function loadArt(view) {
        if (typeof BinLoader === "undefined") return;
        
        var headerFrame = view.getZone("header");
        if (headerFrame && file_exists(ART_HEADER)) {
            BinLoader.loadIntoFrame(headerFrame, ART_HEADER, ART_HEADER_W, ART_HEADER_H, 1, 1);
        }
        
        var artFrame = view.getZone("art");
        if (artFrame && file_exists(ART_SIDE)) {
            BinLoader.loadIntoFrame(artFrame, ART_SIDE, ART_SIDE_W, ART_SIDE_H, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Draw info panel based on selected menu item
     */
    function drawInfoPanel(view, itemValue) {
        var info = MENU_INFO[itemValue];
        if (!info) return;
        
        view.updateZone("art", function(frame) {
            // Clear just the info area (bottom portion)
            var infoStartY = 14;
            for (var y = infoStartY; y <= 20; y++) {
                frame.gotoxy(1, y);
                frame.putmsg("\1n" + repeatSpaces(40));
            }
            
            // Draw info box
            frame.gotoxy(2, infoStartY);
            frame.putmsg("\1h\1r" + info.title + "\1n");
            
            for (var i = 0; i < info.lines.length && (infoStartY + 1 + i) <= 19; i++) {
                frame.gotoxy(2, infoStartY + 1 + i);
                frame.putmsg("\1w" + info.lines[i] + "\1n");
            }
        });
    }
    
    /**
     * Draw status panel in content zone
     */
    function drawStatus(view, ctx) {
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.blank();
        view.line("The bass hits you as you walk in.");
        view.line("Smoke curls through neon light.");
        view.blank();
        view.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
        view.blank();
    }
    
    /**
     * Rest and recover
     */
    function rest(view, ctx) {
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        if (ctx.restUsedToday) {
            view.blank();
            view.warn("You've already rested today.");
            view.line("Come back tomorrow.");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        var restLine = REST_LINES[Math.floor(Math.random() * REST_LINES.length)];
        var turnsRecovered = 3;
        
        view.blank();
        view.info(restLine);
        view.blank();
        
        ctx.streetTurns = (ctx.streetTurns || 0) + turnsRecovered;
        ctx.restUsedToday = true;
        
        view.line("\1g+" + turnsRecovered + " Street Turns\1n");
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Listen for rumors
     */
    function listenRumors(view, ctx) {
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        var rumor = RUMORS[Math.floor(Math.random() * RUMORS.length)];
        
        view.blank();
        view.line("You lean in close to a conversation");
        view.line("at the bar...");
        view.blank();
        view.line("\1k\1h" + rumor + "\1n");
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Generate a random street team for betting
     */
    function generateBettingTeam(teamName) {
        var baseStats = 5 + Math.floor(Math.random() * 3);
        
        function randStat() {
            return Math.max(3, Math.min(9, baseStats + Math.floor(Math.random() * 3) - 1));
        }
        
        return {
            name: teamName,
            abbr: teamName.substring(0, 4).toUpperCase(),
            players: [
                {
                    name: teamName.split(" ")[0] + " #1",
                    speed: randStat(), threePt: randStat(), dunks: randStat(),
                    power: randStat(), defense: randStat(), blocks: randStat(),
                    skin: ["brown", "lightgray"][Math.floor(Math.random() * 2)],
                    jersey: Math.floor(Math.random() * 99),
                    isHuman: false
                },
                {
                    name: teamName.split(" ")[0] + " #2",
                    speed: randStat(), threePt: randStat(), dunks: randStat(),
                    power: randStat(), defense: randStat(), blocks: randStat(),
                    skin: ["brown", "lightgray"][Math.floor(Math.random() * 2)],
                    jersey: Math.floor(Math.random() * 99),
                    isHuman: false
                }
            ],
            colors: null
        };
    }
    
    /**
     * Simulate a game result
     */
    function simulateGame(team1, team2) {
        var score1 = 35 + Math.floor(Math.random() * 21);
        var score2 = 35 + Math.floor(Math.random() * 21);
        while (score1 === score2) {
            score2 = 35 + Math.floor(Math.random() * 21);
        }
        return { team1: team1, team2: team2, score1: score1, score2: score2 };
    }
    
    /**
     * Betting flow - uses the same view, updates content zone
     */
    function placeBet(view, ctx) {
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        if ((ctx.cash || 0) < 50) {
            view.blank();
            view.warn("Minimum bet is $50.");
            view.line("You need more cash.");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        // Generate matchup
        var team1Names = ["Courtline Crew", "Dunk District", "Arc Angels", "Street Kings"];
        var team2Names = ["Uptown Ballers", "South Side", "West End", "Downtown Heat"];
        var team1Name = team1Names[Math.floor(Math.random() * team1Names.length)];
        var team2Name = team2Names[Math.floor(Math.random() * team2Names.length)];
        
        view.blank();
        view.header("TONIGHT'S GAME");
        view.blank();
        view.line("  \1r" + team1Name + "\1n");
        view.line("       vs");
        view.line("  \1b" + team2Name + "\1n");
        view.blank();
        view.line("Your cash: \1y$" + ctx.cash + "\1n");
        view.blank();
        
        // Team selection submenu
        var teamItems = [
            { text: "Bet on " + team1Name, value: "1", hotkey: "1" },
            { text: "Bet on " + team2Name, value: "2", hotkey: "2" },
            { text: "Back Out", value: "quit", hotkey: "Q" }
        ];
        
        var teamChoice = view.menu(teamItems, {
            y: 12,
            onSelect: function(item) {
                // Could update art zone with team info here
            }
        });
        
        if (!teamChoice || teamChoice === "quit") return;
        
        var pickedTeam = (teamChoice === "1") ? team1Name : team2Name;
        
        // Get bet amount
        view.clearZone("content");
        view.setCursorY(0);
        view.blank();
        view.header("PLACE YOUR BET");
        view.blank();
        view.line("You're backing \1h" + pickedTeam + "\1n");
        view.blank();
        view.line("Your cash: \1y$" + ctx.cash + "\1n");
        view.line("Min bet: \1y$50\1n");
        view.blank();
        
        var betStr = view.prompt("Bet amount: $");
        var betAmount = parseInt(betStr, 10);
        
        if (isNaN(betAmount) || betAmount < 50 || betAmount > ctx.cash) {
            view.warn("Invalid bet amount.");
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        ctx.cash -= betAmount;
        
        view.blank();
        view.line("\1yYou put $" + betAmount + " on " + pickedTeam + ".\1n");
        view.blank();
        view.info("Press any key to watch...");
        view.render();
        console.getkey();
        
        // Run or simulate game
        var gameResult = null;
        var realEngineAvailable = (typeof runExternalGame === "function");
        
        if (realEngineAvailable) {
            var team1 = generateBettingTeam(team1Name);
            var team2 = generateBettingTeam(team2Name);
            team1.colors = { fg: "WHITE", bg: "BG_RED" };
            team2.colors = { fg: "WHITE", bg: "BG_BLUE" };
            
            var config = {
                teamA: team1, teamB: team2,
                options: { gameTime: 60, mode: "spectate", showMatchupScreen: true, showGameOverScreen: false },
                lorbContext: { betting: true, betAmount: betAmount, pickedTeam: pickedTeam }
            };
            
            view.close();
            var result = runExternalGame(config);
            
            // Re-create view after game
            view = createView();
            loadArt(view);
            
            if (result && result.completed) {
                gameResult = { team1: team1Name, team2: team2Name, score1: result.score.teamA, score2: result.score.teamB };
            } else {
                gameResult = simulateGame(team1Name, team2Name);
            }
        } else {
            gameResult = simulateGame(team1Name, team2Name);
        }
        
        // Show result
        view.clearZone("content");
        view.setCursorY(0);
        view.blank();
        view.header("GAME OVER");
        view.blank();
        view.line("\1r" + team1Name + "\1n: " + gameResult.score1);
        view.line("\1b" + team2Name + "\1n: " + gameResult.score2);
        view.blank();
        
        var winner = (gameResult.score1 > gameResult.score2) ? team1Name : team2Name;
        
        if (winner === pickedTeam) {
            var winnings = betAmount * 2;
            ctx.cash += winnings;
            view.line("\1h\1g" + pickedTeam + " WINS!\1n");
            view.blank();
            view.line("You collect \1y$" + winnings + "\1n!");
        } else {
            view.line("\1h\1r" + winner + " wins.\1n");
            view.blank();
            view.line("Your $" + betAmount + " bet is gone.");
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Create the Club 23 RichView
     */
    function createView() {
        return new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: "lorb"
        });
    }
    
    /**
     * Run with RichView
     */
    function runRichView(ctx) {
        var view = createView();
        loadArt(view);
        
        while (true) {
            // Draw status
            view.clearZone("content");
            drawStatus(view, ctx);
            
            // Build menu
            var menuItems = [
                { text: "Rest & Recover", value: "rest", hotkey: "1", disabled: ctx.restUsedToday },
                { text: "Listen for Rumors", value: "rumors", hotkey: "2" },
                { text: "Bet on a Game", value: "bet", hotkey: "3", disabled: (ctx.cash || 0) < 50 },
                { text: "Leave", value: "leave", hotkey: "Q" }
            ];
            
            var choice = view.menu(menuItems, {
                y: 8,
                onSelect: function(item, index, richView) {
                    // Update info panel when hovering
                    drawInfoPanel(richView, item.value);
                    richView.render();
                }
            });
            
            switch (choice) {
                case "rest":
                    rest(view, ctx);
                    break;
                case "rumors":
                    listenRumors(view, ctx);
                    break;
                case "bet":
                    placeBet(view, ctx);
                    // Reload art after betting (in case we closed/recreated view)
                    loadArt(view);
                    break;
                case "leave":
                case null:
                    view.close();
                    return;
            }
        }
    }
    
    /**
     * Legacy fallback (no RichView)
     */
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("CLUB 23");
            LORB.View.line("");
            LORB.View.line("The bass hits you as you walk in.");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
            
            var restText = ctx.restUsedToday ? 
                "\1k[1] Rest (already rested)\1n" :
                "\1w[1]\1n Rest & Recover";
            
            LORB.View.line(restText);
            LORB.View.line("\1w[2]\1n Listen for Rumors");
            LORB.View.line("\1w[3]\1n Bet on a Game");
            LORB.View.line("\1w[Q]\1n Leave");
            LORB.View.line("");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            switch (choice) {
                case "1":
                    if (!ctx.restUsedToday) {
                        var restLine = REST_LINES[Math.floor(Math.random() * REST_LINES.length)];
                        ctx.streetTurns = (ctx.streetTurns || 0) + 3;
                        ctx.restUsedToday = true;
                        LORB.View.line("\1c" + restLine + "\1n");
                        LORB.View.line("\1g+3 Street Turns\1n");
                    } else {
                        LORB.View.warn("Already rested today.");
                    }
                    console.getkey();
                    break;
                case "2":
                    var rumor = RUMORS[Math.floor(Math.random() * RUMORS.length)];
                    LORB.View.line("\1k\1h" + rumor + "\1n");
                    console.getkey();
                    break;
                case "3":
                    // Simplified betting for legacy
                    LORB.View.warn("Betting requires RichView.");
                    console.getkey();
                    break;
                case "Q":
                    return;
            }
        }
    }
    
    /**
     * Main entry point
     */
    function run(ctx) {
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * Helper: repeat spaces
     */
    function repeatSpaces(n) {
        var s = "";
        for (var i = 0; i < n; i++) s += " ";
        return s;
    }
    
    // Export
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Club23 = {
        run: run,
        RUMORS: RUMORS
    };
    
})();
