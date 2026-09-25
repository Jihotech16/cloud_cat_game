# Large bubble: enter and float INSIDE

This replaces the earlier interpretation of standing on top of the bubble. The character enters the bubble and floats fully enclosed within it, with a visible rim around the ears, feet and tail.

Trigger planned by user: soap solution collected in full, followed by landing on a cloud. No random activation and no gameplay implementation in this asset task.

12 frames, row-major 4 × 3 sheet:
- 1–6 / `inflate`: land, raise wand, blow and release a large bubble.
- 7–9 / `enter`: pass through the soap film and become fully enclosed.
- 10–12 / `float-inside`: enclosed floating loop.

Art: built-in ImageGen. Packing: Aseprite, calibrated to the existing character head width with a fixed scale across frames. Do not shrink the entire effect to the normal 128px character canvas; its larger canvas includes the bubble. Small generated per-frame variations remain possible.

The demonstration GIF repeats the final loop before replaying the full sequence. Runtime should play inflation/entry once then loop only the enclosed floating frames. Previous files are retained as drafts, not used by the game. No game code changed.
