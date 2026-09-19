# POING shine animation

Generated with built-in image_gen. Existing static icons are preserved.

- Individual sheets: assets/poing-{p,o,i,n,g}-shine-sheet.png
- Each sheet: 256×64, four horizontal 64×64 frames, 500ms per frame.
- Combined atlas: assets/poing-shine-atlas.png, 256×320.
- Atlas rows: P, O, I, N, G. Columns: frames 0, 1, 2, 3.
- Floating suggestion: y += 2 * sin(timeSeconds * PI + letterPhase).
- Preview: 1.92-second loop due to GIF timing granularity, with 2px floating.
- Only rim shine is drawn into the sheets. Floating is separate positional animation.
- Collection flight, HUD slots and completed-word events are not implemented.
