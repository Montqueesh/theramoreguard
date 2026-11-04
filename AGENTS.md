# AGENTS.md

Invariants for anyone (human or agent) changing this site. The maintainer guide is README.md; this file lists the rules that keep the site working.

## Shape

- Plain static site, no build step, no frameworks, libraries or CDNs. Everything must stay editable by hand.
- Five pages: `index.html` (Home), `about/index.html`, `classic/index.html`, `forever/index.html` and `404.html`. Inter-page links use the directory form (`/about/`, `/classic/`, `/forever/`).
- Every path is root-absolute (`/style.css`, `/assets/...`), so the same markup works in any folder and on the 404 page at any URL.
- Only website files belong in the repo: what the site serves, plus `CNAME`, `README.md`, `AGENTS.md`, `.gitattributes`, `.editorconfig`. No notes, plans, mockups or scratch files.
- `CNAME` connects the domain to GitHub Pages. Never delete or rename it.
- Content must work without JavaScript: every page reads in full, the nav shows expanded, every gallery image shows (gallery.js only collapses sections to the first 4) and there are no era filter buttons.

## Shared header and footer

- The skip link, `<header class="site-header">` and `<footer class="site-footer">` are duplicated in all five pages and must stay identical, except `aria-current="page"` on the current page's nav link (none on 404). Change all five together, then run this check in bash from the repo root; it must print `same:` four times:

  ```
  for f in about/index.html classic/index.html forever/index.html 404.html; do diff <(sed -n '/class="skip-link"/p;/<header class="site-header">/,/<\/header>/p;/<footer class="site-footer">/,/<\/footer>/p' index.html | sed 's/ aria-current="page"//') <(sed -n '/class="skip-link"/p;/<header class="site-header">/,/<\/header>/p;/<footer class="site-footer">/,/<\/footer>/p' "$f" | sed 's/ aria-current="page"//') > /dev/null && echo "same: $f" || echo "DIFFERENT: $f"; done
  ```
- The phone nav is a disclosure: `<button class="menu-button" aria-expanded aria-controls="site-nav" hidden>`. script.js unhides it and toggles it (click, Enter/Space; Esc returns focus to the button; a tap outside the header or tabbing out closes it; widening to desktop closes it). Below 1000px the nav folds behind it only under `html.js`, so without JavaScript (and on 404) the nav shows in full.
- script.js is loaded in `<head>` without `defer` so `html.js` is set before first paint. Other scripts use `defer`, except legacy-links.js (see "Old links").
- The desktop header needs about 980px on one row; the Menu breakpoint is 999/1000px. Check those widths if nav items change.

## Content Security Policy

- Every page carries the same `<meta>` CSP: self only, no `'unsafe-inline'`. Changing the policy means changing all five pages together.
- No inline `<script>`, no `style="..."`, no `on*=` handlers. Code goes in `.js`, styles in `style.css`. Setting `element.style.x` from JS is fine.
- Nothing from another origin (CDN, web fonts, embeds). `fetch` is same-origin only (memory-count.js).
- `frame-ancestors` can't be set (a meta CSP ignores it, and Pages can't send headers).

## Gallery

- Classic memories live in `classic/index.html`, Forever memories in `forever/index.html`. Each gallery section is a `.block` with a `.memories` grid of `<div class="memory"><img ...><p>caption</p></div>`. gallery.js, eras.js, lightbox.js and memory-count.js find sections with `.block` and memories with `.memory`; keep those classes.
- Every gallery `<img>`: non-empty `alt`, real `width`/`height` in pixels, `loading="lazy" decoding="async"`.
- Paths are case-sensitive on the live site even when they work locally (Windows). `src` must match the filename's case exactly (spaces as `%20`).
- Era ids are links and must not change: `#vanilla`, `#tbc`, `#wotlk`, `#cataclysm`, `#MoP` on `/classic/`, `#forever` on `/forever/`. The gallery wrapper on Classic is `#memories-block`.
- Filenames become shareable links (`#slug`: lowercased, spaces/underscores to dashes, punctuation removed, extension dropped). Slugs must be unique across their page, including every other id on it; override with `data-slug`. A clash logs a console error and the image gets no link. Renaming a file changes its link unless only the extension changes. Copy link uses the page's `<link rel="canonical">`, so each page needs a correct canonical.
- Load order on Classic is gallery.js, eras.js, lightbox.js (all `defer`): eras.js listens for `gallery:expand` before lightbox.js opens a linked image, so the filter switches to that image's era.
- Era filter counts, the Classic intro total (`[data-memory-total]`) and the `[data-memory-count]` numbers are computed from the DOM or fetched pages. The numbers written in the HTML are the no-JS fallback; memory-count.js keeps them when a page can't be read or has no `.block`.
- Forever placeholder frames sit outside `.memories` and aren't `.memory` elements, so they never count. CSS hides them with `.forever-gallery:has(.memory) .placeholders`. gallery.js and lightbox.js must keep working with zero memories in a section (no "Show all" button, no errors).
- Era banners are CSS backgrounds (`.era-band--<id>` with `var(--band-shade)`): 1920x1080 JPEG, quality 82, progressive, no metadata. Exceptions so far: `assets/tbc.jpg` (1568x769) and the Home hero `assets/yogg.jpg` (1980x697). Keep them small.

## Old links

- legacy-links.js runs in `<head>` on Home only, without `defer`, and on `hashchange`. It sends `#about` to `/about/`, `#forever` to `/forever/`, and every other hash (era ids, `#memories-block`, image slugs) unchanged to `/classic/#hash`, using `location.replace`.
- Ids that exist on Home stay on Home; they're listed in `HOME_IDS`. Every id in `index.html` must be in that list, or links to it leave the page.

## Head and metadata

- Each page has its own `<title>`, description, canonical and `og:url`. `<title>`, `og:title` and `twitter:title` are identical and under 70 characters; write "and", not `&amp;`. The three descriptions are identical too.
- Preview image `assets/og-image.jpg` is 1200x630, on every page.
- The `.ico` favicon link keeps `sizes="32x32"` so Chrome uses the SVG icon for tabs.
- `404.html` uses root-absolute paths, `noindex`, no scripts, and no canonical or `og:url` (Pages serves it at whatever URL was missing).
- `sitemap.xml` lists the four pages. Bump a page's `<lastmod>` when its content changes.

## Markup and accessibility

- Keep the landmarks on every page: `<header>`, `<main id="main" tabindex="-1">`, `<footer>`, `aria-label="Main"` on the nav, and the "Skip to content" link.
- Every `<button>` has a `type`. Era filter buttons use `aria-pressed`.
- Outbound links: `target="_blank" referrerpolicy="no-referrer" rel="noopener noreferrer"`.
- Text over screenshots (heroes, era banners) needs at least 4.5:1 contrast against every pixel behind it (3:1 for large text). Heroes and banners carry a shade for this; check after changing an image or shade.
- Fonts are self-hosted latin-subset variable WOFF2 (`assets/fonts/`: Cinzel, Source Sans 3), both preloaded. Non-Latin text falls back to a system font; add a subset file with `unicode-range` if needed.

## Raid schedule (Home, `#now`)

- The schedule is written in Eastern time in plain HTML (the no-JS fallback), in the Forever card's `<dl class="facts facts--row schedule">`. Each `.schedule__slot` has `data-day` (`sun`…`sat`), `data-start`/`data-end` (24-hour, `24:00` allowed for midnight) and `data-zone="America/New_York"`. The attributes and the visible text must agree.
- raid-times.js converts each slot's next occurrence with `Intl.DateTimeFormat`: it finds the real UTC instant of that Eastern wall-clock time on the actual date, so DST in either zone, local weekday shifts and the midnight end are right. Never hard-code offsets (-5/-4) or assume a fixed difference between zones.
- The "Your time" line (`.schedule__local`) is hidden when the visitor's offsets equal the slot zone's (Toronto counts as Eastern). It repeats the days only when they differ from the Eastern ones; slots whose local times differ in a DST-change week are listed as separate groups. English 12-hour times, en dash between them.
- "Next raid" (`.schedule__next`) stays as the HTML text (TBD) unless the `.schedule` element has `data-raids-start="YYYY-MM-DD"`. The script writes only the value; the label is in the HTML.
- No ticking timers and no live regions: it renders at load and on `visibilitychange`.

## Files and line endings

- All text files are LF (`.gitattributes`). On Windows, `core.autocrlf=true` can make `git status` show phantom modified files; `git add <file>` clears them.
- Temporary files never go in the repo.

## Preview and test

- Preview: `python -m http.server --bind 127.0.0.1` in the repo, open http://localhost:8000. Check all five pages at desktop (~1440px), tablet (~768px) and phone (~390px and 360px) widths. The local server doesn't serve the custom 404; open `/404.html` directly. It also lets the browser cache pages, so hard-reload (Ctrl+Shift+R) after edits.
- Validate: `npx html-validate@8.18.2 index.html about/index.html classic/index.html forever/index.html 404.html` must be clean (no trailing whitespace, raw `&` as `&amp;`, `type` on buttons, title under 70 characters). Run the header/footer sync check too.
- Raid times: set the browser time zone (`Emulation.setTimezoneOverride`) and fake `Date` to check several US zones (including America/Phoenix and Pacific/Honolulu, which don't observe DST) on a winter date, a summer date and a week when US clocks change, plus "Next raid" just before, during and after a raid (set `data-raids-start` and dispatch `visibilitychange`).
- Console: no "Content Security Policy" errors while exercising every feature (Menu, era filter, Show all, viewer, zoom, Copy link, Back to top, old links).
- Deeper checks used for past changes: headless Chrome over the DevTools protocol against the local server; full-page screenshots; CSS rule coverage across all pages, widths and states; `securitypolicyviolation` events; request host audit (self only); axe-core (including with the Menu and the viewer open); contrast sampled under text with the text made transparent (measure the text's own box, not its full-width block). `Page.setBypassCSP` is needed to inject test code.
  - Pitfalls: call `Page.bringToFront` on each tab before scrolling or screenshots, or scroll events, lazy images and captures stall; disable the cache (`Network.setCacheDisabled`) so edits show up; wait for end states, not fixed sleeps; wrap negated expressions as `!(${expr})`; `img.decode()` on a lazy image that never loads hangs, and images in collapsed sections never load; synthetic Enter/Space key events need `text` (`"\r"` or `" "`) or buttons ignore them; Back after a redirect may come from the bfcache with no load event, so wait on `location`, not load; with scripts disabled, page timers don't run.
