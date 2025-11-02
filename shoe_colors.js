load("sbbsdefs.js");

var SHOE_COLOR_CONFIG = {
    threshold: 45,
    palettes: [
        { name: "ember", high: LIGHTRED, low: RED },
        { name: "surf", high: LIGHTCYAN, low: CYAN },
        { name: "forest", high: LIGHTGREEN, low: GREEN },
        { name: "solar", high: YELLOW, low: BROWN },
        { name: "amethyst", high: LIGHTMAGENTA, low: MAGENTA },
        { name: "polar", high: WHITE, low: LIGHTGRAY },
        { name: "storm", high: LIGHTBLUE, low: BLUE },
        { name: "charcoal", high: DARKGRAY, low: BLACK }
    ]
};

var shoes_and_turbo = {};
for (var s = 0; s < SHOE_COLOR_CONFIG.palettes.length; s++) {
    var entry = SHOE_COLOR_CONFIG.palettes[s];
    shoes_and_turbo[entry.name.toUpperCase()] = [entry.high, entry.low];
}
