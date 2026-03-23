# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 7-7: Zone 7 tilemap (Mama's Sewing Shop) — completed 2026-03-23

## Current stage in progress
- Stage 7-8: Dot-matrix printer puzzle + recipe #5
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=15` cache-busting parameters
- Working features:
  - Phase 1-5 complete: engine, 4 zones, puzzles, weapons, enemies, power-ups, health
  - Stage V-1: all sprites procedurally generated
  - Stage A-1: Howler.js sample SFX, upgraded Tone.js music, ambient layers
  - Stage 6-1: Papa Marco hint system
  - Stage 7-1: Papa's Gym zone with 3 NPCs, recipe #3, Tamagotchi placeholder
  - Stage 7-2: Drum solo interlude — rhythm game with backing track, grades, rewards
  - Stage 7-3: Piazza Vecchia zone with build puzzle, 3 NPCs, bench/planter sprites
  - Stage 7-4: Enzo's Pizzeria zone with 3 NPCs, sauce machine room (locked)
  - Stage 7-5: Enzo boss fight — 3-phase, all weapons, HP bar, defeat unlocks sauce room + recipe #4
  - Stage 7-6: Cooking mini-game — 4-step (stir/season/taste/heat), graded S/A/B/C
  - Stage 7-7: Mama's Sewing Shop — 3 NPCs, 4 new tile types, printer placeholder, music + ambient
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
  - closeDialogue() fix: state resets before onComplete callback
  - restoreSauceRoomDoor/restoreSewingShopDoor write to both ZONES map AND game.currentMap
- Known issues: none

## Sewing Shop system (7-7)
- 24x18 zone: main room (left, sewing machines + mannequins + rug) + back room (right, fabric rolls + counters + printer)
- 4 new tile types: FABRIC (id 27), SEWMACH (id 28), MANNEQUIN (id 29), CARPET (id 30)
- Tile shorthands: var _FB, _SW, _MN, _CP
- 3 NPCs: Mama Rosa (quest, col 6 row 6), Signora Threads (flavor, col 18 row 5), Little Tomás (flavor, col 4 row 14)
- Dot-matrix printer object at (17,6) — placeholder dialogue
- Access: pizzeria col 27 rows 8-9 → sewing_shop (1,9). Return: col 0 rows 9-10 → pizzeria (26,8/9)
- restoreSewingShopDoor() opens col 27 rows 8-9 when enzo_boss_defeated — called from both loadZone and boss defeat handler
- Music: Bb major 75 BPM (sine melody + triangle pad + triangle bass → musicReverb)
- Ambient: brown noise through 200Hz lowpass
- Papa hints: 3 entries in ui.js
- Power-up: Milk at (20,14)

## Zones
- 8 zones active: La Cucina → Market → Canal → Library → Gym → Piazza → Pizzeria → Sewing Shop
- Recipe fragments: #1 (Market heart puzzle), #2 (Library Nokia/Brodo), #3 (Gym competition form), #4 (Pizzeria sauce room after boss)
- Recipe #5 will come from dot-matrix printer puzzle (Stage 7-8)

## Tile shorthand note
- Original 16 tile shorthands use `const`: F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X
- Gym: `var` _MT, _EQ, _JB, _MR
- Piazza: `var` _FN, _CB, _FT
- Pizzeria: `var` _OV, _DI, _SM, _CK
- Sewing Shop: `var` _FB, _SW, _MN, _CP

## Next step
- Stage 7-8: Dot-matrix printer puzzle + recipe #5. Interact with printer at (17,6) in sewing shop back room. Paper-threading micro-maze: arrow key navigation through tight maze path. Hitting maze walls resets to start of section. Completing maze awards recipe fragment #5. Puzzle state saved via printer_puzzle_solved flag.
