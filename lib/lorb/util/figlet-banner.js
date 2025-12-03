/**
 * figlet-banner.js - Dynamic TDF font banner rendering for LORB
 * 
 * Renders club/bar names using TheDraw fonts that fit within
 * the 80x4 banner dimensions. Randomly selects from fonts that fit.
 */
(function() {
    
    // Load the TDF fonts library
    var tdf = null;
    try {
        tdf = load("tdfonts_lib.js");
    } catch (e) {
        log(LOG_ERR, "[FIGLET-BANNER] Failed to load tdfonts_lib.js: " + e);
    }
    
    // Banner dimensions
    var BANNER_WIDTH = 80;
    var BANNER_HEIGHT = 4;
    
    // Cache of fonts that are known to be short enough (height <= 4)
    var shortFontCache = null;
    
    // Cache of loaded font objects (to avoid reloading)
    var loadedFonts = {};
    
    /**
     * Get list of all available TDF font files
     */
    function getAllFonts() {
        if (!tdf) return [];
        return tdf.getlist();
    }
    
    /**
     * Scan all fonts and find ones with height <= maxHeight
     * This is expensive on first call but cached thereafter
     */
    function getShortFonts(maxHeight) {
        if (shortFontCache) return shortFontCache;
        
        maxHeight = maxHeight || BANNER_HEIGHT;
        shortFontCache = [];
        
        var allFonts = getAllFonts();
        log(LOG_DEBUG, "[FIGLET-BANNER] Scanning " + allFonts.length + " fonts for height <= " + maxHeight);
        
        for (var i = 0; i < allFonts.length; i++) {
            try {
                var fontPath = allFonts[i];
                var font = loadFont(fontPath);
                
                if (font && font.height <= maxHeight) {
                    shortFontCache.push({
                        path: fontPath,
                        name: font.name,
                        height: font.height,
                        spacing: font.spacing
                    });
                }
            } catch (e) {
                // Skip fonts that fail to load
            }
        }
        
        log(LOG_DEBUG, "[FIGLET-BANNER] Found " + shortFontCache.length + " fonts with height <= " + maxHeight);
        return shortFontCache;
    }
    
    /**
     * Load a font (with caching)
     */
    function loadFont(fontPath) {
        if (!tdf) return null;
        
        if (loadedFonts[fontPath]) {
            return loadedFonts[fontPath];
        }
        
        try {
            // Temporarily disable opt to avoid side effects
            var oldOpt = tdf.opt;
            tdf.opt = {};
            
            var font = tdf.loadfont(fontPath);
            loadedFonts[fontPath] = font;
            
            tdf.opt = oldOpt;
            return font;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Check if text fits within maxWidth using the given font
     */
    function textFits(text, font, maxWidth) {
        if (!tdf || !font) return false;
        
        try {
            var width = tdf.getwidth(text, font);
            return width <= maxWidth;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Find fonts that can render the given text within constraints
     * Returns array of font info objects that work
     */
    function findFittingFonts(text, maxWidth, maxHeight) {
        maxWidth = maxWidth || BANNER_WIDTH;
        maxHeight = maxHeight || BANNER_HEIGHT;
        
        var shortFonts = getShortFonts(maxHeight);
        var fitting = [];
        
        for (var i = 0; i < shortFonts.length; i++) {
            var fontInfo = shortFonts[i];
            var font = loadFont(fontInfo.path);
            
            if (font && textFits(text, font, maxWidth)) {
                fitting.push(fontInfo);
            }
        }
        
        return fitting;
    }
    
    /**
     * Render text using a random fitting font
     * Returns the rendered string (with color codes) or null if none fit
     */
    function renderRandom(text, maxWidth, maxHeight) {
        if (!tdf) return null;
        
        var fitting = findFittingFonts(text, maxWidth, maxHeight);
        
        if (fitting.length === 0) {
            log(LOG_WARNING, "[FIGLET-BANNER] No fonts fit for text: " + text);
            return null;
        }
        
        // Pick a random font
        var fontInfo = fitting[Math.floor(Math.random() * fitting.length)];
        var font = loadFont(fontInfo.path);
        
        if (!font) return null;
        
        try {
            // Set options for centered output
            tdf.opt = {
                width: maxWidth,
                justify: 2 // CENTER_JUSTIFY
            };
            
            var result = tdf.output(text, font);
            return result;
        } catch (e) {
            log(LOG_ERR, "[FIGLET-BANNER] Render failed: " + e);
            return null;
        }
    }
    
    /**
     * Render text to a Frame object for RichView integration
     * Applies team colors to the rendered output
     */
    function renderToFrame(frame, text, fgColor, bgColor, maxWidth, maxHeight) {
        if (!frame) return false;
        
        maxWidth = maxWidth || frame.width || BANNER_WIDTH;
        maxHeight = maxHeight || frame.height || BANNER_HEIGHT;
        
        var rendered = renderRandom(text, maxWidth, maxHeight);
        
        if (!rendered) {
            // Fallback: just center the text plainly
            frame.clear();
            var padding = Math.floor((maxWidth - text.length) / 2);
            var paddedText = "";
            for (var i = 0; i < padding; i++) paddedText += " ";
            paddedText += text;
            
            frame.gotoxy(1, Math.floor(maxHeight / 2) + 1);
            frame.putmsg(paddedText);
            return false;
        }
        
        // Clear frame and write rendered text
        frame.clear();
        
        // Apply team colors by replacing color codes
        // The TDF output uses Ctrl-A color codes, we can write directly
        if (fgColor || bgColor) {
            rendered = applyTeamColors(rendered, fgColor, bgColor);
        }
        
        // Write to frame
        frame.gotoxy(1, 1);
        frame.putmsg(rendered);
        
        return true;
    }
    
    /**
     * Apply team colors to rendered figlet text
     * Replaces foreground colors while preserving structure
     */
    function applyTeamColors(text, fgColor, bgColor) {
        if (!fgColor && !bgColor) return text;
        
        // Build color prefix
        var colorPrefix = "\1n"; // Reset first
        if (bgColor) colorPrefix += bgColor;
        if (fgColor) colorPrefix += fgColor;
        
        // For now, just prepend the color - the font's own colors
        // will still show through. A more aggressive approach would
        // strip all color codes and reapply, but that loses the
        // artistic shading in many fonts.
        return colorPrefix + text;
    }
    
    /**
     * Get a simple fallback banner (no figlet)
     * Returns array of strings for each line
     */
    function getFallbackBanner(text, width, height) {
        width = width || BANNER_WIDTH;
        height = height || BANNER_HEIGHT;
        
        var lines = [];
        var padding = Math.floor((width - text.length) / 2);
        var paddedText = "";
        for (var i = 0; i < padding; i++) paddedText += " ";
        paddedText += text;
        
        // Center vertically
        var topPad = Math.floor((height - 1) / 2);
        for (var i = 0; i < topPad; i++) {
            lines.push("");
        }
        lines.push(paddedText);
        while (lines.length < height) {
            lines.push("");
        }
        
        return lines;
    }
    
    /**
     * Pre-warm the font cache (call during boot or idle time)
     */
    function warmCache() {
        getShortFonts(BANNER_HEIGHT);
    }
    
    /**
     * Get cache stats for debugging
     */
    function getCacheStats() {
        return {
            shortFonts: shortFontCache ? shortFontCache.length : 0,
            loadedFonts: Object.keys(loadedFonts).length,
            tdfAvailable: !!tdf
        };
    }
    
    // Export to LORB namespace
    if (typeof LORB === "undefined") {
        // Running standalone for testing
        this.FigletBanner = {
            renderRandom: renderRandom,
            renderToFrame: renderToFrame,
            findFittingFonts: findFittingFonts,
            getShortFonts: getShortFonts,
            getFallbackBanner: getFallbackBanner,
            warmCache: warmCache,
            getCacheStats: getCacheStats,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    } else {
        if (!LORB.Util) LORB.Util = {};
        LORB.Util.FigletBanner = {
            renderRandom: renderRandom,
            renderToFrame: renderToFrame,
            findFittingFonts: findFittingFonts,
            getShortFonts: getShortFonts,
            getFallbackBanner: getFallbackBanner,
            warmCache: warmCache,
            getCacheStats: getCacheStats,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    }
    
})();
