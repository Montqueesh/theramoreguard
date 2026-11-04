// Raid schedule in the visitor's local time.
// The schedule is written on the home page (index.html) in Eastern time, which
// is also what shows without JavaScript. Each ".schedule__slot" carries its raid night:
//   data-day="tue" data-start="21:00" data-end="24:00" data-zone="America/New_York"
// For the next occurrence of each slot this works out the real moment (UTC)
// from that wall-clock time, so daylight saving in either time zone, a raid
// that lands on a different weekday locally and an end at midnight all come
// out right. Nothing ticks: it runs at load and when the tab is shown again.
// "Next raid" (.schedule__next) stays as written (TBD) until the schedule has a
// data-raids-start="YYYY-MM-DD" attribute (an Eastern date); then it shows the
// date and local time of the next raid, or "In progress until ..." during one.
(function () {
  "use strict";

  const schedule = document.querySelector(".schedule");
  if (!schedule || typeof Intl !== "object" || !Intl.DateTimeFormat) return;
  const slotEls = schedule.querySelectorAll(".schedule__slot");
  const localLine = schedule.querySelector(".schedule__local");
  const nextLine = schedule.querySelector(".schedule__next");
  if (!slotEls.length || !localLine || !nextLine) return;

  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_MS = 86400000;
  const nextDefault = nextLine.textContent;

  // Read the slots once; skip (and report) any with malformed attributes.
  const slots = [];
  slotEls.forEach(function (el) {
    const day = DAYS.indexOf((el.dataset.day || "").toLowerCase());
    const start = parseTime(el.dataset.start);
    const end = parseTime(el.dataset.end);
    const zone = el.dataset.zone;
    if (day < 0 || start === null || end === null || !zone || !zoneWorks(zone)) {
      console.error("Raid schedule: bad data attributes on", el);
      return;
    }
    slots.push({ day: day, start: start, end: end, zone: zone });
  });
  if (!slots.length) return;

  // "21:00" -> minutes after midnight; "24:00" is allowed for midnight at the end.
  function parseTime(text) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(text || "");
    if (!m) return null;
    const minutes = Number(m[1]) * 60 + Number(m[2]);
    return Number(m[2]) < 60 && minutes <= 1440 ? minutes : null;
  }

  function zoneWorks(zone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Wall-clock date and time in a time zone at a given instant.
  const partsCache = new Map();
  function wallClock(zone, ms) {
    let fmt = partsCache.get(zone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hourCycle: "h23",
        year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric"
      });
      partsCache.set(zone, fmt);
    }
    const p = {};
    fmt.formatToParts(new Date(ms)).forEach(function (part) {
      p[part.type] = Number(part.value);
    });
    return { y: p.year, mo: p.month, d: p.day, min: (p.hour % 24) * 60 + p.minute };
  }

  // The zone's offset from UTC, in minutes, at a given instant.
  function offsetAt(zone, ms) {
    const w = wallClock(zone, ms);
    const asUtc = Date.UTC(w.y, w.mo - 1, w.d) + w.min * 60000;
    return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
  }

  // The instant when the clock in `zone` reads `minutes` after midnight on the
  // calendar date y-mo-d. Date.UTC rolls 24:00 over into the next day.
  function zonedToUtc(zone, y, mo, d, minutes) {
    const naive = Date.UTC(y, mo - 1, d) + minutes * 60000;
    let ms = naive - offsetAt(zone, naive) * 60000;
    const second = offsetAt(zone, ms);
    ms = naive - second * 60000; // correct when a DST change lies between the two
    return ms;
  }

  // Occurrences of a slot whose raid hasn't ended yet, in date order, starting
  // from the zone's calendar date `fromMs` falls on (one day earlier too, for
  // a raid that began yesterday and is still going).
  function occurrences(slot, fromMs, count) {
    const today = wallClock(slot.zone, fromMs);
    const base = Date.UTC(today.y, today.mo - 1, today.d);
    const found = [];
    for (let k = -1; found.length < count && k < 7 * count + 7; k++) {
      const date = new Date(base + k * DAY_MS);
      if (date.getUTCDay() !== slot.day) continue;
      const y = date.getUTCFullYear();
      const mo = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      const start = zonedToUtc(slot.zone, y, mo, d, slot.start);
      const end = zonedToUtc(slot.zone, y, mo, d, slot.end);
      if (end > fromMs) found.push({ start: start, end: end });
    }
    return found;
  }

  // Formatting: English, 12-hour clock, the visitor's own time zone.
  const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const longDateFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

  function timeOf(ms) {
    return timeFmt.format(new Date(ms));
  }

  // A short zone name: "PT" rather than "PST"/"PDT" where the browser knows
  // one, otherwise its short name ("EST", "GMT+10").
  function zoneName(ms) {
    const generic = namePart(ms, "shortGeneric");
    if (generic && !/\s/.test(generic) && !/^GMT/.test(generic)) return generic;
    return namePart(ms, "short") || "";
  }
  function namePart(ms, style) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: style }).formatToParts(new Date(ms));
      const part = parts.find(function (p) { return p.type === "timeZoneName"; });
      return part ? part.value : "";
    } catch (e) {
      return "";
    }
  }

  // The visitor's clock reads the same as the slot's zone for this raid
  // (Toronto or Detroit for Eastern, say), so a second line would repeat it.
  function sameAsSlotZone(slot, occ) {
    return [occ.start, occ.end].every(function (ms) {
      return offsetAt(slot.zone, ms) === -new Date(ms).getTimezoneOffset();
    });
  }

  function render() {
    const now = Date.now();
    const next = slots.map(function (slot) {
      return occurrences(slot, now, 1)[0];
    });

    // "Your time" line: slots in the order the page lists them, grouped when
    // they share a local time (they don't in a week when the clocks change).
    const local = next.every(function (occ, i) {
      return sameAsSlotZone(slots[i], occ);
    });
    if (local) {
      localLine.hidden = true;
      localLine.textContent = "";
    } else {
      const groups = [];
      let sameDays = true;
      next.forEach(function (occ, i) {
        const range = (timeOf(occ.start) + " – " + timeOf(occ.end) + " " + zoneName(occ.start)).trim();
        const day = weekdayFmt.format(new Date(occ.start));
        if (new Date(occ.start).getDay() !== slots[i].day) sameDays = false;
        const group = groups.find(function (g) { return g.range === range; });
        if (group) group.days.push(day);
        else groups.push({ range: range, days: [day] });
      });
      // Each time range is kept on one line (.schedule__range), as in the HTML.
      // The days are only repeated when they differ from the Eastern ones.
      localLine.textContent = "Your time: ";
      groups.forEach(function (g, i) {
        const range = document.createElement("span");
        range.className = "schedule__range";
        range.textContent = g.range;
        if (groups.length === 1 && sameDays) localLine.append(range);
        else localLine.append((i ? "; " : "") + g.days.join(", ") + " · ", range);
      });
      localLine.hidden = false;
    }

    // "Next raid", once raids have a start date.
    const startDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(schedule.dataset.raidsStart || "");
    if (!startDate) {
      nextLine.textContent = nextDefault;
      return;
    }
    let soonest = null;
    slots.forEach(function (slot) {
      const firstDay = zonedToUtc(slot.zone, Number(startDate[1]), Number(startDate[2]), Number(startDate[3]), 0);
      occurrences(slot, Math.max(now, firstDay), 2).forEach(function (occ) {
        if (occ.start >= firstDay && (!soonest || occ.start < soonest.start)) soonest = occ;
      });
    });
    if (!soonest) {
      nextLine.textContent = nextDefault;
    } else if (soonest.start <= now) {
      nextLine.textContent = "In progress until " + timeOf(soonest.end) + " (your time)";
    } else {
      nextLine.textContent = longDateFmt.format(new Date(soonest.start)) + ", " +
        timeOf(soonest.start) + " (your time)";
    }
  }

  render();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") render();
  });
})();
