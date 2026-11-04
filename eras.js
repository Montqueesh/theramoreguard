// Era filter for a gallery page (Classic Memories).
// Builds a row of toggle buttons ("All eras 76", "Vanilla 4", ...) above the
// gallery (#memories-block) from its .block sections: the label comes from
// each section's data-chip (or its heading), the count from its .memory
// elements, so new memories need no extra markup. Without JavaScript there
// are no buttons and every section shows.
//
// Links: /classic/#wotlk picks that era. An image link (/classic/#yogg) is
// opened by lightbox.js, which asks the image's section to expand
// ("gallery:expand"); this picks that era too, so the image is never hidden.
// Load this after gallery.js and before lightbox.js.
(function () {
  "use strict";

  const gallery = document.getElementById("memories-block");
  if (!gallery) return;
  const sections = Array.prototype.slice.call(gallery.querySelectorAll(".block"));
  if (sections.length < 2) return;

  function count(el) {
    return el.querySelectorAll(".memory").length;
  }

  // The total also appears in the page intro ("76 moments ...").
  const total = sections.reduce(function (sum, s) { return sum + count(s); }, 0);
  document.querySelectorAll("[data-memory-total]").forEach(function (el) {
    el.textContent = String(total);
  });

  const bar = document.createElement("div");
  bar.className = "era-filter";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Filter by era");
  const inner = document.createElement("div");
  inner.className = "era-filter__inner";
  bar.appendChild(inner);

  const buttons = [];
  function addButton(label, n, section) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "era-chip";
    const countEl = document.createElement("span");
    countEl.className = "era-chip__count";
    countEl.textContent = String(n);
    button.append(label + " ", countEl);
    button.addEventListener("click", function () {
      select(section, true);
    });
    inner.appendChild(button);
    buttons.push({ button: button, section: section });
  }

  addButton("All eras", total, null);
  sections.forEach(function (s) {
    const heading = s.querySelector("h2, h3");
    const label = s.dataset.chip || (heading ? heading.textContent.trim() : s.id);
    addButton(label, count(s), s);
  });
  gallery.parentNode.insertBefore(bar, gallery);

  let current = null;

  // Show one era (or all with null). From a button press, bring the top of
  // the gallery back into view if the page was scrolled past it.
  function select(section, fromButton) {
    current = section;
    buttons.forEach(function (b) {
      b.button.setAttribute("aria-pressed", String(b.section === section));
    });
    sections.forEach(function (s) {
      s.hidden = section !== null && s !== section;
    });
    if (fromButton && gallery.getBoundingClientRect().top < 0) {
      gallery.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  // A shared image link: lightbox.js expands the image's section.
  sections.forEach(function (s) {
    s.addEventListener("gallery:expand", function () {
      if (current !== s) select(s, false);
    });
  });

  // An era link (/classic/#wotlk or #MoP; any case) picks that era.
  function fromHash() {
    const id = location.hash.slice(1).toLowerCase();
    if (!id) return;
    if (id === "memories-block") {
      select(null, false);
      return;
    }
    const section = sections.find(function (s) { return s.id.toLowerCase() === id; });
    if (!section) return;
    select(section, false);
    section.scrollIntoView({ block: "start", behavior: "instant" });
  }

  select(null, false);
  fromHash();
  window.addEventListener("hashchange", fromHash);
})();
