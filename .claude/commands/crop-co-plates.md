---
description: Crop Colorado license plate images to isolate the Passenger non-personalized plate variant from multi-plate layout images.
---

Invoke the `co-plate-crop` skill to process Colorado license plate images.

Source directory: `public/plates/`
Output directory: `public/plates-cropped/`
Metadata: `public/plates.json`

Process all plates unless specific IDs are given as arguments: $ARGUMENTS

For each image in plates.json, identify and crop the Passenger non-personalized plate variant (the `000 [logo] XXX` format plate, not the personalized or motorcycle variants).
