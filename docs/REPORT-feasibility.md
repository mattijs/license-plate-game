## Colorado License Plate Spotter — Feasibility Report

### The Data: 218+ designs, publicly available

Colorado has 218 license plate designs, and the Colorado DMV publishes every single one on their public website at `dmv.colorado.gov/license-plates` and sub-pages (group special, military, alumni, historical, etc.). This is your primary data source — and it's excellent news.

**The DMV pages are well-structured HTML.** Each plate entry has:
- A plate image served from `dmv.colorado.gov/sites/dmv/files/...`
- A plate name (the `<dt>` heading)
- A description block with category, fees, availability info

The images are publicly accessible JPEGs/PNGs served directly from the DMV CDN — no login, no API key. The slogan/tagline text on each plate is embedded in the description text on each page.

**Categories to scrape across multiple pages:**
- Standard plates (`/standard-license-plates`)
- Group special plates (`/group-special-license-plates-new`) — ~100+ entries, A–Z
- Military/veteran plates (`/license-plates-military`)
- Alumni/university plates
- Historical plates

### Image sourcing strategy

**Best approach: scrape + mirror the DMV images.** You'd write a one-time Python scraper (with `requests` + `BeautifulSoup`) to:
1. Walk all the plate category pages
2. Extract: name, category, description/slogan text, image URL
3. Download the images to your own server/CDN
4. Output a `plates.json` data file

This is legal fair use of public government data. The DMV makes these images publicly available specifically so residents can browse them. You wouldn't be hitting the DMV in production — you'd mirror everything once.

**Alternative:** The El Paso County DMV publishes a [full PDF gallery](https://epc-assets.elpasoco.com/wp-content/uploads/sites/5/License-Plate-Gallery-01032025.pdf) of all designs as of January 2025, which could serve as a secondary reference.

### Architecture: pure static site, no backend needed

Your URL-with-unique-ID idea is elegantly achievable with **zero backend**:

- Generate a short random ID (e.g. `abc123`) on first visit
- Store spotted state in `localStorage` keyed to that ID
- The URL is just `yourdomain.com/?game=abc123`
- Share the URL → same browser on same device restores the game

If you want cross-device sharing (same URL works on a friend's phone), you'd need either a tiny backend or a service like [jsonbin.io](https://jsonbin.io) / Supabase as a free key-value store. But for a personal/family game, localStorage is perfectly fine.

### Tech stack recommendation

**No framework needed.** This is a great case for a lightweight vanilla approach:

| Need | Recommendation |
|------|---------------|
| Fuzzy search | [Fuse.js](https://fusejs.io) — tiny, zero-dependency, perfect for this |
| Filtering/state | Vanilla JS + `localStorage` |
| Styling | [Pico CSS](https://picocss.com) or plain CSS — clean, mobile-friendly |
| Image lazy loading | Native `loading="lazy"` on `<img>` tags |
| Build/bundling | None needed — single HTML + JS + JSON file |

**Fuse.js** is the key library. It handles fuzzy matching on the plate slogan/name text, so searching "wild" finds "Born to be Wild", "wildlife" finds "Wildlife Sporting", etc. It's ~24KB.

### Data file shape (`plates.json`)

```json
[
  {
    "id": "born-to-be-wild",
    "name": "Born to be Wild",
    "slogan": "Born to be Wild",
    "category": "group-special",
    "image": "/plates/born_to_be_wild.jpg",
    "tags": ["wildlife", "wolf", "nature"]
  }
]
```

### Game state in localStorage

```json
{
  "gameId": "abc123",
  "created": "2026-04-04",
  "spotted": ["born-to-be-wild", "broncos-foundation", "columbine"]
}
```

### UI layout

- **Header:** `Spotted: 14 / 218` · progress bar · filter chips (All / Spotted / Unspotted / by category) · fuzzy search box
- **Grid:** plate image cards, tap to toggle spotted (green overlay / checkmark)
- **URL:** updates with `?game=abc123` on first interaction; shareable

### What's tricky

1. **Plate count changes** — CO adds ~4 new plates/year, so the scraper should be re-runnable
2. **"Slogan" text** — many plates don't have a visible text slogan (just imagery), so the search index should also include the plate name and category tags
3. **Image sizes** — DMV images vary a lot in quality; you may want to normalize them. The DMV uses `styles/mobile_featured_image_1x_767px/` URL variants which are reasonably sized

### Summary verdict

**Very doable as a static site.** The scraping + data prep is the most work (~a day), but the game itself could be a clean single-page HTML file with Fuse.js and localStorage. No server, no database, no build step. Just `plates.json` + `index.html` + `/plates/*.jpg`.

Want me to write the Python scraper, the plates.json data structure, or the game HTML itself next?
