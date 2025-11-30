# LORB Persistence System

The persistence system saves and loads player character data to JSON files.

---

## File Location

```
data/lorb/characters/{odtuid}.json
```

Each character is stored as a separate JSON file, keyed by the player's unique ID (`odtuid` - typically derived from their BBS user ID).

---

## API

### LORB.Persistence.save(ctx)

Saves the current context to disk.

```javascript
LORB.Persistence.save(ctx);
```

**When to call:**
- After completing a game
- After purchasing items
- After training stats
- Before exiting LORB

### LORB.Persistence.load(odtuid)

Loads a character by ID. Returns `null` if not found.

```javascript
var ctx = LORB.Persistence.load(user.number.toString());
if (!ctx) {
    // New player - run character creation
    ctx = LORB.Character.create();
}
```

### LORB.Persistence.exists(odtuid)

Checks if a save file exists without loading it.

```javascript
if (LORB.Persistence.exists(userId)) {
    // Continue game
} else {
    // New game
}
```

### LORB.Persistence.delete(odtuid)

Deletes a character save file.

```javascript
LORB.Persistence.delete(userId);  // Start fresh
```

---

## Data Format

The save file is a JSON serialization of the context object:

```json
{
    "name": "RimBreaker",
    "odtuid": "42",
    "level": 3,
    "xp": 450,
    "rep": 75,
    "cash": 1250,
    "archetype": "SLASHER",
    "stats": {
        "speed": 7,
        "3point": 4,
        "dunk": 8,
        "power": 6,
        "steal": 5,
        "block": 4
    },
    "appearance": {
        "skin": "brown",
        "jerseyColor": "RED",
        "jerseyNumber": "23",
        "eyeColor": "BROWN"
    },
    "streetTurns": 3,
    "attributePoints": 2,
    "inventory": {
        "sneakers": [
            { "id": "air_basics", "name": "Air Basics", "speedBonus": 1 }
        ],
        "drinks": []
    },
    "equipped": {
        "sneakers": "air_basics"
    },
    "wins": 12,
    "losses": 5,
    "gamesPlayed": 17,
    "lastPlayed": "2025-11-29T15:30:00.000Z",
    "created": "2025-11-20T10:00:00.000Z"
}
```

---

## Implementation Details

### Directory Creation

The persistence system auto-creates the directory structure if it doesn't exist:

```javascript
var dir = js.exec_dir + "data/lorb/characters/";
if (!file_isdir(dir)) {
    mkdir(dir);
}
```

### Error Handling

Save/load operations are wrapped in try-catch to prevent crashes:

```javascript
try {
    var f = new File(filepath);
    f.open("w");
    f.write(JSON.stringify(ctx, null, 2));
    f.close();
} catch (e) {
    log(LOG_ERR, "[LORB] Failed to save: " + e);
}
```

### Migration

When adding new fields to the context, the load function should provide defaults:

```javascript
function load(odtuid) {
    var ctx = JSON.parse(fileContents);
    
    // Migration: add new fields if missing
    if (!ctx.inventory) ctx.inventory = { sneakers: [], drinks: [] };
    if (!ctx.equipped) ctx.equipped = { sneakers: null };
    if (ctx.streetTurns === undefined) ctx.streetTurns = 5;
    
    return ctx;
}
```

---

## Day Reset

Street turns reset daily. The persistence system tracks `lastPlayed` to detect day changes:

```javascript
function checkDayReset(ctx) {
    var now = new Date();
    var last = ctx.lastPlayed ? new Date(ctx.lastPlayed) : null;
    
    if (!last || now.toDateString() !== last.toDateString()) {
        // New day - reset turns
        ctx.streetTurns = 5;
        ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };
    }
    
    ctx.lastPlayed = now.toISOString();
}
```

---

## Backup Strategy

**Not currently implemented.** Consider adding:
- Automatic backup before overwrite
- Multiple save slots
- Export/import functionality
