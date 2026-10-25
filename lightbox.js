// Click-to-enlarge viewer for the gallery.
// Builds itself at load time and works on every ".memory img", so new gallery
// images need no extra markup. Browsing stays inside the clicked image's
// expansion section and stops at either end.
(function () {
  "use strict";

  const galleryImages = document.querySelectorAll(".memory img");
  if (!galleryImages.length || typeof HTMLDialogElement !== "function") return;

  function icon(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + path + '"/></svg>';
  }

  // Build the viewer once.
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Image viewer");
  dialog.innerHTML =
    '<button type="button" class="lightbox__btn lightbox__close" aria-label="Close image viewer">' + icon("M6 6l12 12M18 6 6 18") + "</button>" +
    '<div class="lightbox__stage">' +
    '<div class="lightbox__spinner" aria-hidden="true"></div>' +
    '<img class="lightbox__img" alt="" draggable="false">' +
    "</div>" +
    '<div class="lightbox__bar">' +
    '<p class="lightbox__caption"></p>' +
    '<div class="lightbox__controls">' +
    '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Previous image">' + icon("M15 5l-7 7 7 7") + "</button>" +
    '<span class="lightbox__counter"></span>' +
    '<button type="button" class="lightbox__copy">' +
    icon("M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1") +
    '<span class="lightbox__copy-label">Copy link</span></button>' +
    '<button type="button" class="lightbox__btn lightbox__next" aria-label="Next image">' + icon("M9 5l7 7-7 7") + "</button>" +
    "</div>" +
    "</div>" +
    '<p class="lightbox__status" aria-live="polite"></p>';
  document.body.appendChild(dialog);

  const closeBtn = dialog.querySelector(".lightbox__close");
  const stage = dialog.querySelector(".lightbox__stage");
  const img = dialog.querySelector(".lightbox__img");
  const bar = dialog.querySelector(".lightbox__bar");
  const controls = dialog.querySelector(".lightbox__controls");
  const caption = dialog.querySelector(".lightbox__caption");
  const counter = dialog.querySelector(".lightbox__counter");
  const prevBtn = dialog.querySelector(".lightbox__prev");
  const nextBtn = dialog.querySelector(".lightbox__next");
  const copyBtn = dialog.querySelector(".lightbox__copy");
  const copyLabel = dialog.querySelector(".lightbox__copy-label");
  const status = dialog.querySelector(".lightbox__status");

  let items = []; // gallery images in the open section
  let index = 0;
  let opener = null; // gallery image that opened the viewer
  let savedScrollY = 0;
  let loadToken = 0; // ignores load events from images we've already moved past
  let zoomed = false;
  let copyTimer = 0;

  // Shareable links: each gallery image gets an id from its filename, or from
  // a data-slug attribute, e.g. Ragnaros.PNG -> #ragnaros and
  // "Protector Kaolan-N.jpg" -> #protector-kaolan-n. Links match without
  // regard to case, so ids are checked for collisions the same way.
  const SITE_URL = "https://www.theramoreguard.com/";
  const imageBySlug = new Map();
  const slugByImage = new Map();
  const takenIds = new Set();
  document.querySelectorAll("[id]").forEach(function (el) {
    takenIds.add(el.id.toLowerCase());
  });

  function slugFor(galleryImg) {
    if (galleryImg.dataset.slug) return galleryImg.dataset.slug.trim().toLowerCase();
    const file = decodeURIComponent(galleryImg.getAttribute("src").split("/").pop());
    return file.replace(/\.[^.]+$/, "").toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  galleryImages.forEach(function (galleryImg) {
    const slug = slugFor(galleryImg);
    if (!slug || takenIds.has(slug)) {
      console.error('Gallery link "#' + slug + '" for ' + galleryImg.getAttribute("src") +
        " is empty or already used by another id or image. Give the image a unique data-slug.");
      return;
    }
    takenIds.add(slug);
    imageBySlug.set(slug, galleryImg);
    slugByImage.set(galleryImg, slug);
    galleryImg.id = slug;
  });

  // Make every gallery image open the viewer by click, tap, Enter or Space.
  galleryImages.forEach(function (galleryImg) {
    galleryImg.tabIndex = 0;
    galleryImg.setAttribute("role", "button");
    galleryImg.setAttribute("aria-haspopup", "dialog");
    galleryImg.setAttribute("aria-label", "View larger: " + galleryImg.alt);
    galleryImg.addEventListener("click", function () {
      open(galleryImg);
    });
    galleryImg.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.repeat) {
        e.preventDefault();
        open(galleryImg);
      } else if (e.key === " ") {
        e.preventDefault(); // stop the page scrolling; opens on keyup like a button
      }
    });
    galleryImg.addEventListener("keyup", function (e) {
      if (e.key === " ") open(galleryImg);
    });
  });

  function open(galleryImg) {
    if (dialog.open) return;
    opener = galleryImg;
    const section = galleryImg.closest(".block") || document;
    items = Array.prototype.slice.call(section.querySelectorAll(".memory img"));
    savedScrollY = window.scrollY;
    document.documentElement.classList.add("lightbox-open");
    dialog.showModal();
    closeBtn.focus();
    show(items.indexOf(galleryImg));
  }

  // Esc (native dialog cancel), the X button and backdrop clicks all end here.
  dialog.addEventListener("close", function () {
    loadToken++;
    setZoom(false);
    setHash("");
    img.removeAttribute("src");
    document.documentElement.classList.remove("lightbox-open");
    if (window.scrollY !== savedScrollY) window.scrollTo({ top: savedScrollY, behavior: "instant" });
    if (opener) opener.focus({ preventScroll: true });
    opener = null;
  });

  function show(i) {
    index = i;
    const galleryImg = items[index];
    const captionEl = galleryImg.closest(".memory").querySelector("p");
    const token = ++loadToken;

    setZoom(false);
    dialog.classList.remove("is-zoomable");
    dialog.classList.add("is-loading");
    img.alt = galleryImg.alt;
    caption.textContent = captionEl ? captionEl.textContent.trim() : "";
    counter.textContent = (index + 1) + " / " + items.length;
    status.textContent = "Image " + (index + 1) + " of " + items.length + ": " + galleryImg.alt;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === items.length - 1;
    copyBtn.disabled = !slugByImage.has(galleryImg);
    resetCopyLabel();
    setHash(slugByImage.get(galleryImg) || "");
    keepFocusInside();

    img.onload = function () {
      if (token !== loadToken) return;
      dialog.classList.remove("is-loading");
      updateZoomable();
      preload(index - 1);
      preload(index + 1);
    };
    img.onerror = function () {
      if (token !== loadToken) return;
      dialog.classList.remove("is-loading");
      status.textContent = "Image " + (index + 1) + " could not be loaded.";
    };
    img.src = galleryImg.src;
  }

  function preload(i) {
    if (i < 0 || i >= items.length) return;
    const pre = new Image();
    pre.decoding = "async";
    pre.src = items[i].src;
  }

  // The address bar follows the image on screen. replaceState keeps browsing
  // out of the back-button history and never scrolls the page.
  function setHash(slug) {
    history.replaceState(history.state, "", location.pathname + location.search + (slug ? "#" + slug : ""));
  }

  // Open the image a shared link points at, expanding its section if needed.
  // Section links like #cataclysm don't match an image and scroll as usual.
  function openFromHash() {
    let slug = "";
    try {
      slug = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    } catch (e) {
      return;
    }
    const target = imageBySlug.get(slug);
    if (!target || dialog.open) return;
    const section = target.closest(".block");
    if (section) section.dispatchEvent(new CustomEvent("gallery:expand"));
    target.scrollIntoView({ block: "center", behavior: "instant" });
    open(target);
  }

  // Copy link: Clipboard API, then the older copy command, then a prompt.
  copyBtn.addEventListener("click", function () {
    const slug = slugByImage.get(items[index]);
    if (!slug) return;
    const url = SITE_URL + "#" + slug;
    copyText(url).then(function () {
      copyLabel.textContent = "Link copied";
      status.textContent = "Link copied to clipboard.";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(resetCopyLabel, 2000);
    }, function () {
      window.prompt("Copy this link:", url);
    });
  });

  function resetCopyLabel() {
    clearTimeout(copyTimer);
    copyLabel.textContent = "Copy link";
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      // Inside the dialog, because a modal dialog makes the rest of the page inert.
      const field = document.createElement("textarea");
      field.className = "lightbox__copy-field";
      field.value = text;
      field.setAttribute("readonly", "");
      dialog.appendChild(field);
      field.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (e) {
        copied = false;
      }
      field.remove();
      copyBtn.focus();
      if (copied) resolve();
      else reject();
    });
  }

  function go(step) {
    const i = index + step;
    if (i >= 0 && i < items.length) show(i);
  }

  // If the focused button was just disabled (end of a section), move focus to
  // a button that still works instead of losing it.
  function keepFocusInside() {
    const active = document.activeElement;
    if (active && dialog.contains(active) && !active.disabled) return;
    if (!prevBtn.disabled) prevBtn.focus();
    else if (!nextBtn.disabled) nextBtn.focus();
    else closeBtn.focus();
  }

  prevBtn.addEventListener("click", function () {
    go(-1);
  });
  nextBtn.addEventListener("click", function () {
    go(1);
  });
  closeBtn.addEventListener("click", function () {
    dialog.close();
  });

  // Arrow keys browse; Tab cycles through the viewer's buttons only. Listening
  // on the document keeps this working even if focus has slipped out of the
  // dialog (a page that loads with an image link can lose it).
  document.addEventListener("keydown", function (e) {
    if (!dialog.open) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "Tab") {
      const focusable = [closeBtn, prevBtn, copyBtn, nextBtn].filter(function (b) {
        return !b.disabled;
      });
      const pos = focusable.indexOf(document.activeElement);
      const next = e.shiftKey
        ? (pos <= 0 ? focusable.length - 1 : pos - 1)
        : (pos === -1 || pos === focusable.length - 1 ? 0 : pos + 1);
      e.preventDefault();
      focusable[next].focus();
    }
  });

  // Clicking empty space around the image closes the viewer. Both press and
  // release must land on empty space, so a drag that ends there doesn't close it.
  function isBackdrop(el) {
    return el === dialog || el === stage || el === bar || el === controls;
  }
  let pressedBackdrop = false;
  dialog.addEventListener("pointerdown", function (e) {
    pressedBackdrop = isBackdrop(e.target);
  });
  dialog.addEventListener("click", function (e) {
    if (pressedBackdrop && isBackdrop(e.target)) dialog.close();
  });

  // Zoom: toggle between fit-to-screen and 100% size, keeping the point that
  // was clicked under the pointer.
  function setZoom(on, clientX, clientY) {
    if (on === zoomed) return;
    let fx = 0.5;
    let fy = 0.5;
    if (on && clientX !== undefined) {
      const r = img.getBoundingClientRect();
      fx = (clientX - r.left) / r.width;
      fy = (clientY - r.top) / r.height;
    }
    zoomed = on;
    dialog.classList.toggle("is-zoomed", on);
    if (on) {
      const s = stage.getBoundingClientRect();
      const px = clientX === undefined ? s.width / 2 : clientX - s.left;
      const py = clientY === undefined ? s.height / 2 : clientY - s.top;
      stage.scrollLeft = img.offsetLeft + fx * img.offsetWidth - px;
      stage.scrollTop = img.offsetTop + fy * img.offsetHeight - py;
    } else {
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
      updateZoomable();
    }
  }

  // Only offer zoom when the original is bigger than it appears on screen.
  function updateZoomable() {
    const bigger = img.naturalWidth > img.clientWidth + 1 || img.naturalHeight > img.clientHeight + 1;
    dialog.classList.toggle("is-zoomable", zoomed || bigger);
  }
  window.addEventListener("resize", function () {
    if (dialog.open && !zoomed) updateZoomable();
  });

  // Mouse: click toggles zoom. Touch: double-tap toggles zoom.
  // Dragging pans a zoomed image with either. Touch panning is done here rather
  // than by native scrolling so a drag past the edge can't trigger the
  // browser's swipe-back navigation; a second finger hands over to pinch-zoom.
  let pointerType = "mouse";
  let drag = null;
  let dragged = false;
  let lastTap = { time: 0, x: 0, y: 0 };

  img.addEventListener("pointerdown", function (e) {
    pointerType = e.pointerType;
    dragged = false;
    if (drag) {
      endDrag(); // second finger: pinch, not pan
      return;
    }
    if (!zoomed || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    img.setPointerCapture(e.pointerId);
    dialog.classList.add("is-dragging");
  });
  img.addEventListener("pointermove", function (e) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
    stage.scrollLeft = drag.left - dx;
    stage.scrollTop = drag.top - dy;
  });
  function endDrag() {
    drag = null;
    dialog.classList.remove("is-dragging");
  }
  img.addEventListener("pointercancel", endDrag);

  // Taps are read from pointerup: Chrome can swallow the click of a tap that
  // comes right after a drag, which would make double-tap unreliable.
  img.addEventListener("pointerup", function (e) {
    endDrag();
    if (e.pointerType !== "touch" || dragged || !dialog.classList.contains("is-zoomable")) return;
    const now = Date.now();
    const isDoubleTap = now - lastTap.time < 350 &&
      Math.abs(e.clientX - lastTap.x) < 40 && Math.abs(e.clientY - lastTap.y) < 40;
    lastTap = isDoubleTap ? { time: 0, x: 0, y: 0 } : { time: now, x: e.clientX, y: e.clientY };
    if (isDoubleTap) setZoom(!zoomed, e.clientX, e.clientY);
  });

  img.addEventListener("click", function (e) {
    if (pointerType === "touch") return; // handled on pointerup
    if (dragged) {
      dragged = false;
      return;
    }
    if (dialog.classList.contains("is-zoomable")) setZoom(!zoomed, e.clientX, e.clientY);
  });

  // Swipe left/right to browse. Ignored while zoomed, during a pinch, or when
  // the page itself is pinch-zoomed, so panning and pinch-to-zoom still work.
  // The CSS gives the browser only vertical panning and pinch-zoom here, so a
  // sideways swipe can't also trigger the browser's swipe-back navigation;
  // "is-pinched" hands sideways panning back while the page is pinch-zoomed.
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      dialog.classList.toggle("is-pinched", window.visualViewport.scale > 1.01);
    });
  }
  let swipe = null;
  stage.addEventListener("touchstart", function (e) {
    const pinchZoomed = window.visualViewport && window.visualViewport.scale > 1.01;
    swipe = e.touches.length === 1 && !zoomed && !pinchZoomed
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : null;
  }, { passive: true });
  stage.addEventListener("touchmove", function (e) {
    if (e.touches.length > 1) swipe = null;
  }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (!swipe) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  openFromHash();
  window.addEventListener("hashchange", openFromHash);
  // Arriving with an image link, the browser's own jump to that id can pull
  // focus out of the open viewer while the page finishes loading.
  window.addEventListener("load", function () {
    if (dialog.open && !dialog.contains(document.activeElement)) closeBtn.focus();
  });
})();
