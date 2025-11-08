/**
 * NBA JAM - System Initialization Module
 * Wave 23: Centralized system creation and wiring
 * 
 * Responsibilities:
 * - Create all game systems with proper dependency injection
 * - Wire up cross-system dependencies
 * - Set up event subscriptions
 * - Return initialized systems for use by game logic
 * 
 * Benefits:
 * - Keeps main() clean and focused on game flow
 * - Centralizes all system configuration
 * - Makes dependency graph visible in one place
 * - Easy to add/remove systems without touching main()
 */

/**
 * Initialize all game systems with dependency injection
 * 
 * @param {Object} deps - Required dependencies from main context
 * @param {Object} deps.gameState - The global game state object
 * @param {Object} deps.animationSystem - The animation system
 * @param {Object} deps.players - Player sprite references { teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2 }
 * @param {Object} deps.helpers - Helper functions (getPlayerTeamName, getAllPlayers, etc.)
 * @param {Object} deps.constants - Game constants (COURT_WIDTH, COURT_HEIGHT, etc.)
 * @returns {Object} Initialized systems { stateManager, eventBus, passingSystem, possessionSystem }
 */
function initializeSystems(deps) {
    // Validate required dependencies
    if (!deps || !deps.gameState || !deps.animationSystem || !deps.players || !deps.helpers || !deps.constants) {
        throw new Error("initializeSystems requires gameState, animationSystem, players, helpers, and constants");
    }

    var gameState = deps.gameState;
    var animationSystem = deps.animationSystem;
    var players = deps.players;
    var helpers = deps.helpers;
    var constants = deps.constants;

    // Create state manager (wraps gameState by reference)
    var stateManager = createStateManager(gameState);

    // Create event bus for decoupled system communication
    var eventBus = createEventBus();

    // Create passing system
    var passingSystem = createPassingSystem({
        state: stateManager,
        animations: animationSystem,
        events: eventBus,
        rules: {
            COURT_WIDTH: constants.COURT_WIDTH,
            COURT_HEIGHT: constants.COURT_HEIGHT
        },
        helpers: {
            getPlayerTeamName: helpers.getPlayerTeamName,
            recordTurnover: helpers.recordTurnover,
            triggerPossessionBeep: helpers.triggerPossessionBeep,
            resetBackcourtState: helpers.resetBackcourtState,
            setPotentialAssist: helpers.setPotentialAssist,
            clearPotentialAssist: helpers.clearPotentialAssist,
            enableScoreFlashRegainCheck: helpers.enableScoreFlashRegainCheck,
            primeInboundOffense: helpers.primeInboundOffense,
            assignDefensiveMatchups: helpers.assignDefensiveMatchups,
            announceEvent: helpers.announceEvent
        }
    });

    // Create possession system
    var possessionSystem = createPossessionSystem({
        state: stateManager,
        events: eventBus,
        rules: {
            COURT_WIDTH: constants.COURT_WIDTH,
            COURT_HEIGHT: constants.COURT_HEIGHT
        },
        helpers: {
            getPlayerTeamName: helpers.getPlayerTeamName,
            getAllPlayers: helpers.getAllPlayers,
            getTeamPlayers: function (team) {
                if (team === "teamA") return [players.teamAPlayer1, players.teamAPlayer2];
                if (team === "teamB") return [players.teamBPlayer1, players.teamBPlayer2];
                return [];
            }
        }
    });

    // TODO: Create shooting system
    // var shootingSystem = createShootingSystem({ state, events, animations, rules, helpers });

    // Set up event subscriptions (cross-system communication)
    _setupEventSubscriptions(eventBus, helpers);

    // Return all systems
    return {
        stateManager: stateManager,
        eventBus: eventBus,
        passingSystem: passingSystem,
        possessionSystem: possessionSystem
        // shootingSystem: shootingSystem
    };
}

/**
 * Set up event subscriptions for cross-system communication
 * @private
 */
function _setupEventSubscriptions(eventBus, helpers) {
    // Example: Announce pass completions
    // eventBus.on('pass_complete', function(data) {
    //     if (helpers.announceEvent) {
    //         helpers.announceEvent('pass', data);
    //     }
    // });

    // Example: Update stats on possession change
    // eventBus.on('possession_change', function(data) {
    //     // Update possession stats
    // });

    // TODO: Wire up announcer, stats tracking, UI updates, etc.
}

/**
 * Expose systems to legacy code (temporary during migration)
 * Once all code is migrated to dependency injection, remove this
 * 
 * @param {Object} systems - The initialized systems
 */
function exposeSystemsGlobally(systems) {
    if (typeof globalThis !== 'undefined') {
        globalThis.stateManager = systems.stateManager;
        globalThis.eventBus = systems.eventBus;
        globalThis.passingSystem = systems.passingSystem;
        globalThis.possessionSystem = systems.possessionSystem;
        // globalThis.shootingSystem = systems.shootingSystem;
    } else {
        // Fallback for older JavaScript engines
        this.stateManager = systems.stateManager;
        this.eventBus = systems.eventBus;
        this.passingSystem = systems.passingSystem;
        this.possessionSystem = systems.possessionSystem;
        // this.shootingSystem = systems.shootingSystem;
    }
}
