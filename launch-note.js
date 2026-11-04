// Home only: hides the launch-day line (".launch-note") once its date has
// come, so it shows for about two weeks after WoW Forever's launch.
// data-until="YYYY-MM-DD" is an Eastern date: from midnight Eastern that day
// the line is hidden. Without JavaScript it simply stays, so remove the
// paragraph and this file from the site once the date has passed.
(function () {
  "use strict";

  const note = document.querySelector(".launch-note[data-until]");
  if (!note) return;

  // Today's date in Eastern time, as YYYY-MM-DD ("en-CA" formats it that way).
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());

  if (today >= note.getAttribute("data-until")) note.hidden = true;
})();
