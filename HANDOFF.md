# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 7-6: Cooking mini-game — completed 2026-03-23

## Current stage in progress
- Stage 7-7: Zone 7 tilemap (Mama's Sewing Shop)
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=13` cache-busting parameters
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
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
  - closeDialogue() fix: state resets before onComplete callback
- Known issues: none

## Cooking mini-game system (7-6)
- COOK_CONFIG + cooking state in puzzles.js
- 4 steps: stir (alternate ←→, ring fill), season (oscillating meter), taste (rising indicator), heat (hold ↓ thermometer)
- Each step: perfect/great/ok/miss → total score → grade S/A/B/C
- Triggered via setTimeout(startCooking, 800) in pickupItem when recipe_4 collected
- cooking_minigame_done flag prevents re-trigger
- game.mode = 'cooking' delegates update/render in engine.js
- endCooking() → game.mode = 'overworld' + Giulia dialogue about quality

## Zones
- 7 zones active: La Cucina → Market → Canal → Library → Gym → Piazza → Pizzeria
- Recipe fragments: #1 (Market heart puzzle), #2 (Library Nokia/Brodo), #3 (Gym competition form), #4 (Pizzeria sauce room after boss)
- Recipe #5 will be in Mama's Sewing Shop (Stage 7-8)

## Tile shorthand note
- Original 16 tile shorthands use `const`: F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X
- Gym: `var` _MT, _EQ, _JB, _MR
- Piazza: `var` _FN, _CB, _FT
- Pizzeria: `var` _OV, _DI, _SM, _CK

## Next step
- Stage 7-7: Zone 7 tilemap (Mama's Sewing Shop). Sewing shop zone tilemap: fabric rolls, sewing machines, mannequins. Zone transition from Enzo's (post-boss). Mama Rosa NPC with scripted dialogue. Dot-matrix printer object placed for puzzle (Stage 7-8). Only accessible after Enzo boss is defeated.
