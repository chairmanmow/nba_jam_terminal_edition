/**
 * figlet-banner.js - Dynamic TDF font banner rendering for LORB
 * 
 * Renders club/bar names using TheDraw fonts that fit within
 * the 80x4 banner dimensions. Uses a pre-computed list of short fonts.
 * Applies team colors from the current city.
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
    
    // Pre-computed list of fonts with height <= 4
    // Generated via scan of all TDF fonts - DO NOT dynamically scan at runtime!
    var SHORT_FONTS = [
        "cryptic.tdf",
        "kevin4.tdf",
        "rod.tdf",
        "rusty.tdf",
        "scd-line.tdf"
    ];
    
    // Single cached font object (we only need one at a time)
    var cachedFont = null;
    var cachedFontPath = null;
    
    /**
     * Load a font (with simple single-entry cache)
     */
    function loadFont(fontName) {
        if (!tdf) return null;
        
        // Return cached if same font
        if (cachedFontPath === fontName && cachedFont) {
            return cachedFont;
        }
        
        try {
            tdf.opt = {};
            cachedFont = tdf.loadfont(fontName);
            cachedFontPath = fontName;
            return cachedFont;
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
     * Apply a color to TDF output by replacing color codes.
     * TDF fonts have embedded colors - we replace the foreground with team color.
     */
    function applyTeamColor(rendered, teamColorCode) {
        if (!rendered || !teamColorCode) return rendered;
        
        // Replace bright foreground colors with team color
        // TDF uses \1h\1X for bright colors - replace the color letter
        var result = rendered;
        
        // Extract just the color letter from teamColorCode (e.g., "\1h\1b" -> "b")
        var colorMatch = teamColorCode.match(/\\1([rgybmcwk])/i) || 
                         teamColorCode.match(/\x01([rgybmcwk])/i);
        if (!colorMatch) {
            // Try to find color in the code
            var lastChar = teamColorCode.charAt(teamColorCode.length - 1);
            if (/[rgybmcwk]/i.test(lastChar)) {
                colorMatch = [null, lastChar];
            }
        }
        
        if (colorMatch) {
            var newColor = colorMatch[1].toLowerCase();
            // Replace all bright color codes with team color
            result = result.replace(/\x01h\x01[rgybmcwk]/gi, "\x01h\x01" + newColor);
        }
        
        return result;
    }
    
    /**
     * Render text using a random fitting font
     * Returns the rendered string (with color codes) or null if none fit
     * @param {string} text - Text to render
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     * @param {string} teamColor - Optional team color code to apply
     */
    function renderRandom(text, maxWidth, maxHeight, teamColor) {
        if (!tdf) return null;
        
        maxWidth = maxWidth || BANNER_WIDTH;
        
        // Shuffle the font list
        var shuffled = SHORT_FONTS.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        
        // Try fonts until one fits
        for (var i = 0; i < shuffled.length; i++) {
            var font = loadFont(shuffled[i]);
            if (font && textFits(text, font, maxWidth)) {
                try {
                    tdf.opt = {
                        width: maxWidth,
                        justify: 2 // CENTER_JUSTIFY
                    };
                    var rendered = tdf.output(text, font);
                    
                    // Apply team color if provided
                    if (teamColor) {
                        rendered = applyTeamColor(rendered, teamColor);
                    }
                    
                    return rendered;
                } catch (e) {
                    continue;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Render text to a Frame object for RichView integration.
     * Automatically uses current city's team colors if available.
     */
    function renderToFrame(frame, text, fgColor, bgColor, maxWidth, maxHeight) {
        if (!frame) return false;
        
        maxWidth = maxWidth || frame.width || BANNER_WIDTH;
        maxHeight = maxHeight || frame.height || BANNER_HEIGHT;
        
        // Get team color from current city if not specified
        var teamColor = fgColor;
        if (!teamColor && LORB && LORB.Cities && LORB.Cities.getToday) {
            var city = LORB.Cities.getToday();
            if (city && LORB.Cities.getTeamColors) {
                var colors = LORB.Cities.getTeamColors(city);
                teamColor = colors.fg;
            }
        }
        
        var rendered = renderRandom(text, maxWidth, maxHeight, teamColor);
        
        if (!rendered) {
            // Fallback: just center the text plainly with team color
            frame.clear();
            var padding = Math.floor((maxWidth - text.length) / 2);
            var paddedText = "";
            for (var i = 0; i < padding; i++) paddedText += " ";
            paddedText += text;
            
            var colorCode = teamColor || "\1h\1c";
            frame.gotoxy(1, Math.floor(maxHeight / 2) + 1);
            frame.putmsg(colorCode + paddedText + "\1n");
            return false;
        }
        
        // Clear frame and write rendered text
        frame.clear();
        frame.home();  // Reset cursor to top-left (1,1)
        frame.putmsg(rendered);
        
        return true;
    }
    
    /**
     * Get a simple fallback banner (no figlet)
     */
    function getFallbackBanner(text, width, height) {
        width = width || BANNER_WIDTH;
        height = height || BANNER_HEIGHT;
        
        var lines = [];
        var padding = Math.floor((width - text.length) / 2);
        var paddedText = "";
        for (var i = 0; i < padding; i++) paddedText += " ";
        paddedText += text;
        
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
    
    // Export to LORB namespace
    if (typeof LORB === "undefined") {
        this.FigletBanner = {
            renderRandom: renderRandom,
            renderToFrame: renderToFrame,
            getFallbackBanner: getFallbackBanner,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    } else {
        if (!LORB.Util) LORB.Util = {};
        LORB.Util.FigletBanner = {
            renderRandom: renderRandom,
            renderToFrame: renderToFrame,
            getFallbackBanner: getFallbackBanner,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    }
    
})();
