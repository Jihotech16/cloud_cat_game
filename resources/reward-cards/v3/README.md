# Reward card frame corrections

Built-in ImageGen edits for jump and magnet. Jump uses the charge card's blue/gold border template; magnet uses scoreMul's teal/gold border template. Gold paw medallions, gold inner rules, scroll corners and description-panel framing replace the inconsistent designs. Original illustration subjects and transparent exteriors retained.

This is the complete current set of 23 cards. Full set: `index.html`. All 23 latest high-resolution generated originals are consolidated in `source/`. Border correction prompts: `prompts.txt`; earlier transparency edit prompts: `transparency-prompts.txt`.

Repack all 23 cards: `aseprite -b --script scripts/pack_reward_cards.lua`

Full cards 512×768; visible alpha≥128 bounds x16 y24 width480 height720. Runtime cards 256×384 are deployed in `assets/reward-cards/`. Superseded v1/v2 folders were moved to macOS Trash during cleanup; no runtime references depend on them.
