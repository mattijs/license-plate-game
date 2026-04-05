---
name: co-plate-crop
description: Crop Colorado license plate images to isolate the Passenger non-personalized plate variant. Handles multi-plate layouts (2x2 grids, pairs, singles). Use when processing plates.json images to extract the canonical plate representation.
---

# Plate Crop Skill

Analyzes Colorado license plate source images and crops out the **Passenger non-personalized** plate variant — the standard `000 [logo] XXX` format — from images that may contain 1, 2, or 4 plate variants in a grid layout.

## Running from the CLI

Use `claude -p` to run this skill non-interactively from the project root:

```bash
# Process all plates
claude -p "Use the co-plate-crop skill to crop all Colorado license plate images. Source: public/plates/, output: public/plates-cropped/, metadata: public/plates.json"

# Process specific plates by ID
claude -p "Use the co-plate-crop skill to crop these plates: adopt-a-shelter-pet, als, vietnam-veteran. Source: public/plates/, output: public/plates-cropped/"

# Or via the /crop-co-plates command
claude -p "/crop-co-plates"
claude -p "/crop-co-plates adopt-a-shelter-pet als vietnam-veteran"
```

> `claude -p` runs in print mode (non-interactive, no conversation history). Make sure to run from the repo root so relative paths resolve correctly.

## Input

- **Source directory**: where the original plate images are (default: `public/plates/`)
- **Output directory**: where cropped images go (default: `public/plates-cropped/`)
- **plates.json**: plate metadata at `public/plates.json`
- Optionally a specific list of plate IDs to process

## Output

For each processed plate: a cropped image saved to the output directory with the **same filename** as the original.

## Plate Selection Heuristics

Colorado DMV images show 1–4 plate variants in a grid. Selection priority, in order:

### 1. Skip these plate types entirely
- **Motorcycle plates** — smaller, nearly square, labeled "Motorcycle"
- **Disability/PWD plates** — show the wheelchair symbol (♿), labeled "Motorcycle PWD" or contain "PWD"
- **Personalized plates** — show `XXXXXXX` (all X's, no center logo)
- **Disabled veteran** plates — described in plates.json description as disability plates

### 2. Pick this plate
**Passenger non-personalized** — the standard format:
- Label reads "Passenger", "Passenger Regular", or has no label (single plate)
- Has a center logo/graphic flanked by numbers and letters: `000 [logo] XXX` or `XXX [logo] X00`
- Is the larger rectangular format (wider than tall, ~2:1 aspect ratio)
- In a 2x2 grid: always **top-left**
- In a 2-plate layout: the **left** or **top** one (whichever is larger/has logo)

### 3. Layout detection

Look at the image visually to classify the layout:

```
LAYOUT A: 4-plate 2x2 grid
┌─────────────────┬─────────────────┐
│  Passenger      │  Passenger      │
│  (000 logo XXX) │  Personalized   │
│                 │  (XXXXXXX)      │
├─────────────────┼─────────────────┤
│  Motorcycle     │  Motorcycle     │
│  (smaller)      │  PWD or Pers.   │
└─────────────────┴─────────────────┘
→ Crop: top-left quadrant

LAYOUT B: 3-plate grid (Passenger missing top-right label space)
┌─────────────────┬─────────────────┐
│  Passenger      │  (Moto PWD or   │
│                 │   empty)        │
├─────────────────┼─────────────────┤
│  Motorcycle     │  Motorcycle PWD │
└─────────────────┴─────────────────┘
→ Crop: top-left quadrant

LAYOUT C: 2-plate side by side
┌─────────────────┬─────────────────┐
│  Passenger      │  Personalized   │
└─────────────────┴─────────────────┘
→ Crop: left half

LAYOUT D: Single plate
┌─────────────────────────────────────┐
│  Passenger plate                    │
└─────────────────────────────────────┘
→ Crop: full image (trim edges only)
```

## Tools Required

- **sips** (macOS built-in) — get image dimensions
- **ImageMagick** (`magick` or `convert`) — crop images

## Process Per Image

### Step 1: Inspect

```bash
# Get dimensions
sips -g pixelWidth -g pixelHeight public/plates/filename.jpg
```

Read the image visually to:
1. Determine layout (A/B/C/D above)
2. Locate the Passenger non-personalized plate region
3. Note whether there are text labels below each plate

### Step 2: Calculate crop

**For 2x2 or 3-plate grids (Layout A/B):**

The image is divided roughly into quadrants. The top half contains passenger plates. Labels (e.g. "Passenger", "Motorcycle") appear below the plate graphics, within each half.

Estimate:
- `plate_width` ≈ 48–50% of total width (to avoid including right-half plate)
- `plate_height` ≈ 42–47% of total height (to include the plate but not the bottom motorcycle row)
- `x_offset` ≈ 2–4% of width (small left margin)
- `y_offset` ≈ 2–4% of height (small top margin)

**Important:** Exclude the text labels below each plate — they're captions, not part of the plate graphic. Typically the label row occupies the bottom 5–8% of each half.

**For 2-plate side-by-side (Layout C):**
- `plate_width` ≈ 48% of total width
- `plate_height` ≈ 90% of total height

**For single plate (Layout D):**
- Use full image, optionally trim whitespace with `-trim`

### Step 3: Crop

```bash
# Standard crop: WxH+X+Y
magick input.jpg -crop WxH+X+Y +repage -quality 90 output.jpg

# For PNG inputs/outputs
magick input.png -crop WxH+X+Y +repage output.png

# Single plate — trim whitespace
magick input.jpg -trim +repage -quality 90 output.jpg
```

### Step 4: Verify

Read the output image. Verify:
- Only one plate is visible
- The plate is not clipped (full plate visible including outer border)
- No motorcycle plate, personalized plate, or PWD plate
- Labels/caption text below the plate are NOT visible
- It is acceptable if rounded plate corners show against a white or gray background

If the crop is wrong, recalculate and redo.

## Cropping Tips

- **Be generous** — include a few extra pixels of border rather than clipping the plate edge
- **Exclude captions** — "Passenger", "Motorcycle" labels should not appear in output
- **Rounded corners are fine** — the output may show rounded corners against white/gray background; do not try to mask them
- **Preserve the plate image** — the mountain scenery, colors, logos inside the plate must be intact
- **Check the result visually** — always read the output image after cropping

## Workflow

### Survey Phase

1. Read `public/plates.json` to get the list of plates with images
2. Filter out plates where `image` is `null`
3. Build a list of `(id, image_path)` pairs to process

### Processing Phase

For **≤ 5 plates**: process directly in sequence.
For **> 5 plates**: spawn parallel agents in batches of 6, each agent handling a batch.

Per plate:
1. Get image dimensions with sips
2. Read image visually to classify layout
3. Calculate crop coordinates
4. Run ImageMagick crop
5. Read output image to verify
6. If wrong, adjust and retry (max 2 retries)

### Report Phase

Output a summary table:

```
Processed: 45/47
Skipped (null image): 2

Results:
  ✓ adopt-a-shelter-pet.jpg  →  2x2 grid, cropped top-left
  ✓ als.jpg                  →  2x2 grid, cropped top-left
  ✗ motorcycle.jpg           →  SKIPPED (motorcycle-only plate)
  ...
```

Note any plates that needed manual review or where the heuristic was uncertain.

## Special Cases

### Plates to skip entirely (no valid Passenger variant exists)
- `motorcycle` — motorcycle-only plate, no passenger variant in image
- `trailer` — trailer plate, not a passenger plate
- `recreational-truck` — truck plate
- `disabled-veteran-handicapped` — disability plate only
- `persons-with-disabilities` — disability plate only

### Ambiguous cases
If you cannot confidently identify a Passenger non-personalized plate (e.g. the image shows only personalized variants, or only motorcycle plates), skip the plate and note it in the report for manual review.

### Already single-plate images
Some images already contain only one plate. Check if it is a passenger non-personalized plate. If yes, just trim whitespace and save. If not, skip.
