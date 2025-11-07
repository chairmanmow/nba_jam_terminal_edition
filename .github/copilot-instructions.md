# GitHub Copilot Instructions - NBA JAM Terminal Edition

> **Project Context**: NBA JAM arcade-style basketball game for Synchronet BBS, implemented in JavaScript. Post-refactoring: 1,311 lines main file (down from 2,610), 34+ library modules, multiplayer support via JSON-DB.

---

## 🎯 Core Development Principles

### Architecture Philosophy
**DO**: Build modular, focused components with clear responsibilities  
**DON'T**: Create monolithic files or God objects

**DO**: Follow established patterns (State Machine, Observer, Coordinator)  
**DON'T**: Introduce new patterns without documenting rationale

**DO**: Separate concerns (game logic, rendering, UI, networking, AI)  
**DON'T**: Mix concerns within a single module

---

## 📁 File Organization Rules

### When Creating New Files

**Size Limits**:
- Individual modules: 50-200 lines (sweet spot)
- Maximum module size: 300 lines (refactor beyond this)
- Main orchestration files: 800-1,500 lines max

**Naming Conventions**:
```
lib/
├── game-logic/          # Core game mechanics
│   ├── ball-*.js        # Ball-related logic
│   ├── player-*.js      # Player actions
│   ├── scoring-*.js     # Scoring/stats
│   └── violations-*.js  # Rules enforcement
├── ai/                  # AI decision making
│   ├── ai-*.js          # Specific AI behaviors
│   └── evaluation-*.js  # AI evaluation functions
├── multiplayer/         # Networking
│   ├── coordinator-*.js # Network orchestration
│   ├── client-*.js      # Client-side logic
│   └── sync-*.js        # State synchronization
├── rendering/           # Visual display
│   ├── render-*.js      # Rendering logic
│   └── animation-*.js   # Animation systems
├── ui/                  # User interface
│   ├── menu-*.js        # Menu systems
│   └── hud-*.js         # In-game UI
└── utils/               # Shared utilities
    ├── math-*.js        # Math helpers
    └── sprite-*.js      # Sprite utilities
```

**File Naming Pattern**: `[category]-[specific-function].js`
- Good: `ball-physics.js`, `ai-defensive.js`, `menu-team-select.js`
- Bad: `helpers.js`, `utils.js`, `misc.js`, `stuff.js`

### Module Responsibilities

**Each module should**:
1. Have ONE clear purpose (Single Responsibility Principle)
2. Export 1-5 related functions (not 20+)
3. Import only what it needs
4. Be independently testable
5. Have a clear name that describes its purpose

**Red Flags**:
- Module does multiple unrelated things
- Module name is vague (`helpers.js`, `misc.js`)
- Module has 10+ exports
- Module imports from 10+ other modules (high coupling)

---

## 🏗️ Architecture Patterns to Follow

### 1. State Machine Pattern (Game States)
**Use for**: Game flow, player states, ball states

```javascript
// ✅ GOOD: Clear state transitions
var gameState = {
    currentState: "menu",  // menu, playing, paused, gameOver
    transitionTo: function(newState) {
        this.previousState = this.currentState;
        this.currentState = newState;
        this.onStateEnter(newState);
    }
};

// ❌ BAD: Hidden state in boolean soup
var isPlaying = true;
var isPaused = false;
var isGameOver = false;
var isInMenu = false;
```

### 2. Observer Pattern (Events)
**Use for**: Game events, state changes, announcements

```javascript
// ✅ GOOD: Event-driven communication
function announceEvent(eventType, data) {
    eventBus.publish(eventType, data);
}

eventBus.subscribe("score", function(data) {
    updateScoreboard(data);
    playScoreAnimation(data);
});

// ❌ BAD: Direct coupling
function scoreBasket(player, points) {
    updateScoreboard(player, points);
    playScoreAnimation(player, points);
    updateStats(player, points);
    checkForFireMode(player);
    // ... 10 more things
}
```

### 3. Coordinator Pattern (Multiplayer)
**Use for**: Multiplayer orchestration, network state sync

```javascript
// ✅ GOOD: Single coordinator manages complexity
multiplayerCoordinator.syncState();
multiplayerCoordinator.handleInput(playerId, input);
multiplayerCoordinator.broadcastEvent(event);

// ❌ BAD: Direct peer-to-peer chaos
client.write("player1.input", input);
client.write("player2.input", input);
client.write("game.state", state);
// ... scattered writes everywhere
```

### 4. Strategy Pattern (AI Behaviors)
**Use for**: Different AI behaviors, difficulty levels

```javascript
// ✅ GOOD: Pluggable strategies
var aiStrategies = {
    easy: new EasyAI(),
    medium: new MediumAI(),
    hard: new HardAI()
};

var currentAI = aiStrategies[difficulty];
currentAI.makeDecision(sprite);

// ❌ BAD: Giant if/else chain
if (difficulty === "easy") {
    // 100 lines
} else if (difficulty === "medium") {
    // 100 lines
} else if (difficulty === "hard") {
    // 100 lines
}
```

---

## 🚫 Anti-Patterns to Avoid

### 1. God Object
**Problem**: One object/module knows/does everything

```javascript
// ❌ BAD: gameState knows everything
gameState.scores = {};
gameState.sprites = [];
gameState.ai = {};
gameState.multiplayer = {};
gameState.rendering = {};
gameState.physics = {};
gameState.menu = {};
// ... 50+ properties

// ✅ GOOD: Separate concerns
var gameState = { currentState: "playing", frameNumber: 0 };
var scoreTracker = { teamA: 0, teamB: 0 };
var spriteManager = { sprites: [] };
var multiplayerSession = { players: {} };
```

### 2. Duplicate Code
**Problem**: Same logic in multiple places

```javascript
// ❌ BAD: Duplicated collision checks
function checkPlayerCollision() {
    if (Math.abs(p1.x - p2.x) < 2 && Math.abs(p1.y - p2.y) < 2) { ... }
}
function checkBallCollision() {
    if (Math.abs(ball.x - p.x) < 2 && Math.abs(ball.y - p.y) < 2) { ... }
}

// ✅ GOOD: Shared utility
function checkCollision(sprite1, sprite2, threshold) {
    return Math.abs(sprite1.x - sprite2.x) < threshold &&
           Math.abs(sprite1.y - sprite2.y) < threshold;
}
```

### 3. Feature Envy
**Problem**: Module reaches into other modules' data

```javascript
// ❌ BAD: AI reaching into rendering
function aiDecision(sprite) {
    if (courtRenderer.sprites[0].fireMode) {  // Envy!
        // ...
    }
}

// ✅ GOOD: Use proper interface
function aiDecision(sprite) {
    if (sprite.hasFireMode()) {
        // ...
    }
}
```

### 4. Primitive Obsession
**Problem**: Using primitives instead of domain objects

```javascript
// ❌ BAD: Passing primitives everywhere
function movePlayer(x, y, dx, dy, speed, team) { ... }

// ✅ GOOD: Use domain objects
function movePlayer(player, direction) {
    player.x += direction.dx * player.speed;
    player.y += direction.dy * player.speed;
}
```

---

## 🐛 Bug Prevention Guidelines

### Known Bug Categories (from potential_bugs_identified.md)

**Critical Bugs** (Fix immediately):
1. **Multiplayer coordinator disconnect crash**
   - Always check if coordinator exists before access
   - Implement graceful degradation
   
2. **Undefined function calls**
   - Verify function exists before calling
   - Add runtime checks in critical paths

**High Priority Bugs** (Fix next):
3. **Diagonal movement speed bug**
   - Normalize vectors: `Math.sqrt(dx*dx + dy*dy)`
   - Apply speed after normalization

4. **AI stuck in corners**
   - Add bounds detection in AI movement
   - Implement unstuck logic

5. **Multiplayer rubber-banding**
   - Reduce state sync frequency (20 Hz max)
   - Implement client-side prediction

### Bug Prevention Patterns

**Always validate inputs**:
```javascript
// ✅ GOOD
function passBall(passer, receiver) {
    if (!passer || !receiver) {
        log("ERROR: Invalid sprites for pass");
        return false;
    }
    if (!passer.hasBall) {
        log("WARN: Passer doesn't have ball");
        return false;
    }
    // ... proceed with pass
}

// ❌ BAD
function passBall(passer, receiver) {
    receiver.hasBall = true;  // Crash if receiver is undefined!
}
```

**Defensive multiplayer coding**:
```javascript
// ✅ GOOD
function syncMultiplayerState() {
    if (!multiplayerCoordinator) {
        return;  // Graceful degradation
    }
    if (!multiplayerCoordinator.isConnected()) {
        log("WARN: Coordinator disconnected, attempting reconnect");
        attemptReconnect();
        return;
    }
    // ... proceed with sync
}

// ❌ BAD
function syncMultiplayerState() {
    multiplayerCoordinator.syncState();  // Crash if undefined!
}
```

**Bounds checking**:
```javascript
// ✅ GOOD
function moveSprite(sprite, dx, dy) {
    var newX = sprite.x + dx;
    var newY = sprite.y + dy;
    
    // Clamp to court bounds
    sprite.x = Math.max(0, Math.min(COURT_WIDTH, newX));
    sprite.y = Math.max(0, Math.min(COURT_HEIGHT, newY));
}

// ❌ BAD
function moveSprite(sprite, dx, dy) {
    sprite.x += dx;  // Can go off-screen!
    sprite.y += dy;
}
```

---

## ❓ Proactive Question Resolution

### From questions_to_answer.md

**Before implementing features, decide**:

1. **Architecture Questions** (Must decide):
   - Q1: Should we implement coordinator failover/reconnection?
     - **Decision**: YES - prevents critical multiplayer crashes
   - Q2: Fix diagonal movement now or wait?
     - **Decision**: FIX NOW - affects gameplay balance
   - Q3: Implement unit tests?
     - **Decision**: YES - prevents regressions

2. **Implementation Questions** (Answer first):
   - Q21: Should we normalize diagonal movement?
     - **Answer**: YES - use vector normalization
   - Q22: Extract more helper functions?
     - **Answer**: YES if >3 lines repeated >2 times
   - Q23: Create more Data Transfer Objects?
     - **Answer**: YES for network sync, NO for local state

**Decision Framework**:
- **Gameplay-affecting**: Decide and implement now
- **Architecture-affecting**: Document decision, plan refactor
- **Nice-to-have**: Defer until after tech debt cleared

---

## 🔧 Refactoring Guidelines

### When to Refactor

**Refactor immediately if**:
- Function >100 lines (extract sub-functions)
- Module >300 lines (split into focused modules)
- Duplicated code appears 3+ times (extract to utility)
- Cyclomatic complexity >10 (simplify logic)
- Function has >5 parameters (use object parameter)

**Refactor soon if**:
- Architecture mismatch identified (see architecture_mismatches.md)
- Function in wrong module (see misplaced_functions.md)
- Performance bottleneck measured (profile first!)

**Defer refactoring if**:
- Code works and is well-tested
- Change would be purely cosmetic
- No bugs or performance issues
- Tech debt is low priority

### Refactoring Process

1. **Identify problem** (use design docs)
2. **Write test** (if none exists)
3. **Refactor incrementally** (small changes)
4. **Verify test passes** (no regressions)
5. **Update documentation** (keep docs current)

**Example: Extracting a module**
```javascript
// Step 1: Identify duplicate code (in nba_jam.js, multiplayer-coordinator.js)
function calculateShotQuality(shooter, defender) { ... }  // Appears 2x

// Step 2: Create new module
// lib/game-logic/shot-evaluation.js
function calculateShotQuality(shooter, defender) {
    // ... extracted logic
}

// Step 3: Replace duplicates with import
load(js.exec_dir + "lib/game-logic/shot-evaluation.js");
var quality = calculateShotQuality(shooter, defender);

// Step 4: Test both single-player and multiplayer
// Step 5: Update file_layout.md
```

---

## 📈 Performance Optimization

### Target Metrics
- Frame rate: 20 FPS (50ms per frame)
- Input latency: <50ms single-player, <150ms multiplayer
- Network sync: 20 Hz (50ms interval)
- State sync size: <5 KB per update

### Optimization Priorities

**High Impact** (Do first):
1. Reduce network sync frequency (currently every frame → 20 Hz)
2. Optimize collision detection (spatial partitioning)
3. Cache repeated calculations (shot quality, distances)
4. Debounce UI updates (scoreboard, timer)

**Medium Impact**:
5. Use object pooling for temporary objects
6. Minimize string concatenation in hot paths
7. Batch rendering updates

**Low Impact** (Micro-optimizations):
8. Use bitwise operations
9. Avoid array methods in hot loops
10. Pre-allocate arrays

### Performance Pattern

```javascript
// ✅ GOOD: Cache expensive calculations
var shotQuality = null;
var lastShotQualityFrame = -1;

function getShotQuality(shooter, defender) {
    if (gameState.frameNumber !== lastShotQualityFrame) {
        shotQuality = calculateShotQuality(shooter, defender);
        lastShotQualityFrame = gameState.frameNumber;
    }
    return shotQuality;
}

// ❌ BAD: Recalculate every frame
function updateAI() {
    for (var i = 0; i < 20; i++) {  // 20 times per frame!
        var quality = calculateShotQuality(shooter, defender);
    }
}
```

---

## 🎯 Feature Implementation Guidelines

### From missing_implementations.md

**High Priority Features** (Implement next):
1. AI difficulty selection (user experience)
2. Pause menu (user experience)
3. Settings menu (configurability)

**Medium Priority Features** (Plan for):
4. Overtime system (gameplay completion)
5. Chat system (multiplayer UX)
6. Reconnection support (reliability)
7. Leaderboards (engagement)

**Low Priority Features** (Defer):
8. Alley-oop system
9. Replay system
10. Achievements

### Feature Implementation Process

1. **Check for existing patterns**
   - Review architecture_patterns.md
   - Find similar existing features
   - Reuse patterns, don't invent new ones

2. **Plan module structure**
   - Where does this belong? (game-logic, ui, multiplayer, etc.)
   - What modules need to be created?
   - What interfaces are needed?

3. **Implement incrementally**
   - Start with simplest version
   - Test in isolation
   - Integrate with main game
   - Test in all modes (single, multiplayer, AI)

4. **Document as you go**
   - Update file_layout.md
   - Note any new patterns
   - Document configuration options

**Example: Adding AI Difficulty**

```javascript
// 1. Create new module
// lib/ai/ai-difficulty.js
var difficultySettings = {
    easy: { reactionTime: 10, shotAccuracy: 0.7 },
    medium: { reactionTime: 5, shotAccuracy: 1.0 },
    hard: { reactionTime: 2, shotAccuracy: 1.2 }
};

function setDifficulty(level) {
    currentDifficulty = difficultySettings[level];
}

function getDifficulty() {
    return currentDifficulty;
}

// 2. Integrate into AI decision making
// lib/ai/ai-offensive.js
var difficulty = getDifficulty();
mswait(difficulty.reactionTime * 50);  // Reaction delay

// 3. Add UI for selection
// lib/ui/menu-difficulty.js
function showDifficultyMenu() {
    console.print("Select Difficulty:\n");
    console.print("1. Easy\n");
    console.print("2. Medium\n");
    console.print("3. Hard\n");
    // ...
}

// 4. Test all three difficulty levels
// 5. Update design_docs/file_layout.md
```

---

## 💰 Tech Debt Management

### From architecture_mismatches.md

**Current Tech Debt**: 35-50 hours estimated

**High Priority Debt** (Fix in Waves 7-9):
1. **Global vs Local State** (15-20 hours)
   - Consolidate sprite state management
   - Eliminate global sprite arrays
   - Use sprite manager pattern

2. **Multiplayer State Sync** (10-15 hours)
   - Implement delta compression
   - Add client-side prediction
   - Reduce sync frequency

3. **AI Module Coupling** (5-8 hours)
   - Move AI logic out of main game loop
   - Create AI coordinator
   - Use message passing instead of direct access

**Medium Priority Debt** (Fix in Waves 10-12):
4. **Duplicate Functions** (3-5 hours)
   - Extract to shared utilities
   - Consolidate implementations

5. **Mixed UI/Logic** (5-7 hours)
   - Separate rendering from game logic
   - Move UI code to ui/ modules

### Debt Prevention Rules

**Before adding code, ask**:
1. Does this duplicate existing functionality?
2. Is this in the right module?
3. Does this create coupling?
4. Is this a hack or proper solution?
5. Will this make future changes harder?

**If answer is "yes" to 3+**: Refactor first, then add feature

**Technical Debt Limit**: 
- Each wave should reduce debt by 5-10 hours
- Never increase total debt by >2 hours per wave
- Track debt in architecture_mismatches.md

---

## 🧪 Testing Guidelines

### Test Before Committing

**For each change, test**:
1. Single-player human vs AI
2. Single-player human vs human (local)
3. Multiplayer (2+ nodes)
4. CPU demo mode

**For bug fixes, test**:
1. Original bug scenario (verify fix)
2. Related functionality (no regressions)
3. Edge cases (boundary conditions)

### Critical Test Scenarios

**Multiplayer**:
- Player disconnects mid-game
- Coordinator node crashes
- Network lag >500ms
- Rapid state changes (fast gameplay)

**Gameplay**:
- Ball goes out of bounds
- Shot clock expires
- Game time expires (tied score)
- Fire mode activation
- Violations (goaltending, backcourt, etc.)

**AI**:
- AI stuck in corner
- AI passes out of bounds
- AI doesn't shoot when open
- AI defensive positioning

---

## 📝 Code Review Checklist

### Before Committing Code

**File Organization**:
- [ ] Files are in correct directory
- [ ] Modules are <300 lines
- [ ] No duplicate code
- [ ] Clear, descriptive names

**Code Quality**:
- [ ] Functions are <100 lines
- [ ] No hardcoded magic numbers
- [ ] Proper error handling
- [ ] Input validation

**Architecture**:
- [ ] Follows established patterns
- [ ] Doesn't introduce new patterns unnecessarily
- [ ] Proper separation of concerns
- [ ] Low coupling, high cohesion

**Performance**:
- [ ] No obvious performance issues
- [ ] Efficient algorithms used
- [ ] Caching where appropriate
- [ ] No unnecessary recalculations

**Testing**:
- [ ] Tested in all game modes
- [ ] No regressions introduced
- [ ] Edge cases handled

**Documentation**:
- [ ] Updated file_layout.md if structure changed
- [ ] Noted any architectural decisions
- [ ] Commented complex logic

---

## 🚀 Development Workflow

### Starting New Work

1. **Review design docs**
   - Check potential_bugs_identified.md for known issues
   - Check architecture_mismatches.md for tech debt
   - Check missing_implementations.md for feature status

2. **Plan the change**
   - What pattern applies?
   - What modules are affected?
   - What tests are needed?

3. **Implement incrementally**
   - Small, focused changes
   - Test frequently
   - Commit often

4. **Review and refine**
   - Run all test scenarios
   - Check for regressions
   - Update documentation

### Wave Planning

**Each wave should**:
- Have clear goal (bug fix, feature, refactor)
- Take 5-15 hours
- Reduce tech debt (not increase)
- Improve architecture
- Be fully tested

**Wave Structure**:
- Waves 7-9: High priority bugs + tech debt
- Waves 10-12: Medium priority features + tech debt
- Waves 13+: Polish + low priority features

---

## 📚 Key Reference Documents

Always consult before making changes:

1. **file_layout.md** - Complete module structure
2. **architecture_patterns.md** - Patterns to follow
3. **architecture_mismatches.md** - Tech debt to fix
4. **misplaced_functions.md** - Functions to relocate
5. **potential_bugs_identified.md** - Known bugs to avoid/fix
6. **questions_to_answer.md** - Decisions needed
7. **missing_implementations.md** - Features to add

---

## ✅ Quick Decision Tree

**When adding new code**:
```
Is it >50 lines?
├─ YES → Create new module
└─ NO → Add to existing module

Does it duplicate existing code?
├─ YES → Extract to shared utility
└─ NO → Proceed

Does it fit established patterns?
├─ YES → Follow pattern
└─ NO → Document why new approach needed

Is it performance-critical?
├─ YES → Profile and optimize
└─ NO → Prioritize readability

Does it affect multiplayer?
├─ YES → Test with 2+ nodes
└─ NO → Test single-player
```

**When fixing bugs**:
```
Is it in potential_bugs_identified.md?
├─ YES → Follow documented fix plan
└─ NO → Add to doc, then fix

Is it a symptom of tech debt?
├─ YES → Consider refactoring root cause
└─ NO → Apply targeted fix

Does fix affect multiple modes?
├─ YES → Test all modes (single/multi/AI)
└─ NO → Test affected mode
```

**When refactoring**:
```
Is it reducing tech debt?
├─ YES → Proceed with refactor
└─ NO → Reconsider necessity

Does it improve architecture?
├─ YES → Update architecture docs
└─ NO → Is it just cosmetic? Defer.

Does it break existing tests?
├─ YES → Fix tests OR reconsider refactor
└─ NO → Proceed
```

---

## 🎓 Golden Rules

1. **Modularity Over Monoliths** - Many small focused modules beat one giant file
2. **Patterns Over Cleverness** - Follow established patterns, not clever hacks
3. **Clarity Over Brevity** - Readable code beats terse code
4. **Testing Over Hoping** - Test all modes before committing
5. **Refactor Over Bandaid** - Fix root causes, not symptoms
6. **Documentation Over Memory** - Write it down, don't rely on memory
7. **Prevention Over Cleanup** - Avoid tech debt rather than accumulate it
8. **Architecture Over Features** - Good structure enables fast feature development

---

## 📞 When Stuck

1. **Check design docs** - Answer is probably documented
2. **Follow existing patterns** - Don't reinvent the wheel
3. **Start small** - Simplest solution that works
4. **Test incrementally** - Small changes, frequent testing
5. **Ask questions** - Document unknowns in questions_to_answer.md
6. **Refactor boldly** - Improve structure proactively

---

**Last Updated**: Wave 6 (Documentation Phase)  
**Project Status**: 1,311 lines main file, 34+ modules, 47% size reduction  
**Tech Debt**: 35-50 hours identified, roadmap planned  
**Known Bugs**: 26 identified, prioritized  
**Next Wave**: Bug fixes + high priority features
