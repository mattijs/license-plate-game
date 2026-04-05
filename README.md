# License Plate Game

> Simple HTML game to spot license plates

## Scraper

Collects plate data from state DMV websites and outputs a `plates.json` + plate images.

**Requirements:** Python 3.11+, [uv](https://docs.astral.sh/uv/)

### Colorado

```bash
uv run --directory scrapers colorado.py --output-dir public
```

Scrapes `dmv.colorado.gov` and writes:

- `public/plates.json` — array of plate objects
- `public/plates/*.{jpg,png,gif}` — plate images

Re-runnable: already-downloaded images are skipped.

### Output format

```json
[
  {
    "id": "born-to-be-wild",
    "name": "Born to Be Wild",
    "category": "group-special",
    "description": "About: ...",
    "image": "/plates/born-to-be-wild.jpg"
  }
]
```

Categories: `regular`, `group-special`, `military`, `alumni`
