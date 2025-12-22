// Quick test to verify boot.js loads without errors
// Must be run from /sbbs/xtrn/nba_jam/ directory
print("Testing boot.js load...");
print("js.exec_dir = " + js.exec_dir);

// Manually set exec_dir for boot.js
var saved_exec_dir = js.exec_dir;
js.exec_dir = "/sbbs/xtrn/nba_jam/";

try {
    load("/sbbs/xtrn/nba_jam/lib/lorb/boot.js");
    print("BOOT OK");
    print("LORB = " + (typeof LORB));
    print("LORB.Services = " + (typeof LORB.Services));
    print("LORB.Services.NetworkService = " + (typeof LORB.Services.NetworkService));
    print("LORB.Multiplayer = " + (typeof LORB.Multiplayer));
    print("LORB.Multiplayer.Challenges = " + (typeof LORB.Multiplayer.Challenges));
} catch (e) {
    print("BOOT FAILED: " + e);
}
