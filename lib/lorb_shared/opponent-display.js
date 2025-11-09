/* TODO: create a function that can process the type of data being returned from
 a function such as in lib/lorb/get_random_opponent.js and render the view.
 we want to create a view that uses frame.js and can either take a parentFrame as an argument to attach to
we should create an 80 x 24 column sub frame that is centered in the middle of the console window if larger than 80 x 24
this sub frame should contain two other 40 column x 24 sub frames, which each contain from top to bottom:
- a message frame that is 2 columns high
- an ansi loader frame that is 20 columns high
- a status/info frame that is 2 columns high

we can have up to zero to four entries in the data we have.
if it is zero entries, we just display a message "no opponents found"
if it is one entry, we display it in the left sub frame, and the right sub frame is blank
if it is two entries on different teams, we display one in each sub frame and call a createTrashTalk(trashTalkerPlayer,playerToTalkTrashTo) type function (needs to be created)
if it is two entries on same teams, we display one in each sub frame and call a createTeamTrashTalk(team1,team2) type function (needs to be created)
MULTI-CRITERIA / multi steps:
- if it is three entries, we divide by team and show both for the one that has two entries, they can call createTeamTrashTalk(team1, team2);
- we can transitition to the next view via timeout or keypress to show the third player in the left sub frame alone with createTrashTalk(trashTalkerPlayer, playerToTalkTrashTo);

MULTI-CRITERIA / multi steps: if it is four entries, 
- same teams, we display one in each sub frame and call a createTeamTrashTalk(team1,team2) type function (needs to be created) 
- transitition to the next view via timeout or keypress
- show the other two players on the opposite team in the same way.
*/