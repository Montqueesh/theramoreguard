# The Theramore Guard

The guild website of The Theramore Guard, live at <https://www.theramoreguard.com>.

It's a plain static site with no build step: edit the files by hand and commit. It's hosted on GitHub Pages from the `main` branch, so a change merged to `main` goes live within a minute or two. The `CNAME` file connects the domain to GitHub Pages; don't delete it or rename it, or the domain stops working.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole site: header, About, and one gallery section per expansion |
| `style.css` | All styles, including each section's banner image |
| `script.js` | Back-to-top button, the footer's copyright year and the "Guild Memories" dropdown (a button that opens the expansion links) |
| `gallery.js` | Collapsible gallery sections ("Show all N memories") |
| `lightbox.js` | Click-to-enlarge viewer and shareable image links |
| `404.html` | The "page not found" page; GitHub Pages serves it for any missing URL |
| `site.webmanifest` | Name and icons used when someone adds the site to their home screen |
| `assets/vanilla/`, `tbc/`, `wotlk/`, `cataclysm/`, `MoP/` | Gallery screenshots, one folder per expansion |
| `assets/*.jpg` | Header art (`yogg.jpg`), the About background (`dargons.jpg`) and the section banners (`og-vanilla.jpg`, `tbc.jpg`, `wotlk-bg.jpg`, `cataclysm-bg.jpg`, `mop-bg.jpg`) |
| `assets/og-image.jpg` | Preview image shown when the site's link is posted in Discord and elsewhere |
| `assets/favicon.ico`, `assets/icons/` | Browser tab and home-screen icons |

## Adding a new memory

1. Put the screenshot in the matching expansion folder, for example `assets/MoP/`. Give it a clear, unique filename, because the filename becomes the image's shareable link (see below).
2. In `index.html`, find that expansion's section (for example `<div class="MoP block" id="MoP">`) and copy one of its `<div class="memory">` blocks. Paste the copy where the new memory should appear in the grid.
3. Change three things in the copy:
   - `src`: the path to your screenshot, matching the filename's upper and lower case exactly.
   - `alt`: a short description of what the screenshot shows, for screen readers and for when the image can't load.
   - the `<p>` caption shown under the image.

Example, for a new screenshot saved as `assets/MoP/garrosh.jpg`:

```html
<div class="memory">
    <img src="assets/MoP/garrosh.jpg" alt="Theramore Guard raid gathered around Garrosh Hellscream's body in the Siege of Orgrimmar" loading="lazy" decoding="async">
    <p>Theramore Guard defeats Garrosh Hellscream</p>
</div>
```

Keep `loading="lazy" decoding="async"` on every gallery image so the page loads quickly.

That's all. The "Show all N memories" count and the viewer pick up the new memory automatically, with no other edits.

### Shareable links

Every gallery image gets a link made from its filename: lowercase, spaces and underscores become dashes, other punctuation is removed, and the extension is dropped. For example, `Ragnaros.PNG` becomes <https://www.theramoreguard.com/#ragnaros>, and `Protector Kaolan-N.jpg` becomes `#protector-kaolan-n`. The viewer's "Copy link" button copies it.

- Links must be unique across the whole page, not just within one folder. If two images would get the same link, or an image's link matches another id on the page (such as a section's `#cataclysm`), the second one gets no link and the browser console shows an error naming the image.
- To choose a link yourself, add `data-slug` to the `<img>`, for example `data-slug="garrosh-heroic"`.
- Filenames are case-sensitive on the live site: `src="assets/MoP/Garrosh.jpg"` won't find `garrosh.jpg`, even if it works on your own computer. Links themselves ignore case.

## Adding a new expansion section

The examples below add a WoW Forever section.

1. In `index.html`, copy a whole section, from `<div class="MoP block" id="MoP">` to its closing `</div>`, and paste it after the last section. Give it a new class and a unique `id` (for example `class="forever block" id="forever"`), change the `<h2>` heading, and replace the memories.
2. Add a nav link for it in the "Guild Memories" menu near the top of `index.html`:
   `<li><a href="#forever" class="subnav">WoW Forever</a></li>`
3. Create a folder for its screenshots, such as `assets/forever/`.
4. Add a banner rule to `style.css` next to the others, pointing at a banner image in `assets/`:

```css
.forever {
    background: linear-gradient(to bottom, #00000099 70%, #000000), url(assets/forever-bg.jpg);
    background-size: cover;
    background-position: center;
}
```

## Previewing locally

From the repository folder, run:

```
python -m http.server
```

Then open <http://localhost:8000>. Opening `index.html` straight from your file browser mostly works too, but shareable links behave best through a local server. This simple server doesn't show the custom 404 page for missing URLs the way GitHub Pages does; to check that page, open <http://localhost:8000/404.html>.
