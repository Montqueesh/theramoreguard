// Shared by every page except 404.html (which has no scripts): the phone
// "Menu" button, the footer's copyright year, the Back to top button and the
// gallery fallback below.
//
// It is loaded in <head> without defer, so the "js" class below is on <html>
// before the first paint. style.css only folds the phone nav away under that
// class, so without JavaScript the nav simply shows in full, with no flash.
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  document.addEventListener("DOMContentLoaded", function () {
    galleryFallback();
    footerYear();
    phoneMenu();
    backToTop();
  });

  // style.css hides gallery memories after the 4th from the first paint, and
  // gallery.js adds the "Show all" buttons. DOMContentLoaded comes after the
  // deferred scripts have run (or failed), so if gallery.js didn't finish,
  // show every memory rather than leave them hidden with no button.
  function galleryFallback() {
    if (document.documentElement.classList.contains("gallery-ready")) return;
    document.querySelectorAll(".block .memories").forEach(function (grid) {
      grid.classList.add("is-expanded");
    });
  }

  function footerYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll(".site-footer .year").forEach(function (el) {
      el.textContent = year;
    });
  }

  // Below the desktop breakpoint (style.css) the nav sits behind a disclosure
  // button. Tap, click, Enter or Space toggles it; Esc, a click or tap outside
  // the header, or tabbing out of it closes it. Esc puts focus back on the button.
  function phoneMenu() {
    const button = document.querySelector(".site-header .menu-button");
    const header = button && button.closest(".site-header");
    const nav = button && document.getElementById(button.getAttribute("aria-controls"));
    if (!header || !nav) return;

    button.hidden = false;

    function isOpen() {
      return header.classList.contains("is-menu-open");
    }

    function setOpen(open) {
      header.classList.toggle("is-menu-open", open);
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Close" : "Menu";
    }

    // The button is only displayed at phone widths (style.css).
    function buttonShown() {
      return button.offsetParent !== null;
    }

    button.addEventListener("click", function () {
      setOpen(!isOpen());
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || e.defaultPrevented || !isOpen()) return;
      setOpen(false);
      button.focus();
    });

    // pointerdown rather than click: iOS Safari doesn't send click for taps on
    // plain page content
    document.addEventListener("pointerdown", function (e) {
      if (isOpen() && !header.contains(e.target)) setOpen(false);
    });

    header.addEventListener("focusout", function (e) {
      if (isOpen() && e.relatedTarget && !header.contains(e.relatedTarget)) setOpen(false);
    });

    // Widening the window to desktop size closes it, so it isn't still open
    // when the window gets narrow again.
    window.addEventListener("resize", function () {
      if (isOpen() && !buttonShown()) setOpen(false);
    });
  }

  // Back to top: appears once the page has scrolled a little. Only touches the
  // DOM when its visibility actually changes.
  function backToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "to-top";
    button.textContent = "Back to top";
    document.body.appendChild(button);

    let visible = false;
    function update() {
      const show = window.scrollY > 600;
      if (show === visible) return;
      visible = show;
      button.classList.toggle("is-visible", show);
    }
    window.addEventListener("scroll", update, { passive: true });
    update();

    button.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
      const main = document.getElementById("main");
      if (main) main.focus({ preventScroll: true });
    });
  }
})();
