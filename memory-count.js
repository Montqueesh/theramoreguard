// Memory counts that keep themselves up to date.
// Each [data-memory-count] element shows how many memories are on the pages
// it names (space-separated; empty means /classic/ and /forever/): Home's
// "Memories in the archive", and the Classic count on /forever/.
// It fetches those pages (same site) and counts the .memory elements in their
// gallery sections (.block). The number in the HTML is the fallback: if a page
// can't be read or has no gallery sections, it stays and nothing is reported.
// Placeholder frames on /forever/ aren't .memory elements, so they don't count.
(function () {
  "use strict";

  const outputs = document.querySelectorAll("[data-memory-count]");
  if (!outputs.length || !window.fetch || !window.DOMParser) return;

  const DEFAULT_PAGES = ["/classic/", "/forever/"];
  const counts = new Map(); // page -> Promise of its count, so each page is fetched once

  function count(url) {
    if (!counts.has(url)) {
      counts.set(url, fetch(url, { credentials: "same-origin" }).then(function (res) {
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
      }));
    }
    return counts.get(url);
  }

  outputs.forEach(function (out) {
    const named = (out.getAttribute("data-memory-count") || "").trim();
    const pages = named ? named.split(/\s+/) : DEFAULT_PAGES;
    Promise.all(pages.map(count)).then(function (list) {
      const total = list.reduce(function (a, b) { return a + b; }, 0);
      if (total > 0) out.textContent = String(total);
    }).catch(function () {
      // Stay silent: the number written in the HTML stays.
    });
  });
})();
