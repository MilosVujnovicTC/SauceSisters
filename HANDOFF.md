# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 7-4: Zone 6 tilemap (Enzo's Pizzeria) — completed 2026-03-23

## Current stage in progress
- Stage 7-5: Enzo boss fight
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=11` cache-busting parameters
- Working features:
  - Phase 1-5 complete: engine, 4 zones, puzzles, weapons, enemies, power-ups, health
  - Stage V-1: all sprites procedurally generated
  - Stage A-1: Howler.js sample SFX, upgraded Tone.js music, ambient layers
  - Stage 6-1: Papa Marco hint system
  - Stage 7-1: Papa's Gym zone with 3 NPCs, recipe #3, Tamagotchi placeholder
  - Stage 7-2: Drum solo interlude — rhythm game with backing track, grades, rewards
  - Stage 7-3: Piazza Vecchia zone with build puzzle, 3 NPCs, bench/planter sprites
  - Stage 7-4: Enzo's Pizzeria zone with 3 NPCs, sauce machine room (locked)
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
- Known issues: none

## Pizzeria system (7-4)
- 28x20 zone: dining area (left, checkered floor + tables), kitchen (center, ovens/stoves), sauce machine room (right, locked)
- Door passage at col 13 rows 9-11 connects dining↔kitchen
- Sauce room wall: col 22 rows 9-10 = W (wall), opened to D by restoreSauceRoomDoor() when enzo_boss_defeated
- Enzo NPC at (17,9): 3-state dialogue (first visit, returning, post-boss)
- Sauce machine door object at (22,10): interact gives locked/open message
- Piazza→Pizzeria: piazza col 29 rows 10-13 → pizzeria (1,10)
- Pizzeria→Piazza: pizzeria col 0 rows 10-11 → piazza (24,11/12)

## Zones
- 7 zones active: La Cucina → Market → Canal → Library → Gym → Piazza → Pizzeria
- Recipe fragments: #1 (Market heart puzzle), #2 (Library Nokia/Brodo), #3 (Gym competition form)
- Recipe #4 will be in sauce machine room after Enzo boss (Stage 7-5)

## Tile shorthand note
- Original 16 tile shorthands use `const`: F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X
- Gym: `var` _MT, _EQ, _JB, _MR
- Piazza: `var` _FN, _CB, _FT
- Pizzeria: `var` _OV, _DI, _SM, _CK

## Next step
- Stage 7-5: Enzo boss fight. Boss arena in kitchen area. Enzo attack patterns: throws pizza dough (projectile), charges, summons waiter enemies. 3-phase fight. Defeat → sauce machine room unlocks → recipe #4.
