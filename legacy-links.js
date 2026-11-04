// Old links into the one-page site keep working.
// Before the redesign everything lived on the home page, so links like
// /#about, /#wotlk or /#yogg (a shared screenshot) still exist out there.
// Loaded in <head> on the home page only, without defer, so the visitor is
// sent on before the home page paints. location.replace keeps Back sane:
// the old address doesn't stay in the history.
//   #about                 -> /about/
//   #forever               -> /forever/
//   #memories-block, era ids and anything else (image links) -> /classic/#same
//   ids that exist on the home page (HOME_IDS) stay here.
(function () {
  "use strict";

  // Every id on the home page. Keep this in step with index.html.
  const HOME_IDS = [
    "main", "site-nav", "now", "now-title", "realm-forever-title", "realm-mop-title",
    "archive-title", "leadership-title", "join-title"
  ];

  function target(hash) {
    const id = hash.slice(1);
    if (!id || HOME_IDS.indexOf(id) !== -1) return null;
    if (id === "about") return "/about/";
    if (id === "forever") return "/forever/";
    // The hash goes on unchanged: ids are case-sensitive (#MoP).
    return "/classic/" + hash;
  }

  function follow() {
    const to = target(location.hash);
    if (to) location.replace(to);
  }

  follow();
  window.addEventListener("hashchange", follow);
})();
