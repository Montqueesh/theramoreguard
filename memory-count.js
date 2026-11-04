// Home page: "Memories in the archive" counts itself.
// Fetches /classic/ and /forever/ (same site), counts the .memory elements in
// each gallery section (.block) and writes the total into [data-memory-count].
// The number in the HTML is the fallback: if either page can't be read, or
// has no gallery sections, the HTML number stays and nothing is reported.
// Placeholder frames on /forever/ aren't .memory elements, so they don't count.
(function () {
  "use strict";

  const out = document.querySelector("[data-memory-count]");
  if (!out || !window.fetch || !window.DOMParser) return;

  const PAGES = ["/classic/", "/forever/"];

  function count(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error(url + " " + res.status);
      return res.text();
    }).then(function (html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const blocks = doc.querySelectorAll("main .block");
      if (!blocks.length) throw new Error(url + " has no gallery");
      let n = 0;
      blocks.forEach(function (block) {
        n += block.querySelectorAll(".memory").length;
      });
      return n;
    });
  }

  Promise.all(PAGES.map(count)).then(function (counts) {
    const total = counts.reduce(function (a, b) { return a + b; }, 0);
    if (total > 0) out.textContent = String(total);
  }).catch(function () {
    // Stay silent: the number written in the HTML is still right enough.
  });
})();
