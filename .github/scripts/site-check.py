#!/usr/bin/env python3
"""Site check for the Theramore Guard website.

Run from the repository root:

    python3 .github/scripts/site-check.py                   # every check except parity
    python3 .github/scripts/site-check.py --base origin/main  # also check memory parity

Python 3 standard library only. Prints one line per problem, grouped by check,
then a summary. Exits 1 if there is any ERROR; WARNINGs never fail the run.

Checks (AGENTS.md has the rules behind them):
  1. Header/footer sync and aria-current (the two bash checks from AGENTS.md)
  2. Local paths: src, href, data-full, srcset, CSS url(), manifest icons and
     page links resolve to a file with exact case
  3. Gallery memories and Home's archive cards: alt, lazy loading, thumbnail
     path and size, width/height, orphan thumbnails; big-file warnings
  4. CSP hygiene: no inline scripts or styles, no on*= handlers, one identical
     Content-Security-Policy on all five pages
  5. Links and ids: unique shareable slugs, internal #links resolve,
     legacy-links.js targets and HOME_IDS
  6. Memory parity with --base: no memory's shareable link disappears
  7. sitemap.xml, site.webmanifest and robots.txt
  8. No email addresses in tracked files
  9. Reminders: the launch note's data-until date
"Next raid" is not checked: raid-times.js only ever shows raids that haven't
ended, so a past data-raids-start can't show a stale date.
"""

import argparse
import datetime
import difflib
import json
import os
import re
import struct
import subprocess
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = "https://www.theramoreguard.com"

# Page file -> the address it's served at.
PAGES = {
    "index.html": "/",
    "about/index.html": "/about/",
    "classic/index.html": "/classic/",
    "forever/index.html": "/forever/",
    "404.html": "/404.html",
}
GALLERY_PAGES = ["classic/index.html", "forever/index.html"]
SITEMAP_URLS = [SITE + "/", SITE + "/about/", SITE + "/classic/", SITE + "/forever/"]

THUMB_BOX = (800, 450)          # thumbnails just cover this box (AGENTS.md -> Gallery)
ORIGINAL_WARN = 3 * 1024 * 1024  # 3 MB
THUMB_WARN = 200 * 1024          # 200 KB

CHECKS = [
    ("sync", "1. Header/footer sync and aria-current"),
    ("paths", "2. Local paths (exact case)"),
    ("gallery", "3. Gallery memories and thumbnails"),
    ("csp", "4. CSP hygiene"),
    ("links", "5. Shareable links, internal #links and old links"),
    ("parity", "6. Memory parity with the base branch"),
    ("meta", "7. sitemap.xml, site.webmanifest, robots.txt"),
    ("email", "8. No email addresses"),
    ("reminders", "9. Reminders"),
]


# ---------------------------------------------------------------------------
# Reporting

class Report:
    def __init__(self):
        self.items = {key: [] for key, _ in CHECKS}
        self.skipped = {}

    def add(self, check, level, where, message):
        self.items[check].append((level, where, message))

    def error(self, check, where, message):
        self.add(check, "ERROR", where, message)

    def warn(self, check, where, message):
        self.add(check, "WARNING", where, message)

    def skip(self, check, why):
        self.skipped[check] = why

    def count(self, level):
        return sum(1 for items in self.items.values() for item in items if item[0] == level)

    def print(self, elapsed):
        annotate = os.environ.get("GITHUB_ACTIONS") == "true"
        for key, title in CHECKS:
            print(title)
            if key in self.skipped:
                print("   skipped: " + self.skipped[key])
            elif not self.items[key]:
                print("   ok")
            for level, where, message in self.items[key]:
                lines = message.split("\n")
                print("   {} {}: {}".format(level, where, lines[0]))
                for extra in lines[1:]:
                    print("        " + extra)
                if annotate:
                    annotation(level, where, message)
            print()
        errors, warnings = self.count("ERROR"), self.count("WARNING")
        print("Summary: {} error{}, {} warning{} ({:.2f}s)".format(
            errors, "" if errors == 1 else "s", warnings, "" if warnings == 1 else "s", elapsed))
        if errors:
            print("Failed: fix the ERRORs above. WARNINGs alone don't fail the check.")
        else:
            print("Passed." + (" Look at the WARNINGs above." if warnings else ""))


def annotation(level, where, message):
    """GitHub Actions annotation, so problems show on the PR's changed files."""
    kind = "error" if level == "ERROR" else "warning"
    m = re.match(r"^([^:]+?)(?::(\d+))?$", where)
    props = ""
    if m and os.path.exists(os.path.join(ROOT, m.group(1))):
        props = " file=" + m.group(1) + (",line=" + m.group(2) if m.group(2) else "")
    text = message.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    print("::{}{}::{}".format(kind, props, text))


def at(path, line=None):
    return path if line is None else "{}:{}".format(path, line)


# ---------------------------------------------------------------------------
# Files and HTML

def read_text(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def list_files():
    """Every file in the working tree, with its real on-disk case."""
    found = set()
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d != ".git"]
        for name in filenames:
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, "/")
            found.add(rel)
    return found


VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs, line, parent):
        self.tag = tag
        self.attrs = attrs
        self.line = line
        self.parent = parent
        self.children = []
        self.text = []

    def get(self, name, default=None):
        return self.attrs.get(name, default)

    def classes(self):
        return (self.attrs.get("class") or "").split()

    def has_class(self, name):
        return name in self.classes()

    def walk(self):
        for child in self.children:
            yield child
            yield from child.walk()

    def closest(self, pred):
        node = self.parent
        while node is not None:
            if pred(node):
                return node
            node = node.parent
        return None

    def content(self):
        return "".join(self.text)


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#document", {}, 1, None)
        self.stack = [self.root]

    def _node(self, tag, attrs):
        attr_map = {}
        for name, value in attrs:
            attr_map.setdefault(name.lower(), value if value is not None else "")
        node = Node(tag.lower(), attr_map, self.getpos()[0], self.stack[-1])
        node.attr_names = [name.lower() for name, _ in attrs]
        self.stack[-1].children.append(node)
        return node

    def handle_starttag(self, tag, attrs):
        node = self._node(tag, attrs)
        if node.tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self._node(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].text.append(data)


def parse_html(text):
    builder = TreeBuilder()
    builder.feed(text)
    builder.close()
    return builder.root


class Page:
    def __init__(self, rel, text):
        self.rel = rel
        self.url = PAGES.get(rel, "/" + rel)
        self.text = text
        self.lines = text.split("\n")
        self.dom = parse_html(text)
        self.nodes = list(self.dom.walk())

    def ids(self):
        return [(n.get("id"), n.line) for n in self.nodes if n.get("id")]


# ---------------------------------------------------------------------------
# Images

def image_size(path):
    """(kind, width, height) from a PNG or JPEG header, by content, not extension."""
    with open(path, "rb") as f:
        head = f.read(24)
        if head[:8] == b"\x89PNG\r\n\x1a\n" and len(head) >= 24:
            w, h = struct.unpack(">II", head[16:24])
            return "png", w, h
        if head[:2] != b"\xff\xd8":
            return None
        f.seek(2)
        while True:
            byte = f.read(1)
            if not byte:
                return None
            if byte != b"\xff":
                continue
            marker = f.read(1)
            while marker == b"\xff":
                marker = f.read(1)
            if not marker:
                return None
            m = marker[0]
            if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
                continue
            length_bytes = f.read(2)
            if len(length_bytes) < 2:
                return None
            length = struct.unpack(">H", length_bytes)[0]
            if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                data = f.read(5)
                h, w = struct.unpack(">HH", data[1:5])
                return "jpeg", w, h
            f.seek(length - 2, 1)


def cover_size(w, h):
    """Smallest size with the original's shape that covers 800x450; never upscaled."""
    scale = max(THUMB_BOX[0] / w, THUMB_BOX[1] / h)
    if scale >= 1:
        return w, h
    return round(w * scale), round(h * scale)


def mb(n):
    return "{:.1f} MB".format(n / 1024 / 1024)


def kb(n):
    return "{:.0f} KB".format(n / 1024)


# ---------------------------------------------------------------------------
# URLs

SCHEME = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


def local_path(url, base_url):
    """The repo path a local URL points at, or None for external links,
    mailto:, data: and #fragments. Own-domain absolute URLs count as local."""
    url = (url or "").strip()
    if not url or url.startswith("#"):
        return None
    if url.lower().startswith(SITE.lower()):
        url = url[len(SITE):] or "/"
        if not url.startswith("/"):
            return None
    elif SCHEME.match(url) or url.startswith("//"):
        return None
    path = url.split("#", 1)[0].split("?", 1)[0]
    if not path:
        return None
    full = urllib.parse.urljoin(base_url, path)
    rel = urllib.parse.unquote(full).lstrip("/")
    if rel == "" or rel.endswith("/"):
        rel += "index.html"
    return rel


def is_relative(url):
    url = (url or "").strip()
    return bool(url) and not url.startswith(("/", "#")) and not SCHEME.match(url)


def fragment(url):
    if "#" not in url:
        return None
    try:
        return urllib.parse.unquote(url.split("#", 1)[1], errors="strict")
    except UnicodeDecodeError:
        return url.split("#", 1)[1]


class Files:
    def __init__(self):
        self.all = list_files()
        self.lower = {}
        for rel in self.all:
            self.lower.setdefault(rel.lower(), rel)

    def exists(self, rel):
        return rel in self.all

    def problem(self, rel):
        """Why rel isn't a file, or None if it is (exact case)."""
        if rel in self.all:
            return None
        if rel.lower() in self.lower:
            return "wrong case: the file is " + self.lower[rel.lower()]
        if rel + "/index.html" in self.all:
            return "is a folder; link to it with a trailing slash (/" + rel + "/)"
        return "no such file"


# ---------------------------------------------------------------------------
# Shareable links (lightbox.js)

def full_src(img):
    return img.get("data-full") or img.get("src") or ""


def slug_for(img):
    """lightbox.js slugFor(): data-slug, else the original's filename."""
    if img.get("data-slug"):
        return img.get("data-slug").strip().lower()
    last = full_src(img).split("/")[-1]
    try:
        name = urllib.parse.unquote(last, errors="strict")
    except UnicodeDecodeError:
        name = last
    s = re.sub(r"\.[^.]+$", "", name).lower()
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    s = re.sub(r"-+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    return s


def gallery_images(page):
    """Every '.memory img', in document order (what lightbox.js works on)."""
    return [n for n in page.nodes
            if n.tag == "img" and n.closest(lambda a: a.has_class("memory"))]


def gallery_js_ids(page):
    """Ids gallery.js adds before lightbox.js runs: a collapsed grid gets
    '<section id>-memories' if it has no id of its own."""
    ids = []
    for block in page.nodes:
        if not block.has_class("block"):
            continue
        grid = next((n for n in block.walk() if n.has_class("memories")), None)
        if grid is None or grid.get("id"):
            continue
        count = sum(1 for n in grid.walk() if n.has_class("memory"))
        if count > 4:
            ids.append((block.get("id") or "") + "-memories")
    return ids


def page_slugs(page, report=None):
    """slug -> img, applying lightbox.js's collision rule. Reports clashes."""
    taken = {i.lower() for i, _ in page.ids()} | {i.lower() for i in gallery_js_ids(page)}
    slugs = {}
    for img in gallery_images(page):
        slug = slug_for(img)
        if not slug or slug in taken:
            if report is not None:
                what = "an element id" if slug not in slugs else "another image (" + full_src(slugs[slug]) + ")"
                if not slug:
                    report.error("links", at(page.rel, img.line),
                                 'shareable link for {} is empty; give the <img> a data-slug'.format(full_src(img)))
                else:
                    report.error("links", at(page.rel, img.line),
                                 'shareable link "#{}" for {} is already used by {}; the image gets no link. '
                                 'Rename the file or give the <img> a unique data-slug'.format(slug, full_src(img), what))
            continue
        taken.add(slug)
        slugs[slug] = img
    return slugs


# ---------------------------------------------------------------------------
# 1. Header/footer sync and aria-current (ports of the AGENTS.md bash checks)

def sed_extract(lines):
    """sed -n '/class="skip-link"/p;/<header class="site-header">/,/<\\/header>/p;
    /<footer class="site-footer">/,/<\\/footer>/p' | sed 's/ aria-current="page"//'"""
    ranges = [('<header class="site-header">', "</header>"), ('<footer class="site-footer">', "</footer>")]
    active = [False] * len(ranges)
    out = []
    for number, line in enumerate(lines, 1):
        if 'class="skip-link"' in line:
            out.append((number, line))
        for k, (start, end) in enumerate(ranges):
            if not active[k]:
                if start in line:
                    active[k] = True
                    out.append((number, line))
            else:
                out.append((number, line))
                if end in line:
                    active[k] = False
    return [(n, line.replace(' aria-current="page"', "")) for n, line in out]


def sed_range(lines, start, end):
    out, active = [], False
    for line in lines:
        if not active:
            if start in line:
                active = True
                out.append(line)
        else:
            out.append(line)
            if end in line:
                active = False
    return out


def check_sync(pages, report):
    home = sed_extract(pages["index.html"].lines)
    for rel in ["about/index.html", "classic/index.html", "forever/index.html", "404.html"]:
        other = sed_extract(pages[rel].lines)
        a = [line for _, line in home]
        b = [line for _, line in other]
        if a == b:
            continue
        shown = 0
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if tag == "equal":
                continue
            line = other[j1][0] if j1 < len(other) else (other[-1][0] if other else 1)
            home_line = home[i1][0] if i1 < len(home) else (home[-1][0] if home else 1)
            detail = []
            for k in range(i1, min(i2, i1 + 2)):
                detail.append("index.html:{}: {}".format(home[k][0], home[k][1].strip()))
            for k in range(j1, min(j2, j1 + 2)):
                detail.append("{}:{}: {}".format(rel, other[k][0], other[k][1].strip()))
            report.error("sync", at(rel, line),
                         "skip link/header/footer differs from index.html (near index.html:{}); "
                         "they must be identical on all five pages except aria-current\n{}".format(
                             home_line, "\n".join(detail)))
            shown += 1
            if shown == 3:
                break

    for rel, url in [("index.html", "/"), ("about/index.html", "/about/"),
                     ("classic/index.html", "/classic/"), ("forever/index.html", "/forever/")]:
        page = pages[rel]
        count = page.text.count("aria-current")
        where = [n for n, line in enumerate(page.lines, 1) if "aria-current" in line]
        nav = sed_range(page.lines, '<nav class="site-nav"', "</nav>")
        wanted = '<a href="{}" aria-current="page">'.format(url)
        if count != 1:
            report.error("sync", at(rel, where[0] if where else None),
                         'has {} aria-current attributes; it needs exactly one, on the nav link to {} '
                         '(lines: {})'.format(count, url, ", ".join(map(str, where)) or "none"))
        elif not any(wanted in line for line in nav):
            report.error("sync", at(rel, where[0]),
                         'aria-current="page" is not on the nav link to its own page; expected {}'.format(wanted))
    page = pages["404.html"]
    lines = [n for n, line in enumerate(page.lines, 1) if "aria-current" in line]
    if lines:
        report.error("sync", at("404.html", lines[0]), "404.html must have no aria-current")


# ---------------------------------------------------------------------------
# 2. Local paths

URL_ATTRS = ("src", "href", "data-full", "poster")


def check_paths(pages, files, report):
    for rel, page in pages.items():
        for node in page.nodes:
            urls = []
            for name in URL_ATTRS:
                if node.get(name) is not None:
                    urls.append((name, node.get(name)))
            if node.get("srcset"):
                for part in node.get("srcset").split(","):
                    if part.strip():
                        urls.append(("srcset", part.strip().split()[0]))
            if node.tag == "meta" and (node.get("content") or "").lower().startswith(SITE.lower()):
                urls.append(("content", node.get("content")))
            if node.get("data-memory-count") is not None:
                named = node.get("data-memory-count").split() or ["/classic/", "/forever/"]
                urls.extend(("data-memory-count", u) for u in named)
            for name, url in urls:
                if rel == "404.html" and is_relative(url):
                    report.error("paths", at(rel, node.line),
                                 '{}="{}" is relative; 404.html is served at any address, so use a path '
                                 'starting with /'.format(name, url))
                    continue
                target = local_path(url, page.url)
                if target is None:
                    continue
                problem = files.problem(target)
                if problem:
                    report.error("paths", at(rel, node.line), '{}="{}": {}'.format(name, url, problem))

    css = read_text("style.css")
    for number, line in enumerate(css.split("\n"), 1):
        for m in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", line):
            url = m.group(2)
            if url.startswith("data:"):
                continue
            target = local_path(url, "/style.css")
            if target is None:
                continue
            problem = files.problem(target)
            if problem:
                report.error("paths", at("style.css", number), "url({}): {}".format(url, problem))

    try:
        manifest = json.loads(read_text("site.webmanifest"))
    except (ValueError, OSError):
        return  # reported in check 7
    entries = [("start_url", manifest.get("start_url")), ("scope", manifest.get("scope"))]
    for icon in manifest.get("icons") or []:
        if isinstance(icon, dict):
            entries.append(("icons src", icon.get("src")))
    for name, url in entries:
        if not isinstance(url, str):
            continue
        target = local_path(url, "/site.webmanifest")
        if target is None:
            continue
        problem = files.problem(target)
        if problem:
            report.error("paths", "site.webmanifest", '{} "{}": {}'.format(name, url, problem))


# ---------------------------------------------------------------------------
# 3. Gallery memories and thumbnails

def expected_thumb(original):
    """assets/MoP/sha1.PNG -> assets/thumbs/MoP/sha1.jpg"""
    if not original.startswith("assets/") or original.startswith("assets/thumbs/"):
        return None
    stem = re.sub(r"\.[^./]+$", "", original[len("assets/"):])
    return "assets/thumbs/" + stem + ".jpg"


def check_image_attrs(rel, img, report):
    if not (img.get("alt") or "").strip():
        report.error("gallery", at(rel, img.line), "image {} has no alt text".format(img.get("src")))
    if img.get("loading") != "lazy" or img.get("decoding") != "async":
        report.error("gallery", at(rel, img.line),
                     'image {} needs loading="lazy" decoding="async"'.format(img.get("src")))


def check_thumb(rel, img, thumb, original, files, report, checked):
    """thumb and original are repo paths; both must exist. Checks the
    width/height attributes and the cover-800x450 rule."""
    where = at(rel, img.line)
    if not files.exists(thumb):
        return  # reported by the caller or check 2
    info = image_size(os.path.join(ROOT, thumb))
    if info is None or info[0] != "jpeg":
        report.error("gallery", where, "thumbnail {} is not a JPEG".format(thumb))
        return
    _, tw, th = info
    width, height = img.get("width"), img.get("height")
    if width != str(tw) or height != str(th):
        report.error("gallery", where,
                     'width="{}" height="{}" should be the thumbnail\'s real size, width="{}" height="{}" '
                     '({})'.format(width, height, tw, th, thumb))
    if original and files.exists(original):
        oinfo = image_size(os.path.join(ROOT, original))
        if oinfo is None:
            report.error("gallery", where, "original {} is not a PNG or JPEG".format(original))
        else:
            ew, eh = cover_size(oinfo[1], oinfo[2])
            if abs(tw - ew) > 1 or abs(th - eh) > 1:
                report.error("gallery", where,
                             "thumbnail {} is {}x{}; for a {}x{} original it should be {}x{} "
                             '(just covers 800x450, never upscaled: magick ... -resize "800x450^>", '
                             "README.md -> Adding a new memory)".format(
                                 thumb, tw, th, oinfo[1], oinfo[2], ew, eh))
        if original not in checked:
            checked.add(original)
            size = os.path.getsize(os.path.join(ROOT, original))
            if size > ORIGINAL_WARN:
                report.warn("gallery", where, "original {} is {} (over 3 MB); consider scaling it down "
                            "(at most 2560px wide)".format(original, mb(size)))
    if thumb not in checked:
        checked.add(thumb)
        size = os.path.getsize(os.path.join(ROOT, thumb))
        if size > THUMB_WARN:
            report.warn("gallery", where, "thumbnail {} is {} (over 200 KB)".format(thumb, kb(size)))


def check_gallery(pages, files, report):
    used_thumbs = set()
    checked = set()
    for rel in GALLERY_PAGES:
        page = pages[rel]
        for memory in [n for n in page.nodes if n.has_class("memory")]:
            where = at(rel, memory.line)
            if not memory.closest(lambda a: a.has_class("block")):
                report.error("gallery", where, "memory is outside a .block section, so it isn't counted")
            imgs = [n for n in memory.walk() if n.tag == "img"]
            if len(imgs) != 1:
                report.error("gallery", where, "memory has {} images; it needs exactly one".format(len(imgs)))
                continue
            img = imgs[0]
            check_image_attrs(rel, img, report)
            src = img.get("src") or ""
            src_path = local_path(src, page.url)
            if src_path:
                used_thumbs.add(src_path)
            data_full = img.get("data-full")
            if not data_full:
                report.error("gallery", at(rel, img.line),
                             "memory {} has no thumbnail: every memory needs src=\"/assets/thumbs/...jpg\" "
                             "and data-full=\"/assets/...\" (the original) inside <a class=\"memory__link\" "
                             "href=\"ORIGINAL\"> (README.md -> Adding a new memory)".format(src))
                continue
            original = local_path(data_full, page.url)
            link = img.parent
            if link is None or link.tag != "a" or not link.has_class("memory__link"):
                report.error("gallery", at(rel, img.line),
                             'the <img> must sit in <a class="memory__link" href="{}">'.format(data_full))
            elif link.get("href") != data_full:
                report.error("gallery", at(rel, img.line),
                             'link href="{}" must equal data-full="{}"'.format(link.get("href"), data_full))
            if original is None:
                report.error("gallery", at(rel, img.line), 'data-full="{}" is not a local path'.format(data_full))
                continue
            problem = files.problem(original)
            if problem:
                report.error("gallery", at(rel, img.line),
                             'original data-full="{}": {}'.format(data_full, problem))
            thumb = expected_thumb(original)
            if thumb is None:
                report.error("gallery", at(rel, img.line),
                             'data-full="{}" must point at an original under /assets/ (not /assets/thumbs/)'.format(data_full))
                continue
            if src_path != thumb:
                report.error("gallery", at(rel, img.line),
                             'src="{}" should be the thumbnail /{} (same folder and name as the original, '
                             'under assets/thumbs/, ending in .jpg)'.format(src, urllib.parse.quote(thumb)))
                continue
            if files.problem(thumb):
                continue  # a missing or wrong-case src is reported by check 2
            check_thumb(rel, img, thumb, original, files, report, checked)

    # Home's archive cards: thumbnails with no data-full; the original is the
    # file with the same folder and name in assets/.
    home = pages["index.html"]
    for card in [n for n in home.nodes if n.has_class("archive__card")]:
        imgs = [n for n in card.walk() if n.tag == "img"]
        if len(imgs) != 1:
            report.error("gallery", at("index.html", card.line),
                         "archive card has {} images; it needs exactly one".format(len(imgs)))
            continue
        img = imgs[0]
        check_image_attrs("index.html", img, report)
        src = img.get("src") or ""
        thumb = local_path(src, "/")
        if thumb:
            used_thumbs.add(thumb)
        if not thumb or not thumb.startswith("assets/thumbs/") or not thumb.endswith(".jpg"):
            report.error("gallery", at("index.html", img.line),
                         'archive card src="{}" should be a thumbnail in /assets/thumbs/'.format(src))
            continue
        if files.problem(thumb):
            continue  # reported by check 2
        stem = thumb[len("assets/thumbs/"):-len(".jpg")]
        originals = sorted(f for f in files.all
                           if f.startswith("assets/" + stem + ".") and "/" not in f[len("assets/" + stem + "."):])
        if len(originals) != 1:
            report.error("gallery", at("index.html", img.line),
                         "archive card thumbnail {} should match exactly one original assets/{}.*; found {}".format(
                             thumb, stem, ", ".join(originals) or "none"))
            check_thumb("index.html", img, thumb, None, files, report, checked)
            continue
        check_thumb("index.html", img, thumb, originals[0], files, report, checked)
        # The card's link should open this same image.
        frag = fragment(card.get("href") or "")
        fake = Node("img", {"data-full": "/" + originals[0]}, img.line, None)
        if frag is not None and frag.lower() != slug_for(fake):
            report.error("gallery", at("index.html", card.line),
                         'archive card links to "{}" but shows {}, whose link is #{}'.format(
                             card.get("href"), originals[0], slug_for(fake)))

    # Every page reference counts, not only gallery cards.
    for rel, page in pages.items():
        for node in page.nodes:
            for name in ("src", "href", "data-full"):
                target = local_path(node.get(name) or "", page.url)
                if target:
                    used_thumbs.add(target)
    for thumb in sorted(f for f in files.all if f.startswith("assets/thumbs/")):
        if thumb not in used_thumbs:
            report.error("gallery", thumb, "orphan thumbnail: no page uses it; delete it or add its memory")


# ---------------------------------------------------------------------------
# 4. CSP hygiene

def check_csp(pages, report):
    policies = {}
    for rel, page in pages.items():
        for node in page.nodes:
            where = at(rel, node.line)
            if node.tag == "script":
                if not node.get("src"):
                    report.error("csp", where, "inline <script> without src; move the code into a .js file")
                elif node.content().strip():
                    report.error("csp", where, "<script src> with code inside; move the code into the .js file")
            if node.tag == "style":
                report.error("csp", where, "inline <style> block; move the rules into style.css")
            for name in getattr(node, "attr_names", []):
                if name == "style":
                    report.error("csp", where, '<{}> has a style="" attribute; use a class in style.css'.format(node.tag))
                elif name.startswith("on"):
                    report.error("csp", where, "<{}> has an {}= event handler; add the listener in a .js file".format(node.tag, name))
            for name in ("href", "src"):
                if (node.get(name) or "").strip().lower().startswith("javascript:"):
                    report.error("csp", where, '{}="javascript:..." is inline script'.format(name))
        metas = [n for n in page.nodes if n.tag == "meta"
                 and (n.get("http-equiv") or "").lower() == "content-security-policy"]
        if len(metas) != 1:
            report.error("csp", rel, "has {} Content-Security-Policy <meta> tags; it needs exactly one".format(len(metas)))
        else:
            policies[rel] = (metas[0].get("content"), metas[0].line)
    if "index.html" in policies:
        home = policies["index.html"][0]
        for rel, (policy, line) in policies.items():
            if policy != home:
                report.error("csp", at(rel, line),
                             "Content-Security-Policy differs from index.html's; change all five pages together\n"
                             "index.html: {}\n{}: {}".format(home, rel, policy))


# ---------------------------------------------------------------------------
# 5. Shareable links, internal #links and old links

def legacy_rules():
    js = read_text("legacy-links.js")
    m = re.search(r"HOME_IDS\s*=\s*\[(.*?)\]", js, re.S)
    home_ids = re.findall(r"\"([^\"]*)\"", m.group(1)) if m else None
    targets = sorted(set(re.findall(r"\"(/[A-Za-z0-9_-]+/)\"", js)))
    return js, home_ids, targets


def check_links(pages, files, report):
    slugs = {}
    for rel, page in pages.items():
        seen = {}
        for ident, line in page.ids():
            if ident in seen:
                report.error("links", at(rel, line), 'duplicate id="{}" (also on line {})'.format(ident, seen[ident]))
            else:
                seen[ident] = line
    for rel in GALLERY_PAGES:
        slugs[rel] = page_slugs(pages[rel], report)

    # The same shareable link on both gallery pages.
    for slug in sorted(set(slugs[GALLERY_PAGES[0]]) & set(slugs[GALLERY_PAGES[1]])):
        img = slugs[GALLERY_PAGES[1]][slug]
        report.error("links", at(GALLERY_PAGES[1], img.line),
                     'shareable link "#{}" ({}) is also used on /classic/ by {}; give one a data-slug'.format(
                         slug, full_src(img), full_src(slugs[GALLERY_PAGES[0]][slug])))

    _, home_ids, targets = legacy_rules()
    home_ids = home_ids or []

    def found_on(rel, frag):
        page = pages[rel]
        if frag in {i for i, _ in page.ids()}:
            return True
        if rel in slugs and frag.lower() in slugs[rel]:
            return True
        if rel == "classic/index.html" and frag.lower() in {
                (b.get("id") or "").lower() for b in page.nodes if b.has_class("block")}:
            return True  # eras.js matches era links in any case
        return False

    def resolve(rel, frag):
        """Error text for a #fragment on page rel, or None if it lands."""
        if found_on(rel, frag):
            return None
        if rel == "index.html":
            # legacy-links.js sends unknown Home hashes on.
            low = frag.lower()
            if low in home_ids:
                return "no id on Home (it's in HOME_IDS, so the link stays on Home)"
            if low in ("about", "forever"):
                return None
            if found_on("classic/index.html", frag):
                return None
            return "no such id on Home, and legacy-links.js sends it to /classic/#{}, which doesn't exist either".format(frag)
        return "no such id or shareable link on {}".format(PAGES[rel])

    for rel, page in pages.items():
        for node in page.nodes:
            href = node.get("href")
            if node.tag != "a" or not href or "#" not in href:
                continue
            frag = fragment(href)
            if not frag:
                continue
            if href.startswith("#"):
                target = rel
            else:
                path = local_path(href, page.url)
                if path is None or path not in PAGES:
                    continue
                target = path
            problem = resolve(target, frag)
            if problem:
                report.error("links", at(rel, node.line), 'href="{}": {}'.format(href, problem))

    # legacy-links.js: its targets exist, and every Home id is in HOME_IDS.
    if not home_ids:
        report.error("links", "legacy-links.js", "couldn't find the HOME_IDS list")
    for url in targets:
        path = local_path(url, "/")
        problem = files.problem(path)
        if problem or path not in PAGES:
            report.error("links", "legacy-links.js", 'sends old links to "{}", which isn\'t a page ({})'.format(url, problem or "not one of the five pages"))
    for url in ("/about/", "/forever/", "/classic/"):
        if url not in targets:
            report.error("links", "legacy-links.js", 'no longer sends old links to "{}"'.format(url))
    page_ids = {}
    for ident, line in pages["index.html"].ids():
        page_ids.setdefault(ident.lower(), line)
    for ident, line in sorted(page_ids.items(), key=lambda x: x[1]):
        if ident not in home_ids:
            report.error("links", at("index.html", line),
                         'id="{}" is missing from HOME_IDS in legacy-links.js, so /#{} would be sent to '
                         '/classic/'.format(ident, ident))
    for ident in home_ids:
        if ident not in page_ids:
            report.warn("links", "legacy-links.js", 'HOME_IDS lists "{}", which is no longer an id on Home'.format(ident))


# ---------------------------------------------------------------------------
# 6. Memory parity

def git(*args):
    return subprocess.run(["git"] + list(args), cwd=ROOT, capture_output=True, encoding="utf-8", errors="replace")


def check_parity(pages, base, report):
    resolved = git("rev-parse", "--verify", "--quiet", base + "^{commit}")
    if resolved.returncode != 0:
        report.error("parity", "--base", "can't read git ref {}; fetch it first (CI checks out with fetch-depth: 0)".format(base))
        return
    now = set()
    for rel in GALLERY_PAGES:
        now |= {slug_for(img) for img in gallery_images(pages[rel])}
    for rel in GALLERY_PAGES:
        shown = git("show", "{}:{}".format(base, rel))
        if shown.returncode != 0:
            continue  # the page didn't exist at the base
        old = Page(rel, shown.stdout)
        for img in gallery_images(old):
            slug = slug_for(img)
            if slug and slug not in now:
                memory = img.closest(lambda a: a.has_class("memory"))
                caption = next((n.content().strip() for n in memory.walk() if n.tag == "p"), "") if memory else ""
                report.error("parity", "{} (at {}, line {})".format(rel, base, img.line),
                             'memory #{} ({}{}) is gone from both /classic/ and /forever/, so its link {}#{} '
                             'stops working.\nReviewer: confirm this removal (or rename) is on purpose before '
                             'merging.'.format(slug, full_src(img), ', "' + caption + '"' if caption else "",
                                               SITE + PAGES[rel], slug))


# ---------------------------------------------------------------------------
# 7. sitemap.xml, site.webmanifest, robots.txt

def check_meta(files, report):
    try:
        tree = ET.fromstring(read_text("sitemap.xml").encode("utf-8"))
    except (ET.ParseError, OSError) as e:
        report.error("meta", "sitemap.xml", "doesn't parse as XML: {}".format(e))
        tree = None
    if tree is not None:
        ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        if tree.tag != ns + "urlset":
            report.error("meta", "sitemap.xml", "root element should be <urlset> in the sitemaps.org namespace")
        locs = []
        for url in tree.findall(ns + "url"):
            loc = (url.findtext(ns + "loc") or "").strip()
            locs.append(loc)
            lastmod = url.findtext(ns + "lastmod")
            if lastmod is not None:
                try:
                    datetime.date.fromisoformat(lastmod.strip())
                except ValueError:
                    report.error("meta", "sitemap.xml", '<lastmod>{}</lastmod> for {} isn\'t a YYYY-MM-DD date'.format(lastmod, loc))
        for loc in locs:
            if loc not in SITEMAP_URLS:
                report.error("meta", "sitemap.xml", "lists {}, which isn't one of the four pages ({})".format(loc, ", ".join(SITEMAP_URLS)))
            elif locs.count(loc) > 1:
                report.error("meta", "sitemap.xml", "lists {} more than once".format(loc))
        for url in SITEMAP_URLS:
            if url not in locs:
                report.error("meta", "sitemap.xml", "doesn't list {}".format(url))
    try:
        manifest = json.loads(read_text("site.webmanifest"))
        if not isinstance(manifest, dict):
            report.error("meta", "site.webmanifest", "should be a JSON object")
    except ValueError as e:
        report.error("meta", "site.webmanifest", "isn't valid JSON: {}".format(e))
    except OSError:
        report.error("meta", "site.webmanifest", "is missing")
    try:
        robots = read_text("robots.txt")
    except OSError:
        report.error("meta", "robots.txt", "is missing")
        robots = ""
    sitemaps = [m.group(1) for m in re.finditer(r"(?im)^\s*sitemap:\s*(\S+)", robots)]
    if SITE + "/sitemap.xml" not in sitemaps:
        report.error("meta", "robots.txt", "should have the line: Sitemap: {}/sitemap.xml".format(SITE))


# ---------------------------------------------------------------------------
# 8. No email addresses

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.([A-Za-z]{2,})\b")
NOT_TLDS = {"png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico", "css", "js", "html", "woff", "woff2"}


def tracked_files():
    listed = git("ls-files", "-z")
    if listed.returncode != 0:
        return sorted(list_files())
    return sorted(f for f in listed.stdout.split("\0") if f)


def served(rel):
    # GitHub Pages builds with Jekyll here (no .nojekyll), which skips dot paths.
    return not any(part.startswith(".") for part in rel.split("/"))


def check_email(report):
    for rel in tracked_files():
        path = os.path.join(ROOT, rel)
        if not os.path.isfile(path):
            continue
        with open(path, "rb") as f:
            data = f.read()
        if b"\0" in data[:8192]:
            continue  # binary
        text = data.decode("utf-8", errors="replace")
        for number, line in enumerate(text.split("\n"), 1):
            for m in EMAIL.finditer(line):
                if m.group(1).lower() in NOT_TLDS:
                    continue
                address = m.group(0)
                if "noreply" in address.lower() and not served(rel):
                    continue
                report.error("email", at(rel, number),
                             "email address {}; remove it{}".format(
                                 address, " (this file is published on the site)" if served(rel) else ""))


# ---------------------------------------------------------------------------
# 9. Reminders

def eastern_today():
    """Today's date in US Eastern time (launch-note.js compares with this)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("America/New_York")).date()
    except Exception:
        pass
    # No time zone database (e.g. Windows without tzdata): the US rule since
    # 2007, DST from 2:00 on the second Sunday of March to 2:00 on the first
    # Sunday of November.
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    def sunday(year, month, n):
        first = datetime.datetime(year, month, 1)
        return first + datetime.timedelta(days=(6 - first.weekday()) % 7 + 7 * (n - 1))

    start = sunday(now.year, 3, 2) + datetime.timedelta(hours=7)   # 2:00 EST
    end = sunday(now.year, 11, 1) + datetime.timedelta(hours=6)    # 2:00 EDT
    offset = -4 if start <= now < end else -5
    return (now + datetime.timedelta(hours=offset)).date()


def check_reminders(pages, today, report):
    for node in pages["index.html"].nodes:
        if not node.has_class("launch-note") or node.get("data-until") is None:
            continue
        until = node.get("data-until")
        try:
            date = datetime.date.fromisoformat(until)
        except ValueError:
            report.warn("reminders", at("index.html", node.line), 'launch note data-until="{}" isn\'t a YYYY-MM-DD date'.format(until))
            continue
        if today >= date:
            report.warn("reminders", at("index.html", node.line),
                        "the launch note's data-until date ({}) has come (today is {} Eastern). Visitors without "
                        "JavaScript still see it: remove the paragraph, launch-note.js, its <script> tag, the "
                        ".launch-note rules in style.css and the README/AGENTS notes (AGENTS.md -> Raid "
                        "schedule), and bump Home's sitemap lastmod".format(until, today))


# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Check the Theramore Guard website before a PR.")
    parser.add_argument("--base", metavar="REF",
                        help="git ref to compare memories with (e.g. origin/main); enables check 6")
    parser.add_argument("--today", metavar="YYYY-MM-DD", type=datetime.date.fromisoformat,
                        help="pretend today (Eastern) is this date, for the reminders")
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    started = time.perf_counter()
    report = Report()

    files = Files()
    pages = {}
    for rel in PAGES:
        try:
            pages[rel] = Page(rel, read_text(rel))
        except OSError as e:
            print("Can't read {}: {}. Run this from the repository.".format(rel, e))
            return 1

    print("Theramore Guard site check" + (" (memory parity against {})".format(args.base) if args.base else ""))
    print()
    check_sync(pages, report)
    check_paths(pages, files, report)
    check_gallery(pages, files, report)
    check_csp(pages, report)
    check_links(pages, files, report)
    if args.base:
        check_parity(pages, args.base, report)
    else:
        report.skip("parity", "run with --base <git ref> (CI does on pull requests)")
    check_meta(files, report)
    check_email(report)
    check_reminders(pages, args.today or eastern_today(), report)

    report.print(time.perf_counter() - started)
    return 1 if report.count("ERROR") else 0


if __name__ == "__main__":
    sys.exit(main())
