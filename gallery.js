// Collapsible gallery sections.
// Each expansion shows its first few memories and hides the rest behind a
// "Show all N memories" button. Set up at load time, so new memories need no
// extra markup, and without JavaScript every memory simply shows.
(function () {
  "use strict";

  const VISIBLE = 4; // two rows on desktop
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll(".block").forEach(function (section) {
    const grid = section.querySelector(".memories");
    if (!grid) return;
    const count = grid.querySelectorAll(".memory").length;
    if (count <= VISIBLE) return;

    grid.id = grid.id || section.id + "-memories";
    grid.classList.add("is-collapsed");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "memories-toggle";
    button.setAttribute("aria-controls", grid.id);
    grid.insertAdjacentElement("afterend", button);

    function setExpanded(expanded) {
      grid.classList.toggle("is-collapsed", !expanded);
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = expanded ? "Show fewer" : "Show all " + count + " memories";
    }
    setExpanded(false);

    button.addEventListener("click", function () {
      const expanding = grid.classList.contains("is-collapsed");
      setExpanded(expanding);
      if (!expanding) {
        // The section just got much shorter; bring its heading back into view.
        section.scrollIntoView({ block: "start", behavior: reduceMotion.matches ? "instant" : "smooth" });
      }
    });

    // The viewer asks for this when a shared link points at a hidden memory.
    section.addEventListener("gallery:expand", function () {
      setExpanded(true);
    });
  });
})();
