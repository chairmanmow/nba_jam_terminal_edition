/**
 * cities.js - NBA City Data and Rotation System
 * 
 * Loads city definitions from cities.json and provides helpers for:
 * - Getting the current city based on shared gameDay
 * - City-specific buffs, club names, and art paths
 * - City rotation (30 cities cycling every 30 days)
 */
(function () {
    
    var CITIES_DATA = null;
    var CITIES_JSON_PATH = js.exec_dir + "lib/lorb/design_docs/season_concept/cities.json";
    var CITY_ART_DIR = "/sbbs/xtrn/nba_jam/assets/lorb/cities/";
    
    // Fallback art paths
    var DEFAULT_BANNER = CITY_ART_DIR + "default_banner.bin";
    var DEFAULT_DETAIL = CITY_ART_DIR + "default_detail.bin";
    
    /**
     * Load cities from JSON file
     */
    function loadCities() {
        if (CITIES_DATA) return CITIES_DATA;
        
        try {
            var f = new File(CITIES_JSON_PATH);
            if (!f.open("r")) {
                log(LOG_ERR, "[LORB:CITIES] Failed to open cities.json: " + CITIES_JSON_PATH);
                return [];
            }
            
            var content = f.read();
            f.close();
            
            CITIES_DATA = JSON.parse(content);
            
            // Sort by order to ensure consistent rotation
            CITIES_DATA.sort(function(a, b) {
                return (a.order || 0) - (b.order || 0);
            });
            
            log(LOG_DEBUG, "[LORB:CITIES] Loaded " + CITIES_DATA.length + " cities");
            return CITIES_DATA;
        } catch (e) {
            log(LOG_ERR, "[LORB:CITIES] Error loading cities.json: " + e);
            return [];
        }
    }
    
    /**
     * Get all cities
     */
    function getAll() {
        return loadCities();
    }
    
    /**
     * Get city by ID (e.g., "chi", "lal")
     */
    function getById(cityId) {
        var cities = loadCities();
        for (var i = 0; i < cities.length; i++) {
            if (cities[i].id === cityId) {
                return cities[i];
            }
        }
        return null;
    }
    
    /**
     * Get the current city for a given game day.
     * Cities rotate: day 1 = city[0], day 2 = city[1], ..., day 31 = city[0]
     */
    function getCurrent(gameDay) {
        var cities = loadCities();
        if (!cities || cities.length === 0) {
            // Return a fallback city
            return {
                id: "default",
                cityName: "Rim City",
                teamName: "Legends",
                region: "unknown",
                order: 0,
                nightclubName: "Club 23",
                buffs: {},
                notes: "Fallback city"
            };
        }
        
        // 0-based index, cycling through cities
        var index = ((gameDay - 1) % cities.length);
        if (index < 0) index = 0;
        
        return cities[index];
    }
    
    /**
     * Get the current city based on shared state.
     * Convenience wrapper that fetches gameDay from SharedState.
     */
    function getToday() {
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        return getCurrent(gameDay);
    }
    
    /**
     * Get stat buffs for a city.
     * Returns normalized buffs object.
     */
    function getBuffs(city) {
        if (!city || !city.buffs) {
            return {
                speed: 0,
                three: 0,
                power: 0,
                steal: 0,
                block: 0,
                dunk: 0,
                stamina: 0,
                defense: 0,
                fundamentals: 0,
                clutch: 0,
                luck: 0,
                foulTolerance: 0,
                repMultiplier: 1.0,
                cashMultiplier: 1.0
            };
        }
        
        var buffs = city.buffs;
        return {
            speed: buffs.speed || 0,
            three: buffs.three || 0,
            power: buffs.power || 0,
            steal: buffs.steal || 0,
            block: buffs.block || 0,
            dunk: buffs.dunk || 0,
            stamina: buffs.stamina || 0,
            defense: buffs.defense || 0,
            fundamentals: buffs.fundamentals || 0,
            clutch: buffs.clutch || 0,
            luck: buffs.luck || 0,
            foulTolerance: buffs.foulTolerance || 0,
            repMultiplier: buffs.repMultiplier || 1.0,
            cashMultiplier: buffs.cashMultiplier || 1.0
        };
    }
    
    /**
     * Apply city buffs to player stats (additive bonuses).
     * Returns a new stats object with buffs applied.
     */
    function applyBuffsToStats(baseStats, city) {
        var buffs = getBuffs(city);
        
        return {
            speed: (baseStats.speed || 5) + buffs.speed,
            threePt: (baseStats.threePt || 5) + buffs.three,
            power: (baseStats.power || 5) + buffs.power,
            steal: (baseStats.steal || 5) + buffs.steal,
            block: (baseStats.block || 5) + buffs.block,
            dunk: (baseStats.dunk || 5) + buffs.dunk
        };
    }
    
    /**
     * Get the nightclub name for a city.
     */
    function getClubName(city) {
        if (!city) return "Club 23";
        return city.nightclubName || "Club 23";
    }
    
    /**
     * Get the path to city banner art (80x4).
     * Falls back to default if city-specific doesn't exist.
     */
    function getBannerPath(city) {
        if (!city || !city.bannerBin) {
            return DEFAULT_BANNER;
        }
        
        var path = CITY_ART_DIR + city.bannerBin;
        if (file_exists(path)) {
            return path;
        }
        
        return DEFAULT_BANNER;
    }
    
    /**
     * Get the path to city detail art (40x20).
     * Falls back to default if city-specific doesn't exist.
     */
    function getDetailPath(city) {
        if (!city || !city.detailBin) {
            return DEFAULT_DETAIL;
        }
        
        var path = CITY_ART_DIR + city.detailBin;
        if (file_exists(path)) {
            return path;
        }
        
        return DEFAULT_DETAIL;
    }
    
    /**
     * Get display title for hub header.
     * Format: "CITYNAME - DAY X"
     */
    function getHubTitle(city, gameDay) {
        var cityName = city ? city.cityName.toUpperCase() : "RIM CITY";
        return cityName + " - DAY " + gameDay;
    }
    
    /**
     * Get team color code for display.
     */
    function getTeamColorCode(city) {
        // Map regions to color schemes for variety
        var regionColors = {
            "northeast": "\1h\1g",  // Bright green (Celtics vibe)
            "midwest": "\1h\1r",    // Bright red (Bulls vibe)
            "southeast": "\1h\1m",  // Bright magenta (Heat vibe)
            "southwest": "\1h\1y",  // Bright yellow
            "mountain": "\1h\1b",   // Bright blue (Nuggets vibe)
            "west": "\1h\1c",       // Bright cyan (Lakers/Warriors)
            "north": "\1h\1w"       // Bright white (Wolves)
        };
        
        if (!city || !city.region) return "\1h\1c";
        return regionColors[city.region] || "\1h\1c";
    }
    
    /**
     * Get a short description of active city buffs for display.
     */
    function getBuffDescription(city) {
        if (!city || !city.buffs) return "";
        
        var parts = [];
        var b = city.buffs;
        
        if (b.speed) parts.push("SPD+" + b.speed);
        if (b.three) parts.push("3PT+" + b.three);
        if (b.power) parts.push("PWR+" + b.power);
        if (b.steal) parts.push("STL+" + b.steal);
        if (b.block) parts.push("BLK+" + b.block);
        if (b.dunk) parts.push("DNK+" + b.dunk);
        if (b.stamina) parts.push("STA+" + b.stamina);
        if (b.defense) parts.push("DEF+" + b.defense);
        if (b.repMultiplier && b.repMultiplier > 1) {
            parts.push("REP×" + b.repMultiplier.toFixed(2));
        }
        if (b.cashMultiplier && b.cashMultiplier > 1) {
            parts.push("$×" + b.cashMultiplier.toFixed(2));
        }
        
        return parts.join(" ");
    }
    
    // Export to LORB namespace
    if (!LORB.Data) LORB.Data = {};
    LORB.Cities = {
        getAll: getAll,
        getById: getById,
        getCurrent: getCurrent,
        getToday: getToday,
        getBuffs: getBuffs,
        applyBuffsToStats: applyBuffsToStats,
        getClubName: getClubName,
        getBannerPath: getBannerPath,
        getDetailPath: getDetailPath,
        getHubTitle: getHubTitle,
        getTeamColorCode: getTeamColorCode,
        getBuffDescription: getBuffDescription,
        CITY_ART_DIR: CITY_ART_DIR
    };
    
})();
