"""
Colorado DMV license plate scraper.

Scrapes all plate designs from dmv.colorado.gov, downloads images, and
outputs plates.json. Re-runnable: skips already-downloaded images.

Usage:
    uv run main.py [--output-dir ../public]
"""

import argparse
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://dmv.colorado.gov"

# (path, category_id)
# "other" excluded: commercial, dealer, government, collector plates — not road-spottable
PLATE_PAGES = [
    ("/regular-license-plates", "regular"),
    ("/group-special-license-plates-new", "group-special"),
    ("/license-plates-military", "military"),
    ("/license-plates-alumni", "alumni"),
]

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; plate-scraper/1.0; +personal-project)"
})


def fetch(url: str) -> BeautifulSoup:
    resp = SESSION.get(url, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.content, "lxml")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


def image_key(url: str) -> str | None:
    """
    Canonical dedup key for an image URL.
    Drupal serves the same file under multiple style prefixes:
      /sites/dmv/files/styles/<style>/public/<subdir>/<file>
    Strip everything up to /public/ so variants of the same file compare equal.
    """
    if not url:
        return None
    path = urlparse(url).path
    if "/public/" in path:
        return path.split("/public/", 1)[1].lower()
    return path.lower()


def extract_image_url(dd: BeautifulSoup) -> str | None:
    """
    Pages use two image patterns:
    - <img> directly in a <div> inside <dd>  (regular/military/alumni/other)
    - <picture> with <source> + fallback <img>  (group-special)
    In both cases dd.find('img') gets the right element.
    """
    img = dd.find("img")
    if not img:
        return None
    src = img.get("src", "")
    # Prefer tablet_featured (450px wide) over mobile (smaller)
    # The <picture> sources all point to the same file in different styles;
    # swap in a higher-quality style if we can.
    src = re.sub(
        r"/styles/[^/]+/",
        "/styles/large_thumbnail_450x450_/",
        src,
    )
    return urljoin(BASE_URL, src) if src else None


def parse_plates_from_page(url: str, category: str) -> list[dict]:
    """
    DMV plate pages use:
      <dl>
        <dt>Plate Name</dt>
        <dd>
          <div><img ...></div>   or   <div><picture><img ...></picture></div>
          <p>Description...</p>
          <p>Available For: ...</p>
          ...
        </dd>
      </dl>
    """
    soup = fetch(url)
    plates = []

    for dl in soup.find_all("dl"):
        for dt in dl.find_all("dt", recursive=False):
            name = dt.get_text(strip=True)
            if not name:
                continue

            dd = dt.find_next_sibling("dd")
            if not dd:
                continue

            image_url = extract_image_url(dd)

            # Collect all <p> text blocks as description
            desc_parts = [p.get_text(" ", strip=True) for p in dd.find_all("p") if p.get_text(strip=True)]
            description = " ".join(desc_parts)

            plates.append({
                "name": name,
                "category": category,
                "description": description,
                "image_url": image_url,
            })

    return plates


def download_image(url: str, dest: Path) -> bool:
    """Download image to dest. Returns True if downloaded, False if skipped (cached)."""
    if dest.exists():
        return False
    resp = SESSION.get(url, timeout=20, stream=True)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    return True


def build_plate_records(raw: list[dict], images_dir: Path) -> list[dict]:
    """Assign stable IDs, deduplicate, download images, build final records."""
    seen_ids: dict[str, int] = {}
    seen_images: set[str] = set()
    records = []

    for plate in raw:
        # Skip vehicle-class variants that share an image with an already-seen plate
        # (e.g. Motorcycle, Light Truck, Trailer all use the same mountain design)
        key = image_key(plate["image_url"])
        if key:
            if key in seen_images:
                print(f"    [dedup     ] {plate['name']} (same image as earlier entry)")
                continue
            seen_images.add(key)

        base_id = slugify(plate["name"])
        if base_id in seen_ids:
            seen_ids[base_id] += 1
            plate_id = f"{base_id}-{seen_ids[base_id]}"
        else:
            seen_ids[base_id] = 0
            plate_id = base_id

        image_path = None
        if plate["image_url"]:
            ext = Path(urlparse(plate["image_url"]).path).suffix or ".jpg"
            filename = f"{plate_id}{ext}"
            dest = images_dir / filename
            try:
                downloaded = download_image(plate["image_url"], dest)
                status = "downloaded" if downloaded else "cached   "
                print(f"    [{status}] {filename}")
            except Exception as e:
                print(f"    [error    ] {filename}: {e}")
            image_path = f"/plates/{filename}"

        records.append({
            "id": plate_id,
            "name": plate["name"],
            "category": plate["category"],
            "description": plate["description"],
            "image": image_path,
        })

    return records


def main():
    parser = argparse.ArgumentParser(description="Scrape Colorado DMV license plates")
    parser.add_argument(
        "--output-dir",
        default="output",
        help="Directory for plates.json and plates/ images (default: output)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    images_dir = output_dir / "plates"
    images_dir.mkdir(parents=True, exist_ok=True)

    print("=== Scraping plate pages ===")
    raw: list[dict] = []
    for path, category in PLATE_PAGES:
        url = BASE_URL + path
        print(f"  [{category}] {url}")
        try:
            plates = parse_plates_from_page(url, category)
            print(f"    → {len(plates)} plates")
            raw.extend(plates)
        except Exception as e:
            print(f"    ERROR: {e}")
        time.sleep(0.5)

    print(f"\nTotal: {len(raw)} plates")

    print("\n=== Downloading images ===")
    records = build_plate_records(raw, images_dir)

    plates_json = output_dir / "plates.json"
    plates_json.write_text(json.dumps(records, indent=2, ensure_ascii=False))

    print(f"\n=== Done ===")
    print(f"  {len(records)} plates  →  {plates_json}")
    print(f"  Images  →  {images_dir}/")


if __name__ == "__main__":
    main()
