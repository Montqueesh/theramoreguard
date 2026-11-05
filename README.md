# The Theramore Guard

The guild website of The Theramore Guard, live at <https://www.theramoreguard.com>.

It's a plain static site with no build step: edit the files by hand and commit. It's hosted on GitHub Pages from the `main` branch, so a change merged to `main` goes live within a minute or two. The `CNAME` file connects the domain to GitHub Pages; don't delete it or rename it, or the domain stops working.

Before changing the site, read [AGENTS.md](AGENTS.md): the rules that keep it working, for people and AI agents alike.

## Pages

| Address | File | What's on it |
| --- | --- | --- |
| `/` | `index.html` | Home: hero, "Where to find us" (the WoW Forever and MoP Classic cards, with the raid schedule), the guild record, three screenshots from the archive, leadership and how to join |
| `/about/` | `about/index.html` | The guild's story, era by era, plus PvP, friends of the Guard and today's leadership |
| `/classic/` | `classic/index.html` | Classic Memories: the gallery from Vanilla through Mists of Pandaria, one section per era, with an era filter |
| `/forever/` | `forever/index.html` | Forever Memories: the WoW Forever gallery and how to add a memory |
| any missing address | `404.html` | "Page not found"; GitHub Pages serves it for any URL that doesn't exist |

Every page has the same header (anchor emblem, guild name, the main nav and a "Join on Discord" button) and the same footer. On phones and other screens narrower than 1000px the nav folds behind a "Menu" button; without JavaScript it simply shows in full.

### The header and footer are copied into every page

There's no build step, so the skip link, `<header>` and `<footer>` are written out in full in each of the five HTML files. When you change one, make the same change in all five. The only difference allowed is `aria-current="page"` on the nav link for the page itself (`404.html` has none).

To check they still match, run this in Git Bash (or any bash) from the repository folder. It should print `same:` four times:

```
for f in about/index.html classic/index.html forever/index.html 404.html; do diff <(sed -n '/class="skip-link"/p;/<header class="site-header">/,/<\/header>/p;/<footer class="site-footer">/,/<\/footer>/p' index.html | sed 's/ aria-current="page"//') <(sed -n '/class="skip-link"/p;/<header class="site-header">/,/<\/header>/p;/<footer class="site-footer">/,/<\/footer>/p' "$f" | sed 's/ aria-current="page"//') > /dev/null && echo "same: $f" || echo "DIFFERENT: $f"; done
```

That check ignores `aria-current`, so it can't tell if a page marks the wrong nav link as the current page. This one can. It should print `ok:` five times (each page except 404 marks exactly one nav link, the one to its own address; 404 marks none):

```
for p in index.html:/ about/index.html:/about/ classic/index.html:/classic/ forever/index.html:/forever/; do f=${p%%:*}; u=${p#*:}; [ "$(grep -o 'aria-current' "$f" | grep -c .)" = 1 ] && sed -n '/<nav class="site-nav"/,/<\/nav>/p' "$f" | grep -qF "<a href=\"$u\" aria-current=\"page\">" && echo "ok: $f" || echo "WRONG: $f"; done; [ "$(grep -c 'aria-current' 404.html)" = 0 ] && echo "ok: 404.html" || echo "WRONG: 404.html"
```

The site check (see "Before you open a PR") runs both of these checks too.

## Files

| Path | What it is |
| --- | --- |
| `style.css` | All styles for every page. Colors, fonts and sizes are custom properties at the top (`:root`) |
| `script.js` | On every page except 404: the phone "Menu" button, the footer's copyright year and the Back to top button |
| `legacy-links.js` | Home only: sends old one-page links (`/#about`, `/#wotlk`, `/#yogg`) to the new pages (see "Old links") |
| `raid-times.js` | Home only: the raid schedule in the visitor's own time zone and, once raids have a start date, the next raid (see "Editing the raid schedule") |
| `launch-note.js` | Home only: hides the "WoW Forever is live" line at the top of "Where to find us" once its `data-until` date (Eastern) arrives. Without JavaScript the line stays, so once the date has passed delete the paragraph, this file, its `<script>` tag and the `.launch-note` rules in `style.css` |
| `memory-count.js` | Home and Forever: keeps the memory counts up to date by counting the memories on `/classic/` and `/forever/` |
| `gallery.js` | Classic and Forever: collapses each gallery section to its first 4 memories behind a "Show all N memories" button |
| `eras.js` | Classic only: the era filter buttons ("All eras", "Vanilla", ...) and era links like `/classic/#wotlk` |
| `lightbox.js` | Classic and Forever: the click-to-enlarge viewer and shareable image links |
| `site.webmanifest` | Name and icons used when someone adds the site to their home screen |
| `assets/vanilla/`, `tbc/`, `wotlk/`, `cataclysm/`, `MoP/`, `forever/` | Gallery screenshots, one folder per expansion (`forever/` for WoW Forever). These are the full-size originals the viewer opens |
| `assets/thumbs/` | Small copies of the gallery screenshots, shown on the gallery cards and Home's archive cards. Same folders and file names as the originals, always `.jpg` (`assets/MoP/sha1.PNG` → `assets/thumbs/MoP/sha1.jpg`) |
| `assets/*.jpg` | Hero art (`yogg.jpg` on Home, `og-vanilla.jpg` on About) and the era banners on Classic (`og-vanilla.jpg`, `tbc.jpg`, `wotlk-bg.jpg`, `cataclysm-bg.jpg`, `mop-bg.jpg`) |
| `assets/og-image.jpg` | Preview image shown when a link to the site is posted in Discord and elsewhere |
| `assets/favicon.ico`, `assets/icons/` | Browser tab and home-screen icons |
| `assets/fonts/` | The site's fonts (Cinzel for headings, Source Sans 3 for text), hosted here instead of on Google, with their licenses in `OFL.txt`. Only the Latin character set is included, so a character outside it (Cyrillic, say) shows in a system font |
| `robots.txt`, `sitemap.xml` | For search engines. The sitemap lists the four pages; update a page's `<lastmod>` date when it changes in a way worth re-crawling |
| `.gitattributes`, `.editorconfig` | Keep line endings as LF (Unix style) and set indents for editors, so files don't show whole-file changes when edited on Windows |
| `.github/scripts/site-check.py`, `.github/workflows/site-check.yml` | The site check and the GitHub Actions workflow that runs it on every pull request (see "Before you open a PR"). Not published on the site |

## Adding a new memory

1. Put the screenshot in the matching expansion folder, for example `assets/MoP/`. Give it a clear, unique filename, because the filename becomes the image's shareable link (see below). Keep it at most 2560 pixels wide (scale larger screenshots down) and strip its metadata (EXIF, GPS, comments) before adding it. This is the original, the full-size picture the viewer opens.
2. Make its thumbnail, the small copy shown on the gallery card. Cards show a 16:9 crop, so the thumbnail is just big enough to fill an 800x450 box, keeping the screenshot's shape: 800 pixels wide for a 16:9 or narrower screenshot, 450 pixels tall for a wider one (a 1900x900 screenshot gets a 950x450 thumbnail). It's never made bigger than the screenshot: one too small to fill the box keeps its own size. JPEG quality 80, progressive, no metadata. Save it in `assets/thumbs/` in the same folder with the same name, ending in `.jpg`: `assets/MoP/garrosh.png` gets `assets/thumbs/MoP/garrosh.jpg`. With the free [ImageMagick](https://imagemagick.org) installed, this command (in PowerShell or Command Prompt, from the repository folder) makes it; change the two paths:

   ```
   magick assets/MoP/garrosh.png -resize "800x450^>" -strip -quality 80 -sampling-factor 4:2:0 -interlace JPEG assets/thumbs/MoP/garrosh.jpg
   ```

   `"800x450^>"` (with the quotes) fills the 800x450 box and only ever shrinks. Never edit or replace the original to make the thumbnail.
3. In `classic/index.html`, find that era's section (for example `<section class="block era" id="MoP" ...>`) and copy one of its `<div class="memory">` blocks. Paste the copy where the new memory should appear in the grid.
4. Change these in the copy:
   - `href` on the `<a>` and `data-full` on the `<img>`: both the path to the original screenshot, starting with `/assets/` and matching the filename's upper and lower case exactly. Write a space in the filename as `%20` (`Hyjal 2.PNG` is `/assets/tbc/Hyjal%202.PNG`).
   - `src`: the path to the thumbnail, `/assets/thumbs/...`, also with exact case (`/assets/thumbs/tbc/Hyjal%202.jpg`).
   - `width` and `height`: the thumbnail's size in pixels, for example `800` and `450`, or `950` and `450` for a wider screenshot (right-click the file > Properties > Details on Windows). The page uses them to keep the image's space reserved while it loads.
   - `alt`: a short description of what the screenshot shows, for screen readers and for when the image can't load.
   - the `<p>` caption shown under the image.

Example, for a new screenshot saved as `assets/MoP/garrosh.png`, with its thumbnail at `assets/thumbs/MoP/garrosh.jpg`:

```html
<div class="memory">
    <a class="memory__link" href="/assets/MoP/garrosh.png"><img src="/assets/thumbs/MoP/garrosh.jpg" data-full="/assets/MoP/garrosh.png" width="800" height="450" alt="Theramore Guard raid gathered around Garrosh Hellscream's body in the Siege of Orgrimmar" loading="lazy" decoding="async"></a>
    <p>Theramore Guard defeats Garrosh Hellscream</p>
</div>
```

Keep `loading="lazy" decoding="async"` on every gallery image so the page loads quickly. The viewer opens the `data-full` original, so names on screen stay sharp; without JavaScript, clicking the card opens the original through the link.

Every memory needs its thumbnail. A bare `<img>` pointing at the original would still show, but the card would load the full-size screenshot and make the page heavier, so the site check rejects it.

That's all. Every count updates itself: the era filter's numbers and the "76 moments" line on Classic, the "Show all N memories" buttons, "Memories in the archive" on Home and the Classic count on Forever. The written numbers in the HTML are only what shows if JavaScript is off or a count can't be read, so it's tidy (but not required) to bump them too: Home's "Memories in the archive" in `index.html` counts Classic and Forever together, while the `76` in `classic/index.html` and in `forever/index.html` (its Classic teaser) counts Classic only.

### Adding a Forever memory

Forever memories go in `forever/index.html`, inside `<section class="block forever-gallery wrap" id="forever">`, in its `<div class="memories">`. Put the screenshots in `assets/forever/` and their thumbnails in `assets/thumbs/forever/`, and use the same `<div class="memory">` block as above, with `href` and `data-full` set to `/assets/forever/your-file.jpg` and `src` to `/assets/thumbs/forever/your-file.jpg`.

Until the first memory, the page shows placeholder frames ("Moments we're waiting to capture"). They hide themselves as soon as one memory is in the grid; you don't need to delete them. With one to four memories there's no "Show all" button; it appears from the fifth.

### Shareable links

Every gallery image gets a link made from its original's filename (the `data-full` path, or `src` if there's no `data-full`; never the thumbnail's): lowercase, spaces and underscores become dashes, other punctuation is removed, and the extension is dropped. For example, `Ragnaros.PNG` becomes <https://www.theramoreguard.com/classic/#ragnaros>, and `Protector Kaolan-N.jpg` becomes `#protector-kaolan-n`. A Forever image gets a `/forever/#...` link. The viewer's "Copy link" button copies it.

Opening a link expands the image's era, switches the era filter to it and opens the image in the viewer.

- Links must be unique across the whole page, not just within one folder. If two images would get the same link, or an image's link matches another id on the page (such as an era's `#cataclysm`, or `#forever` on the Forever page), the second one gets no link and the browser console shows an error naming the image. So a screenshot named `forever.png` needs a `data-slug`.
- To choose a link yourself, add `data-slug` to the `<img>`, for example `data-slug="garrosh-heroic"`.
- Filenames are case-sensitive on the live site: `data-full="/assets/MoP/Garrosh.png"` won't find `garrosh.png`, even if it works on your own computer. That goes for `src`, `data-full` and `href`. Links themselves ignore case.

## Adding a new expansion section

Classic eras run in real-life order on `/classic/`. The examples below add a made-up era called `newexp`.

1. In `classic/index.html`, copy a whole era, from `<section class="block era" id="MoP" ...>` to its closing `</section>`, and paste it in order. Give it a unique `id` (`id="newexp"`), update `aria-labelledby` and the heading's `id` to match (`newexp-title`), set `data-chip` to the short name for its filter button, change the year label, heading and banner line, and replace the memories. The filter button and its count appear by themselves.
2. Change the banner class to `era-band--newexp` (the era's id in lowercase: the `MoP` era uses `era-band--mop`) and add a banner rule to `style.css` next to the others, pointing at a 1920x1080 banner image in `assets/`:

```css
.era-band--newexp {
    background-image: var(--band-shade), url(/assets/newexp-bg.jpg);
}
```

3. Create a folder for its screenshots, such as `assets/newexp/`, and one for their thumbnails, `assets/thumbs/newexp/`.
4. On the About page (`about/index.html`), add a row to the "Our story" timeline linking to `/classic/#newexp`.
5. Update the number of eras written in the text: "6 Eras, Vanilla to Forever" on Home, and "six eras" in the About page's heading and its three description tags (`description`, `og:description`, `twitter:description`).

## Editing the raid schedule

The WoW Forever card on Home (`index.html`, "Where to find us") lists raid nights in Eastern time. That text is what visitors see without JavaScript; with it, `raid-times.js` adds a "Your time" line in the visitor's own time zone (hidden for visitors already on Eastern time). Each raid night is a `<span class="schedule__slot">` with:

- `data-day`: `sun`, `mon`, `tue`, `wed`, `thu`, `fri` or `sat`
- `data-start` and `data-end`: 24-hour Eastern times, for example `21:00` and `24:00` (24:00 means midnight at the end of the night)
- `data-zone="America/New_York"`

To change the schedule, edit both the attributes and the visible text next to them, so they agree. For example, to add Saturday:

```html
<span class="schedule__slot" data-day="sat" data-start="21:00" data-end="24:00" data-zone="America/New_York">Sat</span>
```

The time range below the days (`9:00 PM – 12:00 AM ET`) is shared by all the nights; if a night has different hours, list it with its own range.

"Next raid" shows "TBD" until raids have a start date. Then add `data-raids-start="YYYY-MM-DD"` (an Eastern date) to the `<dl class="facts facts--row schedule">`, and it shows the next raid on or after that date in the visitor's time, or "In progress until ..." during one.

## Old links

Before the redesign the whole site was one page, so links like `/#about`, `/#wotlk` or `/#yogg` are still out there. `legacy-links.js` (on Home only) sends them on: `#about` to `/about/`, `#forever` to `/forever/`, and anything else (era and image links) to the same `#` on `/classic/`. Links to ids that exist on Home, such as `#now`, stay on Home; those ids are listed in lowercase in `HOME_IDS` at the top of the script, so add an id there if you add one to `index.html`. Those checks ignore upper and lower case (`/#NOW` stays on Home, `/#About` goes to `/about/`), but a link sent on to `/classic/` keeps its case, because ids there are case-sensitive (`#MoP`).

## Content Security Policy

Every page carries a Content Security Policy in a `<meta>` tag at the top of `<head>`. It only allows scripts, styles, images, fonts and requests that come from this site itself, so keep these rules when editing:

- No inline `<script>` blocks, `onclick=` style attributes or `style="..."` attributes. Put scripts in `.js` files and styles in `style.css`.
- Don't load anything from another site (a CDN, Google Fonts, an embedded video). If you need to, the policy in all five pages has to be changed deliberately.
- If something stops working after an edit, open the browser's developer console (F12): blocked items are reported there as "Content Security Policy" errors.

## Previewing locally

From the repository folder, run:

```
python -m http.server --bind 127.0.0.1
```

Then open <http://localhost:8000>. Use the local server rather than opening the files directly: the pages use paths that start with `/`, which only work through a server. If a page looks out of date after an edit, reload it with Ctrl+Shift+R, because this simple server lets the browser reuse old copies. It also doesn't show the custom 404 page for missing URLs the way GitHub Pages does; to check that page, open <http://localhost:8000/404.html>.

## Before you open a PR

From the repository folder, run the site check (`python` instead of `python3` on Windows):

```
python3 .github/scripts/site-check.py
```

It checks the shared header and footer, file paths and their case, every memory and thumbnail, the Content Security Policy rules, shareable links, the sitemap and more, and prints one line per problem. Fix every ERROR; a WARNING (a very large image, the launch note's date has come) is a reminder and doesn't fail. GitHub runs the same check, plus html-validate, on every pull request, so a PR shows a failing "site-check" until it's fixed. AGENTS.md ("Site check") lists everything it covers.
