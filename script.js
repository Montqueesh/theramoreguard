// Footer year and the Back to top button.
(function () {
  "use strict";

  const button = document.getElementById("myBtn");

  // Footer copyright year
  document.getElementById("year").textContent = new Date().getFullYear();

  // When the user scrolls down 20px from the top of the document, show the button.
  // Only touch the DOM when the visibility actually changes.
  let buttonVisible = false;
  function updateButton() {
    const shouldShow = window.scrollY > 20;
    if (shouldShow !== buttonVisible) {
      buttonVisible = shouldShow;
      button.style.display = shouldShow ? "block" : "none";
    }
  }
  window.addEventListener("scroll", updateButton, { passive: true });
  updateButton();

  // When the user clicks on the button, scroll to the top of the document
  button.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();

// "Guild Memories" menu. Without JavaScript it is a plain link to the gallery.
// Here it becomes a disclosure button: tap, click, Enter or Space toggles the
// submenu; Esc, a click outside, choosing a link or tabbing out closes it.
// Hover still opens it on devices with a real hover pointer (see style.css).
(function () {
  "use strict";

  const link = document.querySelector('.header nav a[href="#memories-block"]');
  const item = link && link.parentElement;
  const menu = item && item.querySelector("ul");
  if (!menu) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nav-toggle";
  toggle.innerHTML = link.innerHTML;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", menu.id);
  link.replaceWith(toggle);
  document.documentElement.classList.add("has-nav-toggle");

  function setOpen(open) {
    item.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", function () {
    item.classList.remove("is-dismissed");
    setOpen(!item.classList.contains("is-open"));
  });

  // Esc closes the menu, even one held open by hovering, and puts focus back
  // on the toggle if it was inside the menu.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const wasOpen = item.classList.contains("is-open") || item.matches(":hover");
    if (!wasOpen) return;
    setOpen(false);
    item.classList.add("is-dismissed"); // stays closed until the pointer leaves
    if (item.contains(document.activeElement)) toggle.focus();
  });
  item.addEventListener("mouseleave", function () {
    item.classList.remove("is-dismissed");
  });

  // pointerdown rather than click: iOS Safari doesn't send click for taps on
  // plain page content
  document.addEventListener("pointerdown", function (e) {
    if (!item.contains(e.target)) setOpen(false);
  });

  // Choosing a link closes the menu; the link still navigates as usual.
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });

  // Tabbing (or Shift+Tab) out of the menu closes it.
  item.addEventListener("focusout", function (e) {
    if (e.relatedTarget && !item.contains(e.relatedTarget)) setOpen(false);
  });
})();
