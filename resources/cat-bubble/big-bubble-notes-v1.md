# Large bubble special animation

Artwork generated with built-in ImageGen. Packing uses Aseprite without procedural character drawing.

Intended trigger: soap solution fully collected, then the player lands on a cloud. This is a charged special action, not a random idle animation. Gameplay logic is not implemented by this asset task.

- Frames 1–6: landing, preparation, inflation, release (`inflate`, play once).
- Frames 7–9: hop onto bubble (`mount`, play once).
- Frames 10–12: ride pose (`ride`, loop while traveling).
- Combined sheet: 4 columns × 3 rows, row-major.
- Aseprite contains the 12 source frames and named tags.
- Full GIF repeats the ride section for demonstration, then restarts the whole action. That restart is not intended during gameplay.

The canvas includes space for the large bubble and is larger than a normal 128px cat frame. Do not scale the entire effect down to the ordinary cat rectangle: preserve character scale, position the effect separately, and keep character collision geometry unchanged. The packer calibrates frame 1 head width to the existing 64px reference and uses a single scale across the full sequence; generated pose drawings may have small per-frame variation. Runtime mount positioning and travel mechanics still need integration and testing.

No existing sprites or gameplay code were replaced.
