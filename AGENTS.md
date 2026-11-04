# AGENTS.md

Invariants for anyone (human or agent) changing this site. The maintainer guide is README.md; this file lists the rules that keep the site working.

## Shape

- Plain static site, no build step, no frameworks, libraries or CDNs. Everything must stay editable by hand.
- Only website files belong in the repo: what the site serves, plus `CNAME`, `README.md`, `AGENTS.md`, `.gitattributes`, `.editorconfig`. No notes, plans or scratch files.
- `CNAME` connects the domain to GitHub Pages. Never delete or rename it.
- Content must work without JavaScript: with JS off, every gallery image shows (gallery.js only collapses sections to the first 4).

## Content Security Policy

- Both pages carry a `<meta>` CSP: self only, no `'unsafe-inline'`.
- No inline `<script>`, no `style="..."`, no `on*=` handlers. Code goes in `.js`, styles in `style.css`. Setting `element.style.x` from JS is fine.
- Nothing from another origin (CDN, web fonts, embeds). Changing the policy means changing `index.html` and `404.html` together.
- `frame-ancestors` can't be set (a meta CSP ignores it, and Pages can't send headers).

## Gallery

- Every gallery `<img>`: non-empty `alt`, real `width`/`height` in pixels, `loading="lazy" decoding="async"`.
- Paths are case-sensitive on the live site even when they work locally (Windows). `src` must match the filename's case exactly.
- Filenames become shareable links (`#slug`: lowercased, spaces/underscores to dashes, punctuation removed, extension dropped). Slugs must be unique across the page, including section ids; override with `data-slug`. A clash logs a console error and the image gets no link. Renaming a file changes its link unless only the extension changes.
- The gallery is grouped: `<h2 class="memories-group">` headings ("Classic Memories", "Forever Memories") sit inside `#memories-block` but outside every `.block`, and section headings are `<h3>` styled to look like the old `<h2>`s. Keep group headings out of `.block`, because gallery.js and lightbox.js scope sections with `closest(".block")`.
- `#forever` exists before it has memories. Its grid holds a `<p class="memories-empty">` placeholder, which CSS hides once a `.memory` sits next to it. gallery.js and lightbox.js must keep working with zero memories in a section (no "Show all" button, no errors).
- Section banners are CSS backgrounds: 1920x1080 JPEG, quality 82, progressive, no metadata. Exceptions so far: `assets/tbc.jpg` (1568x769) and the header `assets/yogg.jpg` (1980x697). Banners for every section load on first paint, so keep them small.

## Head and metadata

- `<title>`, `og:title` and `twitter:title` are identical and under 70 characters; write "and", not `&amp;`. The three descriptions are identical too.
- Preview image `assets/og-image.jpg` is 1200x630.
- The `.ico` favicon link keeps `sizes="32x32"` so Chrome uses the SVG icon for tabs.
- `404.html` uses root-absolute paths, `noindex`, and no scripts.
- Bump `sitemap.xml` `<lastmod>` when page content changes. It lists only the home page.

## Markup and accessibility

- Keep the landmarks: `<header>`, `<main id="main">`, `<footer>`, `aria-label="Main"` on the nav, and the "Skip to content" link, on both pages.
- Every `<button>` has a `type`. The "Guild Memories" menu is a real toggle button (click, Enter/Space; Esc, outside click, choosing a link or tabbing out close it). On touch phones the open menu sits below the whole nav so it can't cover the Discord link.
- The menu has two groups, "Classic" and "Forever": each a `<li class="subnav-group">` with a plain-text `<span class="subnav-label">` (never a link) and a nested `<ul aria-labelledby>`. The dropdown CSS targets only `.header nav>ul>li>ul`, so the nested lists stay plain; a selector like `.header nav li ul` would style them as dropdowns too. `.header nav ul` sets `font-size: 0`, so labels need their own size.
- The header stacks below 1220px wide (the nav no longer fits beside the logo below about 1206px). Check that width if nav items change.
- Outbound links: `target="_blank" referrerpolicy="no-referrer" rel="noopener noreferrer"`.
- Fonts are self-hosted latin-subset variable WOFF2 (`assets/fonts/`). Non-Latin text falls back to a system font; add a subset file with `unicode-range` if needed.

## Raid schedule (`#now`)

- The schedule is written in Eastern time in plain HTML (the no-JS fallback). Each `.schedule__slot` has `data-day` (`sun`…`sat`), `data-start`/`data-end` (24-hour, `24:00` allowed for midnight) and `data-zone="America/New_York"`. The attributes and the visible text must agree.
- raid-times.js converts each slot's next occurrence with `Intl.DateTimeFormat`: it finds the real UTC instant of that Eastern wall-clock time on the actual date, so DST in either zone, local weekday shifts and the midnight end are right. Never hard-code offsets (-5/-4) or assume a fixed difference between zones.
- The "Your time" line is hidden when the visitor's offsets equal the slot zone's (Toronto counts as Eastern); slots whose local times differ in a DST-change week are listed as separate groups. English 12-hour times.
- "Next raid" stays as the HTML text (TBD) unless the `.schedule` element has `data-raids-start="YYYY-MM-DD"`.
- No ticking timers and no live regions: it renders at load and on `visibilitychange`.

## Files and line endings

- All text files are LF (`.gitattributes`). On Windows, `core.autocrlf=true` can make `git status` show phantom modified files; `git add <file>` clears them.
- Temporary files never go in the repo.

## Preview and test

- Preview: `python -m http.server --bind 127.0.0.1` in the repo, open http://localhost:8000. Check desktop (~1440px) and phone (~390px) widths. The local server doesn't serve the custom 404; open `/404.html` directly.
- Validate: `npx html-validate@8.18.2 index.html 404.html` must be clean (no trailing whitespace, raw `&` as `&amp;`, `type` on buttons, title under 70 characters).
- Raid times: set the browser time zone (`Emulation.setTimezoneOverride`) and fake `Date` to check several US zones (including America/Phoenix and Pacific/Honolulu, which don't observe DST) on a winter date, a summer date and a week when US clocks change, plus "Next raid" just before, during and after a raid (set `data-raids-start` and dispatch `visibilitychange`).
- Console: no "Content Security Policy" errors while exercising every feature (menu, Show all, viewer, zoom, Copy link, Back to top).
- Deeper checks used for past changes: headless Chrome over the DevTools protocol against the local server; full-page screenshots vs a baseline (JPEG decode noise up to ~9 levels is normal); computed-style fingerprints at several widths for CSS refactors; CSS coverage; `securitypolicyviolation` events; request host audit (self only); axe-core; contrast sampled under text with the text made transparent. `Page.setBypassCSP` is needed to inject test code.
  - When text changes reflow the page, compare section by section (header, `#about`, each `.block`, footer) against `main` extracted with `git archive main | tar -x -C <scratch>/main-src`.
  - Pitfalls: call `Page.bringToFront` on each new tab or scroll events and transitions stall; wait for end states, not fixed sleeps (nav menu 0.3 s transition, lightbox 0.2 s fade); wrap negated expressions as `!(${expr})`; `img.decode()` on a lazy image that never loads hangs; synthetic Enter/Space key events need `text` (`"\r"` or `" "`) or buttons ignore them; `#forever` is the last section, so its link scrolls to the page bottom rather than putting the section at the top.
