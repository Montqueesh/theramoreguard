# The Theramore Guard

The guild website of The Theramore Guard, live at <https://www.theramoreguard.com>.

It's a plain static site with no build step: edit the files by hand and commit. It's hosted on GitHub Pages from the `main` branch, so a change merged to `main` goes live within a minute or two. The `CNAME` file connects the domain to GitHub Pages; don't delete it or rename it, or the domain stops working.

Before changing the site, read [AGENTS.md](AGENTS.md): the rules that keep it working, for people and AI agents alike.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole site: header, "The Theramore Guard Today" (`#now`, the current Forever and MoP details and raid schedule), About, and the gallery sections, grouped under "Classic Memories" and "Forever Memories" |
| `style.css` | All styles, including each section's banner image |
| `script.js` | Back-to-top button, the footer's copyright year and the "Guild Memories" dropdown (a button that opens the expansion links) |
| `gallery.js` | Collapsible gallery sections ("Show all N memories") |
| `raid-times.js` | Shows the raid schedule in the visitor's own time zone and, once raids have a start date, the next raid (see "Editing the raid schedule") |
| `lightbox.js` | Click-to-enlarge viewer and shareable image links |
| `404.html` | The "page not found" page; GitHub Pages serves it for any missing URL |
| `site.webmanifest` | Name and icons used when someone adds the site to their home screen |
| `assets/vanilla/`, `tbc/`, `wotlk/`, `cataclysm/`, `MoP/` | Gallery screenshots, one folder per expansion. WoW Forever's folder, `assets/forever/`, is created with its first memory |
| `assets/*.jpg` | Header art (`yogg.jpg`), the About background (`dargons.jpg`) and the section banners (`og-vanilla.jpg`, `tbc.jpg`, `wotlk-bg.jpg`, `cataclysm-bg.jpg`, `mop-bg.jpg`) |
| `assets/og-image.jpg` | Preview image shown when the site's link is posted in Discord and elsewhere |
| `assets/favicon.ico`, `assets/icons/` | Browser tab and home-screen icons |
| `assets/fonts/` | The site's fonts (Playfair Display and Roboto), hosted here instead of on Google, with their license in `OFL.txt`. Only the Latin character set is included, so a character outside it (Cyrillic, say) shows in a system font |
| `robots.txt`, `sitemap.xml` | For search engines. The sitemap lists only the home page; update its `<lastmod>` date when the page changes in a way worth re-crawling |
| `.gitattributes`, `.editorconfig` | Keep line endings as LF (Unix style) and set indents for editors, so files don't show whole-file changes when edited on Windows |

## Adding a new memory

1. Put the screenshot in the matching expansion folder, for example `assets/MoP/`. Give it a clear, unique filename, because the filename becomes the image's shareable link (see below).
2. In `index.html`, find that expansion's section (for example `<div class="MoP block" id="MoP">`) and copy one of its `<div class="memory">` blocks. Paste the copy where the new memory should appear in the grid.
3. Change these in the copy:
   - `src`: the path to your screenshot, matching the filename's upper and lower case exactly.
   - `width` and `height`: the screenshot's size in pixels, for example `1600` and `900` (right-click the file > Properties > Details on Windows). The page uses them to keep the image's space reserved while it loads.
   - `alt`: a short description of what the screenshot shows, for screen readers and for when the image can't load.
   - the `<p>` caption shown under the image.

Example, for a new screenshot saved as `assets/MoP/garrosh.jpg`:

```html
<div class="memory">
    <img src="assets/MoP/garrosh.jpg" width="1600" height="900" alt="Theramore Guard raid gathered around Garrosh Hellscream's body in the Siege of Orgrimmar" loading="lazy" decoding="async">
    <p>Theramore Guard defeats Garrosh Hellscream</p>
</div>
```

Keep `loading="lazy" decoding="async"` on every gallery image so the page loads quickly.

That's all. The "Show all N memories" count and the viewer pick up the new memory automatically, with no other edits.

### Adding the first Forever memory

The WoW Forever section (`<div class="forever block" id="forever">`) starts with no memories, just a placeholder line ("Our first Forever memories are coming soon…"). To add the first one:

1. Create the folder `assets/forever/` and put the screenshot in it.
2. In that section's `<div class="memories container">`, delete the placeholder `<p class="memories-empty">` (and the comment above it), and paste in a `<div class="memory">` block as described above, with `src="assets/forever/your-file.jpg"`. (If you forget to delete the placeholder, it hides itself once a memory sits next to it, but it's tidier gone.)
3. Optionally give the section a banner: see step 4 of "Adding a new expansion section" and replace the `.forever` rule in `style.css`.

With one to four memories there's no "Show all" button; it appears from the fifth.

### Shareable links

Every gallery image gets a link made from its filename: lowercase, spaces and underscores become dashes, other punctuation is removed, and the extension is dropped. For example, `Ragnaros.PNG` becomes <https://www.theramoreguard.com/#ragnaros>, and `Protector Kaolan-N.jpg` becomes `#protector-kaolan-n`. The viewer's "Copy link" button copies it.

- Links must be unique across the whole page, not just within one folder. If two images would get the same link, or an image's link matches another id on the page (such as a section's `#cataclysm`, `#forever` or `#now`), the second one gets no link and the browser console shows an error naming the image. So a screenshot named `forever.png` needs a `data-slug`.
- To choose a link yourself, add `data-slug` to the `<img>`, for example `data-slug="garrosh-heroic"`.
- Filenames are case-sensitive on the live site: `src="assets/MoP/Garrosh.jpg"` won't find `garrosh.jpg`, even if it works on your own computer. Links themselves ignore case.

## Adding a new expansion section

The gallery is in two groups, each starting with an `<h2 class="memories-group">` heading: "Classic Memories" (Vanilla through Mists of Pandaria) and "Forever Memories" (WoW Forever). Sections run in real-life order. The examples below add a made-up section called `newexp`.

1. In `index.html`, copy a whole section, from `<div class="MoP block" id="MoP">` to its closing `</div>`, and paste it at the right place in its group: a Classic section before the "Forever Memories" heading, a Forever one after the WoW Forever section. Give it a new class and a unique `id` (for example `class="newexp block" id="newexp"`), change the `<h3>` heading, and replace the memories. Section headings are `<h3>` (the group headings are the `<h2>`s); they look the same as before.
2. Add a nav link for it in the matching group of the "Guild Memories" menu near the top of `index.html`. Each group is a `<li class="subnav-group">` with a plain-text label (`<span class="subnav-label">`) and its own `<ul>`; put the link inside that `<ul>`:
   `<li><a href="#newexp" class="subnav">New Expansion</a></li>`
3. Create a folder for its screenshots, such as `assets/newexp/`.
4. Add a banner rule to `style.css` next to the others, pointing at a banner image in `assets/` (a section can also start without one, like `.forever`, which has a dark gradient until it gets a banner):

```css
.newexp {
    background: linear-gradient(to bottom, #00000099 70%, #000000), url(assets/newexp-bg.jpg);
    background-size: cover;
    background-position: center;
}
```

## Editing the raid schedule

The WoW Forever card in "The Theramore Guard Today" lists raid nights in Eastern time. That text is what visitors see without JavaScript; with it, `raid-times.js` adds a "Your time" line in the visitor's own time zone (hidden for visitors already on Eastern time). Each raid night is a `<span class="schedule__slot">` with:

- `data-day`: `sun`, `mon`, `tue`, `wed`, `thu`, `fri` or `sat`
- `data-start` and `data-end`: 24-hour Eastern times, for example `21:00` and `24:00` (24:00 means midnight at the end of the night)
- `data-zone="America/New_York"`

To change the schedule, edit both the attributes and the visible text next to them, so they agree. For example, to add Saturday 8 PM to 11 PM:

```html
<span class="schedule__slot" data-day="sat" data-start="20:00" data-end="23:00" data-zone="America/New_York">Sat</span>
```

and update the visible line (for example "Tue, Thu, Sun · 9:00 PM to 12:00 AM ET; Sat · 8:00 PM to 11:00 PM ET").

"Next raid: TBD" stays until raids have a start date. Then add `data-raids-start="YYYY-MM-DD"` (an Eastern date) to the `<dd class="schedule">`, and the line shows the next raid on or after that date in the visitor's time, or "Raid in progress" during one.

## Content Security Policy

Both pages carry a Content Security Policy in a `<meta>` tag at the top of `<head>`. It only allows scripts, styles, images, fonts and requests that come from this site itself, so keep these rules when editing:

- No inline `<script>` blocks, `onclick=` style attributes or `style="..."` attributes. Put scripts in `.js` files and styles in `style.css`.
- Don't load anything from another site (a CDN, Google Fonts, an embedded video). If you need to, the policy in both pages has to be changed deliberately.
- If something stops working after an edit, open the browser's developer console (F12): blocked items are reported there as "Content Security Policy" errors.

## Previewing locally

From the repository folder, run:

```
python -m http.server
```

Then open <http://localhost:8000>. Opening `index.html` straight from your file browser mostly works too, but shareable links behave best through a local server. This simple server doesn't show the custom 404 page for missing URLs the way GitHub Pages does; to check that page, open <http://localhost:8000/404.html>.
