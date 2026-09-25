# Intentional jump out of bubble

Separate from the surprised pop/fall animation: the player voluntarily jumps upward from INSIDE the bubble, which bursts at takeoff.

Eight frames, 4 columns × 2 rows, row-major:
- 1–2 `anticipation`: enclosed float, gather hind legs.
- 3–4 `takeoff-pop`: upward push and simultaneous membrane rupture.
- 5–8 `ascend`: rising cat and fading droplets; clean airborne endpoint.

Runtime integration plan (not yet implemented): consume the jump input once; on takeoff end the enclosed bubble state and begin normal upward jump physics; spawn the burst at the bubble's world position. Do not retain an intact rideable bubble after takeoff. Existing surprised-pop sequence remains a different reaction.

Generated using built-in ImageGen; Aseprite packs the drawings at a single scale calibrated to the existing 64px head reference. Source-cell movement is retained to preview the upward jump. A runtime integration must account for these animation offsets to avoid adding the depicted rise twice on top of physics movement. GIF replays for demonstration; the ability should play once.

No existing artwork replaced; no gameplay code modified.
